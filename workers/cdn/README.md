# CDN Worker

BYO CDN proxy for AEM Edge Delivery. [Cloudflare setup guide](https://www.aem.live/docs/byo-cdn-cloudflare-worker-setup).

Worker code is based on [aem-cloudflare-prod-worker](https://github.com/adobe/aem-cloudflare-prod-worker).

## Variables

| Name | Value |
|------|--------|
| `ORIGIN_HOSTNAME` | `main--examples--aem-sandbox.aem.live` |
| `PUSH_INVALIDATION` | `enabled` |

## Gated content

`handlers/gating.js` rewrites HTML for pages marked `<meta name="gated" content="true">`, dropping
sections/blocks the visitor's audience can't see. Mirrors the author-preview logic in
`scripts/utils/gated-content.js`, but this is the actual trust boundary — the client-side version
only runs in author/dev environments.

**Auth:** `handlers/auth-check.js` — signed in if **`Cf-Access-*`** headers are set, or if the
**`CF_Authorization`** cookie contains a valid Cloudflare Access JWT. This requires a Cloudflare
Access (Zero Trust) policy in front of whichever routes should require a logged-in user; the
worker only reads whatever Access headers/cookie happen to already be present, it doesn't perform
login itself.

**Skips gating:** `/fragments/`, `/nav.plain.html`, `/footer.plain.html` — otherwise a shared
header/footer pulled into every page could get gated.

**Gated responses:** `Cache-Control: private, no-cache, must-revalidate` and `Vary: Cookie` are set
whenever the gated HTML is actually rewritten per-visitor, so a shared cache never serves one
visitor's personalized HTML to the next.

**Dependencies:** `cheerio` is installed under `workers/cdn/` (not the repo root), and
`compatibility_flags = ["nodejs_compat"]` in `wrangler.toml` is required for it to bundle/run.
Run `npm install` in this directory before `wrangler dev`/`deploy` locally; the `deploy-worker`
GitHub Action does this automatically in CI when a `package.json` is present.

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

Or push to `main` — the `deploy-cdn` GitHub Action deploys when `workers/cdn/**` changes.
