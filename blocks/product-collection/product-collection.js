import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  createTag, fetchQueryIndexPage, fetchStructuredContent, getBlockSourceUrl, QUERY_INDEX_PAGE_SIZE,
} from '../../scripts/shared.js';

const PRODUCT_INDEX_BASE = '/products/product-detail';

/*
 * A future edge worker could filter the query index at the origin, e.g.
 * `/query-index.json?skus=SKU-A,SKU-B`, so only the curated rows are ever transferred. That
 * worker doesn't exist in this repo yet, so fetchAllProductRows() below fetches the whole
 * index and this block filters client-side instead. Once the worker ships, swap the fetch
 * for something like:
 *
 * async function fetchProductRowsBySku(skus) {
 *   const params = skus.map(encodeURIComponent).join(',');
 *   const url = `${PRODUCT_INDEX_BASE}/query-index.json?skus=${params}`;
 *   const resp = await fetch(url);
 *   if (!resp.ok) throw new Error(`Product index request failed: ${resp.status}`);
 *   const json = await resp.json();
 *   return json?.data || [];
 * }
 */

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

function productCard(row) {
  const imageUrl = resolveImageUrl(row);
  const media = imageUrl
    ? createTag('div', { class: 'product-collection-card-image' }, createOptimizedPicture(imageUrl, row.title || ''))
    : '';

  return createTag('li', { class: 'product-collection-card' }, createTag('a', {
    class: 'product-collection-card-link',
    href: row.path,
  }, [
    media,
    createTag('div', { class: 'product-collection-card-body' }, [
      createTag('p', { class: 'product-collection-card-title' }, row.title || ''),
      row.price ? createTag('p', { class: 'product-collection-card-price' }, `${row.price} ${row.currency || ''}`.trim()) : '',
    ]),
  ]));
}

/**
 * Decorates a `product-collection` block whose only authored content is a URL to a
 * `product-collection` Structured Content endpoint. That record holds the editorial layer —
 * `collection-name`, `description`, and an ordered `products` array of SKUs — while the live
 * product data (title, image, price) is resolved from `/products/product-detail/query-index.json`
 * at render time, so a catalog change never needs re-authoring here.
 * @param {Element} block the `.product-collection` block
 */
export default async function decorate(block) {
  const url = getBlockSourceUrl(block);
  block.textContent = '';
  if (!url) return;

  const payload = await fetchStructuredContent(url);
  const collection = payload?.data;
  if (!collection || !Array.isArray(collection.products) || !collection.products.length) return;

  let productRows;
  try {
    productRows = await fetchAllProductRows();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Product collection: failed to load product index', e);
    return;
  }

  const rowsBySku = new Map(productRows.map((row) => [row.sku, row]));
  const items = collection.products.map((sku) => rowsBySku.get(sku)).filter(Boolean);
  if (!items.length) return;

  if (collection['collection-name']) {
    block.append(createTag('h2', { class: 'product-collection-heading' }, collection['collection-name']));
  }
  if (collection.description) {
    block.append(createTag('p', { class: 'product-collection-description' }, collection.description));
  }
  block.append(createTag('ul', { class: 'product-collection-grid' }, items.map(productCard)));
}
