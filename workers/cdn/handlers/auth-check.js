import {
  DEMO_SESSION_COOKIE,
  readCookie,
  verifyDemoSession,
} from '../../shared/demo-session.js'; // eslint-disable-line import/no-relative-packages

/**
 * Verifies the signed demo session and returns its identity.
 * @param {Request} request
 * @param {{now?: number}} options
 * @returns {Promise<{name: string, email: string}|null>}
 */
export async function getDemoIdentity(request, options = {}) {
  const token = readCookie(request, DEMO_SESSION_COOKIE);
  return verifyDemoSession(token, options);
}

/**
 * @param {Request} request
 * @param {{now?: number}} options
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated(request, options = {}) {
  return (await getDemoIdentity(request, options)) !== null;
}
