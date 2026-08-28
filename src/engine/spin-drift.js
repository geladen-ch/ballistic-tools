// Horizontal drift from gyroscopic yaw of repose, via Bryan Litz's
// empirical formula — re-derived directly in this app's own engine units
// (cm, seconds) the same way stability.js re-derives Miller's formula,
// rather than converting through inches on every call.
//
// Litz's own form: drift_in = 1.25 * (Sg + 1.2) * TOF^1.83 (TOF seconds —
// already this engine's own unit, no conversion needed there). Only the
// leading constant carries a unit (inches); scaling by 2.54 gives cm
// directly, this engine's own windage unit.
//
// This module also owns spinDriftMode resolution (resolveSpinDriftMode,
// below) — deciding whether a shot should use the classical Litz formula
// above or the full McCoy 4-DOF (4-degree-of-freedom) model
// (trajectory-4dof.js), with automatic fallback when the requested mode
// isn't actually computable. trajectory.js's three windage-aware call
// sites (solveHorizontalZeroAngle, integrate, computeImpact) dispatch
// through this.
import { canComputeStability, computeMillerSg } from './stability.js';
import { canMakeStepper4dof } from './trajectory-4dof.js';

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
//
// "Off" is read the same back-compat way resolveSpinDriftMode() reads it
// (state.spinDriftMode, falling back to the older calculateSpinDrift
// boolean when unset) — trajectory.js's own call sites resolve a mode via
// resolveSpinDriftMode() first and only then call this for the 'litz'
// case, so the two must agree on what counts as "off": a caller setting
// spinDriftMode: 'litz' directly (as every current view does, via
// spin-drift-prefs.js's getSpinDriftMode()) without also setting the
// legacy boolean would otherwise get 'litz' from one function and null
// from this one.
export function resolveSpinDrift(state, muzzleVelocity) {
  const requested = state.spinDriftMode ?? (state.calculateSpinDrift ? 'litz' : 'off');
  if (requested === 'off') return null;
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

// Resolves the *requested* mode ('off' | 'litz' | 'mccoy4dof') down to
// the mode that's actually going to run, falling back automatically —
// not just via the user's own toggle — when the requested mode isn't
// computable from the data at hand: 'mccoy4dof' falls back to 'litz',
// which falls back to 'off', exactly mirroring the null-propagation
// resolveSpinDrift already does today for the boolean case. An unset
// spinDriftMode (undefined) always resolves to 'off', regardless of how
// much bullet data is present — this is the exact mechanism
// hit-probability-view.js already relies on today (see its own comment
// at the call site) to guarantee its Monte Carlo dispersion loop never
// invokes any spin-drift path, 4-DOF included, without that view having
// to know anything about spinDriftMode itself.
//
// trajectory.js's three windage-aware call sites
// (solveHorizontalZeroAngle, integrate, computeImpact) dispatch on this
// via their own stepperForMode(): 'litz' uses the plain 3-DOF stepper
// with spinDriftCm() added afterward; 'mccoy4dof' uses the full 4-DOF
// stepper (trajectory-4dof.js), whose own integrated windage already
// includes physically-derived drift, so nothing is added on top of it.
//
// canMakeStepper4dof() and canComputeStability() happen to gate on
// exactly the same five inputs today (mass, caliber, length, muzzle
// velocity, twist rate — see aero-coefficients.js), so in practice
// 'mccoy4dof' and 'litz' currently succeed or fail together. The
// three-way structure is kept anyway: 'mccoy4dof' and 'litz' are
// conceptually distinct, independently selectable methods, it costs
// nothing to keep them distinguishable, and they only coincide today
// because of where the two gates happen to sit, not because they're
// the same check.
export function resolveSpinDriftMode(state, muzzleVelocity) {
  const { massKg, caliberM, lengthM, riflingTwistMm } = state;
  const inputs = { massKg, caliberM, lengthM, muzzleVelocity, riflingTwistMm };
  // Back-compat: every current caller (trajectory-view.js,
  // range-solver-view.js, arsenal-view.js) sets spinDriftMode directly
  // (via spin-drift-prefs.js's getSpinDriftMode(), itself backed by
  // Settings' 3-way mode selector) — this fallback to the older
  // calculateSpinDrift boolean (true -> 'litz', false/absent -> 'off')
  // exists for any caller that still only sets that (e.g. a state built
  // outside this app's own views). spinDriftMode, once actually set by a
  // caller, always takes priority over the boolean.
  const requested = state.spinDriftMode ?? (state.calculateSpinDrift ? 'litz' : 'off');
  if (requested === 'mccoy4dof' && canMakeStepper4dof(inputs)) return 'mccoy4dof';
  if ((requested === 'mccoy4dof' || requested === 'litz') && canComputeStability(inputs)) return 'litz';
  return 'off';
}
