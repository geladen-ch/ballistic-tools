import test from 'node:test';
import assert from 'node:assert/strict';
import { angularUnitToCmAtRange, convertAngularValue, clicksForOffset } from '../src/units.js';

test('1 mrad subtends 10cm at 100m (the classic shooter\'s rule)', () => {
  assert.ok(Math.abs(angularUnitToCmAtRange('mrad', 100) - 10) < 1e-9);
});

test('1 MOA subtends ~2.9089cm at 100m', () => {
  assert.ok(Math.abs(angularUnitToCmAtRange('arcmin', 100) - 2.9088820866572157) < 1e-9);
});

test('displacement scales linearly with range', () => {
  const at100 = angularUnitToCmAtRange('mrad', 100);
  const at300 = angularUnitToCmAtRange('mrad', 300);
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
  const clicks = clicksForOffset(-30, 0.1, 'mrad', 300);
  assert.ok(Math.abs(clicks - -10) < 1e-9, `got ${clicks}`);
});

test('clicksForOffset returns 0 rather than Infinity/NaN for a zero click value or range', () => {
  assert.equal(clicksForOffset(-30, 0, 'mrad', 300), 0);
  assert.equal(clicksForOffset(-30, 0.1, 'mrad', 0), 0);
});

test('a coarser click value needs fewer clicks for the same offset', () => {
  const fineClicks = Math.abs(clicksForOffset(-30, 0.1, 'mrad', 300));
  const coarseClicks = Math.abs(clicksForOffset(-30, 0.5, 'mrad', 300));
  assert.ok(coarseClicks < fineClicks);
});

test('clicksForOffset with a click value of 1 gives the raw angular correction (used by the mrad/MOA table columns)', () => {
  // -30cm at 300m is 10cm-per-mrad-at-300m * 3 = "3 mrad" of drop, and
  // roughly 3/0.29088... MOA — this is exactly what the trajectory
  // table's Elev(mrad)/Elev(MOA) columns compute, independent of the
  // scope's actual click value.
  const mrad = clicksForOffset(-30, 1, 'mrad', 300);
  assert.ok(Math.abs(mrad - -1) < 1e-9, `got ${mrad}`); // -30cm / 30cm-per-mrad-at-300m

  const moa = clicksForOffset(-30, 1, 'arcmin', 300);
  const expectedMoa = -30 / angularUnitToCmAtRange('arcmin', 300);
  assert.ok(Math.abs(moa - expectedMoa) < 1e-9);
});
