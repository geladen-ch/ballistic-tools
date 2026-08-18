// Gyroscopic bullet stability (Sg) via Miller's Twist Rule, re-derived
// directly in this app's own engine units (massKg, caliberM/lengthM in
// meters, muzzleVelocity in m/s, riflingTwistMm in mm) instead of
// converting to/from the formula's usual imperial inputs (grains, inches,
// ft/s) on every call.
//
// Standard form: Sg = 30*W / (t^2 * d^3 * L*(1+L^2)) * (V/2800)^(1/3),
// W = grains, d = diameter (in), t = twist (calibers/turn), L = length
// (calibers), V = fps. t and L are already dimensionless ratios, so they
// carry over unchanged; only the W/d^3 and V/2800 terms need re-scaling.
// C = 30 * KG_TO_GRAIN / (1/0.0254)^3, V0 = 2800 * 0.3048 (m/s) — verified
// to reproduce the imperial formula bit-for-bit on a cross-check case.
const KG_TO_GRAIN = 15432.358352941432; // matches bullet-section.js's own constant
const MILLER_C = 7.5867313200175746;
const MILLER_V0 = 853.44; // 2800 fps in m/s

export function computeMillerSg({ massKg, caliberM, lengthM, muzzleVelocity, riflingTwistMm }) {
  const t = riflingTwistMm / (caliberM * 1000);
  const L = lengthM / caliberM;
  return (MILLER_C * massKg) / (t * t * caliberM ** 3 * L * (1 + L * L)) * (muzzleVelocity / MILLER_V0) ** (1 / 3);
}

// All five inputs must be known, positive numbers — a rifling twist of 0
// (allowed by the field's own min=0) or a missing caliber/length (always
// true for a manually-entered "Other" bullet) would otherwise divide by
// zero or silently propagate NaN into the UI.
export function canComputeStability({ massKg, caliberM, lengthM, muzzleVelocity, riflingTwistMm }) {
  return [massKg, caliberM, lengthM, muzzleVelocity, riflingTwistMm].every((v) => v != null && v > 0);
}

export function stabilityStatus(sg) {
  if (sg < 1.0) return 'unstable';
  if (sg < 1.3) return 'marginal';
  return 'stable';
}
