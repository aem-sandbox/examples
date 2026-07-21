import { describe, it, expect } from 'vitest';
// The template JS lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import { magTier } from '../../../templates/usgs-quakes/usgs-quakes.js';

describe('magTier', () => {
  it('maps badge text to a clamped tier class', () => {
    expect(magTier('M 5.2')).toBe('m5');
    expect(magTier('M 5.9')).toBe('m5');
    expect(magTier('M 6.4')).toBe('m6');
    expect(magTier('M 7.3')).toBe('m7');
    expect(magTier('M 8.1')).toBe('m7');
    expect(magTier('M 4.8')).toBe('m5');
  });

  it('returns null for text without a parsable magnitude', () => {
    expect(magTier('')).toBeNull();
    expect(magTier(null)).toBeNull();
    expect(magTier('Magnitude unknown')).toBeNull();
  });
});
