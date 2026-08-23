import { el } from '../../dom.js';
import { FIELD_BOUNDS } from '../../units.js';
import { unitField } from '../unit-field.js';
import { windDirectionDial } from '../wind-direction-dial.js';
import { sectionGroup } from '../section.js';
import { loadAtmosphereState, saveAtmosphereState } from '../../shot-state.js';
import { standardAtmosphereAt, altitudeFromPressureHpa } from '../../engine/atmosphere.js';

const DEFAULTS = {
  windSpeed: 0, windAngle: 90, tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 50,
  atmospherePreset: 'custom'
};

// Fixed reference tables for the two named presets — temperature, station
// pressure and humidity all come straight from the table, no formula.
// "Standard atmosphere" isn't listed here: it's computed from the Altitude
// field via standardAtmosphereAt() instead (see applyPreset() below), and
// "custom" ("Real conditions") is the synthetic "you edited something by
// hand" state, same convention as hit-probability-view.js's own presets.
const ATMOSPHERE_PRESETS = {
  swiss: { tempC: 7, pressureHpa: 925.3, humidityPct: 0 },
  soviet: { tempC: 15, pressureHpa: 1000, humidityPct: 50 }
};

// Ambient conditions. `includeWind: false` drops the wind fields for
// tools whose engine call doesn't use them (BC Estimator solves along a
// fixed line between two chronograph readings, wind-free) — showing
// inputs the calculation silently ignores would be worse than not having
// them.
//
// `presets: false` (same idiom as `includeWind`) drops the preset select
// AND the "Standard atmosphere" altitude field entirely — not just hides
// them, never constructs them — pinning the section to "custom" for its
// whole lifetime. The Labradar tool's own atmosphere block uses this: it
// has no presets at all in the legacy tool it replaces, and unlike
// legacy (which always assumed altitude 0, an engine limitation it had),
// this still back-derives a real altitude from station pressure below,
// same as every other "custom" atmosphere in this app already does.
//
// `load`/`save` default to shot-state.js's own session-only atmosphereState
// (shared live across Trajectory/Hit Probability/BC Estimator) but can be
// overridden — Range Solver passes its own cookie-backed pair (see
// range-solver-state.js) instead, since its own inputs need to survive an
// app restart, unlike the shared one.
export function atmosphereSection({
  slider = false, includeWind = true, presets = true, onInput,
  load = loadAtmosphereState, save = saveAtmosphereState
} = {}) {
  const initial = { ...DEFAULTS, ...load() };
  let currentPreset = presets ? initial.atmospherePreset : 'custom';

  // Shared across every field below so any change here — from any view —
  // is what the next view's atmosphereSection sees as its own initial
  // values. getValues() is declared further down but already usable here
  // (function declarations hoist, and this is only ever called after
  // construction finishes, from an event handler).
  function handleChange() {
    save(getValues());
    if (onInput) onInput();
  }

  const windSpeedField = includeWind
    ? unitField({ id: 'windSpeed', ...FIELD_BOUNDS.windSpeed, step: 0.5, value: initial.windSpeed, slider, onInput: handleChange })
    : null;
  // The compact clock/compass control (src/ui/wind-direction-dial.js) —
  // `slider` doesn't apply to it (there's no linear-range equivalent of a
  // dial), so it renders the same way regardless of that option.
  const windAngleDial = includeWind
    ? windDirectionDial({ id: 'windAngle', value: initial.windAngle, onInput: handleChange })
    : null;

  const presetSelectEl = presets
    ? el('select', { id: 'atmospherePreset' }, [
      el('option', { value: 'standard', i18n: 'fields.atmospherePresetStandard' }),
      el('option', { value: 'swiss', i18n: 'fields.atmospherePresetSwiss' }),
      el('option', { value: 'soviet', i18n: 'fields.atmospherePresetSoviet' }),
      // Freely selectable, unlike hit-probability-view.js's own equivalent
      // "Custom" option — picking it directly is exactly how you drop out
      // of a named preset without hand-editing a field first, and it keeps
      // whatever temp/pressure/humidity the previous preset left showing
      // (see the 'custom' branch below) rather than resetting anything.
      el('option', { value: 'custom', i18n: 'fields.atmospherePresetCustom' })
    ])
    : null;
  if (presetSelectEl) presetSelectEl.value = currentPreset;

  // Temperature/pressure/humidity are always editable, whichever preset is
  // active — hand-editing any of them is exactly what flips to "Real
  // conditions" (see markCustom()), the same "preset pre-fills, typing
  // overrides" pairing presetUnitField() uses in hit-probability-view.js,
  // just with one select governing three fields instead of one.
  const tempField = unitField({ id: 'tempC', ...FIELD_BOUNDS.tempC, step: 1, value: initial.tempC, slider, onInput: markCustom });
  // This is the shooter's own actual station pressure — taken at face
  // value at whatever elevation applies, never assumed to be a
  // sea-level-referenced reading. 0.01 step (not the usual whole hPa) so
  // the preset reference values (925.3, 1013.25) are exactly reachable by
  // hand too.
  const pressureField = unitField({ id: 'pressureHpa', ...FIELD_BOUNDS.pressureHpa, step: 0.01, value: initial.pressureHpa, slider, onInput: markCustom });
  const humidityField = unitField({ id: 'humidityPct', ...FIELD_BOUNDS.humidityPct, step: 5, value: initial.humidityPct, slider, onInput: markCustom });
  // Only ever a real, user-typed input under the "Standard atmosphere"
  // preset — elsewhere it's hidden and altitudeM is instead back-derived
  // from the station pressure (see getValues()). Same bound as
  // location-form.js's own altitude field (-500 – 5000m) — both are the
  // same physical quantity, and the ICAO lapse-rate formula above stays
  // well-behaved across this whole range.
  const altitudeField = presets
    ? unitField({ id: 'altitudeM', ...FIELD_BOUNDS.altitudeM, step: 50, value: initial.altitudeM, slider, onInput: applyStandardFromAltitude })
    : null;

  function updateAltitudeVisibility() {
    if (altitudeField) altitudeField.node.style.display = currentPreset === 'standard' ? '' : 'none';
  }

  // The "Standard atmosphere" preset's own formula, re-run every time its
  // one real input (altitude) changes — humidity has no altitude formula
  // of its own, so it's pinned to 0%, matching the ICAO standard
  // atmosphere's own dry-air definition.
  function applyStandardFromAltitude() {
    const { tempC, pressureHpa } = standardAtmosphereAt(altitudeField.getEngineValue());
    tempField.setEngineValue(tempC);
    pressureField.setEngineValue(pressureHpa);
    humidityField.setEngineValue(0);
    handleChange();
  }

  // Typing directly into temp/pressure/humidity — under any preset,
  // "Standard atmosphere" included — means you're no longer looking at
  // that preset's own values.
  function markCustom() {
    if (presets && currentPreset !== 'custom') {
      currentPreset = 'custom';
      presetSelectEl.value = 'custom';
      updateAltitudeVisibility();
    }
    handleChange();
  }

  if (presetSelectEl) {
    presetSelectEl.addEventListener('change', () => {
      currentPreset = presetSelectEl.value;
      if (currentPreset === 'standard') {
        applyStandardFromAltitude(); // also persists via handleChange()
      } else if (currentPreset === 'custom') {
        // Picked directly (not arrived at via markCustom()) — just unlocks
        // temp/pressure/humidity for free editing, keeping whatever the
        // previous preset left them showing rather than resetting anything.
        handleChange();
      } else {
        const preset = ATMOSPHERE_PRESETS[currentPreset];
        tempField.setEngineValue(preset.tempC);
        pressureField.setEngineValue(preset.pressureHpa);
        humidityField.setEngineValue(preset.humidityPct);
        handleChange();
      }
      updateAltitudeVisibility();
    });
  }

  updateAltitudeVisibility();

  const children = [
    ...(includeWind ? [windSpeedField.node, windAngleDial.node] : []),
    ...(presets ? [el('div', { class: 'field' }, [el('label', { i18n: 'fields.atmospherePreset' }), presetSelectEl]), altitudeField.node] : []),
    tempField.node,
    pressureField.node,
    humidityField.node
  ];
  const node = sectionGroup('sections.atmosphereHeading', children);

  function getValues() {
    // Whenever there's no real altitude input on screen (any preset but
    // "Standard atmosphere" — always the case when presets:false, since
    // that mode doesn't exist here), back-derive one from the actual
    // station pressure instead of silently assuming sea level — see
    // altitudeFromPressureHpa() in atmosphere.js. This is what feeds
    // trajectory.js's own in-flight altitude-drift correction.
    const altitudeM = currentPreset === 'standard'
      ? altitudeField.getEngineValue()
      : altitudeFromPressureHpa(pressureField.getEngineValue());
    return {
      ...(includeWind ? { windSpeed: windSpeedField.getEngineValue(), windAngle: windAngleDial.getValue() } : {}),
      tempC: tempField.getEngineValue(),
      pressureHpa: pressureField.getEngineValue(),
      altitudeM,
      humidityPct: humidityField.getEngineValue(),
      ...(presets ? { atmospherePreset: currentPreset } : {})
    };
  }

  return { node, getValues };
}
