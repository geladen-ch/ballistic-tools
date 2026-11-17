// Geoid undulation N(lat, lon) from the built-in spherical-harmonic series. Orthometric height H = h_ellipsoid − N.
// Positions are radians (geodetic latitude), the result is in metres.
import { L as TABLE_L, coefficientsBase64, source } from './geoid-sh.js';

export const geoidSource = source;
let table = null;

function decode(b64) {
  const bin = atob(b64);
  const dv = new DataView(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
  const out = new Float64Array(bin.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = dv.getFloat32(4 * i, true);
  return out;
}

/**
 * Evaluate N = Σ P̄nm(cos θ)(Cnm cos mλ + Snm sin mλ), θ = π/2 − geodetic latitude.
 * coef layout: C block (n, 0≤m≤n) at n(n+1)/2+m, then S block (n≥1, 1≤m≤n) at nC + n(n−1)/2 + m−1.
 */
export function evaluateSeries(coef, L, latRad, lonRad) {
  const t = Math.PI / 2 - latRad, x = Math.cos(t), s = Math.sin(t);
  const lam = lonRad, nC = (L + 1) * (L + 2) / 2;
  let N = 0, pmm = 1;
  for (let m = 0; m <= L; m++) {
    if (m === 1) pmm = Math.sqrt(3) * s;
    else if (m > 1) pmm *= Math.sqrt((2 * m + 1) / (2 * m)) * s;
    const cm = Math.cos(m * lam), sm = Math.sin(m * lam);
    let p2 = 0, p1 = pmm;
    for (let n = m; n <= L; n++) {
      let p;
      if (n === m) p = pmm;
      else if (n === m + 1) p = Math.sqrt(2 * m + 3) * x * pmm;
      else {
        const a = Math.sqrt((2 * n - 1) * (2 * n + 1) / ((n - m) * (n + m)));
        const b = Math.sqrt((2 * n + 1) * (n + m - 1) * (n - m - 1) / ((n - m) * (n + m) * (2 * n - 3)));
        p = a * x * p1 - b * p2;
      }
      const c = coef[n * (n + 1) / 2 + m];
      N += p * (m ? c * cm + coef[nC + n * (n - 1) / 2 + m - 1] * sm : c);
      if (n > m) { p2 = p1; p1 = p; } else { p1 = p; p2 = 0; }
    }
  }
  return N;
}

/** Geoid undulation in metres at a geodetic position (radians). */
export function geoidN(latRad, lonRad) {
  if (!table) table = decode(coefficientsBase64);
  return evaluateSeries(table, TABLE_L, latRad, lonRad);
}

/** Convert a WGS84 ellipsoidal height (e.g. Geolocation coords.altitude) to height above mean sea level. */
export function ellipsoidalToOrthometric(ellipsoidalHeightM, latRad, lonRad) {
  return ellipsoidalHeightM - geoidN(latRad, lonRad);
}
