// Persisted Max Range / Range Step / Line of sight angle for the
// Trajectory view — cookie-backed (survives navigation and an app
// restart), same one-slice shape cd-mach-curve-state.js's own `inputs`
// uses. These three are view-local display/computation settings, not
// part of the shared shot config (cartridge/rifle/atmosphere already
// persist on their own — see shot-state.js), so they get their own
// small state module rather than being folded into that one.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_trajectory_state_v1';

function load() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (raw) return JSON.parse(raw);
  } catch {
    // malformed cookie — fall through to defaults
  }
  return null;
}

function persist() {
  try {
    setCookie(COOKIE_NAME, JSON.stringify(state));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
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
