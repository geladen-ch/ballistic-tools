import { el } from '../../dom.js';
import { FIELD_BOUNDS, SMALL_LENGTH_PRECISION_DECIMALS, unitChoice } from '../../units.js';
import { getUnit } from '../../prefs.js';
import { converter, mmToM } from '../../quantity.js';
import { i18nSpan, t } from '../../i18n.js';
import { fieldValidity } from '../field-validity.js';

// A bullet's overall length, in the user's own smallLength preference
// (mm/cm/in) — optional (only affects minor ballistic factors this app
// doesn't otherwise model: Miller's-formula stability and spin drift), so
// a blank box is never a violation, only a present-but-out-of-range one
// is. Shared by bullet-form.js (Arsenal's own Add/Edit bullet) and
// bullet-section.js (the "manual/Other bullet" fallback every other
// view's own bullet picker falls back to) — both used to hand-roll this
// independently, always in mm regardless of the user's own preference;
// modeled on caliber-field.js's own fix for the identical problem on the
// sibling caliber field, including its tighter SMALL_LENGTH_PRECISION_DECIMALS
// (a bullet length needs finer resolution than UNIT_GROUPS.smallLength's
// own display decimals, tuned for coarser things like sight height).
// `id` defaults to bullet-section.js's own long-standing input id;
// bullet-form.js passes its own 'arsenalBulletLength' to keep its id
// (and the tests that reference it) unchanged.
export function bulletLengthField({ value = null, id = 'bulletLength', onInput } = {}) {
  let displayUnit = getUnit('smallLength');
  if (!unitChoice('bulletLength', displayUnit)) displayUnit = 'mm';
  const decimals = SMALL_LENGTH_PRECISION_DECIMALS[displayUnit];
  const unitLabel = unitChoice('bulletLength', displayUnit).label;
  // The record holds the length in metres; FIELD_BOUNDS.bulletLength is in mm.
  const toDisplay = converter('m', displayUnit);
  const toMetres = converter(displayUnit, 'm');
  const minM = mmToM(FIELD_BOUNDS.bulletLength.min);
  const maxM = mmToM(FIELD_BOUNDS.bulletLength.max);
  // The value as last set, so an untouched field returns it exactly rather
  // than the metres of its rounded display.
  let setM = value;
  const shown = (m) => (m != null ? toDisplay(m).toFixed(decimals) : '');

  const input = el('input', {
    type: 'number', id,
    min: toDisplay(minM).toFixed(decimals),
    max: toDisplay(maxM).toFixed(decimals),
    step: 1 / 10 ** decimals,
    value: shown(value)
  });

  function computeMessage() {
    const raw = input.value.trim();
    if (raw === '') return null;
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return null;
    const m = toMetres(parsed);
    if (m < minM || m > maxM) {
      return t('fields.errorRange', { range: `${toDisplay(minM).toFixed(decimals)} – ${toDisplay(maxM).toFixed(decimals)} ${unitLabel}` });
    }
    return null;
  }
  const validity = fieldValidity(input, computeMessage);
  input.addEventListener('input', () => { if (onInput) onInput(); });

  const node = el('div', { class: 'field' }, [
    el('label', {}, [i18nSpan('arsenal.bulletLength'), document.createTextNode(` (${unitLabel})`)]),
    input,
    validity.hintNode
  ]);

  function getLengthM() {
    const raw = input.value.trim();
    if (raw === '') return null;
    if (setM != null && raw === shown(setM)) return setM;
    const parsed = parseFloat(raw);
    return Number.isNaN(parsed) ? null : toMetres(parsed);
  }

  function setLengthM(lengthM) {
    setM = lengthM;
    input.value = shown(lengthM);
  }

  return { node, getLengthM, setLengthM, validate: validity.validate };
}
