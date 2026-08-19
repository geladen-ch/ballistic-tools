// Cleaning variants compared in this follow-up experiment (see
// docs/plans/labradar-cleaning-experiment.md), all sharing the same
// proven greedy structure as the shipped chopShop port
// (src/engine/labradar-clean.js's cleanTrack): iteratively remove the
// worst-residual point, refit the reference, repeat to a floor of 10,
// then restore from the first step that clears an R^2-ratio-to-best
// quality gate. Two independent axes, both empirically motivated:
//
//   reference (linear | physics) x r2Threshold (0.97 today | raised)
//
// A third axis — a per-track *adaptive* threshold, calibrated from each
// track's own early/reliable-window fit quality — was tried and
// abandoned: the signal it was built on (early-window R^2) turned out
// to be structurally incapable of detecting the actual severity
// heterogeneity in real tracks, which lives almost entirely in the
// *tail* the early window never sees (confirmed empirically — 5 real
// tracks with 16-24 real discards each produced byte-identical output
// whether or not the adaptive calibration was active). A direct sweep
// of the flat threshold itself (0.80 through 0.9999) then showed
// something simpler and better-supported: raising it from 0.97 to
// ~0.99 helps broadly (mean |BC error| on 40 real-noise tracks: 1.08%
// -> 0.96%) and dramatically on genuinely severe tracks (~21% -> ~6-7%
// on 5 tracks with real discardCount > 15), with zero regression on a
// noiseless track at any tested threshold up to 0.9999. Pushing much
// past ~0.99-0.995 trades a shrinking mean-error gain for a large jump
// in discard count (60+ points from ~100-140-point tracks at 0.9999,
// well past the 10-30 discards real severe tracks actually show — see
// docs/labradar-bc-validation.md's Diagnostic C) that a single-draw
// mean-error check can't be trusted to fully price in, so this file
// does not chase that regime.
import { cleanTrack, weightedLinearFit } from '../../src/engine/labradar-clean.js';
import { trueStateAtTimes } from './synthetic-track.js';

export { cleanTrack as cleanC0 };

const MIN_LEFT_FLOOR = 10;
const DEFAULT_R2_THRESHOLD = 0.97;

// Below this many points, the physics reference and the full 2-parameter
// fit disagree too often to trust (measured directly — see build step 1
// in docs/plans/labradar-cleaning-experiment.md: worst-point agreement
// with the full fit was 100% at ~115 points, 71% down to ~40 points,
// then fell off a cliff to 21-43% below ~30 points). Below this floor,
// C1/C3 fall back to the linear reference for the remainder of the trim
// loop rather than trusting an unreliable physics reference all the way
// to MIN_LEFT_FLOOR.
const MIN_POINTS_FOR_PHYSICS_REFERENCE = 40;

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
function weightedSSE(pred, obs, w) {
  let sse = 0;
  for (let i = 0; i < pred.length; i++) {
    const d = pred[i] - obs[i];
    sse += w[i] * d * d;
  }
  return sse;
}

// Physics reference for one trim iteration: BC only, v1 FIXED (passed in,
// computed once per track outside the loop — never re-derived per
// iteration, unlike the full 2-parameter fit) — validated as the cheap
// design in docs/plans/labradar-cleaning-experiment.md after a naive
// 2-point bisection was tried and rejected (it interpolated exactly
// through 2 raw points with zero robustness; this fits a proper
// weighted SSE over every point in the fit range instead). Mirrors
// weightedLinearFit's own i=1..length-2 fit range exactly (excludes
// pts[0], the device's synthetic point, AND the last point, so a noisy
// tail point can't corrupt the reference the same way it can't corrupt
// today's linear one) — but the returned `predictedByIndex` covers
// i=1..length-1 (one batched stepper walk, not one per point), for the
// worst-point search's own wider i=1..length-1 candidate range. Returns
// null when `pts` is smaller than MIN_POINTS_FOR_PHYSICS_REFERENCE —
// callers fall back to the linear reference in that case.
function physicsReferenceModel(pts, v1Fixed, dragModel, atmo) {
  if (pts.length < MIN_POINTS_FOR_PHYSICS_REFERENCE) return null;

  const t1 = pts[1].t;
  const fitUpper = pts.length - 1; // i = 1..length-2
  const fitTargets = pts.slice(1, fitUpper);
  const fitRelTimes = fitTargets.map((p) => p.t - t1);
  const fitObserved = fitTargets.map((p) => p.v);
  const fitWeights = fitTargets.map((p) => p.a || 1);

  const bc = goldenSectionMin((candidate) => {
    const pred = trueStateAtTimes({ bc: candidate, dragModel, ...atmo }, v1Fixed, fitRelTimes).map((s) => s.v);
    return weightedSSE(pred, fitObserved, fitWeights);
  }, 0.05, 1.5, 30);

  const allTargets = pts.slice(1); // i = 1..length-1
  const allRelTimes = allTargets.map((p) => p.t - t1);
  const predictedByIndex = trueStateAtTimes({ bc, dragModel, ...atmo }, v1Fixed, allRelTimes).map((s) => s.v);
  return { kind: 'physics', bc, predictedByIndex }; // predictedByIndex[k] <-> pts[k + 1]
}

function linearReferenceModel(pts) {
  return { kind: 'linear', model: weightedLinearFit(pts) };
}

function residualAt(ref, pts, i) {
  if (ref.kind === 'physics') return pts[i].v - ref.predictedByIndex[i - 1];
  return pts[i].v - (ref.model.m * pts[i].t + ref.model.b);
}

// R^2-equivalent over i=1..length-2, generalized from labradar-clean.js's
// own rSquared() to work against either reference kind via residualAt().
function computeR2(ref, pts) {
  const upper = pts.length - 1;
  let mean = 0;
  for (let i = 1; i < upper; i++) mean += pts[i].v;
  mean /= upper - 1;

  let ssResid = 0, ssTotal = 0;
  for (let i = 1; i < upper; i++) {
    const resid = residualAt(ref, pts, i);
    ssResid += resid * resid;
    const total = pts[i].v - mean;
    ssTotal += total * total;
  }
  return 1 - ssResid / ssTotal;
}

function referenceFor(pts, mode, v1Fixed, dragModel, atmo) {
  if (mode === 'physics') {
    const physics = physicsReferenceModel(pts, v1Fixed, dragModel, atmo);
    if (physics) return physics;
  }
  return linearReferenceModel(pts);
}

// The actual greedy trim, parameterized. `referenceMode`: 'linear' |
// 'physics'. `r2Threshold`: the restore-ratio-to-best gate (today's
// shipped default is 0.97; see this file's header for what raising it
// does). Structurally identical to cleanTrack's own do/while
// trim-then-restore loop — only what "reference" means, and how strict
// the gate is, can change.
export function cleanAdaptive(points, {
  minLeft = MIN_LEFT_FLOOR, r2Threshold = DEFAULT_R2_THRESHOLD,
  referenceMode = 'physics',
  dragModel = 'G7', atmo
} = {}) {
  const floor = Math.max(minLeft, MIN_LEFT_FLOOR);
  let pts = points.slice();
  const v1Fixed = points[1].v;

  let r2Best = 0;
  const r2Steps = [];
  const discardedInOrder = [];

  do {
    const ref = referenceFor(pts, referenceMode, v1Fixed, dragModel, atmo);
    const r2 = computeR2(ref, pts);
    if (r2 > r2Best) r2Best = r2;

    let worstIndex = 1;
    let worstVal = Math.abs(residualAt(ref, pts, 1));
    for (let i = 2; i < pts.length; i++) {
      const val = Math.abs(residualAt(ref, pts, i));
      if (val > worstVal) { worstIndex = i; worstVal = val; }
    }

    discardedInOrder.push(pts[worstIndex]);
    pts.splice(worstIndex, 1);
    r2Steps.push(r2);
  } while (pts.length >= floor);

  // Restore from the first step within r2Threshold (ratio) of the best
  // R^2 ever seen — identical structure to cleanTrack's own.
  while (r2Steps.length > 0) {
    const r2 = r2Steps.shift();
    if (r2 / r2Best > r2Threshold) {
      pts.push(...discardedInOrder);
      break;
    }
    discardedInOrder.shift();
  }

  pts.sort((a, b) => a.t - b.t);

  const finalRef = referenceFor(pts, referenceMode, v1Fixed, dragModel, atmo);
  const r2 = computeR2(finalRef, pts);

  const keptSet = new Set(pts);
  const discarded = points.filter((p) => !keptSet.has(p));

  return { kept: pts, discarded, r2, referenceKind: finalRef.kind };
}

// C1: physics reference, today's 0.97 threshold — isolates the
// reference-model fix alone.
export const cleanC1 = (points, opts) => cleanAdaptive(points, { ...opts, referenceMode: 'physics', r2Threshold: DEFAULT_R2_THRESHOLD });
// C2: linear reference, raised 0.99 threshold — isolates the
// raised-threshold fix alone (does raising it help even without
// switching the reference?).
export const cleanC2 = (points, opts) => cleanAdaptive(points, { ...opts, referenceMode: 'linear', r2Threshold: 0.99 });
// C3: physics reference, raised 0.99 threshold — the actual proposal,
// both fixes combined.
export const cleanC3 = (points, opts) => cleanAdaptive(points, { ...opts, referenceMode: 'physics', r2Threshold: 0.99 });
