// McCoy Modified Point-Mass Model: aerodynamic coefficients this app's
// bullet data model doesn't natively have (CLα, CDα2, Clp, CMα, moments
// of inertia), estimated from the same 5 inputs Miller's Sg
// (stability.js) already requires — no new mandatory bullet fields. The
// derivation, citations, and numeric verification against McCoy's own
// worked examples are laid out in the comments below.
//
// CLα, CDα2, Clp (Mach-indexed): read directly, unscaled, from McCoy's
// own published wind-tunnel/spark-range table for the .308"/168 grain
// Sierra International (Matchking) match bullet (Modern Exterior
// Ballistics, 2nd ed., Appendix A to Chapter 9) — treated as a reusable
// "generic modern spitzer boat-tail rifle bullet" reference curve, the
// same architectural role G1/G7 already play for drag (drag-tables.js).
//
// CMα (Mach-indexed): NOT read from that table directly, because it must
// reflect *this* bullet's own mass/caliber/length/twist, not the
// reference bullet's. Instead: the classical gyroscopic stability
// relation
//
//   Sg = 2 * Ix^2 * p^2 / (pi * rho * d^3 * Iy * CMalpha * V^2)
//
// (McCoy eqs. 10.85-10.87, re-derived here from Sg = P^2/(4M) — numerically
// verified against two of McCoy's own worked examples: the 105mm M1
// shell, Ch.9 Table 9.3 + Charge 1/7 muzzle Sg=3.1, and the .308"/168gr
// bullet itself, Table 9.2, muzzle Sg=1.70 — both reproduce the book's
// stated Sg to within its own rounding) is solved for CMα at the muzzle
// Mach, using the Sg this app's own stability.js already computes
// (Miller's Twist Rule). That single muzzle-Mach CMα value then scales
// the reference bullet's own CMα(Mach) *shape* up or down to match this
// bullet's own numbers — same "generic shape, scaled to this bullet"
// idea as the other three coefficients, just scaled instead of read
// unscaled, because CMα is the one coefficient that's actually sensitive
// to this bullet's own mass distribution rather than just its external
// shape.
//
// Ix (axial moment of inertia): estimated as a fixed nondimensional
// radius of gyration (kx² = Ix/(m·d²)) times this bullet's own mass and
// caliber, calibrated from the .308"/168gr bullet's own published Ix
// (McCoy Table 9.2). Ix's absolute scale only affects spin decay (Clp)
// and the Magnus-moment term (trajectory-4dof.js) — the dominant
// classical yaw-of-repose/CMalpha-inversion pipeline only ever uses the
// *ratio* Iy/Ix (verify: Ix cancels except through that ratio), so an
// error in McCoy's own Ix specifically would only bias those two
// secondary terms, not the primary drift prediction.
//
// Iy (transverse moment of inertia): NOT a fixed nondimensional
// constant — scaled by bullet length (L/d = length/caliber), per a
// linear fit against 10 independent (bullet, twist, drift) data points
// pulled from Lapua's own radar-measured 6-DOF calculator (this app's
// built-in `lapua-cd` bullet library provided the exact mass/caliber/
// length/Cd(Mach) for each). This replaced an earlier fixed-ky²
// approach (still calibrated from the same McCoy bullet) after
// validation against Lapua's tool showed errors correlating strongly
// and specifically with bullet length, once two confounds were
// identified and excluded from the fit: cartridge-overall-length shape
// compromise in heavy-for-caliber .308/.224 bullets, and non-lead-core
// construction in AP-type bullets — both showed clearly different,
// L/d-independent behavior rather than fitting the same trend.
//
// Why recalibrate against Lapua rather than trust McCoy's own published
// Iy as the fixed anchor: every check made against McCoy's book data
// up to this point was internally consistent (his own coefficients
// reproduce his own Sg; this module's formula reproduces his own
// published drift) but never independently verified against a different
// measurement source. When the Lapua-fitted trend was extrapolated back
// to the McCoy bullet's own L/d, it predicted a needed correction of
// ~30% relative to his published Iy — i.e. even the calibration
// anchor itself may carry a real, era-appropriate measurement bias
// (1970s-80s spark-range photography vs. Lapua's modern Doppler radar)
// that no amount of self-consistency checking against McCoy's own book
// could have caught. Lapua's data set — 10 points, several calibers,
// independently measured — is treated as the more trustworthy
// calibration source for this one ratio; McCoy's book remains the
// source for the underlying formula structure itself, which was
// verified directly against his transcribed equations and is not in
// question.
//
// The fit is intentionally simple (linear in L/d, clamped at the fitted
// range's own ends rather than extrapolated) and known to have real
// residual scatter (~5% RMSE even within the "clean" data) — this is an
// empirical calibration, not a first-principles shape derivation, and
// it doesn't claim to apply outside a traditional lead-core boat-tail
// match-bullet shape (AP/monolithic construction and cartridge-COL-
// compromised heavy-for-caliber bullets were excluded from the fit,
// since both showed clearly different behavior — see the two confounds
// noted above).
//
// Muzzle atmosphere (tempC/pressureHpa/humidityPct) defaults to standard
// sea level, same as stability.js's own computeMillerSg — the density and
// speed-of-sound used for the muzzle-Mach CMalpha calibration below now
// come from the same real conditions Sg itself is corrected against
// (stability.js), rather than a separately-hardcoded standard constant:
// mixing a real-density Sg with a standard-density inversion formula
// would reintroduce exactly the inconsistency this was designed to
// avoid. Passing no atmosphere args at all reproduces the previous
// standard-atmosphere-only behavior bit-for-bit.
import { airDensity, speedOfSound } from './atmosphere.js';
import { computeMillerSg, canComputeStability } from './stability.js';

// Derived from McCoy Table 9.2 (.308"/168gr Sierra International):
// Ix=0.000247 lb-in^2, mass=168gr, d=0.308in, converted to SI and
// divided through by (massKg * caliberM^2).
const KX2_REFERENCE = 0.10848864339124081; // Ix / (m * d^2)

// ky² = Iy/(m*d²) as a function of L/d — replaces the single fixed
// ky²=0.8073 McCoy Table 9.2 gives for his own bullet's own L/d=3.98,
// with a linear fit against 10 Lapua-radar data points (L/d 4.02-5.20;
// see the header comment above for the full derivation and citation).
// Endpoints are McCoy's own ky² times the fitted "needed ratio" at each
// end of the fitted L/d range — interp() below clamps outside
// [4.023, 5.201] rather than extrapolate a 2-point line indefinitely.
const MCCOY_KY2 = 0.8072960589194358;
const KY2_BY_LD_TABLE = [
  [4.023, MCCOY_KY2 * 0.716854586312412],
  [5.201, MCCOY_KY2 * 1.0763629911148644]
];

// McCoy Modern Exterior Ballistics, 2nd ed., Appendix A to Ch. 9:
// .308" 168gr Sierra International (Matchking) match bullet. Mach ->
// coefficient pairs, McCoy's own table breakpoints (not resampled).
const CD_ALPHA2_TABLE = [
  [0, 2.9], [0.95, 2.9], [1.0, 3.0], [1.05, 3.1], [1.1, 3.6], [1.2, 6.5],
  [1.4, 7.6], [1.6, 7.3], [1.8, 6.8], [2.0, 6.1], [2.2, 5.4], [2.5, 4.4]
];
const CLP_TABLE = [
  [0, -0.0150], [0.5, -0.0125], [0.8, -0.0108], [0.85, -0.0107], [0.9, -0.0105],
  [0.95, -0.0103], [1.0, -0.0100], [1.05, -0.0099], [1.1, -0.0098], [1.2, -0.0095],
  [1.4, -0.0088], [1.6, -0.0083], [1.8, -0.0080], [2.0, -0.0075], [2.2, -0.0073], [2.5, -0.0068]
];
const CL_ALPHA_TABLE = [
  [0, 1.75], [0.5, 1.63], [0.8, 1.45], [0.85, 1.40], [0.9, 1.35], [0.95, 1.30],
  [1.0, 1.35], [1.05, 1.55], [1.1, 1.70], [1.2, 1.90], [1.4, 2.15], [1.6, 2.32],
  [1.8, 2.45], [2.0, 2.58], [2.2, 2.68], [2.5, 2.85]
];
const CM_ALPHA_REF_TABLE = [
  [0, 3.05], [0.5, 3.26], [0.8, 3.38], [0.85, 3.40], [0.9, 3.43], [0.95, 3.45],
  [1.0, 3.24], [1.05, 3.17], [1.1, 3.15], [1.2, 3.12], [1.4, 3.06], [1.6, 2.98],
  [1.8, 2.88], [2.0, 2.79], [2.2, 2.69], [2.5, 2.56]
];

// Magnus moment coefficient, McCoy Appendix A (same source, separate
// table — indexed by Mach *and* yaw^2 in the book, since it's markedly
// nonlinear with yaw amplitude; only the yaw^2=0 row is used here, since
// this module's classical/small-yaw model has no use for the nonlinear
// rows). Read unscaled, same "generic reference shape" treatment as
// CLα/CDα2/Clp — there's no per-bullet inversion source for this
// coefficient the way there is for CMα.
const CM_P_ALPHA_TABLE = [
  [0, -2.6], [0.9, -2.6], [1.1, -1.35], [1.4, -0.51], [1.7, -0.33], [2.5, -0.33]
];

// Linear interpolation, clamped at the table's own ends — these tables
// are short (12-16 points) and this app's own trajectory only spends a
// handful of RK4 steps per Mach decade, so the extra accuracy of
// drag-tables.js's quadratic fit isn't worth its setup cost here.
function interp(table, mach) {
  const last = table.length - 1;
  if (mach <= table[0][0]) return table[0][1];
  if (mach >= table[last][0]) return table[last][1];
  let i = 0;
  while (table[i + 1][0] < mach) i++;
  const [x0, y0] = table[i];
  const [x1, y1] = table[i + 1];
  return y0 + (y1 - y0) * (mach - x0) / (x1 - x0);
}

// riflingTwistMm is already "mm of barrel per one full bullet rotation"
// (same convention stability.js's own `t` uses, just not yet divided
// down to calibers) — so twist length in meters is riflingTwistMm/1000.
function spinRateRadS(muzzleVelocity, riflingTwistMm) {
  return (2 * Math.PI * muzzleVelocity) / (riflingTwistMm / 1000);
}

export function canEstimateAeroCoefficients(inputs) {
  return canComputeStability(inputs);
}

export function estimateAeroCoefficients({
  massKg, caliberM, lengthM, muzzleVelocity, riflingTwistMm,
  tempC = 15, pressureHpa = 1013.25, humidityPct = 0
}) {
  const Ix = KX2_REFERENCE * massKg * caliberM * caliberM;
  const ky2 = interp(KY2_BY_LD_TABLE, lengthM / caliberM);
  const Iy = ky2 * massKg * caliberM * caliberM;

  const sg = computeMillerSg({ massKg, caliberM, lengthM, muzzleVelocity, riflingTwistMm, tempC, pressureHpa, humidityPct });
  const p0 = spinRateRadS(muzzleVelocity, riflingTwistMm);
  const rho = airDensity({ tempC, pressureHpa, humidityPct });
  const mach0 = muzzleVelocity / speedOfSound(tempC);

  // Sg = 2*Ix^2*p^2 / (pi*rho*d^3*Iy*CMalpha*V^2), solved for CMalpha at
  // the muzzle Mach — see this file's header comment for the citation
  // and numeric verification of this relation. Uses the same rho as the
  // sg above (both real, both defaulting to standard atmosphere), so the
  // two stay consistent with each other regardless of which atmosphere
  // is passed in.
  const cMAlphaAtMuzzle = (2 * Ix * Ix * p0 * p0) /
    (Math.PI * rho * caliberM ** 3 * Iy * sg * muzzleVelocity * muzzleVelocity);
  const scale = cMAlphaAtMuzzle / interp(CM_ALPHA_REF_TABLE, mach0);

  return {
    Ix, Iy, sg,
    cLAlpha: (mach) => interp(CL_ALPHA_TABLE, mach),
    cDAlpha2: (mach) => interp(CD_ALPHA2_TABLE, mach),
    clp: (mach) => interp(CLP_TABLE, mach),
    cMAlpha: (mach) => scale * interp(CM_ALPHA_REF_TABLE, mach),
    cMpAlpha: (mach) => interp(CM_P_ALPHA_TABLE, mach)
  };
}
