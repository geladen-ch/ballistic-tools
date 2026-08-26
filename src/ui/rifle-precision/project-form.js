import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { unitField } from '../unit-field.js';
import { caliberField } from '../arsenal/caliber-field.js';
import { FIELD_BOUNDS } from '../../units.js';
import { fieldValidity } from '../field-validity.js';
import { findRiflePrecisionProjectByName } from '../../rifle-precision-library.js';

const DEFAULT_VALUES = { name: '', distanceM: 100, caliberMm: 7.62 };

// Add/Edit form for a rifle-precision project — name (required), distance
// to target and rifle caliber (both required, always stored in engine
// units and converted for display/edit through the app's usual global
// unit preference), same "dumb component, calls onSave(fields)" shape as
// location-form.js/bullet-form.js. distanceM reuses unitField() with the
// existing `targetRange` FIELD_UNITS id (same physical quantity — the
// distance to the target these groups were shot at — so its bounds/
// conversion/label ("Range") all already fit) rather than adding a new
// units.js entry for a second field measuring the same thing.
export function projectForm({ initialValues = {}, excludeId, onSave, onCancel } = {}) {
  const values = { ...DEFAULT_VALUES, ...initialValues };

  const nameInput = el('input', { type: 'text', id: 'riflePrecisionProjectName', value: values.name });
  const nameValidity = fieldValidity(nameInput, () => (nameInput.value.trim() ? null : t('riflePrecision.errorNameRequired')));

  const duplicateWarning = el('p', { class: 'hint warning', i18n: 'riflePrecision.duplicateNameWarning' });
  duplicateWarning.style.display = 'none';
  function refreshDuplicateWarning() {
    const match = findRiflePrecisionProjectByName(nameInput.value, { excludeId });
    duplicateWarning.style.display = match ? '' : 'none';
  }
  nameInput.addEventListener('input', refreshDuplicateWarning);

  const distanceField = unitField({ id: 'targetRange', ...FIELD_BOUNDS.targetRange, step: 10, value: values.distanceM });
  // caliberField() is the app's standard caliber input (designation
  // dropdown + linked manual-entry number, src/ui/arsenal/caliber-field.js)
  // — its own value/getCaliberM() are meters, this project's own
  // caliberMm is millimetres, so convert at both boundaries here.
  const caliber = caliberField({ value: values.caliberMm != null ? values.caliberMm / 1000 : null, required: true });

  const saveButton = el('button', { i18n: 'riflePrecision.saveProjectButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'riflePrecision.cancelButton' });

  // Every field's own live validation is also the Save gate — same
  // pattern as location-form.js's/bullet-form.js's own Save handlers.
  saveButton.addEventListener('click', () => {
    const checks = [
      { ok: nameValidity.validate(), node: nameInput },
      { ok: distanceField.validate(), node: distanceField.node },
      { ok: caliber.validate(), node: caliber.node }
    ];
    const firstInvalid = checks.find((c) => !c.ok);
    if (firstInvalid) {
      firstInvalid.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (onSave) {
      const caliberM = caliber.getCaliberM();
      onSave({
        name: nameInput.value.trim(),
        distanceM: distanceField.getEngineValue(),
        caliberMm: caliberM != null ? caliberM * 1000 : null
      });
    }
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  refreshDuplicateWarning();

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'riflePrecision.projectNameLabel' }), nameInput]),
    nameValidity.hintNode,
    duplicateWarning,
    distanceField.node,
    caliber.node,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return { node };
}
