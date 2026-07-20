import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import Mustache from 'mustache';

function loadTemplate(name) {
  return readFileSync(new URL(`../../../templates/usgs-quakes/${name}`, import.meta.url), 'utf8');
}

const overviewTpl = loadTemplate('overview.html');
const detailTpl = loadTemplate('detail.html');

const fullRecord = {
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
  tsunami: '1',
  status: 'reviewed',
  updated: 1784490716284,
  description: 'Magnitude 5.5 earthquake, 81 km SW of Puerto Madero, Mexico, 2026-07-19 17:45 UTC.',
};

const minimalRecord = {
  id: 'us7000t1py',
  path: '/extras/usgs-quakes/us7000t1py',
  title: 'M 5.3',
  mag: '5.3',
  magClass: 'm5',
  magDisplay: '5.3 (mb)',
  place: null,
  timeISO: '2026-07-19T00:39:39.917Z',
  timeUTC: '2026-07-19 00:39 UTC',
  coords: '51.39°N, 159.61°E',
  lat: '51.3859',
  lon: '159.6116',
  depthKm: '10 km',
  usgsUrl: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000t1py',
  alert: null,
  felt: null,
  tsunami: null,
  status: 'reviewed',
  updated: 1784422600040,
  description: 'Magnitude 5.3 earthquake, 2026-07-19 00:39 UTC.',
};

const feedView = {
  generated: '2026-07-20T00:00:00.000Z',
  minMagnitude: '5.2',
  windowDays: '30',
  count: 2,
  data: [fullRecord, minimalRecord],
};

describe('overview template', () => {
  const html = Mustache.render(overviewTpl, feedView);

  it('lists every quake with an unescaped path href', () => {
    expect(html).toContain('href="/extras/usgs-quakes/us7000t1tp"');
    expect(html).toContain('href="/extras/usgs-quakes/us7000t1py"');
    expect(html).not.toContain('&#x2F;');
  });

  it('renders a magnitude badge, place, and meta line for each row', () => {
    expect(html).toContain('class="quake-mag m5"');
    expect(html).toContain('M 5.5');
    expect(html).toContain('<span class="quake-title">81 km SW of Puerto Madero, Mexico</span>');
    expect(html).toContain('class="quake-meta"');
    expect(html).toContain('2026-07-19 17:45 UTC · 35 km');
  });

  it('shows a placeholder title when a quake has no place', () => {
    expect(html).toContain('Location pending review');
  });

  it('shows the count and the USGS credit line', () => {
    expect(html).toContain('2 quakes');
    expect(html).toContain('U.S. Geological Survey');
  });

  it('emits BYOM structure with the template metadata', () => {
    expect(html.trimStart().startsWith('<head>')).toBe(true);
    expect(html).toContain('<title>');
    expect(html).toContain('<main>');
    expect(html).toContain('<header></header>');
    expect(html).toContain('<footer></footer>');
    expect(html).toContain('<meta name="template" content="usgs-quakes">');
    expect(html).not.toContain('<!doctype');
    expect(html).not.toContain('<html');
  });

  it('leaves no unresolved tags or undefined values', () => {
    expect(html).not.toContain('{{');
    expect(html).not.toContain('undefined');
  });

  it('renders the empty-state fallback when there are no quakes', () => {
    const empty = Mustache.render(overviewTpl, { ...feedView, count: 0, data: [] });
    expect(empty).toContain('No earthquakes in the current window.');
  });
});

describe('detail template', () => {
  it('links back to the overview above the facts', () => {
    const html = Mustache.render(detailTpl, fullRecord);
    expect(html).toContain('class="backlink"');
    expect(html).toContain('href="/extras/usgs-quakes"');
    expect(html).toContain('All recent earthquakes');
  });

  it('renders the quake-map block with coordinate, magnitude, and alert rows', () => {
    const html = Mustache.render(detailTpl, fullRecord);
    expect(html).toContain('class="quake-map"');
    expect(html).toContain('<div>lat</div>');
    expect(html).toContain('<div>14.1592</div>');
    expect(html).toContain('<div>lon</div>');
    expect(html).toContain('<div>-92.9052</div>');
    expect(html).toContain('<div>mag</div>');
    expect(html).toContain('<div>alert</div>');
  });

  it('omits the map alert row when the quake has no alert', () => {
    const html = Mustache.render(detailTpl, minimalRecord);
    expect(html).toContain('class="quake-map"');
    expect(html).toContain('<div>51.3859</div>');
    expect(html).toContain('<div>159.6116</div>');
    expect(html).not.toContain('<div>alert</div>');
  });

  it('renders every conditional row when the record has the data', () => {
    const html = Mustache.render(detailTpl, fullRecord);
    expect(html).toContain('<title>M 5.5 - 81 km SW of Puerto Madero, Mexico</title>');
    expect(html).toContain('Location');
    expect(html).toContain('81 km SW of Puerto Madero, Mexico');
    expect(html).toContain('PAGER alert');
    expect(html).toContain('green');
    expect(html).toContain('Felt');
    expect(html).toContain('1 felt report');
    expect(html).toContain('Tsunami');
    expect(html).toContain('tsunami.gov');
    expect(html).toContain('href="https://earthquake.usgs.gov/earthquakes/eventpage/us7000t1tp"');
    expect(html).toContain('<meta name="template" content="usgs-quakes">');
    expect(html).toContain('U.S. Geological Survey');
    expect(html).not.toContain('{{');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('&#x2F;');
  });

  it('hides conditional rows when the data is null', () => {
    const html = Mustache.render(detailTpl, minimalRecord);
    expect(html).not.toContain('Location');
    expect(html).not.toContain('PAGER alert');
    expect(html).not.toContain('Felt');
    expect(html).not.toContain('Tsunami');
    expect(html).toContain('Magnitude');
    expect(html).toContain('Coordinates');
    expect(html).toContain('Depth');
    expect(html).toContain('Status');
  });

  it('emits BYOM structure with the template metadata', () => {
    const html = Mustache.render(detailTpl, minimalRecord);
    expect(html.trimStart().startsWith('<head>')).toBe(true);
    expect(html).toContain('<body>');
    expect(html).toContain('<main>');
    expect(html).toContain('<header></header>');
    expect(html).toContain('<footer></footer>');
    expect(html).not.toContain('<!doctype');
    expect(html).not.toContain('<html');
  });
});

describe('escaping', () => {
  const nasty = {
    ...fullRecord,
    title: 'M 5.0 - A & B <script>',
    place: 'A & B <script>',
  };

  it('escapes HTML-special characters in the detail template', () => {
    const html = Mustache.render(detailTpl, nasty);
    expect(html).toContain('A &amp; B &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('escapes HTML-special characters in the overview template', () => {
    const html = Mustache.render(overviewTpl, { ...feedView, data: [nasty] });
    expect(html).toContain('A &amp; B &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
