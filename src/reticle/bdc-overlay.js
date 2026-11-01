// The Range Solver scope view's BDC overlay, worked out: the range each of
// a reticle's BDC marks holds for, and where a crosswind at fractions of a
// reference speed puts the hold on that mark's level. Pure — no DOM, no
// engine call: the caller flies two trajectories — the current head- or
// tailwind with no crosswind, and the same with the reference crosswind
// added — and hands over their sampled points (withReferenceWind).
// Angles in radians,
// y positive down (as reticle/geometry.js), true angles throughout — the
// caller turns them into reticle subtensions for an SFP scope away from
// its calibration zoom.
import { linearToAngleAtRange } from '../quantity.js';

// The crosswinds drawn on each mark's level, as fractions of the
// reference speed: every quarter of it up to one and a half times it,
// from either side (+1 from the right, −1 from the left). The reference
// itself is drawn larger.
export const BDC_WIND_FRACTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5];
export const BDC_WIND_SIDES = [1, -1];
export const isMajorWindFraction = (fraction) => fraction === 1;

// The reference crosswind, a round number in the user's wind speed unit;
// unknown units get the m/s one's number.
const REFERENCE_WIND_SPEED = { 'm/s': 4, 'km/h': 10, mph: 10, 'ft/s': 10 };
export function referenceWindSpeed(unit) {
  return REFERENCE_WIND_SPEED[unit] ?? REFERENCE_WIND_SPEED['m/s'];
}

// The levels of a reticle's BDC marks (reticle subtensions, y positive
// down), top to bottom, each once.
export function bdcLevels(elements) {
  const levels = (elements || []).filter((e) => e.type === 'bdc' && Number.isFinite(e.y)).map((e) => e.y);
  return [...new Set(levels)].sort((a, b) => a - b);
}

// A sampled trajectory (engine/trajectory.js integrate()'s points) as the
// hold for each range: `elevation` the correction to dial up (the point is
// held that far below the centre), `x` where the point is held across
// (the windage correction turned round, as sight-picture.js's aimAngle).
// The muzzle row, with no angle, is left out.
export function holdTable(points) {
  const table = { range: [], elevation: [], x: [] };
  for (const p of points || []) {
    if (!(p.range > 0) || !Number.isFinite(p.dropM) || !Number.isFinite(p.windageM)) continue;
    table.range.push(p.range);
    table.elevation.push(-linearToAngleAtRange(p.dropM, p.range));
    table.x.push(-linearToAngleAtRange(p.windageM, p.range));
  }
  return table;
}

// `still` with `xPerWind`, how far across a crosswind from the right moves
// the hold per m/s: the difference from `reference`, the same flight with
// a crosswind of `speed` m/s from the right added. A crosswind's drift is
// linear in its speed and the same either way to well under a hundredth
// of a click, with every spin drift method; the holds for the other
// crosswinds are scaled and mirrored from it.
export function withReferenceWind(still, reference, speed) {
  const xPerWind = still.range.map((r, i) => {
    const x = holdXAt(reference, r);
    return x === null ? NaN : (x - still.x[i]) / speed;
  });
  return { ...still, xPerWind };
}

// The range at which the table's elevation reaches `elevationRad`, on the
// far side of its lowest elevation (where the bullet rises highest above
// the sight line): a mark holds for a range downrange of that, never for
// the few metres in front of the muzzle where the bullet is still
// climbing to the sight line. null when the table never gets there.
export function rangeForElevation(table, elevationRad) {
  const { range, elevation } = table;
  if (!range.length || !Number.isFinite(elevationRad)) return null;
  let low = 0;
  for (let i = 1; i < elevation.length; i++) if (elevation[i] < elevation[low]) low = i;
  if (elevationRad < elevation[low]) return null;
  if (elevationRad === elevation[low]) return range[low];
  for (let i = low + 1; i < elevation.length; i++) {
    if (elevation[i] >= elevationRad) {
      const f = (elevationRad - elevation[i - 1]) / (elevation[i] - elevation[i - 1]);
      return range[i - 1] + f * (range[i] - range[i - 1]);
    }
  }
  return null;
}

// The table's hold across at `rangeM` (or another of its per-range
// columns, `column`), interpolated; null outside it or where unknown.
export function holdXAt(table, rangeM, column = 'x') {
  const { range } = table;
  const x = table[column];
  const n = range.length;
  if (!x || !n || !(rangeM >= range[0]) || !(rangeM <= range[n - 1])) return null;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (range[mid] <= rangeM) lo = mid; else hi = mid;
  }
  const value = hi === lo ? x[lo] : x[lo] + (rangeM - range[lo]) / (range[hi] - range[lo]) * (x[hi] - x[lo]);
  return Number.isFinite(value) ? value : null;
}

// One row per BDC level the trajectory reaches: { level, rangeM, x, winds:
// [{ fraction, side, major, x }] }. `still` is the hold table without
// crosswind, its xPerWind filled; `referenceSpeed` the reference
// crosswind in m/s. `factor` is the
// true angle a unit of reticle subtension is worth (sight-picture.js's
// subtensionFactor: 1 but for SFP away from its calibration zoom).
// `dialedElevationRad` is what is already on the turret — the reticle
// centre then holds for the range that elevation is right for, and each
// mark for that elevation plus its own; 0 when nothing is dialed.
export function bdcOverlay({ levels, still, referenceSpeed, factor = 1, dialedElevationRad = 0 }) {
  const rows = [];
  for (const level of levels) {
    const rangeM = rangeForElevation(still, dialedElevationRad + level * factor);
    if (rangeM === null) continue;
    const x = holdXAt(still, rangeM);
    if (x === null) continue;
    const perWind = holdXAt(still, rangeM, 'xPerWind');
    const winds = perWind === null || !(referenceSpeed > 0) ? [] : BDC_WIND_SIDES.flatMap((side) => BDC_WIND_FRACTIONS.map((fraction) => ({
      fraction, side, major: isMajorWindFraction(fraction), x: x + side * fraction * referenceSpeed * perWind
    })));
    rows.push({ level, rangeM, x, winds });
  }
  return rows;
}
