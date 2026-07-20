// quake-map block: a static OpenStreetMap tile mosaic centered on a quake.
// The pure geometry is exported for unit tests; decorate runs only in the browser,
// so aem.js (which needs window) is pulled in with a dynamic import.

const TILE = 256;
const REF_WIDTH = 640;
const SPAN_M = 804672; // ~500 miles across the reference width
const MPP_ZERO = 156543.03392; // web-mercator meters per pixel at the equator, zoom 0

const ALERT_COLORS = {
  green: '#2e7d32',
  yellow: '#f9a825',
  orange: '#ef6c00',
  red: '#c62828',
};
const DEFAULT_COLOR = '#b02a30';
const RING_OPACITY = [0.9, 0.55, 0.3];

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Ring radii in pixels for the magnitude marker, largest last.
 * @param {number} mag earthquake magnitude
 * @returns {number[]} three increasing radii
 */
export function ringRadii(mag) {
  const base = 12 + 10 * clamp(mag - 4, 0.5, 4);
  return [0.45, 0.75, 1].map((factor) => base * factor);
}

/**
 * Computes the zoom, the 3x2 tile mosaic, and the quake's pixel offset within it.
 * @param {number} lat latitude in degrees
 * @param {number} lon longitude in degrees
 * @param {number} [widthPx] reference width used to pick the zoom
 * @returns {{z: number, tiles: object[], originPx: {x: number, y: number}}} mosaic geometry
 */
export function mapGeometry(lat, lon, widthPx = REF_WIDTH) {
  const latRad = toRad(lat);
  const z = clamp(
    Math.round(Math.log2((MPP_ZERO * Math.cos(latRad) * widthPx) / SPAN_M)),
    4,
    9,
  );
  const n = 2 ** z;
  const xf = ((lon + 180) / 360) * n;
  const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const xc = Math.floor(xf);
  const yc = Math.floor(yf);
  const cols = [xc - 1, xc, xc + 1];
  const rows = yf - yc < 0.5 ? [yc - 1, yc] : [yc, yc + 1];
  const wrapX = (x) => ((x % n) + n) % n;
  const clampY = (y) => clamp(y, 0, n - 1);
  const tiles = [];
  rows.forEach((ty) => {
    const y = clampY(ty);
    cols.forEach((tx) => {
      const x = wrapX(tx);
      tiles.push({ x, y, url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png` });
    });
  });
  const originPx = {
    x: (xf - (xc - 1)) * TILE,
    y: (yf - clampY(rows[0])) * TILE,
  };
  return { z, tiles, originPx };
}

function tilesMarkup(tiles) {
  return tiles
    .map((t) => `<img src="${t.url}" alt="" width="${TILE}" height="${TILE}" loading="lazy" draggable="false">`)
    .join('');
}

function markerMarkup(mag, color) {
  const radii = ringRadii(mag);
  const size = (radii[radii.length - 1] + 2) * 2;
  const c = size / 2;
  const rings = radii
    .map((r, i) => `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="${RING_OPACITY[i]}"></circle>`)
    .join('');
  return `<svg class="quake-map-marker" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${rings}<circle cx="${c}" cy="${c}" r="4" fill="${color}"></circle></svg>`;
}

/**
 * Loads and decorates the block: reads lat/lon/mag/alert rows, then renders a
 * static tile mosaic with a magnitude marker centered on the quake.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const { readBlockConfig } = await import('../../scripts/aem.js');
  const config = readBlockConfig(block);
  const lat = Number(config.lat);
  const lon = Number(config.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    block.remove();
    return;
  }

  const mag = Number(config.mag) || 0;
  const color = ALERT_COLORS[config.alert] || DEFAULT_COLOR;
  const { tiles, originPx } = mapGeometry(lat, lon);
  const offset = `translate(${Math.round(-originPx.x)}px, ${Math.round(-originPx.y)}px)`;
  const credit = '<div class="quake-map-credit">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors</div>';

  block.innerHTML = `<div class="quake-map-tiles" style="transform: ${offset}">${tilesMarkup(tiles)}</div>${markerMarkup(mag, color)}${credit}`;
  block.setAttribute('role', 'img');
  block.setAttribute('aria-label', `Map: M ${config.mag} earthquake location`);
}
