// @vitest-environment happy-dom
import {
  describe, it, beforeEach, afterEach, expect, vi,
} from 'vitest';
// The block lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import decorate from '../blocks/products/products.js';

const INDEX = {
  data: [
    {
      path: '/products/apex-road-racer', name: 'Apex Road Racer', category: 'Road', price: '3299',
    },
    {
      path: '/products/metro-city-cruiser', name: 'Metro City Cruiser', category: 'City', price: '899',
    },
    // The listing page's own index row, which the block drops.
    {
      path: '/products', name: '', category: '', price: '',
    },
    // A named row with no path. There is no `slug` column, so it has no href.
    {
      name: 'Ghost Bike', slug: 'ghost-bike', category: 'Road', price: '1',
    },
  ],
};

describe('products listing block', () => {
  let requested;

  beforeEach(() => {
    requested = [];
    vi.stubGlobal('fetch', async (url) => {
      requested.push(String(url));
      return { ok: true, json: async () => INDEX };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const render = async (rows = '') => {
    document.body.innerHTML = `<div class="products">${rows}</div>`;
    const block = document.querySelector('.products');
    await decorate(block);
    return block;
  };

  it('reads the product index', async () => {
    const block = await render();
    expect(requested[0]).toMatch(/^\/products-index\.json\?/);
    expect(block.querySelectorAll('.product-card')).toHaveLength(2);
  });

  it('drops a row without a path', async () => {
    // The index defines name, category, price and image. A row without `path`
    // cannot produce a card href, and `slug` is not a column.
    const block = await render();
    const hrefs = [...block.querySelectorAll('.product-card-link')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/products/apex-road-racer', '/products/metro-city-cruiser']);
  });

  it('ignores a source row in the block config', async () => {
    // There is one product index, so the path is not an authoring decision.
    await render('<div><div>source</div><div>/drafts/products-index.json</div></div>');
    expect(requested.every((url) => url.startsWith('/products-index.json'))).toBe(true);
  });
});
