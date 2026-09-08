/**
 * Gated pages: `<meta name="gated" content="true">` + section audience (`data-view` or
 * section-metadata `view`). Mirrors the client-side preview in `scripts/utils/gated-content.js`.
 */
import { load } from 'cheerio';
import { isAuthenticated } from './auth-check.js';
// eslint-disable-next-line import/no-relative-packages
import { DEMO_SESSION_COOKIE, readCookie } from '../../shared/demo-session.js';

const SKIP = ['/fragments/', '/nav.plain.html', '/footer.plain.html'];
const GATED_META = /<meta[^>]+name=["']gated["'][^>]*content=["']true["']/i;

/**
 * Shape of the validator this handler issues for gated pages: a digest of the origin's
 * own validator plus the audience the body was built for.
 */
const VARIANT_ETAG = /^(?:W\/)?"[0-9a-z]+-(?:in|out)"$/;

/**
 * Non-cryptographic digest (FNV-1a). Only needs to be stable and compact; it protects
 * nothing, it just distinguishes one origin revision from another.
 * @param {string} value
 * @returns {string}
 */
/* eslint-disable no-bitwise -- FNV-1a needs xor and unsigned shift */
function digest(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
/* eslint-enable no-bitwise */

/**
 * Builds the audience-specific validator for a gated response.
 *
 * The origin's own `ETag`/`Last-Modified` describe the source document, which is identical
 * for both audiences. Reusing it lets a browser revalidate a cached anonymous page into a
 * 304 after signing in (and vice versa), so the visitor keeps the wrong variant. Folding the
 * audience into the validator keeps revalidation available without that confusion.
 *
 * @param {Response} source origin response
 * @param {boolean} loggedIn audience the body was built for
 * @returns {string} entity tag
 */
function variantEtag(source, loggedIn) {
  const base = source.headers.get('ETag')
    || source.headers.get('Last-Modified')
    || '';
  return `W/"${digest(base)}-${loggedIn ? 'in' : 'out'}"`;
}

/**
 * True when a conditional request must not be answered by the origin, because the cached
 * copy it refers to may belong to a different audience than the visitor now belongs to.
 *
 * Two cases:
 * 1. the validator is one this handler issued, which the origin cannot evaluate at all;
 * 2. the visitor has a demo session but sent an origin-style validator, so the cache entry
 *    predates audience-specific validators and may hold the anonymous body.
 *
 * Anonymous requests carrying ordinary validators are left alone, so public pages keep
 * revalidating against the origin exactly as before.
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function needsFullOriginResponse(request) {
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && ifNoneMatch.split(',').some((tag) => VARIANT_ETAG.test(tag.trim()))) {
    return true;
  }
  const conditional = ifNoneMatch || request.headers.get('If-Modified-Since');
  return Boolean(conditional) && readCookie(request, DEMO_SESSION_COOKIE) !== '';
}

/**
 * Reads a section's audience restriction, if any.
 * Mirrors the client-side `audience()` in `scripts/utils/gated-content.js`.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio} $section
 * @returns {'logged-in'|'logged-out'|null}
 */
function audience($, $section) {
  const a = String($section.attr('data-view') || '').trim().toLowerCase();
  if (a === 'logged-in' || a === 'logged-out') return a;

  const meta = $section.find('.section-metadata').first();
  if (!meta.length) return null;
  const viewDiv = meta.find('div').filter((__, div) => $(div).text().trim().toLowerCase() === 'view');
  if (!viewDiv.length) return null;
  const v = String(viewDiv.next().text() || '').trim().toLowerCase();
  return v === 'logged-in' || v === 'logged-out' ? v : null;
}

/**
 * Rewrites gated HTML for one audience: drops sections/blocks the visitor can't see.
 * @param {string} html
 * @param {boolean} loggedIn
 * @returns {string} the rewritten HTML
 */
function transformGatedHtml(html, loggedIn) {
  const $ = load(html);
  /** @type {Set<import('domhandler').Element>} */
  const removeEls = new Set();
  $('main > div').each((_, el) => {
    const $s = $(el);
    const aud = audience($, $s);
    if (aud) {
      const drop = (loggedIn && aud === 'logged-out') || (!loggedIn && aud === 'logged-in');
      if (drop) removeEls.add(el);
    }
    if (!removeEls.has(el)) {
      if (loggedIn) $s.find('[class*="logged-out"]').remove();
      if (loggedIn) $s.find('.logged-out').remove();
      else $s.find('.logged-in').remove();
    }
  });
  removeEls.forEach((node) => $(node).remove());
  return $.html();
}

/**
 * Adds `Cookie` to the `Vary` header, preserving any existing values.
 * @param {Headers} headers
 */
function mergeVaryCookie(headers) {
  const vary = headers.get('Vary');
  if (!vary) {
    headers.set('Vary', 'Cookie');
    return;
  }
  if (vary.split(',').map((s) => s.trim().toLowerCase()).includes('cookie')) return;
  headers.set('Vary', `${vary}, Cookie`);
}

/**
 * Builds the outgoing Response, copying status/headers from the origin response.
 * @param {string} body
 * @param {Response} source origin response to copy status/headers from
 * @param {boolean} [personalized] gated HTML was changed per user; tighten cache + Vary
 */
function htmlResponse(body, source, personalized = false, loggedIn = false) {
  const headers = new Headers(source.headers);
  if (personalized) {
    headers.delete('content-length');
    headers.set('Cache-Control', 'private, no-cache, must-revalidate');
    headers.delete('Age');
    // The origin validator describes the shared source document, not this audience's body.
    headers.delete('Last-Modified');
    headers.set('ETag', variantEtag(source, loggedIn));
    mergeVaryCookie(headers);
  }
  return new Response(body, {
    status: source.status,
    statusText: source.statusText,
    headers,
  });
}

/**
 * Rewrites the response for gated pages based on the visitor's auth state; passes
 * everything else through untouched.
 * @param {Request} request
 * @param {URL} requestURL parsed request URL (pathname used for the skip list)
 * @param {Response} response origin response
 * @returns {Promise<Response>}
 */
// eslint-disable-next-line import/prefer-default-export
export async function applyGatingIfNeeded(request, requestURL, response) {
  if (request.method !== 'GET' || response.status !== 200) return response;
  if (SKIP.some((p) => requestURL.pathname.startsWith(p))) return response;
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const html = await response.text();

  if (!GATED_META.test(html)) {
    return htmlResponse(html, response);
  }

  const loggedIn = await isAuthenticated(request);
  const out = transformGatedHtml(html, loggedIn);

  // A gated page is always audience-specific, even when this visitor's transform happens to
  // drop nothing: caching it as shared content would let one audience serve the other.
  const personalized = htmlResponse(out, response, true, loggedIn);

  const etag = personalized.headers.get('ETag');
  if (request.headers.get('If-None-Match')?.split(',').some((tag) => tag.trim() === etag)) {
    const headers = new Headers(personalized.headers);
    headers.delete('content-length');
    return new Response(null, { status: 304, headers });
  }
  return personalized;
}
