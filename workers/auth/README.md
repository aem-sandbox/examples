# Demo Login Worker

Public login-flow reference for the AEM Examples site.

This worker intentionally **does not verify identity**. It asks for a display name, assigns the
reserved fake address `visitor@example.invalid`, and stores that demo identity in a signed,
short-lived cookie. It demonstrates the browser-to-worker session contract without collecting real
email addresses or requiring an account with an external identity provider.

Do not use this worker to authorize access to private content. A production implementation replaces
the demo login handler with OAuth or OpenID Connect while keeping the same site-facing routes.

## Route contract

| Route | Purpose |
| --- | --- |
| `GET /auth/login?returnTo=<path>` | Shows the demo login form. |
| `POST /auth/login` | Creates the signed demo session and returns to the requested path. |
| `GET /auth/session` | Returns the current session as JSON. |
| `GET /auth/logout` | Clears the demo session and returns to the home page. |

`returnTo` must be a path on this site. Absolute, protocol-relative, malformed, and non-HTTP targets
fall back to `/auth/session`, preventing an open redirect after login.

## Session

The worker stores this payload in an HMAC-SHA256-signed cookie:

```json
{
  "v": 1,
  "name": "Ada Lovelace",
  "email": "visitor@example.invalid",
  "exp": 1788796800
}
```

The cookie is host-only, `HttpOnly`, `Secure`, `SameSite=Lax`, available on `/`, and expires after
one hour. The signing key is intentionally a public constant in this example. It demonstrates the
mechanics of a signed session, but anyone can forge a cookie because the key is public.

The fixed `.invalid` email makes the response shape realistic without collecting or inventing a
real address. The chosen display name is held only in the visitor's cookie; the worker has no user
database.

There is no session-secret configuration step for this public demo. A real implementation must
store its signing key in a Worker environment secret and must not share it with browsers or source
control. This demo remains separate from origin protection and does not make content private.

## Site integration

- `scripts/shared/auth-api.js` calls the four `/auth/*` routes.
- `blocks/header/header.js` changes **Login** to **Logout** when `/auth/session` is authenticated.
- The existing info marker exposes the chosen name and fake email in its tooltip.
- Login and Logout remain available in the mobile header.

Example authenticated session response:

```json
{
  "authenticated": true,
  "name": "Ada Lovelace",
  "email": "visitor@example.invalid",
  "path": "/auth/session"
}
```

## Cloudflare routing

`wrangler.toml` routes `examples.bbird.live/auth/*` to this worker. Remove the existing Cloudflare
Access application from that route before testing the public demo; otherwise Access intercepts the
request before this worker can show its form.

Identify that application by the `aud` claim inside the `meta` JWT of the Access redirect rather
than by its name: hostnames on one Cloudflare account can belong to different applications, and one
application can cover several hostnames. Prefer adding a Bypass policy for everyone over deleting
the application, which cannot be undone.

## Production adaptation

Keep the route contract, but replace the demo implementation:

1. `/auth/login` redirects to the chosen identity provider.
2. `/auth/callback` validates state and PKCE, exchanges the authorization code, and creates the
   application session.
3. `/auth/session` verifies that session and returns the minimum identity the site needs.
4. `/auth/logout` clears the application session and, when appropriate, signs out at the provider.

If login controls access to content rather than only personalizing public pages, protect every
alternate origin and representation as a separate authorization concern.

## Tests

```bash
npm install --prefix ./workers/auth
npm test --prefix ./workers/auth
```
