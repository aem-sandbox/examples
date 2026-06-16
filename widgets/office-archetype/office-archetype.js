import { getLanguage } from '../../scripts/i18n.js';

const ARCHETYPE_KEYS = ['closer', 'diagram', 'quick-question', 'calendar-blocker', 'async-hero', 'vibes-curator'];

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
    questions: copy.questions ?? en.questions ?? [],
    archetypes: copy.archetypes ?? en.archetypes ?? {},
    floatIcons: copy.floatIcons ?? en.floatIcons ?? [],
  };
}

/**
 * Replaces {token} placeholders in a template string.
 * @param {string} template - String with {key} placeholders
 * @param {Object} vars - Key-value replacements
 * @returns {string}
 */
function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

/**
 * Spawns confetti particles inside the result panel.
 * @param {HTMLElement} container - Confetti container element
 */
function spawnConfetti(container) {
  container.replaceChildren();
  const colors = ['#3b63fb', '#ff6b6b', '#ffd93d', '#6bcb77', '#c77dff', '#ff922b'];
  for (let i = 0; i < 48; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'office-archetype-confetti-piece';
    piece.style.setProperty('--x', `${(Math.random() - 0.5) * 400}px`);
    piece.style.setProperty('--delay', `${Math.random() * 0.6}s`);
    piece.style.setProperty('--duration', `${1.2 + Math.random() * 1.5}s`);
    piece.style.setProperty('--color', colors[i % colors.length]);
    piece.style.setProperty('--rotation', `${Math.random() * 720}deg`);
    container.append(piece);
  }
}

/**
 * Applies intro copy and floating background icons.
 * @param {HTMLElement} widget - Widget root
 * @param {Object} copy - Loaded copy
 */
function applyIntro(widget, copy) {
  const intro = widget.querySelector('[data-panel="intro"]');
  intro.querySelector('.office-archetype-eyebrow').textContent = copy.intro.eyebrow;
  intro.querySelector('.office-archetype-headline').textContent = copy.intro.headline;
  intro.querySelector('.office-archetype-description').textContent = copy.intro.description;
  intro.querySelector('.office-archetype-time').textContent = copy.intro.timeEstimate;
  widget.querySelector('.office-archetype-start').textContent = copy.intro.cta;

  widget.querySelectorAll('.office-archetype-float').forEach((el, i) => {
    el.textContent = copy.floatIcons[i] || '💼';
  });
}

/**
 * Builds progress dot indicators.
 * @param {HTMLElement} widget - Widget root
 * @param {number} total - Total question count
 */
function buildProgressDots(widget, total) {
  const container = widget.querySelector('.office-archetype-progress-dots');
  container.replaceChildren();
  for (let i = 0; i < total; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'office-archetype-dot';
    dot.dataset.step = String(i);
    container.append(dot);
  }
}

/**
 * Renders one question's options into the quiz panel.
 * @param {HTMLElement} widget - Widget root
 * @param {Object} question - Question from JSON
 * @param {number} index - Zero-based question index
 * @param {Object} nav - Nav copy
 * @param {number} total - Total questions
 */
function renderQuestion(widget, question, index, nav, total) {
  const panel = widget.querySelector('[data-panel="quiz"]');
  panel.querySelector('.office-archetype-step-label').textContent = interpolate(nav.stepOf, {
    current: index + 1,
    total,
  });
  panel.querySelector('.office-archetype-question-title').textContent = question.title;

  const optionsEl = panel.querySelector('.office-archetype-options');
  optionsEl.replaceChildren();

  question.options.forEach((opt, optIndex) => {
    const id = `office-archetype-q${index}-${opt.value}`;
    const label = document.createElement('label');
    label.className = 'office-archetype-option';
    label.setAttribute('for', id);
    label.style.setProperty('--stagger', `${optIndex * 0.07}s`);

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `question-${index}`;
    input.id = id;
    input.value = opt.value;
    input.dataset.questionIndex = String(index);

    const icon = document.createElement('span');
    icon.className = 'office-archetype-option-icon';
    icon.textContent = opt.icon;
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'office-archetype-option-text';

    const title = document.createElement('span');
    title.className = 'office-archetype-option-label';
    title.textContent = opt.label;

    const hint = document.createElement('span');
    hint.className = 'office-archetype-option-hint';
    hint.textContent = opt.hint;

    text.append(title, hint);
    label.append(input, icon, text);
    optionsEl.append(label);
  });

  widget.querySelectorAll('.office-archetype-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
    dot.classList.toggle('done', i < index);
  });
}

/**
 * Tallies archetype scores from selected answers.
 * @param {Object[]} questions - All questions with options
 * @param {Map<number, string>} answers - Map of question index to selected value
 * @returns {string} Winning archetype key
 */
function computeArchetype(questions, answers) {
  const totals = Object.fromEntries(ARCHETYPE_KEYS.map((k) => [k, 0]));

  questions.forEach((question, qIndex) => {
    const selected = answers.get(qIndex);
    const option = question.options.find((o) => o.value === selected);
    if (!option?.scores) return;
    Object.entries(option.scores).forEach(([key, pts]) => {
      if (totals[key] !== undefined) totals[key] += pts;
    });
  });

  return ARCHETYPE_KEYS.reduce((best, key) => (totals[key] > totals[best] ? key : best));
}

/**
 * Shows the result panel with animated reveal.
 * @param {HTMLElement} widget - Widget root
 * @param {Object} copy - Loaded copy
 * @param {string} archetypeKey - Winning archetype id
 */
function showResult(widget, copy, archetypeKey) {
  const archetype = copy.archetypes[archetypeKey];
  if (!archetype) return;

  const panel = widget.querySelector('[data-panel="result"]');
  panel.querySelector('.office-archetype-result-eyebrow').textContent = copy.result.eyebrow;
  panel.querySelector('.office-archetype-badge-icon').textContent = archetype.icon;
  panel.querySelector('.office-archetype-result-title').textContent = archetype.title;
  panel.querySelector('.office-archetype-result-tagline').textContent = archetype.tagline;
  panel.querySelector('.office-archetype-result-roast').textContent = archetype.roast;

  const traitsEl = panel.querySelector('.office-archetype-traits');
  traitsEl.replaceChildren();
  archetype.traits.forEach((trait, i) => {
    const li = document.createElement('li');
    li.textContent = trait;
    li.style.setProperty('--stagger', `${0.15 + i * 0.12}s`);
    traitsEl.append(li);
  });

  panel.querySelector('.office-archetype-result-coworker').textContent = [
    copy.result.coworkerPrefix,
    archetype.coworker,
    copy.result.coworkerSuffix,
  ].join(' ');

  widget.querySelector('.office-archetype-share').textContent = copy.nav.share;
  widget.querySelector('.office-archetype-restart').textContent = copy.nav.restart;

  widget.dataset.archetype = archetypeKey;
  widget.dataset.resultTitle = archetype.title;

  spawnConfetti(panel.querySelector('.office-archetype-confetti'));

  widget.dataset.stage = 'result';
  widget.dataset.direction = 'forward';
  panel.removeAttribute('hidden');
  panel.setAttribute('tabindex', '-1');
  panel.focus();

  widget.querySelector('.office-archetype-controls-intro').setAttribute('hidden', '');
  widget.querySelector('.office-archetype-controls-quiz').setAttribute('hidden', '');

  requestAnimationFrame(() => {
    panel.classList.add('revealed');
  });
}

/**
 * Switches visible panel with slide animation.
 * @param {HTMLElement} widget - Widget root
 * @param {string} panelName - intro | quiz | result
 * @param {string} direction - forward | back
 */
function showPanel(widget, panelName, direction = 'forward') {
  widget.dataset.direction = direction;

  widget.querySelectorAll('.office-archetype-panel').forEach((panel) => {
    const isTarget = panel.dataset.panel === panelName;
    if (isTarget) {
      panel.removeAttribute('hidden');
      panel.classList.remove('revealed');
      if (panelName === 'result') return;
      requestAnimationFrame(() => {
        panel.classList.add('revealed');
        panel.setAttribute('tabindex', '-1');
        panel.focus();
      });
    } else {
      panel.setAttribute('hidden', '');
      panel.classList.remove('revealed');
    }
  });

  widget.dataset.stage = panelName;

  const controlsIntro = widget.querySelector('.office-archetype-controls-intro');
  const controlsQuiz = widget.querySelector('.office-archetype-controls-quiz');

  if (panelName === 'intro') {
    controlsIntro.removeAttribute('hidden');
    controlsQuiz.setAttribute('hidden', '');
  } else if (panelName === 'quiz') {
    controlsIntro.setAttribute('hidden', '');
    controlsQuiz.removeAttribute('hidden');
  }
}

/**
 * Decorates the office-archetype widget.
 * @param {HTMLElement} widget - Widget root element
 */
export default async function decorate(widget) {
  const lang = getLanguage();
  const copy = await loadWidgetCopy(lang).catch(() => null);
  if (!copy?.questions?.length) return;

  applyIntro(widget, copy);
  buildProgressDots(widget, copy.questions.length);

  widget.querySelector('.office-archetype-back').textContent = copy.nav.back;
  widget.querySelector('.office-archetype-next').textContent = copy.nav.next;
  widget.querySelector('.office-archetype-share').textContent = copy.nav.share;
  widget.querySelector('.office-archetype-restart').textContent = copy.nav.restart;

  const answers = new Map();
  let currentQuestion = 0;
  let transitioning = false;

  const updateNextButton = () => {
    const nextBtn = widget.querySelector('.office-archetype-next');
    const hasAnswer = answers.has(currentQuestion);
    nextBtn.disabled = !hasAnswer;
    nextBtn.textContent = currentQuestion === copy.questions.length - 1
      ? copy.nav.finish
      : copy.nav.next;
    widget.querySelector('.office-archetype-back')[currentQuestion > 0 ? 'removeAttribute' : 'setAttribute']('hidden', '');
  };

  const goToQuestion = (index, direction) => {
    if (transitioning) return;
    transitioning = true;
    currentQuestion = index;

    const panel = widget.querySelector('[data-panel="quiz"]');
    panel.classList.add('exiting');

    window.setTimeout(() => {
      renderQuestion(widget, copy.questions[index], index, copy.nav, copy.questions.length);
      panel.classList.remove('exiting');
      panel.classList.add('revealed');
      updateNextButton();

      const saved = answers.get(index);
      if (saved) {
        const input = panel.querySelector(`input[value="${saved}"]`);
        if (input) {
          input.checked = true;
          input.closest('.office-archetype-option')?.classList.add('selected');
        }
      }

      transitioning = false;
    }, direction === 'back' ? 200 : 280);

    showPanel(widget, 'quiz', direction);
  };

  widget.querySelector('.office-archetype-start').addEventListener('click', () => {
    answers.clear();
    currentQuestion = 0;
    goToQuestion(0, 'forward');
  });

  widget.querySelector('.office-archetype-back').addEventListener('click', () => {
    if (currentQuestion > 0) goToQuestion(currentQuestion - 1, 'back');
  });

  widget.querySelector('.office-archetype-next').addEventListener('click', () => {
    if (!answers.has(currentQuestion)) return;

    if (currentQuestion < copy.questions.length - 1) {
      goToQuestion(currentQuestion + 1, 'forward');
      return;
    }

    const winner = computeArchetype(copy.questions, answers);
    widget.querySelector('[data-panel="quiz"]').classList.add('exiting');
    window.setTimeout(() => {
      widget.querySelector('[data-panel="quiz"]').setAttribute('hidden', '');
      showResult(widget, copy, winner);
    }, 300);
  });

  widget.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type !== 'radio' || !input.closest('.office-archetype-options')) return;

    const qIndex = parseInt(input.dataset.questionIndex, 10);
    answers.set(qIndex, input.value);

    input.closest('.office-archetype-options')?.querySelectorAll('.office-archetype-option').forEach((opt) => {
      opt.classList.toggle('selected', opt.contains(input) && input.checked);
    });

    input.closest('.office-archetype-option')?.classList.add('pop');
    window.setTimeout(() => {
      input.closest('.office-archetype-option')?.classList.remove('pop');
    }, 400);

    updateNextButton();
  });

  widget.querySelector('.office-archetype-restart').addEventListener('click', () => {
    answers.clear();
    currentQuestion = 0;
    widget.querySelector('[data-panel="result"]').classList.remove('revealed');
    widget.querySelectorAll('.office-archetype-option').forEach((o) => o.classList.remove('selected'));
    showPanel(widget, 'intro', 'back');
  });

  widget.querySelector('.office-archetype-share').addEventListener('click', async () => {
    const title = widget.dataset.resultTitle || '';
    const text = `${copy.intro.headline} — ${title}`;
    const shareBtn = widget.querySelector('.office-archetype-share');

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      const original = shareBtn.textContent;
      shareBtn.textContent = copy.nav.shareSuccess;
      window.setTimeout(() => {
        shareBtn.textContent = original;
      }, 2000);
    } catch {
      // user cancelled share or clipboard denied
    }
  });

  showPanel(widget, 'intro');
}
