import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSingleShot } from '../src/engine/single-shot.js';

const nominalState = {
  muzzleVelocity: 840, bc: 0.475, dragModel: 'G1',
  sightHeight: 50,
  windSpeed: 0, windAngle: 90,
  tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0
};

const zeroOwnErrors = { muzzleVelocitySD: 0, precisionMode: 'detailed', detailed: { benchR50: 0, shooterR50: 0, positionH: 1, positionV: 1 } };
const zeroConditionErrors = { distanceMedianErrorPct: 0, tempMedianErrorC: 0, pressureMedianErrorHpa: 0, windMedianErrorMs: 0, movingTarget: { speedMs: 0, speedMedianErrorPct: 0 } };

test('with every uncertainty source at zero, sdX/sdY are exactly zero and the offset is zero (default, no battle zero, no aim offset)', () => {
  const result = computeSingleShot({
    nominalState, targetRange: 500,
    ownErrors: zeroOwnErrors, conditionErrors: zeroConditionErrors
  });
  assert.equal(result.sdX, 0);
  assert.equal(result.sdY, 0);
  // solveZeroAngle's own root-finding tolerance is 1e-5 m = 1e-3 cm, so
  // "dialed in" only holds to that precision, not bit-for-bit zero.
  assert.ok(Math.abs(result.offsetX) < 1e-3);
  assert.ok(Math.abs(result.offsetY) < 1e-3, `expected ~0 vertical offset (dialed for target range), got ${result.offsetY}`);
});

test('a battle zero different from the target range produces a nonzero vertical offset, uncorrected', () => {
  const result = computeSingleShot({
    nominalState, targetRange: 500, battleZeroRange: 100,
    ownErrors: zeroOwnErrors, conditionErrors: zeroConditionErrors
  });
  assert.ok(result.offsetY < -10, `expected a substantial uncorrected drop offset, got ${result.offsetY}`);
});

test('aiming point offset passes straight through into offsetX/offsetY', () => {
  const result = computeSingleShot({
    nominalState, targetRange: 500,
    aimOffsetXCm: 3, aimOffsetYCm: -4,
    ownErrors: zeroOwnErrors, conditionErrors: zeroConditionErrors
  });
  assert.ok(Math.abs(result.offsetX - 3) < 1e-3);
  assert.ok(Math.abs(result.offsetY - (-4)) < 1e-3);
});

test('detailed precision mode: bench and shooter each contribute, shooter scaled by position multipliers', () => {
  const result = computeSingleShot({
    nominalState, targetRange: 500,
    ownErrors: {
      muzzleVelocitySD: 0, precisionMode: 'detailed',
      detailed: { benchR50: 0.14, shooterR50: 0.12, positionH: 2.4, positionV: 1.5 } // Basic rifle, Marksman shooter, Kneeling
    },
    conditionErrors: zeroConditionErrors
  });
  const ids = result.contributions.map((c) => c.id);
  assert.ok(ids.includes('benchPrecision'));
  assert.ok(ids.includes('shooterSkill'));
  const shooter = result.contributions.find((c) => c.id === 'shooterSkill');
  assert.ok(shooter.x > shooter.y, 'kneeling has a bigger horizontal than vertical multiplier, so x should exceed y');
  assert.ok(result.sdX > 0 && result.sdY > 0);
});

test('simplified precision mode contributes exactly one source, equally to X and Y', () => {
  const result = computeSingleShot({
    nominalState, targetRange: 500,
    ownErrors: { muzzleVelocitySD: 0, precisionMode: 'simplified', simplified: { value: 0.5, convention: 'r50' } },
    conditionErrors: zeroConditionErrors
  });
  assert.deepEqual(result.contributions.map((c) => c.id), ['combinedPrecision']);
  assert.ok(Math.abs(result.sdX - result.sdY) < 1e-9);
});

test('moving target only contributes when both speed and its error are set', () => {
  const withSpeedOnly = computeSingleShot({
    nominalState, targetRange: 500, ownErrors: zeroOwnErrors,
    conditionErrors: { ...zeroConditionErrors, movingTarget: { speedMs: 3, speedMedianErrorPct: 0 } }
  });
  assert.equal(withSpeedOnly.sdX, 0);

  const withBoth = computeSingleShot({
    nominalState, targetRange: 500, ownErrors: zeroOwnErrors,
    conditionErrors: { ...zeroConditionErrors, movingTarget: { speedMs: 3, speedMedianErrorPct: 10 } }
  });
  assert.ok(withBoth.sdX > 0);
  assert.ok(withBoth.contributions.some((c) => c.id === 'movingTarget'));
});
