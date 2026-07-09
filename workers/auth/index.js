const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

const DEFAULT_RETURN_PATH = '/auth/session';

function getAccessContext(request) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');

  return {
    authenticated: Boolean(email || jwt),
    email: email || '',
    hasJwtAssertion: Boolean(jwt),
  };
}

function getSafeReturnTo(requestUrl) {
  const returnTo = requestUrl.searchParams.get('returnTo');

  if (!returnTo) return `${requestUrl.origin}${DEFAULT_RETURN_PATH}`;

  try {
    const absolute = new URL(returnTo, requestUrl.origin);
    if (absolute.protocol === 'http:' || absolute.protocol === 'https:') return absolute.toString();
  } catch (e) {
    // no-op
  }

  return `${requestUrl.origin}${DEFAULT_RETURN_PATH}`;
}

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  return origin ? {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

function redirect(location) {
  const headers = { Location: location };
  return new Response(null, {
    status: 302,
    headers,
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;
    const access = getAccessContext(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...getCorsHeaders(request),
        },
      });
    }

    if (request.method !== 'GET') {
      return json(request, { error: 'Method not allowed' }, {
        status: 405,
        headers: { Allow: 'GET' },
      });
    }

    if (pathname === '/auth/login') {
      return redirect(getSafeReturnTo(url));
    }

    if (pathname === '/auth/logout') {
      const logoutUrl = new URL('/cdn-cgi/access/logout', url.origin);
      // Tell Access to redirect to root (/) after logout, not back to /auth
      logoutUrl.searchParams.set('redirect_url', '/');
      return redirect(logoutUrl.toString());
    }

    if (pathname === '/auth/session') {
      return json(request, {
        ...access,
        path: pathname,
      });
    }

    // Handle root path - redirect back to referer after logout
    if (pathname === '/') {
      const referer = request.headers.get('Referer');
      if (referer && referer !== url.toString()) {
        try {
          const refererUrl = new URL(referer);
          if (refererUrl.protocol === 'http:' || refererUrl.protocol === 'https:') {
            return redirect(refererUrl.toString());
          }
        } catch (e) {
          // Invalid referer, show API info
        }
      }

      // No referer or invalid - show API info
      return json(request, {
        service: 'Auth API',
        authenticated: access.authenticated,
        email: access.email,
        availablePaths: ['/auth/login', '/auth/logout', '/auth/session'],
      });
    }

    return json(request, {
      error: 'Not found',
      availablePaths: ['/auth/login', '/auth/logout', '/auth/session'],
    }, { status: 404 });
  },
};
