# Contact Us Worker

Cloudflare Worker that accepts contact form POSTs and forwards them to a Slack
incoming webhook.

## Endpoint behavior

- `OPTIONS` -> CORS preflight (`204`)
- `POST` -> validates `name` and `message`, posts to Slack webhook
- other methods -> `405`

Expected POST body (form block sends `{ data: { name, message } }`; flat `{ name, message }` also supported):

```json
{
  "data": {
    "name": "Jane Doe",
    "message": "I have a question about..."
  }
}
```

## Required secret

```bash
wrangler secret put SLACK_WEBHOOK_URL --config ./workers/contact_us/wrangler.toml
```

## Local dev

From project root (where `package.json` lives):

```bash
npm install
npm run dev:contact-us
```

## Deploy

From project root:

```bash
npm run deploy:contact-us
```
