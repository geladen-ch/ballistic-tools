// Small geodesy helpers: great-circle distance and bounding-box tests. Angles are radians and lengths metres, like
// everywhere inside the weather engine; degrees exist only in input fields and labels.

import { degToRad } from '../quantity.js';

export const EARTH_RADIUS_M = 6371008.8;
const PI = Math.PI;
const TWO_PI = 2 * Math.PI;
// Latitude beyond which the longitude scale is clamped when widening a box by a margin (the box is useless there).
const MAX_BOX_LAT_RAD = degToRad(89);

/** Great-circle distance in metres (haversine). */
export function haversineM(lat1, lon1, lat2, lon2) {
  const dLat = lat2 - lat1, dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Normalise a longitude to [−π, π). */
export const wrapLon = (lon) => (lon >= -PI && lon < PI ? lon : ((((lon + PI) % TWO_PI) + TWO_PI) % TWO_PI) - PI);

/**
 * Does bbox [west, south, east, north] (radians), widened by marginM, contain the point?
 * A bbox with west > east is taken to cross the antimeridian (RFC 7946 convention). Boxes whose longitude range
 * cannot be trusted (e.g. IEM min/max boxes of wrapping networks) must be handled by the caller.
 */
export function bboxContains(bbox, lat, lon, marginM = 0) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const dLat = marginM / EARTH_RADIUS_M;
  if (lat < minLat - dLat || lat > maxLat + dLat) return false;
  const cosLat = Math.max(0.01, Math.cos(Math.min(MAX_BOX_LAT_RAD, Math.max(Math.abs(lat), Math.abs(minLat), Math.abs(maxLat)))));
  const dLon = Math.min(PI, marginM / (EARTH_RADIUS_M * cosLat));
  const lo = minLon - dLon, hi = maxLon + dLon;
  if (hi - lo >= TWO_PI) return true;
  const x = wrapLon(lon);
  if (minLon <= maxLon) {
    return [x, x - TWO_PI, x + TWO_PI].some((v) => v >= lo && v <= hi);
  }
  // crosses the antimeridian: [west, π] ∪ [−π, east]
  return x >= lo || x <= hi;
}

/**
 * Narrowest longitude interval containing all given longitudes, possibly crossing the antimeridian.
 * Method: sort the longitudes around the circle and drop the largest empty gap; the extent is the rest.
 * @returns {{west:number, east:number}|null}  west > east means the interval crosses ±π
 */
export function lonExtent(lons) {
  const xs = lons.filter(Number.isFinite).map(wrapLon).sort((a, b) => a - b);
  if (!xs.length) return null;
  let gap = xs[0] + TWO_PI - xs[xs.length - 1], k = xs.length - 1;   // wrap-around gap (east of the last)
  for (let i = 0; i < xs.length - 1; i++) {
    const g = xs[i + 1] - xs[i];
    if (g > gap) { gap = g; k = i; }
  }
  return { west: xs[(k + 1) % xs.length], east: xs[k] };
}

/** RFC 7946-style bbox [west, south, east, north] (radians) of points {latRad, lonRad} (west > east when crossing ±π). */
export function pointsBbox(points) {
  const e = lonExtent(points.map((p) => p.lonRad));
  if (!e) return null;
  let s = Infinity, n = -Infinity;
  for (const p of points) { if (p.latRad < s) s = p.latRad; if (p.latRad > n) n = p.latRad; }
  return [e.west, s, e.east, n];
}

/**
 * Lower bound (metres) of the distance from a point to a bbox [west, south, east, north].
 * west > east: the box crosses the antimeridian. Pass lonUnknown for boxes whose longitude range is not
 * trustworthy (then only latitude bounds the distance).
 */
export function bboxDistanceM([w, s, e, n], lat, lon, { lonUnknown = false } = {}) {
  if (lonUnknown) return lat < s ? (s - lat) * EARTH_RADIUS_M : lat > n ? (lat - n) * EARTH_RADIUS_M : 0;
  if (w > e) return Math.min(bboxDistanceM([w, s, PI, n], lat, lon), bboxDistanceM([-PI, s, e, n], lat, lon));
  const x = wrapLon(lon);
  if (lat >= s && lat <= n && x >= w && x <= e) return 0;
  const cl = Math.min(Math.max(lat, s), n);
  // nearest box longitude, measured around the circle
  const dW = ((w - x) % TWO_PI + TWO_PI) % TWO_PI, dE = ((x - e) % TWO_PI + TWO_PI) % TWO_PI;
  const co = x >= w && x <= e ? x : dW < dE ? w : e;
  return haversineM(lat, x, cl, co) * 0.999;
}

/** Outline written as [lonDeg, latDeg] pairs (static coverage data) → [lonRad, latRad] pairs. */
export function outlineFromDegrees(pairs) {
  return pairs.map(([lonDeg, latDeg]) => [degToRad(lonDeg), degToRad(latDeg)]);
}

/** A GeoJSON Point's coordinates [lonDeg, latDeg] → {latRad, lonRad}. */
export function pointFromGeoJson([lonDeg, latDeg]) {
  return { latRad: degToRad(latDeg), lonRad: degToRad(lonDeg) };
}

/** Bounding box [west, south, east, north] (radians) of a GeoJSON Polygon geometry (degrees). */
export function polygonBbox(geometry) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const ring of geometry.coordinates) for (const [x, y] of ring) {
    if (x < minLon) minLon = x; if (x > maxLon) maxLon = x;
    if (y < minLat) minLat = y; if (y > maxLat) maxLat = y;
  }
  return [degToRad(minLon), degToRad(minLat), degToRad(maxLon), degToRad(maxLat)];
}
