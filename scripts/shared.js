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
