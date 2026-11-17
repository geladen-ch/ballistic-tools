// Multi-station combination. Pure: no I/O and no atmosphere code. Values arrive already time-corrected (temperature)
// and converted to the device height. Lengths in metres, pressures in Pa, humidity a fraction.
import { kmToM } from '../quantity.js';

/** Normative parameters, validated worldwide on a year of hourly reports. */
export const COMBINE_DEFAULTS = Object.freeze({
  lambda: 200,                 // d_eff = √(d² + (λ·Δh)²), d and Δh in the same length unit: 100 m of height counts like 20 km
  k: 8,                        // neighbours per quantity, by d_eff
  power: 1.5,                  // w = 1 / max(d_eff, 100 m)^power
  tauMin: Object.freeze({ t: 5, p: 300 }),   // buddy-check floor (K, Pa); quantities without one are not checked
  madK: 7,                     // threshold = max(tauMin, madK · 1.4826 · MAD)
  minBuddies: 3,               // no check with fewer neighbours
  minDeffM: kmToM(0.1),
});

/** Median; mean of the two middle values for an even count. */
export function median(xs) {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/**
 * Combine one quantity from several stations.
 * @template {{distanceM:number, hM:number, value:number}} C
 * @param {C[]} cands   distanceM horizontal distance; hM station height (m a.s.l.; pass the device height when
 *                      unknown and the quantity needs no height, e.g. RH); value at the device height
 * @param {number} deviceHeightM device height, m a.s.l.
 * @param {'t'|'p'|'rh'} q quantity key for the buddy-check floor
 * @returns {{value:number|null,
 *   used:(C & {deffM:number, weight:number})[],
 *   rejected:(C & {deffM:number, deviation:number, threshold:number})[],
 *   check:{median:number, mad:number, threshold:number}|null, considered:number, candidates:number}}
 */
export function combine(cands, deviceHeightM, q, opts = {}) {
  const o = { ...COMBINE_DEFAULTS, ...opts, tauMin: { ...COMBINE_DEFAULTS.tauMin, ...opts.tauMin } };
  const nb = cands
    .filter((c) => Number.isFinite(c.value) && Number.isFinite(c.distanceM) && Number.isFinite(c.hM))
    .map((c) => ({ ...c, deffM: Math.hypot(c.distanceM, o.lambda * (c.hM - deviceHeightM)) }))
    .sort((a, b) => a.deffM - b.deffM)
    .slice(0, o.k);
  const out = { value: null, used: [], rejected: [], check: null, considered: nb.length, candidates: cands.length };
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

  const w = use.map((c) => 1 / Math.max(c.deffM, o.minDeffM) ** o.power);
  const sw = w.reduce((s, x) => s + x, 0);
  out.value = use.reduce((s, c, i) => s + w[i] * c.value, 0) / sw;
  out.used = use.map((c, i) => ({ ...c, weight: w[i] / sw }));
  return out;
}
