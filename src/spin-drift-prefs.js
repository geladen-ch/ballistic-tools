// Cookie-backed choice of spin-drift calculation method — 'off' | 'litz' |
// 'mccoy4dof' (see engine/spin-drift.js's resolveSpinDriftMode(), which
// every windage-computing tool feeds this via state.spinDriftMode, with
// automatic fallback to 'litz' then 'off' when the chosen method isn't
// actually computable from the current bullet/rifle data). Same
// enum-choice shape as range-solver-prefs.js's INDICATOR_STYLE_CHOICES /
// wind-dial-prefs.js's WIND_DIAL_APPEARANCE_CHOICES — a validated cookie
// read fresh on every call, no in-memory cache. Defaults **off** — spin
// drift is an optional refinement, not something every fresh install
// should suddenly see baked into its windage numbers.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_spin_drift_mode_v1';
// Pre-mode-selector cookie (a plain on/off toggle, no method choice) —
// read once below to migrate anyone who'd already turned it on to
// 'litz' (the only method that toggle could ever have meant, since
// mccoy4dof didn't exist yet), never written to again.
const LEGACY_ENABLED_COOKIE_NAME = 'ballistics_spin_drift_enabled_v1';

export const SPIN_DRIFT_MODE_CHOICES = [
  { value: 'off', labelKey: 'settings.spinDriftOff' },
  { value: 'litz', labelKey: 'settings.spinDriftLitz' },
  { value: 'mccoy4dof', labelKey: 'settings.spinDriftMccoy4dof' }
];

function defaultMode() {
  return getCookie(LEGACY_ENABLED_COOKIE_NAME) === 'true' ? 'litz' : 'off';
}

export function getSpinDriftMode() {
  const raw = getCookie(COOKIE_NAME);
  // No cookie at all (never saved under the new name) falls back to the
  // legacy boolean's migration above; an explicitly saved value is
  // trusted only if it's still one of the three known modes — a
  // corrupted/tampered cookie falls back to 'off' rather than being
  // trusted verbatim, same as every other validated choice cookie in
  // this app.
  if (raw === null) return defaultMode();
  return SPIN_DRIFT_MODE_CHOICES.some((c) => c.value === raw) ? raw : 'off';
}

export function setSpinDriftMode(mode) {
  if (!SPIN_DRIFT_MODE_CHOICES.some((c) => c.value === mode)) return;
  try {
    setCookie(COOKIE_NAME, mode);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}
