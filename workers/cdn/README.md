# CDN Worker

BYO CDN proxy for AEM Edge Delivery. [Cloudflare setup guide](https://www.aem.live/docs/byo-cdn-cloudflare-worker-setup).

Worker code is based on [aem-cloudflare-prod-worker](https://github.com/adobe/aem-cloudflare-prod-worker).

## Variables

| Name | Value |
|------|--------|
| `ORIGIN_HOSTNAME` | `main--examples--aem-sandbox.aem.live` |
| `PUSH_INVALIDATION` | `enabled` |


## Local dev

```bash
npx wrangler dev --config ./workers/cdn/wrangler.toml
```

## Deploy

```bash
npx wrangler deploy --config ./workers/cdn/wrangler.toml
```

Or push to `main` — the `deploy-cdn` GitHub Action deploys when `workers/cdn/**` changes.
