import { createOptimizedPicture, readBlockConfig, toClassName } from '../../scripts/aem.js';
import { createTag, QUERY_INDEX_PAGE_SIZE } from '../../scripts/shared.js';

const DEFAULT_SOURCE = '/products-index.json';
const DEFAULT_LIMIT = 24;
const DEFAULT_SORT = 'name';
const SORT_VALUES = ['name', 'price-asc', 'price-desc', 'category'];

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Fetches one page of a product index. Adapted from shared.js's fetchQueryIndexPage,
 * which hardcodes /query-index.json; this takes the index path as a parameter so the
 * block can point at an author-supplied source.
 * @param {number} offset
 * @param {number} limit
 * @param {string} source index path, e.g. /products-index.json
 * @returns {Promise<Array<Object>>}
 */
async function fetchProductsIndexPage(offset, limit, source) {
  const resp = await fetch(`${source}?offset=${offset}&limit=${limit}`);
  if (!resp.ok) throw new Error(`Products index request failed: ${resp.status}`);
  const json = await resp.json();
  return json?.data || [];
}

/**
 * Fetches the full product index across pages. Product catalogs are expected to be
 * small-to-moderate, so this fetches everything eagerly: category chip counts need
 * the true totals, not just enough rows to fill one page.
 * @param {string} source index path
 * @returns {Promise<Array<Object>>}
 */
async function fetchAllProductRows(source) {
  const rows = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await fetchProductsIndexPage(offset, QUERY_INDEX_PAGE_SIZE, source);
    offset += batch.length;
    hasMore = batch.length === QUERY_INDEX_PAGE_SIZE;
    rows.push(...batch);
  }
  return rows;
}

/**
 * Replaces shared.js's isQueryableRow, which requires row.title; product rows have
 * row.name instead. Excludes noindex rows, same as isQueryableRow.
 * @param {Object} row a product index row
 * @returns {boolean}
 */
function isValidProductRow(row) {
  if (!row?.name || !(row.path || row.slug)) return false;
  const robots = String(row.robots || '').toLowerCase();
  return !robots.includes('noindex');
}

/**
 * The product detail page path for a row. A query index always carries `path`;
 * `slug` is only present if selected as a column, so fall back to it.
 * @param {Object} row a product index row
 * @returns {string}
 */
function productPath(row) {
  return row.path || `/products/${row.slug}`;
}

function parseSource(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value || '').trim() || DEFAULT_SOURCE;
}

function parseCategoriesOverride(raw) {
  if (raw == null || raw === '') return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .flatMap((value) => String(value).split(','))
    .map((category) => category.trim())
    .filter(Boolean);
}

function parseLimit(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(String(value ?? '').trim(), 10);
  return Number.isNaN(parsed) ? DEFAULT_LIMIT : parsed;
}

function parseSort(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const normalized = String(value || '').trim().toLowerCase();
  return SORT_VALUES.includes(normalized) ? normalized : DEFAULT_SORT;
}

/**
 * Formats a price for display. Hardcoded to USD to match the schema's "Price (USD)"
 * field; a missing or non-numeric price formats to ''.
 * @param {*} price a product row's price value
 * @returns {string}
 */
function formatPrice(price) {
  const value = Number(price);
  return Number.isFinite(value) ? priceFormatter.format(value) : '';
}

/**
 * Builds a product's image node. A leading '/' means an EDS content path, optimized
 * via createOptimizedPicture; anything else is an external URL rendered as a plain
 * lazy <img>, since createOptimizedPicture's srcset only works for EDS-hosted images.
 * Returns null when the row has no image (an empty-stripped field).
 * @param {Object} row a product index row
 * @returns {Element|null}
 */
function buildProductImage(row) {
  const { image, name } = row;
  if (!image) return null;
  if (image.startsWith('/')) return createOptimizedPicture(image, name || '');
  return createTag('img', { loading: 'lazy', alt: name || '', src: image });
}

/**
 * Builds one product card <li>. Category and price nodes are omitted when the row
 * lacks them; the image node is omitted entirely when there's no image.
 * @param {Object} row a product index row
 * @returns {Element}
 */
function buildProductCard(row) {
  const link = createTag('a', { class: 'product-card-link', href: productPath(row) });

  const image = buildProductImage(row);
  if (image) link.append(createTag('div', { class: 'product-card-image' }, image));

  const body = createTag('div', { class: 'product-card-body' });
  if (row.category) body.append(createTag('p', { class: 'product-card-category' }, row.category));
  body.append(createTag('h3', { class: 'product-card-name' }, row.name));
  const price = formatPrice(row.price);
  if (price) body.append(createTag('p', { class: 'product-card-price' }, price));
  link.append(body);

  return createTag('li', { class: 'product-card' }, link);
}

/**
 * Sorts a set of product rows per the given order. Rows with a missing or NaN price
 * sort to the end regardless of direction for price-asc/price-desc.
 * @param {Array<Object>} rows
 * @param {string} sort one of SORT_VALUES
 * @returns {Array<Object>}
 */
function sortProductRows(rows, sort) {
  const sorted = [...rows];
  if (sort === 'price-asc' || sort === 'price-desc') {
    sorted.sort((a, b) => {
      const priceA = Number(a.price);
      const priceB = Number(b.price);
      const validA = Number.isFinite(priceA);
      const validB = Number.isFinite(priceB);
      if (!validA && !validB) return 0;
      if (!validA) return 1;
      if (!validB) return -1;
      return sort === 'price-asc' ? priceA - priceB : priceB - priceA;
    });
  } else if (sort === 'category') {
    sorted.sort((a, b) => {
      const catCompare = String(a.category || '').localeCompare(String(b.category || ''));
      if (catCompare !== 0) return catCompare;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  } else {
    sorted.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }
  return sorted;
}

/**
 * Loads and decorates the products block: fetches the full product index once, then
 * renders a category-filterable, sortable, paginated grid.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const config = readBlockConfig(block);
  const source = parseSource(config.source);
  const categoriesOverride = parseCategoriesOverride(config.categories);
  const pageSize = parseLimit(config.limit);
  const initialSort = parseSort(config.sort);

  const state = {
    rows: [],
    category: 'all',
    sort: initialSort,
    displayCount: pageSize,
    loading: false,
  };

  block.textContent = '';
  const gridId = `products-grid-${Date.now()}`;
  const sortId = `products-sort-${Date.now()}`;

  const filters = createTag('div', {
    class: 'products-filters',
    role: 'group',
    'aria-label': 'Filter by category',
  });
  const sortSelect = createTag(
    'select',
    { id: sortId, name: 'products-sort', 'aria-controls': gridId },
    [
      createTag('option', { value: 'name' }, 'Name (A-Z)'),
      createTag('option', { value: 'price-asc' }, 'Price (low to high)'),
      createTag('option', { value: 'price-desc' }, 'Price (high to low)'),
      createTag('option', { value: 'category' }, 'Category (A-Z)'),
    ],
  );
  sortSelect.value = initialSort;
  const sortLabel = createTag(
    'label',
    { class: 'products-sort-label', for: sortId },
    ['Sort', sortSelect],
  );
  const controls = createTag('div', { class: 'products-controls' }, [filters, sortLabel]);

  const status = createTag('p', { class: 'products-status', role: 'status', 'aria-live': 'polite' });
  const grid = createTag('ul', { class: 'products-grid', id: gridId });
  const empty = createTag('p', { class: 'products-empty', hidden: true });
  const loadMore = createTag('button', {
    type: 'button',
    class: 'products-load-more button primary',
    hidden: true,
  }, 'Load More');
  const resultsWrap = createTag(
    'div',
    { class: 'products-results-wrap' },
    [status, grid, empty, loadMore],
  );

  block.append(controls, resultsWrap);

  try {
    const rawRows = await fetchAllProductRows(source);
    const seen = new Set();
    state.rows = rawRows.filter((row) => {
      if (!isValidProductRow(row)) return false;
      const key = productPath(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    block.textContent = '';
    block.append(createTag('p', { class: 'products-empty' }, 'Unable to load products right now.'));
    return;
  }

  const categoryCounts = new Map();
  state.rows.forEach((row) => {
    if (!row.category) return;
    const token = toClassName(row.category);
    categoryCounts.set(token, (categoryCounts.get(token) || 0) + 1);
  });

  const categoryNames = categoriesOverride.length
    ? categoriesOverride
    : [...new Set(state.rows.map((row) => row.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

  const categoryLabelByToken = new Map();
  const chipButtons = [];

  const allChip = createTag('button', {
    type: 'button',
    class: 'products-filter-chip',
    'data-category': 'all',
    'aria-pressed': 'true',
  }, `All (${state.rows.length})`);
  filters.append(allChip);
  chipButtons.push(allChip);

  categoryNames.forEach((category) => {
    const token = toClassName(category);
    categoryLabelByToken.set(token, category);
    const chip = createTag('button', {
      type: 'button',
      class: 'products-filter-chip',
      'data-category': token,
      'aria-pressed': 'false',
    }, `${category} (${categoryCounts.get(token) || 0})`);
    filters.append(chip);
    chipButtons.push(chip);
  });

  function render() {
    state.loading = true;
    loadMore.disabled = true;
    loadMore.textContent = 'Loading...';

    try {
      const filtered = state.category === 'all'
        ? state.rows
        : state.rows.filter((row) => toClassName(row.category || '') === state.category);
      const sorted = sortProductRows(filtered, state.sort);
      const visible = sorted.slice(0, state.displayCount);

      grid.textContent = '';
      visible.forEach((row) => grid.append(buildProductCard(row)));

      empty.hidden = visible.length > 0;
      empty.textContent = state.category === 'all'
        ? 'No products in this catalog.'
        : 'No products in the selected category.';

      const categoryLabel = state.category === 'all' ? '' : categoryLabelByToken.get(state.category);
      status.textContent = categoryLabel
        ? `Showing ${visible.length} of ${filtered.length} products in ${categoryLabel}.`
        : `Showing ${visible.length} of ${filtered.length} products.`;

      loadMore.hidden = visible.length >= filtered.length;
    } finally {
      loadMore.disabled = false;
      loadMore.textContent = 'Load More';
      state.loading = false;
    }
  }

  filters.addEventListener('click', (event) => {
    const chip = event.target.closest('.products-filter-chip');
    if (!chip) return;
    state.category = chip.dataset.category;
    chipButtons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn === chip)));
    state.displayCount = pageSize;
    render();
  });

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    render();
  });

  loadMore.addEventListener('click', () => {
    if (state.loading) return;
    state.displayCount += pageSize;
    render();
  });

  render();
}
