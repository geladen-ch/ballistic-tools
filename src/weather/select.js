// Station selection across sources: one station list per source (`stations(area)`), merged, metadata from
// authoritative national lists applied to other feeds, ranked, and only the stations that can enter the combination
// are asked for current values (`current(stations)`). Lengths are metres, ages seconds.
import { haversineM, EARTH_RADIUS_M } from './geo.js';
import { kmToM, msToS, minToS } from '../quantity.js';

/** Same site in two feeds: within 2 km and 30 m. Validated on a year of hourly reports. */
export const SAME_SITE = Object.freeze({ maxM: kmToM(2), maxDzM: 30 });
/** Ids that match but lie farther apart than this are not trusted (bad metadata). */
export const ID_MATCH_MAX_M = kmToM(10);
/**
 * Metadata override without a common id: same mast = within 200 m, heights within 100 m. Needed because feeds use
 * different id series (IEM: national WIGOS `0-756-0-660`; national lists often the WMO series `0-20000-0-06660`).
 */
export const OVERRIDE_POS = Object.freeze({ maxM: 200, maxDzM: 100 });
/**
 * Selection: the nearest SELECT.horizontal sites by distance, plus the nearest SELECT.effective sites by effective
 * distance (λ = 200) when the device height is known. k = 8 per quantity is taken from these after freshness and QC;
 * the margin covers stations without a fresh report or without the quantity.
 */
export const SELECT = Object.freeze({ horizontal: 40, effective: 24, lambda: 200 });
/** Two stations farther apart in latitude than this cannot be the same site (cheap pre-filter, ≈ 22 km). */
const SITE_PREFILTER_M = kmToM(22);
/** A report timestamped this far ahead of the device clock is still accepted (clock skew). */
const FUTURE_SKEW_S = minToS(5);

/**
 * Normalised station identifiers: WIGOS ids (all known aliases), WMO index, ICAO.
 * @typedef {{wigos?:string[], wmo?:string|null, icao?:string|null}} StationIds
 */

/** WMO block/station index of a WIGOS id of the WMO series (`0-20000-0-06660` → `06660`), else null. */
export function wmoFromWigos(w) {
  const m = /^0-20000-0-(\d{5})$/.exec(String(w));
  return m ? m[1] : null;
}

/** Do two stations carry a common identifier (WIGOS alias, WMO index or ICAO)? */
export function idsMatch(a, b) {
  if (!a || !b) return false;
  if (a.wigos?.length && b.wigos?.length && a.wigos.some((w) => b.wigos.includes(w))) return true;
  if (a.wmo && b.wmo && a.wmo === b.wmo) return true;
  return !!(a.icao && b.icao && a.icao === b.icao);
}

const dz = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) : 0);

/**
 * Are two stations the same site? Common id within ID_MATCH_MAX_M, or position and elevation within SAME_SITE.
 * @returns {{distanceM:number, byId:boolean}|null}
 */
export function sameSite(a, b, { maxM = SAME_SITE.maxM, maxDzM = SAME_SITE.maxDzM } = {}) {
  const d = haversineM(a.latRad, a.lonRad, b.latRad, b.lonRad);
  if (idsMatch(a.ids, b.ids) && d <= ID_MATCH_MAX_M) return { distanceM: d, byId: true };
  if (d <= maxM && dz(a.elevM, b.elevM) <= maxDzM) return { distanceM: d, byId: false };
  return null;
}

/**
 * Metadata override: a station of an authoritative source (national list with surveyed heights) replaces the elevation
 * and barometer height of the same station in other feeds. Same station = a common id (within 10 km), or the same
 * mast (OVERRIDE_POS: 200 m, 100 m). The 2 km / 30 m same-site rule is not used here: the override exists because
 * heights differ (Zürich/Fluntern: 556 m in IEM, 604 m at MeteoSwiss).
 * @param {object[]} metas  station metadata of all sources ({sourceId, ids, latRad, lonRad, elevM, barometerM, authoritative})
 * @returns {object[]} copies; overridden entries carry `elevFrom: {sourceId, id, elevM, barometerM}` (previous values)
 */
export function applyMetadataOverride(metas) {
  const auth = metas.filter((m) => m.authoritative);
  if (!auth.length) return metas.map((m) => ({ ...m }));
  return metas.map((m) => {
    if (m.authoritative) return { ...m };
    const a = auth.find((x) => {
      if (x.sourceId === m.sourceId) return false;
      const d = haversineM(x.latRad, x.lonRad, m.latRad, m.lonRad);
      return (idsMatch(x.ids, m.ids) && d <= ID_MATCH_MAX_M) || (d <= OVERRIDE_POS.maxM && dz(x.elevM, m.elevM) <= OVERRIDE_POS.maxDzM);
    });
    if (!a || (!Number.isFinite(a.elevM) && !Number.isFinite(a.barometerM))) return { ...m };
    return {
      ...m,
      elevM: Number.isFinite(a.elevM) ? a.elevM : m.elevM,
      barometerM: Number.isFinite(a.barometerM) ? a.barometerM : (m.barometerM ?? null),
      elevFrom: { sourceId: a.sourceId, id: a.id, elevM: m.elevM ?? null, barometerM: m.barometerM ?? null },
    };
  });
}

/**
 * Group station entries into sites. Entries of one source at an identical position and elevation are aliases (IEM
 * lists some SYNOP sites under two ids) and always form one unit. Units of different sources are merged when they are
 * the same site (sameSite), nearest pairs first (id matches before distances), and only if the two groups hold no
 * station of the same source, so a chain of nearby stations of one network is never collapsed into one site.
 * @returns {number[]} site index per entry
 */
export function groupSites(metas) {
  const n = metas.length;
  const unit = new Array(n);
  const units = new Map();
  metas.forEach((m, i) => {
    const k = `${m.sourceId}|${m.latRad}|${m.lonRad}|${m.elevM ?? ''}`;
    if (!units.has(k)) units.set(k, i);
    unit[i] = units.get(k);
  });
  const reps = [...new Set(unit)];
  const pairs = [];
  for (let x = 0; x < reps.length; x++) {
    for (let y = x + 1; y < reps.length; y++) {
      const a = metas[reps[x]], b = metas[reps[y]];
      if (a.sourceId === b.sourceId || Math.abs(a.latRad - b.latRad) * EARTH_RADIUS_M > SITE_PREFILTER_M) continue;
      const m = sameSite(a, b);
      if (m) pairs.push({ a: reps[x], b: reps[y], key: m.byId ? -1 : m.distanceM });
    }
  }
  pairs.sort((p, q) => p.key - q.key);
  const group = new Map(reps.map((r) => [r, { id: r, sources: new Set([metas[r].sourceId]) }]));
  const of = new Map(reps.map((r) => [r, r]));
  for (const { a, b } of pairs) {
    const A = group.get(of.get(a)), B = group.get(of.get(b));
    if (A === B || [...B.sources].some((s) => A.sources.has(s))) continue;
    for (const [r, g] of of) if (g === B.id) of.set(r, A.id);
    for (const s of B.sources) A.sources.add(s);
  }
  return metas.map((_, i) => of.get(unit[i]));
}

/**
 * Choose the stations to ask for current values.
 * Sites are taken in order of effective distance (when the device height is known; SELECT.effective sites), then of
 * horizontal distance (SELECT.horizontal sites). A source at its cap (maxPerSource sites, for per-station sources)
 * contributes no more stations, and a site left without stations does not use up a slot.
 * @param {object[]} metas  entries with `distanceM` (from the device) and `elevM`
 * @param {number|null} deviceHeightM  device height; null → horizontal ranking only
 * @param {Record<string, number>} [maxPerSource]  cap on sites per source
 * @returns {{selected:object[], bySource:Map<string, object[]>, sites:number}}
 */
export function selectStations(metas, deviceHeightM, maxPerSource = {}, sel = SELECT) {
  if (!metas.length) return { selected: [], bySource: new Map(), sites: 0 };
  const site = groupSites(metas);
  const members = new Map(), best = new Map();
  metas.forEach((m, i) => {
    const deff = Number.isFinite(deviceHeightM) && Number.isFinite(m.elevM)
      ? Math.hypot(m.distanceM, sel.lambda * (m.elevM - deviceHeightM)) : Infinity;
    const b = best.get(site[i]) ?? { distanceM: Infinity, deff: Infinity };
    best.set(site[i], { distanceM: Math.min(b.distanceM, m.distanceM), deff: Math.min(b.deff, deff) });
    if (!members.has(site[i])) members.set(site[i], []);
    members.get(site[i]).push(m);
  });
  const sitesOf = new Map();                                            // source → sites taken
  const taken = new Set(), selected = [];
  const walk = (key, n) => {
    const order = [...members.keys()].filter((s) => Number.isFinite(best.get(s)[key])).sort((a, b) => best.get(a)[key] - best.get(b)[key]);
    let count = 0;
    for (const s of order) {
      if (count >= n) break;
      if (taken.has(s)) { count++; continue; }
      const ok = members.get(s).filter((m) => {
        const seen = sitesOf.get(m.sourceId) ?? new Set();
        return seen.has(s) || seen.size < (maxPerSource[m.sourceId] ?? Infinity);
      }).sort((a, b) => a.distanceM - b.distanceM);
      if (!ok.length) continue;
      for (const m of ok) {
        if (!sitesOf.has(m.sourceId)) sitesOf.set(m.sourceId, new Set());
        sitesOf.get(m.sourceId).add(s);
        selected.push(m);
      }
      taken.add(s); count++;
    }
  };
  if (Number.isFinite(deviceHeightM)) walk('deff', sel.effective);
  walk('distanceM', sel.horizontal);
  const bySource = new Map();
  for (const m of selected) {
    if (!bySource.has(m.sourceId)) bySource.set(m.sourceId, []);
    bySource.get(m.sourceId).push(m);
  }
  return { selected, bySource, sites: taken.size };
}

const usable = (o) => o.temperatureC != null || o.pressure != null;

/**
 * Fresh, usable observations (age ≤ maxAgeS), nearest first. If none is fresh, the nearest usable older report
 * alone, flagged `stale` (shown without time correction).
 */
export function pickFresh(observations, { now, maxAgeS, radiusM = null }) {
  const sorted = [...observations].sort((a, b) => a.station.distanceM - b.station.distanceM);
  const ageS = (o) => msToS(now - o.time);
  const fresh = sorted.filter((o) => usable(o) && ageS(o) <= maxAgeS && ageS(o) >= -FUTURE_SKEW_S);
  if (fresh.length) return fresh;
  const old = sorted.find(usable);
  if (!old) return [];
  return [{ ...old, stale: true, notes: [...old.notes, { code: 'noFreshNearestOlder', radiusM }] }];
}
