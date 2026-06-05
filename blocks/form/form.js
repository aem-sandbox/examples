import {
  buildBlock, decorateBlock, loadBlock, toCamelCase, toClassName,
} from '../../scripts/aem.js';

function isUE() {
  return window.location.hostname.includes('ue.da') || window.location.host.includes('localhost:4712');
}

function createElement(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

function generateId(name, option = null) {
  const id = toCamelCase(name);
  return option ? `${id}-${toCamelCase(option)}` : id;
}

function writeHelpText(text, inputId) {
  const help = createElement('p', 'field-help-text');
  help.textContent = text;
  help.id = `${inputId}-help`;
  return help;
}

function buildLabel(text, type = 'label', id = null, required = false) {
  const label = createElement(type);
  label.textContent = text;
  if (id && type === 'label') label.setAttribute('for', id);
  if (required) label.dataset.required = 'true';
  return label;
}

function buildInput(field) {
  const {
    type, field: fieldName, required, default: defaultValue, placeholder,
  } = field;

  const input = createElement('input');
  input.type = type || 'text';
  input.id = generateId(fieldName);
  input.name = input.id;
  input.required = required === 'true';
  if (defaultValue) input.value = defaultValue;
  if (placeholder) input.placeholder = placeholder;
  return input;
}

function buildTextArea(field) {
  const {
    field: fieldName, required, default: defaultValue, placeholder,
  } = field;

  const textarea = createElement('textarea');
  textarea.id = generateId(fieldName);
  textarea.name = textarea.id;
  textarea.required = required === 'true';
  textarea.rows = 5;
  if (defaultValue) textarea.value = defaultValue;
  if (placeholder) textarea.placeholder = placeholder;
  return textarea;
}

function buildOptionInput(field, option) {
  const {
    type, field: fieldName, default: defaultValue, required,
  } = field;
  const id = generateId(fieldName, option);

  const input = createElement('input');
  input.type = type;
  input.id = id;
  input.name = generateId(fieldName);
  input.value = option;
  input.checked = option === defaultValue;
  input.required = required === 'true';

  return input;
}

function buildOptions(field, controlled) {
  const {
    type, options, label, required,
  } = field;
  if (!options) return null;

  const fieldset = createElement('fieldset', `form-field ${type}-field`);
  if (controlled) {
    const controller = controlled.split('-')[0];
    fieldset.dataset.controller = controller;
    fieldset.dataset.condition = controlled;
  }
  fieldset.append(buildLabel(label, 'legend', null, required === 'true'));

  options.split(',').forEach((o) => {
    const option = o.trim();
    const input = buildOptionInput(field, option);
    const span = createElement('span');
    const labelEl = buildLabel(option, 'label', input.id);
    labelEl.prepend(input, span);
    fieldset.append(labelEl);
  });

  return fieldset;
}

async function buildOptionsFromUrl(url) {
  const resp = await fetch(url);
  const { data } = await resp.json();
  return data.map((o) => {
    const { option, value } = o;
    const optionEl = createElement('option');
    if (option && value) {
      optionEl.value = value;
      optionEl.textContent = option;
    } else if (option && !value) {
      optionEl.value = option;
      optionEl.textContent = option;
    } else if (value && !option) {
      optionEl.value = value;
      optionEl.textContent = value;
    }
    return optionEl;
  });
}

function buildSelect(field, controlled) {
  const {
    type, options, field: fieldName, label, required, placeholder,
  } = field;
  if (!options) return null;

  const wrapper = createElement('div', `form-field ${type}-field`);
  if (controlled) {
    const controller = controlled.split('-')[0];
    wrapper.dataset.controller = controller;
    wrapper.dataset.condition = controlled;
  }
  wrapper.append(buildLabel(label, 'label', generateId(fieldName), required === 'true'));

  const select = createElement('select');
  select.id = generateId(fieldName);
  select.name = select.id;
  select.required = required === 'true';
  wrapper.append(select);

  if (placeholder) {
    const placeholderOption = createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    select.append(placeholderOption);
  }

  try {
    const url = new URL(options);
    buildOptionsFromUrl(url).then((os) => {
      select.append(...os);
    });
  } catch {
    options.split(',').forEach((o) => {
      const option = o.trim();
      const optionEl = createElement('option');
      optionEl.value = option;
      optionEl.textContent = option;
      select.append(optionEl);
    });
  }

  return wrapper;
}

function buildToggle(field, controlled) {
  const {
    label, required, default: defaultValue,
  } = field;

  const wrapper = createElement('div', 'form-field toggle-field');
  if (controlled) {
    const controller = controlled.split('-')[0];
    wrapper.dataset.controller = controller;
    wrapper.dataset.condition = controlled;
  }

  const input = buildOptionInput({ ...field, type: 'checkbox' }, defaultValue || 'true');
  input.setAttribute('role', 'switch');
  input.setAttribute('aria-checked', input.checked);

  input.addEventListener('change', () => {
    input.setAttribute('aria-checked', input.checked);
  });

  const span = createElement('span');
  const labelEl = buildLabel(label, 'label', input.id, required === 'true');
  labelEl.prepend(input, span);
  wrapper.append(labelEl);

  return wrapper;
}

function buildButton(field) {
  const { type, label } = field;
  const button = createElement('button');
  button.className = 'button';
  if (type === 'submit') button.classList.add('primary');
  if (type === 'reset') button.classList.add('secondary');
  button.type = type;
  button.textContent = label;
  return button;
}

function toggleConditional(e, controllerConfig) {
  const { target } = e;
  const controller = target.name;
  if (controllerConfig.has(controller)) {
    const inputs = [...controllerConfig.get(controller)];
    inputs.forEach((i) => {
      const field = i.closest('.form-field');
      const { condition } = field.dataset;
      const conditionMet = condition.includes(toClassName(target.value));
      field.setAttribute('aria-hidden', !conditionMet);

      if (conditionMet) {
        if (i.dataset.originalRequired === 'true') {
          i.setAttribute('required', '');
        }
        i.removeAttribute('tabindex');
      } else {
        i.removeAttribute('required');
        i.setAttribute('tabindex', '-1');
      }
    });
  }
}

function initConditionals(form, controllerConfig) {
  controllerConfig.forEach((controlledInputs, controller) => {
    let controllerValue = null;
    const checked = form.querySelector(`[name="${controller}"]:checked`);
    const select = form.querySelector(`select[name="${controller}"]`);

    if (checked) {
      controllerValue = checked.value;
    } else if (select) {
      controllerValue = select.value;
    }

    if (controllerValue) {
      controlledInputs.forEach((input) => {
        const field = input.closest('.form-field');
        const { condition } = field.dataset;
        const conditionMet = condition.includes(toClassName(controllerValue));
        field.setAttribute('aria-hidden', !conditionMet);

        if (input.hasAttribute('required')) {
          if (!input.dataset.originalRequired) {
            input.dataset.originalRequired = 'true';
          }

          if (!conditionMet) {
            input.removeAttribute('required');
          }
        }

        if (conditionMet) {
          input.removeAttribute('tabindex');
        } else {
          input.setAttribute('tabindex', '-1');
        }
      });
    } else {
      controlledInputs.forEach((input) => {
        const field = input.closest('.form-field');
        field.setAttribute('aria-hidden', true);

        if (input.hasAttribute('required')) {
          if (!input.dataset.originalRequired) {
            input.dataset.originalRequired = 'true';
          }
          input.removeAttribute('required');
        }

        input.setAttribute('tabindex', '-1');
      });
    }
  });
}

function enableConditionals(form) {
  const controlled = [...form.querySelectorAll('[data-controller]')];
  const controllerConfig = new Map();

  controlled.forEach((c) => {
    const input = c.querySelector('input, textarea, select');
    const { controller } = c.dataset;

    if (!controllerConfig.has(controller)) controllerConfig.set(controller, []);
    controllerConfig.get(controller).push(input);

    if (input && input.id) {
      const controllerInputs = form.querySelectorAll(`[name="${controller}"]`);

      controllerInputs.forEach((controllerInput) => {
        const existingControls = controllerInput.getAttribute('aria-controls') || '';
        const controlsArray = existingControls.split(' ').filter((ec) => ec);

        if (!controlsArray.includes(input.id)) {
          controlsArray.push(input.id);
        }

        controllerInput.setAttribute('aria-controls', controlsArray.join(' '));
        input.setAttribute('aria-controlledby', controllerInput.id);
      });
    }
  });

  initConditionals(form, controllerConfig);

  form.addEventListener('change', (e) => {
    toggleConditional(e, controllerConfig);
  });
}

function toggleForm(form, disabled = true) {
  [...form.elements].forEach((el) => {
    el.disabled = disabled;
  });
}

function generatePayload(form) {
  const payload = {};
  [...form.elements].forEach((field) => {
    if (field.name && !field.disabled) {
      if (field.type === 'radio') {
        if (field.checked) payload[field.name] = field.value;
      } else if (field.type === 'checkbox') {
        if (field.checked) payload[field.name] = payload[field.name] ? `${payload[field.name]},${field.value}` : field.value;
      } else {
        payload[field.name] = field.value;
      }
    }
  });
  return payload;
}

function normalizeConfirmationPath(raw) {
  if (typeof raw !== 'string') return null;
  let path = raw.trim();
  if (!path) return null;

  try {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      const url = new URL(path);
      if (url.origin !== window.location.origin) return null;
      path = url.pathname;
    }
  } catch {
    return null;
  }

  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

async function replaceWithThankYou(form, confirmationPath) {
  const path = normalizeConfirmationPath(confirmationPath);
  if (!path) return false;

  const block = form.closest('.block');
  if (!block) return false;

  const link = document.createElement('a');
  link.href = path;

  const fragmentBlock = buildBlock('fragment', [[link]]);
  const tmp = document.createElement('div');
  tmp.setAttribute('hidden', '');
  tmp.appendChild(fragmentBlock);
  block.parentElement.appendChild(tmp);

  try {
    decorateBlock(fragmentBlock);
    await loadBlock(fragmentBlock);

    const hasContent = fragmentBlock.querySelector('.section');
    if (hasContent) {
      block.replaceChildren(...fragmentBlock.childNodes);
      return true;
    }
    return false;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load thank you fragment:', path, error);
    return false;
  } finally {
    tmp.remove();
  }
}

async function handleSubmit(form) {
  const status = form.querySelector('.form-status');
  const setStatus = (msg) => { if (status) status.textContent = msg; };

  try {
    const payload = generatePayload(form);
    const body = { data: payload };

    toggleForm(form);
    setStatus('Sending...');

    const response = await fetch(form.dataset.action, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      if (form.dataset.confirmation) {
        const replaced = await replaceWithThankYou(form, form.dataset.confirmation);
        if (!replaced) {
          setStatus('Thanks! Your message has been sent.');
          form.reset();
        }
      } else {
        setStatus('Thanks! Your message has been sent.');
        form.reset();
      }
    } else {
      const error = await response.text();
      throw new Error(error);
    }
  } catch (error) {
    setStatus('Unable to submit right now. Please try again.');
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    toggleForm(form, false);
  }
}

function enableSubmission(form, submit, fields) {
  form.dataset.action = submit;
  const confirmation = fields.find((f) => f.type === 'confirmation');
  if (confirmation) {
    form.dataset.confirmation = confirmation.label || confirmation.default;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const valid = form.reportValidity();
    if (valid) {
      handleSubmit(form);
    } else {
      const firstInvalid = form.querySelector(':invalid:not(fieldset)');
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.setAttribute('aria-invalid', true);
      }
    }
  });

  form.addEventListener('input', (e) => {
    if (e.target.hasAttribute('aria-invalid') && e.target.validity.valid) {
      e.target.removeAttribute('aria-invalid');
    }
  });
}

function buildField(field) {
  const {
    type, label, help, field: fieldName, conditional,
  } = field;
  const controlled = conditional || null;

  if (type === 'submit' || type === 'reset') {
    return buildButton(field);
  }

  if (type === 'radio' || type === 'checkbox') {
    const fieldset = buildOptions(field, controlled);
    if (help) {
      const helpText = writeHelpText(help, generateId(fieldName));
      fieldset.append(helpText);
    }
    return fieldset;
  }

  if (type === 'toggle') {
    const toggle = buildToggle(field, controlled);
    if (help) {
      const helpText = writeHelpText(help, generateId(fieldName));
      toggle.append(helpText);
    }
    return toggle;
  }

  if (type === 'select') {
    const select = buildSelect(field, controlled);
    if (help) {
      const helpText = writeHelpText(help, generateId(fieldName));
      select.append(helpText);
    }
    return select;
  }

  const wrapper = createElement('div', `form-field ${type}-field`);
  if (controlled) {
    const controller = controlled.split('-')[0];
    wrapper.dataset.controller = controller;
    wrapper.dataset.condition = controlled;
  }
  const inputId = generateId(fieldName);
  wrapper.append(buildLabel(label, 'label', inputId, field.required === 'true'));

  let helpText;
  if (help) {
    helpText = writeHelpText(help, inputId);
    wrapper.append(helpText);
  }

  const input = type === 'textarea' ? buildTextArea(field) : buildInput(field);

  if (type === 'textarea') {
    wrapper.append(input);
  } else {
    wrapper.insertBefore(input, wrapper.firstChild.nextSibling);
  }

  if (help) input.setAttribute('aria-describedby', helpText.id);

  return wrapper;
}

function buildForm(fields, submit) {
  const form = createElement('form');
  form.setAttribute('novalidate', '');

  const buttons = [];

  fields.forEach((field) => {
    if (field.type === 'submit' || field.type === 'reset') {
      buttons.push(field);
    } else if (field.type !== 'confirmation') {
      form.append(buildField(field));
    }
  });

  if (buttons.length) {
    const buttonWrapper = createElement('div', 'button-wrapper');
    buttons.forEach((button) => buttonWrapper.append(buildField(button)));
    form.append(buttonWrapper);
  }

  const status = createElement('p', 'form-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.append(status);

  enableConditionals(form);

  if (submit) enableSubmission(form, submit, fields);

  return form;
}

export default function decorate(block) {
  if (isUE()) return;
  block.style.visibility = 'hidden';
  const [source, submit] = [...block.querySelectorAll('a[href]')].map((a) => a.href);
  if (source) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          try {
            const resp = await fetch(new URL(source, window.location.origin));
            if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
            const json = await resp.json();
            const raw = json.data ?? json.fields ?? json;
            let data = null;
            if (Array.isArray(raw)) {
              data = raw;
            } else if (raw?.fields && Array.isArray(raw.fields)) {
              data = raw.fields;
            }
            if (!data) throw new Error(`No form fields at ${source}`);
            const form = buildForm(data, submit);
            block.replaceChildren(form);
            block.removeAttribute('style');
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Could not build form from', source, error);
            block.parentElement.remove();
          }
          observer.disconnect();
        }
      });
    }, { threshold: 0 });

    observer.observe(block);
  } else {
    // eslint-disable-next-line no-console
    console.error('Unable to create form without source');
    block.parentElement.remove();
  }
}
