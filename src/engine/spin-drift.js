// Horizontal drift from gyroscopic yaw of repose, via Bryan Litz's
// empirical formula — re-derived directly in this app's own engine units
// (cm, seconds) the same way stability.js re-derives Miller's formula,
// rather than converting through inches on every call.
//
// Litz's own form: drift_in = 1.25 * (Sg + 1.2) * TOF^1.83 (TOF seconds —
// already this engine's own unit, no conversion needed there). Only the
// leading constant carries a unit (inches); scaling by 2.54 gives cm
// directly, this engine's own windage unit.
import { canComputeStability, computeMillerSg } from './stability.js';

const LITZ_COEFFICIENT_CM = 1.25 * 2.54; // 3.175

// Whether/what to compute: null when the setting is off or any of the
// same five inputs stability.js needs (mass, caliber, length, muzzle
// velocity, twist rate) is missing — twist *direction* always has a real
// value (defaults to 'right' throughout this app) so it's never a
// blocking field here, same as it already isn't for stability. Takes the
// caller's already-*resolved* muzzle velocity (post temperature
// correction) rather than reading state.muzzleVelocity directly, so Sg is
// computed from the same velocity the trajectory itself actually launches
// at.
export function resolveSpinDrift(state, muzzleVelocity) {
  if (!state.calculateSpinDrift) return null;
  const { massKg, caliberM, lengthM, riflingTwistMm } = state;
  const inputs = { massKg, caliberM, lengthM, muzzleVelocity, riflingTwistMm };
  if (!canComputeStability(inputs)) return null;
  return { sg: computeMillerSg(inputs), twistDirection: state.twistDirection === 'left' ? 'left' : 'right' };
}

// Physically, a right-hand twist drifts right; trajectory.js's own
// windage axis is +z = left (see its wind-angle comment, and
// trajectory-columns.js's windClicks, which uses windageCm's sign as-is —
// positive windage means "impact shifted left, dial right to correct").
// So a right-hand twist subtracts from windageCm; left-hand adds to it.
export function spinDriftCm({ sg, twistDirection }, tof) {
  const magnitudeCm = LITZ_COEFFICIENT_CM * (sg + 1.2) * tof ** 1.83;
  return twistDirection === 'left' ? magnitudeCm : -magnitudeCm;
}
