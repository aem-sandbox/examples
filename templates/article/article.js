import { getMetadata } from '../../scripts/aem.js';
import { createTag, formatDate } from '../../scripts/shared.js';

function buildBreadcrumb(root = document) {
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (!segments.length) return null;

  const nav = createTag('nav', { class: 'article-breadcrumb', 'aria-label': 'Breadcrumb' });
  const list = createTag('ol');
  const title = root.querySelector('main .hero h1')?.textContent?.trim() || root.title;

  list.append(createTag('li', {}, createTag('a', { href: '/' }, 'Home')));

  let path = '';
  segments.slice(0, -1).forEach((segment) => {
    path += `/${segment}`;
    const label = segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    list.append(createTag('li', {}, createTag('a', { href: path }, label)));
  });

  list.append(createTag('li', { 'aria-current': 'page' }, title));
  nav.append(list);
  return nav;
}

function buildAuthorDate() {
  const author = getMetadata('author');
  const date = getMetadata('date');
  if (!author && !date) return null;

  const container = createTag('div', { class: 'article-author-container' });

  if (author) {
    container.append(createTag('span', { class: 'article-author' }, `By ${author}`));
  }

  if (date) {
    const parsed = new Date(String(date).trim());
    const datetime = !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
    const time = createTag('time', datetime ? { datetime } : {}, formatDate(date));
    container.append(createTag('span', { class: 'article-date' }, time));
  }

  return container;
}

export default function init(root = document) {
  const main = root.querySelector('main');
  if (!main) return;

  const hero = main.querySelector('.hero');
  const heroText = main.querySelector('.hero > div:last-child > div');

  if (hero && !main.querySelector('.article-breadcrumb')) {
    const breadcrumb = buildBreadcrumb(root);
    if (breadcrumb) hero.insertAdjacentElement('afterend', breadcrumb);
  }

  if (heroText && !heroText.querySelector('.article-author-container')) {
    const authorDate = buildAuthorDate();
    if (authorDate) heroText.append(authorDate);
  }
}
