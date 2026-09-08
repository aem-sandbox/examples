import { describe, it, expect } from 'vitest';
// eslint-disable-next-line import/no-relative-packages
import { createDemoSession } from '../../shared/demo-session.js';
import { applyGatingIfNeeded, needsFullOriginResponse } from '../handlers/gating.js';

const PAGE = 'https://examples.bbird.live/gated-content';
const LAST_MODIFIED = 'Mon, 07 Sep 2026 16:39:51 GMT';

const gatedHtml = ({ loggedInSection = true, loggedOutSection = true } = {}) => `<!DOCTYPE html>
<html><head><meta name="gated" content="true"></head><body><main>
  ${loggedInSection ? '<div data-view="logged-in"><h2>VIP Perks</h2></div>' : ''}
  ${loggedOutSection ? '<div data-view="logged-out"><h2>New here?</h2></div>' : ''}
  <div><p>Everyone sees this.</p></div>
</main></body></html>`;

const originResponse = (body, headers = {}) => new Response(body, {
  status: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'max-age=300',
    'Last-Modified': LAST_MODIFIED,
    ...headers,
  },
});

async function sessionCookie() {
  const token = await createDemoSession({ name: 'Ada Lovelace' });
  return `bbird_demo_session=${token}`;
}

const request = (headers = {}) => new Request(PAGE, { headers });
const gate = (req, body = gatedHtml()) => (
  applyGatingIfNeeded(req, new URL(PAGE), originResponse(body))
);

describe('gated response variants', () => {
  it('serves the anonymous variant with a variant-tagged validator', async () => {
    const response = await gate(request());
    const html = await response.text();

    expect(html).not.toContain('VIP Perks');
    expect(html).toContain('New here?');
    expect(response.headers.get('ETag')).toMatch(/-out"$/);
    expect(response.headers.get('Last-Modified')).toBeNull();
    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(response.headers.get('Vary')).toMatch(/Cookie/i);
  });

  it('serves the authenticated variant under a different validator', async () => {
    const anonymous = await gate(request());
    const authenticated = await gate(request({ Cookie: await sessionCookie() }));
    const html = await authenticated.text();

    expect(html).toContain('VIP Perks');
    expect(html).not.toContain('New here?');
    expect(authenticated.headers.get('ETag')).toMatch(/-in"$/);
    expect(authenticated.headers.get('ETag')).not.toBe(anonymous.headers.get('ETag'));
  });

  it('answers a matching validator with 304 so caching still works', async () => {
    const first = await gate(request());
    const etag = first.headers.get('ETag');

    const revalidated = await gate(request({ 'If-None-Match': etag }));
    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get('ETag')).toBe(etag);
  });

  it('never revalidates one audience into the other audience body', async () => {
    const anonymous = await gate(request());
    const anonymousEtag = anonymous.headers.get('ETag');

    const afterLogin = await gate(request({
      'If-None-Match': anonymousEtag,
      Cookie: await sessionCookie(),
    }));

    expect(afterLogin.status).toBe(200);
    expect(await afterLogin.text()).toContain('VIP Perks');
  });

  it('marks a gated page private even when this audience drops nothing', async () => {
    const response = await gate(
      request({ Cookie: await sessionCookie() }),
      gatedHtml({ loggedOutSection: false }),
    );

    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(response.headers.get('Vary')).toMatch(/Cookie/i);
    expect(response.headers.get('ETag')).toMatch(/-in"$/);
  });

  it('leaves an ungated page and its shared validators untouched', async () => {
    const html = '<!DOCTYPE html><html><body><main><div><p>Public</p></div></main></body></html>';
    const response = await gate(request(), html);

    expect(response.headers.get('Cache-Control')).toBe('max-age=300');
    expect(response.headers.get('Last-Modified')).toBe(LAST_MODIFIED);
    expect(response.headers.get('ETag')).toBeNull();
    expect(await response.text()).toContain('Public');
  });

  it('passes a 304 from the origin straight through', async () => {
    const notModified = new Response(null, { status: 304 });
    const response = await applyGatingIfNeeded(request(), new URL(PAGE), notModified);
    expect(response.status).toBe(304);
  });
});

describe('needsFullOriginResponse', () => {
  it('recognises a variant validator, which the origin cannot evaluate', () => {
    expect(needsFullOriginResponse(request({ 'If-None-Match': 'W/"1a2b3c-in"' }))).toBe(true);
    expect(needsFullOriginResponse(request({ 'If-None-Match': 'W/"1a2b3c-out"' }))).toBe(true);
  });

  it('bypasses the origin for a signed-in visitor holding a pre-variant cache entry', async () => {
    const headers = { 'If-Modified-Since': LAST_MODIFIED, Cookie: await sessionCookie() };
    expect(needsFullOriginResponse(request(headers))).toBe(true);
  });

  it('ignores ordinary origin validators so public pages keep their 304s', () => {
    expect(needsFullOriginResponse(request({ 'If-None-Match': 'W/"origin-etag"' }))).toBe(false);
    expect(needsFullOriginResponse(request({ 'If-Modified-Since': LAST_MODIFIED }))).toBe(false);
    expect(needsFullOriginResponse(request())).toBe(false);
  });
});
