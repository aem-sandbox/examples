import { describe, it, expect } from 'vitest';
// The block lives in the root package; this test package reaches it by relative path.
// eslint-disable-next-line import/no-relative-packages
import { mapGeometry, ringRadii } from '../../../blocks/quake-map/quake-map.js';

const xy = (geometry) => geometry.tiles.map((t) => [t.x, t.y]);

describe('mapGeometry', () => {
  it('places lat 0 lon 0 at zoom 7 with a 5x3 mosaic around the quake tile', () => {
    const geometry = mapGeometry(0, 0);
    expect(geometry.z).toBe(7);
    expect(geometry.tiles).toHaveLength(15);
    expect(xy(geometry)).toEqual([
      [62, 63], [63, 63], [64, 63], [65, 63], [66, 63],
      [62, 64], [63, 64], [64, 64], [65, 64], [66, 64],
      [62, 65], [63, 65], [64, 65], [65, 65], [66, 65],
    ]);
    expect(geometry.tiles[7].url).toBe('https://tile.openstreetmap.org/7/64/64.png');
    expect(geometry.originPx).toEqual({ x: 512, y: 256 });
  });

  it('centers the real fixture quake tile at zoom 7', () => {
    const geometry = mapGeometry(14.1592, -92.9052);
    expect(geometry.z).toBe(7);
    expect(xy(geometry)).toEqual([
      [28, 57], [29, 57], [30, 57], [31, 57], [32, 57],
      [28, 58], [29, 58], [30, 58], [31, 58], [32, 58],
      [28, 59], [29, 59], [30, 59], [31, 59], [32, 59],
    ]);
  });

  it('drops the zoom level at high latitude', () => {
    expect(mapGeometry(60, 0).z).toBe(6);
    expect(mapGeometry(0, 0).z).toBe(7);
  });

  it('wraps tile x across the antimeridian', () => {
    const geometry = mapGeometry(0, 179.95);
    expect(geometry.z).toBe(7);
    expect(xy(geometry).slice(0, 5)).toEqual([
      [125, 63], [126, 63], [127, 63], [0, 63], [1, 63],
    ]);
    expect(geometry.tiles).toHaveLength(15);
    expect(geometry.tiles.every((t) => t.x >= 0 && t.x < 128)).toBe(true);
  });

  it('clamps tile y to the valid range near the pole', () => {
    const geometry = mapGeometry(84, 0);
    expect(geometry.z).toBe(4);
    expect(geometry.tiles.every((t) => t.y >= 0 && t.y < 16)).toBe(true);
    expect(geometry.tiles.every((t) => t.y <= 1)).toBe(true);
  });
});

describe('ringRadii', () => {
  it('returns three strictly increasing radii', () => {
    const radii = ringRadii(5.2);
    expect(radii).toHaveLength(3);
    expect(radii[0]).toBeLessThan(radii[1]);
    expect(radii[1]).toBeLessThan(radii[2]);
  });

  it('scales every ring up with magnitude', () => {
    const small = ringRadii(5.2);
    const big = ringRadii(7.3);
    for (let i = 0; i < 3; i += 1) {
      expect(big[i]).toBeGreaterThan(small[i]);
    }
  });
});
