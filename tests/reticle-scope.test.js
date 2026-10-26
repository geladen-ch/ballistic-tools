import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldOfViewAngle, fieldOfViewWidth } from '../src/quantity.js';
import { defaultScope, zoomRatio, zoomPartner, visibleFieldRadius, validateScope } from '../src/reticle/scope.js';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);

test('fieldOfViewAngle is the exact full angle 2·atan(X/2/Y), and fieldOfViewWidth inverts it', () => {
  close(fieldOfViewAngle(10, 100), 2 * Math.atan(0.05));
  close(fieldOfViewWidth(fieldOfViewAngle(7.3, 100), 100), 7.3);
  assert.equal(fieldOfViewAngle(1, 0), 0);
});

test('a real 4-24x scope: FoV 9.4 m to 1.6 m at 100 m gives a zoom ratio of X1/X2', () => {
  const scope = { ...defaultScope(), fovMaxRad: fieldOfViewAngle(9.4, 100), fovMinRad: fieldOfViewAngle(1.6, 100) };
  close(zoomRatio(scope.fovMaxRad, scope.fovMinRad), 9.4 / 1.6, 1e-9);
  close(zoomPartner(scope, 'min', 4), 4 * 9.4 / 1.6, 1e-9);
  close(zoomPartner(scope, 'max', 23.5), 4, 1e-9);
  assert.ok(Number.isNaN(zoomPartner(scope, 'min', 0)));
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
