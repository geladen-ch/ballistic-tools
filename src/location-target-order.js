// The order a location's targets are listed in — Range Solver's Fire list,
// the target picked when a location is activated, and the printable card's
// T1, T2… labels all go through orderedTargets() here.
//
// A location's `targets` array is itself ordered (the order the user set
// in Locations & Targets, by dragging); its optional `targetOrder` field
// says whether that order is shown ('custom') or the targets are sorted
// nearest first ('distance', the default). The field is absent on every
// location the user never switched, and an absent or unknown value reads
// as 'distance' — it is written only when the user changes it, so an
// untouched record never changes shape (see record-codec.js on why that
// matters for sync).
//
// An unnamed target's "Target N" is numbered by its place in the stored
// array, whatever the display order — defaultTargetNumber() is the one
// source of that N, so it renumbers when the target is dragged.

export const TARGET_ORDERS = ['distance', 'custom'];

export function targetOrderOf(location) {
  return location && location.targetOrder === 'custom' ? 'custom' : 'distance';
}

// A new array, never the location's own. Array.prototype.sort is stable,
// so targets at equal ranges keep their stored order.
export function orderedTargets(location) {
  if (!location || !Array.isArray(location.targets)) return [];
  const targets = [...location.targets];
  if (targetOrderOf(location) === 'distance') targets.sort((a, b) => a.rangeM - b.rangeM);
  return targets;
}

// 1-based place in the stored array, or 0 when the target isn't there.
export function defaultTargetNumber(location, targetId) {
  if (!location || !Array.isArray(location.targets)) return 0;
  return location.targets.findIndex((target) => target.id === targetId) + 1;
}

// A new array with one element moved from `fromIndex` to `toIndex`; the
// array itself when the move is a no-op or out of range.
export function moveTarget(targets, fromIndex, toIndex) {
  const n = targets.length;
  const valid = (i) => Number.isInteger(i) && i >= 0 && i < n;
  if (!valid(fromIndex) || !valid(toIndex) || fromIndex === toIndex) return targets;
  const out = [...targets];
  const [moved] = out.splice(fromIndex, 1);
  out.splice(toIndex, 0, moved);
  return out;
}
