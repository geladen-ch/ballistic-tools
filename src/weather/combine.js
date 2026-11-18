// Multi-station combination. Pure: no I/O and no atmosphere code. Values arrive already time-corrected (temperature)
// and converted to the device height. Lengths in metres, pressures in Pa, humidity a fraction.
//
// Weights: stations close to each other carry partly the same information, and a station behind a nearer one in the
// same direction adds little. Ordinary kriging weights account for both, from the distances between the stations
// as well as their distances to the device. Beyond about 100 km to the nearest station kriging has nothing to gain
// (and can be worse when all stations are far apart and dissimilar), so the inverse-distance weights stay there.
import { kmToM } from '../quantity.js';
import { haversineM } from './geo.js';

/** Normative parameters, validated worldwide on a year of hourly reports. */
export const COMBINE_DEFAULTS = Object.freeze({
  lambda: 200,                 // d_eff = √(d² + (λ·Δh)²), d and Δh in the same length unit: 100 m of height counts like 20 km
  k: 8,                        // neighbours per quantity, by d_eff
  power: 1.5,                  // w = 1 / max(d_eff, 100 m)^power
  tauMin: Object.freeze({ t: 5, p: 300 }),   // buddy-check floor (K, Pa); quantities without one are not checked
  madK: 7,                     // threshold = max(tauMin, madK · 1.4826 · MAD)
  minBuddies: 3,               // no check with fewer neighbours
  minDeffM: kmToM(0.1),
  method: 'kriging',           // 'kriging' or 'idw'; 'idw' gives the plain inverse-distance weights (tests, comparison)
  krigeRangeM: kmToM(200),     // correlation length L of the exponential covariance, in the same metric as d_eff
  krigeNugget: 0.1,            // share of a station's variance that no other station shares; keeps the system well conditioned
  krigeMaxNearestM: kmToM(100), // inverse-distance weights when even the nearest contributor is farther than this (d_eff)
});

/** Median; mean of the two middle values for an even count. */
export function median(xs) {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/**
 * Solve A·x = b by Gaussian elimination with partial pivoting. Inputs are not modified.
 * @param {number[][]} A  square matrix
 * @param {number[]} b
 * @returns {number[]|null}  null when a pivot is below about 1e-12 or a result is not finite
 */
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (!(Math.abs(M[piv][col]) >= 1e-12)) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      if (f) for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x.every(Number.isFinite) ? x : null;
}

/**
 * Ordinary kriging weights of the contributors for the device position.
 * Covariance is exponential in the separation metric of d_eff: between stations (1 − nugget)·exp(−s/L) with
 * s = √(d² + (λ·Δh)²) and 1 on the diagonal, to the device (1 − nugget)·exp(−d_eff/L). Negative weights are set to
 * zero and the rest renormalised.
 * @param {{deffM:number, hM:number, latRad:number, lonRad:number}[]} use  contributors with their d_eff
 * @param {object} [opts]  overrides of COMBINE_DEFAULTS
 * @returns {number[]|null}  weights summing to 1, or null when the solve fails
 */
export function krigingWeights(use, opts = {}) {
  const o = { ...COMBINE_DEFAULTS, ...opts };
  const n = use.length;
  const rho = 1 - o.krigeNugget;
  const A = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  const b = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) { A[i][j] = 1; continue; }
      const d = haversineM(use[i].latRad, use[i].lonRad, use[j].latRad, use[j].lonRad);
      const s = Math.hypot(d, o.lambda * (use[i].hM - use[j].hM));
      A[i][j] = rho * Math.exp(-s / o.krigeRangeM);
    }
    A[i][n] = 1;
    A[n][i] = 1;
    b[i] = rho * Math.exp(-use[i].deffM / o.krigeRangeM);
  }
  b[n] = 1;
  const x = solveLinear(A, b);
  if (!x) return null;
  const w = x.slice(0, n).map((v) => Math.max(0, v));
  const sw = w.reduce((s, v) => s + v, 0);
  if (!(sw > 0)) return null;
  const out = w.map((v) => v / sw);
  return out.every(Number.isFinite) ? out : null;
}

/**
 * Combine one quantity from several stations.
 * @template {{distanceM:number, hM:number, value:number, latRad?:number, lonRad?:number}} C
 * @param {C[]} cands   distanceM horizontal distance; hM station height (m a.s.l.; pass the device height when
 *                      unknown and the quantity needs no height, e.g. RH); value at the device height;
 *                      latRad/lonRad station position (radians), needed for kriging weights
 * @param {number} deviceHeightM device height, m a.s.l.
 * @param {'t'|'p'|'rh'} q quantity key for the buddy-check floor
 * @returns {{value:number|null,
 *   used:(C & {deffM:number, weight:number})[],
 *   rejected:(C & {deffM:number, deviation:number, threshold:number})[],
 *   check:{median:number, mad:number, threshold:number}|null, considered:number, candidates:number,
 *   method:'kriging'|'idw', fallback:null|'far'|'noPosition'|'solver'}}  fallback says why inverse-distance weights
 *   were used instead of kriging (null: not a fallback, e.g. a single station or method 'idw' asked for)
 */
export function combine(cands, deviceHeightM, q, opts = {}) {
  const o = { ...COMBINE_DEFAULTS, ...opts, tauMin: { ...COMBINE_DEFAULTS.tauMin, ...opts.tauMin } };
  const nb = cands
    .filter((c) => Number.isFinite(c.value) && Number.isFinite(c.distanceM) && Number.isFinite(c.hM))
    .map((c) => ({ ...c, deffM: Math.hypot(c.distanceM, o.lambda * (c.hM - deviceHeightM)) }))
    .sort((a, b) => a.deffM - b.deffM)
    .slice(0, o.k);
  const out = { value: null, used: [], rejected: [], check: null, considered: nb.length, candidates: cands.length, method: 'idw', fallback: null };
  if (!nb.length) return out;

  let use = nb;
  const tau = o.tauMin[q];
  if (tau != null && nb.length >= o.minBuddies) {
    const m = median(nb.map((c) => c.value));
    const mad = median(nb.map((c) => Math.abs(c.value - m)));
    const threshold = Math.max(tau, o.madK * 1.4826 * mad);
    out.check = { median: m, mad, threshold };
    use = nb.filter((c) => Math.abs(c.value - m) <= threshold);
    out.rejected = nb.filter((c) => !use.includes(c)).map((c) => ({ ...c, deviation: c.value - m, threshold }));
  }

  let kriged = null;
  if (o.method === 'kriging' && use.length > 1) {
    if (use[0].deffM > o.krigeMaxNearestM) out.fallback = 'far';
    else if (!use.every((c) => Number.isFinite(c.latRad) && Number.isFinite(c.lonRad))) out.fallback = 'noPosition';
    else {
      kriged = krigingWeights(use, o);
      if (kriged) out.method = 'kriging';
      else out.fallback = 'solver';
    }
  }
  if (kriged) {
    out.value = use.reduce((s, c, i) => s + kriged[i] * c.value, 0);
    out.used = use.map((c, i) => ({ ...c, weight: kriged[i] }));
    return out;
  }
  const w = use.map((c) => 1 / Math.max(c.deffM, o.minDeffM) ** o.power);
  const sw = w.reduce((s, x) => s + x, 0);
  out.value = use.reduce((s, c, i) => s + w[i] * c.value, 0) / sw;
  out.used = use.map((c, i) => ({ ...c, weight: w[i] / sw }));
  return out;
}
