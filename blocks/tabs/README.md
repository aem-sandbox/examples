# Tabs

Converts a group of page sections into a tabbed interface. Unlike most blocks, the content isn't authored inside the block itself: it comes from the sections that follow it.

## Content Model

Authoring a tab group takes two pieces:

1. **A `Tabs` block**, placed in its own section. This section becomes the tab list. Any default content authored in this section (a heading, an intro paragraph) renders above the tabs.
2. **One or more sections immediately after it**, each carrying a `Section Metadata` block with a `Tab Id` (required) and an optional `Tab Title` (defaults to the `Tab Id`). Each of these sections becomes one tab's panel content.

```
| Tabs |
| ---- |
```

```
| Section Metadata |            |
| ----------------- | ---------- |
| Tab Id             | overview   |
| Tab Title          | Overview   |
```

The block only collects sections that are directly, consecutively adjacent to it: the first section without a `Tab Id` ends the group, and everything after that renders normally, outside the tabs.

## Behavior

- Clicking a tab shows its panel, updates the URL hash to the tab's ID via `pushState` (no page reload), and scrolls the tab button into view if the tab list is scrolled.
- Loading a page with a matching hash (e.g. `#pricing`) selects that tab on load and scrolls it into view, so tabs are deep-linkable and shareable.
- Tab buttons and panels carry the standard `tablist`/`tab`/`tabpanel` ARIA roles.

## Section Metadata

`Tab Id`/`Tab Title` reach the section as `data-tab-id`/`data-tab-title` through the standard Edge Delivery Services rendering pipeline: it converts a `Section Metadata` block's rows into `data-*` attributes on the section (a `Style` row becomes classes instead) before the page is served, and removes the block. No project code is involved. This only happens for content that goes through the real preview/publish pipeline, so a static local test fixture (e.g. an `.plain.html` file served via `--html-folder`) won't show this conversion and will render the metadata block as literal text instead.

## Implementation Notes

- `blocks/tabs/tabs.js` exports a default `decorate(block)`, run automatically like any other block, plus a `createTabs(main)` function that scans an entire page for `data-tab-id` sections and builds tab groups without needing a placed `Tabs` block. `createTabs` is currently unused; nothing in `scripts.js` calls it, so tab groups must be authored with an explicit `Tabs` block per the content model above.
- `blocks/tabs/tabs.css` styles the tab list, the active-tab underline, and default content shown above the tabs (`.section.tabs > .default-content-wrapper`).
