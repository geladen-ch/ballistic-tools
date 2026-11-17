import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, near } from './helpers/weather-fixtures.js';
import { degToRad } from '../src/quantity.js';
import { evaluateSeries, geoidN, ellipsoidalToOrthometric } from '../src/weather/geoid.js';
import { diurnalCorrection, diurnalA0 } from '../src/weather/diurnal.js';

const rad = degToRad;

// Evaluator checks independent of the table (L = 2, one coefficient = 1, φ = 30°, λ = 40°).
test('geoid evaluator: analytic low-order harmonics', () => {
  const cases = [[0, 1.0], [1, 0.866025], [2, 1.149067], [3, -0.279508], [5, 0.252201], [6, 0.964181], [8, 1.430304]];
  for (const [i, v] of cases) {
    const c = new Float64Array(9); c[i] = 1;
    near(evaluateSeries(c, 2, rad(30), rad(40)), v, 1e-6, `index ${i}`);
  }
});

test('geoid table: matches the fit script vectors exactly (float32 table, float64 synthesis)', () => {
  const v = fixture('geoid-sh-vectors.json');
  for (const p of v.points) near(geoidN(rad(p.lat), rad(p.lon)), p.series_m, 1e-4, p.name);
});

test('geoid table: plausibility vs full EGM2008', () => {
  const tol = { Zurich: [47.37, 8.54, 47.72, 3], Zermatt: [46.02, 7.75, 54.68, 6], Berlin: [52.52, 13.40, 39.49, 3],
    KansasCity: [39.10, -94.58, -32.95, 3], Tokyo: [35.68, 139.69, 36.66, 3], LaPaz: [-16.50, -68.15, 45.74, 5],
    Lhasa: [29.65, 91.10, -34.68, 6] };
  for (const [name, [la, lo, n, t]] of Object.entries(tol)) near(geoidN(rad(la), rad(lo)), n, t, name);
});

test('geoid: antimeridian continuity and orthometric conversion', () => {
  near(geoidN(0, rad(180)), geoidN(0, rad(-180)), 1e-9);
  near(geoidN(rad(10), rad(359)), geoidN(rad(10), rad(-1)), 1e-9);
  near(ellipsoidalToOrthometric(520, rad(47.37), rad(8.54)), 520 - geoidN(rad(47.37), rad(8.54)), 1e-12);
});

// Test vectors of the sun-angle model: [case, lat, lon, report, now, Y, A0, A, S_r, S_n, ΔT]
const V = [
  ['LSZH summer morning', 47.4784, 8.5302, '2026-06-21T05:50Z', '2026-06-21T06:20Z', 15.762, 11.392, 10.404, 0.2930, 0.3728, 0.830],
  ['LSZH summer evening', 47.4784, 8.5302, '2026-06-21T17:50Z', '2026-06-21T18:40Z', 15.762, 11.392, 10.404, 0.7267, 0.6229, -1.080],
  ['LSZH winter morning', 47.4784, 8.5302, '2026-12-15T07:50Z', '2026-12-15T08:35Z', 8.258, 11.392, 3.744, 0.0262, 0.2370, 0.789],
  ['LSZH night', 47.4784, 8.5302, '2026-11-14T01:20Z', '2026-11-14T01:50Z', 9.074, 11.392, 4.562, 0.1110, 0.1004, -0.048],
  ['KMCI morning', 39.2976, -94.7139, '2026-04-10T13:53Z', '2026-04-10T14:40Z', 12.853, 12.400, 10.567, 0.2911, 0.4373, 1.545],
  ['Longyearbyen polar night', 78.246, 15.466, '2026-12-10T11:50Z', '2026-12-10T12:30Z', 0, 6.300, 0, 0, 0, 0],
  ['Singapore midday', 1.35, 103.99, '2026-03-20T02:30Z', '2026-03-20T03:15Z', 11.998, 6.800, 6.795, 0.5594, 0.6837, 0.845],
  ['Sydney summer afternoon', -33.9461, 151.1772, '2026-01-15T05:00Z', '2026-01-15T05:45Z', 14.021, 11.947, 11.653, 0.9818, 0.9457, -0.421],
];

for (const [name, lat, lon, r, n, Y, A0, A, Sr, Sn, dT] of V) {
  test(`diurnal vector: ${name}`, () => {
    const x = diurnalCorrection(rad(lat), rad(lon), new Date(r), new Date(n));
    near(x.dT, dT, 0.002, 'ΔT');
    near(x.dayLengthH, Y, 0.002, 'Y');
    near(x.A0, A0, 0.002, 'A0');
    near(x.A, A, 0.002, 'A');
    near(x.sReport, Sr, 0.0002, 'S_r');
    near(x.sNow, Sn, 0.0002, 'S_n');
  });
}

test('diurnal: polar day gives no correction', () => {
  const x = diurnalCorrection(rad(78.246), rad(15.466), new Date('2026-06-21T11:50Z'), new Date('2026-06-21T12:30Z'));
  assert.equal(x.dayLengthH, 24); assert.equal(x.dT, 0);
});

test('diurnal: report in the future (clock skew) or same time gives 0', () => {
  assert.deepEqual(diurnalCorrection(rad(47.48), rad(8.53), new Date('2026-06-21T06:20Z'), new Date('2026-06-21T05:50Z')), { dT: 0 });
  assert.deepEqual(diurnalCorrection(rad(47.48), rad(8.53), new Date('2026-06-21T06:20Z'), new Date('2026-06-21T06:20Z')), { dT: 0 });
});

test('diurnal: A0 table interpolation and end values', () => {
  assert.equal(diurnalA0(0), 6.8); assert.equal(diurnalA0(rad(89)), 6.3);
  near(diurnalA0(rad(40)), 12.4, 1e-9);
  near(diurnalA0(rad(10.25)), 7.4, 1e-9);
});

test('diurnal: morning warms, evening cools, night changes least (LSZH, June, 1 h steps)', () => {
  const d = (h0, h1) => diurnalCorrection(rad(47.48), rad(8.53), new Date(`2026-06-21T${h0}Z`), new Date(`2026-06-21T${h1}Z`)).dT;
  const morning = d('07:00', '08:00'), evening = d('18:00', '19:00'), night = d('00:00', '01:00');
  assert.ok(morning > 1); assert.ok(evening < -1); assert.ok(night < 0 && night > -0.5);
});
