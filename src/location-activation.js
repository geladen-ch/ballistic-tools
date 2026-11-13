// Making a saved location the Range Solver's active one — shared by the
// Locations manager's own list (locations-view.js) and the Range Solver's
// location modal (ui/range-solver/location-picker.js), so neither can drift
// from the other in what "active" means.
//
// Activation lands on the location's first target and seeds the solver's
// range/LoS slice with that target's values, exactly as if it had been
// selected in the Fire! pane's targets list — otherwise the solver
// would show whatever was left over from before and immediately flag a
// false "diverged from the target" state that was never really an edit.
// A location with an altitude also defaults the atmosphere (below).
import {
  saveRangeSolverLocationState, saveRangeSolverTargetState,
  saveRangeSolverAtmosphereState, wasAtmosphereTouchedThisSession
} from './range-solver-state.js';
import { standardAtmosphereAt } from './engine/atmosphere.js';

// Writes the standard-atmosphere/50%-humidity default straight into the
// Range Solver's cookie-backed atmosphere slice, bypassing the atmosphere
// section's preset select entirely (it lands on "Custom" like any other
// hand-set value once that tab next mounts) — only when the location
// actually has an altitude, and only if the user hasn't already taken
// over the Atmosphere tab themselves this session.
function applyLocationAltitudeDefault(loc) {
  if (loc.altitudeM == null || wasAtmosphereTouchedThisSession()) return;
  const { tempC, pressurePa } = standardAtmosphereAt(loc.altitudeM);
  saveRangeSolverAtmosphereState({
    tempC, pressurePa, altitudeM: loc.altitudeM, humidity: 0.5, atmospherePreset: 'custom'
  });
}

// `loc` null clears the active location ("No location").
export function activateRangeSolverLocation(loc) {
  if (!loc) {
    saveRangeSolverLocationState({ locationId: null, targetId: null });
    return;
  }
  const target = loc.targets[0] || null;
  saveRangeSolverLocationState({ locationId: loc.id, targetId: target ? target.id : null });
  if (target) saveRangeSolverTargetState({ rangeM: target.rangeM, losAngleRad: target.losAngleRad });
  applyLocationAltitudeDefault(loc);
}
