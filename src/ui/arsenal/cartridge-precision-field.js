import { el } from '../../dom.js';
import { CLICK_UNITS, convertAngularValue } from '../../units.js';
import { conventionValueToR50Mrad } from '../../engine/dispersion-sources.js';
import { computeCombinedStats, mmToAngularUnit } from '../../engine/rifle-precision-stats.js';
import { loadRiflePrecisionProjects } from '../../rifle-precision-library.js';
import { confidenceBadge } from '../rifle-precision/confidence-o-meter.js';
import { showDialog, hideDialog } from '../app-dialog.js';
import { i18nSpan, t } from '../../i18n.js';
import { fieldValidity } from '../field-validity.js';

const CONVENTIONS = ['r50', 'r95', 'r99', 'es5', 'es10'];
const DEFAULT_UNIT = 'mrad';
const DEFAULT_CONVENTION = 'r50';
const DEFAULT_VALUE = 0.14;
const DECIMALS = 3;

function round(value) {
  const factor = 10 ** DECIMALS;
  return Math.round(value * factor) / factor;
}

// Same eligibility bar rifle-precision-view.js's own
// combinedStatsIfEligible() uses (see there for why it's stricter than the
// "usable target" badge) — a project only makes it into this picker once
// its aggregate R50/confidence is actually computable, so every row here
// shows a real number, never a blank.
function eligibleProjectStats(project) {
  const stats = computeCombinedStats(project);
  return stats.status === 'ok' ? stats : null;
}

// The "Pick from a Rifle Precision project…" modal body — every eligible
// project, its own aggregate R50 (mrad and MOA, same as the project list's
// own line — see rifle-precision-view.js's formatR50Angular()) and
// confidence rating. A project always measures rifle-only/bench groups, so
// picking one always resolves to "own" mode, never "combined" — see
// onPick's caller below.
function riflePrecisionProjectPickerBody({ onPick }) {
  const entries = loadRiflePrecisionProjects()
    .map((project) => ({ project, stats: eligibleProjectStats(project) }))
    .filter((entry) => entry.stats);

  if (entries.length === 0) {
    return el('p', { class: 'hint', i18n: 'arsenal.noRiflePrecisionProjectsHint' });
  }

  const list = el('div', {});
  for (const { project, stats } of entries) {
    const r50Mrad = mmToAngularUnit(stats.r50, 'mrad', project.distanceM);
    const r50Moa = mmToAngularUnit(stats.r50, 'arcmin', project.distanceM);
    const row = el('div', { class: 'arsenal-row row-clickable' }, [
      el('div', { class: 'arsenal-row-info' }, [
        el('strong', { text: project.name }),
        el('span', { class: 'hint', text: ` — ${t('riflePrecision.r50Label')}: ${r50Mrad.toFixed(3)} mrad / ${r50Moa.toFixed(2)} MOA` }),
        el('div', {}, [i18nSpan('riflePrecision.confidenceLabel'), document.createTextNode(' '), confidenceBadge(stats.confidenceLower, stats.confidenceUpper)])
      ])
    ]);
    row.addEventListener('click', () => {
      hideDialog();
      onPick(r50Mrad);
    });
    list.appendChild(row);
  }
  return list;
}

// Optional per-cartridge rifle-precision input for the Arsenal cartridge
// form — feeds Hit Probability's own bench-precision ("own" mode) or
// combined-precision ("combined" mode) uncertainty source; see
// cartridge-form.js. Always stored as R50 mrad internally
// (conventionValueToR50Mrad()), regardless of which convention/unit the
// user finds easiest to measure/quote it in — a group fired and measured
// as, say, a 10-shot ES in MOA converts to the same underlying number a
// bench precision measured directly as R50 in mrad would. The mrad/MOA
// choice here is deliberately independent of the app-wide angle-dispersion
// preference (Settings) — the same "explicit unit, converts on toggle"
// idea scope-clicks-field.js already uses for scope turrets, since a
// rifle's own group size shouldn't silently reinterpret itself if the user
// later flips their global preference for something else.
export function cartridgePrecisionField({ onInput } = {}) {
  const checkbox = el('input', { type: 'checkbox', id: 'cartridgePrecisionEnabled' });
  const checkboxRow = el('label', { class: 'checkbox-field' }, [checkbox, i18nSpan('arsenal.cartridgePrecisionCheckboxLabel')]);

  const modeSelect = el('select', { id: 'cartridgePrecisionMode' }, [
    el('option', { value: 'own', i18n: 'arsenal.cartridgePrecisionModeOwn' }),
    el('option', { value: 'combined', i18n: 'arsenal.cartridgePrecisionModeCombined' })
  ]);

  const conventionSelect = el(
    'select', { id: 'cartridgePrecisionConvention' },
    CONVENTIONS.map((c) => el('option', { value: c, i18n: `hitProbability.convention${c[0].toUpperCase()}${c.slice(1)}` }))
  );
  const unitSelect = el('select', { id: 'cartridgePrecisionUnit' }, CLICK_UNITS.map((u) => el('option', { value: u.unit, text: u.label })));
  let currentUnit = DEFAULT_UNIT;

  const valueInput = el('input', { type: 'number', id: 'cartridgePrecisionValue', step: 0.01, value: DEFAULT_VALUE });

  function computeMessage() {
    if (!checkbox.checked) return null;
    const raw = valueInput.value.trim();
    if (raw === '') return t('fields.errorRequired');
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed) || parsed <= 0) return t('fields.errorRequired');
    return null;
  }
  const validity = fieldValidity(valueInput, computeMessage);

  // Switching the unit converts the typed number in place (so the
  // physical group size is preserved), same convention as
  // scope-clicks-field.js's own unit toggle — this field's whole point is
  // to be independent of the app-wide angle-dispersion preference, so it
  // has to do its own conversion rather than deferring to unitField.
  unitSelect.addEventListener('change', () => {
    const newUnit = unitSelect.value;
    const raw = parseFloat(valueInput.value);
    if (!Number.isNaN(raw)) valueInput.value = String(round(convertAngularValue(raw, currentUnit, newUnit)));
    currentUnit = newUnit;
    validity.validate();
    if (onInput) onInput();
  });

  const valueRow = el('div', { class: 'precision-value-row' }, [conventionSelect, unitSelect, valueInput]);

  // Always resolves to "own" mode (see riflePrecisionProjectPickerBody()'s
  // own class comment) and R50/mrad (this field's one storage form), so
  // it overwrites the mode/convention/unit selects too, not just the
  // value — same full-reset shape as setInitialValues() itself, which this
  // reuses directly.
  const pickProjectButton = el('button', { class: 'secondary', i18n: 'arsenal.pickRiflePrecisionProjectButton' });
  pickProjectButton.addEventListener('click', () => {
    showDialog({
      wide: true,
      bodyNode: riflePrecisionProjectPickerBody({
        onPick: (r50Mrad) => {
          setInitialValues({ mode: 'own', r50Mrad });
          if (onInput) onInput();
        }
      }),
      buttons: [{ label: t('arsenal.cancelButton') }]
    });
  });

  const details = el('div', { class: 'cartridge-precision-details' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.cartridgePrecisionModeLabel' }), modeSelect]),
    pickProjectButton,
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.cartridgePrecisionValueLabel' }), valueRow, validity.hintNode]),
    el('p', { class: 'hint', i18n: 'arsenal.cartridgePrecisionHint' })
  ]);
  details.style.display = 'none';

  checkbox.addEventListener('change', () => {
    details.style.display = checkbox.checked ? '' : 'none';
    validity.validate();
    if (onInput) onInput();
  });
  modeSelect.addEventListener('change', () => { if (onInput) onInput(); });
  conventionSelect.addEventListener('change', () => { if (onInput) onInput(); });
  valueInput.addEventListener('input', () => { if (onInput) onInput(); });

  const node = el('div', { class: 'field' }, [
    checkboxRow,
    details,
    el('p', { class: 'hint', i18n: 'arsenal.hitProbabilityOnlyHint' })
  ]);

  // { mode, r50Mrad } while enabled and holding a usable positive number,
  // null otherwise (checkbox unchecked, or a still-being-typed/invalid
  // value) — same "no NaN ever leaves this field" posture as
  // unit-field.js's own getEngineValue().
  function getValue() {
    if (!checkbox.checked) return null;
    const raw = parseFloat(valueInput.value);
    if (Number.isNaN(raw) || raw <= 0) return null;
    const valueMrad = convertAngularValue(raw, unitSelect.value, 'mrad');
    return { mode: modeSelect.value, r50Mrad: conventionValueToR50Mrad(valueMrad, conventionSelect.value) };
  }

  // Seeds the field from an existing cartridge's own stored precision
  // (already R50 mrad — see the class comment above) — always redisplayed
  // as R50/mrad regardless of whatever convention/unit it might originally
  // have been entered in, since only the resulting R50 mrad number is ever
  // persisted.
  function setInitialValues(precision) {
    const enabled = !!precision;
    checkbox.checked = enabled;
    details.style.display = enabled ? '' : 'none';
    if (enabled) {
      modeSelect.value = precision.mode;
      conventionSelect.value = DEFAULT_CONVENTION;
      unitSelect.value = DEFAULT_UNIT;
      currentUnit = DEFAULT_UNIT;
      valueInput.value = String(round(precision.r50Mrad));
    }
  }

  // Called by cartridge-form.js's own Save handler — the inner fields are
  // irrelevant (and hidden) while the checkbox itself is unchecked, same
  // convention as muzzle-velocity-temp-field.js's own validate().
  function validate() {
    if (!checkbox.checked) return true;
    return validity.validate();
  }

  return { node, getValue, setInitialValues, validate };
}
