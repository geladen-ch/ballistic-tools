import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, near } from './helpers/weather-fixtures.js';
import { degToRad, radToDeg, hpaToPa, kmToM, minToS, sToMs } from '../src/quantity.js';
import { combine, median, solveLinear, krigingWeights, COMBINE_DEFAULTS } from '../src/weather/combine.js';
import { haversineM } from '../src/weather/geo.js';
import { estimate } from '../src/weather/pipeline.js';
import { iem } from '../src/weather/sources/iem.js';
import { createMemoryCache } from '../src/weather/cache.js';
import { isaPressureFromQnh, isaShiftTemperature, hypsometricShiftPressure, rhAtConstantVapour } from '../src/weather/atmosphere.js';
import { diurnalCorrection } from '../src/weather/diurnal.js';
import { contributors } from '../src/weather/refresh-gate.js';

const rad = degToRad;
const c = (dKm, hM, value, id = '') => ({ distanceM: kmToM(dKm), hM, value, id });
const IDW = { method: 'idw' };

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

// ---------- kriging weights ----------
/** Stations [latDeg, lonDeg, hM, value] around a device [latDeg, lonDeg, hM], as combine() receives them. */
function krigeCase(dev, stations) {
  const [dLat, dLon, dH] = dev;
  const cands = stations.map(([lat, lon, hM, value], i) => ({
    id: i + 1, latRad: rad(lat), lonRad: rad(lon), hM, value,
    distanceM: haversineM(rad(dLat), rad(dLon), rad(lat), rad(lon)),
  }));
  return { cands, h: dH };
}
const weightsOf = (r) => Object.fromEntries(r.used.map((u) => [u.id, u.weight]));

const VECTORS = [
  { name: 'V1 four stations, flat', q: 't', dev: [47.0, 8.0, 500], value: 10.543250, idw: 10.420532,
    st: [[47.1, 8.0, 500, 10.0], [47.0, 8.3, 500, 12.0], [46.8, 7.9, 500, 11.0], [47.05, 7.6, 500, 9.0]],
    w: [0.387912, 0.229426, 0.233529, 0.149132] },
  { name: 'V2 cluster to the east, one station to the west', q: 't', dev: [47.0, 8.0, 400], value: 12.392272, idw: 13.133854,
    st: [[47.0, 8.27, 400, 14.0], [47.01, 8.28, 400, 14.4], [46.99, 8.285, 400, 13.8], [47.0, 7.7, 400, 10.0]],
    w: [0.207607, 0.193601, 0.186842, 0.411950] },
  { name: 'V3 two in line to the north, one to the south', q: 't', dev: [47.0, 8.0, 400], value: 8.652437, idw: 8.087366,
    st: [[47.09, 8.0, 400, 8.0], [47.27, 8.0, 400, 6.0], [46.64, 8.0, 400, 12.0]],
    w: [0.541773, 0.196745, 0.261482] },
  { name: 'V4 height differences', q: 't', dev: [46.5, 8.0, 1200], value: 3.960397, idw: 4.003964,
    st: [[46.55, 8.05, 1500, 3.0], [46.45, 7.9, 600, 5.5], [46.6, 8.2, 1150, 4.2], [46.3, 8.1, 2000, 2.0]],
    w: [0.245287, 0.108472, 0.607027, 0.039214] },
  { name: 'V5 the median check removes an outlier first', q: 't', dev: [39.0, -94.5, 300], value: 0.271865, idw: 0.168304,
    st: [[39.05, -94.5, 300, 0.0], [39.0, -94.4, 300, 19.0], [38.9, -94.6, 300, 1.0], [39.1, -94.7, 300, -0.5], [38.95, -94.3, 300, 0.5]],
    w: [0.394894, null, 0.240415, 0.150895, 0.213796] },
  { name: 'V8 pressure, five stations', q: 'p', dev: [47.4, 8.5, 450], value: 96208.554452, idw: 96209.457119, rel: 1e-9,
    st: [[47.45, 8.55, 450, 96210], [47.3, 8.4, 450, 96190], [47.5, 8.3, 450, 96240], [47.35, 8.7, 450, 96180], [47.6, 8.6, 450, 96260]],
    w: [0.323347, 0.248389, 0.155727, 0.184705, 0.087832] },
  { name: 'V9 humidity, no median check', q: 'rh', dev: [47.0, 8.0, 500], value: 0.651445, idw: 0.644205,
    st: [[47.1, 8.0, 500, 0.62], [47.0, 8.3, 500, 0.70], [46.8, 7.9, 500, 0.66]],
    w: [0.459086, 0.245206, 0.295709] },
];

for (const v of VECTORS) {
  test(`kriging reference vector ${v.name}`, () => {
    const { cands, h } = krigeCase(v.dev, v.st);
    const r = combine(cands, h, v.q);
    assert.equal(r.method, 'kriging'); assert.equal(r.fallback, null);
    near(r.value, v.value, v.rel ? v.value * v.rel : 1e-6);
    const w = weightsOf(r);
    v.w.forEach((exp, i) => {
      if (exp == null) assert.equal(w[i + 1], undefined, 'left out');
      else near(w[i + 1], exp, 1e-6);
    });
    near(r.used.reduce((s, u) => s + u.weight, 0), 1, 1e-12);
    // the inverse-distance weights stay available for comparison
    const i = combine(cands, h, v.q, IDW);
    assert.equal(i.method, 'idw'); near(i.value, v.idw, v.rel ? v.idw * v.rel : 1e-6);
  });
}

test('kriging reference vector V6: nearest contributor beyond 100 km falls back to inverse distance', () => {
  const { cands, h } = krigeCase([-12.0, -76.0, 150], [[-11.0, -76.0, 150, 20.0], [-13.2, -76.3, 150, 24.0], [-12.0, -74.9, 150, 18.0]]);
  const r = combine(cands, h, 't');
  assert.equal(r.method, 'idw'); assert.equal(r.fallback, 'far');
  near(r.value, 20.427438, 1e-6);
  near(r.used[0].weight, 0.381034, 1e-6);
});

test('kriging reference vector V7: one station has weight 1', () => {
  const { cands, h } = krigeCase([47.0, 8.0, 500], [[47.2, 8.1, 500, 7.0]]);
  const r = combine(cands, h, 't');
  assert.equal(r.used[0].weight, 1); near(r.value, 7, 1e-9); assert.equal(r.fallback, null);
});

test('kriging: weights are non-negative, sum to 1 and do not depend on the order of the candidates', () => {
  const { cands, h } = krigeCase([47.0, 8.0, 400], VECTORS[1].st);
  const a = combine(cands, h, 't'), b = combine([...cands].reverse(), h, 't');
  near(a.value, b.value, 1e-12);
  for (const u of a.used) { assert.ok(u.weight >= 0); near(u.weight, weightsOf(b)[u.id], 1e-12); }
  near(a.used.reduce((s, u) => s + u.weight, 0), 1, 1e-12);
});

test('kriging: two stations at the same place share their weight equally (nugget keeps the solve stable)', () => {
  const { cands, h } = krigeCase([47.0, 8.0, 400], [[47.1, 8.0, 400, 10], [47.1, 8.0, 400, 12], [46.9, 8.0, 400, 8]]);
  const r = combine(cands, h, 't');
  assert.equal(r.method, 'kriging');
  near(weightsOf(r)[1], weightsOf(r)[2], 1e-9);
});

test('kriging: two stations work; a clipped station keeps weight 0 and stays in used', () => {
  const two = krigeCase([47.0, 8.0, 400], [[47.1, 8.0, 400, 10], [47.3, 8.0, 400, 12]]);
  const r2 = combine(two.cands, two.h, 'rh');
  assert.equal(r2.method, 'kriging'); near(r2.used.reduce((s, u) => s + u.weight, 0), 1, 1e-12);
  // a station straight behind a nearer one, with another on the far side
  const { cands, h } = krigeCase([47.0, 8.0, 400], [[47.02, 8.0, 400, 10], [47.04, 8.0, 400, 10], [47.06, 8.0, 400, 10], [46.9, 8.0, 400, 10]]);
  const r = combine(cands, h, 'rh');
  assert.equal(r.used.length, 4);
  assert.ok(r.used.every((u) => u.weight >= 0));
});

test('kriging: a candidate without position falls back to inverse distance with a reason', () => {
  const { cands, h } = krigeCase([47.0, 8.0, 400], VECTORS[0].st);
  const r = combine([...cands.slice(0, 3), { ...cands[3], latRad: undefined }], h, 't');
  assert.equal(r.method, 'idw'); assert.equal(r.fallback, 'noPosition');
  const idw = combine(cands, h, 't', IDW);
  assert.ok(r.used.every((u) => u.weight > 0));
  near(r.used.reduce((s, u) => s + u.weight, 0), 1, 1e-12);
  assert.equal(idw.fallback, null);
});

test('kriging: the 100 km limit is on the nearest effective distance, exclusive', () => {
  const at = (m) => {
    // two stations due north; the first at effective distance m (flat)
    const lat0 = rad(47.0), dLat = m / 6371008.8;
    const mk = (lat, value) => ({ latRad: lat, lonRad: rad(8), hM: 400, value, distanceM: haversineM(lat0, rad(8), lat, rad(8)) });
    return combine([mk(lat0 + dLat, 5), mk(lat0 - dLat * 1.5, 6)], 400, 'rh');
  };
  const maxM = COMBINE_DEFAULTS.krigeMaxNearestM;
  assert.equal(at(maxM - 1).method, 'kriging');
  const far = at(maxM + 1);
  assert.equal(far.method, 'idw'); assert.equal(far.fallback, 'far');
});

test('kriging: the median check runs before the weights, so a rejected station takes no part', () => {
  const { cands, h } = krigeCase(VECTORS[4].dev, VECTORS[4].st);
  const r = combine(cands, h, 't');
  assert.deepEqual(r.rejected.map((x) => x.id), [2]);
  const without = combine(cands.filter((x) => x.id !== 2), h, 't');
  near(r.value, without.value, 1e-12);
});

test('solveLinear: solves a system with pivoting; singular or non-finite gives null', () => {
  const x = solveLinear([[0, 2], [3, 1]], [4, 5]);
  near(x[0], 1, 1e-12); near(x[1], 2, 1e-12);
  assert.equal(solveLinear([[1, 2], [2, 4]], [1, 2]), null);
  assert.equal(solveLinear([[1, 0], [0, 1]], [NaN, 1]), null);
});

test('krigingWeights: a degenerate setup returns null and combine() falls back with "solver"', () => {
  // a zero nugget with two stations at the same place makes the system singular
  const st = [{ deffM: 10000, hM: 0, latRad: rad(47), lonRad: rad(8) }, { deffM: 10000, hM: 0, latRad: rad(47), lonRad: rad(8) }];
  assert.equal(krigingWeights(st, { krigeNugget: 0 }), null);
  const cands = [{ distanceM: 10000, hM: 0, value: 1, latRad: rad(47), lonRad: rad(8) }, { distanceM: 10000, hM: 0, value: 3, latRad: rad(47), lonRad: rad(8) }];
  const r = combine(cands, 0, 'rh', { krigeNugget: 0 });
  assert.equal(r.method, 'idw'); assert.equal(r.fallback, 'solver'); near(r.value, 2, 1e-12);
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
  assert.ok(top.weight > 0.6, `LFSB weight ${top.weight}`);   // kriging shares the weight with the stations beside it
  near(e.temperature.value, -1.2, 0.8);
});

test('estimate: candidates carry the station positions, so kriging is used; method idw reproduces the distance weights', () => {
  const north = (dKm, id, elev, T) => obs(id, dKm, elev, { T, lat: 47.4 + radToDeg(dKm / 6371.0088), lon: 8.5 });
  const o = [north(5, 'N1', 450, 10), north(8, 'N2', 450, 11), north(25, 'N3', 450, 12)];
  const e = estimate(o, 450, { now: NOW });
  assert.equal(e.temperature.method, 'kriging'); assert.equal(e.temperature.fallback, null);
  assert.ok(e.temperature.used.every((u) => Number.isFinite(u.latRad) && Number.isFinite(u.lonRad)));
  const idw = estimate(o, 450, { now: NOW, params: { method: 'idw' } });
  assert.equal(idw.temperature.method, 'idw');
  const w = 1 / kmToM(5) ** 1.5 + 1 / kmToM(8) ** 1.5 + 1 / kmToM(25) ** 1.5;
  near(idw.temperature.used[0].weight, (1 / kmToM(5) ** 1.5) / w, 1e-9);
  // the two results differ by well under a kelvin and 100 Pa
  assert.ok(Math.abs(e.temperature.value - idw.temperature.value) < 0.5);
  assert.ok(Math.abs(e.pressure.value - idw.pressure.value) < 100);
});

test('estimate: a lone station on the far side reaches the 10 % that counts for the refresh gate only with kriging', () => {
  const at = (dKm, id, sign) => obs(id, dKm, 450, { lat: 47.4 + sign * radToDeg(dKm / 6371.0088), lon: 8.5 });
  const o = [at(4, 'N1', 1), at(6, 'N2', 1), at(8, 'N3', 1), at(30, 'S1', -1)];
  const ids = (e) => contributors(e).map((x) => x.obs.station.id);
  assert.ok(!ids(estimate(o, 450, { now: NOW, params: { method: 'idw' } })).includes('S1'), 'inverse distance: under 10 %');
  assert.ok(ids(estimate(o, 450, { now: NOW })).includes('S1'), 'kriging: the lone station on the other side counts');
});
