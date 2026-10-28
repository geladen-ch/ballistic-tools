import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldOfViewAngle, mradToRad, moaToRad } from '../src/quantity.js';
import {
  opticLabel, encodeScope, decodeScope, actualMagnificationMin, scopeOptics, defaultScopeRecord, validateScopeRecord,
  isUsableScope, DEFAULT_CLICK_RAD
} from '../src/scope-record.js';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);

// A 3-20x scope whose fields of view are 13 m and 2.1 m at 100 m.
function pm2(overrides = {}) {
  return {
    ...defaultScopeRecord(), id: 's1', manufacturer: 'Schmidt & Bender', model: '3-20x50 PM II', reticleIds: ['r1'],
    magnificationMin: 3, magnificationMax: 20, fovMaxRad: fieldOfViewAngle(13, 100), fovMinRad: fieldOfViewAngle(2.1, 100),
    ...overrides
  };
}

test('opticLabel: manufacturer and model, trimmed, either may be blank', () => {
  assert.equal(opticLabel({ manufacturer: ' Trijicon ', model: 'ACOG 4x32 ' }), 'Trijicon ACOG 4x32');
  assert.equal(opticLabel({ manufacturer: '', model: 'P4LF' }), 'P4LF');
  assert.equal(opticLabel({}), '');
});

test('the name is derived from manufacturer and model on encode and decode, never kept stale', () => {
  assert.equal(encodeScope(pm2({ name: 'stale' })).name, 'Schmidt & Bender 3-20x50 PM II');
  assert.equal(decodeScope({ ...pm2(), name: 'tampered' }).name, 'Schmidt & Bender 3-20x50 PM II');
  const tomb = { id: 's1', name: 'Old', deletedAt: '2026-01-01T00:00:00.000Z', reticleIds: [] };
  assert.equal(decodeScope(tomb), tomb);
  assert.equal(encodeScope(tomb), tomb);
});

test('actual low magnification: the nominal high one over the ratio of the two fields', () => {
  close(actualMagnificationMin(pm2()), 20 * 2.1 / 13, 1e-9);
  assert.equal(actualMagnificationMin({ ...pm2(), type: 'fixed', magnificationMin: 4, magnificationMax: 4 }), 4);
  assert.ok(Number.isNaN(actualMagnificationMin(pm2({ fovMinRad: 0 }))));
  const optics = scopeOptics(pm2({ type: 'sfp', calibrationZoom: 10 }));
  close(optics.zoomMin, 20 * 2.1 / 13, 1e-9);
  assert.equal(optics.zoomMax, 20);
  assert.equal(optics.calibrationZoom, 10);
});

test('default clicks: 0.1 mrad and 0.25 MOA', () => {
  close(DEFAULT_CLICK_RAD.mrad, mradToRad(0.1));
  close(DEFAULT_CLICK_RAD.arcmin, moaToRad(0.25));
  assert.equal(defaultScopeRecord().clickHorizontalRad, DEFAULT_CLICK_RAD.mrad);
});

test('validateScopeRecord', () => {
  assert.deepEqual(validateScopeRecord(pm2()), {});
  const fixed = { ...pm2(), type: 'fixed', magnificationMin: 4, magnificationMax: 4, fovMinRad: null };
  assert.deepEqual(validateScopeRecord(fixed), {});
  assert.equal(validateScopeRecord(pm2({ manufacturer: ' ' })).manufacturer, 'required');
  assert.equal(validateScopeRecord(pm2({ model: '' })).model, 'required');
  assert.equal(validateScopeRecord(pm2({ magnificationMax: 3 })).magnificationMax, 'magnificationOrder');
  assert.equal(validateScopeRecord(pm2({ magnificationMin: 0 })).magnificationMin, 'positive');
  assert.equal(validateScopeRecord(pm2({ fovMinRad: fieldOfViewAngle(20, 100) })).fovMinRad, 'fovMinBelowMax');
  assert.equal(validateScopeRecord(pm2({ fovMaxRad: null })).fovMaxRad, 'positive');
  assert.equal(validateScopeRecord(pm2({ clickUnit: 'deg' })).clickUnit, 'required');
  assert.equal(validateScopeRecord(pm2({ clickVerticalRad: 0 })).clickVerticalRad, 'positive');
  // SFP: the calibration zoom inside the actual range (3.23-20x here).
  assert.deepEqual(validateScopeRecord(pm2({ type: 'sfp', calibrationZoom: 10 })), {});
  assert.equal(validateScopeRecord(pm2({ type: 'sfp', calibrationZoom: 3.1 })).calibrationZoom, 'calibrationInRange');
  assert.equal(validateScopeRecord(pm2({ type: 'sfp', calibrationZoom: null })).calibrationZoom, 'positive');
});

test('a scope is usable on a rifle only with a reticle', () => {
  assert.ok(isUsableScope(pm2()));
  assert.ok(!isUsableScope(pm2({ reticleIds: [] })));
});
