// Where the device is, as the shooter last entered it or the GPS measured it: latitude, longitude and altitude for the
// online weather lookup. Cookie-backed so it survives an app restart, shared by Trajectory's position inputs and Range
// Solver's manual ones. Held in SI like every other state: radians and metres.
//   { latRad, lonRad, altitudeM, altitudeSource: 'manual'|'gps', gps: { accuracyM, sigmaM, fixes, at } | null }
// Each part may be null (unknown). Anything unreadable is dropped on load.
import { getCookie, setCookie } from './cookies.js';
import { FIELD_BOUNDS } from './units.js';
import { isValidPosition } from './weather/coordinates.js';
import { degToRad } from './quantity.js';

const COOKIE_NAME = 'ballistics_device_position_v1';

/**
 * What the weather block's position inputs start with while nothing has been typed or measured on this device yet
 * (a convenience prefill only: it is never stored, and anything the user enters replaces it).
 */
export const DEFAULT_DEVICE_POSITION = Object.freeze({
  latRad: degToRad(47.10723988713254), lonRad: degToRad(8.642444182086091), altitudeM: 730,
});

const EMPTY = Object.freeze({ latRad: null, lonRad: null, altitudeM: null, altitudeSource: 'manual', gps: null });

/** Is this a usable altitude (finite, inside the altitude field's bounds)? */
export const isValidAltitude = (m) => Number.isFinite(m) && m >= FIELD_BOUNDS.altitudeM.min && m <= FIELD_BOUNDS.altitudeM.max;

const finiteOrNull = (v) => (Number.isFinite(v) ? v : null);

function sanitise(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const gps = r.gps && typeof r.gps === 'object' ? {
    accuracyM: finiteOrNull(r.gps.accuracyM), sigmaM: finiteOrNull(r.gps.sigmaM),
    fixes: finiteOrNull(r.gps.fixes), at: finiteOrNull(r.gps.at),
  } : null;
  const latRad = finiteOrNull(r.latRad), lonRad = finiteOrNull(r.lonRad);
  return {
    latRad, lonRad,
    altitudeM: isValidAltitude(r.altitudeM) ? r.altitudeM : null,
    altitudeSource: r.altitudeSource === 'gps' ? 'gps' : 'manual',
    gps,
  };
}

function load() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (raw) return sanitise(JSON.parse(raw));
  } catch {
    // malformed cookie value, or cookies disabled — nothing remembered
  }
  return { ...EMPTY };
}

let state = load();
const listeners = new Set();

export function getDevicePosition() {
  return { ...state };
}

/** Merge a change into the remembered position (and tell the listeners). */
export function setDevicePosition(patch) {
  state = sanitise({ ...state, ...patch });
  try {
    setCookie(COOKIE_NAME, JSON.stringify(state));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
  listeners.forEach((fn) => fn(getDevicePosition()));
}

/** Subscribe to changes; returns the unsubscribe function. */
export function onDevicePositionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Does the state hold a complete, plausible latitude + longitude + altitude? */
export function isCompletePosition(p) {
  return isValidPosition(p?.latRad, p?.lonRad) && isValidAltitude(p?.altitudeM);
}

/** Forget everything (tests). */
export function resetDevicePositionForTests() {
  state = { ...EMPTY };
  listeners.clear();
}
