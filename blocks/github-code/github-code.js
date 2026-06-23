import { loadCSS, loadScript } from '../../scripts/aem.js';

const HLJS_VERSION = '11.11.1';
const HLJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HLJS_VERSION}`;

const EXT_TO_LANG = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  mdx: 'markdown',
  py: 'python',
  pyw: 'python',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  svg: 'xml',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  swift: 'swift',
  php: 'php',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  sql: 'sql',
  graphql: 'graphql',
  dockerfile: 'dockerfile',
  tf: 'hcl',
};

function detectLanguage(filename) {
  const name = filename.toLowerCase();
  if (name === 'dockerfile') return 'dockerfile';
  const ext = name.split('.').pop();
  return EXT_TO_LANG[ext] || 'plaintext';
}

function githubToRawUrl(href) {
  // https://github.com/owner/repo/blob/ref/path → https://raw.githubusercontent.com/owner/repo/ref/path
  const match = href.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/);
  return match ? `https://raw.githubusercontent.com/${match[1]}/${match[2]}` : null;
}

function parseLineRange(row) {
  if (!row) return { startLine: null, endLine: null };
  const cells = [...row.children];
  if (!cells.length) return { startLine: null, endLine: null };

  if (cells.length === 1) {
    const text = cells[0].textContent.trim();
    const range = text.match(/^(\d+)\s*[-:]\s*(\d+)$/);
    if (range) return { startLine: +range[1], endLine: +range[2] };
    const single = parseInt(text, 10);
    return { startLine: Number.isNaN(single) ? null : single, endLine: null };
  }

  const s = parseInt(cells[0].textContent.trim(), 10);
  const e = parseInt(cells[1]?.textContent.trim(), 10);
  return {
    startLine: Number.isNaN(s) ? null : s,
    endLine: Number.isNaN(e) ? null : e,
  };
}

function parseBlock(block) {
  const rows = [...block.children];
  const firstCell = rows[0]?.querySelector('div');
  const anchor = rows[0]?.querySelector('a[href]');
  const url = anchor?.href || firstCell?.textContent.trim();
  const { startLine, endLine } = parseLineRange(rows[1]);
  return { url, startLine, endLine };
}

function buildLineNums(start, count) {
  const nums = document.createElement('span');
  nums.className = 'github-code-nums';
  nums.setAttribute('aria-hidden', 'true');
  nums.textContent = Array.from({ length: count }, (_, i) => start + i).join('\n');
  return nums;
}

let hljsReady = null;

async function loadHighlighter(code) {
  if (!hljsReady) {
    const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const theme = isDark ? 'github-dark' : 'github';
    hljsReady = Promise.all([
      loadCSS(`${HLJS_BASE}/styles/${theme}.min.css`),
      loadScript(`${HLJS_BASE}/highlight.min.js`),
    ]);
  }
  await hljsReady;
  window.hljs?.highlightElement(code);
}

function buildHeader(filename, startLine, endLine, githubUrl) {
  const header = document.createElement('div');
  header.className = 'github-code-header';

  const meta = document.createElement('div');
  meta.className = 'github-code-meta';

  const nameEl = document.createElement('span');
  nameEl.className = 'github-code-filename';
  nameEl.textContent = filename;
  meta.append(nameEl);

  if (startLine || endLine) {
    const range = document.createElement('span');
    range.className = 'github-code-range';
    range.textContent = startLine && endLine
      ? `Lines ${startLine}–${endLine}`
      : `Line ${startLine || endLine}`;
    meta.append(range);
  }

  const actions = document.createElement('div');
  actions.className = 'github-code-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'github-code-copy';
  copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
  copyBtn.textContent = 'Copy';
  actions.append(copyBtn);

  const viewLink = document.createElement('a');
  viewLink.href = githubUrl;
  viewLink.target = '_blank';
  viewLink.rel = 'noopener noreferrer';
  viewLink.className = 'github-code-view';
  viewLink.textContent = 'View on GitHub';
  actions.append(viewLink);

  header.append(meta, actions);
  return { header, copyBtn };
}

async function renderCode(block, url, startLine, endLine) {
  const rawUrl = githubToRawUrl(url);
  if (!rawUrl) {
    block.replaceChildren(
      Object.assign(document.createElement('p'), {
        className: 'github-code-error',
        textContent: 'Invalid GitHub URL — expected https://github.com/owner/repo/blob/branch/path',
      }),
    );
    return;
  }

  block.innerHTML = '<div class="github-code-loading" aria-label="Loading…" role="status"></div>';

  try {
    const resp = await fetch(rawUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();

    const allLines = text.split('\n');
    const start = startLine ? Math.max(1, startLine) : 1;
    const end = endLine ? Math.min(allLines.length, endLine) : allLines.length;
    const slice = allLines.slice(start - 1, end);

    const filename = rawUrl.split('/').pop();
    const lang = detectLanguage(filename);

    const { header, copyBtn } = buildHeader(filename, startLine, endLine, url);

    const pre = document.createElement('pre');
    pre.className = 'github-code-pre';

    const nums = buildLineNums(start, slice.length);
    const code = document.createElement('code');
    code.className = `language-${lang}`;
    code.textContent = slice.join('\n');
    pre.append(nums, code);

    block.replaceChildren(header, pre);

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(slice.join('\n'));
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      } catch {
        copyBtn.textContent = 'Copy failed';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      }
    });

    await loadHighlighter(code);
  } catch (err) {
    block.replaceChildren(
      Object.assign(document.createElement('p'), {
        className: 'github-code-error',
        textContent: `Failed to load code: ${err.message}`,
      }),
    );
  }
}

export default function decorate(block) {
  const { url, startLine, endLine } = parseBlock(block);

  if (!url) {
    block.replaceChildren(
      Object.assign(document.createElement('p'), {
        className: 'github-code-error',
        textContent: 'No GitHub URL provided.',
      }),
    );
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      renderCode(block, url, startLine, endLine);
    }
  });
  observer.observe(block);
}
