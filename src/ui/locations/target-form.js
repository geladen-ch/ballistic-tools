import { el } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { setPendingPlacement } from '../../location-placement-nav.js';
import { FIELD_BOUNDS } from '../../units.js';

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
// `siblingNames` (see locations-view.js) is every *other* target's name
// already at this location — for the live duplicate-name warning below,
// same non-blocking tier as bullet-form.js's/rifle-form.js's own.
export function targetForm({ initialValues = {}, locationId = null, locationPhoto = null, siblingNames = [], onSave, onCancel } = {}) {
  const values = { ...DEFAULT_VALUES, ...initialValues };

  const nameInput = el('input', { type: 'text', id: 'targetName', value: values.name || '' });
  const duplicateWarning = el('p', { class: 'hint warning', i18n: 'rangeSolverLocations.duplicateTargetNameWarning' });
  duplicateWarning.style.display = 'none';
  function refreshDuplicateWarning() {
    const raw = nameInput.value.trim();
    const match = raw !== '' && siblingNames.some((n) => n.trim().toLowerCase() === raw.toLowerCase());
    duplicateWarning.style.display = match ? '' : 'none';
  }
  nameInput.addEventListener('input', refreshDuplicateWarning);

  const notesInput = el('textarea', { id: 'targetNotes', rows: 3 });
  notesInput.value = values.notes || '';

  const rangeField = unitField({ id: 'targetRange', ...FIELD_BOUNDS.targetRange, step: 10, value: values.rangeM });
  const losAngleField = unitField({ id: 'losAngle', ...FIELD_BOUNDS.losAngle, step: 1, value: values.losAngleDeg });

  const placeItButton = (locationPhoto && values.id) ? el('button', { type: 'button', class: 'secondary', i18n: 'rangeSolverLocations.placeItButton' }) : null;
  if (placeItButton) {
    placeItButton.addEventListener('click', () => {
      setPendingPlacement({ locationId, targetId: values.id, returnPath: '/locations', selectMode: false });
      location.hash = '#/locations/place';
    });
  }

  const saveButton = el('button', { i18n: 'rangeSolverLocations.saveTargetButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'rangeSolverLocations.cancelButton' });

  // Every field's own live validation (red border + inline hint — range
  // required/in-bounds is now enforced the same way every other field's
  // is, via FIELD_BOUNDS.targetRange, replacing the old bespoke `rangeM
  // <= 0` check and its own errorRangeRequired message) is also the Save
  // gate — see bullet-form.js's own Save handler for the same pattern.
  saveButton.addEventListener('click', () => {
    const checks = [
      { ok: rangeField.validate(), node: rangeField.node },
      { ok: losAngleField.validate(), node: losAngleField.node }
    ];
    const firstInvalid = checks.find((c) => !c.ok);
    if (firstInvalid) {
      firstInvalid.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (onSave) {
      onSave({
        name: nameInput.value.trim() || null,
        notes: notesInput.value.trim() || null,
        rangeM: rangeField.getEngineValue(),
        losAngleDeg: losAngleField.getEngineValue(),
        coords: values.coords ?? null
      });
    }
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  refreshDuplicateWarning();

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'rangeSolverLocations.targetName' }), nameInput]),
    el('p', { class: 'hint', i18n: 'rangeSolverLocations.targetNameHint' }),
    duplicateWarning,
    el('div', { class: 'field' }, [el('label', { i18n: 'rangeSolverLocations.targetNotes' }), notesInput]),
    rangeField.node,
    losAngleField.node,
    placeItButton,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return { node };
}
