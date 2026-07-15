/**
 * Cloudflare Access: Cf-Access-* headers and/or valid `CF_Authorization` JWT cookie.
 */
const SKEW_SEC = 120;

/**
 * @param {Request} request
 * @param {string} name
 * @returns {string} decoded cookie value, or '' if not present
 */
function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const match = raw.split(';')
    .filter((part) => part.includes('='))
    .find((part) => part.slice(0, part.indexOf('=')).trim() === name);
  if (!match) return '';
  return decodeURIComponent(match.slice(match.indexOf('=') + 1).trim());
}

/**
 * Decodes a base64url-encoded JWT segment into a UTF-8 string.
 * @param {string} segment
 * @returns {string}
 */
function base64UrlDecodeUtf8(segment) {
  let b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Decodes a JWT's payload without verifying its signature.
 * @param {string} token
 * @returns {object|null} the decoded payload, or null if malformed
 */
function decodeJwtPayload(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecodeUtf8(parts[1]));
  } catch {
    return null;
  }
}

/**
 * Validates a decoded Cloudflare Access JWT payload: correct issuer, not expired/not-yet-valid.
 * @param {object|null} payload
 * @returns {boolean}
 */
function payloadOk(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const { iss } = payload;
  if (typeof iss !== 'string' || !iss.includes('cloudflareaccess.com')) return false;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now - SKEW_SEC) return false;
  if (typeof payload.nbf === 'number' && payload.nbf > now + SKEW_SEC) return false;
  return true;
}

/**
 * @param {Request} request
 */
// eslint-disable-next-line import/prefer-default-export
export function isAuthenticated(request) {
  if (request.headers.get('Cf-Access-Authenticated-User-Email')) return true;
  if (request.headers.get('Cf-Access-Jwt-Assertion')) return true;

  const token = getCookie(request, 'CF_Authorization');
  if (!token) return false;

  const payload = decodeJwtPayload(token);
  return payloadOk(payload);
}
