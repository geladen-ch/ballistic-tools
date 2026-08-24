import { el, clear } from '../../dom.js';
import { loadCaliberDesignations, matchCaliberDesignation } from '../../bullets.js';
import { FIELD_BOUNDS, SMALL_LENGTH_PRECISION_DECIMALS, unitChoice, engineToDisplay, displayToEngine } from '../../units.js';
import { getUnit } from '../../prefs.js';
import { i18nSpan, t } from '../../i18n.js';
import { fieldValidity } from '../field-validity.js';

const PLACEHOLDER_VALUE = '';
const OTHER_VALUE = '__other__';

// Bullet caliber, entered as a live-linked pair: a picker of known
// designations (marketing names like "6.5mm" or "7.62 / .308 / .30" —
// see caliber-designations.json) and a plain number in the user's own
// smallLength preference (mm/cm/in), kept in sync in both directions
// rather than either one driving the other exclusively — a shooter might
// know the marketing name, the raw diameter, or both.
// Picking a designation writes its own exact caliberM into the number
// field; typing a number that lands within matchCaliberDesignation()'s
// own tolerance of a known bore diameter selects that designation in the
// picker, and anything else (present but unrecognized) selects "Other" —
// never silently left on a stale designation from before the edit.
// `value` is the initial caliber in meters (engine unit), or null/omitted
// for "nothing entered yet". `required: true` (bullet-form.js's own
// Arsenal caliber field) additionally fails validation on a blank value,
// reusing the exact same `arsenal.errorCaliberRequired` message that
// used to only ever show on Save click — callers that don't need caliber
// at all (bullet-section.js's manual/live entry) leave it false, where a
// blank value is never a violation, only an out-of-range one is.
// `highlightRequired: true` additionally marks the label with a visual
// "required" asterisk, proactively — not just on-violation the way the
// live-validation hint already is. Opt-in and independent of `required`
// itself (rather than always following it) so this doesn't silently
// change the look of every existing `required: true` caller the moment
// it's added — only src/views/bc-tools-view.js's own Multiple BC caliber
// field asks for it today.
export function caliberField({ value = null, onInput, required = false, highlightRequired = false } = {}) {
  let designations = [];

  // Display unit follows the user's smallLength preference (same group
  // sight height/drop/windage use), falling back to mm for a stale/unknown
  // pref — see unit-field.js's own identical fallback. `toDisplay`/
  // `toEngine` bridge meters (this field's own getCaliberM()/setCaliberM()
  // unit, and matchCaliberDesignation()'s) to/from that display unit.
  let displayUnit = getUnit('smallLength');
  if (!unitChoice('caliberM', displayUnit)) displayUnit = 'mm';
  const decimals = SMALL_LENGTH_PRECISION_DECIMALS[displayUnit];
  const unitLabel = unitChoice('caliberM', displayUnit).label;
  const toDisplay = (m) => engineToDisplay('caliberM', m, displayUnit);
  const toEngine = (d) => displayToEngine('caliberM', d, displayUnit);

  const select = el('select', { id: 'bulletCaliber' });
  const numberInput = el('input', {
    type: 'number', id: 'bulletCaliberMm', step: 1 / 10 ** decimals,
    min: toDisplay(FIELD_BOUNDS.caliberM.min).toFixed(decimals), max: toDisplay(FIELD_BOUNDS.caliberM.max).toFixed(decimals),
    value: value != null ? toDisplay(value).toFixed(decimals) : ''
  });

  function rebuildOptions() {
    const previousValue = select.value || PLACEHOLDER_VALUE;
    clear(select);
    select.appendChild(el('option', { value: PLACEHOLDER_VALUE, i18n: 'arsenal.bulletCaliberPlaceholder' }));
    // Ordered by actual bore diameter, same convention as every other
    // caliber list in this app (see bullet-section.js's own picker).
    for (const d of [...designations].sort((a, b) => a.caliberM - b.caliberM)) {
      select.appendChild(el('option', { value: d.designation, text: d.designation }));
    }
    select.appendChild(el('option', { value: OTHER_VALUE, i18n: 'arsenal.bulletCaliberOther' }));
    select.value = previousValue;
  }
  rebuildOptions(); // placeholder + "Other" show immediately; real designations join once the fetch below resolves

  // Reflects numberInput's current content onto select — called after
  // every edit to numberInput, and once more when the designation list
  // itself finishes loading (an initial `value` can't resolve to a real
  // designation before that).
  function syncSelectFromNumber() {
    const raw = numberInput.value.trim();
    if (raw === '') { select.value = PLACEHOLDER_VALUE; return; }
    const d = parseFloat(raw);
    if (Number.isNaN(d)) { select.value = PLACEHOLDER_VALUE; return; }
    const match = matchCaliberDesignation(toEngine(d), designations);
    select.value = match ? match.designation : OTHER_VALUE;
  }

  function computeMessage() {
    const raw = numberInput.value.trim();
    if (raw === '') return required ? t('arsenal.errorCaliberRequired') : null;
    const d = parseFloat(raw);
    if (Number.isNaN(d)) return required ? t('arsenal.errorCaliberRequired') : null;
    const { min, max } = FIELD_BOUNDS.caliberM;
    if (toEngine(d) < min || toEngine(d) > max) {
      return t('fields.errorRange', { range: `${toDisplay(min).toFixed(decimals)} – ${toDisplay(max).toFixed(decimals)} ${unitLabel}` });
    }
    return null;
  }
  const validity = fieldValidity(numberInput, computeMessage);

  numberInput.addEventListener('input', () => {
    syncSelectFromNumber();
    if (onInput) onInput();
  });

  select.addEventListener('change', () => {
    if (select.value === PLACEHOLDER_VALUE) {
      numberInput.value = '';
    } else if (select.value !== OTHER_VALUE) {
      // "Other" carries no caliberM of its own to adopt — numberInput is
      // left exactly as it was (that's usually what put "Other" here in
      // the first place: an unrecognized number already typed in).
      const entry = designations.find((d) => d.designation === select.value);
      if (entry) numberInput.value = toDisplay(entry.caliberM).toFixed(decimals);
    }
    // Picking from the select assigns numberInput.value programmatically
    // — fieldValidity() only reacts to the control's own input/change
    // events, so this nudges it explicitly.
    validity.validate();
    if (onInput) onInput();
  });

  loadCaliberDesignations().then((list) => {
    designations = list;
    rebuildOptions();
    syncSelectFromNumber();
  }).catch(() => {
    // caliber list unavailable (offline on first load) — the picker stays
    // at just the placeholder/"Other"; the number field still works fine.
  });

  const requiredMark = highlightRequired
    ? el('span', { class: 'field-required-mark', title: t('fields.requiredMark') }, [' *'])
    : null;
  const node = el('div', { class: 'field' }, [
    // .field label is itself a space-between flex row (other fields use
    // that to put a slider's live value on the opposite side) — the
    // label text and its own required-mark are wrapped in one shared
    // span so they stay adjacent instead of being pushed apart by it.
    el('label', {}, [el('span', {}, [i18nSpan('arsenal.bulletCaliber'), requiredMark].filter(Boolean))]),
    el('div', { class: 'caliber-dual-inputs' }, [select, numberInput, document.createTextNode(` ${unitLabel}`)]),
    validity.hintNode
  ]);

  function getCaliberM() {
    const raw = numberInput.value.trim();
    if (raw === '') return null;
    const d = parseFloat(raw);
    return Number.isNaN(d) ? null : toEngine(d);
  }

  function setCaliberM(caliberM) {
    numberInput.value = caliberM != null ? toDisplay(caliberM).toFixed(decimals) : '';
    syncSelectFromNumber();
  }

  function setDisabled(disabled) {
    select.disabled = disabled;
    numberInput.disabled = disabled;
  }

  return { node, getCaliberM, setCaliberM, setDisabled, validate: validity.validate };
}
