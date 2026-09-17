# CDN Worker

BYO CDN proxy for AEM Edge Delivery. [Cloudflare setup guide](https://www.aem.live/docs/byo-cdn-cloudflare-worker-setup).

Worker code is based on [aem-cloudflare-prod-worker](https://github.com/adobe/aem-cloudflare-prod-worker).

## Variables

| Name | Value |
|------|--------|
| `ORIGIN_HOSTNAME` | `main--examples--aem-sandbox.aem.live` |
| `PUSH_INVALIDATION` | `enabled` |
| `GATED_CACHE_PATHS` | `/gated-content` |

## Auth-aware sections

`handlers/gating.js` rewrites HTML for pages marked `<meta name="gated" content="true">`, dropping
sections/blocks the visitor's audience can't see. Mirrors the author-preview logic in
`scripts/utils/gated-content.js`.

Block variants must match `logged-in` or `logged-out` exactly. Both variants, or neither, allow
either audience. Removing a section or block removes everything inside it. Blocks inside a section
the worker keeps still follow their own audience rules.

**Auth:** `handlers/auth-check.js` verifies the HMAC signature and expiry of the
`bbird_demo_session` cookie created by the demo login worker. Its signing key is intentionally
public, so it must not protect confidential content. The worker removes this cookie before
forwarding requests to the origin.

**Skips gating:** `/fragments/`, `/nav.plain.html`, `/footer.plain.html`, and `.plain.html`, `.md`
and `.json` responses. The origin, downloads and html2json fallback are also outside this filter.

## Caching

**Cache selection:** For paths listed in `GATED_CACHE_PATHS`, the default entrypoint checks the
session before calling the cached `Anonymous` entrypoint. Valid sessions and requests with
`Authorization` bypass it. Anonymous requests have no cookies, so analytics cookies don't split
the cache. The cache key uses the scheme, host and path. Other paths keep their cookie handling.

**Gated responses:** Cloudflare's managed Workers Cache stores filtered anonymous HTML for up to
60 seconds, or less if the origin's remaining cache lifetime is shorter.

- Browsers get `Cache-Control: no-cache` and `Vary: Accept, Cookie` to recheck after login or logout.
- Cloudflare gets `Cloudflare-CDN-Cache-Control: public, max-age=<ttl>, must-revalidate`.
- Signed-in responses get `Cache-Control: private, no-store`.

Anonymous HTML is also private and uncacheable if the origin sends `Set-Cookie`, `Vary: *`,
`private`, `no-cache` or `no-store`, or has no valid cache lifetime left. The `Anonymous` entrypoint
doesn't cache ungated pages or errors.

Rewritten responses replace origin cache headers and drop validators, range, length and encoding
headers. The origin cache can still store the full source.

**Invalidation:** AEM push invalidation clears Cloudflare's zone cache, not Workers Cache. Published
changes, deletions and audience changes can take up to 60 seconds to appear. Expired responses aren't
served. Code deployments start with a new cache.

## Partial and conditional requests

A `206`, `304` or `HEAD` response may lack the metadata needed to check gating. If it could be HTML,
the worker fetches the full response without range or conditional headers before filtering it.
Normal HTML GETs need one fetch; this check can need another.

- Gated GETs return full, filtered `200` responses. HEADs use the same cache policy, with no body.
- Ungated pages keep the original response and headers.
- If the full response isn't HTML, keep the original unless the original is HTML.
- Failed checks or conflicting content types return an uncacheable `502`. HEAD errors have no body.

## Local dev

**Dependencies:** `cheerio` is installed under `workers/cdn/` (not the repo root), and
`compatibility_flags = ["nodejs_compat"]` in `wrangler.toml` is required for it to bundle and run.
This cache setup needs Wrangler 4.107.0 or newer; CI uses 4.131.2 and installs dependencies automatically.

```bash
npm install --prefix ./workers/cdn
npx wrangler dev --config ./workers/cdn/wrangler.toml
```

## Tests

```bash
npm ci --prefix ./workers/cdn
npm test --prefix ./workers/cdn
npm ci --prefix ./test
npm test --prefix ./test
```

The CDN and author-preview tests share audience fixtures. Cache tests use a local mock; checking
Cloudflare's cache needs a deployed Worker. See [local smoke tests](../../test/gating-local/README.md)
for workerd and browser checks.

## Deploy

```bash
npm install --prefix ./workers/cdn
npx wrangler deploy --config ./workers/cdn/wrangler.toml
```

Or push to `main`. The `deploy-cdn` GitHub Action deploys when CDN JavaScript/configuration or
`workers/shared/**/*.js` changes. A feature-branch push does not deploy the production worker.
