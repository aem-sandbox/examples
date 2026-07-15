/**
 * Author/dev-only preview of gated content: hides sections/blocks the current preview
 * auth state can't see, and injects the auth-toggle panel to switch between states.
 * Mirrors the server-side rewrite in `workers/cdn/handlers/gating.js`, which is the
 * actual trust boundary in production.
 */
// eslint-disable-next-line import/no-cycle
import { createAuthToggle } from '../../blocks/auth-toggle/auth-toggle.js';
import { isGatedPage } from '../shared.js';
import { resolveAuthState } from '../shared/auth-api.js';

/**
 * Mirrors the audience rules a production CDN gating layer would apply server-side.
 * @param {Element} section
 * @returns {'logged-in'|'logged-out'|null}
 */
function audience(section) {
  const a = String(section.dataset?.view || '').trim().toLowerCase();
  if (a === 'logged-in' || a === 'logged-out') return a;

  const meta = section.querySelector('.section-metadata');
  if (!meta) return null;
  const viewDiv = [...meta.querySelectorAll('div')].find(
    (div) => div.textContent.trim().toLowerCase() === 'view',
  );
  if (!viewDiv) return null;
  const v = String(viewDiv.nextElementSibling?.textContent || '').trim().toLowerCase();
  return v === 'logged-in' || v === 'logged-out' ? v : null;
}

/**
 * Author/dev environments only; production gating must happen server-side (e.g. a CDN
 * worker in front of the real auth provider) — this preview never runs there.
 * @returns {boolean}
 */
function isAuthorEnvironment() {
  const { hostname } = window.location;
  return hostname.includes('localhost')
    || hostname.includes('aem.page')
    || hostname.includes('aem.reviews')
    || hostname.endsWith('.da.live');
}

/**
 * Resolves the preview auth state: an explicit `?auth=` override (set by the
 * auth-toggle panel) takes priority; otherwise falls back to the real session state,
 * using the same strategy as the header, so the two can't drift out of sync.
 * @returns {Promise<boolean>} true = authenticated, false = anonymous
 */
async function getAuthState() {
  const override = new URLSearchParams(window.location.search).get('auth');
  if (override === 'true' || override === 'false') return override === 'true';

  const { authenticated } = await resolveAuthState();
  return authenticated;
}

/** @returns {boolean} */
function hasGatedContent() {
  return isGatedPage();
}

/**
 * @param {Element} section
 * @param {boolean} isAuthenticated
 * @param {Array<{element: Element}>} sectionsToRemove
 */
function processSectionViewRestriction(section, isAuthenticated, sectionsToRemove) {
  const viewRestriction = audience(section);
  const shouldRemove = (
    (!isAuthenticated && viewRestriction === 'logged-in')
    || (isAuthenticated && viewRestriction === 'logged-out')
  );

  if (shouldRemove && !sectionsToRemove.some((item) => item.element === section)) {
    sectionsToRemove.push({ element: section });
  }
}

/**
 * @param {boolean} isAuthenticated
 * @returns {{sectionsToRemove: Array<{element: Element}>}}
 */
function checkSectionLevelProtection(isAuthenticated) {
  const sectionsToRemove = [];
  const sections = document.querySelectorAll('main > div');
  sections.forEach((section) => {
    processSectionViewRestriction(section, isAuthenticated, sectionsToRemove);
  });
  return { sectionsToRemove };
}

/**
 * @param {Element} section
 * @param {boolean} isAuthenticated
 */
function checkBlockProtectionInSection(section, isAuthenticated) {
  const restrictedBlocks = section.querySelectorAll('.logged-in, .logged-out');
  restrictedBlocks.forEach((block) => {
    const hasLoggedIn = block.classList.contains('logged-in');
    const hasLoggedOut = block.classList.contains('logged-out');
    if ((!isAuthenticated && hasLoggedIn) || (isAuthenticated && hasLoggedOut)) {
      block.remove();
    }
  });
}

/**
 * @param {{sectionsToRemove: Array<{element: Element}>}} protectionMetadata
 * @param {boolean} isAuthenticated
 */
function applySectionLevelProtection(protectionMetadata, isAuthenticated) {
  protectionMetadata.sectionsToRemove.forEach((sectionData) => {
    sectionData.element.remove();
  });

  const remainingSections = document.querySelectorAll('main > div');
  const publicSections = Array.from(remainingSections).filter((section) => (
    audience(section) === null
  ));

  publicSections.forEach((section) => {
    checkBlockProtectionInSection(section, isAuthenticated);
  });
}

/**
 * Applies content protection in author/dev environments when the page is gated
 * (`meta gated=true`). Removes sections/blocks the current preview auth state can't see.
 * @returns {Promise<void>}
 */
async function applyContentProtection() {
  if (!isAuthorEnvironment() || !isGatedPage()) return;

  const isAuthenticated = await getAuthState();
  const sectionProtectionMetadata = checkSectionLevelProtection(isAuthenticated);
  applySectionLevelProtection(sectionProtectionMetadata, isAuthenticated);
}

/**
 * Injects the auth-toggle panel, but only in author/dev environments on a gated page.
 * @returns {Promise<HTMLElement|undefined>}
 */
async function createAuthorToggle() {
  if (!isAuthorEnvironment() || !isGatedPage()) return undefined;
  return createAuthToggle();
}

/**
 * Registers author-only gated preview (protection + floating toggle).
 * No-op if the page isn't gated or we're not in an author environment.
 * @returns {Promise<void>}
 */
async function initContentProtection() {
  if (!isAuthorEnvironment() || !isGatedPage()) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await applyContentProtection();
      await createAuthorToggle();
    }, { once: true });
    return;
  }

  await applyContentProtection();
  await createAuthorToggle();
}

export {
  isAuthorEnvironment,
  getAuthState,
  hasGatedContent,
  isGatedPage,
  applyContentProtection,
  initContentProtection,
};
