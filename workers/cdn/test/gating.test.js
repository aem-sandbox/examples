import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
// eslint-disable-next-line import/no-relative-packages
import { createDemoSession } from '../../shared/demo-session.js';
// eslint-disable-next-line import/no-relative-packages
import { audienceCases, gatedPage, gateMarkers } from '../../../test/fixtures/gated-content.js';
import { applyGatingIfNeeded } from '../handlers/gating.js';

const PAGE = 'https://examples.bbird.live/gated-content';
const LAST_MODIFIED = 'Mon, 07 Sep 2026 16:39:51 GMT';
const body = '<div data-view="logged-in"><h2>VIP Perks</h2></div><div data-view="logged-out"><h2>New here?</h2></div>';

const originResponse = (html, headers = {}) => new Response(html, {
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'max-age=300',
    'Last-Modified': LAST_MODIFIED,
    ...headers,
  },
});

async function request(authenticated = false, headers = {}) {
  if (authenticated) {
    const token = await createDemoSession({ name: 'Ada Lovelace' });
    headers.Cookie = `bbird_demo_session=${token}`;
  }
  return new Request(PAGE, { headers });
}

describe('gated HTML audiences', () => {
  audienceCases.forEach((fixture) => {
    [false, true].forEach((authenticated) => {
      it(`${fixture.name}: ${authenticated ? 'member' : 'anonymous'}`, async () => {
        const response = await applyGatingIfNeeded(
          await request(authenticated),
          new URL(PAGE),
          originResponse(gatedPage(fixture.body)),
        );
        const $ = load(await response.text());
        expect($('main [id]').map((_, el) => $(el).attr('id')).get())
          .toEqual(authenticated ? fixture.member : fixture.anonymous);
      });
    });
  });

  it.each(gateMarkers)('recognizes marker %s', async (meta) => {
    const response = await applyGatingIfNeeded(
      await request(),
      new URL(PAGE),
      originResponse(gatedPage(body, meta)),
    );
    expect(await response.text()).not.toContain('VIP Perks');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('does not mistake a marker in a comment for page metadata', async () => {
    const html = gatedPage(body, '<!-- <meta name="gated" content="true"> -->');
    const source = originResponse(html);
    const response = await applyGatingIfNeeded(await request(), new URL(PAGE), source);
    expect(await response.text()).toBe(html);
    expect(response.headers.get('Cache-Control')).toBe('max-age=300');
  });
});

describe('gated response cache policy', () => {
  it('allows the managed CDN cache to store the anonymous representation only', async () => {
    const source = originResponse(gatedPage(body), {
      ETag: '"origin"',
      'Content-Length': '1234',
      'Accept-Ranges': 'bytes',
      'CDN-Cache-Control': 'max-age=172800',
      'Cloudflare-CDN-Cache-Control': 'public, max-age=172800',
      'Surrogate-Control': 'max-age=172800',
      Expires: 'Mon, 07 Sep 2030 16:39:51 GMT',
      Age: '100',
      Vary: 'Accept-Encoding',
      'Content-Security-Policy': "default-src 'self'",
    });
    const response = await applyGatingIfNeeded(await request(false), new URL(PAGE), source);
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Cloudflare-CDN-Cache-Control'))
      .toBe('public, max-age=60, must-revalidate');
    expect(response.headers.get('Vary')).toBe('Accept-Encoding, Accept, Cookie');
    expect(response.headers.get('Set-Cookie')).toBeNull();
    [
      'ETag', 'Last-Modified', 'Content-Length', 'Content-Range', 'Accept-Ranges',
      'CDN-Cache-Control', 'Surrogate-Control', 'Expires', 'Age',
    ].forEach((name) => expect(response.headers.get(name), name).toBeNull());
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
  });

  it('keeps the authenticated representation private and uncacheable', async () => {
    const source = originResponse(gatedPage(body), {
      ETag: '"origin"',
      'Cloudflare-CDN-Cache-Control': 'public, max-age=172800',
    });
    const response = await applyGatingIfNeeded(await request(true), new URL(PAGE), source);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    [
      'ETag', 'Last-Modified', 'Content-Length', 'Content-Range', 'Accept-Ranges',
      'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control', 'Surrogate-Control', 'Expires', 'Age',
    ].forEach((name) => expect(response.headers.get(name), name).toBeNull());
  });

  it.each([
    { name: 'Set-Cookie', responseHeaders: { 'Set-Cookie': 'personalized=1' }, requestHeaders: {} },
    { name: 'private origin response', responseHeaders: { 'Cache-Control': 'private, max-age=300' }, requestHeaders: {} },
    { name: 'authorized request', responseHeaders: {}, requestHeaders: { Authorization: 'Bearer client-value' } },
  ])('does not override unsafe cache signals: $name', async ({ responseHeaders, requestHeaders }) => {
    const response = await applyGatingIfNeeded(
      await request(false, requestHeaders),
      new URL(PAGE),
      originResponse(gatedPage(body), responseHeaders),
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBeNull();
  });

  it('does not issue a 304 for an old audience validator', async () => {
    const response = await applyGatingIfNeeded(
      await request(false, { 'If-None-Match': 'W/"1ni59yq-out"' }),
      new URL(PAGE),
      originResponse(gatedPage(body)),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBeNull();
    expect(await response.text()).toContain('New here?');
  });

  it('marks gated output no-store even when no content is removed', async () => {
    const response = await applyGatingIfNeeded(await request(true), new URL(PAGE), originResponse(gatedPage('<div>Public</div>')));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('preserves the original ungated response and its representation metadata', async () => {
    const html = gatedPage('<div>Public</div>', '');
    const source = originResponse(html, { ETag: '"public"', 'Content-Length': String(html.length) });
    const response = await applyGatingIfNeeded(await request(), new URL(PAGE), source);
    expect(response).toBe(source);
    expect(response.headers.get('Cache-Control')).toBe('max-age=300');
    expect(response.headers.get('Last-Modified')).toBe(LAST_MODIFIED);
    expect(response.headers.get('ETag')).toBe('"public"');
    expect(response.headers.get('Content-Length')).toBe(String(html.length));
    expect(await response.text()).toBe(html);
  });
});
