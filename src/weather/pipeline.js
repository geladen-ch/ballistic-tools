// Pipeline: activate sources for the point → station lists of all active sources → metadata override → select the
// stations worth asking → current values → QC → freshness; then, in estimate(): same-site de-duplication →
// temperature time correction (diurnal.js, scaled by cloud cover) → each station to device height (reduce.js / atmosphere.js) → combine per
// quantity (combine.js). Fetching is separate from estimation: a new altitude or setting re-runs estimate() without
// any request. Lengths are metres, pressures Pa, humidity a fraction, ages and durations seconds.
import { sources as registry } from './sources/index.js';
import { reduceToDevice } from './reduce.js';
import { rhAtConstantVapour } from './atmosphere.js';
import { diurnalCorrection, cloudFactor } from './diurnal.js';
import { combine } from './combine.js';
import { haversineM } from './geo.js';
import { planSources, breakerState, recordOutcome } from './activation.js';
import { applyMetadataOverride, selectStations, pickFresh, sameSite, SAME_SITE } from './select.js';
import { sanitise } from './qc.js';
import { msToS, sToMs, kmToM } from '../quantity.js';

export { SAME_SITE };

/**
 * How long the first step waits for the station lists. A list that is still downloading after this (the first use
 * of the large SYNOP list can take minutes on a slow link) is left to finish into the cache for the next fetch; the
 * other services answer meanwhile.
 */
export const LIST_WAIT_MS = 45000;

const LATE = Symbol('late');
const errorInfo = (e) => ({ message: e?.message ?? String(e), kind: e?.kind ?? null, status: e?.status ?? null, host: e?.host ?? null });

/**
 * Fetch candidate observations around a point from every active source.
 * @param {{latRad:number, lonRad:number}} point
 * @param {{radiusM:number, maxAgeS:number, deviceHeightM?:number|null, modes?:Record<string,string>,
 *          ctx:object, onProgress?:Function, sources?:object[]}} o
 *   modes: per-source 'auto'|'off' (user choices; default per source); ctx: {getJSON, getText, cache, now?, signal?}
 * @returns {Promise<{observations:object[], errors:{source:object, error:Error}[], status:object[], selectedFor:number|null}>}
 *   observations of all sources, nearest first; status per source: {id, name, mode, state:'used'|'inactive'|'error',
 *   reason, stations, selected, reports, newest, nextExpected, error}
 */
export async function fetchObservations(point, { radiusM, maxAgeS, deviceHeightM = null, modes = {}, ctx, onProgress, sources = registry, listWaitMs = LIST_WAIT_MS }) {
  const now = ctx.now ? +ctx.now() : Date.now();
  const store = ctx.cache;
  const breakers = {}, extents = {};
  for (const s of sources) {
    breakers[s.id] = await breakerState(store, s.id, now);
    if (s.extent) { try { extents[s.id] = await s.extent(ctx); } catch { extents[s.id] = null; } }
  }
  const plan = planSources(sources, point, { radiusM, modes, breakers, extents });
  const status = new Map(plan.map((p) => [p.source.id, {
    id: p.source.id, name: p.source.name, mode: p.mode, state: p.active ? 'used' : 'inactive', reason: p.reason,
    stations: 0, selected: 0, reports: 0, newest: null, nextExpected: null, error: null,
  }]));
  const active = plan.filter((p) => p.active).map((p) => p.source);
  const errors = [];
  const ctxFor = (s) => ({ ...ctx, onProgress: (m) => onProgress?.(s, m) });
  const fail = async (s, e) => {
    errors.push({ source: s, error: e });
    Object.assign(status.get(s.id), { state: 'error', reason: 'error', error: errorInfo(e) });
    await recordOutcome(store, s.id, false, now);
  };

  // 1. Station metadata from every active source (cached lists).
  const pending = active.map((s) => s.stations({ latRad: point.latRad, lonRad: point.lonRad, radiusM }, ctxFor(s)));
  let patience;
  const late = new Promise((resolve) => { patience = setTimeout(() => resolve(LATE), listWaitMs); });
  const lists = await Promise.all(pending.map((p) => Promise.race([
    p.then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason })),
    late,
  ])));
  clearTimeout(patience);
  let metas = [];
  for (const [i, r] of lists.entries()) {
    const s = active[i];
    if (r === LATE) {
      pending[i].catch(() => {});                       // keeps loading into the cache; nobody waits for it
      Object.assign(status.get(s.id), { state: 'inactive', reason: 'listLoading' });
      continue;
    }
    if (r.status === 'rejected') { await fail(s, r.reason); continue; }
    const mine = r.value.map((m) => ({ ...m, sourceId: s.id, authoritative: !!s.authoritativeMetadata,
      distanceM: haversineM(point.latRad, point.lonRad, m.latRad, m.lonRad) })).filter((m) => m.distanceM <= radiusM);
    status.get(s.id).stations = mine.length;
    if (!mine.length) Object.assign(status.get(s.id), { state: 'inactive', reason: 'noNearby' });
    metas.push(...mine);
  }

  // 2. Authoritative heights for the same station in other feeds, then selection.
  metas = applyMetadataOverride(metas);
  const caps = Object.fromEntries(sources.filter((s) => s.maxStationsPerRefresh).map((s) => [s.id, s.maxStationsPerRefresh]));
  const { bySource } = selectStations(metas, deviceHeightM, caps);

  // 3. Current values, only from sources with a selected station.
  const asked = active.filter((s) => status.get(s.id).state === 'used');
  for (const s of asked) {
    status.get(s.id).selected = bySource.get(s.id)?.length ?? 0;
    if (!status.get(s.id).selected) Object.assign(status.get(s.id), { state: 'inactive', reason: 'notSelected' });
  }
  const callers = asked.filter((s) => status.get(s.id).state === 'used');
  const results = await Promise.allSettled(callers.map((s) => s.current(bySource.get(s.id), ctxFor(s), { maxAgeS })));
  let observations = [];
  for (const [i, r] of results.entries()) {
    const s = callers[i];
    if (r.status === 'rejected') { await fail(s, r.reason); continue; }
    await recordOutcome(store, s.id, true, now);
    // 4. Generic QC on every observation; adapters ran their own pressure checks.
    const obs = r.value.map(sanitise);
    const st = status.get(s.id);
    st.reports = obs.length;
    const newest = obs.reduce((t, o) => Math.max(t, +o.time), -Infinity);
    if (Number.isFinite(newest)) {
      st.newest = newest;
      // The next report of this source is not expected before newest + interval + typical delay; refreshing earlier
      // returns cached or identical data. (Per-station gating: refresh-gate.js.)
      st.nextExpected = newest + sToMs((s.nominalIntervalS ?? 3600) + (s.typicalDelayS ?? 0));
    }
    observations.push(...obs);
  }

  // 5. Freshness across all sources; the nearest older report if nothing is fresh.
  observations = pickFresh(observations, { now, maxAgeS, radiusM });
  for (const st of status.values()) {
    if (st.state === 'used' && !observations.some((o) => o.sourceId === st.id)) Object.assign(st, { state: 'inactive', reason: 'noFresh' });
  }
  return { observations, errors, status: [...status.values()], selectedFor: Number.isFinite(deviceHeightM) ? deviceHeightM : null };
}

const ageS = (o, now) => msToS(now - o.time);

/** Pressure preference for one site: national station pressure with a surveyed barometer > station pressure > QNH > sea-level. */
const P_RANK = { station: 3, qnh: 2, mslp: 1 };
const pRank = (o) => (P_RANK[o.pressure?.kind] ?? 0) + (o.pressure?.kind === 'station' && Number.isFinite(o.station.barometerM) ? 1 : 0);
/** Temperature resolution (°C): METAR whole degrees unless a T group; SYNOP and national data 0.1. */
const tRes = (o) => o.precision?.tC ?? (o.reportType === 'METAR' ? 1 : 0.1);

/**
 * The same site reported by several feeds must count once per quantity. Returns copies of the observations; reports
 * that must not contribute a quantity get `skip[q] = {code, label, ...}` (the UI translates the code).
 * - Same site: a common WIGOS/WMO/ICAO id (within 10 km), else position within 2 km and elevation within 30 m.
 *   Only reports of different sources are merged; a site holds at most one report per source.
 * - Pressure: national station pressure with a surveyed barometer height > station pressure > QNH > sea-level
 *   pressure; ties → the newer report.
 * - Temperature and humidity: the newer report; on a tie the finer resolution (0.1 °C over whole degrees).
 */
export function markDuplicates(observations, { maxM = SAME_SITE.maxM, maxDzM = SAME_SITE.maxDzM } = {}) {
  const out = observations.map((o) => ({ ...o, skip: { ...(o.skip ?? {}) } }));
  const label = (o) => `${o.station.name} (${o.station.id}, ${o.reportType ?? o.sourceId})`;
  const pairs = [];
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      if (out[i].sourceId === out[j].sourceId) continue;
      const m = sameSite(out[i].station, out[j].station, { maxM, maxDzM });
      if (m) pairs.push({ i, j, key: m.byId ? -1 : m.distanceM });
    }
  }
  pairs.sort((x, y) => x.key - y.key);
  // Greedy clustering: merge two clusters only if they hold no report of the same source.
  const cl = out.map((o, i) => ({ members: [i], sources: new Set([o.sourceId]) }));
  const of = out.map((_, i) => i);
  for (const { i, j } of pairs) {
    const A = of[i], B = of[j];
    if (A === B) continue;
    if ([...cl[B].sources].some((s) => cl[A].sources.has(s))) continue;
    for (const m of cl[B].members) { of[m] = A; cl[A].members.push(m); }
    for (const s of cl[B].sources) cl[A].sources.add(s);
    cl[B] = null;
  }
  for (const c of cl) {
    if (!c || c.members.length < 2) continue;
    const ms = c.members.map((i) => out[i]);
    // A report whose station and sea-level pressures contradict the barometer height (qc 'pressureInconsistent') makes
    // that height suspect for every station pressure of the site referred to it (e.g. DMI and IEM SYNOP: one barometer,
    // one height after the override). QNH, and station pressure referred to another height, stay usable.
    const hRef = (o) => o.station.barometerM ?? o.station.elevM;
    for (const bad of ms.filter((o) => o.qc?.includes('pressureInconsistent') && Number.isFinite(hRef(o)))) {
      for (const o of ms) {
        if (o === bad || o.pressure?.kind !== 'station' || !(Math.abs(hRef(o) - hRef(bad)) < 1)) continue;
        o.skip.p = { code: 'sameSiteInconsistentBarometer', label: label(bad), barometerM: hRef(bad) };
      }
    }
    const withP = ms.filter((o) => o.pressure && !o.skip.p);
    if (withP.length > 1) {
      const win = withP.reduce((w, o) => (pRank(o) > pRank(w) || (pRank(o) === pRank(w) && o.time > w.time) ? o : w));
      for (const o of withP) if (o !== win) o.skip.p = { code: 'sameSitePressure', label: label(win), kind: win.pressure.kind };
    }
    const withT = ms.filter((o) => Number.isFinite(o.temperatureC));
    if (withT.length) {
      const win = withT.reduce((w, o) => (o.time > w.time || (+o.time === +w.time && tRes(o) < tRes(w)) ? o : w));
      for (const o of ms) if (o !== win) o.skip.t = o.skip.rh = { code: 'sameSiteNewer', label: label(win) };
    }
  }
  return out;
}

/** Reports within this distance of the device give the regional cloud cover that stations without a cover borrow. */
export const REGIONAL_CLOUD_RADIUS_M = kmToM(100);
/** Distance floor in the regional weights, so a report next to the device does not dominate without limit. */
export const REGIONAL_CLOUD_MIN_DISTANCE_M = kmToM(1);
const REGIONAL_CLOUD_POWER = 1.5;

/**
 * The reports that give the regional cloud cover: every report with a cover within the radius, whether or not it also
 * contributes a temperature, pressure or humidity (an airport whose temperature was superseded by a newer report of
 * the same site still tells the sky). Weights 1 / max(d, floor)^1.5 by the distance from the device, normalised to 1.
 * @param {object[]} observations  each with `cloudFraction` and `station.distanceM`
 * @returns {{obs:object, distanceM:number, fraction:number, weight:number}[]}  nearest first as given
 */
export function cloudReports(observations) {
  const list = [];
  for (const obs of observations) {
    const d = obs.station?.distanceM;
    if (!Number.isFinite(obs.cloudFraction) || !Number.isFinite(d) || d > REGIONAL_CLOUD_RADIUS_M) continue;
    list.push({ obs, distanceM: d, fraction: obs.cloudFraction, weight: 1 / Math.max(d, REGIONAL_CLOUD_MIN_DISTANCE_M) ** REGIONAL_CLOUD_POWER });
  }
  const total = list.reduce((s, r) => s + r.weight, 0);
  for (const r of list) r.weight /= total;
  return list;
}

/**
 * Regional cloud cover: the weighted mean of the covers of `cloudReports()`. Stations that report no cloud (SYNOP and
 * national networks) borrow it.
 * @returns {number|null}  fraction 0..1, or null when no report within the radius has a cover
 */
export function regionalCloudFraction(observations) {
  const reports = cloudReports(observations);
  return reports.length ? reports.reduce((s, r) => s + r.weight * r.fraction, 0) : null;
}

/**
 * One station prepared for combination: temperature brought forward to now (sun-angle curve scaled by the cloud
 * cover: the station's own, else the regional one) and RH with it at constant vapour pressure, then values at
 * device height. Pressure uses the reported temperature for its layer. `diurnal` is the curve result before the
 * cloud factor; `cloud` says which cover was used.
 */
function prepare(o, deviceHeightM, now, timeCorrect, regionalCloud = null) {
  const canShift = timeCorrect && Number.isFinite(o.temperatureC) && Number.isFinite(o.station.latRad) && Number.isFinite(o.station.lonRad);
  const diurnal = canShift ? diurnalCorrection(o.station.latRad, o.station.lonRad, o.time, now) : null;
  const own = Number.isFinite(o.cloudFraction);
  const fraction = own ? o.cloudFraction : regionalCloud;
  const cloud = { fraction: Number.isFinite(fraction) ? fraction : null, from: own ? 'report' : Number.isFinite(regionalCloud) ? 'area' : null,
    factor: cloudFactor(fraction) };
  const dT = diurnal ? diurnal.dT * cloud.factor : null;
  const shifted = dT ? { ...o, temperatureC: o.temperatureC + dT,
    humidity: Number.isFinite(o.humidity) ? rhAtConstantVapour(o.humidity, o.temperatureC, o.temperatureC + dT) : o.humidity } : o;
  return { obs: o, dT, diurnal, cloud, reduced: reduceToDevice(shifted, deviceHeightM, { layerTempC: o.temperatureC }), ageS: ageS(o, now), distanceM: o.station.distanceM };
}

/**
 * Estimate pressure, temperature and RH at the device.
 * @param {object[]} observations  candidates (fetchObservations), nearest first
 * @param {number|null} deviceHeightM  device height, m a.s.l.
 * @param {{now?:Date, maxAgeS?:number, combine?:boolean, timeCorrect?:boolean, params?:object}} opts
 *   combine: several stations or the nearest one only; timeCorrect: sun-angle correction; params: overrides of
 *   COMBINE_DEFAULTS
 * @returns {{mode:'multi'|'nearest'|'none', reason:string|null, now:Date, deviceHeightM:number|null, timeCorrect:boolean,
 *   fresh:number, stations:object[], regionalCloudFraction:number|null, cloudReports:object[],
 *   pressure:Q, temperature:Q, humidity:Q}}  with Q = combine() output whose entries carry `row` (prepared station)
 */
export function estimate(observations, deviceHeightM, { now = new Date(), maxAgeS = 5400, combine: multi = true, timeCorrect = true, params = {} } = {}) {
  const haveH = Number.isFinite(deviceHeightM);
  const fresh = observations.filter((o) => !o.stale && ageS(o, now) <= maxAgeS);
  const base = { now, deviceHeightM: haveH ? deviceHeightM : null, timeCorrect, fresh: fresh.length };
  const empty = { value: null, used: [], rejected: [], check: null, considered: 0, candidates: 0 };
  if (!observations.length) return { ...base, mode: 'none', reason: null, stations: [], regionalCloudFraction: null, cloudReports: [], pressure: empty, temperature: empty, humidity: empty };

  if (!multi || !haveH || !fresh.length) {
    const reason = !fresh.length ? 'stale' : !haveH ? 'noAltitude' : 'setting';
    const pool = fresh.length ? fresh : observations;
    const o = pool.find((x) => Number.isFinite(x.temperatureC) && x.pressure) ?? pool[0];
    const clouds = cloudReports(fresh);
    const regionalCloud = regionalCloudFraction(fresh);
    const row = prepare(o, haveH ? deviceHeightM : null, now, timeCorrect && fresh.length > 0, regionalCloud);
    const st = o.station;
    const one = (value, hM) => (Number.isFinite(value)
      ? { ...empty, value, used: [{ row, distanceM: row.distanceM, hM, value, deffM: null, weight: 1 }], considered: 1, candidates: 1 }
      : empty);
    const r = row.reduced;
    // Without altitude: station temperature (time-corrected if enabled), not moved in height; no pressure value.
    const T = haveH ? r.temperatureC : (Number.isFinite(o.temperatureC) ? o.temperatureC + (row.dT ?? 0) : null);
    return {
      ...base, mode: 'nearest', reason, stations: [row], regionalCloudFraction: regionalCloud, cloudReports: clouds,
      pressure: one(r.pressurePa, st.elevM), temperature: one(T, st.elevM), humidity: one(r.humidity, st.elevM),
    };
  }

  const marked = markDuplicates(fresh);
  const clouds = cloudReports(marked);
  const regionalCloud = regionalCloudFraction(marked);
  const rows = marked.map((o) => prepare(o, deviceHeightM, now, timeCorrect, regionalCloud));
  const use = (row, q) => !row.obs.skip?.[q];
  const elev = (row) => row.obs.station.elevM;
  const has = Number.isFinite;
  // Without station elevation a station is excluded from T and p (Δh unknown); it may give RH with Δh = 0.
  const pressure = combine(rows
    .filter((row) => use(row, 'p') && has(row.reduced.pressurePa) && has(elev(row) ?? row.obs.station.barometerM))
    .map((row) => ({ row, distanceM: row.distanceM, hM: elev(row) ?? row.obs.station.barometerM, value: row.reduced.pressurePa })), deviceHeightM, 'p', params);
  const temperature = combine(rows
    .filter((row) => use(row, 't') && has(elev(row)) && has(row.reduced.temperatureC) && row.reduced.temperatureRefM != null)
    .map((row) => ({ row, distanceM: row.distanceM, hM: elev(row), value: row.reduced.temperatureC })), deviceHeightM, 't', params);
  const humidity = combine(rows
    .filter((row) => use(row, 'rh') && has(row.reduced.humidity))
    .map((row) => ({ row, distanceM: row.distanceM, hM: has(elev(row)) ? elev(row) : deviceHeightM, value: row.reduced.humidity })), deviceHeightM, 'rh', params);
  return { ...base, mode: 'multi', reason: null, stations: rows, regionalCloudFraction: regionalCloud, cloudReports: clouds, pressure, temperature, humidity };
}
