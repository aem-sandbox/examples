import { decorateBlock, getMetadata, loadBlock } from '../../scripts/aem.js';
import { createTag, fetchQueryIndexPage, QUERY_INDEX_PAGE_SIZE } from '../../scripts/shared.js';

const PRODUCT_INDEX_BASE = '/products/product-detail';
const RELATED_LIMIT = 4;

/**
 * Home > Products > {category} > {product name}, built from page metadata already in
 * <head> — no extra fetch. "Products" and the category aren't links: this SKU catalog has
 * no browsable listing page of its own (it's JSON2HTML detail pages plus a query index),
 * unlike the /products bike catalog, which is a different, unrelated block and index.
 */
export function buildBreadcrumb() {
  const category = getMetadata('category');
  const name = document.title;
  if (!name) return null;

  const list = createTag('ol', {}, [
    createTag('li', {}, createTag('a', { href: '/' }, 'Home')),
    createTag('li', {}, 'Products'),
    category ? createTag('li', {}, category) : '',
    createTag('li', { 'aria-current': 'page' }, name),
  ]);

  return createTag('nav', { class: 'product-detail-breadcrumb', 'aria-label': 'Breadcrumb' }, list);
}

async function fetchAllProductRows() {
  const rows = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await fetchQueryIndexPage(offset, QUERY_INDEX_PAGE_SIZE, PRODUCT_INDEX_BASE);
    rows.push(...batch);
    hasMore = batch.length === QUERY_INDEX_PAGE_SIZE;
    offset += QUERY_INDEX_PAGE_SIZE;
  }
  return rows;
}

/** The index's `image` is relative to the row's own page path, not the current page. */
function resolveImageUrl(row) {
  if (!row.image) return null;
  try {
    return new URL(row.image, new URL(row.path, window.location.origin)).href;
  } catch {
    return null;
  }
}

// One `cards` row in the shape the block reads from authored markup: an optional image
// column, then a body column. Reuses the existing `cards` block rather than inventing
// bespoke related-product markup and CSS.
function buildCardRow(row) {
  const card = createTag('div');
  const imageUrl = resolveImageUrl(row);
  if (imageUrl) {
    // `data-src`, not `src`: the cards block swaps this for an optimized picture.
    card.append(createTag('div', {}, createTag('img', { 'data-src': imageUrl, alt: row.title || '' })));
  }

  const body = createTag('div', {}, createTag('h3', {}, createTag('a', { href: row.path }, row.title || row.path)));
  if (row.price) {
    body.append(createTag('p', { class: 'cards-card-description' }, `${row.price} ${row.currency || ''}`.trim()));
  }
  card.append(body);
  return card;
}

/**
 * Appends a "You might also like" section built from other rows in the same category,
 * excluding this product. Needs the whole catalog, not just this record, so it can't live
 * in the `product-detail` block — that's the difference between a block and a template.
 * @param {Element} main
 */
export async function appendRelatedProducts(main) {
  const category = getMetadata('category');
  const sku = getMetadata('sku');
  if (!category) return;

  let rows;
  try {
    rows = await fetchAllProductRows();
  } catch {
    return;
  }

  const related = rows
    .filter((row) => row.category === category && row.sku !== sku)
    .slice(0, RELATED_LIMIT);
  if (!related.length) return;

  const block = createTag('div', { class: 'cards product-detail-related' }, related.map(buildCardRow));
  const section = createTag('div', { class: 'section product-detail-related-section' }, [
    createTag('div', {}, createTag('h2', {}, 'You might also like')),
    createTag('div', {}, block),
  ]);
  main.append(section);
  decorateBlock(block);
  await loadBlock(block);
}

export default function init(root = document) {
  const main = root.querySelector('main');
  if (!main) return;

  // Prepended inside the block's own wrapper div, not the bare section: that wrapper
  // already carries the site's standard section padding/centering, so nesting the
  // breadcrumb inside it — rather than as a sibling — lines it up with the block's
  // own further-narrowed 900px column for free, without duplicating that math here.
  const blockWrapper = main.querySelector(':scope > div .product-detail')?.parentElement;
  const breadcrumb = buildBreadcrumb();
  if (breadcrumb && blockWrapper) blockWrapper.prepend(breadcrumb);

  // Started, not awaited: a query-index round trip here would hold up the rest of the
  // page. The section appears when the index resolves; a failure just leaves it out.
  appendRelatedProducts(main).catch(() => {});
}
