import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import worker from '../index.js';
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

afterEach(() => vi.unstubAllGlobals());

describe('CDN gated request flow', () => {
  it('replaces a partial gated response with a full filtered response', async () => {
    const first = new Response(PRIVATE, {
      status: 206,
      headers: { 'Content-Type': 'text/html', 'Content-Range': 'bytes 80-98/300' },
    });
    const fetchMock = mockOrigin(first);
    const out = await run({ headers: conditionalHeaders });
    expectProbe(fetchMock);
    expect(out.status).toBe(200);
    expect(out.headers.get('Cache-Control')).toBe('private, no-store');
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
    expect(out.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await out.text()).not.toContain(PRIVATE);
  });

  it('classifies HEAD with a full GET and emits only safe gated headers', async () => {
    const fetchMock = mockOrigin(response(null, { 'Content-Length': '9000' }));
    const out = await run({ method: 'HEAD' });
    expectProbe(fetchMock);
    expect(out.status).toBe(200);
    expect(out.headers.get('Cache-Control')).toBe('private, no-store');
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
    mockOrigin(new Response(null, { status: 304 }), new Response(PRIVATE));
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
});

describe('unrelated public CDN requests', () => {
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
