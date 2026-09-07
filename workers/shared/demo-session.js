const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const DEMO_EMAIL = 'visitor@example.invalid';
export const DEMO_SESSION_COOKIE = 'bbird_demo_session';

// Use a Worker environment variable in real life.
const DEMO_SESSION_SIGNING_KEY = 'public-demo-key-not-for-production';

function toBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function fromBase64Url(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signingKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

export function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const match = raw.split(';')
    .filter((part) => part.includes('='))
    .find((part) => part.slice(0, part.indexOf('=')).trim() === name);
  if (!match) return '';
  try {
    return decodeURIComponent(match.slice(match.indexOf('=') + 1).trim());
  } catch {
    return '';
  }
}

export async function createDemoSession(identity, options = {}) {
  const { now = Date.now(), ttlSeconds = 3600 } = options;
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    v: 1,
    name: identity.name,
    email: DEMO_EMAIL,
    exp: Math.floor(now / 1000) + ttlSeconds,
  })));
  const key = await signingKey(DEMO_SESSION_SIGNING_KEY, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyDemoSession(token, options = {}) {
  if (!token) return null;
  const { now = Date.now() } = options;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;

  try {
    const key = await signingKey(DEMO_SESSION_SIGNING_KEY, 'verify');
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(signature),
      encoder.encode(payload),
    );
    if (!valid) return null;

    const identity = JSON.parse(decoder.decode(fromBase64Url(payload)));
    if (identity.v !== 1
      || typeof identity.name !== 'string'
      || !identity.name
      || identity.name.length > 80
      || identity.email !== DEMO_EMAIL
      || !Number.isInteger(identity.exp)
      || identity.exp <= Math.floor(now / 1000)) return null;
    return identity;
  } catch {
    return null;
  }
}
