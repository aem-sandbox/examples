import { readBlockConfig, toClassName } from '../../scripts/aem.js';
import {
  createTag,
  fetchQueryIndexPage,
  formatDate,
  getContentTimestamp,
  isQueryableRow,
  normalizePath,
  parseKeywords,
  QUERY_INDEX_PAGE_SIZE,
} from '../../scripts/shared.js';

const DEFAULT_LIMIT = 15;
/** Config keys consumed as block settings; all other config rows become filter facets. */
const SETTING_KEYS = new Set(['view', 'keywords', 'excluded-keywords', 'searchbar', 'limit']);

function parseFilterOptions(value) {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter(Boolean)
      .filter((v) => !/^https?:\/\//i.test(v));
  }
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseFilterGroupsFromConfig(config) {
  return Object.entries(config)
    .filter(([key]) => !SETTING_KEYS.has(key))
    .map(([key, value]) => {
      const options = parseFilterOptions(value)
        .map((v) => ({ key: toClassName(v), label: v, match: v.toLowerCase() }));
      if (!options.length) return null;
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' ');
      return { key, label, options };
    })
    .filter(Boolean);
}

function getGroupMatches(row, group) {
  if (group.key === 'type') {
    const template = String(row.template || '').toLowerCase();
    return group.options
      .filter((opt) => template === opt.match)
      .map((opt) => opt.key);
  }
  const rowKeywords = parseKeywords(row.keywords ?? '').map((k) => k.toLowerCase());
  const pathParts = normalizePath(row.path).split('/').filter(Boolean).map((p) => p.toLowerCase());
  return group.options
    .filter((opt) => {
      if (rowKeywords.some((rk) => rk === opt.match || rk.includes(opt.match))) return true;
      return pathParts.some((part) => part === opt.match || part.includes(opt.match));
    })
    .map((opt) => opt.key);
}

function rowMatchesFilterGroups(row, selectedByGroup, filterGroups) {
  return filterGroups.every((group) => {
    const selected = selectedByGroup.get(group.key) || [];
    if (!selected.length) return true;
    const values = getGroupMatches(row, group);
    return selected.some((v) => values.includes(v));
  });
}

function getSelectedByGroupFromBlock(block, filterGroups) {
  const map = new Map();
  filterGroups.forEach((group) => {
    const inputs = block.querySelectorAll(`input[data-group="${group.key}"]:checked`);
    map.set(group.key, [...inputs].map((i) => i.value));
  });
  return map;
}

function matchesKeywords(row, keywords) {
  if (!keywords.length) return true;
  const rowKeywords = parseKeywords(row.keywords ?? '');
  return keywords.some((k) => rowKeywords.some((rk) => rk === k || rk.includes(k)));
}

function matchesExcluded(row, excluded) {
  if (!excluded.length) return false;
  const rowKeywords = parseKeywords(row.keywords ?? '');
  return excluded.some((k) => rowKeywords.some((rk) => rk === k || rk.includes(k)));
}

function matchesQuery(row, query) {
  if (!query) return true;
  const text = [row.title, row.description, row.path, row.keywords ?? '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((term) => text.includes(term));
}

function isMatch(row, keywords, excluded) {
  return (
    isQueryableRow(row)
    && matchesKeywords(row, keywords)
    && !matchesExcluded(row, excluded)
  );
}

async function fetchMatchingRows(state, keywords, excluded, query, neededCount) {
  if (state.rows.length >= neededCount || !state.hasMore) return;
  const batch = await fetchQueryIndexPage(state.offset, QUERY_INDEX_PAGE_SIZE);
  state.offset += batch.length;
  state.hasMore = batch.length === QUERY_INDEX_PAGE_SIZE;
  batch
    .filter((row) => isMatch(row, keywords, excluded))
    .forEach((row) => {
      if (!state.pathSet.has(row.path)) {
        state.pathSet.add(row.path);
        state.rows.push(row);
      }
    });
  await fetchMatchingRows(state, keywords, excluded, query, neededCount);
}

function buildResultItem(row, view, filterGroups) {
  const href = normalizePath(row.path);
  const link = createTag('a', { href, class: 'search-result-link' });
  if (view === 'cards') {
    link.append(createTag('div', { class: 'search-result-strip' }));
  }
  const content = createTag('div', { class: 'search-result-content' });
  content.append(createTag('h3', {}, row.title || href));
  if (row.description) {
    content.append(createTag('p', { class: 'search-result-description' }, row.description));
  }
  const author = row.author || row.authors || row.byline || '';
  const date = row.date || row.publisheddate || row.lastModified;
  if (author || date) {
    const meta = createTag('p', { class: 'search-result-meta' });
    if (author) meta.append(createTag('span', { class: 'search-result-author' }, String(author)));
    if (author && date) meta.append(createTag('span', { class: 'search-result-meta-sep' }, ' • '));
    if (date) meta.append(createTag('span', { class: 'search-result-date' }, formatDate(date)));
    content.append(meta);
  }
  link.append(content);
  const li = createTag('li', { class: `search-result ${view === 'cards' ? 'is-card' : 'is-list'}` }, link);
  li.dataset.time = String(getContentTimestamp(row));
  if (filterGroups?.length) {
    filterGroups.forEach((group) => {
      const values = getGroupMatches(row, group);
      li.setAttribute(`data-filter-${group.key}`, values.join(','));
    });
  }
  return li;
}

function sortByDate(rows, order) {
  const out = [...rows];
  out.sort((a, b) => {
    const ta = getContentTimestamp(a);
    const tb = getContentTimestamp(b);
    return order === 'oldest' ? ta - tb : tb - ta;
  });
  return out;
}

function buildFilterSidebar(filterGroups, listId, idPrefix, sortSelectId) {
  const panelId = `${idPrefix}-filters-panel`;
  const aside = createTag('aside', {
    class: 'search-filters',
    role: 'region',
    'aria-label': 'Filter results',
  });

  const toggle = createTag('button', {
    type: 'button',
    class: 'search-filters-toggle',
    'aria-expanded': 'false',
    'aria-controls': panelId,
  }, 'Filters');
  aside.append(toggle);

  const panel = createTag('div', {
    id: panelId,
    class: 'search-filters-panel',
  });

  const sortWrap = createTag('div', { class: 'search-filters-sort' });
  sortWrap.append(createTag('label', { for: sortSelectId }, 'Sort by'));
  const select = createTag('select', { id: sortSelectId, name: 'search-sort', 'aria-controls': listId });
  select.append(
    createTag('option', { value: 'newest' }, 'Newest'),
    createTag('option', { value: 'oldest' }, 'Oldest'),
  );
  sortWrap.append(select);
  panel.append(sortWrap);

  const list = createTag('div', { class: 'search-filter-list' });
  filterGroups.forEach((group) => {
    const groupEl = createTag('div', { class: 'search-filter-group' });
    groupEl.append(createTag('p', { class: 'search-filter-group-title' }, group.label));
    group.options.forEach((option) => {
      const id = `${idPrefix}-${group.key}-${option.key}`;
      const input = createTag('input', {
        id,
        type: 'checkbox',
        name: `search-filter-${group.key}`,
        'data-group': group.key,
        value: option.key,
        'aria-controls': listId,
      });
      const labelEl = createTag('label', { for: id }, `${option.label} (0)`);
      groupEl.append(createTag('div', { class: 'search-filter-item' }, [input, labelEl]));
    });
    list.append(groupEl);
  });
  panel.append(list);
  aside.append(panel);

  toggle.addEventListener('click', () => {
    const expanded = aside.classList.toggle('is-expanded');
    toggle.setAttribute('aria-expanded', String(expanded));
  });

  return { aside, sortSelect: select };
}

function updateFilterCounts(block, filterGroups, rows) {
  const groupCounts = new Map(
    filterGroups.map((g) => [g.key, new Map(g.options.map((o) => [o.key, 0]))]),
  );
  rows.forEach((row) => {
    filterGroups.forEach((group) => {
      getGroupMatches(row, group).forEach((value) => {
        const m = groupCounts.get(group.key);
        if (m) m.set(value, (m.get(value) || 0) + 1);
      });
    });
  });
  const labelMap = new Map(
    filterGroups.map((g) => [g.key, new Map(g.options.map((o) => [o.key, o.label]))]),
  );
  block.querySelectorAll('input[data-group]').forEach((input) => {
    const groupKey = input.dataset.group;
    const count = groupCounts.get(groupKey)?.get(input.value) || 0;
    input.disabled = count === 0;
    const label = block.querySelector(`label[for="${input.id}"]`);
    if (label) label.textContent = `${labelMap.get(groupKey)?.get(input.value) || input.value} (${count})`;
  });
}

export default async function decorate(block) {
  const config = readBlockConfig(block);
  const viewRaw = Array.isArray(config.view) ? config.view[0] : config.view;
  const view = String(viewRaw || 'cards').trim().toLowerCase() === 'list' ? 'list' : 'cards';
  const keywords = parseKeywords(config.keywords);
  const excluded = parseKeywords(config['excluded-keywords']);
  const searchBarRaw = Array.isArray(config.searchbar) ? config.searchbar[0] : config.searchbar;
  const searchBarEnabled = String(searchBarRaw || '').trim().toLowerCase() === 'enabled';
  const rawLimit = Array.isArray(config.limit) ? config.limit[0] : config.limit;
  const pageSize = parseInt(String(rawLimit ?? '').trim(), 10) || DEFAULT_LIMIT;
  const filterGroups = parseFilterGroupsFromConfig(config);
  const initialQuery = (new URLSearchParams(window.location.search).get('q') || '').trim();

  const state = {
    offset: 0,
    hasMore: true,
    rows: [],
    pathSet: new Set(),
    displayCount: pageSize,
    query: initialQuery,
    sort: 'newest',
    loading: false,
  };

  block.textContent = '';
  const listId = `search-list-${Date.now()}`;
  const idPrefix = `search-${Date.now()}`;
  const sortSelectId = `search-sort-${Date.now()}`;

  const controls = createTag('div', { class: 'search-controls' });
  const resultsWrap = createTag('div', { class: 'search-results-wrap' });
  const status = createTag('p', { class: 'search-status', role: 'status', 'aria-live': 'polite' });
  const list = createTag('ul', { class: `search-results search-results-${view}`, id: listId });
  const empty = createTag('p', { class: 'search-empty', hidden: true }, 'No matching results.');
  const loadMore = createTag('button', {
    type: 'button',
    class: 'search-load-more search-load-more-hidden button primary',
  }, 'Load More');
  resultsWrap.append(status, list, loadMore, empty);

  async function render() {
    state.loading = true;
    loadMore.disabled = true;
    loadMore.textContent = 'Loading...';

    try {
      const needed = state.displayCount;
      await fetchMatchingRows(state, keywords, excluded, state.query, needed);

      const sortBy = block.querySelector('select[name="search-sort"]')?.value || state.sort;
      state.sort = sortBy;

      let filtered = state.rows.filter((row) => matchesQuery(row, state.query));
      if (filterGroups.length > 0) {
        const selectedByGroup = getSelectedByGroupFromBlock(block, filterGroups);
        const matchesFilter = (row) => rowMatchesFilterGroups(row, selectedByGroup, filterGroups);
        filtered = filtered.filter(matchesFilter);
        const queryRows = state.rows.filter((row) => matchesQuery(row, state.query));
        updateFilterCounts(block, filterGroups, queryRows);
      }

      const sorted = sortByDate(filtered, state.sort);
      const visible = sorted.slice(0, state.displayCount);

      list.textContent = '';
      visible.forEach((row) => list.append(buildResultItem(row, view, filterGroups)));

      empty.hidden = visible.length > 0;

      if (state.query) {
        status.hidden = false;
        const n = visible.length;
        const total = filtered.length;
        status.textContent = `Showing ${n} of ${total} results for "${state.query}".`;
      } else if (filterGroups.length > 0) {
        const selectedCount = filterGroups.reduce((sum, g) => {
          const selected = getSelectedByGroupFromBlock(block, filterGroups).get(g.key) || [];
          return sum + selected.length;
        }, 0);
        status.hidden = false;
        const filterLabel = selectedCount > 1 ? 'filters' : 'filter';
        status.textContent = selectedCount
          ? `Showing ${visible.length} of ${filtered.length} for ${selectedCount} selected ${filterLabel}.`
          : `Showing all ${filtered.length} results.`;
      } else {
        status.hidden = true;
        status.textContent = '';
      }

      const hasMoreThanOnePage = filtered.length > pageSize;
      const hasMoreToShow = visible.length < filtered.length;
      const mayHaveMoreToFetch = state.hasMore && visible.length >= pageSize;
      const showLoadMore = hasMoreThanOnePage && (hasMoreToShow || mayHaveMoreToFetch);
      loadMore.classList.toggle('search-load-more-hidden', !showLoadMore);
    } finally {
      loadMore.disabled = false;
      loadMore.textContent = 'Load More';
      state.loading = false;
    }
  }

  if (searchBarEnabled) {
    const form = createTag('form', { class: 'search-query-form', role: 'search', 'aria-label': 'Search content' });
    const input = createTag('input', {
      type: 'search',
      name: 'q',
      value: state.query,
      placeholder: 'Search',
      'aria-label': 'Search',
    });
    form.append(input, createTag('button', { type: 'submit', class: 'button primary' }, 'Search'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      state.query = input.value.trim();
      state.offset = 0;
      state.hasMore = true;
      state.rows = [];
      state.pathSet = new Set();
      state.displayCount = pageSize;
      const url = new URL(window.location.href);
      if (state.query) url.searchParams.set('q', state.query);
      else url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
      await render();
    });
    controls.append(form);
  }

  if (filterGroups.length > 0) {
    const { aside, sortSelect } = buildFilterSidebar(filterGroups, listId, idPrefix, sortSelectId);
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      render();
    });
    aside.addEventListener('change', () => render());
    const layout = createTag('div', { class: 'search-layout' });
    layout.append(aside, resultsWrap);
    block.append(controls, layout);
  } else {
    const sortLabel = createTag('label', { class: 'search-sort-label', for: sortSelectId }, 'Sort');
    const sortSelect = createTag('select', { id: sortSelectId, name: 'search-sort' }, [
      createTag('option', { value: 'newest' }, 'Newest'),
      createTag('option', { value: 'oldest' }, 'Oldest'),
    ]);
    sortLabel.append(sortSelect);
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      render();
    });
    controls.append(sortLabel);
    block.append(controls, resultsWrap);
  }

  loadMore.addEventListener('click', async () => {
    if (state.loading) return;
    state.displayCount += pageSize;
    await render();
  });

  await render();
}
