import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import worker, { Anonymous } from '../index.js';
// eslint-disable-next-line import/no-relative-packages
import { createDemoSession } from '../../shared/demo-session.js';
// eslint-disable-next-line import/no-relative-packages
import { gatedPage } from '../../../test/fixtures/gated-content.js';

const SITE = 'https://examples.bbird.live';
const ENV = { ORIGIN_HOSTNAME: 'main--examples--aem-sandbox.aem.live' };
const PAGE = '/gated-content';
const PRIVATE = 'Member-only detail';
const PUBLIC = 'Anonymous teaser';
const GATED = gatedPage(`<div data-view="logged-in">${PRIVATE}</div><div data-view="logged-out">${PUBLIC}</div>`);
const UNGATED = gatedPage('<div>Public page</div>', '');
const response = (html = GATED, headers = {}) => new Response(html, {
  headers: {
    'Content-Type': 'text/html', 'Cache-Control': 'max-age=300', ETag: '"source"', ...headers,
  },
});
const run = (init = {}, path = PAGE) => worker.fetch(new Request(`${SITE}${path}`, init), ENV);
const runWithContext = (init = {}, path = PAGE, anonymousFetch = vi.fn()) => worker.fetch(
  new Request(`${SITE}${path}`, init),
  ENV,
  { exports: { Anonymous: { fetch: anonymousFetch } } },
);

const conditionalHeaders = {
  Range: 'bytes=80-160',
  'If-Range': '"source"',
  'If-None-Match': 'W/"1ni59yq-out"',
  'If-Modified-Since': 'Mon, 07 Sep 2026 16:39:51 GMT',
  'If-Match': '"source"',
  'If-Unmodified-Since': 'Mon, 07 Sep 2026 16:39:51 GMT',
};

function mockOrigin(first, full = response()) {
  const fetchMock = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(full);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function expectProbe(fetchMock) {
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [probe, options] = fetchMock.mock.calls[1];
  expect(probe.url).toBe(`${SITE.replace('examples.bbird.live', ENV.ORIGIN_HOSTNAME)}${PAGE}`);
  expect(options?.method || probe.method).toBe('GET');
  Object.keys(conditionalHeaders).forEach((name) => {
    expect(probe.headers.get(name), name).toBeNull();
  });
}

function managedAnonymousCache(handler) {
  let now = 0;
  const entries = new Map();
  const fetch = vi.fn(async (request, options = {}) => {
    const key = options.cf?.cacheKey || new URL(request.url).pathname;
    const cached = entries.get(key);
    if (cached && cached.expires > now) return cached.response.clone();
    const result = await handler(request);
    const policy = result.headers.get('Cloudflare-CDN-Cache-Control') || '';
    const ttl = Number(policy.match(/(?:^|,)\s*max-age=(\d+)/)?.[1] || 0);
    if (policy.includes('public') && ttl > 0 && !result.headers.has('Set-Cookie')) {
      entries.set(key, { expires: now + ttl, response: result.clone() });
    }
    return result;
  });
  fetch.advance = (seconds) => { now += seconds; };
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('CDN gated request flow', () => {
  it('keeps warm anonymous, login, logout, and expired-session responses isolated', async () => {
    const origin = vi.fn().mockImplementation(() => response());
    vi.stubGlobal('fetch', origin);
    const anonymousFetch = managedAnonymousCache(
      (cachedRequest) => Anonymous.prototype.fetch.call({ env: ENV }, cachedRequest),
    );

    const anonymous = await runWithContext({}, PAGE, anonymousFetch);
    expect(await anonymous.text()).toContain(PUBLIC);

    const valid = await createDemoSession({ name: 'Demo Member' });
    const member = await runWithContext({
      headers: { Cookie: `bbird_demo_session=${valid}` },
    }, PAGE, anonymousFetch);
    expect(await member.text()).toContain(PRIVATE);
    expect(member.headers.get('Cache-Control')).toBe('private, no-store');

    const logout = await runWithContext({}, PAGE, anonymousFetch);
    expect(await logout.text()).toContain(PUBLIC);

    const expired = await createDemoSession(
      { name: 'Expired' },
      { now: Date.now() - 2000, ttlSeconds: 1 },
    );
    const afterExpiry = await runWithContext({
      headers: { Cookie: `bbird_demo_session=${expired}` },
    }, PAGE, anonymousFetch);
    expect(await afterExpiry.text()).toContain(PUBLIC);
    expect(origin).toHaveBeenCalledTimes(2);
  });

  it('does not let a member-first request populate the anonymous cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => response()));
    const anonymousFetch = managedAnonymousCache(
      (cachedRequest) => Anonymous.prototype.fetch.call({ env: ENV }, cachedRequest),
    );
    const valid = await createDemoSession({ name: 'Demo Member' });

    const member = await runWithContext({
      headers: { Cookie: `bbird_demo_session=${valid}` },
    }, PAGE, anonymousFetch);
    expect(await member.text()).toContain(PRIVATE);
    const anonymous = await runWithContext({}, PAGE, anonymousFetch);
    expect(await anonymous.text()).toContain(PUBLIC);
    const repeatedMember = await runWithContext({
      headers: { Cookie: `bbird_demo_session=${valid}` },
    }, PAGE, anonymousFetch);
    expect(await repeatedMember.text()).toContain(PRIVATE);
  });

  it('expires cached content and audience-rule changes after the bounded CDN TTL', async () => {
    let source = GATED;
    const origin = vi.fn().mockImplementation(() => response(source));
    vi.stubGlobal('fetch', origin);
    const anonymousFetch = managedAnonymousCache(
      (cachedRequest) => Anonymous.prototype.fetch.call({ env: ENV }, cachedRequest),
    );

    const first = await runWithContext({}, PAGE, anonymousFetch);
    expect(await first.text()).toContain(PUBLIC);

    source = gatedPage(
      '<div data-view="logged-out">Updated teaser</div>'
      + '<div data-view="logged-in">Updated member detail</div>',
    );
    const stillWarm = await runWithContext({}, PAGE, anonymousFetch);
    const warmHtml = await stillWarm.text();
    expect(warmHtml).toContain(PUBLIC);
    expect(warmHtml).not.toContain('Updated teaser');

    anonymousFetch.advance(61);
    const refreshed = await runWithContext({}, PAGE, anonymousFetch);
    const refreshedHtml = await refreshed.text();
    expect(refreshedHtml).toContain('Updated teaser');
    expect(refreshedHtml).not.toContain('Updated member detail');
  });

  it('selects the anonymous managed cache after verifying the request session', async () => {
    mockOrigin(response());
    const anonymousFetch = managedAnonymousCache(
      (cachedRequest) => Anonymous.prototype.fetch.call({ env: ENV }, cachedRequest),
    );
    const out = await runWithContext({
      headers: {
        Cookie: 'analytics=one; bbird_demo_session=invalid',
        'X-Audience': 'logged-in',
      },
    }, PAGE, anonymousFetch);
    expect(anonymousFetch).toHaveBeenCalledOnce();
    const [cachedRequest, options] = anonymousFetch.mock.calls[0];
    expect(cachedRequest.headers.has('Cookie')).toBe(false);
    expect(cachedRequest.headers.get('X-Audience')).toBe('logged-in');
    expect(options.cf.cacheKey).toBe('examples.bbird.live/gated-content');
    const html = await out.text();
    expect(html).toContain(PUBLIC);
    expect(html).not.toContain(PRIVATE);
  });

  it('bypasses the anonymous managed cache for a valid session', async () => {
    const token = await createDemoSession({ name: 'Demo Member' });
    const anonymousFetch = vi.fn();
    mockOrigin(response());
    const out = await runWithContext({
      headers: { Cookie: `analytics=one; bbird_demo_session=${token}` },
    }, PAGE, anonymousFetch);
    expect(anonymousFetch).not.toHaveBeenCalled();
    expect(out.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await out.text()).toContain(PRIVATE);
  });

  it.each([
    ['absent', undefined],
    ['invalid', 'bbird_demo_session=invalid'],
    ['expired', 'expired'],
  ])('uses the anonymous managed cache for an %s session', async (_, cookie) => {
    let value = cookie;
    if (cookie === 'expired') {
      value = `bbird_demo_session=${await createDemoSession(
        { name: 'Expired' },
        { now: Date.now() - 2000, ttlSeconds: 1 },
      )}`;
    }
    const anonymousFetch = vi.fn().mockResolvedValue(response());
    await runWithContext(value ? { headers: { Cookie: value } } : {}, PAGE, anonymousFetch);
    expect(anonymousFetch).toHaveBeenCalledOnce();
  });

  it('uses one canonical cache selection for unrelated anonymous cookies', async () => {
    const anonymousFetch = vi.fn().mockResolvedValue(response());
    await runWithContext({ headers: { Cookie: 'analytics=one' } }, PAGE, anonymousFetch);
    await runWithContext({ headers: { Cookie: 'analytics=two; campaign=spring' } }, PAGE, anonymousFetch);
    const selections = anonymousFetch.mock.calls.map(([cachedRequest, options]) => ({
      cookie: cachedRequest.headers.get('Cookie'),
      key: options.cf.cacheKey,
    }));
    expect(selections).toEqual([
      { cookie: null, key: 'examples.bbird.live/gated-content' },
      { cookie: null, key: 'examples.bbird.live/gated-content' },
    ]);
  });

  it('replaces a partial gated response with a full filtered response', async () => {
    const first = new Response(PRIVATE, {
      status: 206,
      headers: { 'Content-Type': 'text/html', 'Content-Range': 'bytes 80-98/300' },
    });
    const fetchMock = mockOrigin(first);
    const out = await run({ headers: conditionalHeaders });
    expectProbe(fetchMock);
    expect(out.status).toBe(200);
    expect(out.headers.get('Cache-Control')).toBe('no-cache');
    expect(out.headers.get('Content-Range')).toBeNull();
    const html = await out.text();
    expect(html).not.toContain(PRIVATE);
    expect(html).toContain(PUBLIC);
  });

  it.each([
    { 'If-None-Match': '"source"' },
    { 'If-None-Match': 'W/"1ni59yq-out"' },
    { 'If-Modified-Since': 'Mon, 07 Sep 2026 16:39:51 GMT' },
  ])('does not revive gated HTML through an origin 304: %j', async (headers) => {
    const fetchMock = mockOrigin(new Response(null, { status: 304, headers: { ETag: '"source"' } }));
    const out = await run({ headers });
    expectProbe(fetchMock);
    expect(out.status).toBe(200);
    expect(out.headers.get('ETag')).toBeNull();
    expect(out.headers.get('Cache-Control')).toBe('no-cache');
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('classifies HEAD with a full GET and emits only safe gated headers', async () => {
    const fetchMock = mockOrigin(response(null, { 'Content-Length': '9000' }));
    const out = await run({ method: 'HEAD' });
    expectProbe(fetchMock);
    expect(out.status).toBe(200);
    expect(out.headers.get('Cache-Control')).toBe('no-cache');
    expect(out.headers.get('Content-Length')).toBeNull();
    expect(out.headers.get('ETag')).toBeNull();
    expect(await out.text()).toBe('');
  });

  it('retains the original ungated partial response', async () => {
    const first = new Response('Public', {
      status: 206,
      headers: { 'Content-Type': 'text/html', 'Content-Range': 'bytes 0-5/900', ETag: '"public"' },
    });
    const fetchMock = mockOrigin(first, response(UNGATED));
    const out = await run({ headers: { Range: 'bytes=0-5' } });
    expectProbe(fetchMock);
    expect(out.status).toBe(206);
    expect(out.headers.get('Content-Range')).toBe('bytes 0-5/900');
    expect(out.headers.get('ETag')).toBe('"public"');
    expect(await out.text()).toBe('Public');
  });

  it('retains the original ungated 304', async () => {
    const fetchMock = mockOrigin(new Response(null, {
      status: 304, headers: { ETag: '"public"', 'Cache-Control': 'max-age=300' },
    }), response(UNGATED));
    const out = await run({ headers: { 'If-None-Match': '"public"' } });
    expectProbe(fetchMock);
    expect(out.status).toBe(304);
    expect(out.headers.get('ETag')).toBe('"public"');
    expect(out.headers.get('Cache-Control')).toBe('max-age=300');
  });

  it('retains the original ungated HEAD headers', async () => {
    const fetchMock = mockOrigin(response(null, { 'Content-Length': '9000' }), response(UNGATED));
    const out = await run({ method: 'HEAD' });
    expectProbe(fetchMock);
    expect(out.headers.get('Content-Length')).toBe('9000');
    expect(out.headers.get('Cache-Control')).toBe('max-age=300');
    expect(out.headers.get('ETag')).toBe('"source"');
    expect(await out.text()).toBe('');
  });

  it.each([304, 206, 404, 500])('fails closed when the full response is status %i', async (status) => {
    const fetchMock = mockOrigin(new Response(null, { status: 304 }), new Response(status === 304 ? null : PRIVATE, { status, headers: { 'Content-Type': 'text/html' } }));
    const out = await run({ headers: { 'If-None-Match': '"source"' } });
    expectProbe(fetchMock);
    expect(out.status).toBe(502);
    expect(out.headers.get('Cache-Control')).toContain('no-store');
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('fails closed when fetching the full representation throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockRejectedValueOnce(new Error('Network error')));
    const out = await run({ headers: { 'If-None-Match': '"source"' } });
    expect(out.status).toBe(502);
    expect(out.headers.get('Cache-Control')).toContain('no-store');
  });

  it('fails closed when the full representation is not HTML', async () => {
    mockOrigin(new Response(PRIVATE, { status: 206, headers: { 'Content-Type': 'text/html' } }), new Response(PRIVATE));
    const out = await run({ headers: { 'If-None-Match': '"source"' } });
    expect(out.status).toBe(502);
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('keeps the demo session local while preserving unrelated cookies', async () => {
    const token = await createDemoSession({ name: 'Demo Member' });
    const fetchMock = mockOrigin(response());
    const out = await run({
      headers: {
        Cookie: `other=1; bbird_demo_session=${token}; bbird_demo_session=duplicate; bbird_demo_session_hint=1; another=a=b`,
      },
    });
    const upstream = fetchMock.mock.calls[0][0];
    expect(upstream.headers.get('Cookie')).toBe('other=1; bbird_demo_session_hint=1; another=a=b');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await out.text()).toContain(PRIVATE);
  });

  it('removes an otherwise empty upstream Cookie header, including on the probe', async () => {
    const fetchMock = mockOrigin(new Response(null, { status: 304 }));
    const out = await run({ headers: { Cookie: 'bbird_demo_session=invalid' } });
    expectProbe(fetchMock);
    fetchMock.mock.calls.forEach(([req]) => expect(req.headers.has('Cookie')).toBe(false));
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('does not treat a query parameter as authentication', async () => {
    mockOrigin(response());
    const out = await run({}, `${PAGE}?auth=true`);
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('inspects a dotted page even when its 304 has no media type', async () => {
    const fetchMock = mockOrigin(new Response(null, { status: 304 }));
    const out = await run({ headers: { 'If-None-Match': '"source"' } }, '/release.v2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out.status).toBe(200);
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('inspects multipart byte ranges before returning HTML', async () => {
    const fetchMock = mockOrigin(new Response(PRIVATE, {
      status: 206, headers: { 'Content-Type': 'multipart/byteranges; boundary=parts' },
    }));
    const out = await run({ headers: { Range: 'bytes=0-10,20-30' } }, '/release.v2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out.status).toBe(200);
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('accepts whitespace before HTML media-type parameters', async () => {
    mockOrigin(response(GATED, { 'Content-Type': 'text/html ; charset=utf-8' }));
    const out = await run();
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('only skips the exact shared nav/footer paths', async () => {
    mockOrigin(response());
    const out = await run({}, '/nav.plain.html-extra');
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('returns no-store 502 when the inspected response body errors', async () => {
    const broken = new Response(new ReadableStream({
      start(controller) { controller.error(new Error('Body read failed')); },
    }), { headers: { 'Content-Type': 'text/html' } });
    mockOrigin(new Response(null, { status: 304 }), broken);
    const out = await run({ headers: { 'If-None-Match': '"source"' } });
    expect(out.status).toBe(502);
    expect(out.headers.get('Cache-Control')).toContain('no-store');
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it.each([
    { 'Content-Type': 'multipart/byteranges; boundary=parts' },
    { 'Content-Type': 'text/html', 'Content-Range': 'bytes 0-10/200' },
  ])('rejects a supposedly full probe that is still partial: %j', async (headers) => {
    const full = new Response(GATED, { headers });
    const cancel = vi.spyOn(full.body, 'cancel');
    mockOrigin(new Response(null, { status: 304 }), full);
    const out = await run({ headers: { 'If-None-Match': '"source"' } });
    expect(out.status).toBe(502);
    expect(out.headers.get('Cache-Control')).toContain('no-store');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('inspects HTML with a Content-Range even when the origin returns status 200', async () => {
    const fetchMock = mockOrigin(response(PRIVATE, { 'Content-Range': 'bytes 0-10/200' }));
    const out = await run({ headers: { Range: 'bytes=0-10' } });
    expectProbe(fetchMock);
    expect(out.status).toBe(200);
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('cancels a partial response body that the filtered response replaces', async () => {
    const cancel = vi.fn();
    const partial = new Response(new ReadableStream({ cancel }), {
      status: 206, headers: { 'Content-Type': 'text/html' },
    });
    mockOrigin(partial);
    const out = await run({ headers: { Range: 'bytes=0-10' } });
    await out.text();
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe('unrelated public CDN requests', () => {
  it('keeps ungated output out of the managed response cache', async () => {
    expect(Anonymous).toBeTypeOf('function');
    mockOrigin(response(UNGATED));
    const out = await Anonymous.prototype.fetch.call({ env: ENV }, new Request(`${SITE}${PAGE}`));
    expect(out.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
    expect(await out.text()).toBe(UNGATED);
  });

  it('marks errors uncacheable at the anonymous entrypoint boundary', async () => {
    const out = await Anonymous.prototype.fetch.call(
      { env: { ORIGIN_HOSTNAME: 'invalid.example' } },
      new Request(`${SITE}${PAGE}`),
    );
    expect(out.status).toBe(500);
    expect(out.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('does not probe an extensionless HEAD with a known non-HTML type', async () => {
    const fetchMock = mockOrigin(new Response(null, {
      headers: { 'Content-Type': 'application/json', ETag: '"json"' },
    }));
    const out = await run({ method: 'HEAD' }, '/api');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.status).toBe(200);
    expect(out.headers.get('ETag')).toBe('"json"');
  });

  it('preserves a type-less 304 classified as non-HTML and cancels its probe body', async () => {
    const cancel = vi.fn();
    const full = new Response(new ReadableStream({ cancel }), {
      headers: { 'Content-Type': 'application/json' },
    });
    const fetchMock = mockOrigin(new Response(null, { status: 304, headers: { ETag: '"json"' } }), full);
    const out = await run({ headers: { 'If-None-Match': '"json"' } }, '/api');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out.status).toBe(304);
    expect(out.headers.get('ETag')).toBe('"json"');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each(['/gated-content.plain.html', '/gated-content.md', '/fragments/example', '/nav.plain.html', '/footer.plain.html'])('leaves the explicit public-demo exclusion %s untouched', async (path) => {
    const fetchMock = mockOrigin(new Response('Public source', { status: 206, headers: { 'Content-Type': 'text/html' } }));
    const out = await run({ headers: { Range: 'bytes=0-12' } }, path);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.status).toBe(206);
    expect(await out.text()).toBe('Public source');
  });

  it('does not probe media ranges', async () => {
    const fetchMock = mockOrigin(new Response('image-bytes', { status: 206, headers: { 'Content-Type': 'image/png' } }));
    const out = await run({ headers: { Range: 'bytes=0-10' } }, '/media_123.png');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.status).toBe(206);
  });

  it('preserves existing JSON passthrough and the html2json fallback', async () => {
    const fetchMock = mockOrigin(new Response(null, { status: 404 }), new Response('{"ok":true}', {
      headers: { 'Content-Type': 'application/json' },
    }));
    const out = await run({}, '/example.json?head=true&compact=true');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('mhast-html-to-json.adobeaem.workers.dev/aem-sandbox/examples/example?head=true&compact=true');
    expect(await out.json()).toEqual({ ok: true });
  });

  it('keeps an ordinary public GET unchanged with one origin fetch', async () => {
    const fetchMock = mockOrigin(response(UNGATED));
    const out = await run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.headers.get('ETag')).toBe('"source"');
    expect(await out.text()).toBe(UNGATED);
  });
});
