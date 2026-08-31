import { loadCSS } from '../../scripts/aem.js';

let widgetInstanceCount = 0;

/**
 * Parses a widget href into folder path and name.
 * @param {string} pathname URL pathname (e.g. `/widgets/path1/name.html`)
 * @returns {{ widgetPath: string, widgetName: string }}
 */
function parseWidgetHref(pathname) {
  const pathSegments = pathname.split('/').filter((p) => p);
  if (pathSegments.length < 3 || pathSegments[0] !== 'widgets') {
    throw new Error('Widget links must use /widgets/<path>/<name>.html');
  }

  const fileName = pathSegments[pathSegments.length - 1];
  if (!fileName.endsWith('.html')) {
    throw new Error('Widget links must target an HTML asset');
  }

  const assetSegments = [...pathSegments.slice(1, -1), fileName.slice(0, -5)];
  if (assetSegments.some((segment) => !/^[a-z0-9][a-z0-9_-]*$/i.test(segment))) {
    throw new Error('Widget paths may contain only letters, numbers, hyphens, and underscores');
  }

  const widgetName = fileName.slice(0, -5);
  const widgetPath = pathSegments.slice(1, -1).join('/');
  return { widgetPath, widgetName };
}

/**
 * Builds a widget asset URL.
 * @param {string} widgetPath Folder path under `/widgets/`
 * @param {string} widgetName Widget file name without extension
 * @param {string} extension File extension (`html`, `css`, `js`)
 */
function widgetUrl(widgetPath, widgetName, extension) {
  const prefix = widgetPath ? `${widgetPath}/` : '';
  return `${window.hlx.codeBasePath}/widgets/${prefix}${widgetName}.${extension}`;
}

/**
 * Loads and decorates a widget block.
 * @param {Element} widget The widget block element
 */
export default async function decorate(widget) {
  const originalHTML = widget.innerHTML;
  const source = widget.querySelector('a[href]');
  let widgetPath = 'unknown';
  let widgetName = 'unknown';
  let parameterKeys = [];

  try {
    if (!source) throw new Error('Widget block requires a source link');

    const sourceUrl = new URL(source.href);
    if (sourceUrl.origin !== window.location.origin) {
      throw new Error('Widget source links must use the current site origin');
    }

    const parsed = parseWidgetHref(sourceUrl.pathname);
    widgetPath = parsed.widgetPath;
    const parsedName = parsed.widgetName;
    widgetName = parsedName;
    const instanceId = `${widgetName}-${widgetInstanceCount += 1}`;

    const resp = await fetch(widgetUrl(widgetPath, widgetName, 'html'));
    if (!resp.ok) throw new Error(`Widget HTML request failed with ${resp.status}`);

    const html = await resp.text();
    if (!html.trim()) throw new Error('Widget HTML response was empty');

    widget.classList.add(widgetName);
    widget.dataset.instanceId = instanceId;
    widget.dataset.source = sourceUrl.href;
    parameterKeys = [...sourceUrl.searchParams.keys()];
    sourceUrl.searchParams.forEach((value, key) => {
      widget.dataset[key] = value;
    });

    widget.innerHTML = html;

    const cssLoaded = loadCSS(widgetUrl(widgetPath, widgetName, 'css'));
    const decorationComplete = (async () => {
      const mod = await import(widgetUrl(widgetPath, widgetName, 'js'));
      if (mod.default) await mod.default(widget);
    })();
    await Promise.all([cssLoaded, decorationComplete]);

    widget.classList.remove('block');

    const wrapper = widget.closest('.widget-wrapper');
    if (wrapper) wrapper.classList.add(`${widgetName}-wrapper`);

    const section = widget.closest('.section');
    if (section) section.classList.add(`${widgetName}-container`);
  } catch (error) {
    widget.innerHTML = originalHTML;
    widget.classList.remove(widgetName);
    widget.removeAttribute('data-instance-id');
    widget.removeAttribute('data-source');
    parameterKeys.forEach((key) => delete widget.dataset[key]);
    // eslint-disable-next-line no-console
    console.error(`failed to load widget ${widgetPath}/${widgetName}`, error);
  }
}
