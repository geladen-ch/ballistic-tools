import { el } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { CLICK_UNITS } from '../../units.js';
import { findUserRifleByName } from '../../user-library.js';
import { t } from '../../i18n.js';

const DEFAULT_VALUES = {
  name: '', defaultSightHeightM: 0.045, defaultZeroRangeM: 100, defaultRiflingTwistM: null, defaultTwistDirection: 'right',
  defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1, source: ''
};

// Add/Edit form for a user's own rifle — name, sight height, zero range,
// rifling twist (rate + direction), and click settings, exactly the
// fields a built-in rifle carries (minus `cartridges`, managed separately
// as its own nested Add/Edit/Delete list in arsenal-view.js, and minus
// `id`, which the caller assigns). Twist rate is optional (only affects
// minor ballistic factors this app doesn't otherwise model), same spirit
// as the bullet form's own optional length field; twist direction always
// has a value (defaulting to "right") since a <select> has no blank state.
export function rifleForm({ initialValues = {}, excludeId, onSave, onCancel } = {}) {
  const values = { ...DEFAULT_VALUES, ...initialValues };

  const nameInput = el('input', { type: 'text', id: 'arsenalRifleName', value: values.name });

  const duplicateWarning = el('p', { class: 'hint warning', i18n: 'arsenal.duplicateNameWarning' });
  duplicateWarning.style.display = 'none';
  function refreshDuplicateWarning() {
    const match = findUserRifleByName(nameInput.value, { excludeId });
    duplicateWarning.style.display = match ? '' : 'none';
  }
  nameInput.addEventListener('input', refreshDuplicateWarning);

  const sightHeightField = unitField({ id: 'sightHeight', min: 0, max: 100, step: 1, value: values.defaultSightHeightM * 1000 });
  const zeroRangeField = unitField({ id: 'zeroRange', min: 0, max: 500, step: 5, value: values.defaultZeroRangeM });
  const twistField = unitField({
    id: 'riflingTwist', min: 0, max: 1000, step: 1, optional: true,
    value: values.defaultRiflingTwistM != null ? values.defaultRiflingTwistM * 1000 : null
  });
  // A plain enum, not a unit-bearing quantity — "Right" first since it's
  // by far the more common real-world direction and this field's own
  // default. Older/built-in rifle records predating this field have no
  // opinion either way, so they're treated the same as an explicit
  // "right" (see readValues()/rifle-section.js's applySelectedRifle()).
  const twistDirectionSelect = el('select', { id: 'twistDirection' }, [
    el('option', { value: 'right', i18n: 'fields.twistDirectionRight' }),
    el('option', { value: 'left', i18n: 'fields.twistDirectionLeft' })
  ]);
  twistDirectionSelect.value = values.defaultTwistDirection;

  const clickUnitSelect = el('select', { id: 'arsenalRifleClickUnit' }, CLICK_UNITS.map((u) => el('option', { value: u.unit, text: u.label })));
  clickUnitSelect.value = values.defaultClickUnit;
  const clickHInput = el('input', { type: 'number', id: 'arsenalRifleClickHorizontal', step: 0.01, value: values.defaultClickHorizontal });
  const clickVInput = el('input', { type: 'number', id: 'arsenalRifleClickVertical', step: 0.01, value: values.defaultClickVertical });

  const sourceInput = el('input', { type: 'text', id: 'arsenalRifleSource', value: values.source });

  const errorMessage = el('p', { class: 'hint warning' });
  errorMessage.style.display = 'none';

  const saveButton = el('button', { i18n: 'arsenal.saveButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'arsenal.cancelButton' });

  function readValues() {
    const twistMm = twistField.getEngineValue(); // null when left blank
    return {
      name: nameInput.value.trim(),
      defaultSightHeightM: sightHeightField.getEngineValue() / 1000,
      defaultZeroRangeM: zeroRangeField.getEngineValue(),
      // Omitted entirely (not set to null) when blank — same convention as
      // bullet-form.js's optional length field, so editing an existing
      // rifle without touching this field never clobbers a previously
      // stored value with null.
      ...(twistMm == null ? {} : { defaultRiflingTwistM: twistMm / 1000 }),
      // Always saved explicitly (a <select> always has a real value, no
      // blank state the way the twist rate field has) — "optional" here
      // just means the default ("right") never has to be touched.
      defaultTwistDirection: twistDirectionSelect.value,
      defaultClickUnit: clickUnitSelect.value,
      defaultClickHorizontal: parseFloat(clickHInput.value) || 0,
      defaultClickVertical: parseFloat(clickVInput.value) || 0,
      source: sourceInput.value.trim()
    };
  }

  saveButton.addEventListener('click', () => {
    const data = readValues();
    if (!data.name) {
      errorMessage.textContent = t('arsenal.errorNameRequired');
      errorMessage.style.display = '';
      return;
    }
    errorMessage.style.display = 'none';
    if (onSave) onSave(data);
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  refreshDuplicateWarning();

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.rifleName' }), nameInput]),
    duplicateWarning,
    sightHeightField.node,
    zeroRangeField.node,
    twistField.node,
    el('p', { class: 'hint', i18n: 'arsenal.riflingTwistHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.twistDirection' }), twistDirectionSelect]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickUnit' }), clickUnitSelect]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickHorizontal' }), clickHInput]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickVertical' }), clickVInput]),
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.sourceLabel' }), sourceInput]),
    errorMessage,
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return { node };
}
