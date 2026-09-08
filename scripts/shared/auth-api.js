/**
 * Auth API - Provider-agnostic authentication utilities
 *
 * This module provides client-side utilities for authentication flows.
 * It works with any backend that provides the three core auth endpoints.
 *
 * CONFIGURATION:
 * By default the auth backend is served from the same origin as the page, which keeps the
 * session cookie first-party. Set AUTH_ORIGIN only if your backend lives elsewhere.
  *
  * Examples:
  * - Cloudflare Worker: 'https://your-auth-worker.workers.dev'
  * - Custom domain: 'https://auth.yourdomain.com'
  * - Auth0: 'https://your-tenant.auth0.com'
  */

// =============================================================================
// CONFIGURATION - Update this to match your deployment
// =============================================================================

/**
 * Auth backend origin URL
 *
 * Empty means same-origin: /auth/* is served by a Cloudflare Worker routed onto the site's own
 * hostname. Same-origin keeps the session cookie first-party, so it survives SameSite=Lax and
 * needs no cross-origin CORS grant. For this example that worker provides a public demo identity:
 * it asks for a display name and returns a fixed fake email address. The demo session illustrates
 * the integration contract but does not verify a real identity.
  *
  * To use your own:
  * 1. Deploy the auth worker (see workers/auth/README.md)
 * 2. Route it onto your site's hostname, or set AUTH_ORIGIN to its origin
  * 3. Replace the demo worker with your identity-provider integration
  */
const AUTH_ORIGIN = '';

/**
 * Resolves the auth backend origin, defaulting to the current page's origin.
 * @returns {string} Origin used to build auth URLs
 */
function authOrigin() {
  return AUTH_ORIGIN || window.location.origin;
}

/**
 * Auth endpoint paths
 * These are relative to AUTH_ORIGIN
 */
const AUTH_PATHS = {
  login: '/auth/login', // Initiates login flow
  logout: '/auth/logout', // Logs out user
  session: '/auth/session', // Returns current auth state
};

/**
 * Default button labels
 */
const AUTH_LABELS = {
  login: 'Login',
  logout: 'Logout',
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Constructs full auth URL from path
 * @param {string} path - Relative path (e.g., '/auth/login')
 * @returns {string} Full URL
 */
function authUrl(path) {
  return new URL(path, authOrigin()).toString();
}

/**
 * Gets default label for auth button
 * @param {string} type - 'login' or 'logout'
 * @returns {string} Button label
 */
export function getDefaultAuthLabel(type) {
  return AUTH_LABELS[type] || '';
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Reduces a return destination to a path on this site.
 *
 * The worker accepts a path and nothing else, so an absolute URL is stripped to its path and
 * a foreign origin is dropped entirely. A redirect target that survives a round trip through
 * the identity provider as a query parameter is an open redirect unless both ends check it.
 *
 * @param {string} returnTo - path or URL to reduce
 * @returns {string} a path starting with '/'
 */
function toReturnPath(returnTo) {
  try {
    const target = new URL(returnTo, window.location.origin);
    if (target.origin !== window.location.origin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}

/**
 * Generates login URL with return destination
 *
 * @param {string} returnTo - path to return to after login (defaults to current page)
 * @returns {string} Login URL with returnTo parameter
 *
 * @example
 * // Redirect to login, come back to current page
 * window.location.href = getLoginUrl();
 *
 * @example
 * // Redirect to login, come back to specific page
 * window.location.href = getLoginUrl('/dashboard');
 */
export function getLoginUrl(returnTo = window.location.href) {
  const target = new URL(AUTH_PATHS.login, authOrigin());
  target.searchParams.set('returnTo', toReturnPath(returnTo));
  return target.toString();
}

/**
 * Generates logout URL
 *
 * @returns {string} Logout URL
 *
 * @example
 * window.location.href = getLogoutUrl();
 */
export function getLogoutUrl() {
  return authUrl(AUTH_PATHS.logout);
}

/**
 * Anonymous session object (used when not authenticated)
 */
const ANONYMOUS_SESSION = {
  authenticated: false,
  name: '',
  email: '',
};

/**
 * Fetches current session state from auth backend
 *
 * Makes an authenticated request to /auth/session endpoint.
 * The auth backend reads authentication headers/cookies and returns user info.
 *
 * @returns {Promise<Object>} Session object
 * @returns {boolean} session.authenticated - Is user authenticated?
 * @returns {string} session.name - Demo display name (empty if not authenticated)
 * @returns {string} session.email - User's email (empty if not authenticated)
 *
 * @example
 * const session = await getSessionState();
 * if (session.authenticated) {
 *   console.log('Logged in as:', session.email);
 * } else {
 *   console.log('Anonymous user');
 * }
 *
 * Notes:
 * - Uses 'redirect: manual' to prevent automatic redirects to login pages
 * - Uses 'credentials: include' to send cookies with cross-origin requests
 * - Returns ANONYMOUS_SESSION on any error (network, auth failure, etc.)
 */
export async function getSessionState() {
  try {
    const response = await fetch(authUrl(AUTH_PATHS.session), {
      method: 'GET',
      credentials: 'include', // Send cookies (required for auth)
      redirect: 'manual', // Don't follow redirects to login pages
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { ...ANONYMOUS_SESSION, path: AUTH_PATHS.session };
    }

    return await response.json();
  } catch {
    // Network error, CORS error, or JSON parse error
    return { ...ANONYMOUS_SESSION, path: AUTH_PATHS.session };
  }
}

/**
 * Resolves the authentication state from the demo session API. This is the single source of
 * truth for the header and the gated-content author preview.
 * @returns {Promise<{authenticated: boolean, name: string, email: string}>}
 */
export async function resolveAuthState() {
  try {
    const session = await getSessionState();
    return {
      authenticated: Boolean(session?.authenticated),
      name: session?.name || '',
      email: session?.email || '',
    };
  } catch {
    return { ...ANONYMOUS_SESSION };
  }
}
