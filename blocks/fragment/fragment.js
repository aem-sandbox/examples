/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

// eslint-disable-next-line import/no-cycle
import {
  decorateMain,
} from '../../scripts/scripts.js';

import {
  loadSections,
} from '../../scripts/aem.js';

import { getLocale } from '../../scripts/shared.js';

/** Hash that opts out of localizing fragment URLs. */
const DNT_HASH = '#_dnt';

/**
 * Loads a fragment, trying the locale-prefixed path first and falling back to the original.
 * Example: on /de/page, /fragments/nav → tries /de/fragments/nav then /fragments/nav.
 * Append #_dnt to the path to skip localization for a specific fragment.
 * @param {string} path The path to the fragment (may include #_dnt hash)
 * @returns {Promise<HTMLElement>} The root element of the fragment
 */
export async function loadFragment(path) {
  if (path && path.startsWith('/') && !path.startsWith('//')) {
    const dnt = path.includes(DNT_HASH);
    const cleanPath = path.replace(DNT_HASH, '').replace(/#$/, '');

    const { prefix } = getLocale();
    const localizedPath = (!dnt && prefix) ? `${prefix}${cleanPath}` : cleanPath;

    let resp = await fetch(`${localizedPath}.plain.html`);
    let resolvedPath = localizedPath;
    if (!resp.ok && prefix && !dnt) {
      resp = await fetch(`${cleanPath}.plain.html`);
      resolvedPath = cleanPath;
    }

    if (resp.ok) {
      const main = document.createElement('main');
      main.innerHTML = await resp.text();

      const resetAttributeBase = (tag, attr) => {
        main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
          const base = new URL(resolvedPath, window.location);
          elem[attr] = new URL(elem.getAttribute(attr), base).href;
        });
      };
      resetAttributeBase('img', 'src');
      resetAttributeBase('source', 'srcset');

      decorateMain(main);
      await loadSections(main);
      return main;
    }
  }
  return null;
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadFragment(path);
  if (fragment) block.replaceChildren(...fragment.childNodes);
}
