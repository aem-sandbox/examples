/**
 * Gated pages: `<meta name="gated" content="true">` + section audience (`data-view` or
 * section-metadata `view`). Mirrors the client-side preview in `scripts/utils/gated-content.js`.
 */
import { load } from 'cheerio';
import { isAuthenticated } from './auth-check.js';

const SKIP = ['/nav.plain.html', '/footer.plain.html'];
const normalize = (value) => String(value || '').trim().toLowerCase();
const mediaType = (response) => normalize(response.headers.get('content-type')).split(';')[0].trim();
const isHtml = (response) => mediaType(response) === 'text/html';

function discard(response) {
  if (!response.bodyUsed) response.body?.cancel().catch(() => undefined);
}

/**
 * Reads a section's audience restriction, if any.
 * Mirrors the client-side `audience()` in `scripts/utils/gated-content.js`.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio} $section
 * @returns {'logged-in'|'logged-out'|null}
 */
function audience($, $section) {
  const a = normalize($section.attr('data-view'));
  if (a === 'logged-in' || a === 'logged-out') return a;

  const meta = $section.find('.section-metadata').first();
  if (!meta.length) return null;
  const viewDiv = meta.find('div').filter((__, div) => normalize($(div).text()) === 'view').first();
  if (!viewDiv.length) return null;
  const v = normalize(viewDiv.next().text());
  return v === 'logged-in' || v === 'logged-out' ? v : null;
}

/**
 * Rewrites gated HTML for one audience: drops sections/blocks the visitor can't see.
 * @param {import('cheerio').CheerioAPI} $
 * @param {boolean} loggedIn
 * @returns {string} the rewritten HTML
 */
function transformGatedHtml($, loggedIn) {
  $('main > div').each((_, el) => {
    const section = $(el);
    const aud = audience($, section);
    if ((loggedIn && aud === 'logged-out') || (!loggedIn && aud === 'logged-in')) {
      section.remove();
    } else {
      section.find(loggedIn ? '.logged-out' : '.logged-in').remove();
    }
  });
  return $.html();
}

/**
 * Builds a non-cacheable gated response without source-representation metadata.
 * @param {string|null} body
 * @param {Response} source
 * @returns {Response}
 */
function gatedResponse(body, source) {
  const headers = new Headers(source.headers);
  [
    'Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Encoding',
    'ETag', 'Last-Modified', 'Age', 'Expires',
    'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control', 'Surrogate-Control',
  ].forEach((name) => headers.delete(name));
  headers.set('Cache-Control', 'private, no-store');
  return new Response(body, { status: 200, headers });
}

/**
 * Rewrites complete gated HTML; ambiguous HEAD, partial and conditional responses
 * require an unconditional GET before deciding whether to preserve the original response.
 * @param {Request} request
 * @param {URL} requestURL
 * @param {Response} response origin response
 * @param {function(): Promise<Response>} fetchFullResponse unconditional origin GET
 * @returns {Promise<Response>}
 */
// eslint-disable-next-line import/prefer-default-export
export async function applyGatingIfNeeded(request, requestURL, response, fetchFullResponse) {
  if (!['GET', 'HEAD'].includes(request.method)) return response;
  const { pathname } = requestURL;
  if (pathname.startsWith('/fragments/') || SKIP.includes(pathname)
    || /\.(?:plain\.html|md|json)$/.test(pathname)) {
    return response;
  }

  const type = mediaType(response);
  const ambiguous = [206, 304].includes(response.status)
    || (request.method === 'HEAD' && response.status === 200);
  let source = response;
  try {
    if (ambiguous && ['', 'text/html', 'multipart/byteranges'].includes(type)) {
      source = await fetchFullResponse();
      if (source.status !== 200 || !mediaType(source)) throw new Error('Incomplete response');
      if (!isHtml(source)) {
        if (type === 'text/html') throw new Error('Inconsistent media type');
        discard(source);
        return response;
      }
    }
    if (source.status !== 200 || !isHtml(source)) return response;

    const $ = load(await (source === response ? source.clone() : source).text());
    if (normalize($('head meta[name="gated"]').first().attr('content')) !== 'true') return response;

    const loggedIn = await isAuthenticated(request);
    discard(response);
    return gatedResponse(request.method === 'HEAD' ? null : transformGatedHtml($, loggedIn), source);
  } catch {
    if (source !== response) discard(source);
    discard(response);
    return new Response(request.method === 'HEAD' ? null : 'Unable to inspect page content.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
