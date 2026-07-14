import { readBlockConfig, createOptimizedPicture } from '../../scripts/aem.js';
import {
  createTag,
  fetchQueryIndexPage,
  formatDate,
  getContentTimestamp,
  isQueryableRow,
  normalizePath,
  parseKeywords,
  QUERY_INDEX_PAGE_SIZE,
} from '../../scripts/shared.js';

const DEFAULT_LIMIT = 4;
const LAYOUTS = ['carousel', 'bento', 'slider'];

function pathFromHref(href) {
  try {
    const u = new URL(href, window.location.origin);
    return u.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

/** Curated mode: block holds plain links instead of a config table. */
function getAuthoredLinks(block) {
  const rows = block.querySelectorAll(':scope > div');
  const hasConfigRows = [...rows].some((row) => row.children.length >= 2);
  if (hasConfigRows) return [];

  const anchors = block.querySelectorAll('a[href]');
  if (!anchors.length) return [];

  return [...anchors].map((a) => {
    const path = pathFromHref(a.href);
    const rawTitle = (a.textContent || '').trim();
    const looksLikeUrl = /^https?:\/\//i.test(rawTitle) || rawTitle.length > 80;
    return { path, title: looksLikeUrl ? '' : rawTitle };
  }).filter((item) => item.path && item.path !== '/');
}

function resolvePagesFromIndex(links, indexRows) {
  return links.map(({ path, title: linkTitle }) => {
    const norm = normalizePath(path);
    const row = indexRows.find((r) => r?.path && normalizePath(r.path) === norm);
    const fallbackTitle = norm.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || norm;

    return {
      path: norm,
      title: row?.title?.trim() || linkTitle || fallbackTitle,
      description: row?.description?.trim() || '',
      date: row?.date || row?.publisheddate || row?.lastModified,
      image: row?.image || '',
      keywords: row?.keywords || '',
    };
  });
}

function rowMatchesKeyword(row, keyword) {
  const rowKeywords = parseKeywords(row.keywords ?? '');
  return rowKeywords.some((rk) => rk === keyword || rk.includes(keyword));
}

function isPageMatch(row, keywordsConfig, excludedConfig) {
  if (!isQueryableRow(row)) return false;
  const requested = parseKeywords(keywordsConfig);
  const excluded = parseKeywords(excludedConfig);
  const isRandom = requested.includes('random');
  const matchesKeyword = requested.some((k) => rowMatchesKeyword(row, k));
  if (!isRandom && requested.length && !matchesKeyword) return false;
  if (excluded.some((k) => rowMatchesKeyword(row, k))) return false;
  return true;
}

function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sortAndLimitPages(rows, keywordsConfig, limit) {
  const requested = parseKeywords(keywordsConfig);
  const shouldShuffle = requested.includes('random')
    || requested.filter((k) => k !== 'random').length > 1;

  if (shouldShuffle) return shuffle(rows).slice(0, limit);

  return [...rows]
    .sort((a, b) => getContentTimestamp(b) - getContentTimestamp(a))
    .slice(0, limit);
}

/** Query mode: page through query-index.json until enough matches are found. */
async function fetchMatchingPages(keywords, excluded, limit) {
  const requested = parseKeywords(keywords);
  const needsFullIndex = requested.includes('random') || !requested.length;
  const rows = [];
  const pathSet = new Set();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await fetchQueryIndexPage(offset, QUERY_INDEX_PAGE_SIZE).catch(() => []);
    offset += batch.length;
    hasMore = batch.length === QUERY_INDEX_PAGE_SIZE;

    batch.forEach((row) => {
      if (!isPageMatch(row, keywords, excluded)) return;
      if (pathSet.has(row.path)) return;
      pathSet.add(row.path);
      rows.push(row);
    });

    if (!needsFullIndex && rows.length >= limit) break;
  }

  return sortAndLimitPages(rows, keywords, limit);
}

/** Curated mode: page through query-index.json until all authored links resolve. */
async function fetchIndexRowsForLinks(links) {
  const wanted = new Set(links.map(({ path }) => normalizePath(path)));
  const rows = [];
  const found = new Set();
  let offset = 0;
  let hasMore = true;

  while (hasMore && found.size < wanted.size) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await fetchQueryIndexPage(offset, QUERY_INDEX_PAGE_SIZE).catch(() => []);
    offset += batch.length;
    hasMore = batch.length === QUERY_INDEX_PAGE_SIZE;

    batch.forEach((row) => {
      if (!row?.path || !isQueryableRow(row)) return;
      const norm = normalizePath(row.path);
      if (!wanted.has(norm) || found.has(norm)) return;
      found.add(norm);
      rows.push(row);
    });
  }

  return rows;
}

function primaryTag(page) {
  return parseKeywords(page.keywords ?? '')[0] || '';
}

function buildGridCard(page) {
  const href = normalizePath(page.path);
  const li = createTag('li');

  if (page.image) {
    li.append(createTag('div', { class: 'dynamic-cards-card-image' }, createTag('img', { src: page.image, alt: '' })));
  }

  const body = createTag('div', { class: 'dynamic-cards-card-body' });
  const tag = primaryTag(page);
  if (tag) body.append(createTag('p', { class: 'dynamic-cards-card-tag' }, tag.toUpperCase()));
  body.append(createTag('h3', {}, createTag('a', { href }, page.title || href)));
  if (page.description) body.append(createTag('p', { class: 'dynamic-cards-card-description' }, page.description));
  const formattedDate = formatDate(page.date);
  if (formattedDate) body.append(createTag('p', { class: 'dynamic-cards-card-date' }, formattedDate));
  li.append(body);

  return li;
}

function buildBentoCard(page, index) {
  const href = normalizePath(page.path);
  const link = createTag('a', { href, class: 'dynamic-cards-card-link', 'aria-label': page.title || href });

  if (page.image) {
    link.append(createTag('div', { class: 'dynamic-cards-card-image' }, createTag('img', { src: page.image, alt: '' })));
  }

  const body = createTag('div', { class: 'dynamic-cards-card-body' });
  const tag = primaryTag(page);
  if (tag) body.append(createTag('p', { class: 'dynamic-cards-card-tag' }, tag.toUpperCase()));
  body.append(createTag('h3', {}, page.title || href));
  if (page.description) body.append(createTag('p', { class: 'dynamic-cards-card-description' }, page.description));
  const formattedDate = formatDate(page.date);
  if (formattedDate) body.append(createTag('p', { class: 'dynamic-cards-card-date' }, formattedDate));
  link.append(body);

  const classes = ['dynamic-cards-card'];
  if (index === 0) classes.push('dynamic-cards-card-featured');
  return createTag('li', { class: classes.join(' ') }, link);
}

function buildStripCard(page) {
  const href = normalizePath(page.path);
  const link = createTag('a', { href, class: 'dynamic-cards-strip-link' });
  link.append(createTag('div', { class: 'dynamic-cards-strip-accent' }));

  const content = createTag('div', { class: 'dynamic-cards-strip-content' });
  const tag = primaryTag(page);
  if (tag) content.append(createTag('span', { class: 'dynamic-cards-strip-tag' }, tag.toUpperCase()));
  content.append(createTag('h3', {}, page.title || href));
  if (page.description) content.append(createTag('p', { class: 'dynamic-cards-strip-description' }, page.description));
  const formattedDate = formatDate(page.date);
  if (formattedDate) content.append(createTag('p', { class: 'dynamic-cards-strip-date' }, formattedDate));
  link.append(content);

  return createTag('li', { class: 'dynamic-cards-strip-card' }, link);
}

function optimizeCardImages(ul) {
  ul.querySelectorAll('.dynamic-cards-card-image img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    (img.closest('picture') || img).replaceWith(optimized);
  });
}

/** Wraps a card list in a horizontally-scrollable strip with prev/next controls. */
function decorateScroller(ul, cardSelector) {
  const prevBtn = createTag('button', {
    type: 'button',
    class: 'dynamic-cards-arrow dynamic-cards-arrow-prev',
    'aria-label': 'Scroll left',
  }, '←');
  const nextBtn = createTag('button', {
    type: 'button',
    class: 'dynamic-cards-arrow dynamic-cards-arrow-next',
    'aria-label': 'Scroll right',
  }, '→');
  const controls = createTag('div', { class: 'dynamic-cards-controls', 'aria-label': 'Slider controls' }, [
    prevBtn,
    nextBtn,
  ]);

  const getScrollStep = () => {
    const card = ul.querySelector(cardSelector);
    if (!card) return 0;
    const { gap, columnGap } = getComputedStyle(ul);
    return card.getBoundingClientRect().width + parseFloat(columnGap || gap || '0');
  };

  const update = () => {
    const max = Math.max(0, ul.scrollWidth - ul.clientWidth - 1);
    const canScroll = ul.scrollWidth > ul.clientWidth + 1;
    controls.classList.toggle('is-hidden', !canScroll);
    prevBtn.disabled = ul.scrollLeft <= 0;
    nextBtn.disabled = ul.scrollLeft >= max;
  };

  prevBtn.addEventListener('click', () => ul.scrollBy({ left: -getScrollStep(), behavior: 'smooth' }));
  nextBtn.addEventListener('click', () => ul.scrollBy({ left: getScrollStep(), behavior: 'smooth' }));
  ul.addEventListener('scroll', update, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(update).observe(ul);
  } else {
    window.addEventListener('resize', update, { passive: true });
  }
  update();

  const wrapper = createTag('div', { class: 'dynamic-cards-scroller' }, ul);
  wrapper.append(controls);
  return wrapper;
}

function render(block, layout, pages) {
  block.textContent = '';

  if (!pages.length) {
    block.append(createTag('p', { class: 'dynamic-cards-empty' }, 'No content found.'));
    return;
  }

  const ul = createTag('ul');

  if (layout === 'slider') {
    pages.forEach((page) => ul.append(buildStripCard(page)));
    block.append(decorateScroller(ul, '.dynamic-cards-strip-card'));
    return;
  }

  if (layout === 'bento') {
    pages.forEach((page, index) => ul.append(buildBentoCard(page, index)));
    optimizeCardImages(ul);
    block.append(ul);
    return;
  }

  pages.forEach((page) => ul.append(buildGridCard(page)));
  optimizeCardImages(ul);
  block.append(layout === 'carousel' ? decorateScroller(ul, 'li') : ul);
}

// Variants: dynamic-cards (grid), dynamic-cards carousel, dynamic-cards bento, dynamic-cards slider
export default async function decorate(block) {
  const layout = LAYOUTS.find((cls) => block.classList.contains(cls)) || 'grid';
  const config = readBlockConfig(block);
  const limit = parseInt(config.limit, 10) || DEFAULT_LIMIT;
  const links = getAuthoredLinks(block);

  try {
    const pages = links.length
      ? resolvePagesFromIndex(links, await fetchIndexRowsForLinks(links)).slice(0, limit)
      : await fetchMatchingPages(config.keywords, config['excluded-keywords'], limit);
    render(block, layout, pages);
  } catch {
    block.textContent = '';
    block.append(createTag('p', { class: 'dynamic-cards-empty' }, 'Unable to load content right now.'));
  }
}
