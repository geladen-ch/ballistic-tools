// Two alternative curve-fit methods compared against method 1 (today's
// shipped linear fit — estimateTrackBC, imported directly from
// src/engine/labradar-bc.js, not reimplemented). Both share the same
// cleaned point set (src/engine/labradar-clean.js's cleanTrack) so the
// comparison isolates the curve-fit step itself, not the cleaning step.
import { cleanTrack } from '../../src/engine/labradar-clean.js';
import { estimateBCFromTimeWindow } from '../../src/engine/bc-estimate.js';
import { trueStateAtTimes } from './synthetic-track.js';

// --- Method 2: quadratic (v = c0 + c1*t + c2*t^2), SNR-weighted least
// squares over the same i=1..length-1 range fitVelocityModel uses
// (excludes kept[0], the device's own synthetic t=0 point — see
// labradar-clean.js's own header comment), solved via the 3x3 normal
// equations by Cramer's rule. Included specifically to reproduce and
// quantify the "chases the tail, overestimates BC" failure the user
// described from their own legacy testing, not because it's a real
// candidate for the shipped tool. ---

function det3([a, b, c], [d, e, f], [g, h, i]) {
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function weightedQuadraticFit(points) {
  let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, Sy0 = 0, Sy1 = 0, Sy2 = 0;
  for (let i = 1; i < points.length; i++) {
    const { t, v, a } = points[i];
    const w = a || 1;
    const t2 = t * t, t3 = t2 * t, t4 = t3 * t;
    S0 += w; S1 += w * t; S2 += w * t2; S3 += w * t3; S4 += w * t4;
    Sy0 += w * v; Sy1 += w * t * v; Sy2 += w * t2 * v;
  }
  const M = [[S0, S1, S2], [S1, S2, S3], [S2, S3, S4]];
  const rhs = [Sy0, Sy1, Sy2];
  const D = det3(M[0], M[1], M[2]);
  const c0 = det3(rhs, M[1], M[2]) / D;
  const c1 = det3([M[0][0], rhs[0], M[0][2]], [M[1][0], rhs[1], M[1][2]], [M[2][0], rhs[2], M[2][2]]) / D;
  const c2 = det3([M[0][0], M[0][1], rhs[0]], [M[1][0], M[1][1], rhs[1]], [M[2][0], M[2][1], rhs[2]]) / D;
  return (t) => c0 + c1 * t + c2 * t * t;
}

export function estimateTrackBCQuadratic({ points, dragModel, atmo, minLeft, r2CleanThreshold }) {
  const { kept, discarded, r2 } = cleanTrack(points, { minLeft, r2Threshold: r2CleanThreshold });
  const vAt = weightedQuadraticFit(kept);
  const vStart = vAt(kept[1].t);
  const tEnd = kept[kept.length - 1].t;
  const vEnd = vAt(tEnd);
  const t2 = tEnd - kept[1].t;

  const { bc } = estimateBCFromTimeWindow({ v1: vStart, t2, v2: vEnd, dragModel, ...atmo });
  return {
    bc, r2Linear: r2, keptPoints: kept, discardedPoints: discarded,
    keptCount: kept.length, discardedCount: discarded.length
  };
}

// --- Method 3: physics whole-window fit. No separate curve-fit step —
// walks the real drag integrator once per (v1, bc) candidate and
// minimizes the SNR-weighted sum of squared velocity residuals against
// every kept point (not just two endpoints). Two free parameters — v1
// (velocity at the kept[1] reference point) and bc — solved as a nested
// 1D golden-section search: an outer search over v1, and for each
// candidate v1, an inner search over bc. Both objectives are expected to
// be unimodal (higher bc/v1 -> uniformly higher predicted velocity at
// every t>0, the same monotonicity src/engine/bc-estimate.js's own
// bisection already relies on) — see sweepBcResidual() below, used
// during development to confirm this by eye rather than assumed. ---

const GOLDEN = (Math.sqrt(5) - 1) / 2;

function goldenSectionMin(f, lo, hi, iterations = 30) {
  let a = lo, b = hi;
  let c = b - GOLDEN * (b - a);
  let d = a + GOLDEN * (b - a);
  let fc = f(c), fd = f(d);
  for (let i = 0; i < iterations; i++) {
    if (fc < fd) {
      b = d; d = c; fd = fc;
      c = b - GOLDEN * (b - a);
      fc = f(c);
    } else {
      a = c; c = d; fc = fd;
      d = a + GOLDEN * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}

function weightedSSE(predicted, observed, weights) {
  let sse = 0;
  for (let i = 0; i < predicted.length; i++) {
    const d = predicted[i] - observed[i];
    sse += weights[i] * d * d;
  }
  return sse;
}

// Golden section always returns *some* point inside [lo, hi], even when
// the real minimum of a badly-conditioned objective (e.g. a candidate v1
// far enough from the truth that no bc in range fits well) lies outside
// it — it then silently saturates at whichever edge keeps decreasing,
// which looks like a converged answer but isn't one. Flagged here rather
// than trusted, matching how estimateBC/estimateBCFromTimeWindow already
// throw instead of returning a boundary value when a target is
// unreachable within their own bracket.
const BOUNDARY_EPS = 1e-3;
function isAtBoundary(value, lo, hi) {
  const span = hi - lo;
  return (value - lo) < BOUNDARY_EPS * span || (hi - value) < BOUNDARY_EPS * span;
}

// The 2-parameter search itself, given an already-cleaned `kept` point
// set — factored out so callers with their own cleaning step (e.g.
// adaptive-clean.js's variants, in run-cleaning-experiment.js) can reuse
// the exact same final-fit math without going through this file's own
// hardcoded `cleanTrack` call. `estimateTrackBCPhysicsFit` below is
// unchanged in behavior or signature — it's now just this function
// preceded by that one cleaning call.
export function physicsFitFromKept(kept, { dragModel, atmo, bcMin = 0.05, bcMax = 1.5, v1BracketFrac = 0.15, iterations = 30 }) {
  const t1 = kept[1].t;
  const targets = kept.slice(1);
  const relTimes = targets.map((p) => p.t - t1);
  const observed = targets.map((p) => p.v);
  const weights = targets.map((p) => p.a || 1);

  function sseFor(v1, bc) {
    const predicted = trueStateAtTimes({ ...atmo, bc, dragModel }, v1, relTimes).map((s) => s.v);
    return weightedSSE(predicted, observed, weights);
  }
  function bestBcFor(v1) {
    const bc = goldenSectionMin((candidate) => sseFor(v1, candidate), bcMin, bcMax, iterations);
    return { bc, sse: sseFor(v1, bc) };
  }

  const v1Guess = kept[1].v;
  const v1Lo = v1Guess * (1 - v1BracketFrac);
  const v1Hi = v1Guess * (1 + v1BracketFrac);
  const bestV1 = goldenSectionMin((v1) => bestBcFor(v1).sse, v1Lo, v1Hi, iterations);
  const { bc } = bestBcFor(bestV1);

  if (isAtBoundary(bc, bcMin, bcMax) || isAtBoundary(bestV1, v1Lo, v1Hi)) {
    throw new Error('physics-fit search saturated at a bracket boundary — no interior optimum found for this track');
  }

  return { bc, v1: bestV1 };
}

export function estimateTrackBCPhysicsFit({
  points, dragModel, atmo, minLeft, r2CleanThreshold,
  bcMin = 0.05, bcMax = 1.5, v1BracketFrac = 0.15, iterations = 30
}) {
  const { kept, discarded, r2 } = cleanTrack(points, { minLeft, r2Threshold: r2CleanThreshold });
  const { bc, v1 } = physicsFitFromKept(kept, { dragModel, atmo, bcMin, bcMax, v1BracketFrac, iterations });

  return {
    bc, r2Linear: r2, keptPoints: kept, discardedPoints: discarded,
    keptCount: kept.length, discardedCount: discarded.length, v1
  };
}

// Development-time diagnostic (not called by run-experiment.js): prints
// the SSE objective across a BC sweep at a fixed v1, to confirm by eye
// that estimateTrackBCPhysicsFit's inner objective is actually unimodal
// before trusting golden-section search on it.
export function sweepBcResidual({ points, dragModel, atmo, minLeft, r2CleanThreshold, v1, bcMin = 0.05, bcMax = 1.5, steps = 30 }) {
  const { kept } = cleanTrack(points, { minLeft, r2Threshold: r2CleanThreshold });
  const t1 = kept[1].t;
  const targets = kept.slice(1);
  const relTimes = targets.map((p) => p.t - t1);
  const observed = targets.map((p) => p.v);
  const weights = targets.map((p) => p.a || 1);
  const anchorV1 = v1 !== undefined ? v1 : kept[1].v;

  const out = [];
  for (let i = 0; i <= steps; i++) {
    const bc = bcMin + (i / steps) * (bcMax - bcMin);
    const predicted = trueStateAtTimes({ ...atmo, bc, dragModel }, anchorV1, relTimes).map((s) => s.v);
    out.push({ bc, sse: weightedSSE(predicted, observed, weights) });
  }
  return out;
}
