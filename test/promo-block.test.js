// @vitest-environment happy-dom
import {
  describe, it, beforeEach, afterEach, expect, vi,
} from 'vitest';
// The block lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import decorate from '../blocks/promo/promo.js';

const URL = 'https://da-sc.adobeaem.workers.dev/live/aem-sandbox/examples/forms/sc/promotions/summer-sale';

// Trimmed from the live endpoint's response shape.
const PAYLOAD = {
  metadata: { schemaName: 'promotion', title: 'summer-sale' },
  data: {
    type: 'Banner',
    priority: 8,
    active: true,
    name: 'Summer Sale',
    audienceTags: ['returning-visitor', 'newsletter-subscriber'],
    ctas: [
      { label: 'Shop the sale', url: '/promotions/summer-sale' },
      { label: 'See full terms', url: '/terms/summer-sale' },
    ],
    description: 'Exclusive summer sale for returning customers and newsletter subscribers. '
      + 'Shop seasonal savings on select items.',
  },
};

function blockWithLink() {
  document.body.innerHTML = `<div class="promo"><div><div><a href="${URL}">${URL}</a></div></div></div>`;
  return document.querySelector('.promo');
}

describe('promo block', () => {
  let requested;

  beforeEach(() => {
    requested = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the URL authored as the block\'s only link', async () => {
    vi.stubGlobal('fetch', async (url) => {
      requested.push(String(url));
      return { ok: true, json: async () => PAYLOAD };
    });
    await decorate(blockWithLink());
    expect(requested).toEqual([URL]);
  });

  it('renders the name, a type modifier class, and a CTA per entry', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => PAYLOAD }));
    const block = blockWithLink();
    await decorate(block);

    expect(block.classList.contains('promo-type-banner')).toBe(true);
    expect(block.querySelector('.promo-name').textContent).toBe('Summer Sale');
    expect(block.querySelector('.promo-description').textContent).toBe(PAYLOAD.data.description);

    const ctas = [...block.querySelectorAll('.promo-ctas a')];
    expect(ctas.map((a) => [a.textContent, a.getAttribute('href'), a.className])).toEqual([
      ['Shop the sale', '/promotions/summer-sale', 'button primary'],
      ['See full terms', '/terms/summer-sale', 'button secondary'],
    ]);
  });

  it('omits the description paragraph when the field is absent', async () => {
    const { description, ...dataWithoutDescription } = PAYLOAD.data;
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ ...PAYLOAD, data: dataWithoutDescription }),
    }));
    const block = blockWithLink();
    await decorate(block);
    expect(block.querySelector('.promo-description')).toBeNull();
  });

  it('renders nothing when the promotion is inactive', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ ...PAYLOAD, data: { ...PAYLOAD.data, active: false } }),
    }));
    const block = blockWithLink();
    await decorate(block);
    expect(block.children.length).toBe(0);
  });

  it('renders nothing when the request fails', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }));
    const block = blockWithLink();
    await decorate(block);
    expect(block.children.length).toBe(0);
  });

  it('removes the block when the dismiss button is clicked', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => PAYLOAD }));
    const block = blockWithLink();
    await decorate(block);
    block.querySelector('.promo-dismiss').click();
    expect(document.body.contains(block)).toBe(false);
  });
});
