// Helpers shared by source adapters.
import { haversineM } from '../geo.js';
import { pickFresh } from '../select.js';
import { kmToM, minToS, radToDeg } from '../../quantity.js';

/** Cache-through load: returns {value, fromCache, fetchedAt}. */
export async function cached(ctx, key, ttlS, load) {
  const hit = await ctx.cache.get(key);
  if (hit !== undefined) return { value: hit, fromCache: true, fetchedAt: (await ctx.cache.info(key))?.storedAt ?? null };
  const value = await load();
  await ctx.cache.set(key, value, ttlS);
  return { value, fromCache: false, fetchedAt: Date.now() };
}

/**
 * One adapter on its own (tests, simple callers): stations within radiusM → current values → fresh ones, nearest
 * first, at most k; the nearest older report flagged `stale` if none is fresh. The pipeline does the same across all
 * sources, with selection and de-duplication in between.
 */
export async function nearestVia(adapter, point, { k = Infinity, maxAgeS = minToS(90), radiusM = kmToM(150), onProgress = () => {} } = {}, ctx) {
  const now = ctx.now ? ctx.now() : new Date();
  const c = { ...ctx, onProgress };
  const metas = (await adapter.stations({ latRad: point.latRad, lonRad: point.lonRad, radiusM }, c))
    .map((m) => ({ ...m, distanceM: haversineM(point.latRad, point.lonRad, m.latRad, m.lonRad) }))
    .filter((m) => m.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
  if (!metas.length) return [];
  const obs = await adapter.current(metas, c, { maxAgeS });
  return pickFresh(obs, { now, maxAgeS, radiusM }).slice(0, k);
}

const CENTI = 100;
/**
 * Query box [west, south, east, north] in DEGREES around stations ({latRad, lonRad}), padded by 0.01° and rounded
 * outwards to 0.01° (the form the national APIs take; their parameters are degrees).
 */
export function queryBoxDegrees(points) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of points) {
    const lon = radToDeg(p.lonRad), lat = radToDeg(p.latRad);
    if (lon < w) w = lon; if (lon > e) e = lon;
    if (lat < s) s = lat; if (lat > n) n = lat;
  }
  const lo = (v) => (Math.floor(v * CENTI) - 1) / CENTI, hi = (v) => (Math.ceil(v * CENTI) + 1) / CENTI;
  return [lo(w), lo(s), hi(e), hi(n)];
}

/** °F wire values like 51.8 carry float noise after conversion to °C; values are 0.1 °C. */
export const round2 = (x) => Math.round(x * CENTI) / CENTI;

export const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
