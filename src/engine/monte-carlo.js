// Monte-Carlo hit probability: samples impact points from the dispersion and
// classifies each one against the target's real geometry.
//
// This is an alternative to the analytical path in target-shapes.js, not a
// replacement for it. Where a target's zones decompose exactly into
// axis-aligned rectangles, the analytical form is exact, instant, and should
// stay. What sampling adds is everything that decomposition cannot express:
//
//   * Zone shapes with no closed form under a bivariate normal — circles
//     included. rectangleHitProbability() is exact, but circles currently go
//     through an equal-area-square approximation, and non-rectangular zones
//     have to be hand-decomposed per target.
//   * Any future uncertainty source whose effect on the impact point is
//     genuinely non-linear. The analytical path has to linearize each source
//     to a single (x, y) standard deviation; a sampler can simply draw the
//     source and push each draw through the real trajectory.
//
// The sampler is a randomly shifted rank-1 lattice (see qrng.js) rather than
// a plain PRNG. Zone classification is an indicator function, and in theory
// its discontinuity at the zone boundary blunts what a quasi-random sequence
// can do — so the gain here was measured rather than assumed. Over 200 seeds,
// the lattice's standard error never exceeded 5% of independent sampling's at
// equal point count, i.e. roughly 20x the accuracy, or some two orders of
// magnitude fewer points for the same answer. tests/monte-carlo.test.js keeps
// that comparison honest by re-running it.

import { LatticeSequence, latticeSteps, mulberry32, boxMuller } from './qrng.js';

// One (x, y) pair per point: dimension 0 becomes the Box-Muller radius,
// dimension 1 the angle.
const DIMENSIONS = 2;

const DEFAULT_POINTS = 1 << 14;
const DEFAULT_REPLICATES = 16;

// Estimates the probability of landing in each zone of a target.
//
// `classify(x, y)` receives an impact point in the target's own coordinate
// frame — the same centimetre frame the analytical hitProbability() functions
// use, origin at the point of aim — and returns that point's zone id, or
// null/undefined for a miss. Zones are whatever the caller says they are;
// this function never assumes they nest or tile.
//
// `sdX`/`sdY` are the dispersion's standard deviations and `offsetX`/`offsetY`
// where it is centred, exactly as computeSingleShot() reports them.
//
// Returns one entry per zone the classifier ever returned:
//   { zoneId, probability, standardError }
// `standardError` is the spread across independently shifted replicates — a
// real, reportable uncertainty on the estimate, not a nominal figure. Callers
// that want a tighter answer should raise `points` first (the lattice's error
// falls faster than the replicate count's 1/sqrt) and `replicates` only far
// enough to keep the error bar itself meaningful; below about 8 the spread of
// 8 numbers is too noisy to trust.
export function monteCarloZoneProbabilities({
  classify,
  sdX,
  sdY,
  offsetX = 0,
  offsetY = 0,
  points = DEFAULT_POINTS,
  replicates = DEFAULT_REPLICATES,
  seed = 1
} = {}) {
  if (typeof classify !== 'function') throw new TypeError('classify must be a function');
  if (!(points > 0) || !(replicates > 0)) throw new RangeError('points and replicates must be positive');

  const steps = latticeSteps(DIMENSIONS);
  const rng = mulberry32(seed);
  const u = new Float64Array(DIMENSIONS);
  const z = new Float64Array(2);

  // Per-zone tally of each replicate's own estimated probability, so the
  // spread across replicates can be turned into a standard error at the end.
  const perReplicate = new Map();
  const ensure = (zoneId) => {
    let row = perReplicate.get(zoneId);
    if (!row) {
      // A zone first seen in replicate 3 still scored 0 in replicates 0-2 —
      // backfill so every row has one entry per replicate.
      row = new Array(replicates).fill(0);
      perReplicate.set(zoneId, row);
    }
    return row;
  };

  for (let r = 0; r < replicates; r++) {
    const lattice = new LatticeSequence(DIMENSIONS, steps, rng);
    const counts = new Map();
    for (let i = 0; i < points; i++) {
      lattice.next(u);
      boxMuller(u[0], u[1], z);
      const zoneId = classify(offsetX + sdX * z[0], offsetY + sdY * z[1]);
      if (zoneId === null || zoneId === undefined) continue;
      counts.set(zoneId, (counts.get(zoneId) || 0) + 1);
    }
    for (const [zoneId, count] of counts) ensure(zoneId)[r] = count / points;
  }

  const out = [];
  for (const [zoneId, row] of perReplicate) {
    let mean = 0;
    for (const value of row) mean += value;
    mean /= replicates;
    let variance = 0;
    for (const value of row) variance += (value - mean) * (value - mean);
    // Standard error of the mean of `replicates` independent estimates. With
    // a single replicate there is no spread to measure and the error is
    // simply unknown, which NaN states more honestly than 0 would.
    const standardError =
      replicates > 1 ? Math.sqrt(variance / (replicates - 1) / replicates) : NaN;
    out.push({ zoneId, probability: mean, standardError });
  }
  return out;
}

// Convenience wrapper for the common single-zone "did it hit at all" case:
// returns just { probability, standardError } for a hit/miss predicate.
export function monteCarloHitProbability({ inside, ...rest }) {
  if (typeof inside !== 'function') throw new TypeError('inside must be a function');
  const zones = monteCarloZoneProbabilities({
    ...rest,
    classify: (x, y) => (inside(x, y) ? 'hit' : null)
  });
  return zones.find((zone) => zone.zoneId === 'hit') || { probability: 0, standardError: 0 };
}
