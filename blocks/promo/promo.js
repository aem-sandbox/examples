import { createTag, fetchStructuredContent, getBlockSourceUrl } from '../../scripts/shared.js';

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
  const url = getBlockSourceUrl(block);
  block.textContent = '';
  if (!url) return;

  const payload = await fetchStructuredContent(url);
  const { data } = payload || {};
  if (!data || data.active === false) return;

  const typeSlug = (data.type || 'banner').toLowerCase().replace(/\s+/g, '-');
  block.classList.add(`promo-type-${typeSlug}`);

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
