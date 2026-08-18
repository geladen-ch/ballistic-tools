// Cookie-backed on/off switch for whether the horizontal zero solve
// compensates for spin drift (see trajectory.js's solveHorizontalZeroAngle())
// — a second, more specific opt-in layered on top of spin-drift-prefs.js's
// own "calculate spin drift at all" switch: this one only ever matters
// (and is only ever shown in Settings) while that one is on, since with
// spin drift off there's nothing here to zero out. Its own tiny module,
// same reasoning as spin-drift-prefs.js itself. Defaults **off**, same
// "opt-in to a real numbers change" posture as spin drift's own default —
// silently shifting the bore's horizontal aim changes windage at every
// range, not just the zero range, so a shooter who just turned spin drift
// on to *see* it shouldn't also have their zero move without asking.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_zero_for_spin_drift_enabled_v1';

export function isZeroForSpinDriftEnabled() {
  return getCookie(COOKIE_NAME) === 'true';
}

export function setZeroForSpinDriftEnabled(enabled) {
  try {
    setCookie(COOKIE_NAME, String(!!enabled));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}
