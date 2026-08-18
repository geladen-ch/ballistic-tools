import test from 'node:test';
import assert from 'node:assert/strict';
import {
  engineToDisplay, displayToEngine, engineSpanToDisplay, roundForDisplay, unitChoice
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
