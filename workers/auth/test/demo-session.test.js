import { describe, it, expect } from 'vitest';
import {
  createDemoSession,
  verifyDemoSession,
} from '../../shared/demo-session.js'; // eslint-disable-line import/no-relative-packages

const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);

describe('demo session token', () => {
  it('round-trips the demo identity', async () => {
    const token = await createDemoSession({
      name: 'Ada Lovelace',
      email: 'visitor@example.invalid',
    }, { now: NOW, ttlSeconds: 3600 });

    expect(await verifyDemoSession(token, { now: NOW + 1000 })).toMatchObject({
      name: 'Ada Lovelace',
      email: 'visitor@example.invalid',
    });
  });

  it('rejects a tampered token', async () => {
    const token = await createDemoSession({
      name: 'Ada',
      email: 'visitor@example.invalid',
    }, { now: NOW });

    expect(await verifyDemoSession(`${token}x`, { now: NOW })).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await createDemoSession({
      name: 'Ada',
      email: 'visitor@example.invalid',
    }, { now: NOW, ttlSeconds: 1 });

    expect(await verifyDemoSession(token, { now: NOW + 2000 })).toBeNull();
  });

  it('rejects malformed tokens', async () => {
    expect(await verifyDemoSession('not-a-token', { now: NOW })).toBeNull();
  });
});
