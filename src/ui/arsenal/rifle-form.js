import { el, clear } from '../../dom.js';
import { unitField } from '../unit-field.js';
import { CLICK_UNITS, FIELD_BOUNDS, clickValueInUnit } from '../../units.js';
import { converter, mradToRad } from '../../quantity.js';
import { findUserRifleByName } from '../../user-library.js';
import { t } from '../../i18n.js';
import { fieldValidity } from '../field-validity.js';
import { isUsableScope } from '../../scope-record.js';

const DEFAULT_VALUES = {
  name: '', defaultSightHeightM: 0.045, defaultZeroRangeM: 100, defaultRiflingTwistM: null, defaultTwistDirection: 'right',
  defaultClickUnit: 'mrad', defaultClickHorizontalRad: mradToRad(0.1), defaultClickVerticalRad: mradToRad(0.1), source: ''
};

// Add/Edit form for a user's own rifle — name, sight height, zero range,
// rifling twist (rate + direction), and click settings, exactly the
// fields a built-in rifle carries (minus `cartridges`, managed separately
// as its own nested Add/Edit/Delete list in arsenal-view.js, and minus
// `id`, which the caller assigns). Twist rate is optional (only affects
// minor ballistic factors this app doesn't otherwise model), same spirit
// as the bullet form's own optional length field; twist direction always
// has a value (defaulting to "right") since a <select> has no blank state.
//
// The rifle's scope, optional: one of the user's scopes or a built-in one,
// linked by id (a built-in scope is never copied), and which of its
// reticles — asked only when it has more than one. Choosing a scope copies
// its click unit and click values into the rifle's own fields; they stay
// the rifle's, editable here, and are never written back to the scope.
// `scopeChoices()` returns { arsenal, builtIn } scopes and
// `reticleName(id)` a reticle's name (or null when unknown); call the
// returned refreshScopes() when the scopes change (the built-in ones
// arrive asynchronously).
export function rifleForm({ initialValues = {}, excludeId, scopeChoices, reticleName = () => null, onSave, onCancel } = {}) {
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

  const sightHeightField = unitField({ id: 'sightHeight', ...FIELD_BOUNDS.sightHeight, step: 0.001, value: values.defaultSightHeightM });
  const zeroRangeField = unitField({ id: 'zeroRange', ...FIELD_BOUNDS.zeroRange, step: 5, value: values.defaultZeroRangeM });
  const twistField = unitField({
    id: 'riflingTwist', ...FIELD_BOUNDS.riflingTwist, step: 0.001, optional: true,
    value: values.defaultRiflingTwistM ?? null
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
  // Click sizes are typed in the turret's own unit (the select above) and
  // held in radians. A value left as shown, in the unit it was shown in,
  // comes back exactly as given rather than as its rounded display.
  // `clickBaseline`: the click unit and values the fields were last filled
  // with (from the rifle, or copied from a scope).
  let clickBaseline = { unit: values.defaultClickUnit, horizontalRad: values.defaultClickHorizontalRad, verticalRad: values.defaultClickVerticalRad };
  const shownClick = (rad, unit = clickBaseline.unit) => (rad == null ? '' : String(clickValueInUnit(rad, unit)));
  const clickHInput = el('input', {
    type: 'number', id: 'arsenalRifleClickHorizontal', step: 0.01,
    min: FIELD_BOUNDS.scopeClick.min, max: FIELD_BOUNDS.scopeClick.max, value: shownClick(values.defaultClickHorizontalRad)
  });
  const clickVInput = el('input', {
    type: 'number', id: 'arsenalRifleClickVertical', step: 0.01,
    min: FIELD_BOUNDS.scopeClick.min, max: FIELD_BOUNDS.scopeClick.max, value: shownClick(values.defaultClickVerticalRad)
  });
  function readClickRad(input, baselineRad) {
    if (clickUnitSelect.value === clickBaseline.unit && input.value === shownClick(baselineRad)) return baselineRad;
    return converter(clickUnitSelect.value, 'rad')(parseFloat(input.value));
  }
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


  // ---- scope ----
  const scopeSelect = el('select', { id: 'arsenalRifleScope' });
  const reticleSelect = el('select', { id: 'arsenalRifleReticle' });
  const reticleField = el('div', { class: 'field' }, [el('label', { for: reticleSelect.id, i18n: 'arsenal.rifleReticle' }), reticleSelect]);
  let scopesById = new Map();
  let chosenReticleId = values.reticleId || null;

  let scopesShown = false;
  function refreshScopes() {
    const selected = scopesShown ? scopeSelect.value : (values.scopeId || '');
    scopesShown = true;
    const { arsenal = [], builtIn = [] } = scopeChoices ? scopeChoices() : {};
    scopesById = new Map([...arsenal, ...builtIn].map((scope) => [scope.id, scope]));
    clear(scopeSelect);
    scopeSelect.appendChild(el('option', { value: '', text: t('arsenal.rifleScopeNone') }));
    // A scope this rifle names but that isn't here (not synced yet,
    // deleted elsewhere) stays named, so saving doesn't drop the link.
    if (selected && !scopesById.has(selected)) {
      scopeSelect.appendChild(el('option', { value: selected, text: t('arsenal.scopeMissing') }));
    }
    const option = (scope) => {
      const usable = isUsableScope(scope);
      const node = el('option', { value: scope.id, text: usable ? scope.name : `${scope.name} — ${t('arsenal.rifleScopeNoReticle')}` });
      node.disabled = !usable && scope.id !== selected;
      return node;
    };
    for (const [labelKey, list] of [['arsenal.scopesYours', arsenal], ['arsenal.scopesBuiltIn', builtIn]]) {
      if (list.length) scopeSelect.appendChild(el('optgroup', { label: t(labelKey) }, list.map(option)));
    }
    scopeSelect.value = selected;
    refreshReticles();
  }

  function scopeReticleIds() {
    const scope = scopesById.get(scopeSelect.value);
    return scope ? scope.reticleIds : [];
  }
  // The reticle in use: the one chosen while the scope still has it,
  // otherwise its first.
  function currentReticleId() {
    const ids = scopeReticleIds();
    if (ids.includes(chosenReticleId)) return chosenReticleId;
    return ids[0] || chosenReticleId || null;
  }

  function refreshReticles() {
    const ids = scopeReticleIds();
    clear(reticleSelect);
    for (const id of ids) reticleSelect.appendChild(el('option', { value: id, text: reticleName(id) || t('arsenal.reticleMissing') }));
    reticleSelect.value = currentReticleId() || '';
    reticleField.style.display = ids.length > 1 ? '' : 'none';
  }

  reticleSelect.addEventListener('change', () => { chosenReticleId = reticleSelect.value; });
  // A newly chosen scope brings its click unit and values.
  scopeSelect.addEventListener('change', () => {
    const scope = scopesById.get(scopeSelect.value);
    chosenReticleId = null;
    refreshReticles();
    if (!scope) return;
    clickBaseline = { unit: scope.clickUnit, horizontalRad: scope.clickHorizontalRad, verticalRad: scope.clickVerticalRad };
    clickUnitSelect.value = scope.clickUnit;
    clickHInput.value = shownClick(scope.clickHorizontalRad);
    clickVInput.value = shownClick(scope.clickVerticalRad);
    clickHValidity.validate();
    clickVValidity.validate();
  });

  const sourceInput = el('input', { type: 'text', id: 'arsenalRifleSource', value: values.source });

  const saveButton = el('button', { i18n: 'arsenal.saveRifleButton' });
  const cancelButton = el('button', { class: 'secondary', i18n: 'arsenal.cancelButton' });

  function readValues() {
    const twistM = twistField.getEngineValue(); // null when left blank
    return {
      name: nameInput.value.trim(),
      defaultSightHeightM: sightHeightField.getEngineValue(),
      defaultZeroRangeM: zeroRangeField.getEngineValue(),
      // Omitted entirely (not set to null) when blank — same convention as
      // bullet-form.js's optional length field, so editing an existing
      // rifle without touching this field never clobbers a previously
      // stored value with null.
      ...(twistM == null ? {} : { defaultRiflingTwistM: twistM }),
      // Always saved explicitly (a <select> always has a real value, no
      // blank state the way the twist rate field has) — "optional" here
      // just means the default ("right") never has to be touched.
      defaultTwistDirection: twistDirectionSelect.value,
      defaultClickUnit: clickUnitSelect.value,
      // Both are now Save-gated (see below) rather than silently coerced
      // to 0 on bad input — by the time onSave runs, both are guaranteed
      // real numbers within FIELD_BOUNDS.scopeClick.
      defaultClickHorizontalRad: readClickRad(clickHInput, clickBaseline.horizontalRad),
      defaultClickVerticalRad: readClickRad(clickVInput, clickBaseline.verticalRad),
      source: sourceInput.value.trim(),
      // Always written, null when there is none, so removing the scope
      // from a rifle that had one sticks.
      scopeId: scopeSelect.value || null,
      reticleId: scopeSelect.value ? currentReticleId() : null
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
  refreshScopes();

  const node = el('div', { class: 'input-section nested' }, [
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.rifleName' }), nameInput]),
    nameValidity.hintNode,
    duplicateWarning,
    sightHeightField.node,
    zeroRangeField.node,
    twistField.node,
    el('p', { class: 'hint', i18n: 'arsenal.riflingTwistHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.twistDirection' }), twistDirectionSelect]),
    el('div', { class: 'field' }, [el('label', { for: scopeSelect.id, i18n: 'arsenal.rifleScope' }), scopeSelect]),
    reticleField,
    el('p', { class: 'hint', i18n: 'arsenal.rifleScopeHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickUnit' }), clickUnitSelect]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickHorizontal' }), clickHInput, clickHValidity.hintNode]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickVertical' }), clickVInput, clickVValidity.hintNode]),
    el('div', { class: 'field' }, [el('label', { i18n: 'arsenal.sourceLabel' }), sourceInput]),
    el('div', { class: 'arsenal-form-actions' }, [saveButton, cancelButton])
  ]);

  return { node, refreshScopes };
}
