import { createTag, formatDate } from '../../scripts/shared.js';

const META_KEYS = new Set(['type', 'date', 'time', 'location']);

function buildMetaItem(label, content) {
  return createTag('div', { class: 'event-meta-item' }, [
    createTag('dt', {}, label),
    createTag('dd', {}, content),
  ]);
}

export default function init(root = document) {
  const main = root.querySelector('main');
  if (!main) return;

  const col = main.querySelector('.columns > div > div');
  if (!col || col.querySelector('.event-meta')) return;

  const metaPairs = {};
  const metaParas = [];
  const descriptionParas = [];

  col.querySelectorAll('p').forEach((p) => {
    const match = p.textContent.match(/^(.+?)\s*:\s*(.+)$/);
    if (match && META_KEYS.has(match[1].trim().toLowerCase())) {
      metaPairs[match[1].trim().toLowerCase()] = match[2].trim();
      metaParas.push(p);
    } else {
      descriptionParas.push(p);
    }
  });

  if (descriptionParas.length) {
    const description = createTag('div', { class: 'event-description' });
    descriptionParas[0].before(description);
    descriptionParas.forEach((p) => description.append(p));
  }

  if (!Object.keys(metaPairs).length) return;

  const meta = createTag('dl', { class: 'event-meta' });

  if (metaPairs.type) {
    meta.append(buildMetaItem('Type', createTag('span', { class: 'event-meta-badge' }, metaPairs.type)));
  }

  if (metaPairs.date) {
    const time = createTag('time', { datetime: metaPairs.date }, formatDate(metaPairs.date));
    meta.append(buildMetaItem('Date', time));
  }

  if (metaPairs.time) {
    meta.append(buildMetaItem('Time', metaPairs.time));
  }

  if (metaPairs.location) {
    meta.append(buildMetaItem('Location', metaPairs.location));
  }

  metaParas.forEach((p) => p.remove());
  col.classList.add('event-details');
  col.append(meta);
}
