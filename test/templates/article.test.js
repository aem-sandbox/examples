// @vitest-environment happy-dom
import {
  describe, it, beforeEach, afterEach, expect, vi,
} from 'vitest';

// The template lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import { loadBlock } from '../../scripts/aem.js';
// eslint-disable-next-line import/no-relative-packages
import init from '../../templates/article/article.js';

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

const row = (path, title, extra = {}) => ({
  path,
  title,
  description: `${title} Description`,
  image: `${path.slice(0, path.lastIndexOf('/'))}/media_1f6c.jpg?width=1200&format=pjpg`,
  template: 'article',
  author: `${title} Author`,
  date: '1771949580',
  lastModified: '1780677331',
  keywords: ['free, article'],
  robots: '',
  gated: '',
  ...extra,
});

const INDEX = [
  row('/learn', 'Learn', { template: '', keywords: ['others'] }),
  // The index claims template=article for this landing page while the page itself carries no
  // template metadata. Filtering on the folder rather than on `template` sidesteps the bad row.
  row('/learn/free', 'Free Content', { keywords: ['others'] }),
  row('/learn/free/article-1', 'Article 1 Title'),
  row('/learn/free/article-2', 'Article 2 Title'),
  row('/learn/free/article-3', 'Article 3 Title'),
  row('/learn/premium', 'Premium Content', { keywords: ['others'] }),
  row('/learn/premium/article-4', 'Article 4 Title', { keywords: ['premium, article'], gated: 'true' }),
  row('/learn/premium/article-5', 'Article 5 Title', { keywords: ['premium, article'], gated: 'true' }),
  row('/learn/premium/article-6', 'Article 6 Title', { keywords: ['premium, article'], gated: 'true' }),
  row('/products/coffee-maker', 'Coffee Maker', { keywords: ['products'] }),
];

function mountPage(pathname) {
  window.happyDOM.setURL(`https://examples.bbird.live${pathname}`);
  document.head.innerHTML = HEAD;
  document.body.className = 'article';
  document.body.innerHTML = BODY;
}

function stubIndex(rows) {
  vi.stubGlobal('fetch', async (url) => {
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
}

const lastSection = () => document.querySelector('main > .section:last-child');
const related = () => document.querySelector('main .cards.related-articles');
const relatedHrefs = () => [...document.querySelectorAll('main .cards.related-articles a[href]')]
  .map((a) => a.getAttribute('href'));

describe('article template related articles', () => {
  beforeEach(() => {
    loadBlock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends a cards block to the last section, inside its own wrapper div', async () => {
    mountPage('/learn/free/article-1');
    stubIndex(INDEX);

    await init(document);

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

  it('builds one row per card in the shape the cards block reads', async () => {
    mountPage('/learn/free/article-1');
    stubIndex(INDEX);

    await init(document);

    const rows = [...related().querySelectorAll(':scope > div')];
    expect(rows).toHaveLength(2);
    const [first] = rows;
    expect(first.children).toHaveLength(2);
    expect(first.children[0].querySelector('img')).not.toBeNull();
    const body = first.children[1];
    expect(body.querySelector('h3 > a').getAttribute('href')).toBe('/learn/free/article-2');
    expect(body.querySelector('.cards-card-tag').textContent).toBe('FREE');
    expect(body.querySelector('.cards-card-description').textContent).toBe('Article 2 Title Description');
    expect(body.querySelector('.cards-card-date').textContent).toBe('February 24, 2026');
  });

  it('excludes the current page from its own related list', async () => {
    mountPage('/learn/free/article-1');
    stubIndex(INDEX);

    await init(document);

    expect(relatedHrefs()).not.toContain('/learn/free/article-1');
  });

  it('lists only same-folder siblings, so a free article never links a premium one', async () => {
    mountPage('/learn/free/article-1');
    stubIndex(INDEX);

    await init(document);

    expect(relatedHrefs()).toEqual(['/learn/free/article-2', '/learn/free/article-3']);
    expect(relatedHrefs().some((href) => href.startsWith('/learn/premium'))).toBe(false);
    expect(relatedHrefs()).not.toContain('/learn/free');
  });

  it('lists only premium siblings on a premium article', async () => {
    mountPage('/learn/premium/article-4');
    stubIndex(INDEX);

    await init(document);

    expect(relatedHrefs()).toEqual(['/learn/premium/article-5', '/learn/premium/article-6']);
  });

  it('appends nothing when the folder holds no other pages', async () => {
    mountPage('/learn/free/article-1');
    stubIndex([
      row('/learn/free/article-1', 'Article 1 Title'),
      row('/products/coffee-maker', 'Coffee Maker'),
    ]);

    await init(document);

    expect(related()).toBeNull();
    expect(lastSection().childElementCount).toBe(1);
    expect(loadBlock).not.toHaveBeenCalled();
  });

  it('leaves the page unchanged when the query index fetch fails', async () => {
    mountPage('/learn/free/article-1');
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 503 }));

    await expect(Promise.resolve(init(document))).resolves.toBeUndefined();

    expect(related()).toBeNull();
    expect(lastSection().childElementCount).toBe(1);
    expect(document.querySelector('main .article-breadcrumb')).not.toBeNull();
  });

  it('does not append a second block when the template runs twice', async () => {
    mountPage('/learn/free/article-1');
    stubIndex(INDEX);

    await init(document);
    await init(document);

    expect(document.querySelectorAll('main .cards.related-articles')).toHaveLength(1);
  });
});
