// Coordinate text and plausibility, kept apart from the GPS code (and its geoid table) so a form can use them cheaply.
// Positions are radians; the text is what people type, in degrees.
import { degToRad } from '../quantity.js';

const MINUTES_PER_DEGREE = 60, SECONDS_PER_DEGREE = 3600;
const MAX_LAT_RAD = Math.PI / 2, MAX_LON_RAD = Math.PI;

/** Is this a plausible geodetic position (finite, latitude within ±90°, longitude within ±180°, not exactly 0, 0)? */
export function isValidPosition(latRad, lonRad) {
  return Number.isFinite(latRad) && Number.isFinite(lonRad)
    && Math.abs(latRad) <= MAX_LAT_RAD && Math.abs(lonRad) <= MAX_LON_RAD
    && !(latRad === 0 && lonRad === 0);
}

/**
 * Parse "47.37, 8.54", "47.37 8.54", "47.37N 8.54E", "47°22'N 8°32'E" style input.
 * @returns {{latRad:number, lonRad:number}|null}
 */
export function parseLatLon(text) {
  if (!text) return null;
  const parts = [];
  const re = /([+-]?\d+(?:[.,]\d+)?)\s*°?\s*(?:(\d+(?:[.,]\d+)?)\s*['′]\s*)?(?:(\d+(?:[.,]\d+)?)\s*["″]\s*)?([NSEWnsew])?/g;
  let m;
  while ((m = re.exec(text)) && parts.length < 2) {
    if (m[0].trim() === '') { re.lastIndex++; continue; }
    const f = (s) => (s ? Number(s.replace(',', '.')) : 0);
    let v = Math.abs(f(m[1])) + f(m[2]) / MINUTES_PER_DEGREE + f(m[3]) / SECONDS_PER_DEGREE;   // degrees
    if (m[1].startsWith('-')) v = -v;
    const h = m[4]?.toUpperCase();
    if (h === 'S' || h === 'W') v = -Math.abs(v);
    parts.push({ v, h });
  }
  if (parts.length !== 2) return null;
  let [a, b] = parts;
  if (a.h === 'E' || a.h === 'W' || b.h === 'N' || b.h === 'S') [a, b] = [b, a];
  const latRad = degToRad(a.v), lonRad = degToRad(b.v);
  if (!(Math.abs(latRad) <= MAX_LAT_RAD && Math.abs(lonRad) <= MAX_LON_RAD)) return null;
  return { latRad, lonRad };
}
