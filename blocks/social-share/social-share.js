import { createTag, getLocale } from '../../scripts/shared.js';
import { fetchPlaceholders } from '../../scripts/placeholders.js';

const FEEDBACK_RESET_MS = 2000;

const ACTIONS = [
  {
    id: 'copy',
    labelKey: 'socialShareCopyLabel',
    fallbackLabel: 'Copy page link',
    type: 'button',
    icon: 'copy',
  },
  {
    id: 'native',
    labelKey: 'socialShareNativeLabel',
    fallbackLabel: 'Share this page',
    type: 'button',
    icon: 'share',
    isAvailable: () => typeof navigator.share === 'function',
  },
  {
    id: 'x',
    labelKey: 'socialShareXLabel',
    fallbackLabel: 'Share on X',
    type: 'link',
    icon: 'x',
    getHref: ({ url, title }) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'linkedin',
    labelKey: 'socialShareLinkedinLabel',
    fallbackLabel: 'Share on LinkedIn',
    type: 'link',
    icon: 'linkedin',
    getHref: ({ url }) => `https://www.linkedin.com/feed/?shareActive=true&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'email',
    labelKey: 'socialShareEmailLabel',
    fallbackLabel: 'Share by email',
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
 * @param {Object<string, string>} placeholders localized strings, keyed by camelCase key
 * @returns {{url: string, title: string}} the current page's canonical URL and title
 */
function getShareData(placeholders) {
  const canonicalHref = document.querySelector('link[rel="canonical"]')?.href;
  const url = canonicalHref || window.location.href;
  const title = document.querySelector('meta[property="og:title"]')?.content
    || document.title
    || placeholders.socialShareUntitledFallback;

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
 * reverting to resetLabel after FEEDBACK_RESET_MS. The reset timer is stashed on
 * `block` and cleared before scheduling a new one, so rapid repeat clicks don't stack
 * timers and reset the button mid-feedback.
 * @param {Element} block
 * @param {Element} button the copy button
 * @param {string} message
 * @param {string} iconName 'check' on success, 'copy' on error
 * @param {string} resetLabel the copy button's normal (localized) label
 * @returns {Promise<void>}
 */
async function setCopyFeedback(block, button, message, iconName, resetLabel) {
  const status = block.querySelector('.social-share-status');
  const icon = button.querySelector('.social-share-icon');

  clearTimeout(block.socialShareFeedbackTimer);

  block.classList.remove('is-copied', 'is-copy-error');
  block.classList.add(iconName === 'check' ? 'is-copied' : 'is-copy-error');
  button.setAttribute('aria-label', message);
  status.textContent = message;
  icon.replaceChildren(await createIcon(iconName));

  block.socialShareFeedbackTimer = window.setTimeout(async () => {
    block.classList.remove('is-copied', 'is-copy-error');
    button.setAttribute('aria-label', resetLabel);
    status.textContent = '';
    icon.replaceChildren(await createIcon('copy'));
  }, FEEDBACK_RESET_MS);
}

/**
 * Builds one share action (button or link) from an ACTIONS entry.
 * @param {Object} action an entry from ACTIONS
 * @param {{url: string, title: string}} shareData
 * @param {Element} block
 * @param {Object<string, string>} placeholders localized strings, keyed by camelCase key
 * @returns {Promise<Element>} an <li> containing the action
 */
async function buildAction(action, shareData, block, placeholders) {
  const label = placeholders[action.labelKey] || action.fallbackLabel;
  const item = createTag('li', { class: 'social-share-item' });
  const icon = createTag('span', { class: 'social-share-icon' }, await createIcon(action.icon));

  if (action.type === 'button') {
    const button = createTag('button', {
      class: `social-share-action social-share-action-${action.id}`,
      type: 'button',
      'aria-label': label,
      title: label,
    }, icon);

    if (action.id === 'copy') {
      button.addEventListener('click', async () => {
        try {
          await copyToClipboard(shareData.url);
          await setCopyFeedback(
            block,
            button,
            placeholders.socialShareCopySuccess || 'Page link copied',
            'check',
            label,
          );
        } catch {
          await setCopyFeedback(
            block,
            button,
            placeholders.socialShareCopyError || 'Unable to copy page link',
            'copy',
            label,
          );
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
    'aria-label': label,
    title: label,
  }, icon);

  item.append(link);
  return item;
}

/**
 * Loads and decorates the social-share block: replaces any authored content with a
 * floating share dock (copy link, native share when available, X, LinkedIn, email).
 * Labels come from placeholders.json for the current locale, falling back to English.
 * @param {Element} block
 * @returns {Promise<void>}
 */
export default async function decorate(block) {
  const { prefix } = getLocale();
  const placeholders = await fetchPlaceholders(prefix || 'default');
  const shareData = getShareData(placeholders);
  const dock = createTag('nav', {
    class: 'social-share-dock',
    'aria-label': placeholders.socialShareDockLabel || 'Share this page',
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
      .map((action) => buildAction(action, shareData, block, placeholders)),
  );
  items.forEach((item) => list.append(item));

  dock.append(list, status);
  block.replaceChildren(dock);
}
