import { el } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { locationPhotoField } from './location-photo-field.js';
import { findUserLocationByName } from '../../location-library.js';
import { t } from '../../i18n.js';
import { FIELD_BOUNDS } from '../../units.js';
import { fieldValidity } from '../field-validity.js';
import { degToRad } from '../../quantity.js';
import { parseLatLon } from '../../weather/coordinates.js';

const DEFAULT_VALUES = { name: '', altitudeM: null, latitudeRad: null, longitudeRad: null };
// A step of the latitude/longitude spinners: about eleven metres.
const COORDINATE_STEP_RAD = degToRad(0.0001);

// Add/Edit form for a user's own location — name (required, no default),
// an optional altitude, an optional position (latitude and longitude, both or
// neither: the online weather services need it), and an optional photo (see location-photo-field.js
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
    id: 'altitudeM', ...FIELD_BOUNDS.altitudeM, step: 50, value: values.altitudeM, optional: true,
    onInput: () => refreshCoordinateWarnings()
  });

  // Optional position. Pasting "47.37, 8.54" into either box fills both (a number input would refuse the text).
  const latitudeField = unitField({
    id: 'latitudeRad', ...FIELD_BOUNDS.latitudeRad, step: COORDINATE_STEP_RAD, value: values.latitudeRad, optional: true,
    onInput: refreshCoordinateWarnings
  });
  const longitudeField = unitField({
    id: 'longitudeRad', ...FIELD_BOUNDS.longitudeRad, step: COORDINATE_STEP_RAD, value: values.longitudeRad, optional: true,
    onInput: refreshCoordinateWarnings
  });
  for (const field of [latitudeField, longitudeField]) {
    field.input.addEventListener('paste', (event) => {
      const text = event.clipboardData && event.clipboardData.getData('text');
      const position = text && Number.isNaN(Number(text.trim())) ? parseLatLon(text) : null;
      if (!position) return; // an ordinary number: let the box take it
      event.preventDefault();
      latitudeField.setEngineValue(position.latRad);
      longitudeField.setEngineValue(position.lonRad);
      refreshCoordinateWarnings();
    });
  }
  const coordinateWarning = el('p', { class: 'hint warning' });
  coordinateWarning.style.display = 'none';
  const altitudeAdvice = el('p', { class: 'hint', i18n: 'rangeSolverLocations.coordinatesNeedAltitude' });
  altitudeAdvice.style.display = 'none';

  // Two rules no single field can check: both or neither, and (0, 0) is a placeholder, not a place.
  function coordinateProblem() {
    const lat = latitudeField.getEngineValue(), lon = longitudeField.getEngineValue();
    if ((lat == null) !== (lon == null)) return 'rangeSolverLocations.errorCoordinatesPair';
    if (lat === 0 && lon === 0) return 'rangeSolverLocations.errorCoordinatesZero';
    return null;
  }
  function refreshCoordinateWarnings() {
    const problem = coordinateProblem();
    coordinateWarning.textContent = problem ? t(problem) : '';
    coordinateWarning.style.display = problem ? '' : 'none';
    const hasPosition = latitudeField.getEngineValue() != null && longitudeField.getEngineValue() != null;
    altitudeAdvice.style.display = hasPosition && altitudeField.getEngineValue() == null ? '' : 'none';
  }

  const photoField = locationPhotoField({ value: values.photo ?? null, onChange: onPhotoChange });

  const saveButton = el('button', { i18n: 'rangeSolverLocations.saveLocationButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.cancelButton' });

  // Every field's own live validation (red border + inline hint) is also
  // the Save gate — see bullet-form.js's own Save handler for the same
  // pattern.
  saveButton.addEventListener('click', () => {
    const checks = [
      { ok: nameValidity.validate(), node: nameInput },
      { ok: altitudeField.validate(), node: altitudeField.node },
      { ok: latitudeField.validate(), node: latitudeField.node },
      { ok: longitudeField.validate(), node: longitudeField.node }
    ];
    // Checked after the fields' own ranges, so a bad number is reported at the box itself first.
    if (checks.every((c) => c.ok) && coordinateProblem()) {
      refreshCoordinateWarnings();
      checks.push({ ok: false, node: coordinateWarning });
    }
    const firstInvalid = checks.find((c) => !c.ok);
    if (firstInvalid) {
      firstInvalid.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (onSave) {
      onSave({
        name: nameInput.value.trim(), altitudeM: altitudeField.getEngineValue(),
        latitudeRad: latitudeField.getEngineValue(), longitudeRad: longitudeField.getEngineValue(),
        photo: photoField.getValue()
      });
    }
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  refreshDuplicateWarning();
  refreshCoordinateWarnings();

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'rangeSolverLocations.locationName' }), nameInput]),
    nameValidity.hintNode,
    duplicateWarning,
    altitudeField.node,
    el('p', { class: 'hint', i18n: 'rangeSolverLocations.altitudeHint' }),
    latitudeField.node,
    longitudeField.node,
    el('p', { class: 'hint', i18n: 'rangeSolverLocations.coordinatesHint' }),
    coordinateWarning,
    altitudeAdvice,
    photoField.node,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return { node };
}
