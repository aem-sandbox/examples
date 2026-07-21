/** USGS quake pages. The EDS pipeline strips classes from default content, so
 * the templates emit plain strong/em markup and this decorator restores the
 * styling classes at load time. */

export function magTier(text) {
  const mag = parseFloat(String(text || '').replace(/^M\s*/, ''));
  if (Number.isNaN(mag)) return null;
  return `m${Math.min(7, Math.max(5, Math.floor(mag)))}`;
}

export default function init(doc = document) {
  doc.querySelectorAll('main li > a > strong').forEach((badge) => {
    const tier = magTier(badge.textContent);
    if (!tier) return;
    badge.classList.add('quake-mag', tier);
    const item = badge.closest('li');
    item.classList.add('quake-item');
    item.closest('ul').classList.add('quake-list');
    const meta = item.querySelector('a + em');
    if (meta) meta.classList.add('quake-meta');
  });

  const back = doc.querySelector('main a[href="/extras/usgs-quakes"]');
  const backPara = back && back.closest('p');
  if (backPara) backPara.classList.add('backlink');
}
