// @vitest-environment happy-dom
// @vitest-environment-options { "url": "https://main--examples--aem-sandbox.aem.page/" }
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import { audienceCases, gatedPage, gateMarkers } from './fixtures/gated-content.js';
// eslint-disable-next-line import/no-relative-packages
import { applyContentProtection } from '../scripts/utils/gated-content.js';

vi.mock('../blocks/auth-toggle/auth-toggle.js', () => ({ createAuthToggle: vi.fn() }));
vi.mock('../scripts/shared/auth-api.js', () => ({
  resolveAuthState: vi.fn(async () => ({ authenticated: false })),
}));

function prepare(body, authenticated, meta) {
  window.happyDOM.setURL(`https://main--examples--aem-sandbox.aem.page/example?auth=${authenticated}`);
  document.documentElement.innerHTML = gatedPage(body, meta);
}

const ids = () => [...document.querySelectorAll('main [id]')].map((el) => el.id);

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('author audience preview', () => {
  audienceCases.forEach((fixture) => {
    [false, true].forEach((authenticated) => {
      it(`${fixture.name}: ${authenticated ? 'member' : 'anonymous'}`, async () => {
        prepare(fixture.body, authenticated);
        await applyContentProtection();
        expect(ids()).toEqual(authenticated ? fixture.member : fixture.anonymous);
      });
    });
  });

  it.each(gateMarkers)('recognizes marker %s', async (meta) => {
    prepare('<div data-view="logged-in" id="member"></div>', false, meta);
    await applyContentProtection();
    expect(ids()).toEqual([]);
  });

  it('does not apply an auth query override on the production hostname', async () => {
    prepare('<div data-view="logged-in" id="member"></div>', false);
    window.happyDOM.setURL('https://examples.bbird.live/example?auth=false');
    await applyContentProtection();
    expect(ids()).toEqual(['member']);
  });

  it('leaves pages without the gated marker alone', async () => {
    prepare('<div data-view="logged-in" id="member"></div>', false, '');
    await applyContentProtection();
    expect(ids()).toEqual(['member']);
  });
});
