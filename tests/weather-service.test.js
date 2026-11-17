// The weather service: fetch vs recalculate-only by the refresh gate, retries, new position / altitude, failures,
// the per-station history and the one-time schedule lookup, the persisted last result. Fake adapter, mutable clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherService, SAME_POSITION_M, ALTITUDE_CHANGE_M } from '../src/weather/service.js';
import { createMemoryCache } from '../src/weather/cache.js';
import { degToRad, hpaToPa, kmToM, minToS, sToMs } from '../src/quantity.js';
import { historyKey } from '../src/weather/refresh-gate.js';

const ll = (latDeg, lonDeg) => ({ latRad: degToRad(latDeg), lonRad: degToRad(lonDeg) });
const min = (m) => sToMs(minToS(m));
const T0 = Date.UTC(2026, 10, 16, 12, 0);
const HERE = ll(47.37, 8.54);

function setup({ failCurrent = false, withSchedule = false } = {}) {
  let clock = T0;
  const state = { reportAgeMin: 20, calls: { stations: 0, current: 0, schedule: 0 }, failCurrent };
  // one report per station, observed at (a fixed "report time"); advancing the report time simulates a new report
  const reportTime = { A: T0 - min(20), B: T0 - min(20) };
  const stations = [
    { id: 'A', name: 'Alpha', ...ll(47.38, 8.55), elevM: 460, ids: {} },
    { id: 'B', name: 'Beta', ...ll(47.30, 8.60), elevM: 520, ids: {} },
  ];
  const adapter = {
    id: 'fake', name: 'Fake', attribution: 'x', homepage: '', coverage: { kind: 'global' },
    minRefreshS: minToS(10), nominalIntervalS: minToS(30),
    async stations() { state.calls.stations++; return stations; },
    async current(metas) {
      state.calls.current++;
      if (state.failCurrent) throw Object.assign(new Error('down'), { kind: 'network' });
      return metas.map((m) => ({
        sourceId: 'fake', reportType: 'METAR', attribution: 'x', notes: [], qc: [], precision: { tC: 0.1 },
        station: { id: m.id, name: m.name, latRad: m.latRad, lonRad: m.lonRad, elevM: m.elevM, barometerM: null, distanceM: m.distanceM, ids: m.ids },
        time: new Date(reportTime[m.id]), temperatureC: 8, humidity: 0.7, pressure: { kind: 'qnh', pa: hpaToPa(1015) },
      }));
    },
    ...(withSchedule ? { async recentTimes() { state.calls.schedule++; return [0, 30, 60].map((m) => new Date(T0 - min(90 - m))); } } : {}),
  };
  const cache = createMemoryCache(() => clock);
  const settings = { searchRadiusM: kmToM(150), maxAgeS: minToS(90), combine: true, timeCorrect: true };
  const make = () => createWeatherService({
    runtime: { net: { getJSON: async () => { throw new Error('no network'); }, getText: async () => '' }, cache, sources: [adapter] },
    now: () => clock, getSettings: () => settings, getModes: () => ({}),
  });
  return { svc: make(), make, cache, state, reportTime, settings, adapter, setClock: (ms) => { clock = ms; }, clockNow: () => clock };
}

test('first press fetches; the values, station count and next report time come back, and the result is kept', async () => {
  const { svc, state, cache } = setup();
  const r = await svc.get({ point: HERE, altitudeM: 480 });
  assert.equal(r.ok, true); assert.equal(r.fetched, true);
  assert.equal(state.calls.current, 1);
  assert.ok(Number.isFinite(r.values.tempC) && Number.isFinite(r.values.pressurePa) && Number.isFinite(r.values.humidity));
  assert.equal(r.stationCount, 2);
  assert.deepEqual(r.missing, []);
  assert.equal(r.plan.nextExpectedAt, T0 - min(20) + min(30));
  assert.equal(r.plan.intervalS, minToS(30));
  const last = await cache.get('last');
  assert.equal(last.v, 1);
  assert.equal(last.observations.length, 2);
  assert.equal(last.retry, 0);
});

test('before the gate a press requests nothing: it recalculates for the current moment from the held reports', async () => {
  const { svc, state, setClock } = setup();
  const first = await svc.get({ point: HERE, altitudeM: 480 });
  setClock(T0 + min(5));                                            // report is 25 min old, next one due in 5 min
  const second = await svc.get({ point: HERE, altitudeM: 480 });
  assert.equal(second.ok, true); assert.equal(second.fetched, false);
  assert.equal(state.calls.current, 1, 'no new request');
  assert.equal(state.calls.stations, 1);
  assert.equal(second.at, T0 + min(5));
  assert.equal(second.values.pressurePa, first.values.pressurePa, 'pressure does not depend on the time');
  assert.notEqual(second.values.tempC, first.values.tempC, 'the sun-angle correction moved to the new moment');
});

test('after the gate a press requests again; an unchanged report counts a retry, a new one resets it', async () => {
  const { svc, state, reportTime, setClock, cache } = setup();
  await svc.get({ point: HERE, altitudeM: 480 });                     // reports at T0-20; gate at T0+10
  setClock(T0 + min(10));
  const again = await svc.get({ point: HERE, altitudeM: 480 });
  assert.equal(again.fetched, true); assert.equal(state.calls.current, 2);
  assert.equal((await cache.get('last')).retry, 1, 'same observation times after the gate: not published yet');
  // retry wait is the source minimum (10 min) here; a press 3 min later only recalculates
  setClock(T0 + min(13));
  assert.equal((await svc.get({ point: HERE, altitudeM: 480 })).fetched, false);
  setClock(T0 + min(20));
  reportTime.A = reportTime.B = T0 + min(18);                        // the new report is out
  const fresh = await svc.get({ point: HERE, altitudeM: 480 });
  assert.equal(fresh.fetched, true); assert.equal(state.calls.current, 3);
  assert.equal((await cache.get('last')).retry, 0);
});

test('a position beyond 2 km, an altitude change beyond 200 m, or other settings allow a request at once', async () => {
  const { svc, state, settings } = setup();
  await svc.get({ point: HERE, altitudeM: 480 });
  const near = { latRad: HERE.latRad + 1000 / 6371000, lonRad: HERE.lonRad };                     // ~1 km north
  assert.equal((await svc.get({ point: near, altitudeM: 480 })).fetched, false);
  const far = { latRad: HERE.latRad + 2100 / 6371000, lonRad: HERE.lonRad };
  assert.equal((await svc.get({ point: far, altitudeM: 480 })).fetched, true);
  assert.equal(state.calls.current, 2);
  assert.equal((await svc.get({ point: far, altitudeM: 480 + ALTITUDE_CHANGE_M })).fetched, false, '200 m is not more than 200 m');
  assert.equal((await svc.get({ point: far, altitudeM: 480 + ALTITUDE_CHANGE_M + 1 })).fetched, true);
  settings.searchRadiusM = kmToM(100);
  assert.equal((await svc.get({ point: far, altitudeM: 480 + ALTITUDE_CHANGE_M + 1 })).fetched, true, 'a new radius is a new request');
  assert.equal(SAME_POSITION_M, 2000);
});

test('status: the altitude hint appears beyond 200 m, the next report time follows the held reports', async () => {
  const { svc, setClock } = setup();
  assert.deepEqual(await svc.status({ point: HERE, altitudeM: 480 }), { hasLast: false, edited: false, allowed: true, nextExpectedAt: null, intervalS: null, altitudeChanged: false });
  await svc.get({ point: HERE, altitudeM: 480 });
  setClock(T0 + min(1));
  const s = await svc.status({ point: HERE, altitudeM: 480 });
  assert.equal(s.hasLast, true); assert.equal(s.allowed, false); assert.equal(s.altitudeChanged, false);
  assert.equal(s.nextExpectedAt, T0 - min(20) + min(30));
  assert.equal((await svc.status({ point: HERE, altitudeM: 480 + 201 })).altitudeChanged, true);
  assert.equal((await svc.status({ point: HERE, altitudeM: 480 + 200 })).altitudeChanged, false);
  const elsewhere = await svc.status({ point: ll(48.5, 9.5), altitudeM: 900 });
  assert.equal(elsewhere.allowed, true); assert.equal(elsewhere.altitudeChanged, false, 'another place, not an altitude change');
});

test('failures: nothing reachable, no station, only old reports — typed errors, nothing stored', async () => {
  const down = setup({ failCurrent: true });
  const r = await down.svc.get({ point: HERE, altitudeM: 480 });
  assert.deepEqual([r.ok, r.code], [false, 'unreachable']);
  assert.equal(r.errors[0].kind, 'network');
  assert.equal(await down.cache.get('last'), undefined);

  const empty = setup();
  const nowhere = await empty.svc.get({ point: ll(-40, 170), altitudeM: 10 });
  assert.deepEqual([nowhere.ok, nowhere.code], [false, 'noStation']);

  const old = setup();
  old.reportTime.A = old.reportTime.B = T0 - min(300);
  const stale = await old.svc.get({ point: HERE, altitudeM: 480 });
  assert.deepEqual([stale.ok, stale.code], [false, 'noFresh']);
  assert.equal(await old.cache.get('last'), undefined);
});

test('station history: report times are recorded; the schedule is asked for once per station, one station per fetch', async () => {
  const { svc, state, cache, reportTime, setClock } = setup({ withSchedule: true });
  const progress = [];
  await svc.get({ point: HERE, altitudeM: 480, onProgress: (source, msg) => progress.push([source?.id, msg.code]) });
  assert.equal(state.calls.schedule, 1, 'one station only in the first fetch');
  assert.deepEqual(progress.at(-1), ['fake', 'loadingSchedule'], 'same (source, message) shape as the pipeline reports');
  const a = await cache.get(historyKey('fake', 'A'));
  assert.equal(a.intervalSource, 'source');
  assert.equal(a.intervalS, minToS(30));
  assert.ok(a.times.includes(T0 - min(20)));
  const b = await cache.get(historyKey('fake', 'B'));
  assert.equal(b.intervalSource, 'default', 'one report seen, no schedule asked yet');
  assert.equal(b.times.length, 1);
  setClock(T0 + min(15));
  reportTime.A = reportTime.B = T0 + min(10);
  await svc.get({ point: HERE, altitudeM: 480 });
  assert.equal(state.calls.schedule, 2, 'the second station is asked next');
  setClock(T0 + min(60));
  reportTime.A = reportTime.B = T0 + min(40);
  await svc.get({ point: HERE, altitudeM: 480 });
  assert.equal(state.calls.schedule, 2, 'never again for a station already asked');
});

test('noteEdited marks the stored result as no longer describing the shown values, until a new result', async () => {
  const { svc, make } = setup();
  await svc.get({ point: HERE, altitudeM: 480 });
  assert.equal((await svc.status({ point: null })).edited, false);
  await svc.noteEdited();
  assert.equal((await svc.status({ point: null })).edited, true);
  assert.equal((await make().status({ point: null })).edited, true, 'remembered across a reload');
  await svc.get({ point: HERE, altitudeM: 480 });                 // recalculation writes the values again
  assert.equal((await svc.status({ point: null })).edited, false);
});

test('the last result survives a reload (a new service on the same cache) and reproduces the estimate', async () => {
  const { svc, make, cache } = setup();
  const r = await svc.get({ point: HERE, altitudeM: 480 });
  const reloaded = make();
  const stored = await reloaded.lastEstimate();
  assert.equal(stored.last.fetchedAt, T0);
  assert.equal(stored.result.pressure.value, r.values.pressurePa);
  assert.equal(stored.result.temperature.value, r.values.tempC);
  // an old shape is discarded
  await cache.set('last', { ...(await cache.get('last')), v: 0 });
  assert.equal(await make().lastEstimate(), null);
});
