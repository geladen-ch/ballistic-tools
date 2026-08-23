import { el } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { locationPhotoField } from './location-photo-field.js';
import { findUserLocationByName } from '../../location-library.js';
import { t } from '../../i18n.js';
import { FIELD_BOUNDS } from '../../units.js';
import { fieldValidity } from '../field-validity.js';

const DEFAULT_VALUES = { name: '', altitudeM: null };

// Add/Edit form for a user's own location — name (required, no default),
// an optional altitude, and an optional photo (see location-photo-field.js
// — used as the backdrop for the photo-based target picker), same "dumb
// component, calls onSave(fields)" shape as bullet-form.js/rifle-form.js.
// `onPhotoChange`, when given, mirrors the photo field's own live value as
// the user picks/replaces/removes it — before Save — so a caller can
// preview its consequences (locations-view.js uses it for the "not
// placed" badges) without waiting for a commit.
export function locationForm({ initialValues = {}, excludeId, onPhotoChange, onSave, onCancel } = {}) {
  const values = { ...DEFAULT_VALUES, ...initialValues };

  const nameInput = el('input', { type: 'text', id: 'locationName', value: values.name });

  const duplicateWarning = el('p', { class: 'hint warning', i18n: 'rangeSolverLocations.duplicateNameWarning' });
  duplicateWarning.style.display = 'none';
  function refreshDuplicateWarning() {
    const match = findUserLocationByName(nameInput.value, { excludeId });
    duplicateWarning.style.display = match ? '' : 'none';
  }
  nameInput.addEventListener('input', refreshDuplicateWarning);
  const nameValidity = fieldValidity(nameInput, () => (nameInput.value.trim() ? null : t('rangeSolverLocations.errorNameRequired')));

  // Optional — a location with no known altitude simply never triggers
  // the "Set active" atmosphere default (see locations-view.js).
  const altitudeField = unitField({
    id: 'altitudeM', ...FIELD_BOUNDS.altitudeM, step: 50, value: values.altitudeM, optional: true
  });

  const photoField = locationPhotoField({ value: values.photo ?? null, onChange: onPhotoChange });

  const saveButton = el('button', { i18n: 'rangeSolverLocations.saveLocationButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.cancelButton' });

  // Every field's own live validation (red border + inline hint) is also
  // the Save gate — see bullet-form.js's own Save handler for the same
  // pattern.
  saveButton.addEventListener('click', () => {
    const checks = [
      { ok: nameValidity.validate(), node: nameInput },
      { ok: altitudeField.validate(), node: altitudeField.node }
    ];
    const firstInvalid = checks.find((c) => !c.ok);
    if (firstInvalid) {
      firstInvalid.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (onSave) onSave({ name: nameInput.value.trim(), altitudeM: altitudeField.getEngineValue(), photo: photoField.getValue() });
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  refreshDuplicateWarning();

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'rangeSolverLocations.locationName' }), nameInput]),
    nameValidity.hintNode,
    duplicateWarning,
    altitudeField.node,
    el('p', { class: 'hint', i18n: 'rangeSolverLocations.altitudeHint' }),
    photoField.node,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return { node };
}
