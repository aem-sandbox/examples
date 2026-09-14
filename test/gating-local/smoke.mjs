import assert from 'node:assert/strict';

const base = process.env.GATING_TEST_URL || 'http://127.0.0.1:8787';
const page = '/gated-content';
const forbiddenCacheHeaders = [
  'etag', 'last-modified', 'content-range', 'accept-ranges',
  'cdn-cache-control', 'cloudflare-cdn-cache-control', 'surrogate-control', 'expires',
];
const checks = [];
const send = (path, options = {}) => fetch(`${base}${path}`, {
  redirect: 'manual', signal: AbortSignal.timeout(20000), ...options,
});

async function audience(response, member, name) {
  assert.equal(response.status, 200, name);
  assert.equal(response.headers.get('cache-control'), 'private, no-store', name);
  forbiddenCacheHeaders.forEach((header) => {
    assert.equal(response.headers.get(header), null, header);
  });
  const html = await response.text();
  assert.equal(html.includes('VIP Perks'), member, name);
  assert.equal(html.includes('Member-only article 1'), member, name);
  assert.equal(html.includes('New here?'), !member, name);
  assert.equal(html.includes('Anonymous-only promo 1'), !member, name);
  assert.ok(html.includes('Public article 1'), name);
  checks.push(name);
}

await audience(await send(page), false, 'anonymous full HTML');
await audience(await send(`${page}?auth=true`), false, 'query override cannot create a session');
const source = await send(`${page}.plain.html`);
assert.equal(source.status, 200);
const modified = source.headers.get('last-modified');
assert.ok((await source.text()).includes('VIP Perks'));
checks.push('public plain-HTML exclusion remains explicit');
await audience(await send(page, { headers: { Range: 'bytes=0-100000' } }), false, 'anonymous Range');
if (modified) {
  await audience(await send(page, { headers: { 'If-Modified-Since': modified } }), false, 'origin conditional HTML');
}
await audience(await send(page, { headers: { 'If-None-Match': 'W/"1ni59yq-out"' } }), false, 'old audience ETag');

const head = await send(page, { method: 'HEAD' });
assert.equal(head.status, 200);
assert.equal(head.headers.get('cache-control'), 'private, no-store');
assert.equal(await head.text(), '');
checks.push('HEAD uses no-store and has no body');

const login = await send('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base },
  body: new URLSearchParams({ name: 'Example Reviewer', returnTo: page }),
});
assert.equal(login.status, 303);
assert.equal(login.headers.get('location'), `${base}${page}`);
const setCookie = login.headers.get('set-cookie');
assert.ok(setCookie.includes('HttpOnly') && setCookie.includes('Secure') && setCookie.includes('SameSite=Lax'));
const cookie = setCookie.split(';')[0];
checks.push('same-origin demo login and return path');

const session = await send('/auth/session', { headers: { Cookie: cookie } });
assert.equal((await session.json()).authenticated, true);
await audience(await send(page, { headers: { Cookie: cookie } }), true, 'demo member full HTML');
await audience(await send(page, { headers: { Cookie: cookie, Range: 'bytes=0-100000' } }), true, 'demo member Range');
await audience(await send(page, {
  headers: { Cookie: cookie, 'If-None-Match': 'W/"1ni59yq-out"' },
}), true, 'login does not revive the anonymous cached variant');
await audience(await send(page, { headers: { Cookie: 'bbird_demo_session=invalid' } }), false, 'invalid session is anonymous');

const logout = await send('/auth/logout', { headers: { Cookie: cookie } });
assert.equal(logout.status, 303);
assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
await audience(await send(page), false, 'anonymous again after logout');
assert.equal((await (await send('/auth/session')).json()).authenticated, false);
checks.push('logout expires the application session');

const publicPage = await send('/learn/free/article-1');
assert.equal(publicPage.status, 200);
assert.ok(!publicPage.headers.get('cache-control').includes('no-store'));
await publicPage.text();
checks.push('ungated HTML keeps its source cache policy');

// eslint-disable-next-line no-console
console.log(JSON.stringify({
  runtime: 'local workerd', base, checks, passed: checks.length,
}, null, 2));
