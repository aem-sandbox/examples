import { getLanguage } from '../../scripts/i18n.js';

const MODEL_VIEWER_URL = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js';

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
    model: copy.model ?? en.model ?? {},
    camera: copy.camera ?? en.camera ?? {},
  };
}

/**
 * Loads the model-viewer web component from Google's CDN.
 * @returns {Promise<void>}
 */
function loadModelViewerLib() {
  if (customElements.get('model-viewer')) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = MODEL_VIEWER_URL;
    script.onload = () => {
      customElements.whenDefined('model-viewer').then(resolve).catch(reject);
    };
    script.onerror = () => reject(new Error('Failed to load model-viewer'));
    document.head.append(script);
  });
}

/**
 * Creates and configures the model-viewer element.
 * @param {Object} copy - Widget copy including model and camera config
 * @returns {HTMLElement} model-viewer element
 */
function createModelViewer(copy) {
  const { model, camera } = copy;
  const viewer = document.createElement('model-viewer');

  viewer.setAttribute('src', model.src);
  viewer.setAttribute('alt', model.alt);
  viewer.setAttribute('camera-controls', '');
  viewer.setAttribute('touch-action', 'pan-y');
  viewer.setAttribute('auto-rotate', '');
  viewer.setAttribute('shadow-intensity', '1');
  viewer.setAttribute('exposure', '1.1');
  viewer.setAttribute('interaction-prompt', 'none');
  viewer.setAttribute('loading', 'eager');
  viewer.setAttribute('reveal', 'auto');

  if (model.poster) viewer.setAttribute('poster', model.poster);
  if (model.environment) viewer.setAttribute('environment-image', model.environment);
  if (camera.orbit) viewer.setAttribute('camera-orbit', camera.orbit);
  if (camera.target) viewer.setAttribute('camera-target', camera.target);
  if (camera.fieldOfView) viewer.setAttribute('field-of-view', camera.fieldOfView);

  viewer.classList.add('viewer-3d-model');
  return viewer;
}

/**
 * Applies static copy to the widget shell.
 * @param {HTMLElement} widget - Widget root
 * @param {Object} copy - Loaded copy object
 */
function applyCopy(widget, copy) {
  const shell = widget.querySelector('.viewer-3d-shell');
  shell.setAttribute('aria-label', copy.ariaLabel);

  widget.querySelector('.viewer-3d-reset').textContent = copy.reset;
  widget.querySelector('.viewer-3d-reset').setAttribute('aria-label', copy.reset);

  const autoBtn = widget.querySelector('.viewer-3d-auto-rotate');
  autoBtn.textContent = copy.autoRotateOn;
  autoBtn.setAttribute('aria-label', copy.autoRotateOn);
  autoBtn.dataset.labelOn = copy.autoRotateOn;
  autoBtn.dataset.labelOff = copy.autoRotateOff;
}

/**
 * Wires loader, hint fade, toolbar, and camera reset behaviour.
 * @param {HTMLElement} widget - Widget root
 * @param {HTMLElement} viewer - model-viewer element
 * @param {Object} copy - Loaded copy object
 */
function wireInteractions(widget, viewer, copy) {
  const stage = widget.querySelector('.viewer-3d-stage');
  const loader = widget.querySelector('.viewer-3d-loader');
  const autoBtn = widget.querySelector('.viewer-3d-auto-rotate');
  const resetBtn = widget.querySelector('.viewer-3d-reset');

  const initial = {
    orbit: copy.camera.orbit,
    target: copy.camera.target,
    fieldOfView: copy.camera.fieldOfView,
  };

  viewer.addEventListener('load', () => {
    loader.setAttribute('hidden', '');
    stage.classList.add('viewer-3d-ready');
  });

  viewer.addEventListener('progress', (e) => {
    if (e.detail.totalProgress >= 1) loader.setAttribute('hidden', '');
  });

  autoBtn.addEventListener('click', () => {
    const isOn = viewer.hasAttribute('auto-rotate');
    if (isOn) {
      viewer.removeAttribute('auto-rotate');
      autoBtn.setAttribute('aria-pressed', 'false');
      autoBtn.textContent = autoBtn.dataset.labelOff;
      autoBtn.setAttribute('aria-label', autoBtn.dataset.labelOff);
    } else {
      viewer.setAttribute('auto-rotate', '');
      autoBtn.setAttribute('aria-pressed', 'true');
      autoBtn.textContent = autoBtn.dataset.labelOn;
      autoBtn.setAttribute('aria-label', autoBtn.dataset.labelOn);
    }
  });

  resetBtn.addEventListener('click', () => {
    viewer.resetTurntableRotation();
    viewer.setAttribute('camera-orbit', initial.orbit);
    viewer.setAttribute('camera-target', initial.target);
    viewer.setAttribute('field-of-view', initial.fieldOfView);
    viewer.jumpCameraToGoal();
  });
}

/**
 * Decorates the viewer-3d widget.
 * @param {HTMLElement} widget - Widget root element
 */
export default async function decorate(widget) {
  const lang = getLanguage();
  const copy = await loadWidgetCopy(lang).catch(() => null);
  if (!copy?.model?.src) return;

  applyCopy(widget, copy);

  try {
    await loadModelViewerLib();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('viewer-3d: model-viewer library failed to load', err);
    return;
  }

  const viewer = createModelViewer(copy);
  widget.querySelector('.viewer-3d-viewport').append(viewer);
  wireInteractions(widget, viewer, copy);
}
