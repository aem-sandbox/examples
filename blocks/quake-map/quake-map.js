// quake-map block: a static OpenStreetMap tile mosaic centered on a quake.
// The pure geometry is exported for unit tests; decorate runs only in the browser.

export function ringRadii() {
  return [];
}

export function mapGeometry() {
  return { z: 0, tiles: [], originPx: { x: 0, y: 0 } };
}

export default function decorate() {
  // no-op until the block is implemented
}
