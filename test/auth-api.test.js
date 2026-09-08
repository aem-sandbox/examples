// @vitest-environment happy-dom
// @vitest-environment-options { "url": "https://examples.bbird.live/" }
import {
  afterEach, describe, it, expect, vi,
} from 'vitest';
// The module lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import { getLoginUrl, resolveAuthState } from '../scripts/shared/auth-api.js';

const returnToOf = (loginUrl) => new URL(loginUrl).searchParams.get('returnTo');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getLoginUrl', () => {
  it('sends the current location as a path, never as an absolute URL', () => {
    window.history.replaceState({}, '', '/learn/premium/article-4?ref=card#top');
    expect(returnToOf(getLoginUrl())).toBe('/learn/premium/article-4?ref=card#top');
  });

  it('reduces an explicit same-origin absolute URL to its path', () => {
    expect(returnToOf(getLoginUrl('https://examples.bbird.live/dashboard'))).toBe('/dashboard');
  });

  it('drops a foreign origin rather than passing it to the worker', () => {
    expect(returnToOf(getLoginUrl('https://evil.example/steal'))).toBe('/');
  });

  it('targets the auth worker on the current origin, not a hardcoded host', () => {
    window.happyDOM.setURL('https://preview.example.test/gated-content');
    try {
      const target = new URL(getLoginUrl());
      expect(target.origin).toBe('https://preview.example.test');
      expect(target.pathname).toBe('/auth/login');
    } finally {
      window.happyDOM.setURL('https://examples.bbird.live/');
    }
  });

  it('returns the demo name with the authenticated session state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      authenticated: true,
      name: 'Ada Lovelace',
      email: 'visitor@example.invalid',
    }), { status: 200 })));

    expect(await resolveAuthState()).toEqual({
      authenticated: true,
      name: 'Ada Lovelace',
      email: 'visitor@example.invalid',
    });
  });
});
