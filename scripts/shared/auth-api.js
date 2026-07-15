/**
 * Auth API - Provider-agnostic authentication utilities
 *
 * This module provides client-side utilities for authentication flows.
 * It works with any backend that provides the three core auth endpoints.
 *
 * CONFIGURATION:
 * Change AUTH_ORIGIN to point to your authentication backend.
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
 * For this example, we're using a Cloudflare Worker deployed at examples.bbird.live.
 * The worker is available at examples.bbird.live/auth/* and is protected by
 * Cloudflare Access with an OPEN policy that allows ANY email to authenticate
 * (not restricted to specific domains).
 *
 * To use your own:
 * 1. Deploy the auth worker (see workers/auth/README.md)
 * 2. Update this URL to your worker's endpoint
 * 3. Ensure your auth provider protects the /auth/* endpoints
 */
const AUTH_ORIGIN = 'https://examples.bbird.live';

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
  return new URL(path, AUTH_ORIGIN).toString();
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
 * Generates login URL with return destination
 *
 * @param {string} returnTo - URL to redirect to after login (defaults to current page)
 * @returns {string} Login URL with returnTo parameter
 *
 * @example
 * // Redirect to login, come back to current page
 * window.location.href = getLoginUrl();
 *
 * @example
 * // Redirect to login, come back to specific page
 * window.location.href = getLoginUrl('https://example.com/dashboard');
 */
export function getLoginUrl(returnTo = window.location.href) {
  const target = new URL(AUTH_PATHS.login, AUTH_ORIGIN);
  target.searchParams.set('returnTo', returnTo);
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
  email: '',
  hasJwtAssertion: false,
};

/**
 * Fetches current session state from auth backend
 *
 * Makes an authenticated request to /auth/session endpoint.
 * The auth backend reads authentication headers/cookies and returns user info.
 *
 * @returns {Promise<Object>} Session object
 * @returns {boolean} session.authenticated - Is user authenticated?
 * @returns {string} session.email - User's email (empty if not authenticated)
 * @returns {boolean} session.hasJwtAssertion - Does session include JWT?
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
 * Checks whether any cookie name starts with the given prefix (e.g. Cloudflare Access's
 * CF_Authorization cookie).
 * @param {string} prefix
 * @returns {boolean}
 */
function hasCookieStartingWith(prefix) {
  return document.cookie
    .split(';')
    .map((entry) => decodeURIComponent(entry.split('=')[0] || '').trim())
    .some((cookieName) => cookieName.startsWith(prefix));
}

/**
 * Resolves the real authentication state: tries the session API first, falling back to
 * a CF_Authorization cookie check if that fails. This is the single source of truth for
 * "is the current visitor logged in?" — used by both the header (login/logout button)
 * and the gated-content author preview, so the two can never disagree.
 * @returns {Promise<{authenticated: boolean, email: string}>}
 */
export async function resolveAuthState() {
  try {
    const session = await getSessionState();
    return {
      authenticated: Boolean(session?.authenticated),
      email: session?.email || '',
    };
  } catch {
    return {
      authenticated: hasCookieStartingWith('CF_Authorization'),
      email: '',
    };
  }
}
