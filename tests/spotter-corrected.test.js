import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSpotterCorrected } from '../src/engine/spotter-corrected.js';

const nominalState = {
  muzzleVelocity: 840, bc: 0.475, dragModel: 'G1',
  sightHeight: 50,
  windSpeed: 0, windAngle: 90,
  tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0
};

const zeroOwnErrors = { muzzleVelocitySD: 0, precisionMode: 'detailed', detailed: { benchR50: 0, shooterR50: 0, positionH: 1, positionV: 1 } };
const zeroConditionErrors = { distanceMedianErrorPct: 0, tempMedianErrorC: 0, pressureMedianErrorHpa: 0, windMedianErrorMs: 0, movingTarget: { speedMs: 0, speedMedianErrorPct: 0 } };

test('with every uncertainty source at zero, both shots have zero dispersion and ~zero offset', () => {
  const result = computeSpotterCorrected({
    nominalState, targetRange: 500,
    ownErrors: zeroOwnErrors, conditionErrors: zeroConditionErrors,
    sightingShotCount: 1, spotterMeasureMrad: 0
  });
  assert.equal(result.sighting.sdX, 0);
  assert.equal(result.sighting.sdY, 0);
  assert.equal(result.corrected.sdX, 0);
  assert.equal(result.corrected.sdY, 0);
  assert.ok(Math.abs(result.sighting.offsetX) < 1e-3);
  assert.ok(Math.abs(result.sighting.offsetY) < 1e-3);
  assert.ok(Math.abs(result.corrected.offsetX) < 1e-3);
  assert.ok(Math.abs(result.corrected.offsetY) < 1e-3);
});

test('condition errors drive the sighting shot but never appear in the corrected shot\'s contributions', () => {
  const result = computeSpotterCorrected({
    nominalState, targetRange: 500,
    ownErrors: zeroOwnErrors,
    conditionErrors: { ...zeroConditionErrors, windMedianErrorMs: 1, tempMedianErrorC: 5 },
    sightingShotCount: 1, spotterMeasureMrad: 0
  });
  assert.ok(result.sighting.sdX > 0 || result.sighting.sdY > 0, 'condition errors should disperse the sighting shot');
  const sightingIds = result.sighting.contributions.map((c) => c.id);
  assert.ok(sightingIds.includes('windEstimation'));
  assert.ok(sightingIds.includes('temperatureEstimation'));
  const correctedIds = result.corrected.contributions.map((c) => c.id);
  assert.ok(!correctedIds.includes('windEstimation'));
  assert.ok(!correctedIds.includes('temperatureEstimation'));
  assert.ok(!correctedIds.includes('distanceEstimation'));
  assert.ok(!correctedIds.includes('movingTarget'));
});

test('moving target lead error is treated as a condition error: drives the sighting shot only', () => {
  const result = computeSpotterCorrected({
    nominalState, targetRange: 500,
    ownErrors: zeroOwnErrors,
    conditionErrors: { ...zeroConditionErrors, movingTarget: { speedMs: 3, speedMedianErrorPct: 10 } },
    sightingShotCount: 1, spotterMeasureMrad: 0
  });
  assert.ok(result.sighting.sdX > 0);
  assert.ok(result.sighting.contributions.some((c) => c.id === 'movingTarget'));
  assert.ok(!result.corrected.contributions.some((c) => c.id === 'movingTarget'));
});

test('own-error sources are layered in the corrected shot: exactly x*sqrt(1+1/N) at N sighting shots', () => {
  const ownErrors = { muzzleVelocitySD: 0, precisionMode: 'simplified', simplified: { value: 0.5, convention: 'r50' } };
  for (const n of [1, 3, 5]) {
    const result = computeSpotterCorrected({
      nominalState, targetRange: 500,
      ownErrors, conditionErrors: zeroConditionErrors,
      sightingShotCount: n, spotterMeasureMrad: 0
    });
    const directX = result.sighting.contributions.find((c) => c.id === 'combinedPrecision').x;
    const correctedX = result.corrected.contributions.find((c) => c.id === 'combinedPrecision').x;
    const expected = directX * Math.sqrt(1 + 1 / n);
    assert.ok(Math.abs(correctedX - expected) < 1e-9, `n=${n}: expected ${expected}, got ${correctedX}`);
  }
});

test('more sighting shots shrink the corrected shot\'s dispersion toward (but never below) the own-error floor', () => {
  const ownErrors = { muzzleVelocitySD: 3, precisionMode: 'simplified', simplified: { value: 0.3, convention: 'r50' } };
  const conditionErrors = { ...zeroConditionErrors, windMedianErrorMs: 1 };
  const sds = [1, 2, 3, 4, 5].map((n) => computeSpotterCorrected({
    nominalState, targetRange: 500, ownErrors, conditionErrors,
    sightingShotCount: n, spotterMeasureMrad: 1.5
  }).corrected.sdY);
  for (let i = 1; i < sds.length; i++) assert.ok(sds[i] < sds[i - 1], `sd should shrink monotonically with N: ${sds}`);

  const ownOnly = computeSpotterCorrected({
    nominalState, targetRange: 500, ownErrors, conditionErrors: zeroConditionErrors,
    sightingShotCount: 1, spotterMeasureMrad: 0
  }).sighting.sdY;
  assert.ok(sds[sds.length - 1] > ownOnly, 'even at N=5 the corrected shot should stay above the pure own-error floor');
});

test('the spotter\'s measure adds a spotterEye contribution to the corrected shot, scaled by 1/sqrt(N)', () => {
  const withSpotterError = computeSpotterCorrected({
    nominalState, targetRange: 500,
    ownErrors: zeroOwnErrors, conditionErrors: zeroConditionErrors,
    sightingShotCount: 4, spotterMeasureMrad: 2
  });
  const spotterC = withSpotterError.corrected.contributions.find((c) => c.id === 'spotterEye');
  assert.ok(spotterC, 'expected a spotterEye contribution');
  assert.ok(Math.abs(spotterC.x - spotterC.y) < 1e-9, 'spotter error applies equally to both axes');

  const n1 = computeSpotterCorrected({
    nominalState, targetRange: 500, ownErrors: zeroOwnErrors, conditionErrors: zeroConditionErrors,
    sightingShotCount: 1, spotterMeasureMrad: 2
  }).corrected.contributions.find((c) => c.id === 'spotterEye').x;
  assert.ok(Math.abs(spotterC.x - n1 / 2) < 1e-9, 'N=4 should be exactly half of N=1 (1/sqrt(4) = 1/2)');
});

test('a perfect spotter (median error 0) adds no spotterEye contribution', () => {
  const result = computeSpotterCorrected({
    nominalState, targetRange: 500,
    ownErrors: zeroOwnErrors, conditionErrors: zeroConditionErrors,
    sightingShotCount: 1, spotterMeasureMrad: 0
  });
  assert.ok(!result.corrected.contributions.some((c) => c.id === 'spotterEye'));
});

test('battle zero produces a real systematic offset for the sighting shot, but the corrected shot only carries the deliberate aim offset', () => {
  const result = computeSpotterCorrected({
    nominalState, targetRange: 500, battleZeroRange: 100,
    aimOffsetXCm: 3, aimOffsetYCm: -4,
    ownErrors: zeroOwnErrors, conditionErrors: zeroConditionErrors,
    sightingShotCount: 1, spotterMeasureMrad: 0
  });
  assert.ok(result.sighting.offsetY < -10, 'sighting shot should show the uncorrected battle-zero drop');
  assert.ok(Math.abs(result.corrected.offsetX - 3) < 1e-3, 'corrected shot keeps only the deliberate aim offset');
  assert.ok(Math.abs(result.corrected.offsetY - (-4)) < 1e-3, 'battle-zero bias should not leak into the corrected shot');
});

test('sighting.ownSdX/Y and conditionSdX/Y combine back into sighting.sdX/Y', () => {
  const result = computeSpotterCorrected({
    nominalState, targetRange: 500,
    ownErrors: { muzzleVelocitySD: 0, precisionMode: 'simplified', simplified: { value: 0.4, convention: 'r50' } },
    conditionErrors: { ...zeroConditionErrors, windMedianErrorMs: 1 },
    sightingShotCount: 1, spotterMeasureMrad: 0
  });
  const recombinedX = Math.sqrt(result.sighting.ownSdX ** 2 + result.sighting.conditionSdX ** 2);
  const recombinedY = Math.sqrt(result.sighting.ownSdY ** 2 + result.sighting.conditionSdY ** 2);
  assert.ok(Math.abs(recombinedX - result.sighting.sdX) < 1e-9);
  assert.ok(Math.abs(recombinedY - result.sighting.sdY) < 1e-9);
});
