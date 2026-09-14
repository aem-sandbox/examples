// @vitest-environment happy-dom
import {
  describe, it, beforeEach, afterEach, expect, vi,
} from 'vitest';
// The block lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import decorate from '../blocks/promo-listing/promo-listing.js';

const INDEX_PATH = '/forms/sc/promotions/query-index.json';
const ORIGIN = 'https://da-sc.adobeaem.workers.dev/live/aem-sandbox/examples';

const INDEX = {
  data: [
    {
      path: '/forms/sc/promotions/summer-sale', name: 'Summer Sale', type: 'Banner', priority: '8', active: 'true',
    },
    {
      path: '/forms/sc/promotions/fall-refresh', name: 'Fall Refresh', type: 'Popup', priority: '6', active: 'true',
    },
    {
      path: '/forms/sc/promotions/winter-preview', name: 'Winter Preview', type: 'Inline Card', priority: '4', active: 'false',
    },
  ],
  total: 3,
};

const RECORDS = {
  '/forms/sc/promotions/summer-sale': {
    data: {
      name: 'Summer Sale',
      type: 'Banner',
      priority: 8,
      active: true,
      description: 'Shop seasonal savings.',
      ctas: [{ label: 'Shop the sale', url: '/promotions/summer-sale' }],
    },
  },
  '/forms/sc/promotions/fall-refresh': {
    data: {
      name: 'Fall Refresh',
      type: 'Popup',
      priority: 6,
      active: true,
      description: 'New arrivals for the season.',
      ctas: [{ label: 'Shop new arrivals', url: '/promotions/fall-refresh' }],
    },
  },
};

function render(rows = `<div><div>index</div><div>${INDEX_PATH}</div></div><div><div>origin</div><div>${ORIGIN}</div></div>`) {
  document.body.innerHTML = `<div class="promo-listing">${rows}</div>`;
  return document.querySelector('.promo-listing');
}

describe('promo-listing block', () => {
  let requested;

  beforeEach(() => {
    requested = [];
    vi.stubGlobal('fetch', async (url) => {
      const u = String(url);
      requested.push(u);
      if (u.startsWith(INDEX_PATH)) return { ok: true, json: async () => INDEX };
      const path = u.replace(ORIGIN, '');
      const record = RECORDS[path];
      return record
        ? { ok: true, json: async () => record }
        : { ok: false, status: 404 };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the index and fetches each active row individually from origin + path', async () => {
    const block = render();
    await decorate(block);
    expect(requested[0]).toMatch(/^\/forms\/sc\/promotions\/query-index\.json\?/);
    expect(requested).toContain(`${ORIGIN}/forms/sc/promotions/summer-sale`);
    expect(requested).toContain(`${ORIGIN}/forms/sc/promotions/fall-refresh`);
  });

  it('skips the row the index already flags inactive', async () => {
    const block = render();
    await decorate(block);
    expect(requested).not.toContain(`${ORIGIN}/forms/sc/promotions/winter-preview`);
  });

  it('renders one item per active row, ordered by priority descending', async () => {
    const block = render();
    await decorate(block);
    const names = [...block.querySelectorAll('.promo-listing-item-name')].map((el) => el.textContent);
    expect(names).toEqual(['Summer Sale', 'Fall Refresh']);
  });

  it('renders a CTA and the type modifier class per item', async () => {
    const block = render();
    await decorate(block);
    const item = block.querySelector('.promo-listing-item');
    expect(item.classList.contains('promo-listing-type-banner')).toBe(true);
    const cta = item.querySelector('.promo-listing-item-ctas a');
    expect([cta.textContent, cta.getAttribute('href'), cta.className]).toEqual([
      'Shop the sale', '/promotions/summer-sale', 'button primary',
    ]);
  });

  it('renders nothing without an index or origin config', async () => {
    const block = render('');
    await decorate(block);
    expect(block.children.length).toBe(0);
    expect(requested).toEqual([]);
  });
});
