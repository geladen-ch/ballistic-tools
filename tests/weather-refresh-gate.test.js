// Refresh gating: interval estimation, per-station history, the gate, retries, stopped stations, several stations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GATE, estimateInterval, emptyHistory, intervalOf, recordObservation, recordSourceTimes, planRefresh, contributors, historyKey,
} from '../src/weather/refresh-gate.js';
import { minToS, sToMs } from '../src/quantity.js';

const min = (m) => sToMs(minToS(m));
const T0 = Date.UTC(2026, 10, 16, 12, 0);

test('estimateInterval: median of the differences, clamped, snapped to a common interval within ±10 %', () => {
  assert.equal(estimateInterval([T0]), null);
  assert.equal(estimateInterval([T0, T0]), null);
  assert.equal(estimateInterval([T0, T0 + min(30)]), minToS(30));                           // one difference as it is
  assert.equal(estimateInterval([T0, T0 + min(30), T0 + min(60), T0 + min(90)]), minToS(30));
  // a special report makes a short gap; the median ignores it
  assert.equal(estimateInterval([T0, T0 + min(30), T0 + min(60), T0 + min(68), T0 + min(90), T0 + min(120), T0 + min(150)]), minToS(30));
  assert.equal(estimateInterval([T0, T0 + min(32)]), minToS(30));                           // 32 min is within 10 % of 30
  assert.equal(estimateInterval([T0, T0 + min(36)]), minToS(36));                           // not near a common interval: kept
  assert.equal(estimateInterval([T0, T0 + min(1)]), minToS(5));                             // clamped up
  assert.equal(estimateInterval([T0, T0 + min(600)]), minToS(180));                         // clamped down
  assert.equal(estimateInterval([T0 + min(30), T0, T0 + min(60)]), minToS(30), 'order does not matter');
});

test('history: keeps the last eight times, learns a local interval, a source interval is not overridden', () => {
  let h = emptyHistory('k');
  assert.deepEqual(intervalOf(h, { nominalIntervalS: minToS(30) }), { intervalS: minToS(30), source: 'default' });
  h = recordObservation(h, T0);
  assert.equal(h.intervalS, null);
  h = recordObservation(h, T0 + min(10));
  assert.deepEqual([h.intervalS, h.intervalSource], [minToS(10), 'local']);
  assert.equal(recordObservation(h, T0 + min(10)), h, 'a known time changes nothing');
  for (let i = 2; i < 12; i++) h = recordObservation(h, T0 + min(10 * i));
  assert.equal(h.times.length, GATE.historyLength);
  assert.equal(h.times.at(-1), T0 + min(110));

  const s = recordSourceTimes(emptyHistory('k'), [T0, T0 + min(30), T0 + min(60)]);
  assert.deepEqual([s.intervalS, s.intervalSource], [minToS(30), 'source']);
  const after = recordObservation(s, T0 + min(90));
  assert.deepEqual([after.intervalS, after.intervalSource], [minToS(30), 'source']);
});

test('history: three deviating gaps in a row re-estimate even a source interval; a normal gap resets the count', () => {
  let h = recordSourceTimes(emptyHistory('k'), [T0, T0 + min(60), T0 + min(120)]);      // hourly
  assert.equal(h.intervalS, minToS(60));
  let t = T0 + min(120);
  for (const gap of [10, 10]) { t += min(gap); h = recordObservation(h, t); }
  assert.equal(h.intervalSource, 'source');
  assert.equal(h.deviations, 2);
  t += min(60); h = recordObservation(h, t);                                             // a normal gap resets
  assert.equal(h.deviations, 0);
  for (const gap of [10, 10, 10]) { t += min(gap); h = recordObservation(h, t); }
  assert.equal(h.intervalSource, 'local');
  assert.equal(h.intervalS, minToS(10));
  assert.equal(h.deviations, 0);
});

const stationAt = (ageMin, o = {}) => ({ tObs: T0 - min(ageMin), intervalS: minToS(30), minRefreshS: minToS(10), ...o });
const plan = (o) => planRefresh({ now: T0, fetchedAt: T0 - min(5), retryCount: 0, ...o });

test('gate: no request before tObs + max(Δ, 10 min); the next report time is given', () => {
  const p = plan({ stations: [stationAt(20)] });                                          // report 20 min old, Δ 30 min
  assert.equal(p.allowed, false);
  assert.equal(p.gateAt, T0 - min(20) + min(30));
  assert.equal(p.nextExpectedAt, T0 + min(10));
  assert.equal(p.intervalS, minToS(30));
  // exactly at the gate it is allowed
  assert.equal(plan({ now: T0 + min(10), stations: [stationAt(20)] }).allowed, true);
  assert.equal(plan({ now: T0 + min(10) - 1, stations: [stationAt(20)] }).allowed, false);
});

test('gate: the data must be at least 10 min old whatever Δ is (fast stations)', () => {
  const fast = { intervalS: minToS(5) };
  assert.equal(plan({ stations: [stationAt(7, fast)], fetchedAt: T0 - min(20) }).allowed, false);      // 7 min old, Δ 5
  assert.equal(plan({ stations: [stationAt(7, fast)], fetchedAt: T0 - min(20) }).gateAt, T0 - min(7) + min(10));
  assert.equal(plan({ stations: [stationAt(11, fast)], fetchedAt: T0 - min(20) }).allowed, true);
});

test("gate: never faster than the source's own minimum between two requests", () => {
  const s = stationAt(40, { minRefreshS: minToS(15) });                                     // report long overdue
  assert.equal(plan({ stations: [s], fetchedAt: T0 - min(5) }).allowed, false);
  assert.equal(plan({ stations: [s], fetchedAt: T0 - min(15) }).allowed, true);
});

test('gate: after the gate an unchanged report is retried after 2, 4, then 8 min — capped at Δ/2, never below the source minimum', () => {
  const s = stationAt(35, { minRefreshS: 0 });                                              // gate passed 5 min ago
  const at = (retryCount, sinceFetchMin) => plan({ stations: [s], retryCount, fetchedAt: T0 - min(sinceFetchMin) });
  assert.equal(at(1, 1).allowed, false); assert.equal(at(1, 2).allowed, true);
  assert.equal(at(2, 3).allowed, false); assert.equal(at(2, 4).allowed, true);
  assert.equal(at(3, 7).allowed, false); assert.equal(at(3, 8).allowed, true);
  assert.equal(at(9, 7).allowed, false, 'beyond three retries the last step repeats');
  // Δ/2 caps the step: Δ = 10 min → at most 5 min
  const fast = stationAt(15, { intervalS: minToS(10), minRefreshS: 0 });
  assert.equal(plan({ stations: [fast], retryCount: 3, fetchedAt: T0 - min(5) }).allowed, true);
  assert.equal(plan({ stations: [fast], retryCount: 3, fetchedAt: T0 - min(4) }).allowed, false);
  // the source minimum is the floor of the wait
  const slow = stationAt(35, { minRefreshS: minToS(10) });
  assert.equal(plan({ stations: [slow], retryCount: 1, fetchedAt: T0 - min(9) }).allowed, false);
  assert.equal(plan({ stations: [slow], retryCount: 1, fetchedAt: T0 - min(10) }).allowed, true);
});

test('gate: a station that stopped reporting (older than three intervals) no longer holds the gate', () => {
  const dead = stationAt(100, { intervalS: minToS(30) });                                   // 100 min > 3 × 30
  const p = plan({ stations: [dead], fetchedAt: T0 - min(11) });
  assert.equal(p.allowed, true);
  assert.equal(p.nextExpectedAt, null);
  assert.equal(plan({ stations: [dead], fetchedAt: T0 - min(5) }).allowed, false, 'the source minimum still applies');
  const alive = stationAt(89, { intervalS: minToS(30) });                                   // just inside 3 × Δ
  assert.equal(plan({ stations: [alive], fetchedAt: T0 - min(60) }).allowed, true, 'overdue, so a request is allowed');
});

test('gate: several stations — the earliest due one opens it', () => {
  const a = stationAt(10, { intervalS: minToS(60) });                                       // due in 50 min
  const b = stationAt(28, { intervalS: minToS(30) });                                       // due in 2 min
  const p = plan({ stations: [a, b], fetchedAt: T0 - min(20) });
  assert.equal(p.gateAt, T0 + min(2));
  assert.equal(p.intervalS, minToS(30));
  assert.equal(plan({ now: T0 + min(2), stations: [a, b], fetchedAt: T0 - min(20) }).allowed, true);
});

test('gate: nothing held → allowed; an overdue report gives no next-report time', () => {
  assert.equal(plan({ stations: [] }).allowed, true);
  assert.equal(plan({ stations: [stationAt(40)], fetchedAt: T0 - min(30) }).nextExpectedAt, null);
});

test('contributors: stations with weight ≥ 10 % in any quantity, else the strongest one', () => {
  const obs = (id) => ({ sourceId: 's', station: { id }, time: new Date(T0) });
  const used = (...ws) => ({ used: ws.map(([id, weight]) => ({ row: { obs: obs(id) }, weight })) });
  const result = { pressure: used(['A', 0.6], ['B', 0.05]), temperature: used(['B', 0.12], ['C', 0.03]), humidity: used(['A', 1]), stations: [] };
  assert.deepEqual(contributors(result).map((c) => c.obs.station.id).sort(), ['A', 'B']);
  const weak = { pressure: used(['A', 0.04], ['B', 0.07]), temperature: used(), humidity: used(), stations: [] };
  assert.deepEqual(contributors(weak).map((c) => c.obs.station.id), ['B']);
  const none = { pressure: used(), temperature: used(), humidity: used(), stations: [{ obs: obs('Z') }] };
  assert.deepEqual(contributors(none).map((c) => c.obs.station.id), ['Z']);
  assert.equal(historyKey('iem', 'LSZH'), 'weather:history:iem:LSZH');
});
