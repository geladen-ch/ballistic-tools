// Persisted input state for the Hit Probability tool — cookie-backed
// (survives navigation and an app restart), same one-slice shape
// trajectory-state.js uses. Covers every Uncertainty/Simulation panel
// field, the target picker selection, and the illustration's zoom/
// "Impacts to scale" — everything hit-probability-view.js's own
// panelState holds. Rifle/cartridge/atmosphere are deliberately NOT here:
// those are the shared active gun configuration and already persist on
// their own via shot-state.js.
import { decodeFieldValues } from './legacy-units.js';
import { loadVersionedCookie, saveCookieState } from './versioned-cookie.js';

// Keyed by field id, each value in its field's engine unit (SI, see
// units.js's FIELD_UNITS). In v1 the same keys held other units (cm, mrad,
// hPa, percent) -- converted once on first load, key by key, through
// legacy-units.js's frozen table, never through the live FIELD_UNITS.
const COOKIE_NAME = 'ballistics_hit_probability_state_v2';
const LEGACY_COOKIE_NAME = 'ballistics_hit_probability_state_v1';

function load() {
  return loadVersionedCookie({ name: COOKIE_NAME, legacyName: LEGACY_COOKIE_NAME, fromLegacy: decodeFieldValues });
}

function persist() {
  saveCookieState(COOKIE_NAME, state);
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
