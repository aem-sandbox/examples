// @vitest-environment happy-dom
import {
  describe, it, beforeEach, afterEach, expect, vi,
} from 'vitest';

// The template lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import { loadBlock } from '../../scripts/aem.js';
// eslint-disable-next-line import/no-relative-packages
import { QUERY_INDEX_PAGE_SIZE } from '../../scripts/shared.js';
// eslint-disable-next-line import/no-relative-packages
import decorateCards from '../../blocks/cards/cards.js';
// eslint-disable-next-line import/no-relative-packages
import init, { appendRelatedArticles } from '../../templates/article/article.js';

// `loadBlock` fetches /blocks/cards/cards.js and its CSS over the network. Everything else
// in aem.js is the real thing, so `decorateBlock` and `getMetadata` behave as they do on a page.
vi.mock('../../scripts/aem.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadBlock: vi.fn(async (block) => {
      block.dataset.blockStatus = 'loaded';
      return block;
    }),
  };
});

const HEAD = `
  <title>Article 1 Title</title>
  <meta name="template" content="article">
  <meta name="author" content="Article 1 Author">
  <meta name="date" content="February 24, 2026, 11:13 AM EST">`;

// A decorated article page: the autoblocked hero, the empty leftover section buildHeroBlock
// leaves behind, and the body section.
const BODY = `
  <main>
    <div class="section hero-container">
      <div class="hero-wrapper">
        <div class="hero block"><div><div><h1>Article 1 Headline</h1></div></div></div>
      </div>
    </div>
    <div class="section"></div>
    <div class="section">
      <div class="default-content-wrapper"><p>Lorem ipsum.</p></div>
    </div>
  </main>`;

// `date` is the authored publication date a card shows. `lastModified` moves on every
// republish. The fixtures make the two disagree, so a list ordered by the wrong one
// comes out in the wrong order.
const JAN_21 = '1769000000';
const FEB_24 = '1771949580';
const MAR_3 = '1772554380';
const MAR_10 = '1773159180';

const row = (path, title, extra = {}) => ({
  path,
  title,
  description: `${title} Description`,
  image: `${path.slice(0, path.lastIndexOf('/'))}/media_1f6c.jpg?width=1200&format=pjpg`,
  template: 'article',
  author: `${title} Author`,
  date: FEB_24,
  lastModified: '1780677331',
  keywords: ['free, article'],
  robots: '',
  gated: '',
  ...extra,
});

const premium = (path, title, extra = {}) => row(path, title, {
  keywords: ['premium, article'],
  gated: 'true',
  ...extra,
});

const INDEX = [
  row('/learn', 'Learn', { template: '', keywords: ['others'] }),
  // The index claims template=article for this landing page while the page itself carries no
  // template metadata. Filtering on the folder rather than on `template` sidesteps the bad row.
  row('/learn/free', 'Free Content', { keywords: ['others'] }),
  row('/learn/free/article-1', 'Article 1 Title'),
  row('/learn/free/article-2', 'Article 2 Title', { date: FEB_24, lastModified: '1780677400' }),
  row('/learn/free/article-3', 'Article 3 Title', { date: MAR_3, lastModified: '1780677331' }),
  row('/learn/free/article-8', 'Article 8 Title', { date: MAR_10, lastModified: '1780677300' }),
  // Oldest of the four siblings and the most recently republished of them, so it is the row
  // that separates "newest published" from "last touched".
  row('/learn/free/article-9', 'Article 9 Title', { date: JAN_21, lastModified: '1780677420' }),
  row('/learn/premium', 'Premium Content', { keywords: ['others'] }),
  premium('/learn/premium/article-4', 'Article 4 Title'),
  premium('/learn/premium/article-5', 'Article 5 Title', { date: FEB_24, lastModified: '1780677400' }),
  premium('/learn/premium/article-6', 'Article 6 Title', { date: MAR_3 }),
  row('/products/coffee-maker', 'Coffee Maker', { keywords: ['products'] }),
];

function mountPage(pathname) {
  window.happyDOM.setURL(`https://examples.bbird.live${pathname}`);
  document.head.innerHTML = HEAD;
  document.body.className = 'article';
  document.body.innerHTML = BODY;
}

// Returns the list of requested URLs, so a test can count round trips.
function stubIndex(rows) {
  const requests = [];
  vi.stubGlobal('fetch', async (url) => {
    requests.push(String(url));
    const params = new URLSearchParams(String(url).split('?')[1] || '');
    const offset = Number(params.get('offset') || 0);
    const limit = Number(params.get('limit') || rows.length);
    return {
      ok: true,
      json: async () => ({
        total: rows.length,
        offset,
        limit,
        data: rows.slice(offset, offset + limit),
      }),
    };
  });
  return requests;
}

const main = () => document.querySelector('main');
const lastSection = () => document.querySelector('main > .section:last-child');
const related = () => document.querySelector('main .cards.related-articles');
const relatedHrefs = () => [...document.querySelectorAll('main .cards.related-articles a[href]')]
  .map((a) => a.getAttribute('href'));
const relatedDates = () => [...document.querySelectorAll('main .cards.related-articles .cards-card-date')]
  .map((p) => p.textContent);

// The page runs the whole template; these tests target the related-articles half directly,
// because `init` deliberately does not wait for it.
async function render(pathname, rows = INDEX) {
  mountPage(pathname);
  const requests = stubIndex(rows);
  await appendRelatedArticles(main());
  return requests;
}

describe('article template related articles', () => {
  beforeEach(() => {
    loadBlock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends a cards block to the last section, inside its own wrapper div', async () => {
    await render('/learn/free/article-1');

    const block = related();
    expect(block).not.toBeNull();
    expect(block.closest('.section')).toBe(lastSection());
    // The wrapper matters: decorateBlock classes the block's parent, so a bare append
    // would turn the section itself into the cards-wrapper.
    expect(block.parentElement).not.toBe(lastSection());
    expect(block.parentElement.parentElement).toBe(lastSection());
    expect(block.parentElement.classList.contains('cards-wrapper')).toBe(true);
    expect(lastSection().classList.contains('cards-container')).toBe(true);
    expect(block.dataset.blockName).toBe('cards');
    expect(loadBlock).toHaveBeenCalledWith(block);
  });

  it('labels the block with a heading that sits above the cards', async () => {
    await render('/learn/free/article-1');

    const heading = lastSection().querySelector('h2.article-related-title');
    expect(heading).not.toBeNull();
    expect(heading.textContent).toBe('Related Articles');
    // The heading carries the border that separates the cards from the article body,
    // so it needs the default-content-wrapper an authored section break would give it.
    expect(heading.parentElement.classList.contains('default-content-wrapper')).toBe(true);
    const children = [...lastSection().children];
    expect(children.indexOf(heading.parentElement))
      .toBeLessThan(children.indexOf(related().parentElement));
  });

  it('builds one row per card in the shape the cards block reads', async () => {
    await render('/learn/free/article-1');

    const rows = [...related().querySelectorAll(':scope > div')];
    expect(rows).toHaveLength(3);
    const [first] = rows;
    expect(first.children).toHaveLength(2);
    expect(first.children[0].querySelector('img')).not.toBeNull();
    const body = first.children[1];
    expect(body.querySelector('h3 > a').getAttribute('href')).toBe('/learn/free/article-8');
    expect(body.querySelector('.cards-card-tag').textContent).toBe('FREE');
    expect(body.querySelector('.cards-card-description').textContent).toBe('Article 8 Title Description');
    expect(body.querySelector('.cards-card-date').textContent).toBe('March 10, 2026');
  });

  it('orders the cards by the date they display, newest first', async () => {
    await render('/learn/free/article-1');

    expect(relatedDates()).toEqual(['March 10, 2026', 'March 3, 2026', 'February 24, 2026']);
    expect(relatedHrefs()).toEqual([
      '/learn/free/article-8',
      '/learn/free/article-3',
      '/learn/free/article-2',
    ]);
  });

  it('keeps the newest siblings and drops the rest', async () => {
    await render('/learn/free/article-1');

    // article-9 is the most recently republished sibling but the oldest published one.
    expect(relatedHrefs()).toHaveLength(3);
    expect(relatedHrefs()).not.toContain('/learn/free/article-9');
  });

  it('excludes the current page from its own related list', async () => {
    await render('/learn/free/article-1');

    expect(relatedHrefs()).not.toContain('/learn/free/article-1');
  });

  it('lists only same-folder siblings, so a free article never links a premium one', async () => {
    await render('/learn/free/article-1');

    expect(relatedHrefs().some((href) => href.startsWith('/learn/premium'))).toBe(false);
    expect(relatedHrefs()).not.toContain('/learn/free');
  });

  it('lists only premium siblings on a premium article', async () => {
    await render('/learn/premium/article-4');

    expect(relatedHrefs()).toEqual(['/learn/premium/article-6', '/learn/premium/article-5']);
  });

  it('appends nothing when the folder holds no other pages', async () => {
    await render('/learn/free/article-1', [
      row('/learn/free/article-1', 'Article 1 Title'),
      row('/products/coffee-maker', 'Coffee Maker'),
    ]);

    expect(related()).toBeNull();
    expect(lastSection().childElementCount).toBe(1);
    expect(loadBlock).not.toHaveBeenCalled();
  });

  it('leaves the page unchanged when the query index fetch fails', async () => {
    mountPage('/learn/free/article-1');
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 503 }));

    await expect(appendRelatedArticles(main())).resolves.toBeUndefined();

    expect(related()).toBeNull();
    expect(lastSection().childElementCount).toBe(1);
  });

  it('appends one block when two runs overlap', async () => {
    mountPage('/learn/free/article-1');
    stubIndex(INDEX);

    await Promise.all([appendRelatedArticles(main()), appendRelatedArticles(main())]);

    expect(document.querySelectorAll('main .cards.related-articles')).toHaveLength(1);
  });

  it('appends one block when the template runs twice', async () => {
    await render('/learn/free/article-1');
    await appendRelatedArticles(main());

    expect(document.querySelectorAll('main .cards.related-articles')).toHaveLength(1);
  });

  it('stops at the end of the index instead of probing past the last row', async () => {
    const filler = Array.from(
      { length: QUERY_INDEX_PAGE_SIZE - INDEX.length },
      (unused, i) => row(`/archive/page-${i}`, `Archive ${i}`),
    );

    // The index is exactly one page long, and the response says so.
    const requests = await render('/learn/free/article-1', [...INDEX, ...filler]);

    expect(requests).toHaveLength(1);
    expect(relatedHrefs()).toHaveLength(3);
  });
});

describe('article template card images', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('leaves the image URL to the cards block rather than requesting it twice', async () => {
    await render('/learn/free/article-1');

    const img = related().querySelector('img');
    // A `src` here downloads the full-size index image, which the cards block then
    // replaces with an optimized one at a different URL. The first download is wasted.
    expect(img.hasAttribute('src')).toBe(false);
    expect(img.dataset.src).toBe('/learn/free/media_1f6c.jpg?width=1200&format=pjpg');
  });

  it('renders one optimized picture per card once the cards block decorates it', async () => {
    await render('/learn/free/article-1');
    const block = related();

    await decorateCards(block);

    const pictures = block.querySelectorAll('.cards-card-image picture');
    expect(pictures).toHaveLength(3);
    const urls = [...block.querySelectorAll('img[src], source[srcset]')]
      .map((el) => el.getAttribute('src') || el.getAttribute('srcset'));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((url) => url.includes('format=pjpg'))).toEqual([]);
    expect(urls.every((url) => url.includes('width=750'))).toBe(true);
    expect([...block.querySelectorAll('picture img')].every((img) => img.getAttribute('loading') === 'lazy')).toBe(true);
  });
});

describe('article template init', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns without waiting for the query index', () => {
    mountPage('/learn/free/article-1');
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    const returned = init(document);

    // scripts.js awaits the template's default export, so anything awaited in here holds
    // the rest of the lazy phase: the remaining sections, the footer, the fonts.
    expect(returned).toBeUndefined();
    expect(fetchMock).toHaveBeenCalled();
    expect(document.querySelector('main .article-breadcrumb')).not.toBeNull();
  });

  it('decorates the hero even when the query index fails', () => {
    mountPage('/learn/free/article-1');
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 503 }));

    expect(() => init(document)).not.toThrow();

    expect(document.querySelector('main .article-breadcrumb')).not.toBeNull();
    expect(document.querySelector('main .hero .article-author-container')).not.toBeNull();
  });
});
