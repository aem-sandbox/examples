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

## Dependency: Section Metadata

This block depends on `decorateSectionMetadata` in `scripts/scripts.js`, which reads each section's `Section Metadata` block and applies its rows to the section: a `Style` row becomes one or more classes, every other row (including `Tab Id`/`Tab Title`) becomes a `data-*` attribute. Without it, `Tab Id`/`Tab Title` are never applied to the section and the block renders nothing (see Implementation Notes).

## Implementation Notes

- `blocks/tabs/tabs.js` exports a default `decorate(block)`, run automatically like any other block, plus a `createTabs(main)` function that scans an entire page for `data-tab-id` sections and builds tab groups without needing a placed `Tabs` block. `createTabs` is currently unused; nothing in `scripts.js` calls it, so tab groups must be authored with an explicit `Tabs` block per the content model above.
- `blocks/tabs/tabs.css` styles the tab list, the active-tab underline, and default content shown above the tabs (`.section.tabs > .default-content-wrapper`).
