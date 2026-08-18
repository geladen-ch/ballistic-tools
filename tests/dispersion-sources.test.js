import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probableErrorToSD, r50ToSD, r99ToSD, es5ToSD, es10ToSD,
  angularSDToLinear, trajectoryPerturbationSD, rangeEstimationSD,
  movingTargetLeadSD, combineSD
} from '../src/engine/dispersion-sources.js';
import { solveZeroAngle, computeImpact } from '../src/engine/trajectory.js';

const baseState = {
  muzzleVelocity: 840, bc: 0.475, dragModel: 'G1',
  zeroRange: 100, sightHeight: 50,
  windSpeed: 0, windAngle: 90,
  tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0
};

test('probableErrorToSD divides by 0.6745', () => {
  assert.ok(Math.abs(probableErrorToSD(6.745) - 10) < 1e-9);
});

test('r50ToSD / r99ToSD / es5ToSD / es10ToSD use their confirmed factors', () => {
  assert.ok(Math.abs(r50ToSD(1.1774) - 1) < 1e-9);
  assert.ok(Math.abs(r99ToSD(3.0349) - 1) < 1e-9);
  assert.ok(Math.abs(es5ToSD(3.06) - 1) < 1e-9);
  assert.ok(Math.abs(es10ToSD(3.79) - 1) < 1e-9);
});

test('angularSDToLinear: 1 mrad at 1000m is 100cm (the standard "mrad at range" rule)', () => {
  assert.ok(Math.abs(angularSDToLinear(1, 1000) - 100) < 1e-9);
});

test('trajectoryPerturbationSD returns zero when sd is zero, without evaluating the trajectory', () => {
  assert.deepEqual(trajectoryPerturbationSD(baseState, 'muzzleVelocity', 840, 0, 500), { x: 0, y: 0 });
});

test('trajectoryPerturbationSD produces a nonzero vertical contribution for muzzle velocity SD', () => {
  const targetRange = 500;
  const launchAngle = solveZeroAngle({ ...baseState, zeroRange: targetRange });
  const nominalImpact = computeImpact({ ...baseState, launchAngle }, targetRange);
  const { x, y } = trajectoryPerturbationSD(baseState, 'muzzleVelocity', 840, 8, targetRange, launchAngle, nominalImpact);
  assert.ok(y > 0, 'a faster/slower muzzle velocity should change drop at a fixed dialed-in angle');
  assert.ok(Math.abs(x) < 1e-9, 'muzzle velocity has no lateral effect');
});

test('rangeEstimationSD is vertical-only and zero when sd is zero', () => {
  const targetRange = 500;
  const launchAngle = solveZeroAngle({ ...baseState, zeroRange: targetRange });
  const nominalImpact = computeImpact({ ...baseState, launchAngle }, targetRange);
  assert.deepEqual(rangeEstimationSD(baseState, 0, targetRange, nominalImpact), { x: 0, y: 0 });

  const { x, y } = rangeEstimationSD(baseState, 20, targetRange, nominalImpact);
  assert.equal(x, 0);
  assert.ok(y > 0, 'dialing for the wrong range should produce a vertical miss');
});

test('movingTargetLeadSD matches estimatedSpeed * tof * SD(speedErrorPct), horizontal only', () => {
  const { x, y } = movingTargetLeadSD(10, 10, 1);
  const expected = 10 * 1 * probableErrorToSD(10 / 100);
  assert.ok(Math.abs(x - expected) < 1e-9);
  assert.equal(y, 0);
});

test('movingTargetLeadSD is zero when either speed or error is zero', () => {
  assert.deepEqual(movingTargetLeadSD(0, 10, 1), { x: 0, y: 0 });
  assert.deepEqual(movingTargetLeadSD(10, 0, 1), { x: 0, y: 0 });
});

test('combineSD adds variances (sqrt of sum of squares), keeping the source list', () => {
  const contributions = [{ id: 'a', x: 3, y: 0 }, { id: 'b', x: 4, y: 0 }, { id: 'c', x: 0, y: 5 }];
  const { sdX, sdY } = combineSD(contributions);
  assert.ok(Math.abs(sdX - 5) < 1e-9, '3-4-5 triangle: sqrt(3^2+4^2) = 5');
  assert.ok(Math.abs(sdY - 5) < 1e-9);
  assert.equal(combineSD(contributions).contributions, contributions);
});
