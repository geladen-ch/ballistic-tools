import { el } from '../dom.js';
import { FIELD_UNITS, UNIT_GROUPS, unitChoice, engineToDisplay, displayToEngine, engineSpanToDisplay, displaySpanToEngine, roundForDisplay, formatFieldRange } from '../units.js';
import { getUnit } from '../prefs.js';
import { i18nSpan, t } from '../i18n.js';
import { fieldValidity } from './field-validity.js';

// One form field bound to one engine parameter. `min`/`max`/`step`/`value`
// are always given in engine (metric) units — this is the only place that
// translates them into whatever unit the user currently prefers for this
// field's group, and back again on read. Everything outside this module
// (view code, the engine) only ever sees engine units.
//
// The field's label always comes from the "fields.<id>" translation key —
// every field id across every view is also its shared translation key, so
// the same word ("Muzzle velocity", say) never has to be typed, or
// translated, more than once.
//
// `slider: true` renders a range input paired with a small editable number
// box (kept in sync both ways); otherwise it's a single number input.
//
// `isSpan: true` is for a field whose *value itself* is an interval rather
// than an absolute reading (e.g. a temperature median-error field: "5
// degrees" of uncertainty, not a point on the scale) — value/min/max all
// go through the offset-free span conversion instead of the normal
// absolute one (step already does, for every field, since a step size is
// always a span regardless of what the field's own value means).
//
// `before`, if given, is a DOM node rendered directly to the left of the
// number input (not the label) — e.g. a presets <select> that pre-fills
// the input on choice (see Hit Probability's uncertainty fields), so the
// preset/custom-value pairing can reuse this field's own unit-conversion
// logic instead of duplicating it. Only applies in non-slider mode.
//
// `optional: true` lets the field start (and be cleared back to) blank —
// a value nobody has to supply (rifle rifling twist, bullet length's own
// hand-rolled equivalent before this existed) rather than one that's
// merely defaulted. `value: null`/`undefined` renders an empty input, and
// getEngineValue() reports that as `null` rather than NaN; every other
// caller (optional defaults to false) is unaffected — `value` is always a
// real number for them, so this never changes their behavior.
//
// `extraCheck(engineValue)`, if given, runs after the plain min/max check
// passes — an escape hatch for a cross-field constraint one static bound
// can't express (e.g. "range step must not exceed max range," where the
// limit is another field's own current value, not a fixed number). Return
// a violation message to fail validation the same way an out-of-range
// value does, or a falsy value to pass.
export function unitField({ id, min, max, step, value, slider = false, isSpan = false, optional = false, before = null, extraCheck = null, onInput }) {
  const meta = FIELD_UNITS[id];
  const group = meta ? UNIT_GROUPS[meta.group] : null;
  let displayUnit = meta ? getUnit(meta.group) : null;
  if (meta && !unitChoice(id, displayUnit)) displayUnit = group.defaultUnit; // stale/unknown pref

  const choice = meta ? unitChoice(id, displayUnit) : null;

  const spanToDisp = (v) => (meta ? roundForDisplay(id, displayUnit, engineSpanToDisplay(id, v, displayUnit)) : v);
  const toDisp = isSpan ? spanToDisp : (v) => (meta ? roundForDisplay(id, displayUnit, engineToDisplay(id, v, displayUnit)) : v);
  const toEng = isSpan
    ? (v) => (meta ? displaySpanToEngine(id, v, displayUnit) : v)
    : (v) => (meta ? displayToEngine(id, v, displayUnit) : v);

  const dMin = min !== undefined ? toDisp(min) : undefined;
  const dMax = max !== undefined ? toDisp(max) : undefined;
  const dStep = step !== undefined ? spanToDisp(step) : undefined;
  const dValue = optional && value == null ? '' : toDisp(value);

  const number = el('input', {
    type: 'number',
    class: slider ? 'val-input' : undefined,
    id: slider ? undefined : id,
    min: dMin, max: dMax, step: dStep, value: dValue
  });

  const range = slider
    ? el('input', { type: 'range', id, min: dMin, max: dMax, step: dStep, value: dValue })
    : null;

  // The unit suffix ("(ft/s)") is a plain sibling text node, not part of
  // the translated span — a language switch shouldn't need to know about
  // unit symbols, and re-translating the span must never clobber it.
  const labelSpan = i18nSpan('fields.' + id);
  const unitSuffix = choice ? document.createTextNode(` (${choice.label})`) : null;
  const labelChildren = [labelSpan, unitSuffix, ...(slider ? [number] : [])].filter(Boolean);

  const inputRow = before && !slider ? el('div', { class: 'preset-row' }, [before, number]) : number;

  // Live, per-field validation (red border + hint, only once actually
  // invalid — see field-validity.js) against this same min/max, in the
  // same display unit the field itself renders in. A blank box is only
  // ever a real violation for a non-`optional` field; an unparseable
  // intermediate string (typing "-" or "1.") reads the same as blank —
  // neither is "out of range" specifically, both are just "no usable
  // value yet."
  function computeMessage() {
    const raw = (slider ? range : number).value.trim();
    if (raw === '') return optional ? null : t('fields.errorRequired');
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return t('fields.errorRequired');
    const engineValue = toEng(parsed);
    if ((min !== undefined && engineValue < min) || (max !== undefined && engineValue > max)) {
      return t('fields.errorRange', { range: formatFieldRange(id, min, max, displayUnit) });
    }
    // A cross-field check on top of the plain min/max above (e.g.
    // trajectory-view.js's own rangeStep ≤ maxRange) — given the current
    // engine value so the caller doesn't have to re-parse it. Only ever
    // consulted once the plain range check above has already passed.
    return extraCheck ? extraCheck(engineValue) : null;
  }
  const validity = fieldValidity(number, computeMessage);

  const node = el('div', { class: 'field' }, [
    el('label', {}, labelChildren),
    ...(slider ? [range] : [inputRow]),
    validity.hintNode
  ]);

  // A blank box is only a legitimate, propagate-worthy state for an
  // `optional` field (see its own doc comment above) — for every other
  // field, and for anything that isn't a valid number at all (the
  // transient '' a <input type=number> reports mid-edit, e.g. while typing
  // "-" or "1."), the browser has not yet produced a usable value, so
  // onInput must not fire. Firing anyway is how a NaN used to make it out
  // of getEngineValue() and permanently corrupt anything downstream (e.g.
  // the chart zoom sliders) that isn't itself NaN-safe.
  const isValidRaw = (raw) => (raw === '' ? optional : !Number.isNaN(parseFloat(raw)));

  if (slider) {
    range.addEventListener('input', () => {
      number.value = range.value;
      // Dragging the slider doesn't fire a native 'input' event on
      // `number` (its .value was just assigned, not typed) — fieldValidity()
      // only listens on `number` itself, so this nudges it explicitly.
      validity.validate();
      if (onInput) onInput();
    });
    number.addEventListener('input', () => {
      if (!isValidRaw(number.value)) return;
      range.value = number.value;
      if (onInput) onInput();
    });
    number.addEventListener('change', () => {
      number.value = range.value; // snap back to the clamped slider value
    });
  } else if (onInput) {
    number.addEventListener('input', () => {
      if (!isValidRaw(number.value)) return;
      onInput();
    });
  }

  return {
    node,
    getEngineValue: () => {
      const raw = (slider ? range : number).value;
      if (optional && raw.trim() === '') return null;
      return toEng(parseFloat(raw));
    },
    // Programmatic write path (e.g. pre-filling from a library entry) —
    // separate from user typing, so it never fires onInput itself; the
    // caller decides when to recompute.
    setEngineValue(v) {
      const dv = optional && v == null ? '' : String(toDisp(v));
      number.value = dv;
      if (slider) range.value = dv;
    },
    setDisabled(disabled) {
      number.disabled = disabled;
      if (slider) range.disabled = disabled;
    },
    // Called by a form's own Save handler (see e.g. bullet-form.js) —
    // forces this field's validity dirty (so a never-touched violation
    // still surfaces) and reports whether it currently passes.
    validate: validity.validate
  };
}
