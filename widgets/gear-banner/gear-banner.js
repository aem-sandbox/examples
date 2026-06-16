import { getLanguage } from '../../scripts/i18n.js';

/**
 * Loads widget copy from the co-located JSON file.
 * @param {string} lang - Language key
 * @returns {Promise<Object>} Copy object for the requested language
 */
async function loadWidgetCopy(lang) {
  const scriptPath = new URL(import.meta.url).pathname;
  const jsonPath = scriptPath.replace(/\.js$/, '.json');
  const base = window.hlx?.codeBasePath || '';
  const resp = await fetch(`${base}${jsonPath}`);
  const data = await resp.json();
  const key = data[lang] ? lang : 'en';
  const copy = data[key];
  const en = data.en || {};
  return {
    ...copy,
    includes: copy.includes ?? en.includes ?? [],
    floatIcons: copy.floatIcons ?? en.floatIcons ?? [],
  };
}

/**
 * Animates a number counting up to a target value.
 * @param {HTMLElement} el - Element to display the number
 * @param {number} target - Final value
 * @param {number} duration - Animation duration in ms
 */
function countUp(el, target, duration = 1200) {
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    el.textContent = String(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Creates floating particle elements in the scene.
 * @param {HTMLElement} container - Particles container
 */
function buildParticles(container) {
  container.replaceChildren();
  for (let i = 0; i < 24; i += 1) {
    const p = document.createElement('span');
    p.className = 'gear-banner-particle';
    p.style.setProperty('--x', `${Math.random() * 100}%`);
    p.style.setProperty('--delay', `${Math.random() * 8}s`);
    p.style.setProperty('--duration', `${6 + Math.random() * 8}s`);
    p.style.setProperty('--size', `${2 + Math.random() * 4}px`);
    p.style.setProperty('--drift', `${-20 + Math.random() * 40}px`);
    container.append(p);
  }
}

/**
 * Applies copy from JSON to the banner DOM.
 * @param {HTMLElement} widget - Widget root
 * @param {Object} copy - Loaded copy object
 */
function applyCopy(widget, copy) {
  const ad = widget.querySelector('.gear-banner-ad');
  ad.setAttribute('aria-label', copy.ariaLabel);

  widget.querySelector('.gear-banner-eyebrow').textContent = copy.eyebrow;
  widget.querySelector('.gear-banner-headline').textContent = copy.headline;
  widget.querySelector('.gear-banner-subhead').textContent = copy.subhead;
  widget.querySelector('.gear-banner-code-label').textContent = copy.codeLabel;
  widget.querySelector('.gear-banner-code').textContent = copy.promoCode;
  widget.querySelector('.gear-banner-fine-print').textContent = copy.finePrint;
  widget.querySelector('.gear-banner-percent-sign').textContent = copy.percentSign;
  widget.querySelector('.gear-banner-off-label').textContent = copy.offLabel;
  widget.querySelector('.gear-banner-category').textContent = copy.category;
  widget.querySelector('.gear-banner-urgency-text').textContent = copy.urgency;

  const cta = widget.querySelector('.gear-banner-cta');
  cta.textContent = copy.cta;
  cta.href = copy.ctaHref;
  cta.title = copy.cta;

  const includesEl = widget.querySelector('.gear-banner-includes');
  includesEl.setAttribute('aria-label', copy.includesLabel);
  includesEl.replaceChildren();
  copy.includes.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    includesEl.append(li);
  });

  const iconsEl = widget.querySelector('.gear-banner-icons');
  iconsEl.replaceChildren();
  copy.floatIcons.forEach((icon, i) => {
    const span = document.createElement('span');
    span.className = 'gear-banner-gear-icon';
    span.textContent = icon;
    span.style.setProperty('--float-delay', `${i * 0.4}s`);
    iconsEl.append(span);
  });

  widget.querySelector('.gear-banner-percent').dataset.value = String(copy.percent);
}

/**
 * Starts entrance animations when the banner enters the viewport.
 * @param {HTMLElement} widget - Widget root
 */
function observeEntrance(widget) {
  const percentEl = widget.querySelector('.gear-banner-percent');
  const target = parseInt(percentEl.dataset.value, 10) || 30;
  let played = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || played) return;
      played = true;
      widget.classList.add('gear-banner-active');
      countUp(percentEl, target);
      observer.disconnect();
    });
  }, { threshold: 0.25 });

  observer.observe(widget);
}

/**
 * Decorates the gear-banner widget.
 * @param {HTMLElement} widget - Widget root element
 */
export default async function decorate(widget) {
  const lang = getLanguage();
  const copy = await loadWidgetCopy(lang).catch(() => null);
  if (!copy?.headline) return;

  applyCopy(widget, copy);
  buildParticles(widget.querySelector('.gear-banner-particles'));
  observeEntrance(widget);
}
