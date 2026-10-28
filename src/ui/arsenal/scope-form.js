import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { CLICK_UNITS, FIELD_BOUNDS, clickValueInUnit, convertAngularValue, CLICK_VALUE_DECIMALS } from '../../units.js';
import { converter, fieldOfViewAngle, fieldOfViewWidth } from '../../quantity.js';
import { toDisplayUnit, fromDisplayUnit, quantityLabel, displayChoice } from '../../display-units.js';
import { SCOPE_TYPES } from '../../reticle/scope.js';
import {
  defaultScopeRecord, validateScopeRecord, actualMagnificationMin, opticLabel, isVariableScope, DEFAULT_CLICK_RAD
} from '../../scope-record.js';
import { findUserScopeByName } from '../../user-library.js';
import { reticleThumbnail } from '../reticle-thumbnail.js';
import { opticsManufacturerInput } from './optics-manufacturer-field.js';
import { fieldValidity } from '../field-validity.js';

const ZOOM_DECIMALS = 2;
const THUMBNAIL_SIZE = 44;

// validateScopeRecord()'s error codes → messages.
const MESSAGE_KEYS = {
  required: 'fields.errorRequired',
  positive: 'reticleDesigner.errors.positive',
  magnificationOrder: 'arsenal.scopeErrorMagnificationOrder',
  fovMinBelowMax: 'reticleDesigner.errors.fovMinBelowMax',
  calibrationInRange: 'reticleDesigner.errors.calibrationInRange',
  scopeType: 'reticleDesigner.errors.scopeType'
};

const formatNumber = (v, decimals) => String(Number(v.toFixed(decimals)) + 0);

// Add/Edit form for one of the user's own scopes (scope-record.js): its
// manufacturer and model, type, nominal magnification, field of view (the
// widths seen at a distance, in the user's distance unit, held as angles),
// for an SFP the zoom its subtensions are true at, the turret's click unit
// and click values, and the reticles it comes with. The actual lowest
// magnification the field of view implies is shown as it is typed.
//
// `reticleChoices()` returns { arsenal, builtIn }: the reticles that can
// be picked (records as reticle-library.js / reticles.js give them); call
// the returned refreshReticles() when that list changes (the built-in one
// arrives asynchronously). `onSave(values)` gets the record's fields — no
// id, which the caller assigns.
export function scopeForm({ initialValues = {}, excludeId, reticleChoices, onSave, onCancel } = {}) {
  const values = { ...defaultScopeRecord(), ...initialValues };
  const fieldNodes = [];

  // ---- inputs ----
  function textInput(id, value) {
    return el('input', { type: 'text', id, value: value || '' });
  }
  function numberInput(id, shown) {
    return el('input', { type: 'number', id, step: 'any', value: shown });
  }
  // A number exactly as stored when its input still shows what it was
  // filled with — so saving a scope untouched never rounds its values.
  function keptOr(input, shown, original, parse) {
    return input.value === shown ? original : parse(input.value);
  }
  const parseNumber = (raw) => (raw.trim() === '' ? NaN : Number(raw));

  // Suggests scope and reticle makers, never bullet ones.
  const manufacturer = opticsManufacturerInput({
    id: 'arsenalScopeManufacturer', value: values.manufacturer,
    onPick: () => {
      refreshDuplicateWarning();
      manufacturerValidity.validate();
    }
  });
  const manufacturerInput = manufacturer.input;
  const modelInput = textInput('arsenalScopeModel', values.model);
  const duplicateWarning = el('p', { class: 'hint warning', i18n: 'arsenal.duplicateNameWarning' });
  duplicateWarning.style.display = 'none';
  function refreshDuplicateWarning() {
    const label = opticLabel({ manufacturer: manufacturerInput.value, model: modelInput.value });
    duplicateWarning.style.display = label && findUserScopeByName(label, { excludeId }) ? '' : 'none';
  }

  const typeSelect = el('select', { id: 'arsenalScopeType' },
    SCOPE_TYPES.map((type) => el('option', { value: type, text: t(`reticleDesigner.scope.types.${type}`) })));
  typeSelect.value = values.type;

  const zoomShown = (v) => (v > 0 ? formatNumber(v, ZOOM_DECIMALS) : '');
  const magMinShown = zoomShown(values.magnificationMin);
  const magMaxShown = zoomShown(values.magnificationMax);
  const calibrationShown = zoomShown(values.calibrationZoom);
  const magMinInput = numberInput('arsenalScopeMagnificationMin', magMinShown);
  const magMaxInput = numberInput('arsenalScopeMagnificationMax', magMaxShown);
  const calibrationInput = numberInput('arsenalScopeCalibrationZoom', calibrationShown);

  // Field of view: widths at a distance, in the distance unit, one decimal
  // finer than that unit's usual display.
  const distanceDecimals = displayChoice('distance').decimals + 1;
  const lengthShown = (m) => (m > 0 && Number.isFinite(m) ? formatNumber(toDisplayUnit('distance', m), distanceDecimals) : '');
  const widthShown = (rad) => (rad > 0 ? lengthShown(fieldOfViewWidth(rad, values.fovDistanceM)) : '');
  const fovMaxShown = widthShown(values.fovMaxRad);
  const fovMinShown = widthShown(values.fovMinRad);
  const distanceShown = lengthShown(values.fovDistanceM);
  const fovMaxInput = numberInput('arsenalScopeFovMax', fovMaxShown);
  const fovMinInput = numberInput('arsenalScopeFovMin', fovMinShown);
  const fovDistanceInput = numberInput('arsenalScopeFovDistance', distanceShown);

  // Clicks, typed in the turret's own unit — see rifle-form.js.
  const clickUnitSelect = el('select', { id: 'arsenalScopeClickUnit' }, CLICK_UNITS.map((u) => el('option', { value: u.unit, text: u.label })));
  clickUnitSelect.value = values.clickUnit;
  let shownUnit = values.clickUnit;
  const clickShown = (rad) => (rad > 0 ? String(clickValueInUnit(rad, values.clickUnit)) : '');
  const clickHShown = clickShown(values.clickHorizontalRad);
  const clickVShown = clickShown(values.clickVerticalRad);
  const clickHInput = numberInput('arsenalScopeClickHorizontal', clickHShown);
  const clickVInput = numberInput('arsenalScopeClickVertical', clickVShown);
  clickHInput.step = '0.01';
  clickVInput.step = '0.01';
  // A click still at the old unit's usual size takes the new unit's; any
  // other is converted, keeping its physical size.
  clickUnitSelect.addEventListener('change', () => {
    const next = clickUnitSelect.value;
    const usual = (unit) => clickValueInUnit(DEFAULT_CLICK_RAD[unit], unit);
    for (const input of [clickHInput, clickVInput]) {
      const raw = parseNumber(input.value);
      if (Number.isNaN(raw)) continue;
      const value = raw === usual(shownUnit) ? usual(next) : convertAngularValue(raw, shownUnit, next);
      input.value = String(Number(value.toFixed(CLICK_VALUE_DECIMALS)));
    }
    shownUnit = next;
    clickHValidity.validate();
    clickVValidity.validate();
  });
  function readClickRad(input, shown, original) {
    if (clickUnitSelect.value === values.clickUnit && input.value === shown) return original;
    const raw = parseNumber(input.value);
    return Number.isNaN(raw) ? NaN : converter(clickUnitSelect.value, 'rad')(raw);
  }

  // ---- reticles ----
  const chosenReticleIds = [...values.reticleIds];
  const reticleList = el('div', { class: 'scope-reticle-choices' });
  const reticleTypeHint = el('p', { class: 'hint', i18n: 'arsenal.scopeReticleTypeHint' });
  reticleTypeHint.style.display = 'none';
  let reticlesById = new Map();

  function reticleRow(reticle) {
    const checkbox = el('input', { type: 'checkbox', id: `arsenalScopeReticle-${reticle.id}` });
    checkbox.checked = chosenReticleIds.includes(reticle.id);
    checkbox.disabled = Boolean(reticle.damaged);
    checkbox.addEventListener('change', () => {
      const at = chosenReticleIds.indexOf(reticle.id);
      if (checkbox.checked && at === -1) chosenReticleIds.push(reticle.id);
      if (!checkbox.checked && at !== -1) chosenReticleIds.splice(at, 1);
      refreshReticleTypeHint();
    });
    return el('label', { class: 'checkbox-field scope-reticle-choice' }, [
      checkbox,
      reticleThumbnail(reticle, { size: THUMBNAIL_SIZE, label: reticle.name }),
      el('span', { text: reticle.name })
    ]);
  }

  function refreshReticles() {
    clear(reticleList);
    const { arsenal = [], builtIn = [] } = reticleChoices ? reticleChoices() : {};
    reticlesById = new Map([...arsenal, ...builtIn].map((r) => [r.id, r]));
    const groups = [['arsenal.scopeReticlesYours', arsenal], ['arsenal.scopeReticlesBuiltIn', builtIn]];
    for (const [headingKey, list] of groups) {
      if (list.length === 0) continue;
      reticleList.appendChild(el('div', { class: 'hint scope-reticle-group', i18n: headingKey }));
      for (const reticle of list) reticleList.appendChild(reticleRow(reticle));
    }
    if (reticlesById.size === 0) reticleList.appendChild(el('p', { class: 'hint', i18n: 'arsenal.scopeNoReticleChoices' }));
    refreshReticleTypeHint();
  }

  // A reticle drawn for another kind of scope (fixed, FFP, SFP) can still
  // be chosen — the scope's own parameters apply — but it is pointed out.
  function refreshReticleTypeHint() {
    const mismatch = chosenReticleIds.some((id) => {
      const reticle = reticlesById.get(id);
      return reticle && !reticle.damaged && reticle.referenceScope.type !== typeSelect.value;
    });
    reticleTypeHint.style.display = mismatch ? '' : 'none';
  }

  // ---- reading and checking ----
  function readValues() {
    const type = typeSelect.value;
    const variable = isVariableScope({ type });
    const distanceUnchanged = fovDistanceInput.value === distanceShown;
    const distanceM = keptOr(fovDistanceInput, distanceShown, values.fovDistanceM, (raw) => fromDisplayUnit('distance', parseNumber(raw)));
    const angle = (input, shown, original) => {
      if (distanceUnchanged && input.value === shown) return original;
      const widthM = fromDisplayUnit('distance', parseNumber(input.value));
      return widthM > 0 && distanceM > 0 ? fieldOfViewAngle(widthM, distanceM) : NaN;
    };
    const magnificationMin = keptOr(magMinInput, magMinShown, values.magnificationMin, parseNumber);
    return {
      manufacturer: manufacturerInput.value.trim(),
      model: modelInput.value.trim(),
      reticleIds: [...chosenReticleIds],
      type,
      magnificationMin,
      magnificationMax: variable ? keptOr(magMaxInput, magMaxShown, values.magnificationMax, parseNumber) : magnificationMin,
      fovMaxRad: angle(fovMaxInput, fovMaxShown, values.fovMaxRad),
      fovMinRad: variable ? angle(fovMinInput, fovMinShown, values.fovMinRad) : null,
      fovDistanceM: distanceM,
      calibrationZoom: type === 'sfp' ? keptOr(calibrationInput, calibrationShown, values.calibrationZoom, parseNumber) : null,
      clickUnit: clickUnitSelect.value,
      clickHorizontalRad: readClickRad(clickHInput, clickHShown, values.clickHorizontalRad),
      clickVerticalRad: readClickRad(clickVInput, clickVShown, values.clickVerticalRad)
    };
  }

  function messageFor(key) {
    return () => {
      const code = validateScopeRecord(readValues())[key];
      return code ? t(MESSAGE_KEYS[code] || MESSAGE_KEYS.required) : null;
    };
  }
  // Clicks: also within the usual bounds, in the turret's unit.
  function clickMessage(input, key) {
    return () => {
      const raw = parseNumber(input.value);
      if (Number.isNaN(raw)) return t('fields.errorRequired');
      const { min, max } = FIELD_BOUNDS.scopeClick;
      if (raw < min || raw > max) return t('fields.errorRange', { range: `${min} – ${max}` });
      return messageFor(key)();
    };
  }

  const manufacturerValidity = fieldValidity(manufacturerInput, messageFor('manufacturer'));
  const modelValidity = fieldValidity(modelInput, messageFor('model'));
  const magMinValidity = fieldValidity(magMinInput, messageFor('magnificationMin'));
  const magMaxValidity = fieldValidity(magMaxInput, messageFor('magnificationMax'));
  const fovMaxValidity = fieldValidity(fovMaxInput, messageFor('fovMaxRad'));
  const fovMinValidity = fieldValidity(fovMinInput, messageFor('fovMinRad'));
  const fovDistanceValidity = fieldValidity(fovDistanceInput, messageFor('fovDistanceM'));
  const calibrationValidity = fieldValidity(calibrationInput, messageFor('calibrationZoom'));
  const clickHValidity = fieldValidity(clickHInput, clickMessage(clickHInput, 'clickHorizontalRad'));
  const clickVValidity = fieldValidity(clickVInput, clickMessage(clickVInput, 'clickVerticalRad'));

  // ---- layout ----
  // `control`: what is shown for `input`, when not the input alone.
  function field(labelKey, input, validity, { unit, control = input } = {}) {
    const label = el('label', { for: input.id, i18n: labelKey });
    const node = el('div', { class: 'field' }, [label, unit ? el('span', { class: 'field-input-with-unit' }, [input, el('span', { class: 'hint', text: unit })]) : control]);
    const wrap = el('div', {}, [node, validity ? validity.hintNode : null]);
    fieldNodes.push({ wrap, input, validity });
    return { wrap, label };
  }
  // Created in form order: Save scrolls to the first invalid one.
  const manufacturerField = field('arsenal.scopeManufacturer', manufacturerInput, manufacturerValidity, { control: manufacturer.wrap });
  const modelField = field('arsenal.scopeModel', modelInput, modelValidity);
  const distanceUnit = quantityLabel('distance');
  const magMinField = field('arsenal.scopeMagnificationFrom', magMinInput, magMinValidity, { unit: '×' });
  const magMaxField = field('arsenal.scopeMagnificationTo', magMaxInput, magMaxValidity, { unit: '×' });
  const fovMaxField = field('arsenal.scopeFovWidest', fovMaxInput, fovMaxValidity, { unit: distanceUnit });
  const fovMinField = field('arsenal.scopeFovNarrowest', fovMinInput, fovMinValidity, { unit: distanceUnit });
  const fovDistanceField = field('arsenal.scopeFovDistance', fovDistanceInput, fovDistanceValidity, { unit: distanceUnit });
  const calibrationField = field('arsenal.scopeCalibrationZoom', calibrationInput, calibrationValidity, { unit: '×' });
  const actualLowZoom = el('p', { class: 'hint scope-actual-low-zoom' });
  const fovHint = el('p', { class: 'hint', i18n: 'arsenal.scopeFovHint' });

  // What the type shows: one magnification and one field for a fixed
  // scope, both ends for a variable one, the calibration zoom for an SFP.
  function refreshType() {
    const type = typeSelect.value;
    const variable = isVariableScope({ type });
    magMinField.label.textContent = t(variable ? 'arsenal.scopeMagnificationFrom' : 'arsenal.scopeMagnification');
    fovMaxField.label.textContent = t(variable ? 'arsenal.scopeFovWidest' : 'arsenal.scopeFov');
    for (const node of [magMaxField.wrap, fovMinField.wrap, fovHint]) node.style.display = variable ? '' : 'none';
    calibrationField.wrap.style.display = type === 'sfp' ? '' : 'none';
    refreshActualLowZoom();
    refreshReticleTypeHint();
  }

  function refreshActualLowZoom() {
    const scope = readValues();
    const zoom = isVariableScope(scope) ? actualMagnificationMin(scope) : NaN;
    const show = zoom > 0 && Number.isFinite(zoom);
    actualLowZoom.style.display = show ? '' : 'none';
    actualLowZoom.textContent = show ? t('arsenal.scopeActualLowZoom', { zoom: formatNumber(zoom, ZOOM_DECIMALS) }) : '';
  }

  typeSelect.addEventListener('change', refreshType);
  for (const input of [magMaxInput, fovMaxInput, fovMinInput, fovDistanceInput]) input.addEventListener('input', refreshActualLowZoom);
  for (const input of [manufacturerInput, modelInput]) input.addEventListener('input', refreshDuplicateWarning);

  const saveButton = el('button', { i18n: 'arsenal.saveScopeButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'arsenal.cancelButton' });
  saveButton.addEventListener('click', () => {
    const hidden = (entry) => entry.wrap.style.display === 'none';
    const firstInvalid = fieldNodes.find((entry) => !hidden(entry) && entry.validity && !entry.validity.validate());
    if (firstInvalid) {
      firstInvalid.input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (onSave) onSave(readValues());
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const clickHField = field('fields.scopeClickHorizontal', clickHInput, clickHValidity);
  const clickVField = field('fields.scopeClickVertical', clickVInput, clickVValidity);

  const node = el('div', { class: 'input-section nested' }, [
    manufacturerField.wrap,
    modelField.wrap,
    duplicateWarning,
    el('div', { class: 'field' }, [el('label', { for: typeSelect.id, i18n: 'arsenal.scopeType' }), typeSelect]),
    magMinField.wrap,
    magMaxField.wrap,
    fovMaxField.wrap,
    fovMinField.wrap,
    fovDistanceField.wrap,
    fovHint,
    actualLowZoom,
    calibrationField.wrap,
    el('div', { class: 'field' }, [el('label', { for: clickUnitSelect.id, i18n: 'fields.scopeClickUnit' }), clickUnitSelect]),
    clickHField.wrap,
    clickVField.wrap,
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.scopeReticles' })]),
    reticleList,
    el('p', { class: 'hint', i18n: 'arsenal.scopeReticlesHint' }),
    reticleTypeHint,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  refreshReticles();
  refreshType();
  refreshDuplicateWarning();

  return { node, refreshReticles };
}
