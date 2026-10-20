// Persisted Max Range / Range Step / Line of sight angle for the
// Trajectory view — cookie-backed (survives navigation and an app
// restart), same one-slice shape cd-mach-curve-state.js's own `inputs`
// uses. These three are view-local display/computation settings, not
// part of the shared shot config (cartridge/rifle/atmosphere already
// persist on their own — see shot-state.js), so they get their own
// small state module rather than being folded into that one.
import { decodeLegacy } from './legacy-units.js';
import { loadVersionedCookie, saveCookieState } from './versioned-cookie.js';

// Stored in SI, as held in memory; v1 (angle in degrees, target height in
// cm) is converted once on first load.
const COOKIE_NAME = 'ballistics_trajectory_state_v2';
const LEGACY_COOKIE_NAME = 'ballistics_trajectory_state_v1';

function load() {
  return loadVersionedCookie({ name: COOKIE_NAME, legacyName: LEGACY_COOKIE_NAME, fromLegacy: decodeLegacy });
}

function persist() {
  saveCookieState(COOKIE_NAME, state);
}

let state = load();

export function loadTrajectoryInputsState() {
  return state;
}

export function saveTrajectoryInputsState(partial) {
  state = { ...state, ...partial };
  persist();
}

export function resetTrajectoryStateForTests() {
  state = null;
}
