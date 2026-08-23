import test from 'node:test';
import assert from 'node:assert/strict';
import {
  engineToDisplay, displayToEngine, engineSpanToDisplay, roundForDisplay, unitChoice,
  FIELD_BOUNDS, formatFieldRange, formatFieldValue
} from '../src/units.js';

test('velocity round-trips through a non-metric unit', () => {
  const ftPerS = engineToDisplay('muzzleVelocity', 840, 'ft/s');
  assert.ok(Math.abs(ftPerS - 2755.9055) < 0.01);
  const backToMs = displayToEngine('muzzleVelocity', ftPerS, 'ft/s');
  assert.ok(Math.abs(backToMs - 840) < 1e-6);
});

test('distance converts m to yd correctly', () => {
  const yd = engineToDisplay('maxRange', 100, 'yd');
  assert.ok(Math.abs(yd - 109.3613) < 0.001);
});

test('temperature point conversion applies the offset', () => {
  const f = engineToDisplay('tempC', 15, 'tempF');
  assert.ok(Math.abs(f - 59) < 0.01);
  const c = displayToEngine('tempC', 59, 'tempF');
  assert.ok(Math.abs(c - 15) < 0.01);
});

test('temperature span conversion does NOT apply the offset', () => {
  // A 1-degree-C step is an interval, not a point — it must scale by 1.8
  // only, never pick up the +32 point offset (that would badly mis-size
  // the slider step/min/max span in Fahrenheit).
  const span = engineSpanToDisplay('tempC', 1, 'tempF');
  assert.ok(Math.abs(span - 1.8) < 1e-9);
});

test('non-affine groups have identical point and span conversions', () => {
  const point = engineToDisplay('maxRange', 10, 'yd');
  const span = engineSpanToDisplay('maxRange', 10, 'yd');
  assert.equal(point, span);
});

test('fields with no unit group pass through unconverted', () => {
  assert.equal(engineToDisplay('bc', 0.475, 'anything'), 0.475);
  assert.equal(unitChoice('bc', 'anything'), null);
});

test('roundForDisplay respects the configured decimal precision', () => {
  assert.equal(roundForDisplay('maxRange', 'ft', 328.084), 328);
  assert.equal(roundForDisplay('pressureHpa', 'inHg', 29.91234), 29.91);
});

test('a value in its own engine unit is unchanged (no lossy round trip)', () => {
  assert.equal(engineToDisplay('altitudeM', 500, 'm'), 500);
  assert.equal(displayToEngine('altitudeM', 500, 'm'), 500);
});

test('energy converts J to ft-lb correctly and round-trips', () => {
  const ftlb = engineToDisplay('energy', 2000, 'ft*lbf');
  assert.ok(Math.abs(ftlb - 1475.124) < 0.01);
  const backToJ = displayToEngine('energy', ftlb, 'ft*lbf');
  assert.ok(Math.abs(backToJ - 2000) < 1e-6);
});

// ---- FIELD_BOUNDS / formatFieldRange / formatFieldValue (sanity-check
// validation — src/ui/field-validity.js and every field widget built on
// top of it) ----

test('FIELD_BOUNDS carries the approved bound for every field this session widened or newly bounded', () => {
  assert.deepEqual(FIELD_BOUNDS.caliberM, { min: 0.004, max: 0.021 });
  assert.deepEqual(FIELD_BOUNDS.bulletMass, { min: 1, max: 121 });
  assert.deepEqual(FIELD_BOUNDS.sightHeight, { min: 0, max: 500 });
  assert.deepEqual(FIELD_BOUNDS.zeroRange, { min: 0, max: 5000 });
  assert.deepEqual(FIELD_BOUNDS.riflingTwist, { min: 1, max: 1000 });
  assert.deepEqual(FIELD_BOUNDS.muzzleVelocity, { min: 50, max: 1500 });
  assert.deepEqual(FIELD_BOUNDS.tempC, { min: -90, max: 60 });
  assert.deepEqual(FIELD_BOUNDS.windSpeed, { min: 0, max: 35 });
  assert.deepEqual(FIELD_BOUNDS.pressureHpa, { min: 450, max: 1100 });
  assert.deepEqual(FIELD_BOUNDS.targetRange, { min: 10, max: 5000 });
});

test('formatFieldRange renders both bounds in the given display unit, with the unit suffix', () => {
  assert.equal(formatFieldRange('muzzleVelocity', 50, 1500, 'm/s'), '50 – 1500 m/s');
  // ft/s conversion, rounded to muzzleVelocity's own display decimals (0)
  const ftPerS = formatFieldRange('muzzleVelocity', 50, 1500, 'ft/s');
  assert.match(ftPerS, /^164 – 4921 ft\/s$/);
});

test('formatFieldRange falls back to bare numbers for a field with no FIELD_UNITS entry', () => {
  assert.equal(formatFieldRange('bc', 0.05, 1.5, 'anything'), '0.05 – 1.5');
});

test('formatFieldValue renders a single bound the same way formatFieldRange formats each half', () => {
  assert.equal(formatFieldValue('maxRange', 1000, 'm'), '1000 m');
  assert.equal(formatFieldValue('bc', 0.5, 'anything'), '0.5');
});
