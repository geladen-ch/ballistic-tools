import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probableErrorToSD, r50ToSD, r95ToSD, r99ToSD, es5ToSD, es10ToSD, sdToR50,
  CONVENTION_TO_SD, conventionValueToR50Mrad, precisionToR50Mrad,
  angularSDToLinear, trajectoryPerturbationSD, rangeEstimationSD,
  movingTargetLeadSD, combineSD
} from '../src/engine/dispersion-sources.js';
import { solveZeroAngle, computeImpact } from '../src/engine/trajectory.js';

const baseState = {
  muzzleVelocity: 840, bc: 0.475, dragModel: 'G1',
  zeroRange: 100, sightHeightM: 0.05,
  windSpeed: 0, windAngle: 90,
  tempC: 15, pressurePa: 101325, altitudeM: 0, humidity: 0
};

test('probableErrorToSD divides by 0.6745', () => {
  assert.ok(Math.abs(probableErrorToSD(6.745) - 10) < 1e-9);
});

test('r50ToSD / r95ToSD / r99ToSD / es5ToSD / es10ToSD use their confirmed factors', () => {
  assert.ok(Math.abs(r50ToSD(1.1774) - 1) < 1e-9);
  assert.ok(Math.abs(r95ToSD(2.4477) - 1) < 1e-9);
  assert.ok(Math.abs(r99ToSD(3.0349) - 1) < 1e-9);
  assert.ok(Math.abs(es5ToSD(3.06588) - 1) < 1e-9);
  assert.ok(Math.abs(es10ToSD(3.81158) - 1) < 1e-9);
});

test('sdToR50 is the exact inverse of r50ToSD', () => {
  assert.ok(Math.abs(sdToR50(r50ToSD(0.42)) - 0.42) < 1e-9);
});

test('CONVENTION_TO_SD exposes all five conventions, matching their own named converters', () => {
  assert.equal(CONVENTION_TO_SD.r50, r50ToSD);
  assert.equal(CONVENTION_TO_SD.r95, r95ToSD);
  assert.equal(CONVENTION_TO_SD.r99, r99ToSD);
  assert.equal(CONVENTION_TO_SD.es5, es5ToSD);
  assert.equal(CONVENTION_TO_SD.es10, es10ToSD);
});

test('conventionValueToR50Mrad round-trips a value quoted as R50 unchanged', () => {
  assert.ok(Math.abs(conventionValueToR50Mrad(0.3, 'r50') - 0.3) < 1e-9);
});

test('conventionValueToR50Mrad re-expresses a non-R50 convention as the equivalent R50', () => {
  // A group whose R99 is 3.0349 mrad has an SD of 1 mrad, which is also an
  // R50 of 1.1774 mrad -- same underlying dispersion, different quantile.
  assert.ok(Math.abs(conventionValueToR50Mrad(3.0349, 'r99') - 1.1774) < 1e-6);
});

test('the ES factors match the simulation figures they are quoted from', () => {
  // E[extreme spread]/SD has no closed form past two shots, so unlike the
  // Rayleigh factors above these cannot be checked against an expression --
  // only against the published values, and for ordering. Guards against a
  // transposed or misplaced digit rather than against the last place.
  assert.ok(Math.abs(es5ToSD(3.0658795) - 1) < 5e-6);
  assert.ok(Math.abs(es10ToSD(3.8115826) - 1) < 5e-6);
  // Extreme spread is strictly increasing in shot count, and the two-shot
  // case is exactly sqrt(pi) -- so both factors must exceed it, in order.
  assert.ok(es5ToSD(Math.sqrt(Math.PI)) < 1);
  assert.ok(es10ToSD(3.0658795) < 1);
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

test('movingTargetLeadSD matches estimatedSpeed * tof * SD(speedErrorPct) converted to cm, horizontal only', () => {
  const { x, y } = movingTargetLeadSD(10, 10, 1);
  const expected = 10 * 1 * probableErrorToSD(10 / 100) * 100;
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

test('precisionToR50Mrad adds bench rifle and position-scaled shooter skill in quadrature on the vertical axis', () => {
  const detailed = { benchR50: 0.3, shooterR50: 0.2, positionH: 9, positionV: 2 };
  assert.ok(Math.abs(precisionToR50Mrad({ precisionMode: 'detailed', detailed }) - Math.hypot(0.3, 0.4)) < 1e-12);
  assert.ok(Math.abs(precisionToR50Mrad({ precisionMode: 'detailed', detailed: { ...detailed, shooterR50: 0 } }) - 0.3) < 1e-12, 'no shooter term leaves the rifle alone');
});

test('precisionToR50Mrad passes a simplified value through its own convention', () => {
  const simplified = { value: 0.5, convention: 'r95' };
  assert.equal(precisionToR50Mrad({ precisionMode: 'simplified', simplified }), conventionValueToR50Mrad(0.5, 'r95'));
  assert.ok(Math.abs(precisionToR50Mrad({ precisionMode: 'simplified', simplified: { value: 0.3, convention: 'r50' } }) - 0.3) < 1e-12);
});
