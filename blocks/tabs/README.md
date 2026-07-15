# Tabs

Converts a group of page sections into a tabbed interface. Unlike most blocks, the content isn't authored inside the block itself: it comes from the sections that follow it.

## Content Model

There are two ways to build a tab group. Both use the same `Tab Id` (required) / `Tab Title` (optional, defaults to `Tab Id`) metadata on each tab's section.

### Explicit `Tabs` block

1. **A `Tabs` block**, placed in its own section. This section becomes the tab list. Any default content authored in this section (a heading, an intro paragraph) renders above the tabs.
2. **One or more sections immediately after it**, each carrying a `Section Metadata` block with `Tab Id`/`Tab Title`. Each of these sections becomes one tab's panel content.

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

The block only collects sections that are directly, consecutively adjacent to it: the first section without a `Tab Id` ends the group, and everything after that renders normally, outside the tabs. A page can have several independent tab groups this way, each behind its own `Tabs` block.

### Automatic, no block needed

Tag any sections anywhere on the page with `Section Metadata` (`Tab Id`/`Tab Title`) and skip the `Tabs` block entirely. `createTabs` (`blocks/tabs/tabs.js`, invoked from `blocks/dynamic/index.js` after the page's sections finish loading, and again after fragment/modal content is injected) finds every tagged section not already inside a tab group and combines all of them into a single tab group, inserted before the first one.

This only ever produces one page-wide group, and it appears slightly after initial section load rather than synchronously, so prefer the explicit `Tabs` block when a page needs more than one tab group or content shouldn't visibly reflow after load.

## Section Metadata

`Tab Id`/`Tab Title` reach the section as `data-tab-id`/`data-tab-title` through the standard Edge Delivery Services rendering pipeline: it converts a `Section Metadata` block's rows into `data-*` attributes on the section (a `Style` row becomes classes instead) before the page is served, and removes the block. No project code is involved. This only happens for content that goes through the real preview/publish pipeline, so a static local test fixture (e.g. an `.plain.html` file served via `--html-folder`) won't show this conversion and will render the metadata block as literal text instead.
