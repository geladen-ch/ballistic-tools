// A large, borderless numeric field for values read at a glance — same
// typography and interaction convention as wind-control.js's own speed
// input (this app's established "big number, no stepper, red underline on
// violation" look), pulled out as its own reusable piece so it can sit in
// a plain row instead of only inside that control's dial. Range Solver's
// Target tab pairs two of these on one line (distance, LoS angle) — see
// range-solver-view.js and layout.css's own .target-params-row.
//
// Unlike unit-field.js/large-stepper-field.js, this never shows a visible
// label or a violation message: `adornment` (a unit string or an icon
// node) is the field's only visual identifier, sitting trailing inside
// the input's own row. Validation is silent — a red underline while the
// typed value is out of range or unparseable, exactly wind-control.js's
// own speedInput behavior — and on blur an out-of-range number is forced
// to the nearest bound; an unparseable/empty box has no "nearest" value to
// snap to, so it reverts to whichever value was last committed (typed-
// and-blurred, or set programmatically via setEngineValue), same fallback
// large-stepper-field.js's own bump() and wind-control.js's own blur
// handler already use for a blank/NaN box.
import { el } from '../dom.js';
import { FIELD_UNITS, UNIT_GROUPS, unitChoice, engineToDisplay, displayToEngine } from '../units.js';
import { getUnit } from '../prefs.js';

export function inlineNumberField({ id, min, max, decimals, value, adornment, ariaLabel, onInput }) {
  const meta = FIELD_UNITS[id];
  const group = meta ? UNIT_GROUPS[meta.group] : null;
  let displayUnit = meta ? getUnit(meta.group) : null;
  if (meta && !unitChoice(id, displayUnit)) displayUnit = group.defaultUnit; // stale/unknown pref
  const choice = meta ? unitChoice(id, displayUnit) : null;

  // No forced rounding for a field with neither an explicit `decimals`
  // nor a unit choice of its own (Target's own losAngle: plain pass-
  // through degrees, no FIELD_UNITS entry) — matches unit-field.js's own
  // behavior for that same field before this component existed.
  function round(v) {
    if (decimals === undefined && !choice) return v;
    const d = decimals !== undefined ? decimals : choice.decimals;
    const factor = 10 ** d;
    return Math.round(v * factor) / factor;
  }

  const toDisp = (v) => round(meta ? engineToDisplay(id, v, displayUnit) : v);
  const toEng = (v) => (meta ? displayToEngine(id, v, displayUnit) : v);
  const dMin = min !== undefined ? toDisp(min) : undefined;
  const dMax = max !== undefined ? toDisp(max) : undefined;

  function clampDisp(v) {
    if (dMin !== undefined) v = Math.max(dMin, v);
    if (dMax !== undefined) v = Math.min(dMax, v);
    return v;
  }

  // The value blur reverts to on an unparseable/empty box — kept current
  // by every successful blur commit and every setEngineValue() call.
  let committed = toDisp(value);

  const input = el('input', {
    id, class: 'inline-number-input', type: 'text', inputmode: 'decimal',
    value: String(committed), 'aria-label': ariaLabel
  });

  function isValid(v) {
    return !Number.isNaN(v) && (dMin === undefined || v >= dMin) && (dMax === undefined || v <= dMax);
  }

  const row = el('div', { class: 'inline-number-row' }, [
    input,
    adornment ? el('div', { class: 'inline-number-adornment' }, [adornment]) : null
  ]);

  // .field-invalid toggles on the row, not the input — the input itself
  // is `all: unset` (no border to color), so the row's own bordered box
  // is what actually turns red, same base.css rule (.field-invalid {
  // border-color: var(--danger) !important; }) every other field's own
  // control uses.
  //
  // Select-all-on-focus so typing overwrites the shown value by default,
  // rather than editing in place.
  input.addEventListener('focus', () => input.select());
  input.addEventListener('input', () => {
    row.classList.toggle('field-invalid', !isValid(parseFloat(input.value)));
    if (onInput) onInput();
  });
  input.addEventListener('blur', () => {
    const v = parseFloat(input.value);
    committed = Number.isNaN(v) ? committed : clampDisp(round(v));
    input.value = String(committed);
    row.classList.remove('field-invalid');
    // The correction above can change what getEngineValue() now reports —
    // fire onInput again so the rest of the view picks up the corrected
    // value instead of staying stuck on the pre-correction one (same
    // reasoning as wind-control.js's own speedInput blur handler).
    if (onInput) onInput();
  });
  input.addEventListener('keydown', (evt) => { if (evt.key === 'Enter') input.blur(); });

  const node = el('div', { class: 'field inline-number-field' }, [row]);

  return {
    node,
    getEngineValue: () => toEng(parseFloat(input.value)),
    // Programmatic write path (e.g. copying in a saved target's values) —
    // never fires onInput itself; the caller decides when to recompute.
    // Also becomes the new blur-revert target, same as a user-typed commit.
    setEngineValue(v) {
      committed = toDisp(v);
      input.value = String(committed);
    }
  };
}
