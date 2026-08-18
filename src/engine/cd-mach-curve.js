// Reverse-engineers a bullet's own Cd-vs-Mach drag curve from a measured
// distance/velocity table (e.g. Doppler radar or multi-chronograph
// readings) — ported from the legacy getcdmach tool's CdMachTable()
// (data/legacy.code/getcdmach/engine/getcdmachengine.js), onto this
// engine's metric SI physics instead of that tool's archaic-imperial one.
//
// For each table row (as a segment start), solves for the single
// "blanket" Cd (same at every Mach, for that segment only) that makes a
// flat, no-wind, no-elevation flight over the segment's distance
// reproduce the measured velocity at its far end — then reports that Cd
// against the segment's own time-averaged Mach number. The segment's own
// endpoint is chosen adaptively (see MIN_DELTA_V below), not necessarily
// the very next row. The resulting scattered (mach, cd) points are then
// read back at a fixed set of reference Mach breakpoints via the same
// exact per-point local-quadratic fit (makeCdLookup(), from
// drag-tables.js) already used for G1/G7 and every library bullet's own
// Cd curve, producing the "interpolated" table alongside the raw
// "calculated" one.
import { makeStepper, landOnRange } from './trajectory.js';
import { makeCdLookup } from './drag-tables.js';
import { speedOfSound } from './atmosphere.js';
import { MAX_STEPS } from './constants.js';

// Reference Mach breakpoint table the "interpolated" output is read back
// at — a near-uniform 0.05 Mach grid across the whole domain (the same
// density G1_TABLE/G7_TABLE themselves use), replacing legacy's much
// sparser RMT_FULL so the interpolated table/chart line has enough
// points to render the curve's actual shape, not just its coarse
// silhouette. Collapses to two widely-spaced points (4, 5) past Mach 3,
// where the curve is flat and dense sampling buys nothing.
export const MACH_BREAKPOINTS = [
  0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50,
  0.55, 0.60, 0.65, 0.70, 0.725, 0.75, 0.775, 0.80, 0.825, 0.85, 0.875,
  0.90, 0.925, 0.95, 0.975, 1.0, 1.025, 1.05, 1.075, 1.10, 1.125, 1.15,
  1.20, 1.25, 1.30, 1.35, 1.40, 1.50, 1.55, 1.60, 1.65, 1.70, 1.75,
  1.80, 1.85, 1.90, 1.95, 2.00, 2.05, 2.10, 2.15, 2.20, 2.25, 2.30,
  2.35, 2.40, 2.45, 2.50, 2.55, 2.60, 2.65, 2.70, 2.75, 2.80, 2.85,
  2.90, 2.95, 3.00, 4, 5
];

// Per-segment Cd solver constants — dimensionless, so unlike everything
// else in this port these need no unit conversion from legacy's originals.
const CD_INIT = 0.01;
const CD_STEP_INIT = 0.5;
const CD_PRECISION = 1e-4; // as a fraction of the running cd, matching legacy
const CD_MAX_ITER = 100; // sanity cap; legacy's own comment says it should converge in < 30

// Minimum velocity drop (m/s) a segment must span before its Cd is
// trusted — see computeCdMachCurve()'s segment loop below. Differentiating
// two velocities over too small a real drop is an ill-conditioned way to
// back out Cd *regardless of input precision*: measured against known
// reference curves (including a sharp G7-style transonic spike) across
// table spacings from ~10m to ~125m and across whole-m/s/whole-fps/exact
// input rounding, 20 m/s came out as the sweet spot in every case tried —
// consistently better than smaller values (rounding/conditioning noise
// dominates) and than larger ones (segments start spanning enough real
// Mach range that the "one blanket Cd" approximation itself gets biased,
// worst right where the curve is steepest). Deliberately NOT scaled by
// input unit or auto-detected precision: the same 20 m/s was optimal for
// whole-m/s, whole-fps, and unrounded fractional data alike, since for
// sparsely-spaced tables the dominant error is this conditioning issue,
// not rounding, and for densely-spaced ones 20 m/s is already comfortably
// past the rounding-noise floor.
const MIN_DELTA_V = 20;

const rangeOfX = (p) => p.x;

// Flies a synthetic, single-segment shot at a fixed blanket Cd, from a
// fresh muzzle (not a continuation of any earlier segment — same
// "restart at the segment's own start velocity" legacy models with a
// fresh NeeMuzzleVelocity/Solver per segment), until it covers `dd`
// meters — then lands exactly on `dd` via landOnRange() (the same
// 3-point quadratic interpolation trajectory.js's own computeImpact()/
// integrate() use for every "state at an exact range" need), rather than
// reading off whichever raw RK4 point happens to overshoot it. That
// overshoot is tens of meters at supersonic speed — a large fraction of,
// or more than, a short segment — and was silently biasing both the
// solved Cd and the "time-averaged Mach" (dd/t) derived from it; the
// bias grows *worse* the shorter (denser) the input table, which is
// backwards from what denser data should buy you.
//
// The Cd table passed to makeStepper is a flat 2-point table with equal
// Cd at both ends: makeCdLookup() clamps outside its own range and
// linearly interpolates between two equal y-values inside it, so this
// reads as one constant Cd at every Mach — exactly legacy's NeeBullet.
//
// One accepted divergence from legacy: makeStepper's atmosphere
// recomputes local density from the bullet's in-flight altitude drop
// every step (real physics), where legacy's blanket atmosphere was truly
// constant regardless of altitude. Over one segment's near-horizontal,
// sub-second flight the resulting density difference is negligible.
function flightAt(cd, v1, dd, atmo, massKg, caliberM) {
  const stepper = makeStepper({
    cdTable: [[0, cd], [5, cd]], massKg, caliberM,
    windSpeed: 0, windAngle: 90, ...atmo
  });
  let older = null, prev = null, cur = { x: 0, y: 0, z: 0, vx: v1, vy: 0, vz: 0, t: 0 };
  let steps = 0;
  while (cur.x < dd && steps < MAX_STEPS) {
    older = prev;
    prev = cur;
    cur = stepper.step(cur);
    steps++;
  }
  const landed = prev === null
    ? cur
    : landOnRange(older, prev, cur, () => (steps < MAX_STEPS ? stepper.step(cur) : null), rangeOfX, dd);
  return { v: Math.hypot(landed.vx, landed.vy, landed.vz), t: landed.t };
}

// Adaptive step-halving search for the blanket Cd that reproduces v2 over
// dd, starting from v1 — translated 1:1 from legacy's own loop (start at
// cd=0.01, step=0.5, add step to cd, halve-and-flip the step whenever its
// sign disagrees with the residual's sign, stop once |step/cd| is below
// CD_PRECISION).
function solveSegmentCd(v1, v2, dd, atmo, massKg, caliberM) {
  let cd = CD_INIT;
  let step = CD_STEP_INIT;
  for (let iter = 0; iter < CD_MAX_ITER; iter++) {
    cd += step;
    if (cd <= 0) return { error: 'nonPositiveCd' };
    const { v: predictedV2, t } = flightAt(cd, v1, dd, atmo, massKg, caliberM);
    const dv = v2 - predictedV2;
    if (Math.sign(dv) === Math.sign(step)) {
      if (Math.abs(step / cd) < CD_PRECISION) return { cd, t };
      step = -step / 2;
    }
  }
  return { error: 'notConverged' };
}

// Merges consecutive (already mach-sorted) points whose Mach differs by
// less than epsilon, averaging their Cd — two different segments can
// legitimately produce near-identical time-averaged Mach numbers, and
// makeCdLookup()'s local quadratic fit divides by (x_b - x_a)-type terms
// that blow up on an exact duplicate.
function dedupeByMach(sortedPoints, epsilon = 1e-9) {
  const out = [];
  for (const p of sortedPoints) {
    const last = out[out.length - 1];
    if (last && Math.abs(p.mach - last.mach) < epsilon) {
      last.cd = (last.cd + p.cd) / 2;
    } else {
      out.push({ mach: p.mach, cd: p.cd });
    }
  }
  return out;
}

// points: [{ rangeM, velocityMs }, ...], at least 3 (mirrors legacy's own
// vtcount < 3 bail, as a thrown error rather than legacy's silent return
// false). Atmosphere defaults to ICAO standard sea level, matching
// legacy's hardcoded assumption.
export function computeCdMachCurve({
  points, massKg, caliberM,
  tempC = 15, pressureHpa = 1013.25, altitudeM = 0, humidityPct = 0
}) {
  if (!points || points.length < 3) {
    throw new Error('at least 3 distance/velocity points are required');
  }

  const sorted = [...points].sort((a, b) => a.rangeM - b.rangeM);
  const n = sorted.length;
  const atmo = { tempC, pressureHpa, altitudeM, humidityPct };
  // One fixed reference speed of sound for the whole table (from the
  // tool's own tempC), same "single blanket atmosphere" basis legacy used
  // for its own hardcoded-standard speed of sound.
  const machSpeedOfSound = speedOfSound(tempC);

  const calculatedRaw = [];
  const skipped = [];

  // Every row is still a segment *start* (an overlapping sliding window,
  // not a partition of the table into disjoint chunks) — but its
  // endpoint skips ahead past the immediately-next row whenever needed
  // to clear MIN_DELTA_V, capped at the table's own last row (if even
  // the rest of the table can't clear it, that's the best available).
  for (let i = 0; i < n - 1; i++) {
    let j = i + 1;
    while (j < n - 1 && (sorted[i].velocityMs - sorted[j].velocityMs) < MIN_DELTA_V) j++;

    const dd = sorted[j].rangeM - sorted[i].rangeM;
    if (dd <= 0) {
      skipped.push({ index: i, reason: 'nonIncreasingDistance' });
      continue;
    }
    const v1 = sorted[i].velocityMs;
    const v2 = sorted[j].velocityMs;
    if (v2 >= v1) {
      skipped.push({ index: i, reason: 'nonDecreasingVelocity' });
      continue;
    }
    const solved = solveSegmentCd(v1, v2, dd, atmo, massKg, caliberM);
    if (solved.error) {
      skipped.push({ index: i, reason: solved.error });
      continue;
    }
    calculatedRaw.push({ mach: dd / solved.t / machSpeedOfSound, cd: solved.cd });
  }

  calculatedRaw.sort((a, b) => a.mach - b.mach);
  const calculated = dedupeByMach(calculatedRaw);

  let interpolated = [];
  if (calculated.length >= 2) {
    const loMach = calculated[0].mach;
    const hiMach = calculated[calculated.length - 1].mach;
    const breakpoints = MACH_BREAKPOINTS.filter((m) => m > loMach && m < hiMach);
    const cdAt = makeCdLookup(calculated.map((p) => [p.mach, p.cd]));
    interpolated = breakpoints.map((mach) => ({ mach, cd: cdAt(mach) }));
  }

  return { calculated, interpolated, skipped };
}

// Scales a standard reference drag table (e.g. DRAG_TABLES.G1/G7) so its
// Cd exactly matches this tool's own computed curve at one anchor Mach —
// a single-point form-factor scaling, for visually comparing this
// bullet's own drag *shape* against a standard model on the same chart.
// Returns null when ownCurve doesn't have enough points to look a Cd up
// from at all.
export function scaledReferenceCurve(referenceTable, ownCurve, {
  anchorMach = 2.0, domainLoMach, domainHiMach, samples = 61
} = {}) {
  if (!ownCurve || ownCurve.length < 2) return null;

  const ownCdAt = makeCdLookup(ownCurve.map((p) => [p.mach, p.cd]));
  const ownAnchorCd = ownCdAt(anchorMach);

  const refCdAt = makeCdLookup(referenceTable);
  const scaleFactor = ownAnchorCd / refCdAt(anchorMach);

  const loMach = Math.max(0, Math.min(domainLoMach ?? ownCurve[0].mach, anchorMach) - 0.1);
  const hiMach = Math.max(domainHiMach ?? ownCurve[ownCurve.length - 1].mach, anchorMach) + 0.1;

  const points = [];
  for (let i = 0; i < samples; i++) {
    const mach = loMach + (hiMach - loMach) * (i / (samples - 1));
    points.push({ mach, cd: refCdAt(mach) * scaleFactor });
  }

  return { points, scaleFactor };
}
