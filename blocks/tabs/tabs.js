import { toClassName, loadCSS } from '../../scripts/aem.js';

let tabsStyleLoaded;

/**
 * Builds a tab definition from a section's `data-tab-id`/`data-tab-title` (set by the
 * Edge Delivery Services pipeline from an authored Section Metadata block).
 * @param {Element} section
 * @param {number} [fallbackIdx] used to generate an id/title when they're missing
 * @returns {{id: string, title: string, section: Element}|null} null if untagged
 */
function getTabDefinition(section, fallbackIdx = 0) {
  const tabId = String(section.dataset?.tabId || '').trim();
  if (!tabId) return null;

  const title = String(section.dataset?.tabTitle || tabId).trim() || `Tab ${fallbackIdx + 1}`;
  return {
    id: toClassName(tabId) || `tab-${fallbackIdx + 1}`,
    title,
    section,
  };
}

/**
 * Walks sibling sections directly following `currSection`, collecting tab definitions
 * until a section without a `Tab Id` (or without the `.section` class) ends the group.
 * @param {Element} currSection the section containing the Tabs block
 * @returns {{id: string, title: string, section: Element}[]}
 */
function collectTabSections(currSection) {
  const tabDefs = [];
  let next = currSection.nextElementSibling;

  while (next?.classList.contains('section')) {
    const tabDef = getTabDefinition(next, tabDefs.length);
    if (!tabDef) break;
    tabDefs.push(tabDef);
    next = next.nextElementSibling;
  }

  return tabDefs;
}

/**
 * Finds every tagged section in `main` not already inside a rendered tabs wrapper, for
 * `createTabs`'s whole-page auto-detection (all matches are treated as one group).
 * @param {Element} main
 * @returns {Element[][]} zero or one group of sections
 */
function findTabGroups(main) {
  const sections = [...main.querySelectorAll('.section[data-tab-id]')]
    .filter((s) => !s.closest('.tabs-wrapper'));
  return sections.length ? [sections] : [];
}

/**
 * Marks `selectedId`'s button/panel as active and every other tab as inactive.
 * @param {{id: string}[]} tabDefs
 * @param {string} selectedId
 * @param {Object<string, Element>} tabButtons keyed by tab id
 * @param {Object<string, Element>} tabPanels keyed by tab id
 * @returns {void}
 */
function updateTabState(tabDefs, selectedId, tabButtons, tabPanels) {
  tabDefs.forEach((tabDef) => {
    const isSelected = tabDef.id === selectedId;
    const button = tabButtons[tabDef.id];
    const panel = tabPanels[tabDef.id];

    if (button) {
      button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      button.classList.toggle('is-active', isSelected);
    }

    if (panel) {
      panel.setAttribute('aria-hidden', isSelected ? 'false' : 'true');
    }
  });
}

/**
 * Scrolls `tabList` so `button` is roughly centered, for when the tab list overflows.
 * @param {Element} button
 * @param {Element} tabList
 * @returns {void}
 */
function scrollActiveTab(button, tabList) {
  const listRect = tabList.getBoundingClientRect();
  const btnRect = button.getBoundingClientRect();
  const btnStart = btnRect.left - listRect.left + tabList.scrollLeft;
  const offset = btnStart - (tabList.clientWidth - button.offsetWidth) / 2;
  tabList.scrollLeft = Math.max(0, offset);
}

/**
 * Builds the tab list and panels, selecting the tab matching the URL hash (falling back
 * to the first tab), and wires up click handling (switch tab, scroll into view, push the
 * tab id onto the URL hash).
 * @param {{id: string, title: string, section: Element}[]} tabDefs
 * @param {string} [sectionId] disambiguates element ids when multiple tab groups exist
 * @returns {Element} the tabs-wrapper element (tab list + panels)
 */
function buildTabsUI(tabDefs, sectionId = '') {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  const selectedId = tabDefs.find((tabDef) => tabDef.id === hash)?.id || tabDefs[0]?.id;

  const tabsWrapper = document.createElement('div');
  tabsWrapper.className = 'tabs-wrapper';

  const tabList = document.createElement('div');
  tabList.className = 'tabs-list';
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-orientation', 'horizontal');

  const tabContent = document.createElement('div');
  tabContent.className = 'tabs-content';

  const tabButtons = {};
  const tabPanels = {};

  tabDefs.forEach((tabDef) => {
    const baseId = `${tabDef.id}${sectionId ? `-${sectionId}` : ''}`;
    const buttonId = `tab-${baseId}`;
    const panelId = `tab-panel-${baseId}`;
    const isSelected = tabDef.id === selectedId;

    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.id = buttonId;
    button.type = 'button';
    button.role = 'tab';
    button.setAttribute('aria-controls', panelId);
    button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    button.classList.toggle('is-active', isSelected);
    button.textContent = tabDef.title;

    const panel = document.createElement('div');
    panel.className = 'tab';
    panel.id = panelId;
    panel.role = 'tabpanel';
    panel.setAttribute('aria-labelledby', buttonId);
    panel.setAttribute('aria-hidden', isSelected ? 'false' : 'true');
    panel.append(tabDef.section);

    button.addEventListener('click', () => {
      updateTabState(tabDefs, tabDef.id, tabButtons, tabPanels);
      scrollActiveTab(button, tabList);
      window.history.pushState({}, '', `${window.location.pathname}#${tabDef.id}`);
    });

    tabButtons[tabDef.id] = button;
    tabPanels[tabDef.id] = panel;
    tabList.append(button);
    tabContent.append(panel);
  });

  tabsWrapper.append(tabList, tabContent);

  const activeButton = tabButtons[selectedId];
  if (activeButton) {
    requestAnimationFrame(() => scrollActiveTab(activeButton, tabList));
  }

  return tabsWrapper;
}

/**
 * Inserts a new `.section.tabs` wrapper before the first of `tabSections` and fills it
 * with the built tab list/panels, for `createTabs`'s whole-page auto-detection path.
 * @param {Element[]} tabSections
 * @returns {void}
 */
function buildTabsFromSections(tabSections) {
  if (!tabSections.length) return;
  const first = tabSections[0];
  const parent = first.parentNode;
  if (!parent) return;

  const tabDefs = tabSections
    .map((section, index) => getTabDefinition(section, index))
    .filter(Boolean);
  if (!tabDefs.length) return;

  tabDefs.forEach((def) => def.section.classList.remove('tabs'));

  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'section tabs';
  parent.insertBefore(tabsContainer, first);

  tabsContainer.append(buildTabsUI(tabDefs, first.id || ''));
}

/**
 * Loads and decorates the tabs block: collects the sections directly following the
 * block's own section that carry a `Tab Id`, and replaces the block's content with the
 * built tab list and panels. No-ops if no tagged sections follow.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const currSection = block.closest('.section');
  if (!currSection) return;

  const tabDefs = collectTabSections(currSection);
  if (!tabDefs.length) return;

  currSection.classList.add('tabs');
  tabDefs.forEach((def) => def.section.classList.remove('tabs'));

  block.replaceChildren(buildTabsUI(tabDefs, currSection.id || ''));
}

/**
 * Alternate entry point, called from `blocks/dynamic/index.js` (not through the normal
 * block-decoration pipeline): scans an entire page for `data-tab-id` sections not
 * already inside a rendered tabs group and builds tab groups without requiring a placed
 * Tabs block. Lazily loads tabs.css since it isn't guaranteed to be loaded otherwise.
 * @param {Element} main
 * @returns {Promise<void>}
 */
export async function createTabs(main) {
  if (!main) return;
  if (!tabsStyleLoaded) {
    tabsStyleLoaded = loadCSS(`${window.hlx.codeBasePath}/blocks/tabs/tabs.css`);
  }
  await tabsStyleLoaded;
  findTabGroups(main).forEach((group) => buildTabsFromSections(group));
}
