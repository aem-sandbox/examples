# Dynamic Cards

Renders a card list whose content is resolved at render time from `query-index.json`, instead of being typed in by hand. It replaces two blocks from the `scdemos/demo` reference site — a query-driven `cards` variant and a standalone `related-articles` block — with a single block that covers both content-selection modes and four layout styles.

## Content modes

The block reads its own content to decide how to find pages. Pick one per block instance.

### Curated links

Author a plain list of links to specific pages — no config table. The block resolves each link's title, description, image, date, and keywords from `query-index.json`, falling back to the authored link text if a page isn't found in the index.

```
| Dynamic Cards |
| -------------- |
| [Getting started](/docs/getting-started) |
| [Advanced configuration](/docs/advanced-config) |
```

Use this when an author wants to hand-pick which pages appear, in a specific order.

### Query-driven

Author a two-column config table instead of links. Any row can be omitted.

| Key | Value | Description |
| --- | --- | --- |
| `keywords` | comma-separated list, or `random` | Pages are matched by keyword overlap with the `keywords` column in `query-index.json`. Use `random` (alone or mixed with other keywords) to select from the full index instead of filtering. Omit entirely to pull the most recent pages site-wide. |
| `excluded keywords` | comma-separated list | Pages matching any of these keywords are dropped, even if they also match `keywords`. |
| `limit` | number | Maximum number of cards to render. Defaults to `4`. |

```
| Dynamic Cards |
| -------------- |
| keywords | financial-planning, retirement |
| excluded keywords | archived |
| limit | 6 |
```

Results are sorted newest-first unless `random` is requested or more than one keyword is given (both shuffle the results). Pages missing a `title`, or whose `robots` column contains `noindex`, are excluded automatically.

## Layout variants

Add one of these classes to the block (via the block name cell, e.g. `Dynamic Cards (bento)`):

| Variant | Class | Description |
| --- | --- | --- |
| Grid | *(default)* | Responsive card grid: image on top, tag/title/description/date below. 1 column on mobile, 2 at 600px, 4 at 900px. |
| Carousel | `carousel` | Same card styling as the grid, in a horizontally scrollable strip with prev/next arrow controls. Arrows auto-hide when all cards fit on screen. |
| Bento | `bento` | Asymmetric grid with the first result rendered as a larger featured card; image-backed cards with a gradient text overlay. 1 column on mobile, 2 at 600px, 3 at 900px (with the featured card spanning full width). |
| Slider | `slider` | Lightweight, image-free cards with a brand-gradient accent strip, in a horizontally scrollable strip with the same arrow controls as carousel. Best for text-forward lists (article roundups, related reading) where hero images aren't reliably available. |

Layout and content mode are independent — any content mode works with any layout.

## Empty and error states

- No matching pages: renders a single "No content found." message in place of the card list.
- `query-index.json` fetch fails: renders "Unable to load content right now." and logs nothing further (the block degrades silently rather than breaking the page).

## Implementation notes

- Card data always comes from `query-index.json`; the block never renders content that isn't indexed. New or recently edited pages may take a moment to appear if the index hasn't been re-published.
- Images are optimized via `createOptimizedPicture` (750px width) for the grid, carousel, and bento variants. The slider variant never renders images.
- The carousel and slider scrollers share the same prev/next control implementation (`decorateScroller` in `dynamic-cards.js`); only the card markup and CSS differ between them.
