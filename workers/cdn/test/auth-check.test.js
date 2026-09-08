import {
  describe, it, expect,
} from 'vitest';
// eslint-disable-next-line import/no-relative-packages
import { createDemoSession } from '../../shared/demo-session.js';
import { getDemoIdentity, isAuthenticated } from '../handlers/auth-check.js';

const URL = 'https://examples.bbird.live/gated-content';

async function withSession(identity = {
  name: 'Ada Lovelace',
  email: 'visitor@example.invalid',
}, options = {}) {
  const token = await createDemoSession(identity, options);
  return new Request(URL, {
    headers: { Cookie: `bbird_demo_session=${token}` },
  });
}

describe('demo session authentication', () => {
  it('accepts a session signed with the public demo key', async () => {
    expect(await isAuthenticated(await withSession())).toBe(true);
  });

  it('returns the identity from a valid session', async () => {
    expect(await getDemoIdentity(await withSession())).toMatchObject({
      name: 'Ada Lovelace',
      email: 'visitor@example.invalid',
    });
  });

  it('rejects a tampered session', async () => {
    const request = await withSession();
    const cookie = `${request.headers.get('Cookie')}tampered`;
    const tampered = new Request(URL, { headers: { Cookie: cookie } });
    expect(await isAuthenticated(tampered)).toBe(false);
  });

  it('rejects an expired session', async () => {
    const now = Date.UTC(2026, 8, 7, 12, 0, 0);
    const request = await withSession(undefined, { now, ttlSeconds: 1 });
    expect(await isAuthenticated(request, { now: now + 2000 })).toBe(false);
  });

  it('rejects malformed cookie encoding without throwing', async () => {
    const request = new Request(URL, { headers: { Cookie: 'bbird_demo_session=%' } });
    expect(await isAuthenticated(request)).toBe(false);
  });

  it('rejects a request carrying no session', async () => {
    expect(await isAuthenticated(new Request(URL))).toBe(false);
  });

  it('does not accept Cloudflare identity headers as proof', async () => {
    const request = new Request(URL, {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'someone@adobe.com',
        'Cf-Access-Jwt-Assertion': 'header-is-not-a-demo-session',
      },
    });
    expect(await isAuthenticated(request)).toBe(false);
  });
});
