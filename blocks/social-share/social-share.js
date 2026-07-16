import { createTag } from '../../scripts/shared.js';

const FEEDBACK_RESET_MS = 2000;

const ACTIONS = [
  {
    id: 'copy',
    label: 'Copy page link',
    type: 'button',
    icon: 'copy',
  },
  {
    id: 'native',
    label: 'Share this page',
    type: 'button',
    icon: 'share',
    isAvailable: () => typeof navigator.share === 'function',
  },
  {
    id: 'x',
    label: 'Share on X',
    type: 'link',
    icon: 'x',
    getHref: ({ url, title }) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'linkedin',
    label: 'Share on LinkedIn',
    type: 'link',
    icon: 'linkedin',
    getHref: ({ url }) => `https://www.linkedin.com/feed/?shareActive=true&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'email',
    label: 'Share by email',
    type: 'link',
    icon: 'email',
    getHref: ({ url, title }) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`,
  },
];

const iconCache = new Map();

/**
 * Fetches an icon's SVG markup from /icons/social-share-{name}.svg and parses out its
 * root <svg> element. Cached per name so each icon is only ever fetched once; concurrent
 * requests for the same name share the same in-flight promise.
 * @param {string} name
 * @returns {Promise<SVGElement|null>} null if the icon couldn't be fetched or parsed
 */
async function loadIcon(name) {
  if (!iconCache.has(name)) {
    iconCache.set(name, (async () => {
      try {
        const resp = await fetch(`${window.hlx.codeBasePath}/icons/social-share-${name}.svg`);
        if (!resp.ok) return null;
        const template = document.createElement('template');
        template.innerHTML = (await resp.text()).trim();
        return template.content.querySelector('svg');
      } catch {
        return null;
      }
    })());
  }
  return iconCache.get(name);
}

/**
 * @param {string} name
 * @returns {Promise<Element>} a fresh clone of the cached icon, so each caller can own
 * and mutate its own copy; an empty span if the icon couldn't be loaded
 */
async function createIcon(name) {
  const svg = await loadIcon(name);
  return svg ? svg.cloneNode(true) : document.createElement('span');
}

/**
 * @returns {{url: string, title: string}} the current page's canonical URL and title
 */
function getShareData() {
  const canonicalHref = document.querySelector('link[rel="canonical"]')?.href;
  const url = canonicalHref || window.location.href;
  const title = document.querySelector('meta[property="og:title"]')?.content || document.title || 'Untitled page';

  return { url, title };
}

/**
 * Copies text to the clipboard, falling back to a hidden input + execCommand when the
 * async Clipboard API isn't available.
 * @param {string} text
 * @returns {Promise<void>}
 */
async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = createTag('input', {
    type: 'text',
    value: text,
    readonly: '',
    tabindex: '-1',
  });

  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

/**
 * Shows temporary success/error feedback on the copy button (icon + status text),
 * reverting after FEEDBACK_RESET_MS.
 * @param {Element} block
 * @param {Element} button the copy button
 * @param {string} message
 * @param {string} iconName 'check' on success, 'copy' on error
 * @returns {Promise<void>}
 */
async function setCopyFeedback(block, button, message, iconName) {
  const status = block.querySelector('.social-share-status');
  const icon = button.querySelector('.social-share-icon');

  block.classList.remove('is-copied', 'is-copy-error');
  block.classList.add(iconName === 'check' ? 'is-copied' : 'is-copy-error');
  button.setAttribute('aria-label', message);
  status.textContent = message;
  icon.replaceChildren(await createIcon(iconName));

  window.setTimeout(async () => {
    block.classList.remove('is-copied', 'is-copy-error');
    button.setAttribute('aria-label', 'Copy page link');
    status.textContent = '';
    icon.replaceChildren(await createIcon('copy'));
  }, FEEDBACK_RESET_MS);
}

/**
 * Builds one share action (button or link) from an ACTIONS entry.
 * @param {Object} action an entry from ACTIONS
 * @param {{url: string, title: string}} shareData
 * @param {Element} block
 * @returns {Promise<Element>} an <li> containing the action
 */
async function buildAction(action, shareData, block) {
  const item = createTag('li', { class: 'social-share-item' });
  const icon = createTag('span', { class: 'social-share-icon' }, await createIcon(action.icon));
  const label = createTag('span', { class: 'social-share-sr-only' }, action.label);

  if (action.type === 'button') {
    const button = createTag('button', {
      class: `social-share-action social-share-action-${action.id}`,
      type: 'button',
      'aria-label': action.label,
      title: action.label,
    }, [icon, label]);

    if (action.id === 'copy') {
      button.addEventListener('click', async () => {
        try {
          await copyToClipboard(shareData.url);
          await setCopyFeedback(block, button, 'Page link copied', 'check');
        } catch {
          await setCopyFeedback(block, button, 'Unable to copy page link', 'copy');
        }
      });
    }

    if (action.id === 'native') {
      button.addEventListener('click', async () => {
        try {
          await navigator.share(shareData);
        } catch {
          // Ignore canceled native-share dialogs.
        }
      });
    }

    item.append(button);
    return item;
  }

  const link = createTag('a', {
    class: `social-share-action social-share-action-${action.id}`,
    href: action.getHref(shareData),
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-label': action.label,
    title: action.label,
  }, [icon, label]);

  item.append(link);
  return item;
}

/**
 * Loads and decorates the social-share block: replaces any authored content with a
 * floating share dock (copy link, native share when available, X, LinkedIn, email).
 * @param {Element} block
 * @returns {Promise<void>}
 */
export default async function decorate(block) {
  const shareData = getShareData();
  const dock = createTag('nav', {
    class: 'social-share-dock',
    'aria-label': 'Share this page',
  });
  const list = createTag('ul', { class: 'social-share-list' });
  const status = createTag('span', {
    class: 'social-share-status social-share-sr-only',
    role: 'status',
    'aria-live': 'polite',
  });

  const items = await Promise.all(
    ACTIONS
      .filter((action) => !action.isAvailable || action.isAvailable())
      .map((action) => buildAction(action, shareData, block)),
  );
  items.forEach((item) => list.append(item));

  dock.append(list, status);
  block.replaceChildren(dock);
}
