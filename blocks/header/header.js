import { decorateIcons, getMetadata } from '../../scripts/aem.js';
import { toggleColorScheme } from '../../scripts/scripts.js';
import {
  getLoginUrl,
  getLogoutUrl,
  getDefaultAuthLabel,
  getSessionState,
} from '../../scripts/shared/auth-api.js';

/** Matches styles.css desktop breakpoint. */
const DESKTOP_BP = '(min-width: 900px)';
const isDesktop = window.matchMedia(DESKTOP_BP);

const NAV_ITEMS = 'ul > li';

function collapseNav(nav) {
  nav?.querySelectorAll('.nav-drop').forEach((item) => {
    item.setAttribute('aria-expanded', 'false');
  });
}

function syncMobileNavHeight(nav) {
  if (isDesktop.matches) {
    nav.style.removeProperty('--nav-open-height');
    return;
  }
  nav.style.setProperty('--nav-open-height', `${window.innerHeight}px`);
}

function toggleMenu(nav, forceOpen) {
  const open = forceOpen ?? nav.getAttribute('aria-expanded') !== 'true';
  document.body.style.overflowY = open && !isDesktop.matches ? 'hidden' : '';
  nav.setAttribute('aria-expanded', open ? 'true' : 'false');
  nav.querySelector('.nav-hamburger button')?.setAttribute(
    'aria-label',
    open ? 'Close navigation' : 'Open navigation',
  );
  if (!open) collapseNav(nav);
  syncMobileNavHeight(nav);
}

function closeOnEscape(e) {
  if (e.code !== 'Escape') return;
  const nav = document.getElementById('nav');
  if (!nav) return;
  if (!isDesktop.matches && nav.getAttribute('aria-expanded') === 'true') {
    toggleMenu(nav, false);
  } else if (isDesktop.matches) {
    collapseNav(nav);
  }
}

/** Fetch nav plain HTML without section decoration. */
async function loadNavFragment(path) {
  if (!path?.startsWith('/') || path.startsWith('//')) return null;
  const resp = await fetch(`${path}.plain.html`);
  if (!resp.ok) return null;
  const container = document.createElement('div');
  container.innerHTML = await resp.text();
  return container;
}

function syncSubmenuToggle(li, toggleBtn) {
  const expanded = li.getAttribute('aria-expanded') === 'true';
  toggleBtn.setAttribute('aria-expanded', String(expanded));
  toggleBtn.setAttribute('aria-label', expanded ? 'Collapse submenu' : 'Expand submenu');
}

function setupDropdown(li) {
  const submenu = li.querySelector(':scope > ul');
  const heading = li.querySelector(':scope > p');
  if (!submenu || !heading) return;

  let toggleBtn = heading.querySelector('.nav-submenu-toggle');
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'nav-submenu-toggle';
    heading.append(toggleBtn);
  }
  syncSubmenuToggle(li, toggleBtn);

  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const expanded = li.getAttribute('aria-expanded') === 'true';
    collapseNav(li.closest('nav'));
    li.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    syncSubmenuToggle(li, toggleBtn);
  });

  li.addEventListener('click', (e) => {
    if (e.target.closest('.nav-submenu-toggle')) return;

    if (isDesktop.matches) {
      if (submenu.contains(e.target) && e.target.closest('a')) {
        collapseNav(li.closest('nav'));
        return;
      }
      e.preventDefault();
      const expanded = li.getAttribute('aria-expanded') === 'true';
      collapseNav(li.closest('nav'));
      li.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      syncSubmenuToggle(li, toggleBtn);
      return;
    }

    const onLink = e.target.closest('a');
    if (onLink && !submenu.contains(onLink)) return;
    if (onLink && submenu.contains(onLink)) {
      toggleMenu(li.closest('nav'), false);
      return;
    }
    e.preventDefault();
    const expanded = li.getAttribute('aria-expanded') === 'true';
    collapseNav(li.closest('nav'));
    li.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    syncSubmenuToggle(li, toggleBtn);
  });

  li.addEventListener('focusout', (e) => {
    if (!li.contains(e.relatedTarget)) {
      li.setAttribute('aria-expanded', 'false');
      syncSubmenuToggle(li, toggleBtn);
    }
  });
}

function initThemeToggle(tools) {
  if (!tools) return null;

  let btn = tools.querySelector('.nav-theme-toggle');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-theme-toggle nav-tool';
    btn.innerHTML = '<span class="icon icon-toggle"></span>';
  }

  const updateLabel = () => {
    const isDark = document.body.classList.contains('dark-scheme');
    btn.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleColorScheme();
    updateLabel();
  });

  updateLabel();
  return btn;
}

/**
 * Cookie helper functions for auth state detection
 */
function hasCookieStartingWith(prefix) {
  return document.cookie
    .split(';')
    .map((entry) => decodeURIComponent(entry.split('=')[0] || '').trim())
    .some((cookieName) => cookieName.startsWith(prefix));
}

function isLoggedIn() {
  return hasCookieStartingWith('CF_Authorization');
}

/**
 * Resolves authentication state by checking session API
 * Falls back to cookie check if API fails
 */
async function resolveAuthState() {
  try {
    const session = await getSessionState();
    return {
      authenticated: Boolean(session?.authenticated),
      email: session?.email || '',
    };
  } catch (e) {
    return {
      authenticated: isLoggedIn(),
      email: '',
    };
  }
}

/**
 * Sets user info badge on auth link
 * The badge appears as a small circle with 'i' next to the button text
 */
function setAuthUserInfo(link, email) {
  link.querySelector('.nav-auth-info')?.remove();
  link.removeAttribute('title');
  link.removeAttribute('data-auth-email');

  if (!email) return;

  link.dataset.authEmail = email;
  link.setAttribute('title', email);
  const info = document.createElement('span');
  info.className = 'nav-auth-info';
  info.setAttribute('aria-hidden', 'true');
  info.setAttribute('title', email);
  info.textContent = 'ⓘ';
  link.append(info);
}

/**
 * Initialize authentication - make login/logout button functional
 */
async function initAuth(tools) {
  if (!tools) return;

  const loginLabel = getDefaultAuthLabel('login');
  const logoutLabel = getDefaultAuthLabel('logout');

  // Find existing login link or create new one
  const loginCandidate = tools.querySelector('a[href*="login" i], a[data-auth-link]');
  const shouldCreateLink = !loginCandidate;

  const authLink = loginCandidate || document.createElement('a');
  if (shouldCreateLink) {
    authLink.href = getLoginUrl();
    authLink.className = 'button nav-auth-link primary';
    tools.append(authLink);
  }

  authLink.dataset.authLink = 'true';
  if (!authLink.classList.contains('button')) authLink.classList.add('button');
  authLink.classList.add('nav-auth-link');

  // Get current auth state
  const { authenticated, email } = await resolveAuthState();

  if (authenticated) {
    // User is logged in - show logout button
    authLink.textContent = logoutLabel;
    authLink.href = getLogoutUrl();
    setAuthUserInfo(authLink, email);
  } else {
    // User is anonymous - show login button
    authLink.textContent = loginLabel;
    authLink.href = getLoginUrl();
    setAuthUserInfo(authLink, '');
  }
}

function decorateTools(tools) {
  if (!tools) return;

  const loginLink = tools.querySelector('a[href*="login" i], a.button, strong a');
  const searchLink = tools.querySelector('.icon-search')?.closest('a')
    || tools.querySelector('a[href*="search" i]');

  if (searchLink) searchLink.classList.add('nav-tool');

  if (loginLink) {
    loginLink.classList.remove('primary', 'secondary', 'accent');
    loginLink.classList.add('button', 'nav-auth-link', 'primary');
    loginLink.closest('p')?.classList.remove('button-wrapper');
  }

  const themeBtn = initThemeToggle(tools);
  [themeBtn, searchLink, loginLink].filter(Boolean).forEach((el) => {
    tools.append(el.closest('p') || el);
  });
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navPath = getMetadata('nav')
    ? new URL(getMetadata('nav'), window.location).pathname
    : '/nav';
  const fragment = await loadNavFragment(navPath);
  if (!fragment) return;

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main');
  nav.setAttribute('aria-expanded', 'false');

  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  ['brand', 'sections', 'tools'].forEach((name, index) => {
    nav.children[index]?.classList.add(`nav-${name}`);
  });

  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  hamburger.innerHTML = '<button type="button" aria-controls="nav" aria-label="Open navigation"><span class="nav-hamburger-icon"></span></button>';
  nav.prepend(hamburger);

  nav.querySelector('.nav-brand .button')?.classList.remove('button');
  nav.querySelector('.nav-brand .button-container')?.classList.remove('button-container');

  const brandLabel = document.createElement('span');
  brandLabel.className = 'nav-brand-label';
  brandLabel.textContent = 'AEM Examples';
  nav.querySelector('.nav-brand')?.append(brandLabel);

  nav.querySelectorAll(`.nav-sections ${NAV_ITEMS}`).forEach((item) => {
    if (item.querySelector(':scope > ul')) {
      item.classList.add('nav-drop');
      item.setAttribute('aria-expanded', 'false');
      item.setAttribute('aria-haspopup', 'true');
      setupDropdown(item);
    }
  });

  hamburger.querySelector('button').addEventListener('click', () => toggleMenu(nav));

  document.addEventListener('click', (e) => {
    if (nav.contains(e.target)) return;
    if (isDesktop.matches) {
      collapseNav(nav);
    } else if (nav.getAttribute('aria-expanded') === 'true') {
      toggleMenu(nav, false);
    }
  });
  document.addEventListener('keydown', closeOnEscape);

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.append(nav);
  block.append(wrapper);

  const tools = nav.querySelector('.nav-tools');
  decorateTools(tools);
  decorateIcons(nav);

  // Initialize authentication after decoration
  await initAuth(tools);

  toggleMenu(nav, false);
  isDesktop.addEventListener('change', () => toggleMenu(nav, false));
  window.addEventListener('resize', () => syncMobileNavHeight(nav));
}
