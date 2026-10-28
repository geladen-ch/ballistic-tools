import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { SCOPE_TYPES, validateReferenceScope } from '../../reticle/scope.js';
import { opticLabel } from '../../scope-record.js';
import { findUserReticleByName } from '../../reticle-library.js';
import { reticleThumbnail } from '../reticle-thumbnail.js';
import { opticsManufacturerInput } from './optics-manufacturer-field.js';

const ZOOM_DECIMALS = 2;
const formatZoom = (v) => (v > 0 ? String(Number(v.toFixed(ZOOM_DECIMALS)) + 0) : '');
const parseNumber = (raw) => (raw.trim() === '' ? NaN : Number(raw));

// What a reticle file of 4.3.x lacks to become an Arsenal reticle, asked
// for in a modal (app-dialog.js) when such a file is loaded: its
// manufacturer and model (the model prefilled with the file's reticle
// name), and its reference scope — type and magnification, prefilled from
// the file's scope (whose zoom range was worked out from its fields of
// view, so it rarely is the round figure the scope is sold as). Also
// whether a scope should be made from the file's optics next (on by
// default).
//
// `doc` is file-codec.js's parseReticle() result. Returns { node,
// validate(), read() }: validate() shows what's wrong and says whether
// it's all right; read() gives { manufacturer, model, referenceScope,
// createScope }.
export function legacyReticleForm({ doc, fileName = '' }) {
  const ref = doc.referenceScope;
  function textField(id, labelKey, input) {
    const message = el('p', { class: 'hint warning' });
    message.style.display = 'none';
    return { node: el('div', { class: 'field' }, [el('label', { for: id, i18n: labelKey }), input]), message, input };
  }

  const manufacturer = opticsManufacturerInput({ id: 'legacyReticleManufacturer' });
  const manufacturerMessage = el('p', { class: 'hint warning' });
  manufacturerMessage.style.display = 'none';
  const modelInput = el('input', { type: 'text', id: 'legacyReticleModel', value: doc.name || fileName.replace(/\.reticle\.json$|\.json$/i, '') });
  const modelField = textField('legacyReticleModel', 'arsenal.scopeModel', modelInput);

  const typeSelect = el('select', { id: 'legacyReticleType' },
    SCOPE_TYPES.map((type) => el('option', { value: type, text: t(`reticleDesigner.scope.types.${type}`) })));
  typeSelect.value = ref.type;

  const zoomInput = (id, value) => el('input', { type: 'number', id, step: 'any', value: formatZoom(value) });
  const zoomMinInput = zoomInput('legacyReticleZoomMin', ref.zoomMin);
  const zoomMaxInput = zoomInput('legacyReticleZoomMax', ref.zoomMax);
  const calibrationInput = zoomInput('legacyReticleCalibrationZoom', ref.calibrationZoom);
  const zoomMinLabel = el('label', { for: zoomMinInput.id });
  const zoomMaxRow = el('div', { class: 'field' }, [el('label', { for: zoomMaxInput.id, i18n: 'arsenal.scopeMagnificationTo' }), zoomMaxInput]);
  const calibrationRow = el('div', { class: 'field' }, [el('label', { for: calibrationInput.id, i18n: 'arsenal.scopeCalibrationZoom' }), calibrationInput]);
  const zoomMessage = el('p', { class: 'hint warning' });
  zoomMessage.style.display = 'none';

  function refreshType() {
    const type = typeSelect.value;
    zoomMinLabel.textContent = t(type === 'fixed' ? 'arsenal.scopeMagnification' : 'arsenal.scopeMagnificationFrom');
    zoomMaxRow.style.display = type === 'fixed' ? 'none' : '';
    calibrationRow.style.display = type === 'sfp' ? '' : 'none';
  }
  typeSelect.addEventListener('change', refreshType);

  const createScope = el('input', { type: 'checkbox', id: 'legacyReticleCreateScope' });
  createScope.checked = true;

  function readReferenceScope() {
    const type = typeSelect.value;
    const zoomMin = parseNumber(zoomMinInput.value);
    const zoomMax = type === 'fixed' ? zoomMin : parseNumber(zoomMaxInput.value);
    return { type, zoomMin, zoomMax, calibrationZoom: type === 'sfp' ? parseNumber(calibrationInput.value) : zoomMax };
  }

  function read() {
    return {
      manufacturer: manufacturer.input.value.trim(),
      model: modelInput.value.trim(),
      referenceScope: readReferenceScope(),
      createScope: createScope.checked
    };
  }

  function show(message, key, params) {
    message.textContent = key ? t(key, params) : '';
    message.style.display = key ? '' : 'none';
    return !key;
  }

  function validate() {
    const values = read();
    let ok = show(manufacturerMessage, values.manufacturer ? null : 'fields.errorRequired');
    ok = show(modelField.message, values.model ? null : 'fields.errorRequired') && ok;
    const name = opticLabel(values);
    if (values.manufacturer && values.model && findUserReticleByName(name)) {
      ok = show(modelField.message, 'arsenal.legacyNameTaken', { name }) && ok;
    }
    const errors = Object.values(validateReferenceScope(values.referenceScope));
    ok = show(zoomMessage, errors.length ? `reticleDesigner.errors.${errors[0]}` : null) && ok;
    return ok;
  }

  refreshType();

  const node = el('div', { class: 'legacy-reticle-form' }, [
    el('h3', { i18n: 'arsenal.legacyTitle' }),
    el('p', { class: 'hint', i18n: 'arsenal.legacyIntro' }),
    el('div', { class: 'legacy-reticle-preview' }, [reticleThumbnail(doc, { size: 120, label: doc.name })]),
    el('div', { class: 'field' }, [el('label', { for: manufacturer.input.id, i18n: 'arsenal.scopeManufacturer' }), manufacturer.wrap]),
    manufacturerMessage,
    modelField.node,
    modelField.message,
    el('div', { class: 'field' }, [el('label', { for: typeSelect.id, i18n: 'arsenal.legacyReferenceType' }), typeSelect]),
    el('div', { class: 'field' }, [zoomMinLabel, zoomMinInput]),
    zoomMaxRow,
    calibrationRow,
    zoomMessage,
    el('p', { class: 'hint', i18n: 'arsenal.legacyReferenceHint' }),
    el('label', { class: 'checkbox-field' }, [createScope, el('span', { i18n: 'arsenal.legacyCreateScope' })])
  ]);

  return { node, validate, read };
}
