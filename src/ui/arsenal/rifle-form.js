import { el } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { CLICK_UNITS, FIELD_BOUNDS } from '../../units.js';
import { findUserRifleByName } from '../../user-library.js';
import { t } from '../../i18n.js';
import { fieldValidity } from '../field-validity.js';

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
  const nameValidity = fieldValidity(nameInput, () => (nameInput.value.trim() ? null : t('arsenal.errorNameRequired')));

  const sightHeightField = unitField({ id: 'sightHeight', ...FIELD_BOUNDS.sightHeight, step: 1, value: values.defaultSightHeightM * 1000 });
  const zeroRangeField = unitField({ id: 'zeroRange', ...FIELD_BOUNDS.zeroRange, step: 5, value: values.defaultZeroRangeM });
  const twistField = unitField({
    id: 'riflingTwist', ...FIELD_BOUNDS.riflingTwist, step: 1, optional: true,
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
  const clickHInput = el('input', {
    type: 'number', id: 'arsenalRifleClickHorizontal', step: 0.01,
    min: FIELD_BOUNDS.scopeClick.min, max: FIELD_BOUNDS.scopeClick.max, value: values.defaultClickHorizontal
  });
  const clickVInput = el('input', {
    type: 'number', id: 'arsenalRifleClickVertical', step: 0.01,
    min: FIELD_BOUNDS.scopeClick.min, max: FIELD_BOUNDS.scopeClick.max, value: values.defaultClickVertical
  });
  function clickMessageFor(input) {
    return () => {
      const raw = input.value.trim();
      if (raw === '') return t('fields.errorRequired');
      const parsed = parseFloat(raw);
      if (Number.isNaN(parsed)) return t('fields.errorRequired');
      const { min, max } = FIELD_BOUNDS.scopeClick;
      if (parsed < min || parsed > max) return t('fields.errorRange', { range: `${min} – ${max}` });
      return null;
    };
  }
  const clickHValidity = fieldValidity(clickHInput, clickMessageFor(clickHInput));
  const clickVValidity = fieldValidity(clickVInput, clickMessageFor(clickVInput));

  const sourceInput = el('input', { type: 'text', id: 'arsenalRifleSource', value: values.source });

  const saveButton = el('button', { i18n: 'arsenal.saveRifleButton' });
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
      // Both are now Save-gated (see below) rather than silently coerced
      // to 0 on bad input — by the time onSave runs, both are guaranteed
      // real numbers within FIELD_BOUNDS.scopeClick.
      defaultClickHorizontal: parseFloat(clickHInput.value),
      defaultClickVertical: parseFloat(clickVInput.value),
      source: sourceInput.value.trim()
    };
  }

  // Every field's own live validation (red border + inline hint) is also
  // the Save gate — see bullet-form.js's own Save handler for the same
  // pattern. No separate shared error banner; Save just scrolls to
  // whichever field is still wrong.
  saveButton.addEventListener('click', () => {
    const checks = [
      { ok: nameValidity.validate(), node: nameInput },
      { ok: sightHeightField.validate(), node: sightHeightField.node },
      { ok: zeroRangeField.validate(), node: zeroRangeField.node },
      { ok: twistField.validate(), node: twistField.node },
      { ok: clickHValidity.validate(), node: clickHInput },
      { ok: clickVValidity.validate(), node: clickVInput }
    ];
    const firstInvalid = checks.find((c) => !c.ok);
    if (firstInvalid) {
      firstInvalid.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (onSave) onSave(readValues());
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  refreshDuplicateWarning();

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.rifleName' }), nameInput]),
    nameValidity.hintNode,
    duplicateWarning,
    sightHeightField.node,
    zeroRangeField.node,
    twistField.node,
    el('p', { class: 'hint', i18n: 'arsenal.riflingTwistHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.twistDirection' }), twistDirectionSelect]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickUnit' }), clickUnitSelect]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickHorizontal' }), clickHInput, clickHValidity.hintNode]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickVertical' }), clickVInput, clickVValidity.hintNode]),
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.sourceLabel' }), sourceInput]),
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return { node };
}
