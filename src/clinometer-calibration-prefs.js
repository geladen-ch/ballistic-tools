// The camera clinometer's calibration (see ui/angle-meter/calibration.js)
// — a property of this one phone, so a cookie, never part of a backup or
// a sync to another device. SI throughout: the three bias terms in
// radians, the date as an ISO string.
import { getCookie, setCookie, removeCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_clinometer_calibration_v1';

export function getClinometerCalibration() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const { bias0Rad, biasCosRad, biasSinRad } = parsed || {};
    if (![bias0Rad, biasCosRad, biasSinRad].every(Number.isFinite)) return null;
    return { bias0Rad, biasCosRad, biasSinRad, calibratedAt: typeof parsed.calibratedAt === 'string' ? parsed.calibratedAt : null };
  } catch {
    return null; // malformed — treated as not calibrated
  }
}

export function setClinometerCalibration({ bias0Rad, biasCosRad, biasSinRad }, calibratedAt = new Date().toISOString()) {
  try {
    setCookie(COOKIE_NAME, JSON.stringify({ bias0Rad, biasCosRad, biasSinRad, calibratedAt }));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

export function clearClinometerCalibration() {
  try {
    removeCookie(COOKIE_NAME);
  } catch {
    // best-effort
  }
}
