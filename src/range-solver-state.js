// Persisted Target/Wind/Atmosphere/Location inputs for Range Solver —
// cookie-backed (survives navigation *and* an app restart), deliberately
// separate from shot-state.js's own atmosphereState, which is explicitly
// session-only by design and shared with Trajectory/Hit Probability. The
// active rifle profile itself is *not* owned here — it stays
// shot-state.js's, changing only via Guns, same as every other tool.
//
// One cookie, four named sub-slices, same "read once at module load, one
// save writes the whole thing back" shape shot-state.js's own gun cookie
// uses — each save merges into whatever's already there so touching one
// slice never clobbers the others.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_range_solver_state_v1';

function load() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (raw) return JSON.parse(raw);
  } catch {
    // malformed cookie — fall through to defaults
  }
  return { target: null, wind: null, atmosphere: null, location: null };
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

// The active location/target picked in Range Solver's Target tab — a
// pointer ({ locationId, targetId }), not a snapshot, so an edit to the
// location/target afterward (in the Locations manager) is always
// reflected; resolved fresh against location-library.js on every mount
// (see range-solver-view.js), with a stale pointer (a deleted location or
// target) simply falling back to "no location selected" there rather than
// needing any cleanup here.
export function loadRangeSolverLocationState() {
  return state.location;
}

export function saveRangeSolverLocationState(partial) {
  state = { ...state, location: { ...state.location, ...partial } };
  persist();
}

// Session-only, in-memory, deliberately NOT cookie-backed (unlike every
// slice above) — same "intentionally not persisted" idiom shot-state.js
// uses for its own atmosphereState. Tracks whether the user has hand-
// edited Range Solver's Atmosphere tab since this page was last loaded,
// so "Set active" on a location with an altitude (see locations-view.js)
// knows whether it's still safe to default the atmosphere fields for
// them, or whether they've since taken over that tab themselves. Resets
// to false on an actual reload (a fresh module load), by design.
let atmosphereTouchedThisSession = false;

export function markAtmosphereTouched() {
  atmosphereTouchedThisSession = true;
}

export function wasAtmosphereTouchedThisSession() {
  return atmosphereTouchedThisSession;
}

export function resetRangeSolverStateForTests() {
  state = { target: null, wind: null, atmosphere: null, location: null };
  atmosphereTouchedThisSession = false;
}
