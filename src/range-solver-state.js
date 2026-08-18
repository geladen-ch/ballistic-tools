// Persisted Target/Wind/Atmosphere inputs for Range Solver — cookie-backed
// (survives navigation *and* an app restart), deliberately separate from
// shot-state.js's own atmosphereState, which is explicitly session-only by
// design and shared with Trajectory/Hit Probability. The active rifle
// profile itself is *not* owned here — it stays shot-state.js's, changing
// only via Guns, same as every other tool.
//
// One cookie, three named sub-slices, same "read once at module load, one
// save writes the whole thing back" shape shot-state.js's own gun cookie
// uses — each save merges into whatever's already there so touching one
// slice never clobbers the other two.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_range_solver_state_v1';

function load() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (raw) return JSON.parse(raw);
  } catch {
    // malformed cookie — fall through to defaults
  }
  return { target: null, wind: null, atmosphere: null };
}

function persist() {
  try {
    setCookie(COOKIE_NAME, JSON.stringify(state));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

let state = load();

export function loadRangeSolverTargetState() {
  return state.target;
}

export function saveRangeSolverTargetState(partial) {
  state = { ...state, target: { ...state.target, ...partial } };
  persist();
}

export function loadRangeSolverWindState() {
  return state.wind;
}

export function saveRangeSolverWindState(partial) {
  state = { ...state, wind: { ...state.wind, ...partial } };
  persist();
}

// Shaped to match shot-state.js's loadAtmosphereState/saveAtmosphereState
// exactly, so atmosphereSection()'s own `{ load, save }` override (see
// atmosphere-section.js) can point straight at these with no adapter.
export function loadRangeSolverAtmosphereState() {
  return state.atmosphere;
}

export function saveRangeSolverAtmosphereState(partial) {
  state = { ...state, atmosphere: { ...state.atmosphere, ...partial } };
  persist();
}

export function resetRangeSolverStateForTests() {
  state = { target: null, wind: null, atmosphere: null };
}
