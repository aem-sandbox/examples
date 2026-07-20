import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { readFileSync } from 'node:fs';
import worker from '../index.js';

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

const feed = loadFixture('usgs-query.json');

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function quakeFeature(id, mag, updated) {
  return {
    type: 'Feature',
    id,
    properties: {
      mag,
      place: 'Testville',
      time: 1784483116923,
      updated,
      felt: null,
      alert: null,
      tsunami: 0,
      status: 'reviewed',
      magType: 'mww',
    },
    geometry: { coordinates: [10, 20, 8] },
  };
}

const twoFeed = {
  type: 'FeatureCollection',
  features: [quakeFeature('us7000aaa', 5.5, 111), quakeFeature('us7000bbb', 6.0, 222)],
};

function fakeKv(initial) {
  const store = new Map();
  if (initial !== undefined) store.set('state', JSON.stringify(initial));
  const puts = [];
  return {
    puts,
    get: vi.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    put: vi.fn(async (key, value) => {
      store.set(key, value);
      puts.push({ key, value });
    }),
  };
}

function schedulerFetch({ usgs = twoFeed, adminStatus = () => 200 } = {}) {
  const calls = [];
  const fn = vi.fn(async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('earthquake.usgs.gov')) {
      if (usgs === 'error') return new Response('err', { status: 500 });
      if (usgs === 'throw') throw new Error('network down');
      return jsonResponse(usgs);
    }
    const method = (init && init.method) || 'GET';
    const status = adminStatus(url);
    calls.push({ url, method, status });
    const headers = status >= 400 ? { 'x-error': 'denied' } : {};
    return new Response(null, { status, headers });
  });
  return { fn, calls };
}

let logSpy;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetch handler', () => {
  it('returns 200 with the reshaped feed on GET /', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(feed)));
    const res = await worker.fetch(new Request('https://worker.dev/'), { WINDOW_DAYS: '30' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const body = await res.json();
    expect(body.count).toBe(8);
    expect(body.data).toHaveLength(8);
    expect(typeof body.generated).toBe('string');
    expect(body.data[0].path).toBe('/extras/usgs-quakes/us7000t1tp');
  });

  it('rejects a non-GET request with 405 and an Allow header', async () => {
    const res = await worker.fetch(new Request('https://worker.dev/', { method: 'POST' }), {});
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
  });

  it('returns 404 for an unknown path', async () => {
    const res = await worker.fetch(new Request('https://worker.dev/other'), {});
    expect(res.status).toBe(404);
  });

  it('collapses a USGS error to 404 with a JSON error body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 500 })));
    const res = await worker.fetch(new Request('https://worker.dev/'), {});
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('adds no CORS headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(feed)));
    const res = await worker.fetch(new Request('https://worker.dev/'), {});
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('scheduled handler', () => {
  it('previews then publishes each new page and republishes the overview last', async () => {
    const { fn, calls } = schedulerFetch();
    vi.stubGlobal('fetch', fn);
    const kv = fakeKv({ pages: {} });
    const env = { ADMIN_API_KEY: 'tok', QUAKES_KV: kv };
    await worker.scheduled({}, env);

    expect(calls).toHaveLength(6);
    expect(calls[0].url).toContain('/preview/aem-sandbox/examples/main/extras/usgs-quakes/us7000aaa');
    expect(calls[1].url).toContain('/live/aem-sandbox/examples/main/extras/usgs-quakes/us7000aaa');
    expect(calls[2].url).toContain('/preview/aem-sandbox/examples/main/extras/usgs-quakes/us7000bbb');
    expect(calls[3].url).toContain('/live/aem-sandbox/examples/main/extras/usgs-quakes/us7000bbb');
    expect(calls[4].url.endsWith('/extras/usgs-quakes')).toBe(true);
    expect(calls[5].url.endsWith('/extras/usgs-quakes')).toBe(true);
    expect(calls.every((c) => c.method === 'POST')).toBe(true);

    const saved = JSON.parse(kv.puts.at(-1).value);
    expect(saved.pages).toEqual({ us7000aaa: 111, us7000bbb: 222 });
  });

  it('skips live and state for an id whose preview fails, keeps the others', async () => {
    const { fn, calls } = schedulerFetch({
      adminStatus: (url) => (url.includes('/preview/') && url.includes('us7000aaa') ? 401 : 200),
    });
    vi.stubGlobal('fetch', fn);
    const kv = fakeKv({ pages: {} });
    await worker.scheduled({}, { ADMIN_API_KEY: 'tok', QUAKES_KV: kv });

    const urls = calls.map((c) => c.url);
    expect(urls.some((u) => u.includes('/preview/') && u.includes('us7000aaa'))).toBe(true);
    expect(urls.some((u) => u.includes('/live/') && u.includes('us7000aaa'))).toBe(false);
    expect(urls.some((u) => u.includes('/live/') && u.includes('us7000bbb'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/extras/usgs-quakes'))).toBe(true);

    const saved = JSON.parse(kv.puts.at(-1).value);
    expect(saved.pages).toEqual({ us7000bbb: 222 });
  });

  it('does nothing when no page was added, changed, or removed', async () => {
    const { fn, calls } = schedulerFetch();
    vi.stubGlobal('fetch', fn);
    const kv = fakeKv({ pages: { us7000aaa: 111, us7000bbb: 222 } });
    await worker.scheduled({}, { ADMIN_API_KEY: 'tok', QUAKES_KV: kv });
    expect(calls).toHaveLength(0);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('skips admin calls and leaves KV untouched when ADMIN_API_KEY is missing', async () => {
    const { fn, calls } = schedulerFetch();
    vi.stubGlobal('fetch', fn);
    const kv = fakeKv({ pages: {} });
    await worker.scheduled({}, { QUAKES_KV: kv });
    expect(calls).toHaveLength(0);
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('leaves KV untouched when the USGS fetch returns an error', async () => {
    const { fn } = schedulerFetch({ usgs: 'error' });
    vi.stubGlobal('fetch', fn);
    const kv = fakeKv({ pages: { us7000aaa: 111 } });
    await worker.scheduled({}, { ADMIN_API_KEY: 'tok', QUAKES_KV: kv });
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('leaves KV untouched when the USGS fetch throws', async () => {
    const { fn } = schedulerFetch({ usgs: 'throw' });
    vi.stubGlobal('fetch', fn);
    const kv = fakeKv({ pages: {} });
    await worker.scheduled({}, { ADMIN_API_KEY: 'tok', QUAKES_KV: kv });
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('keeps removed pages published, drops them from state, issues no delete calls', async () => {
    const { fn, calls } = schedulerFetch();
    vi.stubGlobal('fetch', fn);
    const kv = fakeKv({ pages: { us7000aaa: 111, us7000bbb: 222, us7000ccc: 333 } });
    await worker.scheduled({}, { ADMIN_API_KEY: 'tok', QUAKES_KV: kv });

    const urls = calls.map((c) => c.url);
    expect(urls.some((u) => u.includes('us7000ccc'))).toBe(false);
    expect(calls.every((c) => c.method === 'POST')).toBe(true);
    expect(urls.filter((u) => u.endsWith('/extras/usgs-quakes'))).toHaveLength(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('us7000ccc'));

    const saved = JSON.parse(kv.puts.at(-1).value);
    expect(saved.pages).toEqual({ us7000aaa: 111, us7000bbb: 222 });
  });
});
