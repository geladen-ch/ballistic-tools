import { el } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { setPendingPlacement } from '../../location-placement-nav.js';
import { t } from '../../i18n.js';

const DEFAULT_VALUES = { name: '', notes: '', rangeM: 400, losAngleDeg: 0 };

// Add/Edit form for one target within a location — name and notes are
// both optional free text, range/LoS angle are the same two fields Range
// Solver's own Target tab already offers, just in plain unitField form
// here (this is a management-section form, not the arm's-length outdoor
// Target tab, so no need for largeStepperField's big touch buttons).
// `locationId`/`locationPhoto` are the parent location's id and photo (or
// null) — only when there's a photo AND this is an already-saved target
// (`initialValues.id` set — a brand-new one has nowhere to attach a pin
// to yet, same restriction a rifle's cartridges have against an unsaved
// rifle) does this form offer a "Place it" button, which hands off to
// location-placement-view.js's full-screen placement route rather than
// editing `coords` in place — that view commits the pin directly via
// saveUserLocation() on its own Done, independently of this form's own
// Save button, so `coords` is never part of this form's onSave payload.
export function targetForm({ initialValues = {}, locationId = null, locationPhoto = null, onSave, onCancel } = {}) {
  const values = { ...DEFAULT_VALUES, ...initialValues };

  const nameInput = el('input', { type: 'text', id: 'targetName', value: values.name || '' });
  const notesInput = el('textarea', { id: 'targetNotes', rows: 3 });
  notesInput.value = values.notes || '';

  const rangeField = unitField({ id: 'targetRange', min: 10, max: 3000, step: 10, value: values.rangeM });
  const losAngleField = unitField({ id: 'losAngle', min: -90, max: 90, step: 1, value: values.losAngleDeg });

  const placeItButton = (locationPhoto && values.id) ? el('button', { type: 'button', class: 'secondary', i18n: 'rangeSolverLocations.placeItButton' }) : null;
  if (placeItButton) {
    placeItButton.addEventListener('click', () => {
      setPendingPlacement({ locationId, targetId: values.id, returnPath: '/locations', selectMode: false });
      location.hash = '#/locations/place';
    });
  }

  const errorMessage = el('p', { class: 'hint warning' });
  errorMessage.style.display = 'none';

  const saveButton = el('button', { i18n: 'rangeSolverLocations.saveTargetButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.cancelButton' });

  saveButton.addEventListener('click', () => {
    const rangeM = rangeField.getEngineValue();
    if (!Number.isFinite(rangeM) || rangeM <= 0) {
      errorMessage.textContent = t('rangeSolverLocations.errorRangeRequired');
      errorMessage.style.display = '';
      return;
    }
    errorMessage.style.display = 'none';
    if (onSave) {
      onSave({
        name: nameInput.value.trim() || null,
        notes: notesInput.value.trim() || null,
        rangeM,
        losAngleDeg: losAngleField.getEngineValue(),
        coords: values.coords ?? null
      });
    }
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'rangeSolverLocations.targetName' }), nameInput]),
    el('p', { class: 'hint', i18n: 'rangeSolverLocations.targetNameHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'rangeSolverLocations.targetNotes' }), notesInput]),
    rangeField.node,
    losAngleField.node,
    placeItButton,
    errorMessage,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return { node };
}
