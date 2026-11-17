// Automatic source activation: which sources to ask for a point, and why the others are inactive.
// No country lookup, no reverse geocoding: a static coverage outline per adapter, intersected with the search circle,
// then the learned station extent once a source's list is cached, a per-source mode and a circuit breaker.
// Angles are radians, lengths metres, durations seconds.
import { bboxContains, EARTH_RADIUS_M } from './geo.js';
import { hToS, sToMs } from '../quantity.js';

/**
 * Per-source setting: Auto (used where it applies) or Off. There is no "always on": a source far from the device has
 * nothing to contribute. A source that has not passed validation (`autoDefault: false`) is Off until the user sets
 * it to Auto.
 * @typedef {'auto'|'off'} SourceMode
 */
export const MODES = Object.freeze(['auto', 'off']);
/** Mode of a source: the user's choice, else its default. */
export function sourceMode(source, modes = {}) {
  const m = modes[source.id];
  return MODES.includes(m) ? m : source.autoDefault === false ? 'off' : 'auto';
}
/** Circuit breaker: after `failures` consecutive failures a source in Auto mode pauses for `pauseS` seconds. */
export const BREAKER = Object.freeze({ failures: 3, pauseS: hToS(3) });

/** Reasons a source is inactive (status display). The UI translates these codes. */
export const REASONS = Object.freeze([
  'used', 'off', 'notValidated', 'outside', 'noStationsInArea', 'paused', 'noNearby', 'notSelected', 'error', 'noFresh', 'listLoading',
]);

/**
 * Distance (m) from a point to a segment, in a local equirectangular projection around the point (fine for ≤ 500 km).
 * Points are [lonRad, latRad].
 */
function segmentM(lat, lon, [x1, y1], [x2, y2]) {
  const k = Math.cos(lat);
  const wrap = (x) => ((x - lon + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;   // longitudes relative to the point
  const ax = wrap(x1) * k * EARTH_RADIUS_M, ay = (y1 - lat) * EARTH_RADIUS_M;
  const bx = wrap(x2) * k * EARTH_RADIUS_M, by = (y2 - lat) * EARTH_RADIUS_M;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Point in polygon ring (ray casting, [lonRad, latRad]; rings must not cross ±π). */
function inRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Does the coverage intersect the circle of radiusM around the point?
 * coverage: {kind:'global'} | {kind:'bbox', bbox} | {kind:'region', polygons:[[[lonRad,latRad],…], …]} (outer rings only)
 */
export function coverageIntersects(coverage, lat, lon, radiusM) {
  if (!coverage || coverage.kind === 'global') return true;
  if (coverage.kind === 'bbox') return bboxContains(coverage.bbox, lat, lon, radiusM);
  if (coverage.kind === 'region') {
    for (const ring of coverage.polygons) {
      if (inRing(lat, lon, ring)) return true;
      for (let i = 0; i < ring.length - 1; i++) if (segmentM(lat, lon, ring[i], ring[i + 1]) <= radiusM) return true;
    }
    return false;
  }
  return true;
}

/** Circuit-breaker state for one source, from the store. */
export async function breakerState(store, id, now) {
  const b = (await store.get(`breaker:${id}`)) ?? { failures: 0, until: 0 };
  return { ...b, open: b.until > now };
}
export async function recordOutcome(store, id, ok, now, cfg = BREAKER) {
  if (ok) { await store.delete?.(`breaker:${id}`); return { failures: 0, until: 0 }; }
  const b = (await store.get(`breaker:${id}`)) ?? { failures: 0, until: 0 };
  const failures = b.failures + 1;
  const until = failures >= cfg.failures ? now + sToMs(cfg.pauseS) : 0;
  const next = { failures: until ? 0 : failures, until };
  await store.set(`breaker:${id}`, next, 2 * cfg.pauseS);
  return next;
}

/**
 * Decide, per source, whether it is asked for this point (before any request).
 * @param {object[]} registry   adapters
 * @param {{latRad:number, lonRad:number}} point
 * @param {{radiusM:number, modes?:Record<string,SourceMode>, breakers?:Record<string,{open:boolean}>,
 *          extents?:Record<string,number[]|null>}} o
 *   modes: the user's choices only (missing → the source's default, sourceMode());
 *   extents: learned station extents [west, south, east, north] in radians (from cached station lists)
 * @returns {{source:object, mode:SourceMode, active:boolean, reason:string}[]}
 */
export function planSources(registry, { latRad, lonRad }, { radiusM, modes = {}, breakers = {}, extents = {} }) {
  return registry.map((source) => {
    const mode = sourceMode(source, modes);
    const r = (reason) => ({ source, mode, active: reason === null, reason: reason ?? 'used' });
    if (mode === 'off') return r(modes[source.id] == null && source.autoDefault === false ? 'notValidated' : 'off');
    if (!coverageIntersects(source.coverage, latRad, lonRad, radiusM)) return r('outside');
    const ex = extents[source.id];
    if (ex && !bboxContains(ex, latRad, lonRad, radiusM)) return r('noStationsInArea');
    if (breakers[source.id]?.open) return r('paused');
    return r(null);
  });
}
