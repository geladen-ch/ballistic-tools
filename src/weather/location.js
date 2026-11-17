// Location input: manual coordinates, device geolocation, GPS altitude averaging. Positions are radians, heights and
// accuracies metres. The browser's Geolocation API speaks degrees; they are converted here, once, at that boundary.
import { degToRad } from '../quantity.js';
import { geoidN } from './geoid.js';

export { parseLatLon, isValidPosition } from './coordinates.js';

export const geolocationAvailable = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;

/** Code for a GeolocationPositionError (or any error); the UI translates it. */
export function geoErrorCode(e) {
  switch (e?.code) {
    case 1: return 'denied';
    case 2: return 'unavailable';
    case 3: return 'timeout';
    default: return e?.notSupported ? 'notSupported' : 'other';
  }
}

/**
 * Location and altitude in one GPS run (one command in the UI). Watches the position for durationMs: the position is
 * the fix with the best horizontal accuracy; the altitude is averaged: fixes with null altitude or altitudeAccuracy
 * (or accuracy above maxSigmaM) are dropped; weighted mean with 1/σ²; σ reported as the median σ of the fixes used
 * (GNSS vertical errors are time-correlated, so averaging does not reduce σ by √n); the geoid correction is applied
 * once, to the averaged ellipsoidal height, at that position. `altitude` is null if the device reports none.
 * Resolves as soon as the run ends (timer or cancel) with at least one position fix; rejects otherwise.
 * onFix({position:{latRad, lonRad, accuracyM}, count, usable, estimate}) after every fix.
 * @returns {{promise:Promise<{position:{latRad:number, lonRad:number, accuracyM:number}, altitude:object|null}>, cancel:()=>void}}
 */
export function locateGps({ durationMs = 45000, maxSigmaM = 50, onFix = () => {}, geolocation = globalThis.navigator?.geolocation } = {}) {
  let watchId = null, timer = null, finish;
  const fixes = [];
  let best = null, lastErr = null;
  const promise = new Promise((resolve, reject) => {
    if (!geolocation) return reject(Object.assign(new Error('Geolocation is not available in this browser'), { notSupported: true }));
    finish = () => {
      if (watchId != null) geolocation.clearWatch(watchId);
      clearTimeout(timer);
      watchId = null;
      if (!best) return reject(lastErr ?? new Error('No position fix'));
      resolve({ position: positionOf(best), altitude: summarise(fixes, best) });
    };
    watchId = geolocation.watchPosition((pos) => {
      if (!best || pos.coords.accuracy <= best.coords.accuracy) best = pos;
      const { altitude, altitudeAccuracy } = pos.coords;
      const usable = altitude != null && altitudeAccuracy != null && altitudeAccuracy <= maxSigmaM;
      if (usable) fixes.push({ h: altitude, sigma: Math.max(altitudeAccuracy, 0.5) });
      onFix({ position: positionOf(best), count: fixes.length, usable, estimate: summarise(fixes, best) });
    }, (e) => { lastErr = e; if (e.code === 1) finish(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: durationMs });
    timer = setTimeout(finish, durationMs);
  });
  return { promise, cancel: () => finish?.() };
}
const positionOf = (pos) => ({ latRad: degToRad(pos.coords.latitude), lonRad: degToRad(pos.coords.longitude), accuracyM: pos.coords.accuracy });

function summarise(fixes, pos) {
  if (!fixes.length || !pos) return null;
  let sw = 0, swh = 0;
  for (const f of fixes) { const w = 1 / f.sigma ** 2; sw += w; swh += w * f.h; }
  const ellipsoidalM = swh / sw;
  const sig = fixes.map((f) => f.sigma).sort((a, b) => a - b);
  const sigmaM = sig[Math.floor(sig.length / 2)];
  const { latRad, lonRad } = positionOf(pos);
  const undulationM = geoidN(latRad, lonRad);
  return { ellipsoidalM, undulationM, heightM: ellipsoidalM - undulationM, sigmaM, count: fixes.length, latRad, lonRad };
}
