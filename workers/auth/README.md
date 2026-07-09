# Auth Worker - Reference Implementation

**This is a reference implementation** showing how to build a login flow for AEM Edge Delivery Services using **Cloudflare Access + Cloudflare Workers**.

This worker provides three simple endpoints that work with **any authentication provider** - the code is provider-agnostic, it just reads headers that the auth provider sets.

## How It Works

### Architecture

```
User clicks "Login"
    ↓
Auth Provider intercepts (e.g., Cloudflare Access)
    ↓
Shows login page / handles authentication
    ↓
Sets session cookie + adds headers
    ↓
Forwards authenticated request to this worker
    ↓
Worker reads headers, returns data or redirects
```

**Key insight**: The worker does NOT handle authentication itself. It just reads headers that the auth provider already set.

For **Cloudflare Access specifically**:
- Cloudflare Access sits in front of this worker
- Access handles the login UI, email/PIN flow, session management
- Access adds these headers to authenticated requests:
  - `Cf-Access-Authenticated-User-Email`
  - `Cf-Access-Jwt-Assertion`
- Worker reads these headers and returns JSON or redirects

## Endpoints

### `GET /auth/login?returnTo=<url>`
Initiates login flow.

**What it does:**
- Validates `returnTo` parameter (security!)
- Redirects to `returnTo` URL

**What the auth provider does** (happens BEFORE this endpoint):
- Shows login page
- Validates credentials
- Creates session
- Sets cookie
- Then forwards to this endpoint

**Example:**
```
GET /auth/login?returnTo=https://example.com/page

Response: 302 Redirect to https://example.com/page
```

### `GET /auth/logout`
Logs out user.

**What it does:**
- Redirects to auth provider's logout endpoint
- For Cloudflare Access: `/cdn-cgi/access/logout`

**Example:**
```
GET /auth/logout

Response: 302 Redirect to /cdn-cgi/access/logout
```

### `GET /auth/session`
Returns current authentication state as JSON.

**What it does:**
- Reads headers set by auth provider
- Returns authentication status

**Example (authenticated):**
```json
{
  "authenticated": true,
  "email": "user@example.com",
  "hasJwtAssertion": true,
  "path": "/auth/session"
}
```

**Example (anonymous):**
```json
{
  "authenticated": false,
  "email": "",
  "hasJwtAssertion": false,
  "path": "/auth/session"
}
```

## For This Examples Site

**This site uses:**
- Auth endpoint: `https://demo-bbird-auth.aem-poc-lab.workers.dev`
- Auth provider: Cloudflare Access
- Policy: Allow `@adobe.com` emails
- Authentication method: One-time PIN via email

**Configured in:**
- `scripts/shared/auth-api.js` - Points to this worker
- `blocks/header/header.js` - Uses auth-api to show Login/Logout

## Deploying Your Own

If you want to deploy your own auth worker:

### 1. Update wrangler.toml

```toml
name = "my-auth-worker"
account_id = "YOUR_ACCOUNT_ID"  # Get from Cloudflare dashboard
main = "index.js"
compatibility_date = "2026-03-13"
workers_dev = true
```

### 2. Deploy the worker

```bash
cd workers/auth
wrangler deploy
```

Your worker will be at: `https://my-auth-worker.YOUR_SUBDOMAIN.workers.dev`

### 3. Configure Cloudflare Access

In Cloudflare Zero Trust dashboard:

1. **Create Access Application:**
   - Domain: `my-auth-worker.YOUR_SUBDOMAIN.workers.dev`
   - Path: (leave empty to protect entire domain)

2. **Configure Authentication:**
   - Choose identity provider: Email (OTP), Google, GitHub, etc.

3. **Create Policy:**
   - Action: Allow
   - Include: Emails ending in `your-domain.com`

### 4. Update your site

In `scripts/shared/auth-api.js`:

```javascript
const AUTH_ORIGIN = 'https://my-auth-worker.YOUR_SUBDOMAIN.workers.dev';
```

## Adapting for Other Auth Providers

This worker is designed to work with **any auth provider**. Just change the header names:

### For Auth0:

```javascript
// index.js
function getAccessContext(request) {
  // Read Auth0 headers (example - adjust to your setup)
  const email = request.headers.get('X-Auth0-Email');
  const jwt = request.headers.get('X-Auth0-JWT');

  return {
    authenticated: Boolean(email || jwt),
    email: email || '',
    hasJwtAssertion: Boolean(jwt),
  };
}
```

### For Okta:

```javascript
// index.js
function getAccessContext(request) {
  // Read Okta headers (example - adjust to your setup)
  const email = request.headers.get('X-Okta-User');
  const jwt = request.headers.get('X-Okta-Token');

  return {
    authenticated: Boolean(email || jwt),
    email: email || '',
    hasJwtAssertion: Boolean(jwt),
  };
}
```

### For Custom OAuth:

You might not even need this worker! Many OAuth providers offer client-side SDKs that handle everything in the browser.

## Testing

### 1. Open incognito window

### 2. Visit the login endpoint

```
https://demo-bbird-auth.aem-poc-lab.workers.dev/auth/login?returnTo=https://main--examples--aem-sandbox.aem.live/
```

### 3. Complete authentication

- Enter email (must match policy: `@adobe.com`)
- Get PIN via email
- Enter PIN
- Redirected back to examples site

### 4. Check session

Visit:
```
https://demo-bbird-auth.aem-poc-lab.workers.dev/auth/session
```

Should show `authenticated: true` with your email.

## Documentation

For complete understanding of how this works, see:
- [Code walkthrough](../../docs/login-flow.md) (TODO: create this)
- [Cloudflare Access docs](https://developers.cloudflare.com/cloudflare-one/applications/)
- [Worker code comments](./index.js) - fully commented for learning

## Key Takeaways

1. **Worker doesn't do authentication** - auth provider does
2. **Worker just reads headers** - very simple code
3. **Provider-agnostic design** - change headers, not logic
4. **Security handled externally** - in Cloudflare Access dashboard
5. **CORS enabled** - works cross-domain

**This pattern works for ANY authentication provider that can:**
- Intercept requests
- Handle login UI
- Add headers to authenticated requests
- Forward to your backend
