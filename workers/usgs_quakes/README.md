# USGS Quakes Worker

Serves a preformatted earthquake feed for the json2html dynamic-pages pattern and keeps the
generated pages published on a schedule.

## Endpoint

`GET /` returns JSON: `{ generated, minMagnitude, windowDays, count, data: [record, ...] }`.
json2html consumes this server-side to render the overview and per-quake detail pages. Every
other path returns 404, and non-GET returns 405. No CORS headers (server-side consumers only).

The worker runs at `https://examples-bbird-usgs-quakes.aem-poc-lab.workers.dev`. It has no route
on `examples.bbird.live`; that host is owned by the cdn worker.

## Data

Source is the USGS FDSN event query (`earthquake.usgs.gov`), magnitude `MIN_MAGNITUDE`+ over the
last `WINDOW_DAYS` days. Each record is preformatted for Mustache: title, coordinates, depth,
time, felt, alert, tsunami, status, and a site-relative `path` (`/extras/usgs-quakes/{id}`).

## Schedule

Cron `17 * * * *` (hourly). Each run refetches the feed, diffs it against KV state, then previews
and publishes the added or changed detail pages followed by the overview. A quake that falls out
of the window stays published; its id is dropped from state, not unpublished.

## Config

| Var | Default | Meaning |
|-----|---------|---------|
| `MIN_MAGNITUDE` | `5.2` | Minimum magnitude |
| `WINDOW_DAYS` | `30` | Query window in days |
| `SITE_ORG` | `aem-sandbox` | Helix admin org |
| `SITE_SITE` | `examples` | Helix admin site |
| `SITE_BRANCH` | `main` | Helix admin branch |

Secret: `ADMIN_API_KEY`, the Helix admin API key used for preview and publish. Keep it out of
`wrangler.toml`. KV binding `QUAKES_KV` holds the publish state at key `state`. Set its namespace
id in `wrangler.toml` before the first deploy.

## Local dev

```bash
npm install --prefix ./workers/usgs_quakes
npm test --prefix ./workers/usgs_quakes
npx wrangler dev --config ./workers/usgs_quakes/wrangler.toml
```
