# Dynamic Cards

## Overview

Dynamic Cards is a block that renders a list of cards whose content is resolved at render time from `query-index.json`, rather than typed in by an author. It replaces two blocks from the `scdemos/demo` reference site — a query-driven `cards` variant and a standalone `related-articles` block — with a single block covering both of their content-selection modes and four layout styles.

Authors use it to build "related content," "latest articles," or hand-picked promotional rails without maintaining the card contents by hand every time content changes.

## The Challenge

Two different blocks in the reference site solved the same underlying problem — showing a list of cards driven by site content instead of authored copy — with overlapping but inconsistent content models and duplicated fetch/matching/pagination logic. Each variant baked in one visual treatment (grid, slider, or bento), so an author who wanted a different layout for the same content mode was out of luck, and any fix to the query-matching logic had to be made in two places.

## The Pattern

Dynamic Cards separates **where the content comes from** from **how it's displayed**, so either can be chosen independently:

- **Content mode** is inferred from what the author puts in the block:
  - A plain list of links selects specific pages (curated mode).
  - A key/value config table (`keywords`, `excluded keywords`, `limit`) selects pages by matching against the `keywords` column in `query-index.json`, or pulls the most recent/random pages site-wide.
- **Layout** is chosen with a block variant class — `carousel`, `bento`, or `slider` — applied on top of either content mode.

At render time, the block pages through `query-index.json` (500 rows at a time) to resolve either the authored links or the keyword match, applies the appropriate card markup for the chosen layout, and replaces its own content. Pages missing a `title`, or flagged `noindex` in their `robots` column, are skipped automatically. If the fetch fails or nothing matches, the block renders a plain-text empty state instead of leaving stale or broken markup on the page.

## Content Modes

### Curated links

Author a plain list of links — no config table:

```
| Dynamic Cards |
| -------------- |
| [Getting started](/docs/getting-started) |
| [Advanced configuration](/docs/advanced-config) |
```

Each link's title, description, image, date, and keywords are looked up in `query-index.json` by path; the authored link text is used as a fallback title if the page isn't found in the index.

### Query-driven

Author a two-column config table instead:

| Key | Value |
| --- | --- |
| `keywords` | comma-separated list, or `random` |
| `excluded keywords` | comma-separated list |
| `limit` | number (default `4`) |

```
| Dynamic Cards |
| -------------- |
| keywords | financial-planning, retirement |
| excluded keywords | archived |
| limit | 6 |
```

Omitting `keywords` pulls the most recent pages site-wide. Including `random` (alone or alongside other keywords) shuffles the results instead of sorting by date.

## Layout Variants

| Variant | Class | Description |
| --- | --- | --- |
| Grid | *(default)* | Responsive card grid: image, tag, title, description, date. |
| Carousel | `carousel` | Grid-style cards in a horizontally scrollable strip with prev/next arrows. |
| Bento | `bento` | Asymmetric grid with a larger featured first card; image cards with a gradient text overlay. |
| Slider | `slider` | Image-free cards with a brand-gradient accent strip, in a horizontal scroller. Best for text-forward lists where hero images aren't reliably available. |

Content mode and layout are independent — any combination works.

## Implementation

- [`blocks/dynamic-cards/dynamic-cards.js`](https://github.com/aem-sandbox/examples/blob/main/blocks/dynamic-cards/dynamic-cards.js): reads the block's own content to pick a content mode, pages through `query-index.json` via `scripts/shared.js`'s `fetchQueryIndexPage`, and builds the card markup for the active layout variant.
- [`blocks/dynamic-cards/dynamic-cards.css`](https://github.com/aem-sandbox/examples/blob/main/blocks/dynamic-cards/dynamic-cards.css): styles for all four layout variants, sharing a single horizontal-scroller implementation between `carousel` and `slider`.
- [`blocks/dynamic-cards/README.md`](https://github.com/aem-sandbox/examples/blob/main/blocks/dynamic-cards/README.md): full authoring reference for content modes and variants.

## Configuration

No project-wide configuration is required. Every option is authored per block instance, as described in Content Modes above. The only implicit dependency is `query-index.json` being enabled and up to date for the site — new or recently edited pages won't appear in Dynamic Cards until the index has been re-published.
