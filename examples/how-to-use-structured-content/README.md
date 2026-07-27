# Structured Content: a product catalog

The artifacts behind the how-to at `aem.live/examples/how-to-use-structured-content`.
Live demo: [examples.bbird.live/products](https://examples.bbird.live/products), with a page per
record at `/products/<slug>`.

Authors fill a schema-generated form in Document Authoring instead of a free document. Each save
is a record, and the record is a page. Three readers work off that one save: the query index for
the list, the record's own markup for the detail page, and the `da-sc` delivery worker for
consumers outside Edge Delivery.

## What is here

| File | What it is |
| --- | --- |
| [`product.schema.json`](product.schema.json) | The `Product` schema. Author it in the [Schema Editor](https://da.live/apps/schema); it is stored at `/<ORG>/<SITE>/.da/forms/schemas/product`. |
| [`query.yaml`](query.yaml) | The index definition that feeds `/products-index.json`. Apply it with the Admin API or the Index Admin tool. |
| [`record-page.html`](record-page.html) | What a record serves, trimmed. This is the markup the index selectors and the detail block read. |
| [`delivery-response.json`](delivery-response.json) | A live response from the `da-sc` worker, for one record. |

None of these is loaded by the site. They are reference copies of configuration that lives in DA
and in the AEM Config Service.

## The code

| Block | What it does |
| --- | --- |
| [`blocks/products`](../../blocks/products) | The `/products` listing. Reads `/products-index.json`, renders a filterable, sortable grid. |
| [`blocks/product`](../../blocks/product) | The detail page. Decorates the record's own markup in place, resolving `self://` refs to sibling blocks. Fetches nothing. |

Tests for both are in [`test/`](../../test).

## Three things that bite

- **Heading ids are the property key lowercased**, and de-duplicated across the document. So
  `weightKg` becomes `id="weightkg"`, and a second `label` row becomes `label-1`. Read a field's
  key from the label cell text, not the id.
- **Arrays of objects are not inline.** The parent cell holds `self://#specs-wuvstu` refs, and
  each ref names a sibling block's class. `getElementById` returns null.
- **Booleans are the strings** `true` **and** `false` in the markup. `if (value)` is true for both.
