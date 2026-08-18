import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMuzzleVelocity, integrate, solveZeroAngle } from '../src/engine/trajectory.js';

const baseState = {
  muzzleVelocity: 840, bc: 0.475, dragModel: 'G1',
  maxRange: 1000, zeroRange: 100, sightHeight: 50,
  windSpeed: 0, windAngle: 90,
  tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0
};

test('resolveMuzzleVelocity passes muzzleVelocity through unchanged when the correction is not configured', () => {
  assert.equal(resolveMuzzleVelocity(baseState), 840);
  assert.equal(resolveMuzzleVelocity({ ...baseState, referenceTempC: 15 }), 840); // sensitivity missing
  assert.equal(resolveMuzzleVelocity({ ...baseState, velocityTempSensitivity: 1.5 }), 840); // reference missing
});

test('resolveMuzzleVelocity applies the linear correction relative to the reference temperature', () => {
  const warm = resolveMuzzleVelocity({ ...baseState, tempC: 25, referenceTempC: 15, velocityTempSensitivity: 1.5 });
  assert.ok(Math.abs(warm - 855) < 1e-9, `expected 855, got ${warm}`);

  const cold = resolveMuzzleVelocity({ ...baseState, tempC: -5, referenceTempC: 15, velocityTempSensitivity: 1.5 });
  assert.ok(Math.abs(cold - 810) < 1e-9, `expected 810, got ${cold}`);
});

test('at the reference temperature, the correction is a no-op', () => {
  const v = resolveMuzzleVelocity({ ...baseState, tempC: 15, referenceTempC: 15, velocityTempSensitivity: 3 });
  assert.equal(v, 840);
});

test('integrate() shows a warmer cartridge going faster and flatter than an uncorrected shot', () => {
  const uncorrected = integrate(baseState);
  const warmCorrected = integrate({ ...baseState, tempC: 25, referenceTempC: 15, velocityTempSensitivity: 1.5 });

  const lastUncorrected = uncorrected.points[uncorrected.points.length - 1];
  const lastWarm = warmCorrected.points[warmCorrected.points.length - 1];

  assert.ok(lastWarm.velocity > lastUncorrected.velocity, 'higher effective V0 should retain more velocity downrange');
  // A faster bullet needs less time in flight to reach the same range, so
  // less time for gravity to pull it down: shallower drop at maxRange.
  assert.ok(lastWarm.dropCm > lastUncorrected.dropCm, 'faster bullet should drop less (dropCm is negative, so "more")');
});

test('zero angle shifts (flattens) for a temperature-corrected higher velocity', () => {
  const thetaUncorrected = solveZeroAngle(baseState);
  const thetaWarm = solveZeroAngle({ ...baseState, tempC: 25, referenceTempC: 15, velocityTempSensitivity: 1.5 });
  assert.notEqual(thetaUncorrected, thetaWarm);
});
