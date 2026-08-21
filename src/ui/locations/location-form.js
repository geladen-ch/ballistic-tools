import { el } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { locationPhotoField } from './location-photo-field.js';
import { findUserLocationByName } from '../../location-library.js';
import { t } from '../../i18n.js';

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

  // Optional — a location with no known altitude simply never triggers
  // the "Set active" atmosphere default (see locations-view.js).
  const altitudeField = unitField({
    id: 'altitudeM', min: 0, max: 3000, step: 50, value: values.altitudeM, optional: true
  });

  const photoField = locationPhotoField({ value: values.photo ?? null, onChange: onPhotoChange });

  const errorMessage = el('p', { class: 'hint warning' });
  errorMessage.style.display = 'none';

  const saveButton = el('button', { i18n: 'rangeSolverLocations.saveLocationButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.cancelButton' });

  saveButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      errorMessage.textContent = t('rangeSolverLocations.errorNameRequired');
      errorMessage.style.display = '';
      return;
    }
    errorMessage.style.display = 'none';
    if (onSave) onSave({ name, altitudeM: altitudeField.getEngineValue(), photo: photoField.getValue() });
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  refreshDuplicateWarning();

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'rangeSolverLocations.locationName' }), nameInput]),
    duplicateWarning,
    altitudeField.node,
    el('p', { class: 'hint', i18n: 'rangeSolverLocations.altitudeHint' }),
    photoField.node,
    errorMessage,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return { node };
}
