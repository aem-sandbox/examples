import {
  createDemoSession,
  DEMO_EMAIL,
  DEMO_SESSION_COOKIE,
  readCookie,
  verifyDemoSession,
} from '../shared/demo-session.js'; // eslint-disable-line import/no-relative-packages

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};
const HTML_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};
const DEFAULT_RETURN_PATH = '/auth/session';
const SESSION_MAX_AGE = 3600;
const SAME_ORIGIN_PATH = /^\/(?![/\\])/;
const PREVIEW_HOST = /^[a-z0-9-]+--examples--aem-sandbox\.aem\.page$/;

function getSafeReturnPath(value, requestUrl) {
  if (!value || !SAME_ORIGIN_PATH.test(value)) return DEFAULT_RETURN_PATH;
  try {
    const target = new URL(value, requestUrl.origin);
    if (target.origin !== requestUrl.origin) return DEFAULT_RETURN_PATH;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return {};
  let allowed = false;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    allowed = source.origin === target.origin
      || (source.protocol === 'https:' && PREVIEW_HOST.test(source.hostname))
      || (['localhost', '127.0.0.1'].includes(source.hostname)
        && ['http:', 'https:'].includes(source.protocol));
  } catch {
    return {};
  }
  return allowed ? {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  } : {};
}

function json(request, body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...getCorsHeaders(request),
      ...(init.headers || {}),
    },
  });
}

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 303,
    headers: { Location: location, ...headers },
  });
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loginPage(returnTo, error = '') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Demo login | AEM Examples</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { display: grid; min-height: 100vh; margin: 0; place-items: center; background: #f5f5f5; color: #222; }
    main { box-sizing: border-box; width: min(90vw, 28rem); padding: 2rem; border: 1px solid #ddd; border-radius: 1rem; background: white; }
    label, input, button { box-sizing: border-box; display: block; width: 100%; }
    input, button { margin-top: .5rem; padding: .75rem; font: inherit; }
    button { border: 0; border-radius: 999px; background: #1473e6; color: white; cursor: pointer; }
    .notice { padding: .75rem; border-radius: .5rem; background: #fff4ce; }
    .error { color: #b00020; }
    @media (prefers-color-scheme: dark) { body { background: #202020; color: #eee; } main { border-color: #555; background: #292929; } .notice { background: #4a3b00; } }
  </style>
</head>
<body>
  <main>
    <h1>Demo login</h1>
    <p class="notice">This example does not verify your identity. Use any display name.</p>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
    <form method="post" action="/auth/login">
      <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
      <label>Display name <input name="name" required maxlength="80" autocomplete="nickname"></label>
      <button type="submit">Continue</button>
    </form>
  </main>
</body>
</html>`;
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function sessionCookie(token, maxAge = SESSION_MAX_AGE) {
  return `${DEMO_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function getSession(request) {
  const token = readCookie(request, DEMO_SESSION_COOKIE);
  return verifyDemoSession(token);
}

async function submitLogin(request, url) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) {
    return json(request, { error: 'Forbidden' }, { status: 403 });
  }

  let data;
  try {
    data = await request.formData();
  } catch {
    return json(request, { error: 'Invalid form data' }, { status: 400 });
  }
  const name = normalizeName(data.get('name'));
  const returnTo = getSafeReturnPath(data.get('returnTo'), url);
  if (!name) {
    return new Response(loginPage(returnTo, 'Enter a display name.'), {
      status: 400,
      headers: HTML_HEADERS,
    });
  }

  const token = await createDemoSession({ name, email: DEMO_EMAIL }, {
    ttlSeconds: SESSION_MAX_AGE,
  });
  return redirect(new URL(returnTo, url.origin).toString(), {
    'Set-Cookie': sessionCookie(token),
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    if (pathname === '/auth/login') {
      if (request.method === 'GET') {
        const returnTo = getSafeReturnPath(url.searchParams.get('returnTo'), url);
        return new Response(loginPage(returnTo), { headers: HTML_HEADERS });
      }
      if (request.method === 'POST') return submitLogin(request, url);
      return json(request, { error: 'Method not allowed' }, {
        status: 405,
        headers: { Allow: 'GET, POST' },
      });
    }

    if (request.method !== 'GET') {
      return json(request, { error: 'Method not allowed' }, {
        status: 405,
        headers: { Allow: 'GET' },
      });
    }

    if (pathname === '/auth/logout') {
      return redirect(new URL('/', url.origin).toString(), {
        'Set-Cookie': sessionCookie('', 0),
      });
    }

    if (pathname === '/auth/session') {
      const identity = await getSession(request);
      return json(request, {
        authenticated: Boolean(identity),
        name: identity?.name || '',
        email: identity?.email || '',
        path: pathname,
      });
    }

    return json(request, {
      error: 'Not found',
      availablePaths: ['/auth/login', '/auth/logout', '/auth/session'],
    }, { status: 404 });
  },
};
