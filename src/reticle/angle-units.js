// The Reticle Designer's own angular unit switch (mrad or MOA) — local to
// the tool and deliberately independent of the user's app-wide unit
// preferences: a reticle is drawn in the unit system its subtensions are
// specified in, whatever the shooter dials elsewhere. Everything the tool
// holds is in radians; this is the presentation edge for its angles.
import { radToMrad, mradToRad, radToMoa, moaToRad } from '../quantity.js';

export const RETICLE_UNIT_IDS = ['mrad', 'moa'];
export const DEFAULT_RETICLE_UNITS = 'mrad';

export const RETICLE_UNITS = {
  mrad: {
    id: 'mrad',
    label: 'mrad',
    decimals: 3,
    toDisplay: radToMrad,
    fromDisplay: mradToRad,
    gridRad: mradToRad(1),
    snapRad: mradToRad(0.1)
  },
  moa: {
    id: 'moa',
    label: 'MOA',
    decimals: 2,
    toDisplay: radToMoa,
    fromDisplay: moaToRad,
    gridRad: moaToRad(1),
    snapRad: moaToRad(0.25)
  }
};

export function reticleUnits(id) {
  return RETICLE_UNITS[id] || RETICLE_UNITS[DEFAULT_RETICLE_UNITS];
}

// Rounds an angle to the switch's display precision and back, so a value
// shown in a field and the value held agree once the field is committed.
export function formatReticleAngle(valueRad, unitsId) {
  const units = reticleUnits(unitsId);
  const shown = units.toDisplay(valueRad);
  const rounded = Number(shown.toFixed(units.decimals));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

// Nearest multiple of `stepRad` — the snapping grid is absolute (anchored
// at zero), not relative to wherever a drag started.
export function snapAngle(valueRad, stepRad) {
  if (!(stepRad > 0)) return valueRad;
  const snapped = Math.round(valueRad / stepRad) * stepRad;
  return Object.is(snapped, -0) ? 0 : snapped;
}
