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

## Section Metadata

`Tab Id`/`Tab Title` reach the section as `data-tab-id`/`data-tab-title` through the standard Edge Delivery Services rendering pipeline: it converts a `Section Metadata` block's rows into `data-*` attributes on the section (a `Style` row becomes classes instead) before the page is served, and removes the block. No project code is involved. This only happens for content that goes through the real preview/publish pipeline, so a static local test fixture (e.g. an `.plain.html` file served via `--html-folder`) won't show this conversion and will render the metadata block as literal text instead.
