// Orchestrates the "Spotter-corrected shot" scenario: a sighting shot
// carries the same full error model as Single Shot (own errors + condition
// errors), producing both its own dispersion and a systematic offset from
// point of aim. A spotter observes that shot's impact and calls a
// correction, canceling the *systematic* offset in expectation — but the
// correction is itself imprecise, since it's based on a single noisy
// observation (the sighting shot's own dispersion) plus the spotter's own
// ability to localize the impact. The corrected shot's residual error is
// therefore: its own direct dispersion (same own-error sources as any
// shot) plus the correction's imprecision — condition errors don't appear
// directly in the corrected shot at all, since spotting a shot's actual
// impact "sees" and cancels their effect the same way it does the
// systematic offset, regardless of what caused it.
import { solveZeroAngle, computeImpact } from './trajectory.js';
import {
  probableErrorToSD, r50ToSD, r99ToSD, es5ToSD, es10ToSD, angularSDToLinear,
  trajectoryPerturbationSD, rangeEstimationSD, movingTargetLeadSD, combineSD
} from './dispersion-sources.js';

const SIMPLIFIED_CONVERTERS = { r50: r50ToSD, r99: r99ToSD, es5: es5ToSD, es10: es10ToSD };

export function computeSpotterCorrected({
  nominalState, targetRange, battleZeroRange,
  aimOffsetXCm = 0, aimOffsetYCm = 0,
  ownErrors, conditionErrors,
  sightingShotCount, spotterMeasureMrad
}) {
  const zeroRange = battleZeroRange ?? targetRange;
  const launchAngle = solveZeroAngle({ ...nominalState, zeroRange });
  const nominalImpact = computeImpact({ ...nominalState, launchAngle }, targetRange);

  // ---- Own-error contributions — the sighting shot's direct dispersion,
  // and (via the correction, layered a second time below) part of the
  // corrected shot's too. ----
  const ownContributions = [];
  if (ownErrors.muzzleVelocitySD) {
    ownContributions.push({
      id: 'muzzleVelocity',
      ...trajectoryPerturbationSD(nominalState, 'muzzleVelocity', nominalState.muzzleVelocity, ownErrors.muzzleVelocitySD, targetRange, launchAngle, nominalImpact)
    });
  }
  if (ownErrors.precisionMode === 'simplified') {
    const { value, convention } = ownErrors.simplified;
    if (value) {
      const linear = angularSDToLinear(SIMPLIFIED_CONVERTERS[convention](value), targetRange);
      ownContributions.push({ id: 'combinedPrecision', x: linear, y: linear });
    }
  } else {
    const { benchR50, shooterR50, positionH, positionV } = ownErrors.detailed;
    if (benchR50) {
      const linear = angularSDToLinear(r50ToSD(benchR50), targetRange);
      ownContributions.push({ id: 'benchPrecision', x: linear, y: linear });
    }
    if (shooterR50) {
      const linear = angularSDToLinear(r50ToSD(shooterR50), targetRange);
      ownContributions.push({ id: 'shooterSkill', x: linear * positionH, y: linear * positionV });
    }
  }

  // ---- Condition-error contributions — the sighting shot only; replaced
  // entirely by the correction's own imprecision for the corrected shot. ----
  const conditionContributions = [];
  const { distanceMedianErrorPct, tempMedianErrorC, pressureMedianErrorHpa, windMedianErrorMs, movingTarget } = conditionErrors;
  if (distanceMedianErrorPct) {
    const sdMeters = probableErrorToSD(distanceMedianErrorPct / 100) * targetRange;
    conditionContributions.push({ id: 'distanceEstimation', ...rangeEstimationSD(nominalState, sdMeters, targetRange, nominalImpact) });
  }
  if (tempMedianErrorC) {
    const sd = probableErrorToSD(tempMedianErrorC);
    conditionContributions.push({ id: 'temperatureEstimation', ...trajectoryPerturbationSD(nominalState, 'tempC', nominalState.tempC, sd, targetRange, launchAngle, nominalImpact) });
  }
  if (pressureMedianErrorHpa) {
    const sd = probableErrorToSD(pressureMedianErrorHpa);
    conditionContributions.push({ id: 'pressureEstimation', ...trajectoryPerturbationSD(nominalState, 'pressureHpa', nominalState.pressureHpa, sd, targetRange, launchAngle, nominalImpact) });
  }
  if (windMedianErrorMs) {
    const sd = probableErrorToSD(windMedianErrorMs);
    conditionContributions.push({ id: 'windEstimation', ...trajectoryPerturbationSD(nominalState, 'windSpeed', 0, sd, targetRange, launchAngle, nominalImpact) });
  }
  if (movingTarget && movingTarget.speedMs && movingTarget.speedMedianErrorPct) {
    conditionContributions.push({
      id: 'movingTarget',
      ...movingTargetLeadSD(movingTarget.speedMs, movingTarget.speedMedianErrorPct, nominalImpact.tof)
    });
  }

  const own = combineSD(ownContributions);
  const condition = combineSD(conditionContributions);
  const sighting = combineSD([...ownContributions, ...conditionContributions]);

  // Spotter's own capacity to localize a single shot's impact — a median
  // error like every other estimation-error field, converted the same way,
  // applied equally to both axes (spotting has no inherent H/V bias).
  const spotterLinear = spotterMeasureMrad
    ? angularSDToLinear(probableErrorToSD(spotterMeasureMrad), targetRange)
    : 0;

  // The mean of N normally-distributed observations (each combining the
  // sighting shot's own dispersion with the spotter's per-shot reading
  // error) itself follows a normal distribution with SD divided by
  // sqrt(N) — so the correction's own imprecision is the own/spotter
  // combination scaled down by however many sighting shots informed it.
  const n = Math.max(1, sightingShotCount || 1);
  const correctionSdX = Math.sqrt(own.sdX * own.sdX + spotterLinear * spotterLinear) / Math.sqrt(n);
  const correctionSdY = Math.sqrt(own.sdY * own.sdY + spotterLinear * spotterLinear) / Math.sqrt(n);

  const correctedSdX = Math.sqrt(own.sdX * own.sdX + correctionSdX * correctionSdX);
  const correctedSdY = Math.sqrt(own.sdY * own.sdY + correctionSdY * correctionSdY);

  // Each own-error source's variance is layered a second time (divided by
  // N) through its role in the correction — distributing the /N across the
  // individual sources this way is exact, since correctionSd² is itself
  // just (sum of the own sources' own variances + spotter's) / N.
  const correctedContributions = ownContributions.map((c) => ({
    id: c.id,
    x: c.x * Math.sqrt(1 + 1 / n),
    y: c.y * Math.sqrt(1 + 1 / n)
  }));
  if (spotterLinear) {
    const spotterPerAxis = spotterLinear / Math.sqrt(n);
    correctedContributions.push({ id: 'spotterEye', x: spotterPerAxis, y: spotterPerAxis });
  }

  return {
    sighting: {
      sdX: sighting.sdX, sdY: sighting.sdY,
      offsetX: nominalImpact.windageCm + aimOffsetXCm,
      offsetY: nominalImpact.dropCm + aimOffsetYCm,
      contributions: [...ownContributions, ...conditionContributions],
      ownSdX: own.sdX, ownSdY: own.sdY,
      conditionSdX: condition.sdX, conditionSdY: condition.sdY
    },
    // The correction cancels the sighting shot's systematic offset in
    // expectation, so only the deliberate aiming-point offset remains —
    // condition-driven and battle-zero-driven bias are both "seen" and
    // corrected for, whatever caused them.
    corrected: {
      sdX: correctedSdX, sdY: correctedSdY,
      offsetX: aimOffsetXCm, offsetY: aimOffsetYCm,
      contributions: correctedContributions
    },
    sightingShotCount: n,
    launchAngleDeg: (launchAngle * 180) / Math.PI
  };
}
