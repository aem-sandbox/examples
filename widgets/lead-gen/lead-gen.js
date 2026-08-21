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
    companySizeOptions: copy.companySizeOptions ?? en.companySizeOptions ?? [],
    challengeOptions: copy.challengeOptions ?? en.challengeOptions ?? [],
    priorityOptions: copy.priorityOptions ?? en.priorityOptions ?? [],
    roleOptions: copy.roleOptions ?? en.roleOptions ?? [],
    companySizeLabels: copy.companySizeLabels ?? en.companySizeLabels ?? {},
    priorityLabels: copy.priorityLabels ?? en.priorityLabels ?? {},
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
 * Namespaces the lead form's known static IDs and their explicit references.
 * @param {HTMLElement} widget - Widget root
 */
function namespaceLeadIds(widget) {
  const { instanceId } = widget.dataset;
  const ids = new Map();
  widget.querySelectorAll('[id^="lead-gen-"]').forEach((element) => {
    const original = element.id;
    const namespaced = `${instanceId}-${original}`;
    ids.set(original, namespaced);
    element.id = namespaced;
  });

  widget.querySelectorAll('[for], [aria-labelledby]').forEach((element) => {
    ['for', 'aria-labelledby'].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (!value) return;
      element.setAttribute(attribute, value
        .split(/\s+/)
        .map((token) => ids.get(token) || token)
        .join(' '));
    });
  });
}

/**
 * Builds option cards into a container.
 * @param {HTMLElement} container - Target element
 * @param {Object[]} options - Option definitions from JSON
 * @param {string} inputType - radio or checkbox
 * @param {string} inputName - Form field name
 * @param {string} instanceId - Page-local widget instance prefix
 */
function buildOptions(container, options, inputType, inputName, instanceId) {
  container.replaceChildren();
  options.forEach((opt) => {
    const id = `${instanceId}-${inputName}-${opt.value}`;
    const label = document.createElement('label');
    label.className = 'lead-gen-option';
    label.setAttribute('for', id);

    const input = document.createElement('input');
    input.type = inputType;
    input.name = inputName;
    input.id = id;
    input.value = opt.value;
    if (inputType === 'radio') input.required = true;

    const icon = document.createElement('span');
    icon.className = 'lead-gen-option-icon';
    icon.textContent = opt.icon;
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'lead-gen-option-text';

    const title = document.createElement('span');
    title.className = 'lead-gen-option-label';
    title.textContent = opt.label;

    const hint = document.createElement('span');
    hint.className = 'lead-gen-option-hint';
    hint.textContent = opt.hint;

    text.append(title, hint);
    label.append(input, icon, text);
    container.append(label);
  });
}

/**
 * Populates the role select dropdown.
 * @param {HTMLSelectElement} select - Role select element
 * @param {Object[]} options - Role options from JSON
 * @param {string} placeholder - Placeholder option text
 */
function buildRoleSelect(select, options, placeholder) {
  select.replaceChildren();
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = placeholder;
  ph.disabled = true;
  ph.selected = true;
  select.append(ph);
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    select.append(option);
  });
}

/**
 * Applies all copy from JSON to static DOM nodes.
 * @param {HTMLElement} widget - Widget root
 * @param {Object} copy - Loaded copy object
 */
function applyCopy(widget, copy) {
  const form = widget.querySelector('.lead-gen-form');
  form.setAttribute('aria-label', copy.formAriaLabel);

  const intro = widget.querySelector('[data-panel="intro"]');
  intro.querySelector('.lead-gen-eyebrow').textContent = copy.intro.eyebrow;
  intro.querySelector('.lead-gen-headline').textContent = copy.intro.headline;
  intro.querySelector('.lead-gen-description').textContent = copy.intro.description;
  intro.querySelector('.lead-gen-time').textContent = copy.intro.timeEstimate;

  const perksList = intro.querySelector('.lead-gen-perks');
  perksList.setAttribute('aria-label', copy.intro.perksLabel);
  perksList.replaceChildren();
  copy.intro.perks.forEach((perk) => {
    const li = document.createElement('li');
    li.textContent = perk;
    perksList.append(li);
  });

  widget.querySelector('.lead-gen-start').textContent = copy.intro.cta;

  const stepKeys = ['companySize', 'challenges', 'priority', 'contact'];
  const panelNames = ['company-size', 'challenges', 'priority', 'contact'];
  stepKeys.forEach((key, i) => {
    const panel = widget.querySelector(`[data-panel="${panelNames[i]}"]`);
    const step = copy.steps[key];
    panel.querySelector('.lead-gen-step-label').textContent = step.label;
    panel.querySelector('.lead-gen-step-title').textContent = step.title;
    panel.querySelector('.lead-gen-step-subtitle').textContent = step.subtitle;
    if (key === 'contact') {
      panel.querySelector('.lead-gen-consent').textContent = step.consent;
    }
  });

  const { labels } = copy;
  const labelMap = [
    ['firstName', labels.firstName],
    ['lastName', labels.lastName],
    ['email', labels.email],
    ['company', labels.company],
    ['role', labels.role],
    ['phone', labels.phone],
  ];
  labelMap.forEach(([name, text]) => {
    const field = widget.querySelector(`[name="${name}"]`);
    const label = field && widget.querySelector(`label[for="${field.id}"] .label-text`);
    if (label) label.textContent = text;
  });

  const { instanceId } = widget.dataset;

  buildOptions(
    widget.querySelector('[data-panel="company-size"] .lead-gen-options'),
    copy.companySizeOptions,
    'radio',
    'companySize',
    instanceId,
  );
  buildOptions(
    widget.querySelector('[data-panel="challenges"] .lead-gen-options'),
    copy.challengeOptions,
    'checkbox',
    'challenges',
    instanceId,
  );
  buildOptions(
    widget.querySelector('[data-panel="priority"] .lead-gen-options'),
    copy.priorityOptions,
    'radio',
    'priority',
    instanceId,
  );
  buildRoleSelect(
    widget.querySelector('[name="role"]'),
    copy.roleOptions,
    labels.selectRole,
  );

  widget.querySelector('.lead-gen-back').textContent = copy.nav.back;
  widget.querySelector('.lead-gen-next').textContent = copy.nav.next;
  widget.querySelector('.lead-gen-progress').setAttribute('aria-label', copy.nav.progressLabel);
  widget.querySelector('.lead-gen-restart').textContent = copy.success.restart;

  widget.dataset.copy = JSON.stringify({
    nav: copy.nav,
    success: copy.success,
    companySizeLabels: copy.companySizeLabels,
    priorityLabels: copy.priorityLabels,
  });
}

const PANELS = ['intro', 'company-size', 'challenges', 'priority', 'contact', 'success'];
const STEP_PANELS = ['company-size', 'challenges', 'priority', 'contact'];

/**
 * Enables or disables the next button based on current panel validation.
 * @param {HTMLElement} widget - Widget root
 * @param {string} panelName - Active step panel
 */
function updateNextState(widget, panelName) {
  const nextBtn = widget.querySelector('.lead-gen-next');
  const panel = widget.querySelector(`[data-panel="${panelName}"]`);

  if (panelName === 'challenges') {
    nextBtn.disabled = !panel.querySelector('input:checked');
    return;
  }

  if (panelName === 'contact') {
    const form = widget.querySelector('.lead-gen-form');
    nextBtn.disabled = !form.checkValidity();
    return;
  }

  nextBtn.disabled = !panel.querySelector('input:checked');
}

/**
 * Shows a panel by name and updates footer/progress state.
 * @param {HTMLElement} widget - Widget root
 * @param {string} panelName - Panel data-panel value
 */
function showPanel(widget, panelName) {
  PANELS.forEach((name) => {
    const panel = widget.querySelector(`[data-panel="${name}"]`);
    if (name === panelName) {
      panel.removeAttribute('hidden');
      panel.setAttribute('tabindex', '-1');
      panel.focus();
    } else {
      panel.setAttribute('hidden', '');
    }
  });

  const footerIntro = widget.querySelector('.lead-gen-footer-intro');
  const footerSteps = widget.querySelector('.lead-gen-footer-steps');
  const progress = widget.querySelector('.lead-gen-progress');
  const copy = JSON.parse(widget.dataset.copy || '{}');

  if (panelName === 'intro') {
    footerIntro.removeAttribute('hidden');
    footerSteps.setAttribute('hidden', '');
    progress.value = 0;
    widget.dataset.stage = 'intro';
    return;
  }

  if (panelName === 'success') {
    footerIntro.setAttribute('hidden', '');
    footerSteps.setAttribute('hidden', '');
    progress.value = progress.max;
    widget.dataset.stage = 'success';
    return;
  }

  footerIntro.setAttribute('hidden', '');
  footerSteps.removeAttribute('hidden');
  widget.dataset.stage = 'steps';

  const stepIndex = STEP_PANELS.indexOf(panelName);
  progress.value = stepIndex + 1;

  const progressText = widget.querySelector('.lead-gen-progress-text');
  progressText.textContent = interpolate(copy.nav?.stepOf || 'Step {current} of {total}', {
    current: stepIndex + 1,
    total: STEP_PANELS.length,
  });

  const backBtn = widget.querySelector('.lead-gen-back');
  if (stepIndex > 0) backBtn.removeAttribute('hidden');
  else backBtn.setAttribute('hidden', '');

  const nextBtn = widget.querySelector('.lead-gen-next');
  nextBtn.textContent = stepIndex === STEP_PANELS.length - 1
    ? (copy.nav?.submit || 'Submit')
    : (copy.nav?.next || 'Continue');

  updateNextState(widget, panelName);
}

/**
 * Collects only the non-personal values needed for the local demo result.
 * @param {HTMLElement} widget - Widget root
 * @returns {Object} Demo result values
 */
function collectDemoResult(widget) {
  const form = widget.querySelector('.lead-gen-form');
  const data = new FormData(form);
  return {
    companySize: data.get('companySize'),
    priority: data.get('priority'),
  };
}

/**
 * Shows the success panel with personalized copy.
 * @param {HTMLElement} widget - Widget root
 * @param {Object} result - Local demo result values
 */
function showSuccess(widget, result) {
  const copy = JSON.parse(widget.dataset.copy || '{}');
  const success = widget.querySelector('[data-panel="success"]');
  success.querySelector('.lead-gen-success-icon').textContent = copy.success?.icon || '';
  success.querySelector('.lead-gen-headline').textContent = copy.success?.headline || '';
  success.querySelector('.lead-gen-description').textContent = copy.success?.description || '';

  const companySize = copy.companySizeLabels?.[result.companySize] || result.companySize;
  const priority = copy.priorityLabels?.[result.priority] || result.priority;
  const personalized = interpolate(copy.success?.personalized || '', { companySize, priority });
  success.querySelector('.lead-gen-personalized').textContent = personalized;

  showPanel(widget, 'success');
}

/**
 * Resets the form to its initial state.
 * @param {HTMLElement} widget - Widget root
 */
function resetForm(widget) {
  const form = widget.querySelector('.lead-gen-form');
  form.reset();
  form.querySelectorAll('.lead-gen-option').forEach((opt) => opt.classList.remove('selected'));
  showPanel(widget, 'intro');
}

/**
 * Decorates the lead-gen widget: loads copy, wires navigation, handles submit.
 * @param {HTMLElement} widget - Widget root element
 */
export default async function decorate(widget) {
  const lang = getLanguage();
  const copy = await loadWidgetCopy(lang).catch(() => ({}));
  if (!copy.intro) return;

  namespaceLeadIds(widget);
  applyCopy(widget, copy);
  showPanel(widget, 'intro');

  let currentStep = 0;

  widget.querySelector('.lead-gen-start').addEventListener('click', () => {
    currentStep = 0;
    showPanel(widget, STEP_PANELS[currentStep]);
  });

  widget.querySelector('.lead-gen-back').addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep -= 1;
      showPanel(widget, STEP_PANELS[currentStep]);
    }
  });

  widget.querySelector('.lead-gen-next').addEventListener('click', () => {
    const panelName = STEP_PANELS[currentStep];

    if (panelName === 'contact') {
      const form = widget.querySelector('.lead-gen-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      showSuccess(widget, collectDemoResult(widget));
      return;
    }

    currentStep += 1;
    showPanel(widget, STEP_PANELS[currentStep]);
  });

  widget.querySelector('.lead-gen-restart').addEventListener('click', () => {
    resetForm(widget);
    currentStep = 0;
  });

  widget.addEventListener('change', (e) => {
    const option = e.target.closest('.lead-gen-option');
    if (option) {
      const container = option.closest('.lead-gen-options');
      if (container?.classList.contains('lead-gen-options-multi')) {
        option.classList.toggle('selected', option.querySelector('input').checked);
      } else {
        container?.querySelectorAll('.lead-gen-option').forEach((o) => o.classList.remove('selected'));
        option.classList.add('selected');
      }
    }

    const activePanel = STEP_PANELS[currentStep];
    if (activePanel) updateNextState(widget, activePanel);
  });

  widget.querySelector('.lead-gen-form').addEventListener('input', () => {
    if (STEP_PANELS[currentStep] === 'contact') {
      updateNextState(widget, 'contact');
    }
  });
}
