import { createOptimizedPicture } from '../../scripts/aem.js';
import { createTag } from '../../scripts/shared.js';

/**
 * Reads a Structured Content field block into a plain object. Each row is
 * `<div><div><h3 id=key>..</h3></div><div>value</div></div>`. Primitive arrays (`<ul><li>`) become
 * string arrays; `self://#id` list items are returned as ref ids for the caller to resolve.
 * The key comes from the label text, not the heading id: ids are lowercased and de-duplicated
 * document-wide, so `weightKg` becomes `weightkg` and a repeated `label` row becomes `label-1`.
 * @param {Element} block
 * @returns {Object}
 */
function readFieldBlock(block) {
  const data = {};
  block.querySelectorAll(':scope > div').forEach((row) => {
    const cells = row.children;
    if (cells.length < 2) return;
    const key = cells[0].textContent.trim() || cells[0].querySelector('h3')?.id;
    if (!key) return;
    const valueCell = cells[1];
    const list = valueCell.querySelector('ul');
    if (list) {
      data[key] = [...list.querySelectorAll('li')].map((li) => li.textContent.trim());
    } else {
      data[key] = valueCell.textContent.trim();
    }
  });
  return data;
}

/** Resolve `self://#specs-abc` refs against sibling blocks of the given class. */
function resolveRefs(refs, cls, scope) {
  return refs
    .map((ref) => ref.replace('self://#', ''))
    .map((id) => scope.querySelector(`.${cls}.${id}`))
    .filter(Boolean)
    .map((el) => readFieldBlock(el));
}

function factRow(label, value) {
  return createTag('div', { class: 'product-fact' }, [
    createTag('dt', {}, label),
    createTag('dd', {}, value),
  ]);
}

/**
 * Decorates a DA Structured Content `product` document into a product detail page.
 * The raw page renders the schema as key/value rows plus sibling `specs`/`faqs` blocks;
 * this reads them and rebuilds a clean layout. Nothing is fetched: the data is already
 * on the page as the delivered record.
 * @param {Element} block the `.product` block
 */
export default function decorate(block) {
  const scope = block.closest('main') || document;
  const d = readFieldBlock(block);
  const specs = resolveRefs(d.specs || [], 'specs', scope);
  const faqs = resolveRefs(d.faqs || [], 'faqs', scope);

  // The pipeline takes the page title from the first heading, which is the .da-form schema-name
  // row, so every record ships the same title. Swap in the product name, but leave a title an
  // author set with a Metadata block alone. This fixes the tab, not the server-rendered meta.
  const derived = scope.querySelector('.da-form h3')?.textContent.trim();
  if (d.name && derived && document.title === derived) document.title = d.name;

  // remove the raw metadata block and the now-consumed sibling item blocks
  scope.querySelectorAll('.da-form, .specs, .faqs').forEach((el) => el.remove());

  const parts = [];

  // hero: image + title, or title-only
  const subtitle = [d.category, d.electric === 'true' ? 'Electric' : null,
    d.inStock === 'false' ? 'Out of stock' : null].filter(Boolean).join(' · ');
  const heading = createTag('div', { class: 'product-heading' }, [
    createTag('h1', { id: d.slug || '' }, d.name || 'Product'),
    subtitle ? createTag('p', { class: 'product-subtitle' }, subtitle) : '',
  ]);
  if (d.image) {
    const media = createTag(
      'div',
      { class: 'product-media' },
      d.image.startsWith('/')
        ? createOptimizedPicture(d.image, d.name, true)
        : createTag('img', { src: d.image, alt: d.name || '', loading: 'eager' }),
    );
    parts.push(createTag('div', { class: 'product-hero' }, [media, heading]));
  } else {
    parts.push(createTag('div', { class: 'product-hero product-hero-noimage' }, heading));
  }

  if (d.description) parts.push(createTag('p', { class: 'product-description' }, d.description));

  // facts
  const facts = createTag('dl', { class: 'product-facts' });
  if (d.price) facts.append(factRow('Price', `$${d.price} USD`));
  if (d.weightKg) facts.append(factRow('Weight', `${d.weightKg} kg`));
  if (d.gears) facts.append(factRow('Gears', d.gears));
  if (Array.isArray(d.frameSizes) && d.frameSizes.length) facts.append(factRow('Frame sizes', d.frameSizes.join(', ')));
  if (Array.isArray(d.colors) && d.colors.length) facts.append(factRow('Colors', d.colors.join(', ')));
  if (d.sku) facts.append(factRow('SKU', d.sku));
  if (facts.children.length) parts.push(facts);

  // specs
  if (specs.length) {
    const specDl = createTag('dl', { class: 'product-specs' });
    specs.forEach((s) => specDl.append(factRow(s.label, s.value)));
    parts.push(createTag('h2', { id: 'specs' }, 'Specs'));
    parts.push(specDl);
  }

  // faqs
  if (faqs.length) {
    parts.push(createTag('h2', { id: 'faqs' }, 'FAQs'));
    faqs.forEach((f) => {
      parts.push(createTag('details', { class: 'product-faq' }, [
        createTag('summary', {}, f.question),
        createTag('div', {}, f.answer),
      ]));
    });
  }

  block.textContent = '';
  parts.forEach((p) => p && block.append(p));
}
