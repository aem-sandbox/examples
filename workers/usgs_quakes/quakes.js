// Pure reshape and diff logic for the USGS quakes feed. No side effects.
// json2html has no formatting helpers, so every display string is preformatted here.

const USGS_QUERY = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const EVENT_PAGE = 'https://earthquake.usgs.gov/earthquakes/eventpage';
const ID_RE = /^[a-z0-9]{1,64}$/;
const DAY_MS = 86400000;

const DEFAULT_MIN_MAGNITUDE = '5.2';
const DEFAULT_WINDOW_DAYS = '30';

function config(env) {
  return {
    minMagnitude: env.MIN_MAGNITUDE || DEFAULT_MIN_MAGNITUDE,
    windowDays: env.WINDOW_DAYS || DEFAULT_WINDOW_DAYS,
  };
}

export function buildQueryUrl(env, nowMs = Date.now()) {
  const { minMagnitude, windowDays } = config(env);
  const startTime = new Date(nowMs - Number(windowDays) * DAY_MS).toISOString().slice(0, 19);
  return `${USGS_QUERY}?format=geojson&starttime=${startTime}`
    + `&minmagnitude=${minMagnitude}&eventtype=earthquake&orderby=time&limit=400`;
}

export function reshape(feature) {
  const id = feature && feature.id;
  const props = (feature && feature.properties) || {};
  const coordinates = feature && feature.geometry && feature.geometry.coordinates;

  if (!id || !ID_RE.test(id)) return null;
  if (props.mag === null || props.mag === undefined) return null;
  if (!Array.isArray(coordinates) || coordinates.length !== 3) return null;

  const [lon, lat, depth] = coordinates;
  const magFmt = Number(props.mag).toFixed(1);
  const magClass = `m${Math.min(7, Math.max(5, Math.floor(Number(props.mag))))}`;
  const place = props.place || null;
  const timeISO = new Date(props.time).toISOString();
  const timeUTC = `${timeISO.slice(0, 10)} ${timeISO.slice(11, 16)} UTC`;
  const latAbs = Math.abs(lat).toFixed(2);
  const lonAbs = Math.abs(lon).toFixed(2);
  const coords = `${latAbs}°${lat >= 0 ? 'N' : 'S'}, ${lonAbs}°${lon >= 0 ? 'E' : 'W'}`;
  const depthKm = `${Number(Number(depth).toFixed(1))} km`;
  const felt = props.felt
    ? `${Number(props.felt).toLocaleString('en-US')} felt report${props.felt === 1 ? '' : 's'}`
    : null;

  return {
    id,
    path: `/extras/usgs-quakes/${id}`,
    title: place ? `M ${magFmt} - ${place}` : `M ${magFmt}`,
    mag: magFmt,
    magClass,
    magDisplay: `${magFmt} (${props.magType})`,
    place,
    timeISO,
    timeUTC,
    coords,
    lat: String(lat),
    lon: String(lon),
    depthKm,
    usgsUrl: `${EVENT_PAGE}/${id}`,
    alert: props.alert || null,
    felt,
    tsunami: props.tsunami === 1 ? '1' : null,
    status: props.status,
    updated: props.updated,
    description: place
      ? `Magnitude ${magFmt} earthquake, ${place}, ${timeUTC}.`
      : `Magnitude ${magFmt} earthquake, ${timeUTC}.`,
  };
}

export function buildFeed(geojson, env, nowMs = Date.now()) {
  const features = geojson && Array.isArray(geojson.features) ? geojson.features : [];
  const data = features.map(reshape).filter(Boolean);
  const { minMagnitude, windowDays } = config(env);
  return {
    generated: new Date(nowMs).toISOString(),
    minMagnitude,
    windowDays,
    count: data.length,
    data,
  };
}

export function diffState(records, state) {
  const pages = (state && state.pages) || {};
  const currentIds = new Set(records.map((r) => r.id));
  const added = [];
  const changed = [];
  records.forEach((record) => {
    if (!(record.id in pages)) {
      added.push(record);
    } else if (pages[record.id] !== record.updated) {
      changed.push(record);
    }
  });
  const removed = Object.keys(pages).filter((id) => !currentIds.has(id));
  return { added, changed, removed };
}

export function nextState(state, removed, succeeded) {
  const pages = { ...((state && state.pages) || {}) };
  removed.forEach((id) => {
    delete pages[id];
  });
  succeeded.forEach(({ id, updated }) => {
    pages[id] = updated;
  });
  return { pages };
}
