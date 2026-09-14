# Local auth/CDN smoke test

Runs the auth and CDN worker handlers together in local workerd. The adapter only removes the
local HTTP port from CDN requests (the production worker rejects nonstandard ports) and dispatches
`/auth/*` to the unchanged auth handler. It reads the existing published example from its public
AEM origin. It does not preview/publish content, deploy Cloudflare workers, alter routes, or need
Cloudflare credentials. Do not deploy this test adapter remotely.

From the repository root, start the isolated local server:

```bash
npm ci --prefix workers/cdn
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.131.2 dev --local \
  --config test/gating-local/wrangler.toml --ip 127.0.0.1 --port 8787
```

In another shell:

```bash
node test/gating-local/smoke.mjs
```

The script checks HTTP responses for anonymous/member sections and blocks, login return
paths, session state, logout, invalid sessions, Range, HEAD, old validators, the public plain-HTML
exclusion, and ungated caching. It uses a synthetic display name and does not log session cookies.
`GATING_TEST_URL` can override the local base URL. Do not point it at production or another user's
session; the smoke script exercises login/logout.

The source page must still contain the documented VIP/member and anonymous/public fixture markers.
This smoke test does not validate unpublished DA edits, identity-provider auth,
origin access control, production CDN cache configuration, or the frontend's author-preview toggle.
Run `npm test --prefix test` to check the frontend's audience rules against the shared fixtures.

For browser inspection, open `http://localhost:8787/gated-content`. The CDN handler is from this
checkout. The frontend scripts and content come from the published origin, not unpublished changes.

To test this checkout's author-side code in a browser without an EDS preview, serve the checkout
in a separate local process:

```bash
python3 -m http.server 8788 --bind 127.0.0.1
```

Open `/test/gating-local/author.html?auth=false` and `?auth=true` at `http://localhost:8788`.
When `document.body.dataset.ready` is `true`, the remaining `main [id]` elements must be:

- Anonymous: `anonymous-section`, `promo`, `public-section`, `public-card`.
- Member: `member-section`, `member-card`, `public-section`, `public-card`.

This local fixture checks nested restrictions, exact class matching, and opposing variants using
this checkout's native browser modules. It does not preview or publish authored DA content.
