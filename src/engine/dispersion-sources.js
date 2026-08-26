// Per-uncertainty-source standard-deviation math for the Hit Probability
// feature — converts each source's own native input (a probable error, a
// median radius, a trajectory-perturbing physical quantity, ...) into a
// (x, y) contribution in cm at the target range, and combines independent
// sources into one overall dispersion. Scenario-specific orchestration
// (which sources apply, in what combination) lives in files like
// single-shot.js, not here — this module only holds the shared, reusable
// per-source primitives.
import { computeImpact, solveZeroAngle } from './trajectory.js';

// "Median error" as used throughout this feature's uncertainty fields is
// the probable error (PE): the value within +/- which 50% of outcomes
// fall, under an assumed Gaussian. PE = 0.6745 * SD.
export function probableErrorToSD(medianError) {
  return medianError / 0.6745;
}

// R_p (the radius containing fraction p of a circular/isotropic Gaussian)
// follows the Rayleigh distribution's quantile function: R_p = SD *
// sqrt(-2 * ln(1-p)). R50 and R99 are the two fixed points on that curve
// used here; ES-5/ES-10 (average extreme spread over 5- or 10-shot
// groups) don't reduce to a clean function of p the same way (they depend
// on shot count through order statistics), so those two conversion
// factors are supplied directly rather than derived.
//
// The ES factors are E[extreme spread] / SD, which has no closed form for
// more than two shots and has to come from simulation. Both are quoted here
// to six significant figures, from the mcgs project's Monte-Carlo runs
// (https://github.com/lstange/mcgs):
//
//   5 shots:  3.0658795  ->  3.06588
//  10 shots:  3.8115826  ->  3.81158
//
// The five-shot figure is corroborated by an independent deterministic
// route: numerical integration of the 10-dimensional expectation with the
// Cuba library's VEGAS gives 3.0658794642 +- 0.0000015887.
export function r50ToSD(r50) {
  return r50 / 1.1774;
}

export function r99ToSD(r99) {
  return r99 / 3.0349;
}

export function es5ToSD(es5) {
  return es5 / 3.06588;
}

export function es10ToSD(es10) {
  return es10 / 3.81158;
}

// A dispersion already expressed as an angle (mrad) — bench rifle
// precision, shooter skill, the simplified combined-precision field —
// converted to linear cm at the target range via the standard small-angle
// approximation: 1 mrad subtends rangeM/1000 m, i.e. rangeM/10 cm.
export function angularSDToLinear(sdMrad, rangeM) {
  return (sdMrad * rangeM) / 10;
}

// Evaluates the trajectory-implied (x,y) miss at `paramName` = nominal±sd
// (all else held fixed), relative to the already-computed nominal impact,
// and averages the two (possibly asymmetric) magnitudes — the standard
// finite-difference sensitivity technique used throughout this feature for
// any source that perturbs the physics itself (as opposed to one already
// expressed as a direct dispersion). `launchAngle` and `nominalImpact` are
// passed in rather than recomputed here since the caller computes them
// once and reuses them across every source.
export function trajectoryPerturbationSD(nominalState, paramName, nominalValue, sd, targetRange, launchAngle, nominalImpact) {
  if (!sd) return { x: 0, y: 0 };
  const plus = computeImpact({ ...nominalState, [paramName]: nominalValue + sd, launchAngle }, targetRange);
  const minus = computeImpact({ ...nominalState, [paramName]: nominalValue - sd, launchAngle }, targetRange);
  const x = (Math.abs(plus.windageCm - nominalImpact.windageCm) + Math.abs(nominalImpact.windageCm - minus.windageCm)) / 2;
  const y = (Math.abs(plus.dropCm - nominalImpact.dropCm) + Math.abs(nominalImpact.dropCm - minus.dropCm)) / 2;
  return { x, y };
}

// Range-estimation error is a distinct mechanism from the physics
// perturbations above: the shooter dials/holds for their *estimated*
// range, not the true one, so this re-solves the launch angle at
// `targetRange +/- sd` (as if that were the real range) and evaluates the
// resulting impact at the *actual* target range — "dialed for the wrong
// range." Vertical only: a mis-dialed elevation doesn't move windage.
export function rangeEstimationSD(nominalState, sd, targetRange, nominalImpact) {
  if (!sd) return { x: 0, y: 0 };
  const anglePlus = solveZeroAngle({ ...nominalState, zeroRange: targetRange + sd });
  const angleMinus = solveZeroAngle({ ...nominalState, zeroRange: targetRange - sd });
  const plus = computeImpact({ ...nominalState, launchAngle: anglePlus }, targetRange);
  const minus = computeImpact({ ...nominalState, launchAngle: angleMinus }, targetRange);
  const y = (Math.abs(plus.dropCm - nominalImpact.dropCm) + Math.abs(nominalImpact.dropCm - minus.dropCm)) / 2;
  return { x: 0, y };
}

// A shooter leading a laterally-moving target by `estimatedSpeed * tof`
// (correctly, for their own estimate) misses by the error in that speed
// estimate alone: SD_x = estimatedSpeed * tof * SD(speedErrorPct).
// Horizontal only — target motion is lateral-only in this model, mirroring
// wind's own lateral-only treatment.
export function movingTargetLeadSD(estimatedSpeed, speedErrorPct, tof) {
  if (!estimatedSpeed || !speedErrorPct) return { x: 0, y: 0 };
  const x = estimatedSpeed * tof * probableErrorToSD(speedErrorPct / 100);
  return { x, y: 0 };
}

// Independent sources' variances add — this is the only place that
// assumption is used, so it's centralized here. `contributions` is a list
// of { id, x, y } (each source's own linear SD, cm, from the functions
// above); the same list is returned alongside the combined totals so
// callers can build a contribution-% breakdown without recomputing
// anything.
export function combineSD(contributions) {
  let varX = 0, varY = 0;
  for (const c of contributions) {
    varX += c.x * c.x;
    varY += c.y * c.y;
  }
  return { sdX: Math.sqrt(varX), sdY: Math.sqrt(varY), contributions };
}
