import { readBlockConfig } from '../../scripts/aem.js';
import {
  createTag, fetchStructuredContent, fetchQueryIndexPage, QUERY_INDEX_PAGE_SIZE,
} from '../../scripts/shared.js';

/** Strips the trailing `query-index.json` (and any query string) to get the index's base URL. */
function indexBaseUrl(indexPath) {
  return String(indexPath).replace(/\/query-index\.json.*$/, '');
}

async function fetchAllIndexRows(indexPath) {
  const baseUrl = indexBaseUrl(indexPath);
  const rows = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await fetchQueryIndexPage(offset, QUERY_INDEX_PAGE_SIZE, baseUrl);
    rows.push(...batch);
    hasMore = batch.length === QUERY_INDEX_PAGE_SIZE;
    offset += QUERY_INDEX_PAGE_SIZE;
  }
  return rows;
}

function ctaLink(cta, isPrimary) {
  return createTag('a', {
    class: `button ${isPrimary ? 'primary' : 'secondary'}`,
    href: cta.url,
  }, cta.label);
}

function promoListingItem(data) {
  const typeSlug = (data.type || 'banner').toLowerCase().replace(/\s+/g, '-');
  const item = createTag('li', {
    class: `promo-listing-item promo-listing-type-${typeSlug}`,
  }, [
    createTag('p', { class: 'promo-listing-item-name' }, data.name || ''),
    data.description ? createTag('p', { class: 'promo-listing-item-description' }, data.description) : '',
  ]);

  if (Array.isArray(data.ctas) && data.ctas.length) {
    item.append(createTag(
      'div',
      { class: 'promo-listing-item-ctas' },
      data.ctas.map((cta, i) => ctaLink(cta, i === 0)),
    ));
  }

  return item;
}

/**
 * Decorates a `promo-listing` block whose only authored content is KV config rows, e.g.:
 * `index: /forms/sc/promotions/query-index.json`
 * `origin: https://da-sc.adobeaem.workers.dev/live/aem-sandbox/examples`
 *
 * `index` points at a query-index.json of published `promotion` records. That index exposes
 * enough to filter (`active`) and order (`priority`) the list, but not `ctas`, so each active
 * row is fetched individually from `origin` + the row's `path` to get the full record.
 * @param {Element} block the `.promo-listing` block
 */
export default async function decorate(block) {
  const { index, origin } = readBlockConfig(block);
  block.textContent = '';
  if (!index || !origin) return;

  let rows;
  try {
    rows = await fetchAllIndexRows(index);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Promo listing: failed to load index', index, e);
    return;
  }

  const activeRows = rows
    .filter((row) => String(row.active).toLowerCase() !== 'false')
    .sort((a, b) => Number(b.priority) - Number(a.priority));

  const base = String(origin).replace(/\/+$/, '');
  const payloads = await Promise.all(
    activeRows.map((row) => fetchStructuredContent(`${base}${row.path}`)),
  );

  const list = createTag('ul', { class: 'promo-listing-items' });
  payloads.forEach((payload) => {
    const { data } = payload || {};
    if (data && data.active !== false) list.append(promoListingItem(data));
  });

  if (list.children.length) block.append(list);
}
