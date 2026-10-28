import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldOfViewAngle } from '../src/quantity.js';
import { parseReticle, FILE_FORMAT } from '../src/reticle/file-codec.js';
import { reticleRecordFromLegacy, scopeRecordFromLegacy } from '../src/reticle/legacy-file.js';
import { encodeReticleRecord, decodeReticleRecord } from '../src/reticle/reticle-record.js';
import { validateScopeRecord, actualMagnificationMin, DEFAULT_CLICK_RAD } from '../src/scope-record.js';

const v2 = (scope) => parseReticle(JSON.stringify({
  format: FILE_FORMAT, version: 2, name: 'Old',
  scope, illumination: { enabled: true, colour: 'amber' },
  elements: [{ type: 'dot', x: 0, y: 0.001, diameter: 0.0002 }, { type: 'dot', x: 0, y: 0.002, diameter: 0.0002, groupId: 'g' }, { type: 'dot', x: 0, y: 0.003, diameter: 0.0002, groupId: 'g' }]
}));

test('a legacy file becomes a reticle record with the given identity and the file\'s drawing', () => {
  const doc = v2({ type: 'ffp', fovMaxRad: fieldOfViewAngle(13, 100), fovMinRad: fieldOfViewAngle(2.1, 100), fovDistanceM: 100, zoomMin: 3.23, zoomMax: 20 });
  const derived = reticleRecordFromLegacy(doc, { manufacturer: 'Acme', model: 'X' });
  assert.deepEqual(derived.referenceScope, { type: 'ffp', zoomMin: 3.23, zoomMax: 20, calibrationZoom: 20 });
  const corrected = reticleRecordFromLegacy(doc, { manufacturer: 'Acme', model: 'X', referenceScope: { type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 20 } });
  const back = decodeReticleRecord(encodeReticleRecord({ id: 'r', ...corrected }));
  assert.equal(back.name, 'Acme X');
  assert.equal(back.referenceScope.zoomMin, 3);
  assert.deepEqual(back.illumination, { enabled: true, colour: 'amber' });
  assert.equal(back.elements.length, 3);
  assert.equal(back.groups.length, 1);
});

test('a legacy file\'s optics become a valid scope; the field of view sets the actual low magnification', () => {
  const doc = v2({ type: 'sfp', fovMaxRad: fieldOfViewAngle(9, 100), fovMinRad: fieldOfViewAngle(2.25, 100), fovDistanceM: 100, zoomMin: 4, zoomMax: 16, calibrationZoom: 10 });
  const scope = scopeRecordFromLegacy(doc.legacyScope, { manufacturer: 'Acme', model: '4-16x44', magnificationMin: 4, magnificationMax: 16, reticleIds: ['r'] });
  assert.deepEqual(validateScopeRecord(scope), {});
  assert.equal(scope.calibrationZoom, 10);
  assert.equal(scope.clickUnit, 'mrad');
  assert.equal(scope.clickHorizontalRad, DEFAULT_CLICK_RAD.mrad);
  assert.ok(Math.abs(actualMagnificationMin(scope) - 4) < 1e-9);

  const fixed = v2({ type: 'fixed', fovMaxRad: fieldOfViewAngle(12.2, 100), fovDistanceM: 100 });
  const acog = scopeRecordFromLegacy(fixed.legacyScope, { manufacturer: 'T', model: 'ACOG', magnificationMin: 4, magnificationMax: 9, clickUnit: 'arcmin' });
  assert.deepEqual(validateScopeRecord(acog), {});
  assert.deepEqual([acog.magnificationMax, acog.fovMinRad, acog.calibrationZoom], [4, null, null], 'a fixed scope: one magnification, one field');
  assert.equal(acog.clickVerticalRad, DEFAULT_CLICK_RAD.arcmin);
});
