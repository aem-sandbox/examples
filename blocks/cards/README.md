# Cards

Renders a list of cards. Content is either authored directly, or resolved at render time from `query-index.json`. Layout is chosen independently via variant classes, and variants combine freely with either content mode.

## Content modes

### Static (default)

Author each card as a row: an image cell (optional) and a body cell (heading, text, links). This is the standard content model — nothing else to configure.

### Dynamic

Add the `dynamic` class. The block then ignores its authored rows for layout and instead pulls cards from `query-index.json`.

**Curated links** — author a plain list of links, no config table:

```
| Cards (dynamic) |
| ---------------- |
| [Getting started](/docs/getting-started) |
| [Advanced configuration](/docs/advanced-config) |
```

Each link's title, description, image, date, and keywords are looked up by path; the authored link text is used as a fallback title if the page isn't found in the index.

**Query match** — author a two-column config table instead:

| Key | Value |
| --- | --- |
| `keywords` | comma-separated list, or `random` |
| `excluded keywords` | comma-separated list |
| `limit` | number (default `5`) |

Omitting `keywords` pulls the most recent pages site-wide. Including `random` (alone or with other keywords) shuffles the results instead of sorting by date. Pages missing a `title`, or flagged `noindex` in `robots`, are skipped automatically. If the fetch fails or nothing matches, the block renders a single "No articles found." / "Unable to load articles right now." message instead of leaving stale markup.

## Layout variants

Add any of these classes on top of either content mode:

| Variant | Class | Description |
| --- | --- | --- |
| Grid | *(default)* | Responsive card grid: image, tag, title, description, date. |
| Carousel | `carousel` | Same cards in a horizontally scrollable strip with prev/next arrows. Arrows auto-hide once all cards fit on screen. |
| Bento | `bento` | Asymmetric grid with the first card larger/featured; image-backed cards with a gradient text overlay. Statically-authored bento cards without a heading get one promoted automatically from a button or sole paragraph. |
| Slider | `slider` | Text-forward variant of the carousel: no images, a brand-gradient accent bar, whole card is a single link. Use for lists where hero images aren't reliably available. |

Variants combine with either content mode, e.g. `cards dynamic bento` or `cards dynamic carousel`.

## Implementation notes

- Dynamic content is rebuilt through the same row/column pipeline as static content (`buildBlock` + the standard image/body decoration), so every layout variant works identically regardless of where the content came from.
- Images are optimized via `createOptimizedPicture`; bento's featured card gets a higher-resolution image (1200px) than the rest (750px). The slider variant never renders images.
- Carousel and slider share one scroller implementation (arrows, scroll-snap, sizing) — only the card markup and a few CSS rules differ between them.
