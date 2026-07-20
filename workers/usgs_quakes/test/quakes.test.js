import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildQueryUrl, reshape, buildFeed, diffState, nextState,
} from '../quakes.js';

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

function featureById(collection, id) {
  return collection.features.find((f) => f.id === id);
}

function makeFeature(overrides = {}) {
  const {
    id = 'us7000tsyn',
    mag = 5.5,
    place = 'Test City',
    time = 1784483116923,
    updated = 1,
    felt = null,
    alert = null,
    tsunami = 0,
    status = 'reviewed',
    magType = 'mww',
    coordinates = [10, 20, 8],
  } = overrides;
  return {
    type: 'Feature',
    id,
    properties: {
      mag, place, time, updated, felt, alert, tsunami, status, magType,
    },
    geometry: coordinates ? { coordinates } : null,
  };
}

const feed = loadFixture('usgs-query.json');
const edge = loadFixture('usgs-query-edge.json');

describe('buildQueryUrl', () => {
  const now = Date.parse('2026-07-20T12:00:00Z');

  it('uses the env threshold and window, ISO starttime, and no endtime', () => {
    const url = buildQueryUrl({ MIN_MAGNITUDE: '6.0', WINDOW_DAYS: '7' }, now);
    expect(url).toBe(
      'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson'
      + '&starttime=2026-07-13T12:00:00&minmagnitude=6.0'
      + '&eventtype=earthquake&orderby=time&limit=400',
    );
    expect(url).not.toContain('endtime');
  });

  it('falls back to defaults of 5.2 and 30 days', () => {
    const url = buildQueryUrl({}, now);
    expect(url).toContain('minmagnitude=5.2');
    expect(url).toContain('starttime=2026-06-20T12:00:00');
  });
});

describe('reshape', () => {
  it('maps a real feature to the exact record shape', () => {
    const rec = reshape(featureById(feed, 'us7000t1tp'));
    expect(rec).toEqual({
      id: 'us7000t1tp',
      path: '/extras/usgs-quakes/us7000t1tp',
      title: 'M 5.5 - 81 km SW of Puerto Madero, Mexico',
      mag: '5.5',
      magClass: 'm5',
      magDisplay: '5.5 (mww)',
      place: '81 km SW of Puerto Madero, Mexico',
      timeISO: '2026-07-19T17:45:16.923Z',
      timeUTC: '2026-07-19 17:45 UTC',
      coords: '14.16°N, 92.91°W',
      lat: '14.1592',
      lon: '-92.9052',
      depthKm: '35 km',
      usgsUrl: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000t1tp',
      alert: 'green',
      felt: '1 felt report',
      tsunami: null,
      status: 'reviewed',
      updated: 1784490716284,
      description: 'Magnitude 5.5 earthquake, 81 km SW of Puerto Madero, Mexico, 2026-07-19 17:45 UTC.',
    });
  });

  it('formats southern and western hemisphere coordinates', () => {
    const rec = reshape(featureById(feed, 'us7000t1q7'));
    expect(rec.coords).toBe('12.04°S, 75.30°W');
    expect(rec.felt).toBe('11 felt reports');
    expect(rec.alert).toBe('yellow');
  });

  it('formats eastern hemisphere coordinates and one-decimal depth', () => {
    const rec = reshape(featureById(feed, 'us7000t0d0'));
    expect(rec.coords).toBe('5.32°N, 125.18°E');
    expect(rec.depthKm).toBe('46.4 km');
    expect(rec.felt).toBe('79 felt reports');
  });

  it('rounds deep-quake depth to one decimal', () => {
    expect(reshape(featureById(feed, 'us7000t0u6')).depthKm).toBe('340.3 km');
    expect(reshape(featureById(feed, 'us7000t0hk')).depthKm).toBe('574.3 km');
  });

  it('null-guards felt, alert, and tsunami', () => {
    const rec = reshape(featureById(feed, 'us7000t1q6'));
    expect(rec.felt).toBeNull();
    expect(rec.alert).toBeNull();
    expect(rec.tsunami).toBeNull();
    expect(rec.place).toBe('59 km SW of Puerto Madero, Mexico');
    expect(rec.depthKm).toBe('19.6 km');
  });

  it('formats felt count with an en-US thousands separator', () => {
    const rec = reshape(makeFeature({ felt: 12500, alert: 'red' }));
    expect(rec.felt).toBe('12,500 felt reports');
    expect(rec.alert).toBe('red');
  });

  it('drops the trailing zero for whole-number magnitude and depth', () => {
    const rec = reshape(makeFeature({ mag: 5, magType: 'mb', coordinates: [0, 0, 10] }));
    expect(rec.mag).toBe('5.0');
    expect(rec.magDisplay).toBe('5.0 (mb)');
    expect(rec.depthKm).toBe('10 km');
    expect(rec.coords).toBe('0.00°N, 0.00°E');
  });

  it('builds title and description without place when place is null', () => {
    const rec = reshape(makeFeature({ place: null, mag: 5.6 }));
    expect(rec.title).toBe('M 5.6');
    expect(rec.place).toBeNull();
    expect(rec.description).toBe('Magnitude 5.6 earthquake, 2026-07-19 17:45 UTC.');
  });

  it('flags tsunami only when the tsunami property equals 1', () => {
    expect(reshape(makeFeature({ tsunami: 1 })).tsunami).toBe('1');
    expect(reshape(makeFeature({ tsunami: 0 })).tsunami).toBeNull();
  });

  it('keeps raw lat and lon coordinate strings in [lon, lat, depth] order', () => {
    const north = reshape(featureById(feed, 'us7000t1tp'));
    expect(north.lat).toBe('14.1592');
    expect(north.lon).toBe('-92.9052');
    const south = reshape(featureById(feed, 'us7000t1q7'));
    expect(south.lat).toBe('-12.0429');
    expect(south.lon).toBe('-75.3013');
  });

  it('derives magClass by flooring and clamping the magnitude to m5..m7', () => {
    expect(reshape(featureById(feed, 'us7000t1tp')).magClass).toBe('m5');
    expect(reshape(featureById(feed, 'us7000t0d0')).magClass).toBe('m6');
    expect(reshape(featureById(feed, 'us7000t1bu')).magClass).toBe('m7');
    expect(reshape(makeFeature({ mag: 8.1 })).magClass).toBe('m7');
    expect(reshape(makeFeature({ mag: 5.9 })).magClass).toBe('m5');
    expect(reshape(makeFeature({ mag: 4.8 })).magClass).toBe('m5');
  });

  it('drops features with empty id, null magnitude, bad geometry, or illegal id', () => {
    expect(reshape(featureById(edge, ''))).toBeNull();
    expect(reshape(featureById(edge, 'us7000tnull'))).toBeNull();
    expect(reshape(makeFeature({ coordinates: [10, 20] }))).toBeNull();
    expect(reshape(makeFeature({ id: 'US.7000!' }))).toBeNull();
  });
});

describe('buildFeed', () => {
  it('reshapes every feature and reports count, config, and ordering', () => {
    const nowMs = Date.parse('2026-07-20T00:00:00Z');
    const out = buildFeed(feed, { MIN_MAGNITUDE: '5.2', WINDOW_DAYS: '30' }, nowMs);
    expect(out.count).toBe(8);
    expect(out.data).toHaveLength(8);
    expect(out.minMagnitude).toBe('5.2');
    expect(out.windowDays).toBe('30');
    expect(out.generated).toBe('2026-07-20T00:00:00.000Z');
    expect(out.data[0].id).toBe('us7000t1tp');
    expect(out.data[out.data.length - 1].id).toBe('us7000t0d0');
  });

  it('drops all invalid features from the edge fixture', () => {
    const out = buildFeed(edge, {}, 0);
    expect(out.count).toBe(0);
    expect(out.data).toEqual([]);
  });

  it('defaults config when env is empty', () => {
    const out = buildFeed(feed, {}, 0);
    expect(out.minMagnitude).toBe('5.2');
    expect(out.windowDays).toBe('30');
  });
});

describe('diffState', () => {
  const records = [
    { id: 'a', updated: 100 },
    { id: 'b', updated: 200 },
  ];

  it('treats every record as added when state is empty', () => {
    const { added, changed, removed } = diffState(records, { pages: {} });
    expect(added.map((r) => r.id)).toEqual(['a', 'b']);
    expect(changed).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('detects changed rows by updated timestamp', () => {
    const { added, changed, removed } = diffState(records, { pages: { a: 100, b: 199 } });
    expect(added).toEqual([]);
    expect(changed.map((r) => r.id)).toEqual(['b']);
    expect(removed).toEqual([]);
  });

  it('reports removed ids that fell out of the current window', () => {
    const { removed } = diffState(records, { pages: { a: 100, b: 200, c: 50 } });
    expect(removed).toEqual(['c']);
  });

  it('reports no work when nothing changed', () => {
    const { added, changed, removed } = diffState(records, { pages: { a: 100, b: 200 } });
    expect(added).toEqual([]);
    expect(changed).toEqual([]);
    expect(removed).toEqual([]);
  });
});

describe('nextState', () => {
  it('keeps untouched ids, drops removed, and adds succeeded', () => {
    const old = { pages: { a: 100, b: 200, c: 300 } };
    const out = nextState(old, ['c'], [{ id: 'b', updated: 250 }, { id: 'd', updated: 400 }]);
    expect(out).toEqual({ pages: { a: 100, b: 250, d: 400 } });
  });

  it('leaves failed ids absent', () => {
    const out = nextState({ pages: {} }, [], []);
    expect(out).toEqual({ pages: {} });
  });
});
