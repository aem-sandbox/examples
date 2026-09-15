// Runs the auth and CDN worker handlers on one local origin.
// eslint-disable-next-line import/no-relative-packages
import auth from '../../workers/auth/index.js';
// eslint-disable-next-line import/no-relative-packages
import cdn, { Anonymous } from '../../workers/cdn/index.js';

export { Anonymous };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/auth/')) return auth.fetch(request);

    // Remove the local port so the CDN handler does not redirect the test request.
    url.protocol = 'https:';
    url.hostname = 'examples.bbird.live';
    url.port = '';
    return cdn.fetch(new Request(url, request), env, ctx);
  },
};
