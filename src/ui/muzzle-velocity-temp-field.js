import { el } from '../dom.js';
import { unitField } from './unit-field.js';
import { velocityPerTempSymbol, velocityPerTempToDisplay, velocityPerTempToEngine, FIELD_BOUNDS } from '../units.js';
import { getUnit } from '../prefs.js';
import { i18nSpan, t } from '../i18n.js';
import { fieldValidity } from './field-validity.js';

const DEFAULT_REFERENCE_TEMP_C = 15;
const DEFAULT_SENSITIVITY_M_S_PER_C = 1.0;
const SENSITIVITY_DECIMALS = 3;

function roundSensitivity(value) {
  const factor = 10 ** SENSITIVITY_DECIMALS;
  return Math.round(value * factor) / factor;
}

// Optional linear muzzle-velocity-vs-temperature correction, shared by
// every view that has a muzzleVelocity field. Collapsed behind a checkbox
// since most shots don't need it; when enabled it contributes
// { referenceTempC, velocityTempSensitivity } (both in engine units) to
// the state sent to the trajectory engine — see resolveMuzzleVelocity()
// in src/engine/trajectory.js for how those two are used.
export function muzzleVelocityTempField({ onInput } = {}) {
  const checkbox = el('input', { type: 'checkbox', id: 'muzzleVelocityTempEnabled' });
  const checkboxRow = el('label', { class: 'checkbox-field' }, [checkbox, i18nSpan('fields.muzzleVelocityTempEnabled')]);

  const referenceField = unitField({ id: 'referenceTempC', ...FIELD_BOUNDS.referenceTempC, value: DEFAULT_REFERENCE_TEMP_C, step: 1 });

  // velocityTempSensitivity is a rate (velocity per degree), not a plain
  // quantity — it doesn't fit FIELD_UNITS/unitField(), so it's built here
  // by hand, deriving its display unit from the velocity + temperature
  // preferences instead of having its own Settings entry.
  const velocityUnit = getUnit('velocity');
  const tempUnit = getUnit('temperature');
  const sensitivityLabel = i18nSpan('fields.velocityTempSensitivity');
  const sensitivitySuffix = document.createTextNode(` (${velocityPerTempSymbol(velocityUnit, tempUnit)})`);
  const sensitivityInput = el('input', {
    type: 'number', id: 'velocityTempSensitivity', step: 0.05,
    value: roundSensitivity(velocityPerTempToDisplay(DEFAULT_SENSITIVITY_M_S_PER_C, velocityUnit, tempUnit))
  });

  // Same FIELD_BOUNDS.velocityTempSensitivity (engine unit m/s per °C)
  // every other bound is checked against, re-expressed in whichever
  // velocity/temperature units are currently displayed — same conversion
  // getValues()/applyValues() below already use. Blank/unparseable stays
  // a non-violation (matches getValues()'s own tolerant "drop the
  // correction" behavior on bad input) — only a genuinely out-of-range
  // number is flagged.
  function computeSensitivityMessage() {
    const raw = sensitivityInput.value.trim();
    if (raw === '') return null;
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return null;
    const { min, max } = FIELD_BOUNDS.velocityTempSensitivity;
    const dMin = roundSensitivity(velocityPerTempToDisplay(min, getUnit('velocity'), getUnit('temperature')));
    const dMax = roundSensitivity(velocityPerTempToDisplay(max, getUnit('velocity'), getUnit('temperature')));
    const lo = Math.min(dMin, dMax), hi = Math.max(dMin, dMax);
    if (parsed < lo || parsed > hi) {
      return t('fields.errorRange', { range: `${lo} – ${hi} ${velocityPerTempSymbol(getUnit('velocity'), getUnit('temperature'))}` });
    }
    return null;
  }
  const sensitivityValidity = fieldValidity(sensitivityInput, computeSensitivityMessage);

  const details = el('div', { class: 'muzzle-velocity-temp-details' }, [
    referenceField.node,
    el('div', { class: 'field' }, [
      el('label', {}, [sensitivityLabel, sensitivitySuffix]),
      sensitivityInput,
      sensitivityValidity.hintNode
    ]),
    el('p', { class: 'hint', i18n: 'fields.muzzleVelocityTempHint' })
  ]);
  details.style.display = 'none';

  checkbox.addEventListener('change', () => {
    details.style.display = checkbox.checked ? '' : 'none';
    if (onInput) onInput();
  });
  sensitivityInput.addEventListener('input', () => { if (onInput) onInput(); });

  const node = el('div', { class: 'field' }, [checkboxRow, details]);

  function getValues() {
    if (!checkbox.checked) return {};
    const sensitivityValue = parseFloat(sensitivityInput.value);
    if (Number.isNaN(sensitivityValue)) return {};
    return {
      referenceTempC: referenceField.getEngineValue(),
      velocityTempSensitivity: velocityPerTempToEngine(sensitivityValue, getUnit('velocity'), getUnit('temperature'))
    };
  }

  // Shared by lock() and setInitialValues(): reflects tempData (or "no
  // temperature dependency" when null/undefined) onto the checkbox and
  // fields, without touching interactivity — that's the caller's call.
  function applyValues(tempData) {
    const enabled = !!tempData;
    checkbox.checked = enabled;
    details.style.display = enabled ? '' : 'none';
    if (enabled) {
      referenceField.setEngineValue(tempData.referenceTempC);
      sensitivityInput.value = roundSensitivity(
        velocityPerTempToDisplay(tempData.velocityTempSensitivity, getUnit('velocity'), getUnit('temperature'))
      );
    }
  }

  // Driven by a rifle library cartridge selection, not the user: forces
  // this field to reflect the cartridge's own temperature data (or "no
  // temperature dependency" when tempData is null) and locks it against
  // further editing until unlock() is called. Bypasses the checkbox's own
  // change handler (which would fire onInput itself) — the caller decides
  // when to recompute, same convention as unitField's setEngineValue.
  function lock(tempData) {
    applyValues(tempData);
    checkbox.disabled = true;
    referenceField.setDisabled(true);
    sensitivityInput.disabled = true;
  }

  // Returns control to the user: back to its default unchecked state,
  // matching what a freshly-mounted field looks like.
  function unlock() {
    checkbox.disabled = false;
    referenceField.setDisabled(false);
    sensitivityInput.disabled = false;
    checkbox.checked = false;
    details.style.display = 'none';
  }

  // Seeds the field from a previous session's values (e.g. shared shot
  // state from another view) without disabling anything — unlike lock(),
  // this is a starting point the user can still freely edit.
  function setInitialValues(tempData) {
    applyValues(tempData);
  }

  // Called by cartridge-form.js's own Save handler — the two inner
  // fields are irrelevant (and hidden) while the checkbox itself is
  // unchecked, so there's nothing to block on in that case.
  function validate() {
    if (!checkbox.checked) return true;
    const referenceOk = referenceField.validate();
    const sensitivityOk = sensitivityValidity.validate();
    return referenceOk && sensitivityOk;
  }

  return { node, getValues, lock, unlock, setInitialValues, validate };
}
