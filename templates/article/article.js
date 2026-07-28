import { decorateBlock, getMetadata, loadBlock } from '../../scripts/aem.js';
import {
  createTag,
  fetchQueryIndexPage,
  formatDate,
  getPublishedTimestamp,
  isQueryableRow,
  normalizePath,
  parseKeywords,
  QUERY_INDEX_PAGE_SIZE,
} from '../../scripts/shared.js';

const RELATED_LIMIT = 3;

function buildBreadcrumb(root = document) {
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (!segments.length) return null;

  const nav = createTag('nav', { class: 'article-breadcrumb', 'aria-label': 'Breadcrumb' });
  const list = createTag('ol');
  const title = root.querySelector('main .hero h1')?.textContent?.trim() || root.title;

  list.append(createTag('li', {}, createTag('a', { href: '/' }, 'Home')));

  let path = '';
  segments.slice(0, -1).forEach((segment) => {
    path += `/${segment}`;
    const label = segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    list.append(createTag('li', {}, createTag('a', { href: path }, label)));
  });

  list.append(createTag('li', { 'aria-current': 'page' }, title));
  nav.append(list);
  return nav;
}

function buildAuthorDate() {
  const author = getMetadata('author');
  const date = getMetadata('date');
  if (!author && !date) return null;

  const container = createTag('div', { class: 'article-author-container' });

  if (author) {
    container.append(createTag('span', { class: 'article-author' }, `By ${author}`));
  }

  if (date) {
    const parsed = new Date(String(date).trim());
    const datetime = !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
    const time = createTag('time', datetime ? { datetime } : {}, formatDate(date));
    container.append(createTag('span', { class: 'article-date' }, time));
  }

  return container;
}

function currentPath() {
  return normalizePath(window.location.pathname).replace(/\/+$/, '') || '/';
}

// /learn/free/article-1 -> /learn/free/
function folderOf(path) {
  return path.slice(0, path.lastIndexOf('/') + 1) || '/';
}

// The folder is the join, so a /learn/free article never lists a /learn/premium one.
// That is editorial, not a protection: query-index.json is public and carries every
// published row, premium included.
function isSibling(row, folder, path) {
  if (!isQueryableRow(row)) return false;
  const rowPath = normalizePath(row.path);
  if (rowPath === path || !rowPath.startsWith(folder)) return false;
  return !rowPath.slice(folder.length).includes('/');
}

async function fetchSiblings(path, limit) {
  const folder = folderOf(path);
  const siblings = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await fetchQueryIndexPage(offset, QUERY_INDEX_PAGE_SIZE);
    offset += batch.length;
    hasMore = batch.length === QUERY_INDEX_PAGE_SIZE;
    batch.forEach((row) => {
      if (isSibling(row, folder, path)) siblings.push(row);
    });
  }

  // Newest first by the date the card shows, so republishing an old article does not
  // move it to the top of every sibling's list under its original date.
  return siblings
    .sort((a, b) => getPublishedTimestamp(b) - getPublishedTimestamp(a))
    .slice(0, limit);
}

// The pipeline fills `image` with /default-meta-image.png for pages that have none.
function hasRealImage(image) {
  if (!image) return false;
  return !/(^|\/)default-meta-image\.png$/.test(String(image).split('?')[0]);
}

// One cards row in the shape the block reads from authored markup: an optional image
// column, then a body column.
function buildCardRow(page) {
  const href = normalizePath(page.path);
  const row = createTag('div');

  if (hasRealImage(page.image)) {
    // `data-src`, not `src`: the cards block swaps this img for an optimized picture at a
    // different URL, and a `src` here downloads the indexed full-size image for nothing.
    row.append(createTag('div', {}, createTag('img', { 'data-src': page.image, alt: page.title || '' })));
  }

  const body = createTag('div');
  const tag = parseKeywords(page.keywords ?? '')[0] || page.template;
  if (tag) {
    body.append(createTag('p', { class: 'cards-card-tag' }, String(tag).toUpperCase()));
  }
  body.append(createTag('h3', {}, createTag('a', { href }, page.title || href)));
  if (page.description) {
    body.append(createTag('p', { class: 'cards-card-description' }, page.description));
  }
  const date = formatDate(getPublishedTimestamp(page));
  if (date) body.append(createTag('p', { class: 'cards-card-date' }, date));
  row.append(body);

  return row;
}

const decorated = new WeakSet();

// Goes into the last section, not a new one. Exported so `init` can start it without
// awaiting it, and so the tests can await it.
export async function appendRelatedArticles(main) {
  if (decorated.has(main) || main.querySelector('.cards.related-articles')) return;

  const section = main.querySelector(':scope > .section:last-child');
  if (!section) return;

  // Claimed before the first await, so two overlapping runs append one block.
  decorated.add(main);

  let siblings = [];
  try {
    siblings = await fetchSiblings(currentPath(), RELATED_LIMIT);
  } catch {
    return;
  }
  if (!siblings.length) return;

  const heading = createTag('h2', { class: 'article-related-title' }, 'Related Articles');
  section.append(createTag('div', { class: 'default-content-wrapper' }, heading));

  const block = createTag('div', { class: 'cards related-articles' }, siblings.map(buildCardRow));
  // decorateBlock classes the block's parent, so the block gets its own wrapper div
  // rather than turning the section itself into the cards-wrapper.
  section.append(createTag('div', {}, block));
  decorateBlock(block);
  await loadBlock(block);
}

export default function init(root = document) {
  const main = root.querySelector('main');
  if (!main) return;

  const hero = main.querySelector('.hero');
  const heroText = main.querySelector('.hero > div:last-child > div');

  if (hero && !main.querySelector('.article-breadcrumb')) {
    const breadcrumb = buildBreadcrumb(root);
    if (breadcrumb) hero.insertAdjacentElement('afterend', breadcrumb);
  }

  if (heroText && !heroText.querySelector('.article-author-container')) {
    const authorDate = buildAuthorDate();
    if (authorDate) heroText.append(authorDate);
  }

  // Started, not awaited. scripts.js awaits this function, and the sections after the
  // hero stay hidden until it returns, so a query-index round trip in here would hold
  // the article body, the footer and the fonts. The block fills itself in when the
  // index resolves; a failure leaves the page as it is.
  appendRelatedArticles(main).catch(() => {});
}
