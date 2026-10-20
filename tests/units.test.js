import test from 'node:test';
import assert from 'node:assert/strict';
import {
  siToDisplay, displayToSI, siSpanToDisplay, roundForDisplay, unitChoice,
  FIELD_BOUNDS, FIELD_UNITS, UNIT_GROUPS, GROUP_KINDS, formatFieldRange, formatFieldValue, fieldInternalUnit
} from '../src/units.js';
import { kindOfUnit, internalUnit, mmToM } from '../src/quantity.js';

test('every field names a quantity kind, not a unit, and it is its group\'s kind (a temperature span shown as a temperature)', () => {
  assert.deepEqual(Object.keys(GROUP_KINDS).sort(), Object.keys(UNIT_GROUPS).sort());
  for (const [id, meta] of Object.entries(FIELD_UNITS)) {
    assert.ok(!('engineUnit' in meta), `${id} names a unit of its own`);
    const expected = meta.kind === 'temperatureDelta' ? 'temperature' : meta.kind;
    assert.equal(expected, GROUP_KINDS[meta.group], `${id}: ${meta.kind} in ${meta.group}`);
    assert.equal(fieldInternalUnit(id), internalUnit(meta.kind));
    for (const { unit } of UNIT_GROUPS[meta.group].choices) assert.ok(Number.isFinite(siToDisplay(id, 1, unit)), `${id} in ${unit}`);
  }
  for (const [group, { choices }] of Object.entries(UNIT_GROUPS)) {
    for (const { unit } of choices) assert.equal(kindOfUnit(unit), GROUP_KINDS[group], `${group}: ${unit}`);
  }
});

test('a temperature span field converts as an interval, a temperature reading as a point', () => {
  assert.ok(Math.abs(siToDisplay('tempMedianError', 5, 'tempF') - 9) < 1e-12);
  assert.ok(Math.abs(displayToSI('tempMedianError', 9, 'tempF') - 5) < 1e-12);
  assert.ok(Math.abs(siToDisplay('tempC', 5, 'tempF') - 41) < 1e-12);
});

test('bullet length is held in metres; its bounds are the former 5–100 mm', () => {
  assert.equal(FIELD_UNITS.bulletLength.kind, 'length');
  assert.ok(Math.abs(FIELD_BOUNDS.bulletLength.min - mmToM(5)) < 1e-18);
  assert.ok(Math.abs(FIELD_BOUNDS.bulletLength.max - mmToM(100)) < 1e-17);
  assert.ok(Math.abs(siToDisplay('bulletLength', 0.0315, 'mm') - 31.5) < 1e-12);
});

test('windSpeed has its own unit group, independent of velocity, with the same choices', () => {
  assert.equal(FIELD_UNITS.windSpeed.group, 'windSpeed');
  assert.notEqual(FIELD_UNITS.windSpeed.group, FIELD_UNITS.muzzleVelocity.group);
  assert.deepEqual(UNIT_GROUPS.windSpeed.choices, UNIT_GROUPS.velocity.choices);
});

test('windMedianError (Hit Probability\'s wind estimation error) rides the windSpeed group too', () => {
  assert.equal(FIELD_UNITS.windMedianError.group, 'windSpeed');
});

test('velocity round-trips through a non-metric unit', () => {
  const ftPerS = siToDisplay('muzzleVelocity', 840, 'ft/s');
  assert.ok(Math.abs(ftPerS - 2755.9055) < 0.01);
  const backToMs = displayToSI('muzzleVelocity', ftPerS, 'ft/s');
  assert.ok(Math.abs(backToMs - 840) < 1e-6);
});

test('distance converts m to yd correctly', () => {
  const yd = siToDisplay('maxRange', 100, 'yd');
  assert.ok(Math.abs(yd - 109.3613) < 0.001);
});

test('temperature point conversion applies the offset', () => {
  const f = siToDisplay('tempC', 15, 'tempF');
  assert.ok(Math.abs(f - 59) < 0.01);
  const c = displayToSI('tempC', 59, 'tempF');
  assert.ok(Math.abs(c - 15) < 0.01);
});

test('temperature span conversion does NOT apply the offset', () => {
  // A 1-degree-C step is an interval, not a point — it must scale by 1.8
  // only, never pick up the +32 point offset (that would badly mis-size
  // the slider step/min/max span in Fahrenheit).
  const span = siSpanToDisplay('tempC', 1, 'tempF');
  assert.ok(Math.abs(span - 1.8) < 1e-9);
});

test('non-affine groups have identical point and span conversions', () => {
  const point = siToDisplay('maxRange', 10, 'yd');
  const span = siSpanToDisplay('maxRange', 10, 'yd');
  assert.equal(point, span);
});

test('fields with no unit group pass through unconverted', () => {
  assert.equal(siToDisplay('bc', 0.475, 'anything'), 0.475);
  assert.equal(unitChoice('bc', 'anything'), null);
});

test('roundForDisplay respects the configured decimal precision', () => {
  assert.equal(roundForDisplay('maxRange', 'yd', 109.36133), 109.4);
  assert.equal(roundForDisplay('pressure', 'inHg', 29.91234), 29.91);
});

test('a value in its own engine unit is unchanged (no lossy round trip)', () => {
  assert.equal(siToDisplay('altitudeM', 500, 'm'), 500);
  assert.equal(displayToSI('altitudeM', 500, 'm'), 500);
});

test('energy converts J to ft-lb correctly and round-trips', () => {
  const ftlb = siToDisplay('energy', 2000, 'ft*lbf');
  assert.ok(Math.abs(ftlb - 1475.124) < 0.01);
  const backToJ = displayToSI('energy', ftlb, 'ft*lbf');
  assert.ok(Math.abs(backToJ - 2000) < 1e-6);
});

// ---- FIELD_BOUNDS / formatFieldRange / formatFieldValue (sanity-check
// validation — src/ui/field-validity.js and every field widget built on
// top of it) ----

test('FIELD_BOUNDS carries the approved bound for every field this session widened or newly bounded', () => {
  assert.deepEqual(FIELD_BOUNDS.caliberM, { min: 0.004, max: 0.021 });
  assert.deepEqual(FIELD_BOUNDS.bulletMass, { min: 1, max: 121 });
  assert.deepEqual(FIELD_BOUNDS.sightHeight, { min: 0, max: 0.5 });
  assert.deepEqual(FIELD_BOUNDS.zeroRange, { min: 0, max: 5000 });
  assert.deepEqual(FIELD_BOUNDS.riflingTwist, { min: 0.001, max: 1 });
  assert.deepEqual(FIELD_BOUNDS.muzzleVelocity, { min: 50, max: 1500 });
  assert.deepEqual(FIELD_BOUNDS.tempC, { min: -90, max: 60 });
  assert.deepEqual(FIELD_BOUNDS.windSpeed, { min: 0, max: 35 });
  assert.deepEqual(FIELD_BOUNDS.pressure, { min: 45000, max: 110000 });
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
