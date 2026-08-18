// Shared state for the shot-setup inputs — cartridge, rifle, atmosphere —
// so switching between tool views (Trajectory Table, Hit Probability, and
// — for atmosphere — BC Estimator) keeps whatever was just entered
// instead of resetting to each view's own hardcoded defaults. Every view
// mounts a fresh set of section instances on every navigation (see
// cartridge-section.js etc.), so this only needs load-once-at-mount /
// save-on-every-change — no cross-view live-reactivity needed, since only
// one view is ever mounted at a time.
//
// cartridge/rifle are cookie-backed (survive a reload/app restart) — this
// is "the active gun configuration" the Guns section centers the whole
// app on now (see guns-view.js), so it has to outlive a session the same
// way a unit preference does (see prefs.js). Atmosphere stays session-
// only/in-memory, same as before — not part of that configuration.
//
// Saves merge into whatever's already stored rather than replacing it
// outright — e.g. BC Estimator's atmosphere has no wind fields, and a
// save from there must not erase a windSpeed/windAngle a wind-aware view
// stored earlier.
import { getCookie, setCookie, removeCookie } from './cookies.js';

const GUN_COOKIE_NAME = 'ballistics_gun_state_v1';

function loadGunCookie() {
  try {
    const raw = getCookie(GUN_COOKIE_NAME);
    if (raw) return JSON.parse(raw);
  } catch {
    // malformed cookie value — fall through to defaults
  }
  return { cartridge: null, rifle: null };
}

function saveGunCookie() {
  try {
    setCookie(GUN_COOKIE_NAME, JSON.stringify({ cartridge: cartridgeState, rifle: rifleState }));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

const initialGunState = loadGunCookie();
let cartridgeState = initialGunState.cartridge;
let rifleState = initialGunState.rifle;
let atmosphereState = null;

export function loadCartridgeState() {
  return cartridgeState;
}

export function saveCartridgeState(partial) {
  cartridgeState = { ...cartridgeState, ...partial };
  saveGunCookie();
}

export function loadRifleState() {
  return rifleState;
}

export function saveRifleState(partial) {
  rifleState = { ...rifleState, ...partial };
  saveGunCookie();
}

export function loadAtmosphereState() {
  return atmosphereState;
}

export function saveAtmosphereState(partial) {
  atmosphereState = { ...atmosphereState, ...partial };
}

// Test-only: resets every slice back to "nothing saved yet" (and clears
// the cookie itself, not just the in-memory mirror of it) — production
// code has no legitimate reason to call this, but tests that construct
// multiple section instances in one process need a clean slate between
// cases, the same way any other cookie-backed state gets removeCookie().
export function resetShotStateForTests() {
  cartridgeState = null;
  rifleState = null;
  atmosphereState = null;
  try {
    removeCookie(GUN_COOKIE_NAME);
  } catch {
    // best-effort
  }
}
