// Local-only same-origin adapter for the unchanged auth and candidate CDN worker handlers.
// eslint-disable-next-line import/no-relative-packages
import auth from '../../workers/auth/index.js';
// eslint-disable-next-line import/no-relative-packages
import cdn from '../../workers/cdn/index.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/auth/')) return auth.fetch(request);

    // The production CDN correctly redirects nonstandard ports; hide only this local transport.
    url.protocol = 'https:';
    url.hostname = 'examples.bbird.live';
    url.port = '';
    return cdn.fetch(new Request(url, request), env);
  },
};
