// Cookie-backed on/off switch for spin drift (see Settings, and
// spin-drift.js's own resolveSpinDrift(), which reads this as part of the
// engine state rather than calling this module directly — see the callers
// in each tool view). Its own tiny module, same reasoning as
// library-prefs.js. Unlike the library toggles (default on), this
// defaults **off** — spin drift is an optional refinement, not something
// every fresh install should suddenly see baked into its windage numbers.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_spin_drift_enabled_v1';

export function isSpinDriftEnabled() {
  return getCookie(COOKIE_NAME) === 'true';
}

export function setSpinDriftEnabled(enabled) {
  try {
    setCookie(COOKIE_NAME, String(!!enabled));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}
