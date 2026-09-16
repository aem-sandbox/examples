// @vitest-environment happy-dom
import {
  describe, it, beforeEach, afterEach, expect, vi,
} from 'vitest';
// The block lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import decorate from '../blocks/product-collection/product-collection.js';

const COLLECTION_URL = 'https://da-sc.adobeaem.workers.dev/live/aem-sandbox/examples/forms/sc/product-collections/summer-essentials';
const INDEX_PATH = '/products/product-detail/query-index.json';

const COLLECTION = {
  data: {
    'collection-name': 'Summer Essentials',
    description: 'Warm-weather must-haves.',
    products: ['SKU-OUT-001', 'SKU-ACC-003', 'SKU-MISSING'],
  },
};

const INDEX = {
  data: [
    {
      path: '/products/product-detail/sku-out-001', sku: 'SKU-OUT-001', title: 'Marina Cooler', price: '143.50', currency: 'USD', image: './media_a.jpg',
    },
    {
      path: '/products/product-detail/sku-acc-003', sku: 'SKU-ACC-003', title: 'Marina Sunglasses', price: '146.15', currency: 'USD', image: '',
    },
    {
      path: '/products/product-detail/sku-foo-001', sku: 'SKU-FOO-001', title: 'Granite Loafers', price: '155.12', currency: 'USD', image: './media_b.jpg',
    },
  ],
};

function render(url = COLLECTION_URL) {
  document.body.innerHTML = `<div class="product-collection"><div><div><a href="${url}">${url}</a></div></div></div>`;
  return document.querySelector('.product-collection');
}

describe('product-collection block', () => {
  let requested;

  beforeEach(() => {
    requested = [];
    vi.stubGlobal('fetch', async (url) => {
      const u = String(url);
      requested.push(u);
      if (u === COLLECTION_URL) return { ok: true, json: async () => COLLECTION };
      if (u.startsWith(INDEX_PATH)) return { ok: true, json: async () => INDEX };
      return { ok: false, status: 404 };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the collection endpoint and the product index', async () => {
    await decorate(render());
    expect(requested).toContain(COLLECTION_URL);
    expect(requested[1]).toMatch(/^\/products\/product-detail\/query-index\.json\?/);
  });

  it('renders the collection name and description', async () => {
    const block = render();
    await decorate(block);
    expect(block.querySelector('.product-collection-heading').textContent).toBe('Summer Essentials');
    expect(block.querySelector('.product-collection-description').textContent).toBe('Warm-weather must-haves.');
  });

  it('renders one card per SKU found in the index, in collection order, dropping unmatched SKUs', async () => {
    const block = render();
    await decorate(block);
    const titles = [...block.querySelectorAll('.product-collection-card-title')].map((el) => el.textContent);
    expect(titles).toEqual(['Marina Cooler', 'Marina Sunglasses']);
  });

  it('links each card to the product detail path and shows its price', async () => {
    const block = render();
    await decorate(block);
    const card = block.querySelector('.product-collection-card');
    expect(card.querySelector('.product-collection-card-link').getAttribute('href')).toBe('/products/product-detail/sku-out-001');
    expect(card.querySelector('.product-collection-card-price').textContent).toBe('143.50 USD');
  });

  it('resolves a relative index image against the row\'s own path, not the current page', async () => {
    const block = render();
    await decorate(block);
    const img = block.querySelector('.product-collection-card-image img');
    expect(img.getAttribute('src')).toContain('/products/product-detail/media_a.jpg');
  });

  it('omits the image wrapper when the index row has no image', async () => {
    const block = render();
    await decorate(block);
    const cards = [...block.querySelectorAll('.product-collection-card')];
    expect(cards[1].querySelector('.product-collection-card-image')).toBeNull();
  });

  it('renders nothing without a collection URL', async () => {
    const block = render('');
    await decorate(block);
    expect(block.children.length).toBe(0);
    expect(requested).toEqual([]);
  });
});
