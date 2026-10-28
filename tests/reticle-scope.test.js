import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldOfViewAngle, fieldOfViewWidth } from '../src/quantity.js';
import {
  defaultScope, zoomRatio, visibleFieldRadius, validateScope, defaultReferenceScope, referenceOptics, referenceFieldAt,
  referenceZoomForField, referenceScopeFromOptics, validateReferenceScope
} from '../src/reticle/scope.js';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);

test('fieldOfViewAngle is the exact full angle 2·atan(X/2/Y), and fieldOfViewWidth inverts it', () => {
  close(fieldOfViewAngle(10, 100), 2 * Math.atan(0.05));
  close(fieldOfViewWidth(fieldOfViewAngle(7.3, 100), 100), 7.3);
  assert.equal(fieldOfViewAngle(1, 0), 0);
});

test('a real 4-24x scope: FoV 9.4 m to 1.6 m at 100 m gives a zoom ratio of X1/X2', () => {
  close(zoomRatio(fieldOfViewAngle(9.4, 100), fieldOfViewAngle(1.6, 100)), 9.4 / 1.6, 1e-9);
});

test('visible field: max FoV for fixed and FFP, FoV at the calibration zoom for SFP', () => {
  const scope = { ...defaultScope(), fovMaxRad: fieldOfViewAngle(7.5, 100), zoomMin: 5, zoomMax: 25, calibrationZoom: 10 };
  close(visibleFieldRadius({ ...scope, type: 'ffp' }), Math.atan(7.5 / 200));
  close(visibleFieldRadius({ ...scope, type: 'fixed' }), Math.atan(7.5 / 200));
  close(visibleFieldRadius({ ...scope, type: 'sfp' }), Math.atan(7.5 / 200 * 5 / 10));
  // At the lowest zoom an SFP reticle's subtensions are calibrated, so its field is the max field.
  close(visibleFieldRadius({ ...scope, type: 'sfp', calibrationZoom: 5 }), Math.atan(7.5 / 200));
});

test('validateScope flags an inverted field range and an out-of-range calibration zoom', () => {
  assert.deepEqual(validateScope(defaultScope()), {});
  const bad = { ...defaultScope(), fovMinRad: defaultScope().fovMaxRad * 2 };
  assert.equal(validateScope(bad).fovMinRad, 'fovMinBelowMax');
  assert.equal(validateScope({ ...defaultScope(), type: 'sfp', calibrationZoom: 40 }).calibrationZoom, 'calibrationInRange');
  // A fixed scope has no minimum field.
  assert.deepEqual(validateScope({ ...defaultScope(), type: 'fixed', fovMinRad: 0 }), {});
});

test('fieldRadiusAtZoom: FFP shrinks to the minimum field at the top of the range; SFP and fixed stay put', async () => {
  const { fieldRadiusAtZoom, zoomRange } = await import('../src/reticle/scope.js');
  const ffp = { ...defaultScope(), type: 'ffp' };
  close(fieldRadiusAtZoom(ffp, ffp.zoomMin), ffp.fovMaxRad / 2);
  close(fieldRadiusAtZoom(ffp, ffp.zoomMax), ffp.fovMinRad / 2, 1e-15);
  close(fieldRadiusAtZoom(ffp, 1000), ffp.fovMinRad / 2, 1e-15);
  const sfp = { ...ffp, type: 'sfp', calibrationZoom: 10 };
  close(fieldRadiusAtZoom(sfp, 5), visibleFieldRadius(sfp));
  close(fieldRadiusAtZoom(sfp, 25), visibleFieldRadius(sfp));
  const fixed = { ...ffp, type: 'fixed' };
  assert.equal(zoomRange(fixed), null);
  close(fieldRadiusAtZoom(fixed, 12), fixed.fovMaxRad / 2);
});

test('reference field: 12 m at 100 m at 3x, inversely proportional to the zoom', () => {
  close(fieldOfViewWidth(referenceFieldAt(3), 100), 12, 1e-12);
  close(fieldOfViewWidth(referenceFieldAt(6), 100), 6, 1e-12);
  close(fieldOfViewWidth(referenceFieldAt(24), 100), 1.5, 1e-12);
  close(referenceZoomForField(referenceFieldAt(4)), 4, 1e-12);
  assert.ok(Number.isNaN(referenceZoomForField(0)));
});

test('referenceOptics: a reference scope as the optics the view draws', () => {
  const optics = referenceOptics({ type: 'sfp', zoomMin: 4, zoomMax: 16, calibrationZoom: 10 });
  close(fieldOfViewWidth(optics.fovMaxRad, optics.fovDistanceM), 9, 1e-12);
  close(fieldOfViewWidth(optics.fovMinRad, optics.fovDistanceM), 2.25, 1e-12);
  close(zoomRatio(optics.fovMaxRad, optics.fovMinRad), 4, 1e-12);
  assert.deepEqual(validateScope(optics), {});
  // SFP: the field drawn is the one at the calibration zoom.
  close(visibleFieldRadius(optics), referenceFieldAt(10) / 2, 1e-15);
  // A fixed scope: one field, whatever its zoomMax says.
  const fixed = referenceOptics({ type: 'fixed', zoomMin: 4, zoomMax: 99, calibrationZoom: 4 });
  close(fixed.fovMaxRad, referenceFieldAt(4));
  assert.equal(fixed.zoomMax, 4);
  assert.deepEqual(validateScope(fixed), {});
});

test('referenceScopeFromOptics: zoom range kept; a fixed scope gets the zoom its field stands for', () => {
  assert.deepEqual(referenceScopeFromOptics({ ...defaultScope(), type: 'ffp', zoomMin: 3.23, zoomMax: 20, calibrationZoom: 7 }),
    { type: 'ffp', zoomMin: 3.23, zoomMax: 20, calibrationZoom: 20 });
  assert.deepEqual(referenceScopeFromOptics({ ...defaultScope(), type: 'sfp', zoomMin: 3, zoomMax: 12, calibrationZoom: 10 }),
    { type: 'sfp', zoomMin: 3, zoomMax: 12, calibrationZoom: 10 });
  const fixed = referenceScopeFromOptics({ type: 'fixed', fovMaxRad: fieldOfViewAngle(9, 100), fovDistanceM: 100 });
  close(fixed.zoomMin, 4, 1e-12);
  assert.equal(fixed.zoomMax, fixed.zoomMin);
  assert.deepEqual(validateReferenceScope(fixed), {});
});

test('validateReferenceScope', () => {
  assert.deepEqual(validateReferenceScope(defaultReferenceScope()), {});
  assert.equal(validateReferenceScope({ ...defaultReferenceScope(), zoomMin: 0 }).zoomMin, 'positive');
  assert.equal(validateReferenceScope({ ...defaultReferenceScope(), zoomMax: 5 }).zoomMax, 'zoomMaxAboveMin');
  assert.equal(validateReferenceScope({ ...defaultReferenceScope(), type: 'x' }).type, 'scopeType');
  assert.equal(validateReferenceScope({ type: 'sfp', zoomMin: 3, zoomMax: 12, calibrationZoom: 14 }).calibrationZoom, 'calibrationInRange');
  assert.equal(validateReferenceScope({ type: 'sfp', zoomMin: 3, zoomMax: 12, calibrationZoom: NaN }).calibrationZoom, 'positive');
  // Fixed: only the one magnification counts.
  assert.deepEqual(validateReferenceScope({ type: 'fixed', zoomMin: 4, zoomMax: 1, calibrationZoom: 0 }), {});
});
