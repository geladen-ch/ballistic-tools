// Ports RadarTrack.chopShop("dist", ...) — the one live-wired point-
// cleaning routine in the legacy Labrabaco tool (data/legacy.code/
// labrabaco/engine/labrabacoengine.js), confirmed by tracing every call
// site: BCFetcher.processTrackData is the only reachable caller, and it
// always calls chopShop("dist", 0, 0.97). Every other cleaning routine in
// that file (chopShop's own "tail"/"noise" modes, calcBCnotails,
// consolidTracks, getAltBCs) is dead on that live path.
//
// Algorithm: iteratively remove the point furthest (by absolute residual)
// from the current SNR-weighted linear fit, refit, repeat down to a
// floor — then walk the recorded R^2 history forward from the start and
// restore every point from the first step whose R^2 was already within
// r2Threshold (relative) of the best R^2 ever seen during trimming
// onward (not just one point — everything still discarded at that
// moment). This is greedy iterative worst-point-removal gated by
// relative R^2 degradation, not sigma-clipping or RANSAC.
//
// points[0] is the Labradar device's own back-calculated/extrapolated
// t=0 point, not a real radar return (confirmed against real sample
// tracks: its SNR field is always "-", never a number) — it is excluded
// from both the fit/R^2 math and the worst-point search below, matching
// legacy exactly. The *last* point, by contrast, is real data and stays
// eligible for removal, but is excluded from the fit/R^2 itself — the
// device gets noisiest right at the tail, so a bad tail point shouldn't
// corrupt the quality metric even though it's a legitimate trim
// candidate — though in practice that only sticks if the fit range
// *also* has its own problem needing removal: since the fit/R^2 never
// looks at the last point at all, a track whose ONLY issue is a bad
// last point has an already-best-possible R^2 at step 0, before
// anything is removed — so the very first restore check (r2/r2Best===1)
// always passes and pushes every discarded point, including that lone
// bad last point, straight back on (see tests/labradar-clean.test.js
// for both this and the "coincides with a real fit-range problem, stays
// trimmed" case).
const MIN_LEFT_FLOOR = 10;
// 0.99, not legacy's 0.97 — validated in
// docs/reports/labradar-cleaning-experiment.md as a large accuracy win
// paired with the whole-window curve fit (src/engine/labradar-bc.js's
// estimateTrackBCWholeWindow). The real app always passes an explicit
// r2Threshold (see src/views/bc-tools-view.js's De-noise threshold
// slider), so this fallback isn't load-bearing there either way — kept
// consistent with the new default regardless.
const DEFAULT_R2_THRESHOLD = 0.99;

// i = 1 .. length-2 inclusive (excludes points[0] and the last point),
// matching legacy's regressionLinearWeighted()/calcCoeffDetL() exactly.
function fitUpperBound(points) {
  return points.length - 1;
}

// Shared SNR-weighted least-squares linear regression, parameterized by
// the exclusive upper bound of the summation range — legacy uses TWO
// different ranges for what is mathematically the same weighted-linear
// fit, and conflating them is a real, easy-to-miss mistake (confirmed by
// diffing against the real legacy engine's own intermediate values on
// real sample tracks — the two ranges produce velocities that agree to
// only ~3 significant figures with each other, not enough to look like a
// bug from R^2 alone since R^2 stayed nearly identical either way):
// - `regressionLinearWeighted()`/`calcCoeffDetL()` (i = 1..length-2, see
//   `weightedLinearFit` below) — used only for chopShop's own R^2 quality
//   gate and worst-point search.
// - `regressionPoly(1, "snrabs")` (i = 1..length-1, includes the last
//   point — see `fitVelocityModel` below) — a general arbitrary-order
//   polynomial solver in legacy, but at order 1 it's the exact same
//   weighted-linear formula, just over this different range. This is
//   what `vM()` actually evaluates, i.e. what the BC fit's vStart/vEnd
//   are read off — see labradar-bc.js's estimateTrackBC().
function weightedLinearRegression(points, upperExclusive) {
  let sumR = 0, sumX = 0, sumX2 = 0, sumY = 0, sumXY = 0;
  for (let i = 1; i < upperExclusive; i++) {
    const { t: x, v: y, a: r } = points[i];
    sumR += r;
    sumX += r * x;
    sumX2 += r * (x * x);
    sumY += r * y;
    sumXY += r * (x * y);
  }
  const denom = sumR * sumX2 - sumX * sumX;
  return {
    m: (sumR * sumXY - sumX * sumY) / denom,
    b: (sumY * sumX2 - sumX * sumXY) / denom
  };
}

// For chopShop's own R^2/worst-point-search purposes — i = 1..length-2.
export function weightedLinearFit(points) {
  return weightedLinearRegression(points, fitUpperBound(points));
}

// For evaluating v(t) at the BC fit's start/end points — i = 1..length-1
// (includes the last point). See the comment on weightedLinearRegression
// above for why this must be a separate fit, not a reuse of
// weightedLinearFit's model.
export function fitVelocityModel(points) {
  return weightedLinearRegression(points, points.length);
}

export function rSquared(points, model) {
  const upper = fitUpperBound(points);
  let mean = 0;
  for (let i = 1; i < upper; i++) mean += points[i].v;
  mean /= upper - 1;

  let ssResid = 0, ssTotal = 0;
  for (let i = 1; i < upper; i++) {
    const v = points[i].v;
    const total = v - mean;
    ssTotal += total * total;
    const resid = v - (model.m * points[i].t + model.b);
    ssResid += resid * resid;
  }
  return 1 - ssResid / ssTotal;
}

export function cleanTrack(points, { minLeft = MIN_LEFT_FLOOR, r2Threshold = DEFAULT_R2_THRESHOLD } = {}) {
  const floor = Math.max(minLeft, MIN_LEFT_FLOOR);
  let pts = points.slice();

  let r2Best = 0;
  const r2Steps = [];
  const discardedInOrder = [];

  // The stopping check runs AFTER the splice (do/while), so the loop can
  // — and typically does, on its last iteration — remove one point past
  // the floor: final trimmed length can bottom out at floor - 1. Unlike
  // the index asymmetries above, this has no domain justification found
  // in the legacy source — it reads as a plain accident. Preserved here
  // for a faithful first port (already validated against real sample
  // tracks); revisit with the user once cross-checked further, rather
  // than treating it as permanent.
  do {
    const model = weightedLinearFit(pts);
    const r2 = rSquared(pts, model);
    if (r2 > r2Best) r2Best = r2;

    let worstIndex = 1;
    let worstVal = Math.abs(pts[1].v - (model.m * pts[1].t + model.b));
    for (let i = 2; i < pts.length; i++) {
      const val = Math.abs(pts[i].v - (model.m * pts[i].t + model.b));
      if (val > worstVal) { worstIndex = i; worstVal = val; }
    }

    discardedInOrder.push(pts[worstIndex]);
    pts.splice(worstIndex, 1);
    r2Steps.push(r2);
  } while (pts.length >= floor);

  // Roll discarded points back on, from the first step whose R^2 was
  // already within r2Threshold (relative) of the best R^2 ever seen
  // during trimming — restores that step's point and everything
  // discarded afterward, not just one point.
  while (r2Steps.length > 0) {
    const r2 = r2Steps.shift();
    if (r2 / r2Best > r2Threshold) {
      pts.push(...discardedInOrder);
      break;
    }
    discardedInOrder.shift();
  }

  pts.sort((a, b) => a.t - b.t);

  const model = weightedLinearFit(pts);
  const r2 = rSquared(pts, model);

  const keptSet = new Set(pts);
  const discarded = points.filter((p) => !keptSet.has(p));

  return { kept: pts, discarded, model, r2 };
}
