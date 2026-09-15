/**
 * Gated pages: `<meta name="gated" content="true">` + section audience (`data-view` or
 * section-metadata `view`). Mirrors the client-side preview in `scripts/utils/gated-content.js`.
 */
import { load } from 'cheerio';
import { isAuthenticated } from './auth-check.js';

const SKIP = ['/nav.plain.html', '/footer.plain.html'];
const ANONYMOUS_CACHE_POLICY = 'public, max-age=60, must-revalidate';
const anonymousCacheable = new WeakSet();
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
      section.find(loggedIn ? '.logged-out:not(.logged-in)' : '.logged-in:not(.logged-out)').remove();
    }
  });
  return $.html();
}

/**
 * Returns filtered HTML without origin validators.
 * @param {string|null} body
 * @param {Response} source
 * @returns {Response}
 */
function appendVary(headers, name) {
  const values = (headers.get('Vary') || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!values.some((value) => value.toLowerCase() === name.toLowerCase())) values.push(name);
  headers.set('Vary', values.join(', '));
}

function canCacheAnonymous(request, source) {
  const cacheControl = [
    source.headers.get('Cache-Control'),
    source.headers.get('CDN-Cache-Control'),
    source.headers.get('Cloudflare-CDN-Cache-Control'),
  ].filter(Boolean).join(',');
  return !request.headers.has('Authorization')
    && !source.headers.has('Set-Cookie')
    && !/(?:^|,)\s*(?:private|no-store)(?:\s|,|=|$)/i.test(cacheControl)
    && normalize(source.headers.get('Vary')) !== '*';
}

function gatedResponse(body, source, request, loggedIn) {
  const headers = new Headers(source.headers);
  const cacheable = !loggedIn && canCacheAnonymous(request, source);
  [
    'Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Encoding',
    'ETag', 'Last-Modified', 'Age', 'Expires',
    'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control', 'Surrogate-Control',
  ].forEach((name) => headers.delete(name));
  if (cacheable) {
    headers.set('Cache-Control', 'no-cache');
    headers.set('Cloudflare-CDN-Cache-Control', ANONYMOUS_CACHE_POLICY);
    appendVary(headers, 'Cookie');
  } else {
    headers.set('Cache-Control', 'private, no-store');
  }
  const response = new Response(body, { status: 200, headers });
  if (cacheable) anonymousCacheable.add(response);
  return response;
}

/**
 * @param {Request} request
 * @param {URL} requestURL
 * @returns {boolean}
 */
export function canContainGatedHtml(request, requestURL) {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  const { pathname } = requestURL;
  return !pathname.startsWith('/fragments/') && !SKIP.includes(pathname)
    && !/\.(?:plain\.html|md|json)$/.test(pathname);
}

/**
 * Filters complete HTML. Uses a full GET to check HEAD, partial and conditional
 * responses when their type does not rule out HTML.
 * @param {Request} request
 * @param {URL} requestURL
 * @param {Response} response origin response
 * @param {function(): Promise<Response>} fetchFullResponse unconditional origin GET
 * @returns {Promise<Response>}
 */
// eslint-disable-next-line import/prefer-default-export
export async function applyGatingIfNeeded(request, requestURL, response, fetchFullResponse) {
  if (!canContainGatedHtml(request, requestURL)) return response;

  const type = mediaType(response);
  const ambiguous = [206, 304].includes(response.status)
    || (response.status === 200 && (request.method === 'HEAD'
      || response.headers.has('content-range') || type === 'multipart/byteranges'));
  let source = response;
  try {
    if (ambiguous && ['', 'text/html', 'multipart/byteranges'].includes(type)) {
      source = await fetchFullResponse();
      const fullType = mediaType(source);
      if (source.status !== 200 || !fullType || fullType === 'multipart/byteranges'
        || source.headers.has('content-range')) throw new Error('Incomplete response');
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
    return gatedResponse(
      request.method === 'HEAD' ? null : transformGatedHtml($, loggedIn),
      source,
      request,
      loggedIn,
    );
  } catch {
    if (source !== response) discard(source);
    discard(response);
    return new Response(request.method === 'HEAD' ? null : 'Unable to inspect page content.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

export function isAnonymousCacheable(response) {
  return anonymousCacheable.has(response);
}

export function copyAnonymousCacheability(source, target) {
  if (isAnonymousCacheable(source)) anonymousCacheable.add(target);
}
