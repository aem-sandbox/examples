# CDN Worker

BYO CDN proxy for AEM Edge Delivery. [Cloudflare setup guide](https://www.aem.live/docs/byo-cdn-cloudflare-worker-setup).

Worker code is based on [aem-cloudflare-prod-worker](https://github.com/adobe/aem-cloudflare-prod-worker).

## Variables

| Name | Value |
|------|--------|
| `ORIGIN_HOSTNAME` | `main--examples--aem-sandbox.aem.live` |
| `PUSH_INVALIDATION` | `enabled` |

## Auth-aware sections

`handlers/gating.js` rewrites HTML for pages marked `<meta name="gated" content="true">`, dropping
sections/blocks the visitor's audience can't see. The author-preview logic in
`scripts/utils/gated-content.js` applies the same rules: a removed section removes its descendants,
and block rules still apply within retained sections. Only exact `logged-in` and `logged-out` class
tokens are audience variants. A block carrying both is hidden from both audiences.

This personalizes a public page; it does not protect the origin, downloads, or alternate
representations such as `.plain.html`, `.md`, and `.json`. The html2json fallback remains a separate,
public delivery path. `gated: true` enables filtering, not a whole-page authorization policy.

**Auth:** `handlers/auth-check.js` verifies the HMAC signature and expiry of the
`bbird_demo_session` cookie created by the demo login worker. Its signing key is intentionally
public, and the user chooses the display name, so the cookie provides no identity or authorization
assurance and must not be used to protect confidential content. The CDN keeps this cookie local to
the audience check rather than forwarding it to the content origin; unrelated cookies are preserved.

**Skips gating:** `/fragments/`, `/nav.plain.html`, `/footer.plain.html`, and the alternate
representations above. These are public demo exclusions, not suitable locations for confidential
content. Hiding a link to one of them does not protect its response.

**Gated responses:** `Cache-Control: private, no-store` is set for both audiences, including when a
page contains no blocks to remove. Origin validators, range/length/encoding metadata, expiry and
CDN-specific shared-cache directives are removed. The worker does not issue audience ETags or rely
on `Vary: Cookie`. The complete source can still use the origin/subrequest cache; transformed output
must not enter a shared cache. Production cache rules must honor that separation.

**Partial and conditional requests:** ordinary full HTML GETs need one origin fetch. An HTML,
untyped, or multipart `206`, `304`, or successful `HEAD` cannot establish whether the full page is
gated. The worker fetches an unconditional full GET, without range or conditional headers, to
classify the representation and check HTML metadata:

- Gated GETs return full, filtered `200` responses, including for old validators and Range requests.
- Gated HEADs return `200` with the same non-cacheable policy and no body.
- Ungated pages retain the original partial/conditional response and its representation headers.
- A complete non-HTML probe preserves the original response unless the original explicitly claimed
  to be HTML. Failed, unreadable or inconsistently typed checks return a non-cacheable `502`, not
  unclassified content. A HEAD error has no body. Discarded response streams are cancelled.

This can add an origin/subrequest-cache lookup for ambiguous responses. It does not eliminate
origin fetches. Ranges/HEADs with a known non-HTML media type and explicitly excluded representations
do not need the HTML check.

**Dependencies:** `cheerio` is installed under `workers/cdn/` (not the repo root), and
`compatibility_flags = ["nodejs_compat"]` in `wrangler.toml` is required for it to bundle/run.
Run `npm install` in this directory before `wrangler dev`/`deploy` locally; the `deploy-worker`
GitHub Action does this automatically in CI when a `package.json` is present.

## Tests

```bash
npm ci --prefix ./workers/cdn
npm test --prefix ./workers/cdn
npm ci --prefix ./test
npm test --prefix ./test
```

The worker suite covers the full CDN entry point, including partial/conditional responses, HEAD,
upstream cookies, error handling, and public passthrough. The edge and author-preview tests share
`test/fixtures/gated-content.js` to check the same audience rules.

## Local dev

```bash
npm install --prefix ./workers/cdn
npx wrangler dev --config ./workers/cdn/wrangler.toml
```

## Deploy

```bash
npm install --prefix ./workers/cdn
npx wrangler deploy --config ./workers/cdn/wrangler.toml
```

Or push to `main` — the `deploy-cdn` GitHub Action deploys when CDN JavaScript/configuration or
`workers/shared/**/*.js` changes. A feature-branch push does not deploy the production worker.
