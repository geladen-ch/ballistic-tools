// Refresh gating: a station reports on its own schedule, so a request can only bring something new once its next report
// is due. Pure rules plus the per-station history records; no network, no storage. All times are epoch milliseconds,
// all intervals and durations seconds.
//
// Rule: a request is not allowed before tObs + max(Δ, 10 min) — the station's update interval has elapsed since the
// observation we hold, and the data is at least 10 min old whatever Δ is. Before that, a refresh only recalculates the
// time correction from the cached reports. After the gate, a request that returns the same observation time is retried
// after 2, then 4, then 8 min (capped at Δ/2, never below the source's own minimum). A station that stopped reporting
// (older than three intervals) no longer holds the gate. With several stations the earliest due one decides, among
// those that weigh at least 10 % in the result.
import { minToS, sToMs, msToS } from '../quantity.js';

export const GATE = Object.freeze({
  minAgeS: minToS(10),
  minIntervalS: minToS(5),
  maxIntervalS: minToS(180),
  snapToS: Object.freeze([10, 15, 20, 30, 60, 180].map(minToS)),
  snapTolerance: 0.1,
  retryS: Object.freeze([minToS(2), minToS(4), minToS(8)]),
  stoppedIntervals: 3,
  deviation: 0.5,
  deviationRuns: 3,
  historyLength: 8,
  weightMin: 0.1,
});

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/**
 * Update interval Δ (seconds) from observation times: the median of the consecutive differences (special reports make
 * occasional short gaps; one difference is used as it is), clamped to 5 min … 3 h, snapped to a common interval within
 * ±10 %. Null with fewer than two distinct times.
 */
export function estimateInterval(timesMs) {
  const t = [...new Set(timesMs)].sort((a, b) => a - b);
  if (t.length < 2) return null;
  const diffs = [];
  for (let i = 1; i < t.length; i++) diffs.push(msToS(t[i] - t[i - 1]));
  let d = Math.min(GATE.maxIntervalS, Math.max(GATE.minIntervalS, median(diffs)));
  const near = GATE.snapToS.find((c) => Math.abs(d - c) <= c * GATE.snapTolerance);
  if (near) d = near;
  return d;
}

/**
 * A station's history record: `{ key, times, intervalS, intervalSource: 'source'|'local'|'default', deviations }`.
 * (`default` means no interval is known: the source's nominal one applies.)
 */
export function emptyHistory(key) {
  return { key, times: [], intervalS: null, intervalSource: 'default', deviations: 0 };
}

/** The interval to use for a station: its learned one, else the source's nominal one. */
export function intervalOf(history, adapter) {
  if (history?.intervalS) return { intervalS: history.intervalS, source: history.intervalSource };
  return { intervalS: adapter?.nominalIntervalS ?? minToS(60), source: 'default' };
}

/**
 * Record a newly seen observation time. Keeps the last eight. The interval is re-estimated from the local times unless
 * the source gave one; a source or local interval is also recomputed after three new differences in a row that deviate
 * from it by more than 50 % (a station's schedule can change).
 * @returns {object} the updated history (the input is not modified)
 */
export function recordObservation(history, tObsMs) {
  if (history.times.includes(tObsMs)) return history;
  const times = [...history.times, tObsMs].sort((a, b) => a - b).slice(-GATE.historyLength);
  const next = { ...history, times };
  const idx = times.indexOf(tObsMs);
  const prev = times[idx - 1];
  if (history.intervalS && prev != null && idx === times.length - 1) {
    const gap = msToS(tObsMs - prev);
    next.deviations = Math.abs(gap - history.intervalS) > history.intervalS * GATE.deviation ? history.deviations + 1 : 0;
  }
  const local = estimateInterval(times);
  if (history.intervalSource !== 'source' && local) {
    next.intervalS = local;
    next.intervalSource = 'local';
  } else if (next.deviations >= GATE.deviationRuns && local) {
    next.intervalS = local;
    next.intervalSource = 'local';
    next.deviations = 0;
  }
  return next;
}

/** Record an interval the source itself gave (a list of recent observation times); the times join the local history. */
export function recordSourceTimes(history, timesMs) {
  let next = { ...history, times: [...new Set([...history.times, ...timesMs])].sort((a, b) => a - b).slice(-GATE.historyLength) };
  const interval = estimateInterval(timesMs);
  if (interval) next = { ...next, intervalS: interval, intervalSource: 'source', deviations: 0 };
  return next;
}

/**
 * Decide whether a request is allowed now.
 * @param {{now:number, fetchedAt:number, retryCount:number,
 *   stations:{tObs:number, intervalS:number, minRefreshS:number}[]}} o
 *   stations: the contributing ones (weight ≥ 10 %), tObs = the observation time held, intervalS = Δ (learned or nominal)
 * @returns {{allowed:boolean, gateAt:number|null, nextExpectedAt:number|null, intervalS:number|null}}
 *   gateAt: when a request becomes allowed (≤ now when allowed); nextExpectedAt: when the next report is expected
 *   (null if unknown, or already overdue); intervalS: Δ of the station that decides
 */
export function planRefresh({ now, fetchedAt, retryCount = 0, stations }) {
  if (!stations.length) return { allowed: true, gateAt: now, nextExpectedAt: null, intervalS: null };
  let best = null;
  for (const s of stations) {
    const stopped = now - s.tObs > sToMs(GATE.stoppedIntervals * s.intervalS);
    const gateAt = stopped
      ? fetchedAt + sToMs(s.minRefreshS)
      : s.tObs + sToMs(Math.max(s.intervalS, GATE.minAgeS));
    const nextExpectedAt = stopped ? null : s.tObs + sToMs(s.intervalS);
    if (!best || gateAt < best.gateAt) best = { ...s, gateAt, nextExpectedAt, stopped };
  }
  let gateAt = best.gateAt;
  // After the gate, an unchanged observation time means the report is not published yet: retry in growing steps.
  if (retryCount > 0 && now >= gateAt) {
    const step = GATE.retryS[Math.min(retryCount, GATE.retryS.length) - 1];
    const wait = Math.max(best.minRefreshS, Math.min(step, best.intervalS / 2));
    gateAt = Math.max(gateAt, fetchedAt + sToMs(wait));
  }
  // Never faster than the source's own minimum between two requests.
  gateAt = Math.max(gateAt, fetchedAt + sToMs(best.minRefreshS));
  const nextExpectedAt = best.nextExpectedAt != null && best.nextExpectedAt > now ? best.nextExpectedAt : null;
  return { allowed: now >= gateAt, gateAt, nextExpectedAt, intervalS: best.intervalS };
}

/** Stations of a result that count for the gate: weight ≥ 10 % in any quantity (the nearest one if none does). */
export function contributors(result) {
  const weights = new Map();
  for (const q of [result.pressure, result.temperature, result.humidity]) {
    for (const u of q?.used ?? []) {
      const o = u.row.obs;
      const k = `${o.sourceId}:${o.station.id}`;
      const prev = weights.get(k);
      weights.set(k, { obs: o, weight: Math.max(u.weight ?? 0, prev?.weight ?? 0) });
    }
  }
  const strong = [...weights.values()].filter((w) => w.weight >= GATE.weightMin);
  if (strong.length) return strong;
  if (weights.size) return [[...weights.values()].sort((a, b) => b.weight - a.weight)[0]];
  return result.stations?.length ? [{ obs: result.stations[0].obs, weight: 1 }] : [];
}

export const historyKey = (sourceId, stationId) => `weather:history:${sourceId}:${stationId}`;
