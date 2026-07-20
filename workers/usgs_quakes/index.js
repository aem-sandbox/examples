/* eslint-disable no-await-in-loop, no-console */
import {
  buildQueryUrl, buildFeed, diffState, nextState,
} from './quakes.js';

const ADMIN = 'https://admin.hlx.page';
const OVERVIEW_PATH = '/extras/usgs-quakes';
const MAX_PER_RUN = 200;
const USER_AGENT = 'examples-bbird-usgs-quakes (aem-sandbox/examples showcase)';

function jsonError(status, message, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function fetchUsgs(env) {
  return fetch(buildQueryUrl(env), {
    headers: { 'User-Agent': USER_AGENT },
    cf: { cacheTtl: 60, cacheEverything: true },
    signal: AbortSignal.timeout(9000),
  });
}

function target(env, action, path) {
  const org = env.SITE_ORG || 'aem-sandbox';
  const site = env.SITE_SITE || 'examples';
  const branch = env.SITE_BRANCH || 'main';
  return `${ADMIN}/${action}/${org}/${site}/${branch}${path}`;
}

async function admin(env, action, path) {
  let res;
  try {
    res = await fetch(target(env, action, path), {
      method: 'POST',
      headers: { Authorization: `token ${env.ADMIN_API_KEY}` },
    });
  } catch (err) {
    console.log(`admin ${action} ${path} failed: ${err.message}`);
    return false;
  }
  if (!res.ok) {
    const detail = res.headers.get('x-error') || '';
    console.log(`admin ${action} ${path} failed: ${res.status} ${detail}`);
    return false;
  }
  return true;
}

async function readState(kv) {
  try {
    const raw = await kv.get('state');
    if (!raw) return { pages: {} };
    const parsed = JSON.parse(raw);
    if (parsed && parsed.pages && typeof parsed.pages === 'object') return parsed;
  } catch {
    // fall through to empty state
  }
  return { pages: {} };
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET') {
      return jsonError(405, 'Method not allowed', { Allow: 'GET' });
    }
    if (new URL(request.url).pathname !== '/') {
      return jsonError(404, 'Not found');
    }
    let geojson;
    try {
      const res = await fetchUsgs(env);
      if (!res.ok) return jsonError(404, `USGS query failed: ${res.status}`);
      geojson = await res.json();
    } catch (err) {
      return jsonError(404, `USGS query error: ${err.message}`);
    }
    return new Response(JSON.stringify(buildFeed(geojson, env)), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' },
    });
  },

  async scheduled(event, env) {
    if (!env.ADMIN_API_KEY) {
      console.log('ADMIN_API_KEY not configured, skipping admin calls');
      return;
    }
    let geojson;
    try {
      const res = await fetchUsgs(env);
      if (!res.ok) {
        console.log(`USGS query failed: ${res.status}, skipping run`);
        return;
      }
      geojson = await res.json();
    } catch (err) {
      console.log(`USGS query error: ${err.message}, skipping run`);
      return;
    }

    const records = buildFeed(geojson, env).data;
    const state = await readState(env.QUAKES_KV);
    const { added, changed, removed } = diffState(records, state);

    if (removed.length) {
      console.log(`removed from window, kept published: ${removed.join(',')}`);
    }
    if (!added.length && !changed.length && !removed.length) {
      return;
    }

    let work = [...added, ...changed];
    if (work.length > MAX_PER_RUN) {
      console.log(`clipping to ${MAX_PER_RUN} of ${work.length} changed pages`);
      work = work.slice(0, MAX_PER_RUN);
    }

    const succeeded = [];
    for (let i = 0; i < work.length; i += 1) {
      const record = work[i];
      if (await admin(env, 'preview', record.path)) {
        if (await admin(env, 'live', record.path)) {
          succeeded.push({ id: record.id, updated: record.updated });
        }
      }
    }

    if (await admin(env, 'preview', OVERVIEW_PATH)) {
      await admin(env, 'live', OVERVIEW_PATH);
    } else {
      console.log('overview preview failed, live overview not refreshed');
    }

    await env.QUAKES_KV.put('state', JSON.stringify(nextState(state, removed, succeeded)));
  },
};
