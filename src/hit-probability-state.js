// Persisted input state for the Hit Probability tool — cookie-backed
// (survives navigation and an app restart), same one-slice shape
// trajectory-state.js uses. Covers every Uncertainty/Simulation panel
// field, the target picker selection, and the illustration's zoom/
// "Impacts to scale" — everything hit-probability-view.js's own
// panelState holds. Rifle/cartridge/atmosphere are deliberately NOT here:
// those are the shared active gun configuration and already persist on
// their own via shot-state.js.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_hit_probability_state_v1';

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

export function loadHitProbabilityState() {
  return state;
}

export function saveHitProbabilityState(partial) {
  state = { ...state, ...partial };
  persist();
}

export function resetHitProbabilityStateForTests() {
  state = null;
}
