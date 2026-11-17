import test from 'node:test';
import assert from 'node:assert/strict';
import { near } from './helpers/weather-fixtures.js';
import { hpaToPa, paToHpa, inhgToPa, degToRad } from '../src/quantity.js';
import {
  isaPressureFromQnh, isaQnhFromPressure, isaShiftPressure, isaShiftTemperature, dewpointToRH, N_EXP, K_ALT,
  hypsometricShiftPressure, saturationVapourPressure, rhAtConstantVapour, R_DRY
} from '../src/weather/atmosphere.js';
import { reduceToDevice } from '../src/weather/reduce.js';
import { qnhRoundingCorrection, Q_GROUP_ROUNDING_PA } from '../src/weather/metar.js';

// Vectors are written in hPa (how they are published) and converted with the named routines; tolerances: 0.0005 hPa.
const TOL = hpaToPa(5e-4);
const P = (hpa) => hpaToPa(hpa);

test('ISA constants (the pressure unit enters K through P0)', () => {
  near(N_EXP, 5.255876, 1e-6);
  near(K_ALT, 8.417286e-5 * 100 ** (1 / N_EXP), 1e-9);
});

test('isaPressureFromQnh vectors', () => {
  for (const [q, h, p] of [[1013.25, 0, 1013.25], [1014, 424, 964.060], [1014, 1000, 899.426], [980, 1500, 816.855],
    [1045, 1500, 872.995], [1020, -400, 1069.247], [1000, 3000, 691.256]]) near(isaPressureFromQnh(P(q), h), P(p), TOL, `${q}@${h}`);
});

test('isaQnhFromPressure vectors and inverse', () => {
  near(isaQnhFromPressure(P(964.0), 424), P(1013.937), TOL);
  near(isaQnhFromPressure(P(850), 1500), P(1018.390), TOL);
  for (const [q, h] of [[1014, 424], [990, 2500], [1030, -100]]) near(isaQnhFromPressure(isaPressureFromQnh(P(q), h), h), P(q), 1e-7);
});

test('isaShiftPressure vectors and exact chaining', () => {
  near(isaShiftPressure(P(870.0), 1326, 1000), P(905.178), TOL);
  near(isaShiftPressure(P(870.0), 1326, 2000), P(800.776), TOL);
  near(isaShiftPressure(isaPressureFromQnh(P(1014), 424), 424, 1000), isaPressureFromQnh(P(1014), 1000), 1e-7);
  near(isaShiftPressure(P(900), 700, 700), P(900), 1e-9);
});

test('isaShiftTemperature', () => {
  near(isaShiftTemperature(12, 424, 1000), 8.256, 1e-9);
  near(isaShiftTemperature(0, 1000, 0), 6.5, 1e-9);
});

test('dewpointToRH (Magnus) gives a fraction', () => {
  near(dewpointToRH(12, 7), 0.7147, 5e-5);
  near(dewpointToRH(-5, -9), 0.7352, 5e-5);
  near(dewpointToRH(25, 25), 1, 1e-9);
});

test('hypsometricShiftPressure vectors: layer mean temperature from the station temperature and the ISA lapse rate', () => {
  near(R_DRY, 287.0531, 1e-4);
  near(hypsometricShiftPressure(P(870), 1326, 1000, 12), P(904.521), TOL);
  near(hypsometricShiftPressure(P(870), 1326, 1000, -10), P(907.457), TOL);        // cold: pressure rises faster going down
  near(hypsometricShiftPressure(P(870), 1326, 2000, 12), P(802.007), TOL);
  near(hypsometricShiftPressure(P(964.06), 424, 1000, 12), P(899.364), TOL);
  near(hypsometricShiftPressure(P(1000), 0, 1500, 30), P(842.144), TOL);           // ISA: 834.118
  near(hypsometricShiftPressure(P(1000), 0, 1500, -20), P(813.505), TOL);
  near(hypsometricShiftPressure(P(900), 1000, 1000, 5), P(900), 1e-9);
  // round trip: there and back with the temperature at each end
  const up = hypsometricShiftPressure(P(950), 500, 1500, 10);
  near(hypsometricShiftPressure(up, 1500, 500, 10 - 6.5), P(950), 1e-6);
});

test('saturationVapourPressure and rhAtConstantVapour (time correction of RH, fractions)', () => {
  near(saturationVapourPressure(0), P(6.1094), 0.01);
  near(saturationVapourPressure(15), P(17.0198), 0.01);
  near(rhAtConstantVapour(0.70, 12, 13.5), 0.63452, 5e-6);                       // warmer later: RH lower
  near(rhAtConstantVapour(0.80, 5, 3), 0.92057, 5e-6);
  near(rhAtConstantVapour(0.95, 5, 3), 1, 1e-12);                                 // capped
  near(rhAtConstantVapour(dewpointToRH(12, 7), 12, 14), dewpointToRH(14, 7), 1e-9);   // = constant dew point
});

const st = (o = {}) => ({ id: 'X', name: 'X', latRad: 0, lonRad: 0, elevM: 424, distanceM: 1000, ...o });
const obs = (o = {}) => ({
  temperatureC: 12, dewpointC: 7, humidity: 0.7147, pressure: { kind: 'qnh', pa: P(1014) }, notes: [], ...o, station: st(o.station)
});

test('reduce: worked example (QNH → station level by ISA, exact → device by the hypsometric equation)', () => {
  const r = reduceToDevice(obs(), 472.3);
  near(r.pressurePa, P(958.4945), TOL);                                         // ISA would give 958.5001
  near(r.temperatureC, 11.6861, 1e-3);
  near(r.humidity, 0.7147, 1e-9);
  assert.deepEqual(r.flags, []);
  assert.deepEqual(r.pressureRef, { kind: 'qnh', hM: 0 });
  near(r.station.pressurePa, P(964.060), TOL);
  // the layer temperature can be passed separately (the pipeline passes the reported one when T is time-corrected)
  near(reduceToDevice({ ...obs(), temperatureC: 20 }, 472.3, { layerTempC: 12 }).pressurePa, P(958.4945), TOL);
  // without a temperature: ISA, flagged
  const n = reduceToDevice(obs({ temperatureC: null }), 472.3);
  near(n.pressurePa, P(958.5001), TOL); assert.ok(n.flags.includes('pressureIsa'));
});

test('reduce: device at the station height gets the station pressure; at sea level ≈ QNH (station temperature 12 °C)', () => {
  near(reduceToDevice(obs(), 424).pressurePa, isaPressureFromQnh(P(1014), 424), 1e-6);
  near(reduceToDevice(obs(), 0).pressurePa, P(1014.0505), TOL);
});

test('reduce: station pressure uses barometer height, falls back to elevation with a flag', () => {
  const o = obs({ pressure: { kind: 'station', pa: P(870) }, station: { elevM: 1321, barometerM: 1326 } });
  const r = reduceToDevice(o, 1000);
  near(r.pressurePa, P(904.5254), TOL);                                         // temperature moved 1321 → 1326 m first
  assert.equal(r.pressureRef.hM, 1326);
  assert.deepEqual(r.flags, []);
  near(r.temperatureC, 12 + 0.0065 * 321, 1e-9);                                // temperature from station elevation 1321
  const r2 = reduceToDevice(obs({ pressure: { kind: 'station', pa: P(870) }, station: { elevM: 1326 } }), 1000);
  near(r2.pressurePa, P(904.5210), TOL);
  assert.deepEqual(r2.flags, ['baroHeightAssumed']);
});

test('reduce: sea-level pressure only is not used; missing heights flagged', () => {
  const sl = reduceToDevice(obs({ pressure: { kind: 'mslp', pa: P(1014) } }), 472.3);
  assert.deepEqual(sl.flags, ['mslpNotUsed']); assert.equal(sl.pressurePa, null); assert.ok(Number.isFinite(sl.temperatureC), 'temperature still used');
  const r = reduceToDevice(obs({ station: { elevM: null } }), 472.3);
  assert.deepEqual(r.flags, ['pressureIsa', 'tempNotAdjusted']);                 // no station elevation: QNH by ISA
  assert.equal(r.temperatureC, 12);
  near(r.pressurePa, P(958.5001), TOL);
  const r3 = reduceToDevice(obs(), null);
  assert.equal(r3.pressurePa, null);
  assert.deepEqual(r3.flags, ['noDeviceAltitude']);
});

test('Q-group rounding correction +0.5 hPa, A group uncorrected', () => {
  near(qnhRoundingCorrection('Q'), P(0.5), 0); near(qnhRoundingCorrection('A'), 0, 0);
  assert.equal(Q_GROUP_ROUNDING_PA, 50);
  near(isaPressureFromQnh(P(1014) + qnhRoundingCorrection('Q'), 472.3), P(958.978), P(0.001));
  near(isaPressureFromQnh(inhgToPa(29.94) + qnhRoundingCorrection('A'), 472.3), P(958.390), P(0.001));
  near(paToHpa(P(1013.25)), 1013.25, 1e-9);
  assert.ok(degToRad(180) > 3.14);
});
