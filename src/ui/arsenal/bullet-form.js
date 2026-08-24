import { el, clear } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { massDualField } from './mass-field.js';
import { caliberField } from './caliber-field.js';
import { bulletLengthField } from './bullet-length-field.js';
import { manufacturerField } from './manufacturer-field.js';
import { findUserBulletByName } from '../../user-library.js';
import { parseCdTable, formatCdTable } from './cd-table-parse.js';
import { setDragModelSelectValue } from '../drag-model-select.js';
import { t } from '../../i18n.js';
import { FIELD_BOUNDS } from '../../units.js';
import { fieldValidity } from '../field-validity.js';

const DEFAULT_VALUES = { name: '', manufacturer: '', caliberM: null, lengthM: null, massKg: 0.01, bc: 0.45, dragModel: 'G1', cdTable: null, source: '' };

// Add/Edit form for a user's own bullet — a "dumb" component: it collects
// and validates input and calls onSave(bulletFields) with a plain object
// shaped like a built-in bullet record (minus `id`, which the caller
// assigns — see arsenal-view.js). Caliber is a select constrained to
// caliber-designations.json (per the request — no free-typed caliber),
// length is optional (only affects minor ballistic factors this app
// doesn't otherwise model), and mass is a live-linked gram/grain pair.
//
// Drag data comes from one of two sources, the user's choice: the classic
// BC + standard drag model, or a bullet-specific Cd-Mach table pasted in
// directly — the same shape a handful of built-in library bullets already
// carry (see e.g. src/bullets/ruag-338-swissp-ball-252.json), just typed
// in by hand instead of imported.
// `caliberLocked`, when true, disables the caliber field entirely (both
// the designation picker and the free-typed mm number) — used when this
// form is embedded inside cartridge-form.js's own "Add new bullet" flow
// and that parent form's own caliber filter is itself locked (a sibling
// cartridge on the same rifle already established the caliber; see
// cartridge-form.js's own `lockedCaliberM`), so a bullet created from
// there can't drift into a caliber the parent cartridge could never
// actually use.
export function bulletForm({ initialValues = {}, excludeId, caliberLocked = false, onSave, onCancel } = {}) {
  // initialValues is either a full stored record (drag data nested under
  // `.profile` — see user-library.js) or a flat prefill object (bc/
  // dragModel/cdTable already at the top level — see bullet-section.js's
  // getArsenalPrefill()). Flatten the stored-record shape down to the same
  // flat shape so both paths feed the fields identically — without this,
  // editing an existing bullet would silently fall back to DEFAULT_VALUES'
  // bc/dragModel instead of the bullet's own stored ones.
  const profile = initialValues.profile;
  const flattenedProfile = !profile ? {}
    : profile.type === 'cdTable' ? { cdTable: profile.table }
      : { bc: profile.bc, dragModel: profile.model };
  const values = { ...DEFAULT_VALUES, ...initialValues, ...flattenedProfile };

  const nameInput = el('input', { type: 'text', id: 'arsenalBulletName', value: values.name });
  const manufacturer = manufacturerField({ value: values.manufacturer });

  const duplicateWarning = el('p', { class: 'hint warning', i18n: 'arsenal.duplicateNameWarning' });
  duplicateWarning.style.display = 'none';
  function refreshDuplicateWarning() {
    const match = findUserBulletByName(nameInput.value, { excludeId });
    duplicateWarning.style.display = match ? '' : 'none';
  }
  nameInput.addEventListener('input', refreshDuplicateWarning);
  const nameValidity = fieldValidity(nameInput, () => (nameInput.value.trim() ? null : t('arsenal.errorNameRequired')));

  // Picker + free-typed mm number, kept in sync in both directions — see
  // caliber-field.js. A bullet whose caliberM isn't within tolerance of
  // any known designation shows "Other" there rather than guessing.
  // `required: true` — caliber-field.js's own live validation reuses the
  // exact same arsenal.errorCaliberRequired message this form's Save
  // handler used to show only after clicking Save.
  const caliber = caliberField({ value: values.caliberM, required: true });
  if (caliberLocked) caliber.setDisabled(true);

  // Own id kept as 'arsenalBulletLength' (bullet-length-field.js's
  // default is bullet-section.js's own id) so this form's DOM/tests are
  // unaffected by the shared component.
  const length = bulletLengthField({ value: values.lengthM, id: 'arsenalBulletLength' });

  const mass = massDualField({ value: values.massKg });

  // Drag data source: BC + standard model (the classic path) or a
  // bullet-specific Cd-Mach table — mutually exclusive, only one block
  // shown at a time, but neither is ever torn down (same convention as
  // bullet-section.js's own manualFields/infoBox toggle), so switching
  // back and forth never loses whatever was typed into the other one.
  const profileTypeSelect = el('select', { id: 'arsenalBulletProfileType' }, [
    el('option', { value: 'bc', i18n: 'arsenal.bulletProfileTypeBC' }),
    el('option', { value: 'cdTable', i18n: 'arsenal.bulletProfileTypeCdTable' })
  ]);
  profileTypeSelect.value = values.cdTable ? 'cdTable' : 'bc';

  const bcField = unitField({ id: 'bc', ...FIELD_BOUNDS.bc, step: 0.001, value: values.bc });
  const dragModelSelect = el('select', { id: 'arsenalBulletDragModel' });
  setDragModelSelectValue(dragModelSelect, values.dragModel);
  const bcFields = el('div', {}, [
    el('div', { class: 'field' }, [el('label', { i18n: 'common.dragModel' }), dragModelSelect]),
    bcField.node
  ]);

  // A <textarea> has no HTML "value" attribute (unlike <input>) — its
  // initial content has to be set as a real property assignment, not via
  // el()'s props (which would set a content attribute the element itself
  // ignores).
  const cdTableInput = el('textarea', { id: 'arsenalBulletCdTable', class: 'cd-table-input', rows: 8 });
  cdTableInput.value = values.cdTable ? formatCdTable(values.cdTable) : '';
  const cdTableStatus = el('p', { class: 'hint' });
  // Already lived here before the rest of this form's fields grew live
  // validation — this just adds the same red-border cue every other
  // field now has, on top of the specific parse error this status line
  // already shows (row-and-reason, more precise than the generic range
  // message every other field falls back to).
  function refreshCdTableStatus() {
    if (cdTableInput.value.trim() === '') {
      cdTableStatus.className = 'hint';
      cdTableStatus.textContent = '';
      cdTableInput.classList.remove('field-invalid');
      return;
    }
    const parsed = parseCdTable(cdTableInput.value);
    if (parsed.error) {
      cdTableStatus.className = 'hint warning';
      cdTableStatus.textContent = t(parsed.error.key, parsed.error.params);
      cdTableInput.classList.add('field-invalid');
    } else {
      cdTableStatus.className = 'hint';
      cdTableStatus.textContent = t('arsenal.cdTableParsedOk', { count: parsed.table.length });
      cdTableInput.classList.remove('field-invalid');
    }
  }
  cdTableInput.addEventListener('input', refreshCdTableStatus);
  const cdTableFields = el('div', {}, [
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.cdTableLabel' }), cdTableInput]),
    el('p', { class: 'hint cd-table-instructions', i18n: 'arsenal.cdTableInstructions' }),
    cdTableStatus
  ]);

  function refreshProfileTypeVisibility() {
    const isCdTable = profileTypeSelect.value === 'cdTable';
    bcFields.style.display = isCdTable ? 'none' : '';
    cdTableFields.style.display = isCdTable ? '' : 'none';
  }
  profileTypeSelect.addEventListener('change', refreshProfileTypeVisibility);

  const sourceInput = el('input', { type: 'text', id: 'arsenalBulletSource', value: values.source });

  const saveButton = el('button', { i18n: 'arsenal.saveBulletButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'arsenal.cancelButton' });

  function readValues(profileValue) {
    const lengthM = length.getLengthM();
    return {
      name: nameInput.value.trim(),
      manufacturer: manufacturer.getValue().trim() || 'Custom',
      caliberM: caliber.getCaliberM(),
      ...(lengthM == null ? {} : { lengthM }),
      massKg: mass.getMassKg(),
      source: sourceInput.value.trim(),
      profile: profileValue
    };
  }

  // Every field's own live validation (red border + inline hint, already
  // visible as the user types — see each field's own wiring above) is
  // also the Save gate: attemptSave() forces every field dirty via its
  // own validate(), and only proceeds once all of them pass. No separate
  // shared error banner anymore — whichever field is wrong already shows
  // exactly why right underneath it; Save just scrolls to the first one.
  //
  // Exposed as `trySave()` (see the return value below) in addition to
  // being wired to this form's own Save button — cartridge-form.js calls
  // it directly from its own Save handler when this form is embedded in
  // its "Add new bullet" flow, so submitting the cartridge form with a
  // new bullet still filled in creates that bullet too, in one click,
  // without the user having to press this form's own Save button first.
  function attemptSave() {
    const isCdTable = profileTypeSelect.value === 'cdTable';
    if (isCdTable) refreshCdTableStatus(); // reflects the border even if the textarea was never touched this session
    const cdTableOk = !isCdTable || !parseCdTable(cdTableInput.value).error;

    const checks = [
      { ok: nameValidity.validate(), node: nameInput },
      { ok: caliber.validate(), node: caliber.node },
      { ok: length.validate(), node: length.node },
      { ok: mass.validate(), node: mass.node },
      { ok: isCdTable || bcField.validate(), node: bcField.node },
      { ok: cdTableOk, node: cdTableInput }
    ];
    const firstInvalid = checks.find((c) => !c.ok);
    if (firstInvalid) {
      firstInvalid.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }

    const profileValue = isCdTable
      ? { type: 'cdTable', table: parseCdTable(cdTableInput.value).table }
      : { type: 'bc', bc: bcField.getEngineValue(), model: dragModelSelect.value };
    if (onSave) onSave(readValues(profileValue));
    return true;
  }
  saveButton.addEventListener('click', attemptSave);
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  refreshDuplicateWarning();
  refreshProfileTypeVisibility();
  refreshCdTableStatus();

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.bulletName' }), nameInput]),
    nameValidity.hintNode,
    duplicateWarning,
    manufacturer.node,
    caliber.node,
    length.node,
    el('p', { class: 'hint', i18n: 'arsenal.bulletLengthHint' }),
    mass.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.bulletProfileType' }), profileTypeSelect]),
    bcFields,
    cdTableFields,
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.sourceLabel' }), sourceInput]),
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return {
    node,
    trySave: attemptSave,
    // Both used by cartridge-form.js's own "Add new bullet" flow to keep
    // this embedded instance's caliber in step with the parent form's own
    // caliber filter — see that file's currentCaliberFilterM()/
    // refreshBulletFormVisibility().
    setCaliberM(caliberM) { caliber.setCaliberM(caliberM); caliber.validate(); },
    setCaliberLocked(locked) { caliber.setDisabled(locked); }
  };
}
