# JSON2HTML: pages generated from a JSON feed

The artifacts behind the how-to at `aem.live/examples/how-to-use-json2html`. Three showcases run
on this site: [examples.bbird.live/events](https://examples.bbird.live/events) from an authored
spreadsheet, [examples.bbird.live/extras/usgs-quakes](https://examples.bbird.live/extras/usgs-quakes)
from a live USGS API through a worker, and
[examples.bbird.live/products/product-detail](https://examples.bbird.live/products/product-detail)
from another authored spreadsheet standing in for a product catalog API.

A JSON2HTML rule matches a request path, fetches JSON from an endpoint, and renders it through a
Mustache template. The result enters the normal preview and publish pipeline, so a generated page
is a real published page.

## The config

| File | What it is |
| --- | --- |
| [`events-rules.json`](events-rules.json) | The events rule. Mode B: one feed, `pathKey` selects the row. |
| [`usgs-quakes-rules.json`](usgs-quakes-rules.json) | Two rules against one endpoint. The detail rule selects a row; the overview rule passes the whole response. Order matters, since `/extras/usgs-quakes/` and `/extras/usgs-quakes` both match a detail path prefix. |
| [`content-fragment-rule.json`](content-fragment-rule.json) | Mode A against an AEM Content Fragment GraphQL endpoint, with `{{id}}` pulled from the URL. Illustrative, not deployed here. |
| [`product-detail-rules.json`](product-detail-rules.json) | The product catalog rule. Mode B: one feed, `pathKey` selects the row. The configured endpoint here is an EDS spreadsheet (`data.json`), standing in for a product catalog — the same rule shape works unchanged against a real third-party REST API. |

Both deployed files are copies of the live config, verified against
`GET https://json2html.adobeaem.workers.dev/config/aem-sandbox/examples/main`.

## The data

| File | What it is |
| --- | --- |
| [`events-data-sample.json`](events-data-sample.json) | One row of `/events-data.json`, the authored spreadsheet behind the events pages. |
| [`usgs-quake-record.json`](usgs-quake-record.json) | One record from the USGS worker. Every value a template needs is preformatted here, because Mustache cannot format. |
| [`product-detail-data-sample.json`](product-detail-data-sample.json) | One row of `/products/product-detail/data.json`, the spreadsheet standing in for a product catalog feed. |

## The templates

| Template | What it does |
| --- | --- |
| [`templates/events/events.html`](../../templates/events/events.html) | One event page. Hero, section metadata, a `columns` block of conditional rows, a CTA with an inverted-section default. |
| [`templates/usgs-quakes/detail.html`](../../templates/usgs-quakes/detail.html) | One quake page, including the `quake-map` block table the client-side block decorates. |
| [`templates/usgs-quakes/overview.html`](../../templates/usgs-quakes/overview.html) | The list. Iterates `{{#data}}` and handles the empty feed with `{{^data}}`. |
| [`templates/products/product-detail.html`](../../templates/products/product-detail.html) | One product page. SEO metadata and JSON-LD `Product` schema in `<head>`, then flat row-based markup for the `product-detail` block to decorate. Feeds the `sku` field that [`how-to-use-structured-content/product-collection`](../how-to-use-structured-content/product-collection) resolves against. |

The worker is [`workers/usgs_quakes`](../../workers/usgs_quakes), with its tests.

## Two things that bite

- **Mustache formats nothing.** Shape the JSON upstream. The worker sends `magDisplay`,
  `timeUTC`, `depthKm` and `coords` as display strings for exactly this reason.
- **A field can be missing.** `place` is absent on a fresh USGS record, so the overview template
  uses `{{#place}}...{{/place}}{{^place}}Location pending review{{/place}}` rather than a bare
  `{{place}}`.
