import { loadScript } from '../../scripts/aem.js';

const getEmbedContainerStyle = (fixedHeight) => (fixedHeight
  ? `left: 0; width: 100%; height: ${fixedHeight}px; position: relative;`
  : 'left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;');

const getDefaultEmbed = (url, fixedHeight) => `<div style="${getEmbedContainerStyle(fixedHeight)}">
    <iframe src="${url.href}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" allowfullscreen=""
      scrolling="no" allow="encrypted-media" title="Content from ${url.hostname}" loading="lazy">
    </iframe>
  </div>`;

const embedYoutube = (url, autoplay, fixedHeight) => {
  const usp = new URLSearchParams(url.search);
  const suffix = autoplay ? '&muted=1&autoplay=1' : '';
  let vid = usp.get('v') ? encodeURIComponent(usp.get('v')) : '';
  const embed = url.pathname;
  if (url.origin.includes('youtu.be')) {
    [, vid] = url.pathname.split('/');
  }
  return `<div style="${getEmbedContainerStyle(fixedHeight)}">
      <iframe src="https://www.youtube.com${vid ? `/embed/${vid}?rel=0&v=${vid}${suffix}` : embed}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope" allowfullscreen="" scrolling="no" title="Content from Youtube" loading="lazy"></iframe>
    </div>`;
};

const embedVimeo = (url, autoplay, fixedHeight) => {
  const [, video] = url.pathname.split('/');
  const suffix = autoplay ? '?muted=1&autoplay=1' : '';
  return `<div style="${getEmbedContainerStyle(fixedHeight)}">
      <iframe src="https://player.vimeo.com/video/${video}${suffix}"
      style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;"
      allow="autoplay; fullscreen; picture-in-picture" allowfullscreen
      title="Content from Vimeo" loading="lazy"></iframe>
    </div>`;
};

const embedTwitter = (url) => {
  loadScript('https://platform.twitter.com/widgets.js');
  return `<blockquote class="twitter-tweet"><a href="${url.href}"></a></blockquote>`;
};

const EMBEDS = [
  { match: ['youtube', 'youtu.be'], embed: embedYoutube },
  { match: ['vimeo'], embed: embedVimeo },
  { match: ['twitter'], embed: embedTwitter },
];

function getFixedHeight(block) {
  const fixedHeightClass = [...block.classList]
    .find((className) => /^(?:fixedheight-|fixed-height-|h-)?\d+(?:px)?$/i.test(className));
  if (!fixedHeightClass) return null;

  const match = fixedHeightClass.match(/(\d+)/);
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function loadEmbed(block, link, autoplay, fixedHeight) {
  if (block.classList.contains('embed-is-loaded')) return;

  const config = EMBEDS.find((entry) => entry.match.some((term) => link.includes(term)));
  const url = new URL(link);
  if (config) {
    block.innerHTML = config.embed(url, autoplay, fixedHeight);
    block.classList = `block embed embed-${config.match[0]}`;
  } else {
    block.innerHTML = getDefaultEmbed(url, fixedHeight);
    block.classList = 'block embed';
  }
  block.classList.add('embed-is-loaded');
}

export default function decorate(block) {
  const linkEl = block.querySelector('a[href]');
  if (!linkEl) return;

  const placeholder = block.querySelector('picture');
  const { href: link } = linkEl;
  const fixedHeight = getFixedHeight(block);
  block.textContent = '';

  if (placeholder) {
    const wrapper = document.createElement('div');
    wrapper.className = 'embed-placeholder';
    if (fixedHeight) {
      wrapper.style.aspectRatio = 'auto';
      wrapper.style.height = `${fixedHeight}px`;
    }
    wrapper.innerHTML = '<div class="embed-placeholder-play"><button type="button" title="Play"></button></div>';
    wrapper.prepend(placeholder);
    wrapper.addEventListener('click', () => {
      loadEmbed(block, link, true, fixedHeight);
    });
    block.append(wrapper);
  } else {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        loadEmbed(block, link, false, fixedHeight);
      }
    });
    observer.observe(block);
  }
}
