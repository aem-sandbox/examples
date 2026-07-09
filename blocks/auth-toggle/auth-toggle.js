/**
 * Floating author-only "AUTH STATE" panel used to preview gated content in author/dev
 * environments. Not authored directly — injected via {@link createAuthToggle}.
 */
import { loadCSS } from '../../scripts/aem.js';
import { createTag, isGatedPage } from '../../scripts/shared.js';

const CSS_CLASSES = {
  TOGGLE: 'auth-toggle',
  HANDLE: 'auth-handle',
  HANDLE_ICON: 'auth-handle-icon',
  HEADER: 'auth-header',
  CLOSE: 'auth-close',
  OPTIONS: 'auth-options',
  OPTION_BUTTON: 'auth-option-button',
  EXPANDED: 'expanded',
  HIDDEN: 'hidden',
  VISIBLE: 'visible',
  BOUNCE: 'bounce',
  CURRENT_STATE: 'current-state',
  AUTHENTICATED: 'authenticated',
  ANONYMOUS: 'anonymous',
};

/**
 * @returns {boolean} true when auth=true query param is set
 */
function getAuthState() {
  const authValue = new URLSearchParams(window.location.search).get('auth');
  return authValue === 'true';
}

/**
 * @param {Element} block
 * @returns {Element}
 */
export default function decorate(block) {
  if (!isGatedPage()) {
    block.remove();
    return block;
  }

  const currentState = getAuthState();
  let isExpanded = false;

  block.innerHTML = '';
  block.id = CSS_CLASSES.TOGGLE;
  block.classList.add(CSS_CLASSES.TOGGLE);

  const handleIcon = createTag('div', { class: CSS_CLASSES.HANDLE_ICON }, 'AUTH STATE');
  const handle = createTag('button', {
    type: 'button',
    class: CSS_CLASSES.HANDLE,
    title: 'Open or close auth preview',
    'aria-label': 'Auth preview panel',
    'aria-expanded': 'false',
  }, handleIcon);

  const headerText = createTag('span', {}, 'Auth State');
  const closeBtn = createTag('button', {
    class: CSS_CLASSES.CLOSE,
    type: 'button',
    'aria-label': 'Close auth panel',
  }, 'x');
  const header = createTag('div', { class: CSS_CLASSES.HEADER }, [headerText, closeBtn]);

  const panelBody = createTag('div', { class: 'auth-toggle-body', id: `${block.id || CSS_CLASSES.TOGGLE}-panel` });
  panelBody.setAttribute('role', 'region');
  panelBody.setAttribute('aria-label', 'Auth preview');
  handle.setAttribute('aria-controls', panelBody.id);

  const optionsContainer = createTag('div', { class: CSS_CLASSES.OPTIONS });
  const currentStateIndicator = createTag('div', {
    class: `${CSS_CLASSES.OPTION_BUTTON} ${CSS_CLASSES.CURRENT_STATE}`,
  }, currentState ? 'Authenticated' : 'Anonymous');

  const switchButton = createTag('button', {
    class: CSS_CLASSES.OPTION_BUTTON,
    type: 'button',
    'data-auth-state': currentState ? CSS_CLASSES.ANONYMOUS : CSS_CLASSES.AUTHENTICATED,
  }, currentState ? 'Switch to Anonymous' : 'Switch to Authenticated');

  optionsContainer.append(currentStateIndicator, switchButton);
  panelBody.append(header, optionsContainer);

  /**
   * Collapses the panel when a click lands outside the block.
   * @param {MouseEvent} event
   */
  function handleClickOutside(event) {
    if (block.contains(event.target)) return;
    if (isExpanded) {
      isExpanded = false;
      block.classList.remove(CSS_CLASSES.EXPANDED);
      handle.classList.remove(CSS_CLASSES.HIDDEN);
      handle.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', handleClickOutside);
    }
  }

  /** Expands or collapses the panel and toggles the outside-click listener accordingly. */
  function togglePanel() {
    isExpanded = !isExpanded;
    block.classList.toggle(CSS_CLASSES.EXPANDED, isExpanded);
    handle.classList.toggle(CSS_CLASSES.HIDDEN, isExpanded);
    handle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    if (isExpanded) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  }

  /**
   * Navigates to the current page with `?auth=` set to preview the chosen state.
   * @param {string} targetState CSS_CLASSES.AUTHENTICATED or CSS_CLASSES.ANONYMOUS
   */
  function handleOptionClick(targetState) {
    const url = new URL(window.location.href);
    if (targetState === CSS_CLASSES.AUTHENTICATED) {
      url.searchParams.set('auth', 'true');
    } else if (targetState === CSS_CLASSES.ANONYMOUS) {
      url.searchParams.set('auth', 'false');
    }
    window.location.href = url.toString();
  }

  handle.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel();
  });
  closeBtn.addEventListener('click', togglePanel);
  switchButton.addEventListener('click', () => {
    handleOptionClick(switchButton.getAttribute('data-auth-state'));
  });

  block.append(handle, panelBody);

  block.cleanup = () => {
    document.removeEventListener('click', handleClickOutside);
  };

  requestAnimationFrame(() => {
    block.classList.add(CSS_CLASSES.VISIBLE);
    setTimeout(() => {
      handle.classList.add(CSS_CLASSES.BOUNCE);
      setTimeout(() => handle.classList.remove(CSS_CLASSES.BOUNCE), 400);
    }, 300);
  });

  return block;
}

/**
 * Injects the floating auth-state toggle used to preview gated content while authoring.
 * @returns {Promise<HTMLElement|undefined>}
 */
export async function createAuthToggle() {
  if (!isGatedPage()) return undefined;

  await loadCSS(`${window.hlx.codeBasePath}/blocks/auth-toggle/auth-toggle.css`);
  const block = createTag('div', { class: CSS_CLASSES.TOGGLE });
  document.body.append(block);
  return decorate(block);
}
