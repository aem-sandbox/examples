import { getMetadata, toCamelCase } from './aem.js';

export const LOCALES = {
  '': { lang: 'en' },
  '/de': { lang: 'de' },
  '/es': { lang: 'es' },
  '/fr': { lang: 'fr' },
  '/ja': { lang: 'ja' },
  '/zh': { lang: 'zh' },
  '/hi': { lang: 'hi' },
};

/**
 * Detect the current locale from the URL pathname and apply its lang to <html>.
 * @param {Object} [locales] - Locale map (defaults to LOCALES)
 * @returns {{ prefix: string, lang: string }}
 */
export function getLocale(locales = LOCALES) {
  const { pathname } = window.location;
  const matches = Object.keys(locales).filter(
    (prefix) => prefix !== '' && pathname.startsWith(`${prefix}/`),
  );
  const prefix = matches.sort((a, b) => b.length - a.length)[0] || '';
  const locale = locales[prefix] || locales[''];

  document.documentElement.lang = locale?.lang || 'en';
  return { prefix, ...locale };
}

/**
 * A page opts into gated content with `<meta name="gated" content="true">`.
 * Same signal the CDN gating worker looks for; author preview uses it too.
 * @returns {boolean}
 */
export function isGatedPage() {
  return String(getMetadata('gated') || '').trim().toLowerCase() === 'true';
}

const placeholdersCache = new Map();

/**
 * Fetches placeholders.json for the given locale prefix, falling back to the root file
 * (same locale-then-root fallback used for fragments) if a locale-specific one doesn't
 * exist or fails to load. Cached per prefix; concurrent calls for the same prefix share
 * the same in-flight promise. Keys are read from a `Key`/`Value` sheet and converted to
 * camelCase (e.g. `Social Share Copy Label` becomes `socialShareCopyLabel`).
 * @param {string} [prefix] locale prefix from getLocale() (e.g. '/de'), '' for default
 * @returns {Promise<Object<string, string>>} placeholder values keyed by camelCase key;
 *   empty object if no placeholders.json could be loaded
 */
export async function fetchPlaceholders(prefix = '') {
  if (!placeholdersCache.has(prefix)) {
    placeholdersCache.set(prefix, (async () => {
      const paths = prefix ? [`${prefix}/placeholders.json`, '/placeholders.json'] : ['/placeholders.json'];
      const placeholders = {};

      // eslint-disable-next-line no-restricted-syntax
      for (const path of paths) {
        let json = null;
        try {
          // eslint-disable-next-line no-await-in-loop
          const resp = await fetch(path);
          // eslint-disable-next-line no-await-in-loop
          if (resp.ok) json = await resp.json();
        } catch {
          json = null;
        }

        if (json) {
          (json?.data || []).forEach((row) => {
            const key = toCamelCase(String(row.Key ?? row.key ?? '').trim());
            if (key) placeholders[key] = String(row.Value ?? row.value ?? '');
          });
          break;
        }
      }

      return placeholders;
    })());
  }
  return placeholdersCache.get(prefix);
}

/** Shared utilities for query-index driven blocks. */

export function createTag(tag, attributes = {}, content = null) {
  const el = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    el.setAttribute(key, String(value));
  });
  if (content !== null && content !== undefined) {
    if (Array.isArray(content)) {
      content.forEach((item) => {
        if (item != null) el.append(item);
      });
    } else {
      el.append(content);
    }
  }
  return el;
}

/**
 * Resolve document vs shadow-root context for blocks that attach global UI.
 * @param {Element} block
 * @returns {{
 *   root: Document|ShadowRoot,
 *   body: HTMLElement,
 *   eventRoot: Document|ShadowRoot,
 *   isEmbed: boolean
 * }}
 */
export function getBlockContext(block) {
  const root = block.getRootNode();
  const isEmbed = root !== document;
  return {
    root,
    body: isEmbed ? root.querySelector('body') : document.body,
    eventRoot: isEmbed ? root : document,
    isEmbed,
  };
}

export const QUERY_INDEX_PAGE_SIZE = 500;

export function formatDate(dateValue) {
  if (!dateValue) return '';
  const normalized = String(dateValue).trim();
  if (!normalized) return '';

  let date;
  if (/^[0-9]+$/.test(normalized)) {
    const ts = Number(normalized);
    date = new Date(ts < 1e12 ? ts * 1000 : ts);
  } else {
    date = new Date(normalized);
  }

  if (Number.isNaN(date.getTime()) || date.getFullYear() < 1970) return '';

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function normalizePath(path = '') {
  if (!path) return '#';
  return path.startsWith('/') ? path : `/${path}`;
}

export function parseKeywords(raw) {
  if (raw == null || raw === '') return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .flatMap((value) => String(value).split(','))
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

/** Skip utility / noindex rows from query-index driven blocks. */
export function isQueryableRow(row) {
  if (!row?.path || !row?.title) return false;
  const robots = String(row.robots || '').toLowerCase();
  return !robots.includes('noindex');
}

export function getContentTimestamp(entry = {}) {
  const value = entry.lastModified || entry.date || entry.publisheddate;
  if (!value) return 0;
  if (/^[0-9]+$/.test(String(value))) return Number(value);
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function fetchQueryIndexPage(offset, limit, baseUrl = '') {
  const path = `/query-index.json?offset=${offset}&limit=${limit}`;
  const url = baseUrl ? `${String(baseUrl).replace(/\/+$/, '')}${path}` : path;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Query index request failed: ${resp.status}`);
  const json = await resp.json();
  return json?.data || [];
}
