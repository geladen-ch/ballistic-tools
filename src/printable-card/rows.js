// The rows of the printable card's corrections table: which reference
// distances it lists, the neighbouring distances printed beside each, and
// how the location's targets are merged in. Pure: distances are plain
// numbers in the user's distance unit (the card's steps are round numbers
// in that unit, 100 yd as much as 100 m), elevations come from a callback.
//
// Reference distances start one step out and go up by the step in effect.
// Refinement: going outward, whenever the elevation to dial at the next
// reference distance differs from this one's by more than the threshold
// (in the Range Solver's output unit), the step drops one level, as often
// as needed, down to the finest; it never grows again.

export const STEP_LEVELS = [200, 100, 50, 25];
export const DEFAULT_STEP = 100;

// The neighbouring distances printed either side of a reference distance,
// by that row's step: the nearer offset first.
export const NEIGHBOUR_OFFSETS = {
  200: [50, 100],
  100: [25, 50],
  50: [10, 20],
  25: [5, 10]
};

// The finest grid every reference and neighbouring distance lies on.
export const DISTANCE_GRID = 5;

// The most rows (reference distances and targets together) the card holds.
export const MAX_ROWS = 31;

// [{ distance, step }] up to `maxDistance` inclusive. `elevationAt(d)` is
// the elevation to dial at distance d, in the output unit, or a non-finite
// value where it can't be had (then no refinement is decided there).
export function referenceDistances({ initialStep = DEFAULT_STEP, maxDistance, refineThreshold = 0, elevationAt = () => NaN }) {
  let level = STEP_LEVELS.indexOf(initialStep);
  if (level < 0) level = STEP_LEVELS.indexOf(DEFAULT_STEP);
  const rows = [];
  if (!(maxDistance > 0)) return rows;
  let distance = STEP_LEVELS[level];
  while (distance <= maxDistance + 1e-9) {
    if (refineThreshold > 0) {
      while (level < STEP_LEVELS.length - 1) {
        const next = distance + STEP_LEVELS[level];
        if (next > maxDistance + 1e-9) break;
        const here = elevationAt(distance);
        const there = elevationAt(next);
        if (!Number.isFinite(here) || !Number.isFinite(there) || Math.abs(there - here) <= refineThreshold) break;
        level += 1;
      }
    }
    const step = STEP_LEVELS[level];
    rows.push({ distance, step });
    distance += step;
  }
  return rows;
}

// The neighbouring distances of a reference row: [shorter far, shorter
// near, longer near, longer far]; a shorter one at or below zero is null.
export function neighbourDistances(row) {
  const [near, far] = NEIGHBOUR_OFFSETS[row.step] || NEIGHBOUR_OFFSETS[DEFAULT_STEP];
  const at = (d) => (d > 0 ? d : null);
  return [at(row.distance - far), at(row.distance - near), row.distance + near, row.distance + far];
}

// The table's rows: reference rows and target rows (each target as given,
// with a `distance` in the same unit) in distance order, a target after a
// reference row at the same distance. Targets beyond `maxDistance` are
// left out. At most MAX_ROWS are kept; `omitted` counts the rest and
// `lastDistance` is the farthest distance kept.
export function tableRows({ references, targets = [], maxDistance }) {
  const all = [
    ...references.map((r) => ({ kind: 'reference', ...r })),
    ...targets.filter((tg) => tg.distance <= maxDistance + 1e-9).map((tg) => ({ kind: 'target', ...tg }))
  ];
  all.sort((a, b) => a.distance - b.distance || (a.kind === b.kind ? 0 : a.kind === 'reference' ? -1 : 1));
  const rows = all.slice(0, MAX_ROWS);
  return {
    rows,
    omitted: all.length - rows.length,
    lastDistance: rows.length ? rows[rows.length - 1].distance : null
  };
}

// The farthest distance any row needs solved: the last reference
// distance's longer far neighbour, or a target.
export function farthestDistance(rows) {
  let far = 0;
  for (const row of rows) {
    const d = row.kind === 'reference' ? neighbourDistances(row)[3] : row.distance;
    if (d > far) far = d;
  }
  return far;
}
