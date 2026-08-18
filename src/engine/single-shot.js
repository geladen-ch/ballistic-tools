// Orchestrates the "Single shot" scenario: solves the dial-in angle (at
// the battle zero if one is set, otherwise at the target range itself, so
// the nominal vertical offset is ~0 by construction), builds every active
// uncertainty source's own (x,y) contribution, combines them, and returns
// the (sdX, sdY, offsetX, offsetY) a target's own hitProbability()
// function consumes. All linear values are cm, angles are mrad — the
// caller (the view) converts whatever display unit the user typed into
// these engine units first, same as every other tool in this app.
import { solveZeroAngle, computeImpact } from './trajectory.js';
import {
  probableErrorToSD, r50ToSD, r99ToSD, es5ToSD, es10ToSD, angularSDToLinear,
  trajectoryPerturbationSD, rangeEstimationSD, movingTargetLeadSD, combineSD
} from './dispersion-sources.js';

const SIMPLIFIED_CONVERTERS = { r50: r50ToSD, r99: r99ToSD, es5: es5ToSD, es10: es10ToSD };

export function computeSingleShot({
  nominalState, targetRange, battleZeroRange,
  aimOffsetXCm = 0, aimOffsetYCm = 0,
  ownErrors, conditionErrors
}) {
  const zeroRange = battleZeroRange ?? targetRange;
  const launchAngle = solveZeroAngle({ ...nominalState, zeroRange });
  const nominalImpact = computeImpact({ ...nominalState, launchAngle }, targetRange);

  const contributions = [];

  if (ownErrors.muzzleVelocitySD) {
    contributions.push({
      id: 'muzzleVelocity',
      ...trajectoryPerturbationSD(nominalState, 'muzzleVelocity', nominalState.muzzleVelocity, ownErrors.muzzleVelocitySD, targetRange, launchAngle, nominalImpact)
    });
  }

  if (ownErrors.precisionMode === 'simplified') {
    const { value, convention } = ownErrors.simplified;
    if (value) {
      const linear = angularSDToLinear(SIMPLIFIED_CONVERTERS[convention](value), targetRange);
      contributions.push({ id: 'combinedPrecision', x: linear, y: linear });
    }
  } else {
    const { benchR50, shooterR50, positionH, positionV } = ownErrors.detailed;
    if (benchR50) {
      const linear = angularSDToLinear(r50ToSD(benchR50), targetRange);
      contributions.push({ id: 'benchPrecision', x: linear, y: linear });
    }
    if (shooterR50) {
      const linear = angularSDToLinear(r50ToSD(shooterR50), targetRange);
      contributions.push({ id: 'shooterSkill', x: linear * positionH, y: linear * positionV });
    }
  }

  const { distanceMedianErrorPct, tempMedianErrorC, pressureMedianErrorHpa, windMedianErrorMs, movingTarget } = conditionErrors;

  if (distanceMedianErrorPct) {
    const sdMeters = probableErrorToSD(distanceMedianErrorPct / 100) * targetRange;
    contributions.push({ id: 'distanceEstimation', ...rangeEstimationSD(nominalState, sdMeters, targetRange, nominalImpact) });
  }
  if (tempMedianErrorC) {
    const sd = probableErrorToSD(tempMedianErrorC);
    contributions.push({ id: 'temperatureEstimation', ...trajectoryPerturbationSD(nominalState, 'tempC', nominalState.tempC, sd, targetRange, launchAngle, nominalImpact) });
  }
  if (pressureMedianErrorHpa) {
    const sd = probableErrorToSD(pressureMedianErrorHpa);
    contributions.push({ id: 'pressureEstimation', ...trajectoryPerturbationSD(nominalState, 'pressureHpa', nominalState.pressureHpa, sd, targetRange, launchAngle, nominalImpact) });
  }
  if (windMedianErrorMs) {
    const sd = probableErrorToSD(windMedianErrorMs);
    // Wind has no nominal component in this model — perturb around a
    // zero baseline explicitly, not nominalState.windSpeed (which the
    // caller always sets to 0 anyway, but this stays correct even if
    // that ever changes).
    contributions.push({ id: 'windEstimation', ...trajectoryPerturbationSD(nominalState, 'windSpeed', 0, sd, targetRange, launchAngle, nominalImpact) });
  }
  if (movingTarget && movingTarget.speedMs && movingTarget.speedMedianErrorPct) {
    contributions.push({
      id: 'movingTarget',
      ...movingTargetLeadSD(movingTarget.speedMs, movingTarget.speedMedianErrorPct, nominalImpact.tof)
    });
  }

  const { sdX, sdY } = combineSD(contributions);

  return {
    sdX, sdY,
    offsetX: nominalImpact.windageCm + aimOffsetXCm,
    offsetY: nominalImpact.dropCm + aimOffsetYCm,
    contributions,
    launchAngleDeg: (launchAngle * 180) / Math.PI
  };
}
