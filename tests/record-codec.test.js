import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeRifle, encodeRifle, decodeLocation, encodeLocation, decodeRiflePrecisionProject, encodeRiflePrecisionProject, decodeRecord
} from '../src/record-codec.js';
import { resolveRecord } from '../src/sync/merge.js';
import { degToRad, mradToRad, moaToRad, mmToM } from '../src/quantity.js';

const legacyRifle = () => ({
  id: 'r1', name: 'R', revision: 2, modifiedAt: '2026-05-01T00:00:00.000Z', defaultSightHeightM: 0.05, someFutureField: { a: 1 },
  defaultClickUnit: 'arcmin', defaultClickHorizontal: 0.25, defaultClickVertical: 0.125,
  cartridges: [
    { id: 'c1', name: 'C1', precision: { mode: 'own', r50Mrad: 0.14 }, zeroAtmosphere: { tempC: 4, altitudeM: 1505, pressureHpa: 845, humidityPct: 30 } },
    { id: 'c2', name: 'C2', precision: null, zeroAtmosphere: null }
  ]
});

test('a rifle stored by an earlier build decodes into SI, legacy fields dropped, unknown fields kept', () => {
  const rifle = decodeRifle(legacyRifle());
  assert.equal(rifle.defaultClickHorizontalRad, moaToRad(0.25));
  assert.equal(rifle.defaultClickVerticalRad, moaToRad(0.125));
  assert.ok(!('defaultClickHorizontal' in rifle) && !('defaultClickVertical' in rifle));
  assert.deepEqual(rifle.cartridges[0].precision, { mode: 'own', r50Rad: mradToRad(0.14) });
  assert.deepEqual(rifle.cartridges[0].zeroAtmosphere, { tempC: 4, altitudeM: 1505, pressurePa: 84500, humidity: 0.3 });
  assert.equal(rifle.cartridges[1].precision, null);
  assert.equal(rifle.cartridges[1].zeroAtmosphere, null);
  assert.deepEqual(rifle.someFutureField, { a: 1 });
});

test('encoding writes each SI field with its legacy twin, and decoding that gives back exactly what was encoded', () => {
  const rifle = decodeRifle(legacyRifle());
  const stored = encodeRifle(rifle);
  assert.equal(stored.defaultClickHorizontal, 0.25);
  assert.equal(stored.defaultClickHorizontalRad, rifle.defaultClickHorizontalRad);
  assert.ok(Math.abs(stored.cartridges[0].precision.r50Mrad - 0.14) < 1e-12);
  assert.equal(stored.cartridges[0].zeroAtmosphere.pressureHpa, 845);
  assert.equal(stored.cartridges[0].zeroAtmosphere.humidityPct, 30);
  assert.deepEqual(decodeRifle(stored), rifle);
  assert.deepEqual(decodeRifle(JSON.parse(JSON.stringify(stored))), rifle);
});

test('a legacy twin an earlier build changed after the last SI write wins over the stale SI field', () => {
  const stored = encodeRifle(decodeRifle(legacyRifle()));
  // an earlier build edits the record keeping every field it does not know (a spread), so the SI twins go stale
  const editedByOldBuild = { ...stored, defaultClickVertical: 0.5, cartridges: [{ ...stored.cartridges[0], zeroAtmosphere: { ...stored.cartridges[0].zeroAtmosphere, pressureHpa: 900 } }] };
  const rifle = decodeRifle(editedByOldBuild);
  assert.equal(rifle.defaultClickVerticalRad, moaToRad(0.5));
  assert.equal(rifle.defaultClickHorizontalRad, moaToRad(0.25), 'the untouched field keeps its SI value');
  assert.equal(rifle.cartridges[0].zeroAtmosphere.pressurePa, 90000);
  assert.equal(rifle.cartridges[0].zeroAtmosphere.humidity, 0.3);
  // an earlier build clearing a value: the twin is null, the stale SI value must not survive
  const cleared = { ...stored, cartridges: [{ ...stored.cartridges[0], precision: { ...stored.cartridges[0].precision, r50Mrad: null } }] };
  assert.equal(decodeRifle(cleared).cartridges[0].precision.r50Rad, null);
  // a turret unit changed by an earlier build: the values are now in the new unit
  const reUnited = { ...stored, defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1 };
  assert.equal(decodeRifle(reUnited).defaultClickHorizontalRad, mradToRad(0.1));
});

test('a record holding only the SI fields (no twins) decodes as is', () => {
  const rifle = { id: 'r', name: 'R', defaultClickUnit: 'mrad', defaultClickHorizontalRad: 1e-4, defaultClickVerticalRad: 2e-4, cartridges: [] };
  assert.deepEqual(decodeRifle(rifle), rifle);
});

test('locations: target inclines in radians, with the degrees twin', () => {
  const stored = { id: 'l', name: 'L', photo: null, targets: [{ id: 't1', rangeM: 300, losAngleDeg: 6 }, { id: 't2', rangeM: 500, losAngleDeg: null }, { id: 't3', rangeM: 700 }] };
  const location = decodeLocation(stored);
  assert.deepEqual(location.targets, [{ id: 't1', rangeM: 300, losAngleRad: degToRad(6) }, { id: 't2', rangeM: 500, losAngleRad: null }, { id: 't3', rangeM: 700 }]);
  const encoded = encodeLocation(location);
  assert.equal(encoded.targets[0].losAngleDeg, 6);
  assert.deepEqual(decodeLocation(encoded), location);
  assert.deepEqual(decodeLocation({ id: 'x', name: 'Gone', deletedAt: '2026-01-01T00:00:00.000Z', targets: [] }).targets, []);
});

test('rifle-precision projects: caliber and ruler length in metres, with the mm twins', () => {
  const stored = { id: 'p', name: 'P', distanceM: 100, caliberMm: 7.62, targets: [{ id: 't', calibration: { point1: null, point2: null, realLengthMm: 100 }, groups: [] }] };
  const project = decodeRiflePrecisionProject(stored);
  assert.equal(project.caliberM, mmToM(7.62));
  assert.equal(project.targets[0].calibration.realLengthM, mmToM(100));
  assert.ok(!('caliberMm' in project) && !('realLengthMm' in project.targets[0].calibration));
  const encoded = encodeRiflePrecisionProject(project);
  assert.equal(encoded.caliberMm, 7.62);
  assert.equal(encoded.targets[0].calibration.realLengthMm, 100);
  assert.deepEqual(decodeRiflePrecisionProject(encoded), project);
});

test('decodeRecord dispatches by the sync layer\'s record type; bullets have nothing to convert', () => {
  const bullet = { id: 'b', name: 'B', caliberM: 0.00782, bc: 0.5 };
  assert.equal(decodeRecord('bullet', bullet), bullet);
  assert.equal(decodeRecord('rifle', legacyRifle()).defaultClickVerticalRad, moaToRad(0.125));
});

test('merge: the same record stored by an earlier build and stored with its SI fields alongside compare equal', () => {
  const legacy = legacyRifle();
  const dualWritten = { ...encodeRifle(decodeRifle(legacy)), revision: legacy.revision, modifiedAt: legacy.modifiedAt };
  assert.equal(resolveRecord(legacy, dualWritten, decodeRifle).action, 'noop');
  assert.equal(resolveRecord(dualWritten, legacy, decodeRifle).action, 'noop');
  // without the decoder (an earlier build's comparison), the extra fields read as diverged content
  assert.equal(resolveRecord(legacy, dualWritten).action, 'skip-review');
  // a real difference still surfaces
  const changed = { ...dualWritten, defaultClickVerticalRad: moaToRad(1), defaultClickVertical: 1 };
  assert.equal(resolveRecord(legacy, changed, decodeRifle).action, 'skip-review');
});
