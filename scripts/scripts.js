import {
  buildBlock,
  decorateBlock,
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadCSS,
  sampleRUM,
  getMetadata,
} from './aem.js';

const COLOR_SCHEME_KEY = 'color-scheme';

/**
 * Applies light or dark color scheme to the page.
 * @param {string} [scheme] 'light-scheme' or 'dark-scheme'
 */
export function applyColorScheme(scheme) {
  let pref = scheme;
  if (!pref) {
    try {
      pref = localStorage.getItem(COLOR_SCHEME_KEY);
    } catch (e) {
      // ignore
    }
  }
  if (pref !== 'light-scheme' && pref !== 'dark-scheme') {
    pref = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-scheme' : 'light-scheme';
  }
  document.body.classList.remove('light-scheme', 'dark-scheme');
  document.body.classList.add(pref);
  try {
    localStorage.setItem(COLOR_SCHEME_KEY, pref);
  } catch (e) {
    // ignore
  }
}

/** Toggles between light and dark color scheme. */
export function toggleColorScheme() {
  applyColorScheme(document.body.classList.contains('dark-scheme') ? 'light-scheme' : 'dark-scheme');
}

applyColorScheme();

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    if (h1.closest('.hero') || picture.closest('.hero')) {
      return;
    }
    const textElems = [h1];
    let sibling = h1.nextElementSibling;
    while (sibling?.tagName === 'P' && !sibling.classList.contains('button-wrapper')) {
      textElems.push(sibling);
      sibling = sibling.nextElementSibling;
    }
    const section = document.createElement('div');
    section.append(buildBlock('hero', [
      [{ elems: [picture] }],
      [{ elems: textElems }],
    ]));
    main.prepend(section);
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/** Hash that opts out of fragment auto-blocking. Links with #_dnb stay as normal links. */
const DNB_HASH = '#_dnb';

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'youtu.be']);

function isYoutubeLink(url) {
  return YOUTUBE_HOSTS.has(url.hostname);
}

function replaceParagraphWithBlock(link, block) {
  const parent = link.parentElement;
  if (parent?.tagName === 'P' && parent.children.length === 1) {
    parent.replaceWith(block);
  } else {
    link.replaceWith(block);
  }
}

function buildEmbedBlocks(main) {
  main.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]').forEach((anchor) => {
    if (anchor.closest('.embed.block')) return;
    if (anchor.querySelector('.icon')) return;

    let url;
    try {
      url = new URL(anchor.href);
    } catch {
      return;
    }
    if (!isYoutubeLink(url)) return;

    const block = buildBlock('embed', [[anchor.cloneNode(true)]]);
    replaceParagraphWithBlock(anchor, block);
    decorateBlock(block);
  });
}

/**
 * Inlines fragment links in a section.
 * @param {Element} section The section element
 */
async function loadFragments(section) {
  const links = [...section.querySelectorAll('a[href*="/fragments/"]')]
    .filter((a) => !a.closest('.fragment'));
  const fragments = links.filter((a) => {
    if (a.href.includes(DNB_HASH)) {
      a.href = a.href.replace(DNB_HASH, '').replace(/#$/, '');
      return false;
    }
    return true;
  });
  if (fragments.length === 0) return;

  // eslint-disable-next-line import/no-cycle
  const { loadFragment } = await import('../blocks/fragment/fragment.js');
  await Promise.all(fragments.map(async (a) => {
    try {
      const { pathname } = new URL(a.href);
      const frag = await loadFragment(pathname);
      if (!frag) return;
      a.parentElement.replaceWith(...frag.children);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Fragment loading failed', error);
    }
  }));
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
    buildEmbedBlocks(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

function loadErrorPage(main) {
  if (window.errorCode === '404') {
    const fragmentPath = '/fragments/404';
    const fragmentLink = document.createElement('a');
    fragmentLink.href = fragmentPath;
    fragmentLink.textContent = fragmentPath;
    const fragment = buildBlock('fragment', [[fragmentLink]]);
    const section = main.querySelector('.section');
    if (section) section.replaceChildren(fragment);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) {
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/** Applies data-background on sections as background-color (hex, rgb, named colors). */
function applySectionBackgrounds(main) {
  main.querySelectorAll('.section[data-background]').forEach((section) => {
    section.style.backgroundColor = section.getAttribute('data-background');
  });
}

async function loadTemplate(doc, template) {
  try {
    if (template) {
      const mod = await import(`../templates/${template}/${template}.js`);
      loadCSS(`${window.hlx.codeBasePath}/templates/${template}/${template}.css`);
      if (mod.default) await mod.default(doc);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Template loading failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  applySectionBackgrounds(main);
  decorateBlocks(main);
  decorateButtons(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  try {
    if (!localStorage.getItem(COLOR_SCHEME_KEY)) {
      if (document.body.classList.contains('dark')) applyColorScheme('dark-scheme');
      else if (document.body.classList.contains('light')) applyColorScheme('light-scheme');
    }
  } catch (e) {
    // ignore
  }
  const main = doc.querySelector('main');
  if (main) {
    if (window.isErrorPage) loadErrorPage(main);
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), async (s) => {
      await waitForFirstImage(s);
      await loadFragments(s);
    });
  }

  try {
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const templateName = getMetadata('template');
  if (templateName) await loadTemplate(doc, templateName);

  const main = doc.querySelector('main');
  if (main) {
    const sections = [...main.querySelectorAll('.section')];
    for (let i = 0; i < sections.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await loadSection(sections[i], loadFragments);
      if (i === 0 && sampleRUM.enhance) sampleRUM.enhance();
    }

    const { default: dynamicBlocks } = await import('../blocks/dynamic/index.js');
    await dynamicBlocks(main);
  }

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  // Enable Quick Edit for Experience Workspace
  const loadQuickEdit = async (...args) => {
    // eslint-disable-next-line import/no-cycle
    const { default: initQuickEdit } = await import('../tools/quick-edit/quick-edit.js');
    initQuickEdit(...args);
  };

  const addSidekickListeners = (sk) => {
    sk.addEventListener('custom:quick-edit', loadQuickEdit);
  };

  const sk = document.querySelector('aem-sidekick');
  if (sk) {
    addSidekickListeners(sk);
  } else {
    // wait for sidekick to be loaded
    document.addEventListener('sidekick-ready', () => {
    // sidekick now loaded
      addSidekickListeners(document.querySelector('aem-sidekick'));
    }, { once: true });
  }
}

(() => {
  const hasQE = new URL(window.location.href).searchParams.has('quick-edit');
  // eslint-disable-next-line import/no-cycle
  if (hasQE) import('../tools/quick-edit/quick-edit.js').then((mod) => mod.default());
})();

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
}

export async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
