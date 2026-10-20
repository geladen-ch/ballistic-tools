import test from 'node:test';
import assert from 'node:assert/strict';
import { angularUnitToLinearAtRange, convertAngularValue, clicksForOffset } from '../src/units.js';
import { mradToRad, linearToAngleAtRange, radToMrad, radToMoa } from '../src/quantity.js';

test('1 mrad subtends 10cm at 100m (the classic shooter\'s rule)', () => {
  assert.ok(Math.abs(angularUnitToLinearAtRange('mrad', 100) - 0.1) < 1e-12);
});

test('1 MOA subtends ~2.9089cm at 100m', () => {
  assert.ok(Math.abs(angularUnitToLinearAtRange('arcmin', 100) - 0.029088820866572157) < 1e-12);
});

test('displacement scales linearly with range', () => {
  const at100 = angularUnitToLinearAtRange('mrad', 100);
  const at300 = angularUnitToLinearAtRange('mrad', 300);
  assert.ok(Math.abs(at300 - at100 * 3) < 1e-9);
});

test('convertAngularValue round-trips between mrad and MOA', () => {
  const moa = convertAngularValue(0.1, 'mrad', 'arcmin');
  assert.ok(Math.abs(moa - 0.3437746770784939) < 1e-9);
  const backToMrad = convertAngularValue(moa, 'arcmin', 'mrad');
  assert.ok(Math.abs(backToMrad - 0.1) < 1e-9);
});

test('convertAngularValue is a no-op when units match', () => {
  assert.equal(convertAngularValue(0.25, 'arcmin', 'arcmin'), 0.25);
});

test('clicksForOffset: -30cm drop at 300m with 0.1 mrad/click needs 10 clicks', () => {
  // 0.1 mrad/click -> 0.1 * 30cm(cm-per-mrad-at-300m) = 3cm per click
  const clicks = clicksForOffset(-0.3, mradToRad(0.1), 300);
  assert.ok(Math.abs(clicks - -10) < 1e-9, `got ${clicks}`);
});

test('clicksForOffset returns 0 rather than Infinity/NaN for a zero click value or range', () => {
  assert.equal(clicksForOffset(-0.3, 0, 300), 0);
  assert.equal(clicksForOffset(-0.3, mradToRad(0.1), 0), 0);
});

test('a coarser click value needs fewer clicks for the same offset', () => {
  const fineClicks = Math.abs(clicksForOffset(-0.3, mradToRad(0.1), 300));
  const coarseClicks = Math.abs(clicksForOffset(-0.3, mradToRad(0.5), 300));
  assert.ok(coarseClicks < fineClicks);
});

test('the raw angular correction of an offset (the trajectory table\'s mrad/MOA columns) is its angle at its range', () => {
  // -30cm at 300m subtends 1 mrad (10 cm per mrad at 100 m, 30 cm at 300 m).
  assert.ok(Math.abs(radToMrad(linearToAngleAtRange(-0.3, 300)) - -1) < 1e-9);
  assert.ok(Math.abs(radToMoa(linearToAngleAtRange(-0.3, 300)) - -0.3 / angularUnitToLinearAtRange('arcmin', 300)) < 1e-9);
  // one click of 1 mrad is the same thing in clicks
  assert.ok(Math.abs(clicksForOffset(-0.3, mradToRad(1), 300) - -1) < 1e-9);
});
