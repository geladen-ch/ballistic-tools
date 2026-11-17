// The weather service the tools call: fetch observations around a position (or, while the refresh gate is closed,
// recalculate from the cached ones), estimate the three values at the device's altitude, remember the result so the
// station details work after a reload, and keep the per-station report history that drives the refresh gate.
// No UI here. SI throughout: radians, metres, Pa, fractions, °C; times are epoch milliseconds.
import { getWeatherRuntime, currentModes } from './runtime.js';
import { getOnlineWeatherSettings } from '../online-weather-prefs.js';
import { fetchObservations, estimate } from './pipeline.js';
import { haversineM } from './geo.js';
import {
  planRefresh, contributors, historyKey, emptyHistory, intervalOf, recordObservation, recordSourceTimes
} from './refresh-gate.js';
import { dayToS } from '../quantity.js';

/** The stored last result is discarded when its shape changes (nothing to migrate). */
export const LAST_VERSION = 1;
const LAST_KEY = 'last';
/** A new fetch is allowed at once when the position moved further than this, or the altitude changed by more than the second. */
export const SAME_POSITION_M = 2000;
export const ALTITUDE_CHANGE_M = 200;
const HISTORY_TTL_S = dayToS(7);

const sameModes = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/** Is a stored `last` still describing the same request (position, altitude band, radius, age limit, services)? */
function sameRequest(last, { point, altitudeM, radiusM, maxAgeS, modes }) {
  return !!last
    && haversineM(last.point.latRad, last.point.lonRad, point.latRad, point.lonRad) <= SAME_POSITION_M
    && Math.abs(last.altitudeM - altitudeM) <= ALTITUDE_CHANGE_M
    && last.radiusM === radiusM && last.maxAgeS === maxAgeS && sameModes(last.modes, modes);
}

/**
 * @param {{runtime?:object, now?:()=>number, getSettings?:()=>object, getModes?:()=>object}} [o]
 */
export function createWeatherService({
  runtime = getWeatherRuntime(), now = () => Date.now(), getSettings = getOnlineWeatherSettings, getModes = currentModes,
} = {}) {
  const { net, cache, sources } = runtime;
  const adapter = (id) => sources.find((s) => s.id === id);
  let lastMemo; // undefined = not read yet

  async function readLast() {
    if (lastMemo === undefined) {
      const stored = await cache.get(LAST_KEY);
      lastMemo = stored && stored.v === LAST_VERSION ? stored : null;
    }
    return lastMemo;
  }
  async function writeLast(last) {
    lastMemo = last;
    await cache.set(LAST_KEY, last, Infinity);
  }

  const estimateFor = (last, e) => estimate(last.observations, e.altitudeM, {
    now: new Date(e.nowMs), maxAgeS: last.maxAgeS, combine: e.combine, timeCorrect: e.timeCorrect,
  });

  /** The estimate behind the values last written (same inputs, so the same numbers), or null. */
  async function lastEstimate() {
    const last = await readLast();
    return last ? { last, result: estimateFor(last, last.estimatedFor) } : null;
  }

  async function histories(observations) {
    const out = new Map();
    for (const o of observations) {
      const key = historyKey(o.sourceId, o.station.id);
      if (!out.has(key)) out.set(key, (await cache.get(key)) ?? emptyHistory(key));
    }
    return out;
  }

  /** Gate decision for the held reports, as of `at`. */
  async function planFor(last, result, at) {
    const hs = await histories(contributors(result).map((c) => c.obs));
    const stations = contributors(result).map(({ obs }) => {
      const a = adapter(obs.sourceId);
      const h = hs.get(historyKey(obs.sourceId, obs.station.id));
      return { tObs: +obs.time, intervalS: intervalOf(h, a).intervalS, minRefreshS: a?.minRefreshS ?? 600 };
    });
    return planRefresh({ now: at, fetchedAt: last.fetchedAt, retryCount: last.retry, stations });
  }

  /**
   * What the block can say without a request: is there a result for this request, may a fetch go out now, when is the
   * next report expected, did the altitude move far enough to deserve a refresh.
   */
  async function status({ point, altitudeM }) {
    const last = await readLast();
    if (!last) return { hasLast: false, edited: false, allowed: true, nextExpectedAt: null, intervalS: null, altitudeChanged: false };
    if (!point) return { hasLast: true, edited: !!last.edited, fetchedAt: last.fetchedAt };       // no position yet: just what is stored
    const s = getSettings();
    const samePosition = haversineM(last.point.latRad, last.point.lonRad, point.latRad, point.lonRad) <= SAME_POSITION_M;
    const altitudeChanged = samePosition && Math.abs(last.altitudeM - altitudeM) > ALTITUDE_CHANGE_M;
    if (!sameRequest(last, { point, altitudeM, radiusM: s.searchRadiusM, maxAgeS: s.maxAgeS, modes: getModes() })) {
      return { hasLast: true, edited: !!last.edited, allowed: true, nextExpectedAt: null, intervalS: null, altitudeChanged, fetchedAt: last.fetchedAt };
    }
    const plan = await planFor(last, estimateFor(last, last.estimatedFor), now());
    return { hasLast: true, edited: !!last.edited, ...plan, altitudeChanged, fetchedAt: last.fetchedAt };
  }

  /**
   * The three values at the device, plus the estimate they come from.
   * @param {{point:{latRad:number,lonRad:number}, altitudeM:number, onProgress?:Function}} req
   * @returns {Promise<{ok:true, fetched:boolean, values:{tempC:number|null, pressurePa:number|null, humidity:number|null},
   *   missing:string[], result:object, stationCount:number, listLoading:boolean, at:number, plan:object}
   *   | {ok:false, code:'unreachable'|'noStation'|'listLoading'|'noFresh'|'noValues', errors:object[]}>}
   */
  async function get({ point, altitudeM, onProgress }) {
    const s = getSettings();
    const modes = getModes();
    const request = { point, altitudeM, radiusM: s.searchRadiusM, maxAgeS: s.maxAgeS, modes };
    const t = now();
    let last = await readLast();
    const same = sameRequest(last, request);

    // Gate closed: nothing is requested; the time correction is redone for this moment from the held reports.
    if (same) {
      const held = await planFor(last, estimateFor(last, last.estimatedFor), t);
      if (!held.allowed) {
        const estimatedFor = { nowMs: t, altitudeM, combine: s.combine, timeCorrect: s.timeCorrect };
        last = { ...last, estimatedFor, edited: false };
        await writeLast(last);
        return finish(last, false, t);
      }
    }

    const ctx = { getJSON: net.getJSON, getText: net.getText, cache, now: () => new Date(t) };
    const fetched = await fetchObservations(point, {
      radiusM: s.searchRadiusM, maxAgeS: s.maxAgeS, deviceHeightM: altitudeM, modes, ctx, onProgress, sources,
    });
    const errors = fetched.errors.map(({ source, error }) => ({ sourceId: source.id, kind: error.kind ?? null, message: error.message }));
    if (!fetched.observations.length) {
      const loading = fetched.status.some((x) => x.reason === 'listLoading');
      return { ok: false, code: errors.length ? 'unreachable' : loading ? 'listLoading' : 'noStation', errors, status: fetched.status };
    }
    const estimatedFor = { nowMs: t, altitudeM, combine: s.combine, timeCorrect: s.timeCorrect };
    const next = {
      v: LAST_VERSION, fetchedAt: t, point, altitudeM, radiusM: s.searchRadiusM, maxAgeS: s.maxAgeS, modes,
      observations: fetched.observations, status: fetched.status, retry: 0, estimatedFor, edited: false,
    };
    const result = estimateFor(next, estimatedFor);
    if (!result.fresh) return { ok: false, code: 'noFresh', errors, status: fetched.status };

    // Retry bookkeeping: the same observation times as before, after the gate, mean the new report is not out yet.
    const key = (o) => `${o.sourceId}:${o.station.id}:${+o.time}`;
    if (same) {
      const before = new Set(last.observations.map(key));
      const unchanged = contributors(result).every((c) => before.has(key(c.obs)));
      next.retry = unchanged ? (last.retry ?? 0) + 1 : 0;
    }
    await updateHistories(result, onProgress, ctx);
    await writeLast(next);
    return finish(next, true, t, errors);
  }

  async function finish(last, fetched, t, errors = []) {
    const result = estimateFor(last, last.estimatedFor);
    const q = (x) => (Number.isFinite(x?.value) ? x.value : null);
    const values = { tempC: q(result.temperature), pressurePa: q(result.pressure), humidity: q(result.humidity) };
    const missing = Object.entries({ temperature: values.tempC, pressure: values.pressurePa, humidity: values.humidity })
      .filter(([, v]) => v == null).map(([k]) => k);
    if (missing.length === 3) return { ok: false, code: 'noValues', errors };
    const stationCount = new Set([result.pressure, result.temperature, result.humidity]
      .flatMap((x) => x.used.map((u) => `${u.row.obs.sourceId}:${u.row.obs.station.id}`))).size;
    const listLoading = last.status.some((x) => x.reason === 'listLoading');
    return { ok: true, fetched, values, missing, result, stationCount, listLoading, at: t, plan: await planFor(last, result, t), last, errors };
  }

  /**
   * Record the observation times of the contributing stations and, for one METAR station without a known interval,
   * ask the source once for its recent reports (that service is throttled per IP: one station per fetch at most, and a
   * station is asked once — the answer lives with its history for a week).
   */
  async function updateHistories(result, onProgress, ctx) {
    const who = contributors(result);
    let asked = false;
    for (const { obs } of who) {
      const key = historyKey(obs.sourceId, obs.station.id);
      let h = (await cache.get(key)) ?? emptyHistory(key);
      h = recordObservation(h, +obs.time);
      const a = adapter(obs.sourceId);
      if (!asked && a?.recentTimes && h.intervalSource !== 'source' && !h.recentTried) {
        asked = true;
        h = { ...h, recentTried: true };
        onProgress?.(a, { code: 'loadingSchedule', id: obs.station.id });
        try { h = recordSourceTimes(h, (await a.recentTimes(obs.station.id, ctx)).map(Number)); } catch { /* throttled or offline: skip */ }
      }
      await cache.set(key, h, HISTORY_TTL_S);
    }
  }

  /** The shown values were edited by hand (or replaced by a preset): the stored details no longer describe them. */
  async function noteEdited() {
    const last = await readLast();
    if (last && !last.edited) await writeLast({ ...last, edited: true });
  }

  return { get, status, lastEstimate, readLast, noteEdited, clearMemo() { lastMemo = undefined; } };
}
