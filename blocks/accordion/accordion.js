import { buildBlock, readBlockConfig } from '../../scripts/aem.js';
import { createTag } from '../../scripts/shared.js';

function getField(obj, key) {
  if (!obj || key == null || key === '') return undefined;
  if (obj[key] != null && obj[key] !== '') return obj[key];
  const normalized = String(key).toLowerCase();
  const match = Object.keys(obj).find((k) => k.toLowerCase() === normalized);
  return match ? obj[match] : undefined;
}

function getSchemaItems(data) {
  if (Array.isArray(data)) return data;
  return Object.values(data ?? {}).find(Array.isArray) ?? [];
}

function applyFilter(items, config) {
  const field = getField(config, 'filter-by');
  const raw = field && getField(config, field);
  if (!field || !raw) return items;

  const wanted = String(raw).split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return items;

  return items.filter((item) => {
    const value = String(getField(item, field) ?? '').trim().toLowerCase();
    return wanted.includes(value);
  });
}

function showEmpty(block, message) {
  block.replaceChildren(createTag('p', { class: 'accordion-empty' }, message));
}

function decorateAccordionItems(block) {
  [...block.children].forEach((row) => {
    if (row.tagName !== 'DIV' || row.children.length < 2) return;

    const summary = createTag('summary', { class: 'accordion-item-label' });
    summary.append(...row.children[0].childNodes);

    const body = row.children[1];
    body.className = 'accordion-item-body';

    row.replaceWith(createTag('details', { class: 'accordion-item' }, [summary, body]));
  });
}

async function decorateFaqSchema(block) {
  const config = readBlockConfig(block);
  const source = getField(config, 'source');
  if (!source) {
    showEmpty(block, 'No schema source configured.');
    return;
  }

  const resp = await fetch(source);
  if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);

  const { data } = await resp.json();
  const items = applyFilter(getSchemaItems(data), config);
  if (!items.length) {
    showEmpty(block, 'No accordion items found.');
    return;
  }

  const rows = items.map((item) => [
    getField(item, 'question') ?? '',
    createTag('p', {}, String(getField(item, 'answer') ?? '')),
  ]);

  block.replaceChildren(...buildBlock('accordion', rows).children);
}

// Variants: accordion (default), accordion faq-schema
export default async function decorate(block) {
  if (block.classList.contains('faq-schema')) {
    try {
      await decorateFaqSchema(block);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Could not build accordion from FAQ schema', error);
      showEmpty(block, 'Unable to load accordion content right now.');
      return;
    }
  }

  decorateAccordionItems(block);
}
