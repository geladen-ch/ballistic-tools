import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, near } from './helpers/weather-fixtures.js';
import { degToRad, hpaToPa, kmToM, minToS, sToMs } from '../src/quantity.js';
import { combine, median, COMBINE_DEFAULTS } from '../src/weather/combine.js';
import { estimate } from '../src/weather/pipeline.js';
import { iem } from '../src/weather/sources/iem.js';
import { createMemoryCache } from '../src/weather/cache.js';
import { isaPressureFromQnh, isaShiftTemperature, hypsometricShiftPressure, rhAtConstantVapour } from '../src/weather/atmosphere.js';
import { diurnalCorrection } from '../src/weather/diurnal.js';

const rad = degToRad;
const c = (dKm, hM, value, id = '') => ({ distanceM: kmToM(dKm), hM, value, id });

// ---------- combine() ----------
test('combine: median, even count = mean of the middle two', () => {
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 3, 2]), 2.5); assert.ok(Number.isNaN(median([])));
});

test('combine: one candidate = that station; none = null', () => {
  const r = combine([c(30, 500, 12.3)], 500, 't');
  assert.equal(r.value, 12.3); assert.equal(r.used.length, 1); assert.equal(r.used[0].weight, 1); assert.equal(r.check, null);
  assert.equal(combine([], 500, 't').value, null);
});

test('combine: inverse-distance weights with power 1.5', () => {
  const r = combine([c(10, 0, 10), c(40, 0, 20)], 0, 'rh');
  const w1 = 1 / kmToM(10) ** 1.5, w2 = 1 / kmToM(40) ** 1.5;
  near(r.value, (10 * w1 + 20 * w2) / (w1 + w2), 1e-9);
  near(r.used[0].weight, w1 / (w1 + w2), 1e-12);
  near(r.used[0].weight + r.used[1].weight, 1, 1e-12);
});

test('combine: effective distance uses λ = 200 (100 m of height ≈ 20 km)', () => {
  const r = combine([c(15, 600, 1)], 500, 'p');
  near(r.used[0].deffM, Math.hypot(kmToM(15), kmToM(20)), 1e-6);
  // a station 5 km away but 500 m higher ranks behind one 30 km away at the same height
  const r2 = combine([c(5, 1000, 1, 'high'), c(30, 500, 2, 'level')], 500, 'p');
  assert.deepEqual(r2.used.map((x) => x.id), ['level', 'high']);
});

test('combine: minimum effective distance 100 m', () => {
  const r = combine([c(0, 500, 1), c(0.05, 500, 2), c(10, 500, 3)], 500, 'rh');
  near(r.used[0].weight, r.used[1].weight, 1e-12);
});

test('combine: only the k = 8 nearest by effective distance are used', () => {
  const cands = Array.from({ length: 12 }, (_, i) => c(10 + i, 500, 0, `s${i}`));
  const r = combine(cands, 500, 't');
  assert.equal(r.used.length, COMBINE_DEFAULTS.k); assert.equal(r.considered, 8); assert.equal(r.candidates, 12);
  assert.equal(r.used.at(-1).id, 's7');
});

test('combine: buddy check rejects an injected +15 K station', () => {
  const vals = [10.0, 10.4, 9.6, 10.2, 25.0, 9.9];
  const r = combine(vals.map((v, i) => c(10 + 5 * i, 400, v, `s${i}`)), 400, 't');
  assert.deepEqual(r.rejected.map((x) => x.id), ['s4']);
  near(r.rejected[0].deviation, 25 - r.check.median, 1e-9);
  assert.equal(r.rejected[0].threshold, 5);              // floor: MAD × 7 × 1.4826 is smaller here
  assert.ok(Math.abs(r.value - 10) < 0.3);
});

test('combine: buddy check keeps a genuine mountain–valley spread (MAD-scaled threshold)', () => {
  const vals = [2, 8, -3, 6, 0, 9, -1, 4];        // spread of 12 K, no outlier
  const r = combine(vals.map((v, i) => c(10 + i, 500, v)), 500, 't');
  assert.equal(r.rejected.length, 0); assert.equal(r.used.length, 8);
  assert.ok(r.check.threshold > 5);
});

test('combine: pressure floor 300 Pa; RH is never checked', () => {
  const P = hpaToPa;
  const rp = combine([c(10, 0, P(1000)), c(20, 0, P(1000.2)), c(25, 0, P(1000.1)), c(30, 0, P(1005))], 0, 'p');
  assert.equal(rp.rejected.length, 1); assert.equal(rp.check.threshold, 300);
  const rh = combine([c(10, 0, 0.5), c(20, 0, 0.52), c(30, 0, 0.99)], 0, 'rh');
  assert.equal(rh.rejected.length, 0); assert.equal(rh.check, null);
});

test('combine: two candidates are not checked', () => {
  const r = combine([c(10, 0, 0), c(20, 0, 30)], 0, 't');
  assert.equal(r.check, null); assert.equal(r.used.length, 2);
});

test('combine: at least half of the neighbours always survive', () => {
  const r = combine([c(1, 0, 0), c(2, 0, 0), c(3, 0, 100), c(4, 0, 200), c(5, 0, -300)], 0, 't');
  assert.ok(r.used.length >= 3);
});

// ---------- estimate() (pipeline: time correction → device height → combine) ----------
const NOW = new Date('2026-06-21T06:20:00Z');
function obs(id, dKm, elev, { T = 15, qnhHpa = 1015, rh = 0.7, ageMin = 20, lat = 47.4, lon = 8.5, stale } = {}) {
  return {
    sourceId: 'test', attribution: '',
    station: { id, name: id, latRad: rad(lat), lonRad: rad(lon), elevM: elev, distanceM: kmToM(dKm) },
    time: new Date(+NOW - sToMs(minToS(ageMin))), temperatureC: T, dewpointC: null, humidity: rh,
    pressure: qnhHpa == null ? null : { kind: 'qnh', pa: hpaToPa(qnhHpa) }, raw: null, notes: [], ...(stale ? { stale } : {}),
  };
}

test('estimate: each station is time-corrected, then moved to device height, then combined', () => {
  const o = [obs('A', 5, 400, { T: 10 }), obs('B', 20, 600, { T: 9 }), obs('C', 40, 500, { T: 11 })];
  const e = estimate(o, 450, { now: NOW });
  assert.equal(e.mode, 'multi');
  const a = e.temperature.used.find((x) => x.row.obs.station.id === 'A');
  const dT = diurnalCorrection(rad(47.4), rad(8.5), o[0].time, NOW).dT;
  assert.ok(dT > 0.3, 'June morning warms');
  near(a.row.dT, dT, 1e-12);
  near(a.value, isaShiftTemperature(10 + dT, 400, 450), 1e-9);
  // pressure: QNH → station level (ISA, exact) → device with the reported (not time-corrected) station temperature
  near(e.pressure.used[0].value, hypsometricShiftPressure(isaPressureFromQnh(hpaToPa(1015), 400), 400, 450, 10), 1e-6);
  // RH brought forward with the temperature at constant vapour pressure (warmer now → lower RH); not adjusted in height
  near(e.humidity.used.find((x) => x.row.obs.station.id === 'A').value, rhAtConstantVapour(0.7, 10, 10 + dT), 1e-9);
  assert.ok(e.humidity.value < 0.7, `${e.humidity.value}`);
});

test('estimate: time correction can be switched off', () => {
  const e = estimate([obs('A', 5, 400, { T: 10 })], 400, { now: NOW, timeCorrect: false });
  assert.equal(e.temperature.value, 10); assert.equal(e.temperature.used[0].row.dT, null);
});

test('estimate: per quantity — a station without pressure still gives temperature', () => {
  const e = estimate([obs('A', 5, 400, { qnhHpa: null }), obs('B', 10, 400)], 400, { now: NOW });
  assert.deepEqual(e.pressure.used.map((x) => x.row.obs.station.id), ['B']);
  assert.equal(e.temperature.used.length, 2);
});

test('estimate: missing station elevation → excluded from T and p, kept for RH with Δh = 0', () => {
  const e = estimate([obs('A', 5, null, { rh: 0.9 }), obs('B', 30, 400, { rh: 0.6 })], 400, { now: NOW });
  assert.deepEqual(e.temperature.used.map((x) => x.row.obs.station.id), ['B']);
  assert.deepEqual(e.pressure.used.map((x) => x.row.obs.station.id), ['B']);
  assert.equal(e.humidity.used.length, 2);
  near(e.humidity.used[0].deffM, kmToM(5), 1e-6);
});

test('estimate: without altitude → nearest station, station temperature, no pressure value', () => {
  const e = estimate([obs('A', 5, 400, { T: 10 }), obs('B', 20, 600)], null, { now: NOW, timeCorrect: false });
  assert.equal(e.mode, 'nearest'); assert.equal(e.reason, 'noAltitude');
  assert.equal(e.temperature.value, 10); assert.equal(e.pressure.value, null);
});

test('estimate: "combine" off → nearest station with T and pressure', () => {
  const e = estimate([obs('A', 5, 400, { qnhHpa: null }), obs('B', 20, 600, { T: 8 })], 600, { now: NOW, combine: false, timeCorrect: false });
  assert.equal(e.mode, 'nearest'); assert.equal(e.reason, 'setting');
  assert.equal(e.stations[0].obs.station.id, 'B'); assert.equal(e.temperature.value, 8);
});

test('estimate: only stale data → nearest older report, not time-corrected', () => {
  const e = estimate([obs('A', 5, 400, { ageMin: 200, stale: true })], 400, { now: NOW });
  assert.equal(e.mode, 'nearest'); assert.equal(e.reason, 'stale'); assert.equal(e.temperature.used[0].row.dT, null);
});

test('estimate: reports older than the maximum age at the evaluation time are left out', () => {
  const e = estimate([obs('A', 5, 400, { ageMin: 100 }), obs('B', 30, 400, { ageMin: 10 })], 400, { now: NOW, maxAgeS: minToS(90) });
  assert.equal(e.fresh, 1); assert.deepEqual(e.temperature.used.map((x) => x.row.obs.station.id), ['B']);
});

test('estimate: no observations → mode none', () => {
  assert.equal(estimate([], 400, { now: NOW }).mode, 'none');
});

// ---------- fixture integration (saved IEM responses, 2026-11-13 ~22:30Z) ----------
const FNOW = new Date('2026-11-13T22:45:00Z');
function fixtureCtx() {
  const getJSON = async (url) => {
    let m;
    if (url.endsWith('/geojson/networks.geojson')) return fixture('iem-networks.geojson');
    if ((m = /\/geojson\/network\/(\w+)\.geojson$/.exec(url))) {
      try { return fixture(`iem-stations-${m[1]}.geojson`); } catch { return { type: 'FeatureCollection', features: [] }; }
    }
    if ((m = /currents\.json\?network=(\w+)$/.exec(url))) {
      try { return fixture(`iem-currents-${m[1]}.json`); } catch { return { data: [] }; }
    }
    throw new Error(`unexpected URL ${url}`);
  };
  return { getJSON, getText: async () => '', cache: createMemoryCache(), now: () => FNOW };
}

test('fixture: Zürich (470 m) combines 8 Swiss stations, LSMD and LSZH carry most weight', async () => {
  const o = await iem.nearest({ latRad: rad(47.37), lonRad: rad(8.54) }, {}, fixtureCtx());
  assert.ok(o.length > 8, `only ${o.length} candidates`);
  const e = estimate(o, 470, { now: FNOW });
  assert.equal(e.mode, 'multi');
  const ids = e.temperature.used.map((x) => x.row.obs.station.id);
  assert.deepEqual(ids.slice(0, 3), ['LSMD', 'LSZH', 'LSME']);
  assert.equal(ids.length, 8);
  assert.ok(e.temperature.used[0].weight + e.temperature.used[1].weight > 0.7);
  near(e.pressure.value, isaPressureFromQnh(hpaToPa(1018), 470), hpaToPa(1.0));
  near(e.temperature.value, 0.1, 0.5);
  for (const x of e.temperature.used) assert.ok(x.row.dT < 0 && x.row.dT > -0.2, 'night: small cooling');
});

test('fixture: Basel (280 m) is dominated by LFSB across the border', async () => {
  const o = await iem.nearest({ latRad: rad(47.56), lonRad: rad(7.59) }, {}, fixtureCtx());
  const e = estimate(o, 280, { now: FNOW });
  const top = e.pressure.used[0];
  assert.equal(top.row.obs.station.id, 'LFSB');
  assert.ok(top.weight > 0.7, `LFSB weight ${top.weight}`);
  near(e.temperature.value, -1.2, 0.8);
});
