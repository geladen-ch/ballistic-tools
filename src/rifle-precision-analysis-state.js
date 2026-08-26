// Persisted input state for the Rifle Precision Calculator's analysis view
// (results display units, every Numbers-table "show on image" toggle, the
// Image options section's own checkboxes/grid/hit-probability slider) —
// cookie-backed (survives navigation and an app restart), same
// single-flat-object/null-default shape trajectory-state.js uses. These are
// view-local display settings, not part of a specific project, so a fresh
// project opened in this view picks up whatever was last set here.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_rifle_precision_analysis_state_v1';

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

export function loadRiflePrecisionAnalysisState() {
  return state;
}

export function saveRiflePrecisionAnalysisState(partial) {
  state = { ...state, ...partial };
  persist();
}

export function resetRiflePrecisionAnalysisStateForTests() {
  state = null;
}
