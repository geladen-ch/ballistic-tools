import test from 'node:test';
import assert from 'node:assert/strict';
import { airDensity, speedOfSound } from '../src/engine/atmosphere.js';
import { computeMillerSg } from '../src/engine/stability.js';
import { canEstimateAeroCoefficients, estimateAeroCoefficients } from '../src/engine/aero-coefficients.js';

// .308"/168gr Sierra International (Matchking), McCoy Modern Exterior
// Ballistics 2nd ed., Table 9.2 — the exact reference bullet this
// module's tables and Ix/Iy constants are derived from.
const REFERENCE_BULLET_IMPERIAL = { dIn: 0.308, LIn: 1.226, grains: 168, twistIn: 12, fps: 2600 };
const IN_TO_M = 0.0254;
const KG_TO_GRAIN = 15432.358352941432;

function toEngineUnits({ dIn, LIn, grains, twistIn, fps }) {
  return {
    massKg: grains / KG_TO_GRAIN,
    caliberM: dIn * IN_TO_M,
    lengthM: LIn * IN_TO_M,
    muzzleVelocity: fps * 0.3048,
    riflingTwistMm: twistIn * 25.4
  };
}

const REFERENCE_BULLET = toEngineUnits(REFERENCE_BULLET_IMPERIAL);

test('Ix reproduces McCoy Table 9.2 for the reference bullet itself (Iy no longer does, by design)', () => {
  const { Ix, Iy } = estimateAeroCoefficients(REFERENCE_BULLET);
  const LBIN2_TO_KGM2 = 0.45359237 * IN_TO_M ** 2;
  // Book value: Ix=0.000247 lb-in^2 — Ix's own constant is still a
  // round-trip check (Ix isn't Lapua-calibrated, see aero-coefficients.js
  // header comment), so this stays exact.
  assert.ok(Math.abs(Ix - 0.000247 * LBIN2_TO_KGM2) < 1e-12);
  // Iy is now L/d-dependent (Lapua-calibrated), and the reference
  // bullet's own L/d (3.98) falls below the fitted range's minimum
  // (4.023) — so Iy clamps to the value AT that minimum rather than
  // reproducing McCoy's own published Iy=0.001838 lb-in^2. This is the
  // intended behavior, not a bug: see aero-coefficients.js's header
  // comment for why McCoy's own Iy is no longer trusted as ground truth.
  const bookIy = 0.001838 * LBIN2_TO_KGM2;
  assert.notEqual(Iy, bookIy);
  assert.ok(Iy < bookIy, `expected the Lapua-fit correction to reduce Iy below McCoy's own value at this L/d, got Iy=${Iy} vs book=${bookIy}`);
});

test('Iy scales with L/d, clamped at the Lapua-fitted range\'s own ends', () => {
  const shortLd = toEngineUnits({ dIn: 0.308, LIn: 0.9, grains: 150, twistIn: 12, fps: 2600 }); // L/d ~2.9, well below the fitted 4.023 minimum
  const longLd = toEngineUnits({ dIn: 0.308, LIn: 1.8, grains: 220, twistIn: 8, fps: 2600 }); // L/d ~5.8, well above the fitted 5.201 maximum
  const atMin = toEngineUnits({ dIn: 0.308, LIn: 0.308 * 4.023, grains: 168, twistIn: 12, fps: 2600 });
  const atMax = toEngineUnits({ dIn: 0.308, LIn: 0.308 * 5.201, grains: 168, twistIn: 12, fps: 2600 });

  const { Iy: iyShort } = estimateAeroCoefficients(shortLd);
  const { Iy: iyAtMin } = estimateAeroCoefficients(atMin);
  const { Iy: iyLong } = estimateAeroCoefficients(longLd);
  const { Iy: iyAtMax } = estimateAeroCoefficients(atMax);

  // Clamped: below the fitted minimum L/d, Iy/(m*d^2) should equal the
  // value at the minimum exactly (same ky^2, just a different mass here,
  // so compare ky^2 = Iy/(m*d^2) rather than raw Iy).
  const ky2 = (state, Iy) => Iy / (state.massKg * state.caliberM ** 2);
  assert.ok(Math.abs(ky2(shortLd, iyShort) - ky2(atMin, iyAtMin)) < 1e-9);
  assert.ok(Math.abs(ky2(longLd, iyLong) - ky2(atMax, iyAtMax)) < 1e-9);

  // And ky^2 should increase monotonically with L/d inside the fitted range.
  assert.ok(ky2(atMin, iyAtMin) < ky2(atMax, iyAtMax));
});

test('cLAlpha/cDAlpha2/clp/cMpAlpha are read unscaled from the literature table at its own breakpoints', () => {
  const { cLAlpha, cDAlpha2, clp, cMpAlpha } = estimateAeroCoefficients(REFERENCE_BULLET);
  assert.equal(cLAlpha(0.95), 1.30);
  assert.equal(cLAlpha(2.0), 2.58);
  assert.equal(cDAlpha2(1.1), 3.6);
  assert.equal(clp(1.0), -0.0100);
  assert.equal(cMpAlpha(0), -2.6);
  // -1.35/-0.33 land on floating-point-inexact interpolation ratios
  // (e.g. 1.1-0.9 in IEEE 754 isn't exactly 0.2), same as any other
  // linear interpolation — tolerance, not exact equality.
  assert.ok(Math.abs(cMpAlpha(1.1) - (-1.35)) < 1e-9);
  assert.ok(Math.abs(cMpAlpha(2.5) - (-0.33)) < 1e-9);
});

test('table lookups clamp at the ends rather than extrapolating', () => {
  const { cLAlpha } = estimateAeroCoefficients(REFERENCE_BULLET);
  assert.equal(cLAlpha(-1), cLAlpha(0));
  assert.equal(cLAlpha(10), cLAlpha(2.5));
});

function checkCMalphaRoundTrip(state, atmo) {
  const { Ix, Iy, sg, cMAlpha } = estimateAeroCoefficients({ ...state, ...atmo });
  const rho = airDensity(atmo ?? { tempC: 15, pressureHpa: 1013.25, humidityPct: 0 });
  const speedSound = speedOfSound(atmo?.tempC ?? 15);
  const { muzzleVelocity, riflingTwistMm, caliberM } = state;

  const p0 = (2 * Math.PI * muzzleVelocity) / (riflingTwistMm / 1000);
  const mach0 = muzzleVelocity / speedSound;
  const sgRoundTrip = (2 * Ix * Ix * p0 * p0) /
    (Math.PI * rho * caliberM ** 3 * Iy * cMAlpha(mach0) * muzzleVelocity * muzzleVelocity);

  assert.ok(Math.abs(sgRoundTrip - sg) < 1e-9, `got ${sgRoundTrip}, expected Miller sg ${sg}`);
}

test('cMAlpha inversion is self-consistent: feeding it back through the Sg formula reproduces this module\'s own Miller Sg (standard atmosphere)', () => {
  checkCMalphaRoundTrip(REFERENCE_BULLET, null);
});

test('cMAlpha inversion stays self-consistent under a non-standard atmosphere too', () => {
  checkCMalphaRoundTrip(REFERENCE_BULLET, { tempC: 35, pressureHpa: 850, humidityPct: 10 });
});

test('non-standard atmosphere changes cMAlpha (via Sg) but not the unscaled reference-curve coefficients', () => {
  const standard = estimateAeroCoefficients(REFERENCE_BULLET);
  const thinAir = estimateAeroCoefficients({ ...REFERENCE_BULLET, tempC: 35, pressureHpa: 850, humidityPct: 10 });
  assert.notEqual(standard.sg, thinAir.sg);
  assert.notEqual(standard.cMAlpha(1.0), thinAir.cMAlpha(1.0));
  // cLAlpha/cDAlpha2/clp are read unscaled from the literature table,
  // independent of atmosphere by design (only cMAlpha's scale factor and
  // sg depend on it).
  assert.equal(standard.cLAlpha(1.0), thinAir.cLAlpha(1.0));
  assert.equal(standard.cDAlpha2(1.0), thinAir.cDAlpha2(1.0));
  assert.equal(standard.clp(1.0), thinAir.clp(1.0));
  assert.equal(standard.Ix, thinAir.Ix); // Ix/Iy are geometry-only, atmosphere-independent
});

test('estimated Sg is a close (few-percent) approximation of McCoy\'s own published Sg=1.70 for this bullet', () => {
  const { sg } = estimateAeroCoefficients(REFERENCE_BULLET);
  // Cross-checks Miller's Twist Rule (already in production use throughout
  // this app) against McCoy's more rigorous linearized-theory Sg for the
  // same bullet/twist — not a property of this module, but worth a
  // regression guard since this module's whole CMalpha inversion leans on
  // Miller's Sg being a reasonable proxy.
  assert.ok(Math.abs(sg - 1.70) / 1.70 < 0.05, `Miller sg ${sg} too far from McCoy's 1.70`);
});

test('canEstimateAeroCoefficients requires every stability input, same as canComputeStability', () => {
  assert.equal(canEstimateAeroCoefficients(REFERENCE_BULLET), true);
  for (const key of Object.keys(REFERENCE_BULLET)) {
    assert.equal(canEstimateAeroCoefficients({ ...REFERENCE_BULLET, [key]: null }), false, `${key}: null should be unknown`);
  }
});

test('a different bullet (still computable) produces a different Ix/Iy and CMalpha scale', () => {
  const heavier = toEngineUnits({ dIn: 0.308, LIn: 1.35, grains: 190, twistIn: 10, fps: 2600 });
  const a = estimateAeroCoefficients(REFERENCE_BULLET);
  const b = estimateAeroCoefficients(heavier);
  assert.notEqual(a.Ix, b.Ix);
  assert.notEqual(a.cMAlpha(1.0), b.cMAlpha(1.0));
  // cLAlpha/cDAlpha2/clp are the unscaled reference curve, independent of
  // the bullet's own mass/twist by design.
  assert.equal(a.cLAlpha(1.0), b.cLAlpha(1.0));
});

test('computeMillerSg is consistent with the sg exposed by estimateAeroCoefficients', () => {
  const { sg } = estimateAeroCoefficients(REFERENCE_BULLET);
  assert.equal(sg, computeMillerSg(REFERENCE_BULLET));
});
