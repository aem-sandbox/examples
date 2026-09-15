# Structured Content: a promotion

A second schema on the same `da-sc` delivery worker as the [product catalog](../README.md), read
by [`blocks/promo`](../../../blocks/promo) instead of a record's own markup.

Unlike the `product` block, `promo` doesn't decorate a record page in place. Its only authored
content is a URL to a `da-sc` record — e.g.
`https://da-sc.adobeaem.workers.dev/live/aem-sandbox/examples/forms/sc/promotions/summer-sale` —
and it fetches that URL client-side, so the same promotion can be dropped into any page as a
dismissible banner.

## What is here

| File | What it is |
| --- | --- |
| [`promotion.schema.json`](promotion.schema.json) | The `Promotion` schema. |
| [`delivery-response.json`](delivery-response.json) | A live response from the `da-sc` worker, for the `summer-sale` record. |

Neither is loaded by the site. Reference copies only, same as the product example.

## Gotcha

`active: false` should hide the promotion, but the block has no way to know that without fetching
first — so a promo always does one round trip before it can decide to render nothing.
