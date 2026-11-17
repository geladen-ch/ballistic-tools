import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, near } from './helpers/weather-fixtures.js';
import { degToRad, kmToM } from '../src/quantity.js';
import { parseMetar } from '../src/weather/metar.js';
import { haversineM, bboxContains, lonExtent, pointsBbox, bboxDistanceM, pointFromGeoJson, EARTH_RADIUS_M } from '../src/weather/geo.js';
import { parseLatLon, isValidPosition, geoErrorCode, locateGps } from '../src/weather/location.js';
import { geoidN } from '../src/weather/geoid.js';

const REF = new Date('2026-11-13T23:00:00Z');
const rad = degToRad;

test('METAR: Q group, M temperatures, NOSIG trend, -0 normalised', () => {
  const m = parseMetar('LSZH 132220Z 01005KT 320V030 CAVOK M00/M01 Q1018 NOSIG', REF);
  assert.equal(m.station, 'LSZH');
  assert.equal(m.time.toISOString(), '2026-11-13T22:20:00.000Z');
  assert.ok(Object.is(m.temperatureC, 0), 'M00 should be +0');
  assert.equal(m.dewpointC, -1);
  assert.equal(m.qnhPa, 101800); assert.equal(m.qnhGroup, 'Q'); assert.equal(m.tempPrecision, '1');
});

test('METAR: A group, RMK T-group and SLP (US)', () => {
  const m = parseMetar('METAR KMCI 132253Z 18011KT 10SM CLR 12/M04 A2992 RMK AO2 SLP135 T01221039', REF);
  assert.equal(m.type, 'METAR');
  near(m.qnhPa, 101320.73, 0.05); assert.equal(m.qnhGroup, 'A');
  assert.equal(m.temperatureC, 12.2); assert.equal(m.dewpointC, -3.9); assert.equal(m.tempPrecision, '0.1');
  near(m.slpPa, 101350, 1e-6);
  near(parseMetar('KXXX 132253Z AUTO 00000KT 10SM CLR M05/M08 A3040 RMK AO2 SLP982', REF).slpPa, 99820, 1e-6);
});

test('METAR: AUTO, missing dew point, trend groups ignored, NIL, COR, SPECI', () => {
  const m = parseMetar('LFSB 132200Z AUTO 25002KT 8000 NSC M01/// Q1019 TEMPO 4000 BCFG', REF);
  assert.equal(m.auto, true); assert.equal(m.temperatureC, -1); assert.equal(m.dewpointC, null); assert.equal(m.qnhPa, 101900);
  const n = parseMetar('LSZH 132220Z NIL', REF);
  assert.equal(n.nil, true); assert.equal(n.temperatureC, null); assert.equal(n.qnhPa, null);
  const s = parseMetar('SPECI COR EGLL 132235Z 24015G28KT 9999 -RA BKN012 11/09 Q0998', REF);
  assert.equal(s.type, 'SPECI'); assert.equal(s.cor, true); assert.equal(s.qnhPa, 99800);
  assert.equal(parseMetar('KDEN 132253Z 1/2SM FG 02/02 A3001', REF).temperatureC, 2);
});

test('METAR: day of month resolves across month boundary', () => {
  assert.equal(parseMetar('LSZH 302350Z 00000KT M01/M02 Q1020', new Date('2026-12-01T00:10:00Z')).time.toISOString(), '2026-11-30T23:50:00.000Z');
  assert.equal(parseMetar('LSZH 010010Z 00000KT M01/M02 Q1020', new Date('2026-11-30T23:58:00Z')).time.toISOString(), '2026-12-01T00:10:00.000Z');
});

test('haversine (metres, radians)', () => {
  near(haversineM(rad(47.37), rad(8.54), rad(47.4784), rad(8.5302)), kmToM(12.07), 50);
  near(haversineM(0, rad(179.5), 0, rad(-179.5)), kmToM(111.2), 100);
  near(haversineM(0, 0, 0, Math.PI), Math.PI * EARTH_RADIUS_M, 1);
});

test('bboxContains: margin, antimeridian, wide boxes', () => {
  const box = (w, s, e, n) => [rad(w), rad(s), rad(e), rad(n)];
  const ch = box(6.02778, 45.90154, 9.97889, 47.58503);
  assert.ok(bboxContains(ch, rad(47.37), rad(8.54)));
  assert.ok(!bboxContains(ch, rad(48.5), rad(8.54)));
  assert.ok(bboxContains(ch, rad(48.5), rad(8.54), kmToM(150)));
  assert.ok(bboxContains(box(170, -20, -170, -10), rad(-15), rad(179.9)));      // crossing antimeridian
  assert.ok(bboxContains(box(170, -20, -170, -10), rad(-15), rad(-175)));
  assert.ok(!bboxContains(box(170, -20, -170, -10), rad(-15), rad(0)));
  assert.ok(bboxContains(box(-176.7, 51.8, 174.2, 71.4), rad(60), rad(8.5)));    // AK-style wide box: matches, filtered later
});

test('parseLatLon returns radians', () => {
  const at = (s, lat, lon, tol = 1e-12) => { const p = parseLatLon(s); near(p.latRad, rad(lat), tol); near(p.lonRad, rad(lon), tol); };
  at('47.37, 8.54', 47.37, 8.54);
  at('47.37 8.54', 47.37, 8.54);
  at('-33.9,151.2', -33.9, 151.2);
  at('8.54E 47.37N', 47.37, 8.54);
  at(`47°22'12"N 8°32'24"W`, 47.37, -8.54, 1e-9);
  at('47,37 8,54', 47.37, 8.54);
  assert.equal(parseLatLon('91 0'), null);
  assert.equal(parseLatLon('hello'), null);
});

test('isValidPosition: range, finite, not exactly (0, 0)', () => {
  assert.ok(isValidPosition(rad(47.37), rad(8.54)));
  assert.ok(isValidPosition(rad(90), rad(180)) && isValidPosition(rad(-90), rad(-180)));
  assert.ok(!isValidPosition(rad(90.0001), 0) && !isValidPosition(0, rad(180.0001)));
  assert.ok(!isValidPosition(0, 0));
  assert.ok(isValidPosition(0, rad(1)) && isValidPosition(rad(1), 0));
  assert.ok(!isValidPosition(NaN, 0) && !isValidPosition(0, Infinity) && !isValidPosition(null, null));
});

test('geoErrorCode maps GeolocationPositionError codes', () => {
  assert.equal(geoErrorCode({ code: 1 }), 'denied');
  assert.equal(geoErrorCode({ code: 2 }), 'unavailable');
  assert.equal(geoErrorCode({ code: 3 }), 'timeout');
  assert.equal(geoErrorCode({ notSupported: true }), 'notSupported');
  assert.equal(geoErrorCode(new Error('x')), 'other');
});

test('lonExtent: largest-gap method, with and without antimeridian crossing (radians)', () => {
  const ext = (xs) => lonExtent(xs.map(rad));
  const e1 = ext([10, 30, 20]);
  near(e1.west, rad(10), 1e-12); near(e1.east, rad(30), 1e-12);
  const e2 = ext([170, -170, 175]);
  near(e2.west, rad(170), 1e-12); near(e2.east, rad(-170), 1e-12);
  const e3 = ext([-173.3, 177.7, 20.6, 60, 120]);
  near(e3.west, rad(20.6), 1e-12); near(e3.east, rad(-173.3), 1e-12);
  const e4 = ext([5]);
  near(e4.west, rad(5), 1e-12); near(e4.east, rad(5), 1e-12);
  assert.equal(ext([]), null);
});

test('pointsBbox: Russia from its station list → 20.6°E east across ±180° to 173.2°W', () => {
  const pts = fixture('iem-stations-RU__ASOS.geojson').features.map((f) => pointFromGeoJson(f.geometry.coordinates));
  const [w, s, e, n] = pointsBbox(pts);
  near(w, rad(20.6167), 1e-6); near(e, rad(-173.2433), 1e-6);
  assert.ok(w > e, 'should wrap');
  assert.ok(s > rad(42) && n < rad(73));
});

test('bboxDistanceM: wrapping boxes and latitude-only bound', () => {
  const ru = [rad(20.6), rad(42.7), rad(-173.2), rad(72.1)];
  assert.equal(bboxDistanceM(ru, rad(55.75), rad(37.6)), 0);                 // Moscow inside
  assert.equal(bboxDistanceM(ru, rad(65), rad(-178)), 0);                    // Chukotka
  near(bboxDistanceM(ru, rad(47.37), rad(8.54)), haversineM(rad(47.37), rad(8.54), rad(47.37), rad(20.6)), 2000);
  const wide = [rad(-173.3), rad(42.7), rad(177.7), rad(72.1)];
  assert.equal(bboxDistanceM(wide, rad(47.37), rad(8.54), { lonUnknown: true }), 0);
  near(bboxDistanceM(wide, rad(40.7), rad(8.54), { lonUnknown: true }), rad(2) * EARTH_RADIUS_M, 1e-6);
});

test('locateGps: averages altitude with 1/σ² weights, best-accuracy position, geoid applied once', async () => {
  const watchers = [];
  const geolocation = {
    watchPosition(ok) { watchers.push(ok); return 7; }, clearWatch() {},
  };
  const fix = (acc, alt, altAcc) => ({ coords: { latitude: 47.37, longitude: 8.54, accuracy: acc, altitude: alt, altitudeAccuracy: altAcc } });
  const seen = [];
  const run = locateGps({ durationMs: 10, geolocation, onFix: (f) => seen.push(f) });
  watchers[0](fix(20, 500, 10));
  watchers[0](fix(8, 510, 5));
  watchers[0](fix(5, null, null));              // better position, no altitude: position only
  watchers[0](fix(6, 700, 80));                 // altitude accuracy above 50 m: dropped
  const r = await run.promise;
  near(r.position.latRad, rad(47.37), 1e-12); near(r.position.accuracyM, 5, 0);
  const w1 = 1 / 100, w2 = 1 / 25;
  near(r.altitude.ellipsoidalM, (w1 * 500 + w2 * 510) / (w1 + w2), 1e-9);
  near(r.altitude.sigmaM, 10, 0);               // median of [5, 10] (upper middle)
  near(r.altitude.heightM, r.altitude.ellipsoidalM - geoidN(rad(47.37), rad(8.54)), 1e-9);
  assert.equal(r.altitude.count, 2);
  assert.equal(seen.length, 4);
});

test('locateGps: no altitude from the device → altitude null; no geolocation → rejects', async () => {
  const watchers = [];
  const run = locateGps({ durationMs: 5, geolocation: { watchPosition(ok) { watchers.push(ok); return 1; }, clearWatch() {} } });
  watchers[0]({ coords: { latitude: 1, longitude: 2, accuracy: 9, altitude: null, altitudeAccuracy: null } });
  assert.equal((await run.promise).altitude, null);
  await assert.rejects(locateGps({ geolocation: null }).promise, (e) => geoErrorCode(e) === 'notSupported');
});
