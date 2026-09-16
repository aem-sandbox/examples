# Local auth/CDN smoke test

Runs this checkout's auth and CDN workers together in local workerd, using the published example
content. No Cloudflare credentials needed. Don't deploy this adapter.

From the repository root:

```bash
npm ci --prefix workers/cdn
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.131.2 dev --local \
  --config test/gating-local/wrangler.toml --ip 127.0.0.1 --port 8787
```

In another shell:

```bash
node test/gating-local/smoke.mjs
```

Checks audience filtering, login/logout, invalid sessions, Range, HEAD, conditional requests,
plain HTML and ungated caching. The published page must still have the VIP/member and
anonymous/public markers checked by the script.

Set `GATING_TEST_URL` to use a different test server. The script logs in and out, so don't point it
at production. It doesn't log session cookies.

Open `http://localhost:8787/gated-content` to inspect the result. The frontend scripts and content
come from the published origin. This tests local filtering, not Cloudflare's deployed cache.

## Author preview

To test this checkout's frontend code, serve the repository in another shell:

```bash
python3 -m http.server 8788 --bind 127.0.0.1
```

Open `/test/gating-local/author.html?auth=false` and `?auth=true` at `http://localhost:8788`.
When `document.body.dataset.ready` is `true`, the remaining `main [id]` elements must be:

- Anonymous: `anonymous-section`, `promo`, `anonymous-both`, `public-section`, `public-card`,
  `both`, `both-anonymous-only`.
- Member: `member-section`, `member-card`, `member-both`, `public-section`, `public-card`,
  `both`, `both-member-only`.

The fixture checks exact variant names, blocks with both variants, and parent/child audience rules.
No DA content is changed or published.
