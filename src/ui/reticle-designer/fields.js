// Number fields for the Reticle Designer's panes. Each field shows a value
// held in its internal unit (radians for angles) through a display
// conversion, and reports every valid keystroke straight away — the
// reticle updates live, with no Apply step. A run of keystrokes in one
// field is one undo step: `onInput` passes the field's own coalescing key,
// and the run ends when the field loses focus.
//
// `refresh(value)` updates the shown value from outside (an undo, a drag
// in the view) — skipped while the field has focus, so typing is never
// overwritten mid-number.
import { el } from '../../dom.js';
import { i18nSpan, t } from '../../i18n.js';

let fieldCounter = 0;

export function numberField({
  labelKey, unitLabel = '', value, toDisplay = (v) => v, fromDisplay = (v) => v, format = (v) => String(v),
  onInput, onCommitEnd, step = 'any', integer = false, id, placeholder
}) {
  fieldCounter += 1;
  const inputId = id || `reticle-field-${fieldCounter}`;
  // `placeholder` shows while the value is not a single number (several
  // selected elements that differ).
  const input = el('input', { type: 'number', inputmode: 'decimal', step: String(step), id: inputId, placeholder });
  const message = el('span', { class: 'reticle-field-message', role: 'status' });
  let focused = false;
  let current = value;

  const show = (v) => {
    input.value = Number.isFinite(v) ? format(toDisplay(v)) : '';
  };
  show(value);

  function setMessage(key) {
    message.textContent = key ? t(key) : '';
    input.classList.toggle('invalid', Boolean(key));
  }

  input.addEventListener('focus', () => { focused = true; });
  input.addEventListener('input', () => {
    const raw = input.value.trim();
    const shown = Number(raw);
    if (raw === '' || !Number.isFinite(shown) || (integer && !Number.isInteger(shown))) {
      setMessage('reticleDesigner.errors.number');
      return;
    }
    const result = onInput(fromDisplay(shown));
    // onInput returns an error key to show, or nothing when applied.
    setMessage(typeof result === 'string' ? result : null);
  });
  const end = () => {
    focused = false;
    if (onCommitEnd) onCommitEnd();
    show(current);
    setMessage(null);
  };
  input.addEventListener('blur', end);
  input.addEventListener('change', () => { if (onCommitEnd) onCommitEnd(); });

  const node = el('label', { class: 'reticle-field', for: inputId }, [
    el('span', { class: 'reticle-field-label' }, [i18nSpan(labelKey)]),
    el('span', { class: 'reticle-field-input' }, [input, unitLabel ? el('span', { class: 'reticle-field-unit', text: unitLabel }) : null]),
    message
  ]);

  return {
    node,
    input,
    refresh(next) {
      current = next;
      if (!focused) show(next);
    },
    setMessage
  };
}

export function checkboxField({ labelKey, checked, onChange, id }) {
  fieldCounter += 1;
  const input = el('input', { type: 'checkbox', id: id || `reticle-check-${fieldCounter}` });
  input.checked = checked === true;
  input.indeterminate = checked === null;
  input.addEventListener('change', () => onChange(input.checked));
  const label = i18nSpan(labelKey);
  return {
    node: el('label', { class: 'reticle-check' }, [input, label]),
    input,
    label,
    // `null`: several selected elements that differ (shown indeterminate).
    refresh(next) {
      input.indeterminate = next === null;
      input.checked = next === true;
    }
  };
}
