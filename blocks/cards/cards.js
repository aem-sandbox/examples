import { buildBlock, createOptimizedPicture, readBlockConfig } from '../../scripts/aem.js';
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

const DEFAULT_LIMIT = 5;

function pathFromHref(href) {
  try {
    const u = new URL(href, window.location.origin);
    return u.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

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
    const title = looksLikeUrl ? '' : rawTitle;
    return { path, title };
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
  if (!isRandom && requested.length && !requested.some((k) => rowMatchesKeyword(row, k))) return false;
  if (excluded.some((k) => rowMatchesKeyword(row, k))) return false;
  return true;
}

function sortAndLimitPages(rows, keywordsConfig, limit) {
  const requested = parseKeywords(keywordsConfig);
  const shouldShuffle = requested.includes('random') || requested.filter((k) => k !== 'random').length > 1;
  let results = [...rows];

  if (shouldShuffle) {
    for (let i = results.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
    return results.slice(0, limit);
  }

  return results
    .sort((a, b) => getContentTimestamp(b) - getContentTimestamp(a))
    .slice(0, limit);
}

/** Paginate query-index until enough matches (search block pattern). */
async function fetchMatchingPages(keywords, excluded, limit) {
  const requested = parseKeywords(keywords);
  const needsFullIndex = requested.includes('random') || !requested.length;
  const rows = [];
  const pathSet = new Set();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
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

/** Paginate query-index until authored link paths are resolved. */
async function fetchIndexRowsForLinks(links) {
  const wanted = new Set(links.map(({ path }) => normalizePath(path)));
  const rows = [];
  const found = new Set();
  let offset = 0;
  let hasMore = true;

  while (hasMore && found.size < wanted.size) {
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

function buildCardRow(page) {
  const href = normalizePath(page.path);
  const cols = [];

  if (page.image) {
    cols.push(createTag('div', {}, createTag('img', { src: page.image, alt: page.title || '' })));
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
  const date = page.date || page.publisheddate || page.lastModified;
  const formattedDate = formatDate(date);
  if (formattedDate) {
    body.append(createTag('p', { class: 'cards-card-date' }, formattedDate));
  }
  cols.push(body);

  return cols;
}

function optimizeCardImages(ul, featuredSelector = null) {
  ul.querySelectorAll('.cards-card-image img').forEach((img) => {
    const isFeatured = featuredSelector && img.closest(featuredSelector);
    const width = isFeatured ? '1200' : '750';
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width }]);
    (img.closest('picture') || img).replaceWith(optimized);
  });
}

function decorateBento(ul) {
  [...ul.children].forEach((li, index) => {
    if (index === 0) li.classList.add('cards-bento-featured');

    const body = li.querySelector('.cards-card-body');
    if (body && !body.querySelector('h2, h3, h4, strong')) {
      const buttonLink = body.querySelector('p.button-wrapper a[href], a.button[href]');
      if (buttonLink) {
        const href = buttonLink.getAttribute('href');
        const label = buttonLink.textContent.trim();
        if (label) {
          body.prepend(createTag('h3', {}, createTag('a', { href }, label)));
          buttonLink.closest('p')?.remove();
        }
      } else {
        const contentChildren = [...body.children].filter((el) => !el.classList.contains('cards-card-date'));
        const tag = body.querySelector('.cards-card-tag');
        if (tag && contentChildren.length === 1) {
          const title = tag.textContent.trim();
          if (title) tag.replaceWith(createTag('h3', {}, title));
        } else {
          const soleParagraph = contentChildren.find(
            (el) => el.tagName === 'P'
              && !el.classList.contains('cards-card-description')
              && !el.classList.contains('button-wrapper'),
          );
          if (soleParagraph && contentChildren.length === 1) {
            const title = soleParagraph.textContent.trim();
            if (title) soleParagraph.replaceWith(createTag('h3', {}, title));
          }
        }
      }
    }

    const link = body?.querySelector('a[href]');
    if (!link) return;

    li.classList.add('cards-bento-linked');
    li.setAttribute('tabindex', '0');
    li.setAttribute('role', 'link');
    li.setAttribute('aria-label', link.textContent.trim());
    const follow = () => {
      window.location.href = link.href;
    };
    li.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      follow();
    });
    li.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        follow();
      }
    });
  });
}

function decorateCarousel(ul) {
  const prevBtn = createTag('button', {
    type: 'button',
    class: 'cards-carousel-arrow cards-carousel-arrow-prev',
    'aria-label': 'Scroll cards left',
  }, '\u2190');
  const nextBtn = createTag('button', {
    type: 'button',
    class: 'cards-carousel-arrow cards-carousel-arrow-next',
    'aria-label': 'Scroll cards right',
  }, '\u2192');
  const controls = createTag('div', { class: 'cards-carousel-controls', 'aria-label': 'Carousel controls' }, [
    prevBtn,
    nextBtn,
  ]);

  const getScrollStep = () => {
    const card = ul.querySelector('li');
    if (!card) return 0;
    const { gap, columnGap } = getComputedStyle(ul);
    return card.getBoundingClientRect().width + parseFloat(columnGap || gap || '0');
  };

  const update = () => {
    const max = Math.max(0, ul.scrollWidth - ul.clientWidth - 1);
    const canScroll = ul.scrollWidth > ul.clientWidth + 1;
    controls.classList.toggle('is-hidden', !canScroll);
    prevBtn.disabled = ul.scrollLeft <= 0;
    prevBtn.classList.toggle('is-hidden', ul.scrollLeft <= 0);
    nextBtn.disabled = ul.scrollLeft >= max;
  };

  prevBtn.addEventListener('click', () => {
    ul.scrollBy({ left: -getScrollStep(), behavior: 'smooth' });
  });
  nextBtn.addEventListener('click', () => {
    ul.scrollBy({ left: getScrollStep(), behavior: 'smooth' });
  });
  ul.addEventListener('scroll', update, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(update).observe(ul);
  } else {
    window.addEventListener('resize', update, { passive: true });
  }
  update();

  const wrapper = createTag('div', { class: 'cards-carousel' }, ul);
  wrapper.append(controls);
  return wrapper;
}

function decorateCards(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.querySelector('picture, img')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });

  if (block.classList.contains('bento')) {
    decorateBento(ul);
  }

  optimizeCardImages(ul, block.classList.contains('bento') ? '.cards-bento-featured' : null);

  if (block.classList.contains('carousel')) {
    block.replaceChildren(decorateCarousel(ul));
  } else {
    block.replaceChildren(ul);
  }
}

// Variants: cards (grid), cards carousel, cards bento, cards dynamic, cards dynamic links
export default async function decorate(block) {
  if (block.classList.contains('dynamic')) {
    try {
      const config = readBlockConfig(block);
      const limit = parseInt(config.limit, 10) || DEFAULT_LIMIT;
      const links = getAuthoredLinks(block);
      const pages = links.length
        ? resolvePagesFromIndex(links, await fetchIndexRowsForLinks(links)).slice(0, limit)
        : await fetchMatchingPages(config.keywords, config['excluded-keywords'], limit);

      block.textContent = '';
      if (!pages.length) {
        block.append(createTag('p', { class: 'cards-empty' }, 'No articles found.'));
        return;
      }
      const built = buildBlock('cards', pages.map(buildCardRow));
      block.replaceChildren(...built.children);
    } catch {
      block.textContent = '';
      block.append(createTag('p', { class: 'cards-empty' }, 'Unable to load articles right now.'));
      return;
    }
  }

  decorateCards(block);
}
