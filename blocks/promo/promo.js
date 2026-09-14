import { createTag, fetchPromotion } from '../../scripts/shared.js';

/** The block's only authored content: a link (or bare text) to a Structured Content endpoint. */
function getSourceUrl(block) {
  const link = block.querySelector('a');
  return link ? link.getAttribute('href') : block.textContent.trim();
}

function ctaLink(cta, isPrimary) {
  return createTag('a', {
    class: `button ${isPrimary ? 'primary' : 'secondary'}`,
    href: cta.url,
  }, cta.label);
}

/**
 * Decorates a `promo` block whose only authored content is a URL to a Structured Content
 * endpoint returning `data.type` (used as a modifier class), `data.active`, `data.name`,
 * `data.description`, and `data.ctas` (`{ label, url }[]`, first rendered as the primary button).
 * @param {Element} block the `.promo` block
 */
export default async function decorate(block) {
  const url = getSourceUrl(block);
  block.textContent = '';
  if (!url) return;

  const payload = await fetchPromotion(url);
  const { data } = payload || {};
  if (!data || data.active === false) return;

  block.classList.add(`promo-type-${(data.type || 'banner').toLowerCase()}`);

  const text = createTag('div', { class: 'promo-text' }, [
    createTag('p', { class: 'promo-name' }, data.name || ''),
    data.description ? createTag('p', { class: 'promo-description' }, data.description) : '',
  ]);
  const content = createTag('div', { class: 'promo-content' }, [text]);

  if (Array.isArray(data.ctas) && data.ctas.length) {
    content.append(createTag(
      'div',
      { class: 'promo-ctas' },
      data.ctas.map((cta, i) => ctaLink(cta, i === 0)),
    ));
  }

  const dismissBtn = createTag('button', {
    type: 'button', class: 'promo-dismiss', 'aria-label': 'Dismiss promotion',
  }, '×');
  dismissBtn.addEventListener('click', () => block.remove());

  block.append(content, dismissBtn);
}
