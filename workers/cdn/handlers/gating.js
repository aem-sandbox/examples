/**
 * Gated pages: `<meta name="gated" content="true">` + section audience (`data-view` or
 * section-metadata `view`). Mirrors the client-side preview in `scripts/utils/gated-content.js`.
 */
import { load } from 'cheerio';
import { isAuthenticated } from './auth-check.js';

const SKIP = ['/fragments/', '/nav.plain.html', '/footer.plain.html'];
const GATED_META = /<meta[^>]+name=["']gated["'][^>]*content=["']true["']/i;

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
function htmlResponse(body, source, personalized = false) {
  const headers = new Headers(source.headers);
  if (personalized) {
    headers.delete('content-length');
    headers.set('Cache-Control', 'private, no-cache, must-revalidate');
    headers.delete('Age');
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

  const out = transformGatedHtml(html, isAuthenticated(request));
  return htmlResponse(out, response, out !== html);
}
