import { createTag } from '../../scripts/shared.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
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

const ICON_PATHS = {
  copy: [
    { d: 'M9 9.75A2.25 2.25 0 0 1 11.25 7.5h7.5A2.25 2.25 0 0 1 21 9.75v7.5a2.25 2.25 0 0 1-2.25 2.25h-7.5A2.25 2.25 0 0 1 9 17.25v-7.5Z' },
    { d: 'M15 7.5v-.75A2.25 2.25 0 0 0 12.75 4.5h-7.5A2.25 2.25 0 0 0 3 6.75v7.5a2.25 2.25 0 0 0 2.25 2.25H6' },
  ],
  share: [
    { d: 'M7 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
    { d: 'M17.5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
    { d: 'M17.5 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
    { d: 'm9.6 9.85 5.3-3.05' },
    { d: 'm9.6 14.15 5.3 3.05' },
  ],
  x: [
    {
      d: 'M18.244 2.25H21.55L14.323 10.51L22.827 21.75H16.17L10.956 14.933L4.99 21.75H1.68L9.41 12.915L1.254 2.25H8.08L12.793 8.481L18.244 2.25ZM17.083 19.77H18.915L7.084 4.126H5.117L17.083 19.77Z',
      fill: 'currentColor',
      stroke: 'none',
    },
  ],
  linkedin: [
    {
      d: 'M22.225 0H1.771C0.792 0 0 0.774 0 1.729V22.27C0 23.227 0.792 24 1.771 24H22.222C23.2 24 24 23.227 24 22.271V1.729C24 0.774 23.2 0 22.222 0H22.225ZM7.119 20.452H3.555V9H7.119V20.452ZM5.337 7.433C4.194 7.433 3.274 6.509 3.274 5.37C3.274 4.231 4.194 3.307 5.337 3.307C6.476 3.307 7.4 4.231 7.4 5.37C7.4 6.509 6.476 7.433 5.337 7.433ZM20.452 20.452H16.9V14.882C16.9 13.554 16.873 11.845 15.046 11.845C13.192 11.845 12.91 13.29 12.91 14.786V20.452H9.358V9H12.77V10.561H12.817C13.294 9.661 14.454 8.711 16.187 8.711C19.788 8.711 20.452 11.082 20.452 14.166V20.452Z',
      fill: 'currentColor',
      stroke: 'none',
    },
  ],
  email: [
    { d: 'M3.75 7.5h16.5A1.5 1.5 0 0 1 21.75 9v10.5a1.5 1.5 0 0 1-1.5 1.5H3.75A1.5 1.5 0 0 1 2.25 19.5V9a1.5 1.5 0 0 1 1.5-1.5Z' },
    { d: 'm3 9 9 6.75L21 9' },
  ],
  check: [
    { d: 'm5.25 12.75 4.5 4.5 9-9' },
  ],
};

/**
 * Builds an inline SVG icon from ICON_PATHS, so the block has no external icon
 * dependency.
 * @param {string} name key into ICON_PATHS
 * @returns {SVGElement}
 */
function createIcon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  (ICON_PATHS[name] || []).forEach((definition) => {
    const path = document.createElementNS(SVG_NS, 'path');
    const {
      d,
      fill = 'none',
      stroke = 'currentColor',
      strokeWidth = '1.75',
      strokeLinecap = 'round',
      strokeLinejoin = 'round',
    } = typeof definition === 'string' ? { d: definition } : definition;

    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    path.setAttribute('stroke', stroke);
    if (stroke !== 'none') {
      path.setAttribute('stroke-linecap', strokeLinecap);
      path.setAttribute('stroke-linejoin', strokeLinejoin);
      path.setAttribute('stroke-width', strokeWidth);
    }
    svg.append(path);
  });

  return svg;
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
 * @returns {void}
 */
function setCopyFeedback(block, button, message, iconName) {
  const status = block.querySelector('.social-share-status');
  const icon = button.querySelector('.social-share-icon');

  block.classList.remove('is-copied', 'is-copy-error');
  block.classList.add(iconName === 'check' ? 'is-copied' : 'is-copy-error');
  button.setAttribute('aria-label', message);
  status.textContent = message;
  icon.replaceChildren(createIcon(iconName));

  window.setTimeout(() => {
    block.classList.remove('is-copied', 'is-copy-error');
    button.setAttribute('aria-label', 'Copy page link');
    status.textContent = '';
    icon.replaceChildren(createIcon('copy'));
  }, FEEDBACK_RESET_MS);
}

/**
 * Builds one share action (button or link) from an ACTIONS entry.
 * @param {Object} action an entry from ACTIONS
 * @param {{url: string, title: string}} shareData
 * @param {Element} block
 * @returns {Element} an <li> containing the action
 */
function buildAction(action, shareData, block) {
  const item = createTag('li', { class: 'social-share-item' });
  const icon = createTag('span', { class: 'social-share-icon' }, createIcon(action.icon));
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
          setCopyFeedback(block, button, 'Page link copied', 'check');
        } catch {
          setCopyFeedback(block, button, 'Unable to copy page link', 'copy');
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
 * @returns {void}
 */
export default function decorate(block) {
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

  ACTIONS
    .filter((action) => !action.isAvailable || action.isAvailable())
    .forEach((action) => {
      list.append(buildAction(action, shareData, block));
    });

  dock.append(list, status);
  block.replaceChildren(dock);
}
