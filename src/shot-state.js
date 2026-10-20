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
import { removeCookie } from './cookies.js';
import { decodeLegacy, clickSettingsFromStored } from './legacy-units.js';
import { loadVersionedCookie, saveCookieState } from './versioned-cookie.js';

// Stored in SI, as held in memory; v1 (sight height and twist in mm,
// click sizes in the turret's unit) is converted once on first load.
const GUN_COOKIE_NAME = 'ballistics_gun_state_v2';
const LEGACY_GUN_COOKIE_NAME = 'ballistics_gun_state_v1';

function gunStateFromV1(stored) {
  const rifle = decodeLegacy(stored.rifle ?? null);
  if (rifle && rifle.clicks) rifle.clicks = clickSettingsFromStored(rifle.clicks);
  return { cartridge: decodeLegacy(stored.cartridge ?? null), rifle };
}

function loadGunCookie() {
  const stored = loadVersionedCookie({ name: GUN_COOKIE_NAME, legacyName: LEGACY_GUN_COOKIE_NAME, fromLegacy: gunStateFromV1 });
  return { cartridge: stored?.cartridge ?? null, rifle: stored?.rifle ?? null };
}

function saveGunCookie() {
  saveCookieState(GUN_COOKIE_NAME, { cartridge: cartridgeState, rifle: rifleState });
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
    removeCookie(LEGACY_GUN_COOKIE_NAME);
  } catch {
    // best-effort
  }
}
