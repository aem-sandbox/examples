export const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es'];

/**
 * Returns the language code from the first URL path segment, if present.
 * @returns {string|null} Language code or null when not on a localized root path
 */
export function getPathLanguage() {
  const [first] = window.location.pathname.split('/').filter(Boolean);
  return SUPPORTED_LANGUAGES.includes(first) ? first : null;
}

/**
 * True when the URL starts with a supported language segment (e.g. /fr/...).
 * @returns {boolean}
 */
export function isLocalizedPath() {
  return getPathLanguage() !== null;
}

/**
 * Resolves the active language from the URL path or document lang attribute.
 * @returns {string} Language code (en, fr, de, or es)
 */
export function getLanguage() {
  const pathLang = getPathLanguage();
  if (pathLang) return pathLang;
  const docLang = document.documentElement.lang?.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(docLang)) return docLang;
  return 'en';
}

/**
 * Builds a URL for the same page in another language (/en/path → /fr/path).
 * @param {string} lang - Target language code
 * @returns {string} Localized URL including query and hash
 */
export function buildLanguageUrl(lang) {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const rest = getPathLanguage() ? segments.slice(1) : segments;
  const path = rest.join('/');
  const suffix = `${window.location.search}${window.location.hash}`;
  return path ? `/${lang}/${path}${suffix}` : `/${lang}${suffix}`;
}
