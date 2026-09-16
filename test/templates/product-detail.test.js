// @vitest-environment happy-dom
import {
  describe, it, beforeEach, afterEach, expect, vi,
} from 'vitest';

// The template lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import { loadBlock } from '../../scripts/aem.js';
// eslint-disable-next-line import/no-relative-packages
import init, { buildBreadcrumb, appendRelatedProducts } from '../../templates/product-detail/product-detail.js';

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
  <title>Granite Loafers</title>
  <meta name="template" content="product-detail">
  <meta name="sku" content="SKU-FOO-001">
  <meta name="category" content="Footwear">`;

// Matches what decorateBlocks actually produces: the block sits inside its own
// `{blockname}-wrapper` div, not as a direct section child.
const BODY = `
  <main>
    <div class="section product-detail-container">
      <div class="product-detail-wrapper">
        <div class="product-detail"><div><div><h1>Granite Loafers</h1></div><div>Footwear</div></div></div>
      </div>
    </div>
  </main>`;

const row = (path, title, category, sku, extra = {}) => ({
  path,
  title,
  category,
  sku,
  price: '31.32',
  currency: 'USD',
  image: `${path.slice(0, path.lastIndexOf('/'))}/media_1f6c.jpg?width=750`,
  ...extra,
});

const INDEX = [
  row('/products/product-detail/sku-foo-001', 'Granite Loafers', 'Footwear', 'SKU-FOO-001'),
  row('/products/product-detail/sku-foo-002', 'Solstice Rain Boots', 'Footwear', 'SKU-FOO-002'),
  row('/products/product-detail/sku-foo-003', 'Nimbus Hiking Boots', 'Footwear', 'SKU-FOO-003'),
  row('/products/product-detail/sku-foo-004', 'Fable Sneakers', 'Footwear', 'SKU-FOO-004'),
  row('/products/product-detail/sku-foo-005', 'Voyager Slippers', 'Footwear', 'SKU-FOO-005'),
  row('/products/product-detail/sku-foo-006', 'Vortex Rain Boots', 'Footwear', 'SKU-FOO-006'),
  row('/products/product-detail/sku-out-001', 'Marina Cooler', 'Outdoor', 'SKU-OUT-001'),
];

function mountPage(extraHead = '') {
  window.happyDOM.setURL('https://examples.bbird.live/products/product-detail/sku-foo-001');
  document.head.innerHTML = HEAD + extraHead;
  document.body.className = 'product-detail';
  document.body.innerHTML = BODY;
}

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
const related = () => document.querySelector('main .cards.product-detail-related');

describe('product-detail template breadcrumb', () => {
  it('builds Home > Products > category > current page from page metadata', () => {
    mountPage();
    const nav = buildBreadcrumb();
    const items = [...nav.querySelectorAll('li')];
    expect(items.map((li) => li.textContent)).toEqual(['Home', 'Products', 'Footwear', 'Granite Loafers']);
    expect(items[0].querySelector('a').getAttribute('href')).toBe('/');
    // "Products" and the category aren't links: this catalog has no browsable listing page.
    expect(items[1].querySelector('a')).toBeNull();
    expect(items[2].querySelector('a')).toBeNull();
    expect(items[3].getAttribute('aria-current')).toBe('page');
  });

  it('omits the category crumb when the page has none', () => {
    window.happyDOM.setURL('https://examples.bbird.live/products/product-detail/sku-foo-001');
    document.head.innerHTML = '<title>Granite Loafers</title>';
    const nav = buildBreadcrumb();
    const items = [...nav.querySelectorAll('li')];
    expect(items.map((li) => li.textContent)).toEqual(['Home', 'Products', 'Granite Loafers']);
  });

  it('prepends the breadcrumb into the block\'s own wrapper div, not the bare section', async () => {
    // Nesting inside the wrapper (rather than as a section sibling) is what makes the
    // breadcrumb inherit the same two-layer centering as the block, without duplicating it.
    mountPage();
    stubIndex([]);
    init(document);
    const nav = main().querySelector('.product-detail-wrapper > .product-detail-breadcrumb');
    expect(nav).not.toBeNull();
    expect(nav.parentElement.classList.contains('product-detail-wrapper')).toBe(true);
    expect(nav.parentElement.firstElementChild).toBe(nav);
  });
});

describe('product-detail template related products', () => {
  beforeEach(() => {
    loadBlock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends a cards block with up to 4 same-category rows, excluding the current SKU', async () => {
    mountPage();
    stubIndex(INDEX);
    await appendRelatedProducts(main());

    const block = related();
    expect(block).not.toBeNull();
    expect(loadBlock).toHaveBeenCalledWith(block);

    const hrefs = [...block.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    expect(hrefs).toHaveLength(4);
    expect(hrefs).not.toContain('/products/product-detail/sku-foo-001');
    expect(hrefs).not.toContain('/products/product-detail/sku-out-001');
  });

  it('builds one row per card in the shape the cards block reads, with a resolved image and price', async () => {
    mountPage();
    stubIndex(INDEX);
    await appendRelatedProducts(main());

    const rows = [...related().querySelectorAll(':scope > div')];
    const [first] = rows;
    expect(first.children).toHaveLength(2);
    const img = first.children[0].querySelector('img');
    // The index's `image` is relative to the row's own path, not the current page.
    expect(img.getAttribute('data-src')).toBe('https://examples.bbird.live/products/product-detail/media_1f6c.jpg?width=750');
    const body = first.children[1];
    expect(body.querySelector('h3 > a').textContent).toBe('Solstice Rain Boots');
    expect(body.querySelector('.cards-card-description').textContent).toBe('31.32 USD');
  });

  it('does nothing when the page has no category', async () => {
    window.happyDOM.setURL('https://examples.bbird.live/products/product-detail/sku-foo-001');
    document.head.innerHTML = '<title>Granite Loafers</title>';
    document.body.innerHTML = BODY;
    const requests = stubIndex(INDEX);
    await appendRelatedProducts(main());
    expect(related()).toBeNull();
    expect(requests).toEqual([]);
  });

  it('does nothing when the index request fails', async () => {
    mountPage();
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 500 }));
    await appendRelatedProducts(main());
    expect(related()).toBeNull();
  });

  it('does nothing when no other row shares the category', async () => {
    mountPage();
    stubIndex([INDEX[0]]);
    await appendRelatedProducts(main());
    expect(related()).toBeNull();
  });
});
