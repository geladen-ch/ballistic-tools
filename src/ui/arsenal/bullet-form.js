import { el, clear } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { massDualField } from './mass-field.js';
import { caliberField } from './caliber-field.js';
import { findUserBulletByName } from '../../user-library.js';
import { parseCdTable, formatCdTable } from './cd-table-parse.js';
import { setDragModelSelectValue } from '../drag-model-select.js';
import { i18nSpan, t } from '../../i18n.js';

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
export function bulletForm({ initialValues = {}, excludeId, onSave, onCancel } = {}) {
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
  const manufacturerInput = el('input', { type: 'text', id: 'arsenalBulletManufacturer', value: values.manufacturer });

  const duplicateWarning = el('p', { class: 'hint warning', i18n: 'arsenal.duplicateNameWarning' });
  duplicateWarning.style.display = 'none';
  function refreshDuplicateWarning() {
    const match = findUserBulletByName(nameInput.value, { excludeId });
    duplicateWarning.style.display = match ? '' : 'none';
  }
  nameInput.addEventListener('input', refreshDuplicateWarning);

  // Picker + free-typed mm number, kept in sync in both directions — see
  // caliber-field.js. A bullet whose caliberM isn't within tolerance of
  // any known designation shows "Other" there rather than guessing.
  const caliber = caliberField({ value: values.caliberM });

  const lengthInput = el('input', {
    type: 'number', id: 'arsenalBulletLength', min: 0, step: 0.1,
    value: values.lengthM != null ? (values.lengthM * 1000).toFixed(2) : ''
  });

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

  const bcField = unitField({ id: 'bc', min: 0.1, max: 1.0, step: 0.001, value: values.bc });
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
  function refreshCdTableStatus() {
    if (cdTableInput.value.trim() === '') {
      cdTableStatus.className = 'hint';
      cdTableStatus.textContent = '';
      return;
    }
    const parsed = parseCdTable(cdTableInput.value);
    if (parsed.error) {
      cdTableStatus.className = 'hint warning';
      cdTableStatus.textContent = t(parsed.error.key, parsed.error.params);
    } else {
      cdTableStatus.className = 'hint';
      cdTableStatus.textContent = t('arsenal.cdTableParsedOk', { count: parsed.table.length });
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

  const errorMessage = el('p', { class: 'hint warning' });
  errorMessage.style.display = 'none';

  const saveButton = el('button', { i18n: 'arsenal.saveButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'arsenal.cancelButton' });

  function readValues(profileValue) {
    const lengthRaw = lengthInput.value.trim();
    return {
      name: nameInput.value.trim(),
      manufacturer: manufacturerInput.value.trim() || 'Custom',
      caliberM: caliber.getCaliberM(),
      ...(lengthRaw === '' ? {} : { lengthM: parseFloat(lengthRaw) / 1000 }),
      massKg: mass.getMassKg(),
      source: sourceInput.value.trim(),
      profile: profileValue
    };
  }

  saveButton.addEventListener('click', () => {
    let profileValue;
    if (profileTypeSelect.value === 'cdTable') {
      const parsed = parseCdTable(cdTableInput.value);
      if (parsed.error) {
        errorMessage.textContent = t(parsed.error.key, parsed.error.params);
        errorMessage.style.display = '';
        return;
      }
      profileValue = { type: 'cdTable', table: parsed.table };
    } else {
      profileValue = { type: 'bc', bc: bcField.getEngineValue(), model: dragModelSelect.value };
    }

    const data = readValues(profileValue);
    if (!data.name) {
      errorMessage.textContent = t('arsenal.errorNameRequired');
      errorMessage.style.display = '';
      return;
    }
    if (data.caliberM == null) {
      errorMessage.textContent = t('arsenal.errorCaliberRequired');
      errorMessage.style.display = '';
      return;
    }
    errorMessage.style.display = 'none';
    if (onSave) onSave(data);
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  refreshDuplicateWarning();
  refreshProfileTypeVisibility();
  refreshCdTableStatus();

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.bulletName' }), nameInput]),
    duplicateWarning,
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.bulletManufacturer' }), manufacturerInput]),
    caliber.node,
    el('div', { class: 'field' }, [
      el('label', {}, [i18nSpan('arsenal.bulletLength'), document.createTextNode(' (mm)')]),
      lengthInput
    ]),
    el('p', { class: 'hint', i18n: 'arsenal.bulletLengthHint' }),
    mass.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.bulletProfileType' }), profileTypeSelect]),
    bcFields,
    cdTableFields,
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.sourceLabel' }), sourceInput]),
    errorMessage,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return { node };
}
