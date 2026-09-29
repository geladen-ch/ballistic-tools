// Shared "presets dropdown + editable unitField" pairing, split out of
// hit-probability-view.js so the Truing Session tool can resolve a
// cartridge's rifle precision (R50) and muzzle-velocity SD the exact same
// way Hit Probability already does — a "This rig" option, auto-selected
// when the Arsenal
// record has a value, else a stated, named, editable preset — rather than
// re-implementing ~150 lines of working, tested UI logic a second time.
//
// Generic over the preset list/default key/label prefix/persistence
// callbacks, so hit-probability-view.js keeps its own thin wrapper (same
// call sites as before, only the two mechanics below moved out from under
// it) while Truing Session supplies its own persistence (backed by
// truing-session-state.js) and label prefix.
import { el } from '../dom.js';
import { unitField } from './unit-field.js';

// A synthetic, non-pickable option shown whenever the paired number field's
// value no longer matches any preset — indicates "you're not looking at a
// preset value anymore" rather than offering an action of its own.
export const CUSTOM_PRESET_KEY = '__custom__';

// A synthetic option offered only while the active cartridge specifies its
// own value for this field — picks up that value the same way a real
// preset does, but its value comes from the Arsenal rather than the preset
// list.
export const RIG_PRESET_KEY = '__rig__';

// The two preset ladders both Hit Probability and Truing Session need —
// see hit-probability-view.js's own (larger, tool-specific) PRESETS object
// for the rest, which stays local to that file. Each preset's `key` is
// also its translation key under hitProbability.presetLabels — reused
// here rather than renamed, since the labels ("This rig", "Good reload",
// ...) describe the same real-world scenarios regardless of which tool is
// asking, and renaming would mean re-touching all five locale files for
// no functional gain.
export const BENCH_PRECISION_PRESETS = [
  { key: 'benchrest', value: 0.03 }, { key: 'supermatch', value: 0.06 }, { key: 'sniper', value: 0.09 },
  { key: 'basic', value: 0.14 }, { key: 'dmr', value: 0.20 }, { key: 'm4m16', value: 0.32 },
  { key: 'ak74', value: 0.39 }, { key: 'akmAk47', value: 0.53 }
];
export const DEFAULT_BENCH_PRECISION_PRESET_KEY = 'basic';

export const MUZZLE_VELOCITY_SD_PRESETS = [
  { key: 'manicReload', value: 2 }, { key: 'goodReload', value: 3 }, { key: 'factoryPremium', value: 4 },
  { key: 'factoryMatch', value: 5 }, { key: 'factoryTraining', value: 7 }, { key: 'surplus', value: 9 }
];
export const DEFAULT_MUZZLE_VELOCITY_SD_PRESET_KEY = 'factoryMatch';

// `getRigValue`, if given, resolves RIG_PRESET_KEY's own current value —
// looked up live rather than baked in at select-creation time, since the
// active cartridge (and so this value) can change after the select
// already exists; see presetUnitField()'s own setRigValue() below, the
// only thing that ever actually adds the option this handles.
export function presetSelect({ presetList, labelPrefix, initialKey, onPick, getRigValue }) {
  const options = presetList.map((p) => el('option', { value: p.key, i18n: `${labelPrefix}${p.key}` }));
  options.push(el('option', { value: CUSTOM_PRESET_KEY, disabled: true, i18n: `${labelPrefix}custom` }));
  const select = el('select', {}, options);
  select.value = initialKey;
  select.addEventListener('change', () => {
    if (select.value === CUSTOM_PRESET_KEY) return;
    if (select.value === RIG_PRESET_KEY) { onPick(getRigValue()); return; }
    onPick(presetList.find((p) => p.key === select.value).value);
  });
  return select;
}

// A unitField() paired with a presets <select> that pre-fills it (still
// freely editable afterward). Reuses unitField's own unit-conversion logic
// via its `before` slot rather than duplicating it. Typing a value by hand
// (as opposed to picking a preset, which sets the field programmatically
// and so never fires unitField's own onInput) flips the select to
// "Custom" — both live in the same handler so there's no ordering
// question between "mark custom" and "persist" running on the same
// keystroke.
//
// `getPersisted(key, defaultValue)`/`setPersisted(patch)` are the
// caller's own persistence — hit-probability-view.js's cookie-backed
// panelState, or Truing Session's own truing-session-state.js — so this
// module has no opinion on where a value is remembered, only on the
// preset/custom/rig mechanics themselves.
export function presetUnitField({ id, presetList, defaultKey, labelPrefix, max, step, isSpan = false, onInput, getPersisted, setPersisted }) {
  let field;
  // The active cartridge's own value for this field, and the <option> that
  // exposes it (only present while such a value exists) — both owned by
  // setRigValue() below, the only thing that ever touches either.
  let rigValue = null;
  let rigOption = null;
  const initialKey = getPersisted(id + 'Preset', defaultKey);
  const select = presetSelect({
    presetList, labelPrefix, initialKey,
    onPick: (value) => {
      field.setEngineValue(value);
      setPersisted({ [id]: value, [id + 'Preset']: select.value });
      onInput();
    },
    getRigValue: () => rigValue
  });
  const defaultValue = presetList.find((p) => p.key === defaultKey).value;
  const initialValue = getPersisted(id, defaultValue);
  field = unitField({
    id, min: 0, max, step, value: initialValue, isSpan, before: select,
    onInput: () => {
      select.value = CUSTOM_PRESET_KEY;
      setPersisted({ [id]: field.getEngineValue(), [id + 'Preset']: CUSTOM_PRESET_KEY });
      onInput();
    }
  });

  // Called whenever the active rifle+cartridge selection changes —
  // `value` is the cartridge's own value for this field (engine units),
  // or null once it no longer specifies one (a different cartridge, or
  // "Other"/no rifle). `autoSelect` additionally picks it right now, the
  // "default to specified values" behavior; a caller that only wants to
  // keep the *option* available without forcing a selection omits it.
  // Typing a value by hand still flips back to Custom exactly the way it
  // already does for any other preset — no special-casing needed there.
  field.setRigValue = function setRigValue(value, { autoSelect = false } = {}) {
    rigValue = value;
    if (value == null) {
      if (rigOption) { rigOption.remove(); rigOption = null; }
      if (select.value === RIG_PRESET_KEY) {
        select.value = defaultKey;
        field.setEngineValue(defaultValue);
        setPersisted({ [id]: defaultValue, [id + 'Preset']: defaultKey });
      }
      return;
    }
    if (!rigOption) {
      rigOption = el('option', { value: RIG_PRESET_KEY, i18n: `${labelPrefix}thisRig` });
      select.insertBefore(rigOption, select.querySelector(`option[value="${CUSTOM_PRESET_KEY}"]`));
    }
    if (autoSelect) {
      select.value = RIG_PRESET_KEY;
      field.setEngineValue(value);
      setPersisted({ [id]: value, [id + 'Preset']: RIG_PRESET_KEY });
    }
  };

  return field;
}
