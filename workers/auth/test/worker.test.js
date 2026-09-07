import { describe, it, expect } from 'vitest';
import worker from '../index.js';

const ORIGIN = 'https://examples.bbird.live';

function request(path, init = {}) {
  return worker.fetch(new Request(`${ORIGIN}${path}`, init));
}

function login(name = 'Ada Lovelace', returnTo = '/learn/free/article-1') {
  return request('/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      Origin: ORIGIN,
    },
    body: new URLSearchParams({ name, returnTo }),
  });
}

function cookieFrom(response) {
  return response.headers.get('set-cookie')?.split(';')[0] || '';
}

describe('demo login flow', () => {
  it('serves a name form and preserves a safe return path', async () => {
    const response = await request('/auth/login?returnTo=%2Flearn%2Ffree%2Farticle-1');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('name="name"');
    expect(html).toContain('value="/learn/free/article-1"');
  });

  it('does not put an external return target in the form', async () => {
    const response = await request('/auth/login?returnTo=https%3A%2F%2Fevil.example%2Fsteal');
    expect(await response.text()).toContain('value="/auth/session"');
  });

  it('creates a signed, short-lived, secure session and returns to the requested path', async () => {
    const response = await login();
    const cookie = response.headers.get('set-cookie');

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/learn/free/article-1`);
    expect(cookie).toContain('bbird_demo_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=3600');
  });

  it('returns the chosen name and a fixed fake email for a valid session', async () => {
    const loginResponse = await login('Ada Lovelace');
    const response = await request('/auth/session', {
      headers: { Cookie: cookieFrom(loginResponse) },
    });

    expect(await response.json()).toMatchObject({
      authenticated: true,
      name: 'Ada Lovelace',
      email: 'visitor@example.invalid',
    });
  });

  it('treats a tampered session as anonymous', async () => {
    const loginResponse = await login();
    const cookie = `${cookieFrom(loginResponse)}tampered`;
    const response = await request('/auth/session', { headers: { Cookie: cookie } });

    expect(await response.json()).toMatchObject({
      authenticated: false,
      name: '',
      email: '',
    });
  });

  it('rejects a cross-origin login submission', async () => {
    const response = await request('/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Origin: 'https://evil.example',
      },
      body: new URLSearchParams({ name: 'Ada' }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('does not grant credentialed CORS access to an unknown origin', async () => {
    const response = await request('/auth/session', {
      headers: { Origin: 'https://evil.example' },
    });

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('allows the examples feature preview to read session state', async () => {
    const preview = 'https://authflow--examples--aem-sandbox.aem.page';
    const response = await request('/auth/session', {
      headers: { Origin: preview },
    });

    expect(response.headers.get('access-control-allow-origin')).toBe(preview);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('requires a non-empty display name', async () => {
    const response = await login('   ');
    expect(response.status).toBe(400);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('clears the demo session on logout', async () => {
    const response = await request('/auth/logout');
    const cookie = response.headers.get('set-cookie');

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/`);
    expect(cookie).toContain('bbird_demo_session=');
    expect(cookie).toContain('Max-Age=0');
  });
});
