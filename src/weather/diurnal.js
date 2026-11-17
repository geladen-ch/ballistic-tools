// Sun-angle temperature time correction: moves a station's temperature from its report time to "now" along a
// Parton–Logan diurnal curve. Pure; needs no data. Not atmosphere physics, so it is kept apart from atmosphere.js.
// Latitudes are radians; hours inside the model are the model's own clock time (hours of the solar day).
import { degToRad, radToDeg } from '../quantity.js';

/** Amplitude A0 (K) by mean |latitude| of 10° bands (radians), fitted on a year of hourly reports. Interpolated linearly. */
export const DIURNAL_A0 = Object.freeze([
  [5.0, 6.8], [15.5, 8.0], [26.1, 9.5], [35.4, 12.4], [43.9, 12.4], [54.2, 9.5], [63.8, 9.4], [71.8, 6.3],
].map(([latDeg, a0]) => Object.freeze([degToRad(latDeg), a0])));

/** Parton–Logan shape constants refitted on a year of hourly reports (published: a 1.86 h, b 2.2, c −0.17 h). */
export const DIURNAL_SHAPE = Object.freeze({ a: 1.4, b: 3.0, c: 0.5 });

// The model's own calendar and clock constants (Cooper declination, equation of time, solar-day clock).
const OBLIQUITY_RAD = degToRad(23.44);
const DAY_MS = 86400000, HOURS_PER_DAY = 24, MINUTES_PER_HOUR = 60, SECONDS_PER_MINUTE = 60;
const MINUTES_OF_TIME_PER_RAD_LON = 4 * radToDeg(1);   // the sun crosses 1° of longitude in 4 minutes

/** A0(|φ|), K: linear interpolation in the table; end values outside it. absLatRad in radians. */
export function diurnalA0(absLatRad) {
  const t = DIURNAL_A0;
  if (absLatRad <= t[0][0]) return t[0][1];
  if (absLatRad >= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 1; i < t.length; i++) {
    if (absLatRad <= t[i][0]) return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * (absLatRad - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
  }
  return t[t.length - 1][1];
}

/**
 * Temperature change expected between the report time and now at a station, from the sun angle alone.
 * @param {number} latRad  station latitude
 * @param {number} lonRad  station longitude
 * @param {Date} tReport   report time
 * @param {Date} tNow      now (device clock)
 * @returns {{dT:number, A0?:number, A?:number, dayLengthH?:number, sReport?:number, sNow?:number}}
 *   dT in K (a temperature difference), to be added to the reported temperature. 0 when now ≤ report time.
 */
export function diurnalCorrection(latRad, lonRad, tReport, tNow, { a, b, c } = DIURNAL_SHAPE) {
  if (!(tNow > tReport)) return { dT: 0 };
  const doy = 1 + (tReport - Date.UTC(tReport.getUTCFullYear(), 0, 1)) / DAY_MS;
  const dec = OBLIQUITY_RAD * Math.sin(2 * Math.PI * (284 + doy) / 365);              // Cooper (1969)
  const x = -Math.tan(latRad) * Math.tan(dec);
  const Y = x <= -1 ? 24 : x >= 1 ? 0 : (24 / Math.PI) * Math.acos(x);               // day length, h
  const A0 = diurnalA0(Math.abs(latRad));
  const A = A0 * Math.sin(Math.max(0, Math.PI / 2 - Math.abs(latRad - dec)));        // × sin(noon elevation)
  const B = 2 * Math.PI * (doy - 81) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);       // equation of time, min
  const tau = (t) => ((((t.getUTCHours() * MINUTES_PER_HOUR + t.getUTCMinutes() + t.getUTCSeconds() / SECONDS_PER_MINUTE
    + MINUTES_OF_TIME_PER_RAD_LON * lonRad + eot) / MINUTES_PER_HOUR) % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  const S = (h) => {
    if (Y <= 0.01 || Y >= 23.99) return 0;                                            // polar night / day: no cycle
    const r = 12 - Y / 2, s = 12 + Y / 2, m0 = r + c;
    if (h >= m0 && h <= s) return Math.sin(Math.PI * (h - m0) / (Y + 2 * a));
    const n = h > s ? h - s : h + 24 - s;                                             // hours since sunset
    return Math.sin(Math.PI * (Y - c) / (Y + 2 * a)) * Math.exp(-b * n / (24 - Y));
  };
  const sR = S(tau(tReport)), sN = S(tau(tNow));
  return { dT: A * (sN - sR), A0, A, dayLengthH: Y, sReport: sR, sNow: sN };
}
