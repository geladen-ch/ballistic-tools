// The "rifle precision" input block shared by Hit Probability and the Truing
// Session: bench rifle precision (R50) and shooter skill (R50) with a shooting
// position, or -- behind a toggle -- one "simplified" combined-precision value
// (rifle, cartridge and shooter together, in the shooter's usual position),
// expressed in any of the supported conventions. The active cartridge's own
// Arsenal precision, when it has one, is offered as "This rig's" in whichever
// of the two forms it was recorded for.
//
// Persistence is the caller's (Hit Probability's cookie-backed panel state,
// the Truing Session's homework slice), the same way presetUnitField() takes it.
import { el } from '../dom.js';
import { i18nSpan } from '../i18n.js';
import { unitField } from './unit-field.js';
import {
  presetUnitField, RIG_PRESET_KEY,
  BENCH_PRECISION_PRESETS, DEFAULT_BENCH_PRECISION_PRESET_KEY,
  SHOOTER_SKILL_PRESETS, DEFAULT_SHOOTER_SKILL_PRESET_KEY
} from './precision-preset-field.js';
import { FIELD_BOUNDS } from '../units.js';
import { mradToRad } from '../quantity.js';

// Vertical/horizontal dispersion multipliers applied to shooter skill --
// no stated default, so "Prone, with bipod" (the neutral 1.0/1.0 case) is
// the starting point.
export const POSITIONS = [
  { key: 'fullySupported', v: 0.5, h: 0.5 },
  { key: 'proneBipod', v: 1.0, h: 1.0 },
  { key: 'proneOffhand', v: 1.4, h: 1.6 },
  { key: 'kneeling', v: 1.5, h: 2.4 },
  { key: 'standing', v: 2.1, h: 2.5 },
  { key: 'quickHalt', v: 2.3, h: 3.4 }
];
export const DEFAULT_POSITION_KEY = 'proneBipod';

export const PRECISION_CONVENTIONS = ['r50', 'r95', 'r99', 'es5', 'es10'];

// `getPersisted(key, default)` / `setPersisted(patch)`: the caller's persistence.
// `onInput`: called after every change that alters the resolved precision.
// `rigHints`: show the "this cartridge specifies its own precision" hints
// (a caller with its own rig-precision hint turns them off).
export function riflePrecisionInputs({ getPersisted, setPersisted, onInput, rigHints = true }) {
  const presetField = (id, presetList, defaultKey, max, step, fieldInput) => presetUnitField({
    id, presetList, defaultKey, labelPrefix: 'hitProbability.presetLabels.', max, step, onInput: fieldInput, getPersisted, setPersisted
  });

  // Whether the values on screen are still the active cartridge's own ("This
  // rig's"), as opposed to something picked or typed since. Recorded so a
  // later mount keeps tracking the Arsenal value only while it was the pick.
  const markRig = (picked) => setPersisted({ precisionFromRig: picked });
  const changed = () => { markRig(false); onInput(); };

  const toggle = el('input', { type: 'checkbox', id: 'simplifiedPrecisionEnabled' });
  toggle.checked = getPersisted('simplifiedPrecisionEnabled', false);
  const toggleRow = el('label', { class: 'checkbox-field' }, [toggle, i18nSpan('hitProbability.simplifiedToggleLabel')]);
  toggle.addEventListener('change', () => {
    setPersisted({ simplifiedPrecisionEnabled: toggle.checked });
    applyVisibility();
    changed();
  });

  // ---- Detailed: bench rifle + shooter skill + position ----
  // picking "This rig's" from the list is the cartridge's own value again, not a departure from it
  const benchField = presetField('benchPrecision', BENCH_PRECISION_PRESETS, DEFAULT_BENCH_PRECISION_PRESET_KEY, FIELD_BOUNDS.benchPrecision.max, mradToRad(0.01),
    () => { markRig(getPersisted('benchPrecisionPreset', null) === RIG_PRESET_KEY); onInput(); });
  const shooterField = presetField('shooterSkill', SHOOTER_SKILL_PRESETS, DEFAULT_SHOOTER_SKILL_PRESET_KEY, FIELD_BOUNDS.shooterSkill.max, mradToRad(0.01), () => onInput());
  const positionSelect = el('select', { id: 'position' }, POSITIONS.map((p) => el('option', { value: p.key, i18n: `hitProbability.presetLabels.${p.key}` })));
  positionSelect.value = getPersisted('position', DEFAULT_POSITION_KEY);
  positionSelect.addEventListener('change', () => { setPersisted({ position: positionSelect.value }); onInput(); });
  const benchRigHint = el('p', { class: 'hint', i18n: 'hitProbability.thisRigPrecisionHint' });
  benchRigHint.style.display = 'none';
  const detailedBlock = el('div', {}, [
    ...(rigHints ? [benchRigHint] : []),
    benchField.node,
    shooterField.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.position' }), positionSelect])
  ]);

  // ---- Simplified: one combined value ----
  let rigCombinedR50 = null; // the cartridge's own combined-precision value (R50, rad), null when it has none
  const rigCheckbox = el('input', { type: 'checkbox', id: 'combinedPrecisionThisRig' });
  const rigRow = el('label', { class: 'checkbox-field' }, [rigCheckbox, i18nSpan('hitProbability.thisRigCheckboxLabel')]);
  rigRow.style.display = 'none';
  const combinedRigHint = el('p', { class: 'hint', i18n: 'hitProbability.thisRigPrecisionHint' });
  combinedRigHint.style.display = 'none';

  const conventionSelect = el('select', { id: 'precisionConvention' },
    PRECISION_CONVENTIONS.map((c) => el('option', { value: c, i18n: `hitProbability.convention${c[0].toUpperCase()}${c.slice(1)}` })));
  conventionSelect.value = getPersisted('precisionConvention', 'r50');
  const combinedField = unitField({
    id: 'combinedPrecision', ...FIELD_BOUNDS.combinedPrecision, step: mradToRad(0.01), value: getPersisted('combinedPrecision', mradToRad(0.14)), before: conventionSelect,
    onInput: () => { setPersisted({ combinedPrecision: combinedField.getEngineValue() }); rigCheckbox.checked = false; changed(); }
  });
  conventionSelect.addEventListener('change', () => { setPersisted({ precisionConvention: conventionSelect.value }); rigCheckbox.checked = false; changed(); });

  function applyRigCombined() {
    conventionSelect.value = 'r50';
    combinedField.setEngineValue(rigCombinedR50);
    setPersisted({ precisionConvention: 'r50', combinedPrecision: rigCombinedR50 });
  }
  rigCheckbox.addEventListener('change', () => {
    if (!rigCheckbox.checked || rigCombinedR50 == null) return;
    applyRigCombined();
    markRig(true);
    onInput();
  });

  const simplifiedBlock = el('div', {}, [
    combinedField.node,
    rigRow,
    ...(rigHints ? [combinedRigHint] : []),
    el('p', { class: 'hint', i18n: 'hitProbability.simplifiedHint' })
  ]);

  function applyVisibility() {
    detailedBlock.style.display = toggle.checked ? 'none' : '';
    simplifiedBlock.style.display = toggle.checked ? '' : 'none';
  }
  applyVisibility();

  function setSimplified(on) {
    if (toggle.checked === on) return;
    toggle.checked = on;
    setPersisted({ simplifiedPrecisionEnabled: on });
    applyVisibility();
  }

  // Reflects the active cartridge's own `precision` ({ mode: 'own' | 'combined', r50Mrad }, or null) onto the
  // "This rig's" affordances: a preset option for bench precision, a checkbox for combined precision. With
  // `force`, also selects it -- the form it was recorded for (own: detailed, combined: simplified) -- which is
  // the "default to specified values" behaviour; without it the user's own current pick is left alone.
  // Does not call onInput; the caller recomputes once it has applied everything else.
  function setRigPrecision(precision, { force = true } = {}) {
    benchRigHint.style.display = precision ? '' : 'none';
    combinedRigHint.style.display = precision ? '' : 'none';
    if (precision && precision.mode === 'combined') {
      rigCombinedR50 = mradToRad(precision.r50Mrad); // Arsenal records hold mrad
      rigRow.style.display = '';
      benchField.setRigValue(null);
      if (force) {
        setSimplified(true);
        rigCheckbox.checked = true;
        applyRigCombined();
        markRig(true);
      }
    } else if (precision && precision.mode === 'own') {
      rigCombinedR50 = null;
      rigRow.style.display = 'none';
      rigCheckbox.checked = false;
      benchField.setRigValue(mradToRad(precision.r50Mrad), { autoSelect: force }); // Arsenal records hold mrad
      if (force) { setSimplified(false); markRig(true); }
    } else {
      rigCombinedR50 = null;
      rigRow.style.display = 'none';
      rigCheckbox.checked = false;
      benchField.setRigValue(null);
    }
  }

  // Whether the values last on screen were the cartridge's own -- or never chosen at all. Before that was recorded,
  // the bench-precision pick stood in for it.
  const rigStillWanted = () => {
    const recorded = getPersisted('precisionFromRig', undefined);
    if (recorded !== undefined) return recorded;
    const benchPick = getPersisted('benchPrecisionPreset', undefined);
    return !benchPick || benchPick === RIG_PRESET_KEY;
  };

  // Shaped like the `ownErrors` the hit-probability engine takes (everything but muzzleVelocitySD).
  function getValues() {
    const position = POSITIONS.find((p) => p.key === positionSelect.value);
    return {
      precisionMode: toggle.checked ? 'simplified' : 'detailed',
      detailed: { benchR50: benchField.getEngineValue(), shooterR50: shooterField.getEngineValue(), positionH: position.h, positionV: position.v },
      simplified: { value: combinedField.getEngineValue(), convention: conventionSelect.value }
    };
  }

  return {
    node: el('div', {}, [toggleRow, detailedBlock, simplifiedBlock]),
    setRigPrecision, rigStillWanted, getValues,
    // for callers that need to see the toggle and the sub-fields themselves
    toggle, benchField, shooterField, combinedField
  };
}
