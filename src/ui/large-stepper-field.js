import { el } from '../dom.js';
import { FIELD_UNITS, UNIT_GROUPS, unitChoice, engineToDisplay, displayToEngine, engineSpanToDisplay, roundForDisplay, formatFieldRange } from '../units.js';
import { getUnit } from '../prefs.js';
import { t, i18nSpan } from '../i18n.js';
import { fieldValidity } from './field-validity.js';

// A unitField()-equivalent — same engine<->display unit conversion (see
// units.js), same "fields.<id>" translation-key convention — but rendered
// as large +/- buttons flanking the number instead of a plain input, for
// controls that need to be operable at arm's length or with gloves on.
// Range Solver's Wind speed is the first (and so far only) user of this;
// kept as its own small component rather than a unitField() mode since it
// needs its own DOM (two buttons) unitField() has no hook to add.
//
// Unlike unitField()'s plain mode, onInput fires unconditionally, even on
// a blank/invalid intermediate value (getEngineValue() then reports NaN)
// — range-solver-view.js's recompute() deliberately relies on seeing that
// NaN so it can show a "—" placeholder while the field is mid-edit, rather
// than silently freezing on the last result. What must never happen is a
// *persistent* component (like the chart's zoomRangeSlider) trusting that
// NaN into its own retained state — that boundary already guards itself.
export function largeStepperField({ id, min, max, step, value, onInput }) {
  const meta = FIELD_UNITS[id];
  const group = meta ? UNIT_GROUPS[meta.group] : null;
  let displayUnit = meta ? getUnit(meta.group) : null;
  if (meta && !unitChoice(id, displayUnit)) displayUnit = group.defaultUnit; // stale/unknown pref
  const choice = meta ? unitChoice(id, displayUnit) : null;

  const toDisp = (v) => (meta ? roundForDisplay(id, displayUnit, engineToDisplay(id, v, displayUnit)) : v);
  const toEng = (v) => (meta ? displayToEngine(id, v, displayUnit) : v);
  const stepDisp = step !== undefined ? engineSpanToDisplay(id, step, displayUnit) : 1;
  const dMin = min !== undefined ? toDisp(min) : undefined;
  const dMax = max !== undefined ? toDisp(max) : undefined;

  const number = el('input', { type: 'number', id, min: dMin, max: dMax, step: stepDisp, value: toDisp(value) });

  function clamp(v) {
    if (dMin !== undefined) v = Math.max(dMin, v);
    if (dMax !== undefined) v = Math.min(dMax, v);
    return v;
  }

  // Reads off the number input itself (not a closed-over variable) so
  // repeated clicks compound on whatever's currently showing, including a
  // value the user just typed by hand.
  function bump(delta) {
    const current = parseFloat(number.value);
    const base = Number.isNaN(current) ? toDisp(value) : current;
    number.value = clamp(base + delta);
    if (onInput) onInput();
  }

  const decButton = el('button', { type: 'button', class: 'large-stepper-btn', 'aria-label': t('fields.stepperDecrease') }, ['−']);
  const incButton = el('button', { type: 'button', class: 'large-stepper-btn', 'aria-label': t('fields.stepperIncrease') }, ['+']);
  decButton.addEventListener('click', () => bump(-stepDisp));
  incButton.addEventListener('click', () => bump(stepDisp));
  number.addEventListener('input', () => { if (onInput) onInput(); });

  // Live, per-field validation (red border + hint, only once actually
  // invalid — see field-validity.js), same idea as unitField()'s own.
  // No `optional` concept here (neither current caller — Range Solver's
  // target range/wind speed — ever leaves this blank), so an empty or
  // unparseable box is always a violation, not a legitimate "unset"
  // state. The +/- buttons never need to trigger this themselves —
  // bump()'s own clamp() already keeps them in range.
  function computeMessage() {
    const raw = number.value.trim();
    if (raw === '') return t('fields.errorRequired');
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return t('fields.errorRequired');
    if (min === undefined && max === undefined) return null;
    const engineValue = toEng(parsed);
    if ((min !== undefined && engineValue < min) || (max !== undefined && engineValue > max)) {
      return t('fields.errorRange', { range: formatFieldRange(id, min, max, displayUnit) });
    }
    return null;
  }
  const validity = fieldValidity(number, computeMessage);

  const unitSuffix = choice ? document.createTextNode(` (${choice.label})`) : null;
  const node = el('div', { class: 'field large-stepper-field' }, [
    el('label', {}, [i18nSpan('fields.' + id), unitSuffix].filter(Boolean)),
    el('div', { class: 'large-stepper-row' }, [decButton, number, incButton]),
    validity.hintNode
  ]);

  return {
    node,
    getEngineValue: () => toEng(parseFloat(number.value)),
    // Programmatic write path — mirrors unitField()'s setEngineValue,
    // never fires onInput itself. String()-wrapped like that one too —
    // a real browser auto-coerces a number assigned to `.value` anyway,
    // but explicit here keeps the two components' behavior identical
    // rather than relying on that coercion.
    setEngineValue(v) {
      number.value = String(toDisp(v));
    },
    validate: validity.validate
  };
}
