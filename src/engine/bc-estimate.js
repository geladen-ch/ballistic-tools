// Ballistic coefficient estimation from measurements taken at a near and a
// far range (e.g. two chronograph readings, or a near velocity plus a
// measured time of flight). Solves for the BC that makes the drag model's
// predicted velocity (or elapsed time) between the two ranges match what
// was actually measured, via bisection over BC.
import { makeStepper, landOnRange } from './trajectory.js';
import { MAX_STEPS } from './constants.js';

const rangeOfX = (p) => p.x;
const rangeOfT = (p) => p.t;

// Lands exactly on r2 via landOnRange() (the same 3-point quadratic
// interpolation trajectory.js's own computeImpact()/integrate() use for
// every "state at an exact range" need) instead of reading off whatever
// raw RK4 point happens to overshoot it — that overshoot is tens of
// meters at supersonic speed, easily a large fraction of a short r1-r2
// separation, and was silently biasing the recovered BC. Returns both the
// retained velocity and the elapsed time, so callers solving from either
// measurement can share this one stepping helper.
function flightAt(bc, dragModel, r1, v1, r2, atmo) {
  const stepper = makeStepper({ bc, dragModel, windSpeed: 0, windAngle: 90, ...atmo });
  let older = null, prev = null, cur = { x: r1, y: 0, z: 0, vx: v1, vy: 0, vz: 0, t: 0 };
  let steps = 0;
  while (cur.x < r2 && steps < MAX_STEPS) {
    older = prev;
    prev = cur;
    cur = stepper.step(cur);
    steps++;
  }
  const landed = prev === null
    ? cur
    : landOnRange(older, prev, cur, () => (steps < MAX_STEPS ? stepper.step(cur) : null), rangeOfX, r2);
  return { v: Math.hypot(landed.vx, landed.vy, landed.vz), t: landed.t };
}

export function estimateBC({
  v1, r1, v2, r2, dragModel = 'G1',
  tempC = 15, pressureHpa = 1013, altitudeM = 0, humidityPct = 0,
  bcMin = 0.05, bcMax = 1.5, tol = 1e-5, maxIter = 60
}) {
  if (r2 <= r1) throw new Error('r2 must be greater than r1');
  if (v2 >= v1) throw new Error('v2 must be less than v1 (velocity should decay downrange)');

  const atmo = { tempC, pressureHpa, altitudeM, humidityPct };
  // f(bc) is monotonically increasing: a higher BC means less drag, so a
  // higher predicted v2. Bracket [bcMin, bcMax] and bisect.
  const f = (bc) => flightAt(bc, dragModel, r1, v1, r2, atmo).v - v2;

  let lo = bcMin, hi = bcMax;
  const fLo = f(lo), fHi = f(hi);
  if (fLo > 0 || fHi < 0) {
    throw new Error(`measured v2 is unreachable with bc in [${bcMin}, ${bcMax}] for ${dragModel} — widen the bracket or check inputs`);
  }

  let mid = (lo + hi) / 2;
  for (let i = 0; i < maxIter; i++) {
    mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < tol) break;
    if (fMid < 0) lo = mid; else hi = mid;
  }

  return { bc: mid, dragModel };
}

// A third shape, for the Labradar track fitter (src/engine/labradar-bc.js):
// no known ranges at all — just a start velocity, an elapsed time window,
// and an observed end velocity after that time (e.g. a chronograph-track
// window's first and last cleaned/modeled samples). Only the *shape* of
// decay over that window matters, so v1 is walked forward from x=0,t=0 as
// if it were a muzzle velocity, landing on the target elapsed time t2 via
// the same landOnRange() used above — just with rangeOfT instead of
// rangeOfX — rather than a target range.
function flightAtTime(bc, dragModel, v1, t2, atmo) {
  const stepper = makeStepper({ bc, dragModel, windSpeed: 0, windAngle: 90, ...atmo });
  let older = null, prev = null, cur = { x: 0, y: 0, z: 0, vx: v1, vy: 0, vz: 0, t: 0 };
  let steps = 0;
  while (cur.t < t2 && steps < MAX_STEPS) {
    older = prev;
    prev = cur;
    cur = stepper.step(cur);
    steps++;
  }
  const landed = prev === null
    ? cur
    : landOnRange(older, prev, cur, () => (steps < MAX_STEPS ? stepper.step(cur) : null), rangeOfT, t2);
  return { v: Math.hypot(landed.vx, landed.vy, landed.vz) };
}

export function estimateBCFromTimeWindow({
  v1, t2, v2, dragModel = 'G7',
  tempC = 15, pressureHpa = 1013, altitudeM = 0, humidityPct = 0,
  bcMin = 0.05, bcMax = 1.5, tol = 1e-5, maxIter = 60
}) {
  if (t2 <= 0) throw new Error('elapsed time must be positive');
  if (v2 >= v1) throw new Error('v2 must be less than v1 (velocity should decay over the window)');

  const atmo = { tempC, pressureHpa, altitudeM, humidityPct };
  // f(bc) is monotonically increasing, same reasoning as estimateBC: a
  // higher BC means less drag, so a higher retained velocity at t2.
  const f = (bc) => flightAtTime(bc, dragModel, v1, t2, atmo).v - v2;

  let lo = bcMin, hi = bcMax;
  const fLo = f(lo), fHi = f(hi);
  if (fLo > 0 || fHi < 0) {
    throw new Error(`observed v2 is unreachable with bc in [${bcMin}, ${bcMax}] for ${dragModel} — widen the bracket or check inputs`);
  }

  let mid = (lo + hi) / 2;
  for (let i = 0; i < maxIter; i++) {
    mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < tol) break;
    if (fMid < 0) lo = mid; else hi = mid;
  }

  return { bc: mid, dragModel };
}

// Walks the stepper once from x:0,y:0,z:0,vx:v1,t:0, landing on every one
// of `times` (ascending) via landOnRange/rangeOfT — the same technique
// flightAtTime uses for a single target, generalized to many in one pass
// (one integration walk, not one per target time). Used by
// estimateBCWholeWindow below to evaluate a whole track's worth of
// predicted velocities against one (bc, v1) candidate at a time, and
// exposed publicly as predictVelocityAtTimes for callers who already
// have a converged (bc, v1) and just want the curve it predicts (e.g.
// the Labradar per-track chart's fitted-curve overlay).
function flightVelocitiesAtTimes(bc, dragModel, v1, times, atmo) {
  const stepper = makeStepper({ bc, dragModel, windSpeed: 0, windAngle: 90, ...atmo });
  let older = null, prev = null, cur = { x: 0, y: 0, z: 0, vx: v1, vy: 0, vz: 0, t: 0 };
  let steps = 0;
  const out = [];
  for (const t of times) {
    while (cur.t < t && steps < MAX_STEPS) {
      older = prev;
      prev = cur;
      cur = stepper.step(cur);
      steps++;
    }
    const landed = prev === null
      ? cur
      : landOnRange(older, prev, cur, () => (steps < MAX_STEPS ? stepper.step(cur) : null), rangeOfT, t);
    out.push(Math.hypot(landed.vx, landed.vy, landed.vz));
  }
  return out;
}

// Public wrapper around flightVelocitiesAtTimes for callers who already
// have a converged (bc, v1) — e.g. estimateTrackBCWholeWindow's own
// result — and just want the velocity curve it predicts at a set of
// times, not a fit. `times` are relative to the same t=0 anchor v1
// itself is defined at (v1 is a velocity *at* t=0, not a muzzle
// velocity), ascending. Same flat-atmo-params convention as this file's
// other exports.
export function predictVelocityAtTimes({
  bc, v1, times, dragModel = 'G7',
  tempC = 15, pressureHpa = 1013, altitudeM = 0, humidityPct = 0
}) {
  return flightVelocitiesAtTimes(bc, dragModel, v1, times, { tempC, pressureHpa, altitudeM, humidityPct });
}

function weightedSSE(predicted, observed, weights) {
  let sse = 0;
  for (let i = 0; i < predicted.length; i++) {
    const d = predicted[i] - observed[i];
    sse += weights[i] * d * d;
  }
  return sse;
}

const GOLDEN = (Math.sqrt(5) - 1) / 2;
function goldenSectionMin(f, lo, hi, iterations) {
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

// Fits BC jointly with a reference velocity (v1) against a whole window
// of samples at once — not just two endpoints — using the real drag
// model directly rather than approximating the decay with a generic
// curve first. Built for the Labradar track fitter
// (src/engine/labradar-bc.js's estimateTrackBCWholeWindow): `samples` is
// a cleaned track's kept points (excluding the device's own synthetic
// t=0 point), `t` measured relative to the anchor point (t=0 there),
// ascending, SNR-weighted. v1 is fitted jointly with bc, not held fixed
// at the raw observed anchor velocity, since that's itself a noisy
// measurement — letting the fit smooth it uses far fewer degrees of
// freedom than a generic polynomial curve fit would (2 physically
// meaningful parameters, not 3+ arbitrary coefficients), so it can't
// overfit tail noise the way a richer curve can.
//
// Solved as a nested golden-section search (inner: bc for a candidate
// v1; outer: v1) rather than bisection, since this is a minimization
// (sum of squared residuals), not a root-find on a monotonic scalar like
// every other function in this file.
export function estimateBCWholeWindow({
  samples, v1Guess, dragModel = 'G7',
  tempC = 15, pressureHpa = 1013, altitudeM = 0, humidityPct = 0,
  bcMin = 0.05, bcMax = 1.5, v1BracketFrac = 0.15, iterations = 30
}) {
  const atmo = { tempC, pressureHpa, altitudeM, humidityPct };
  const times = samples.map((s) => s.t);
  const observed = samples.map((s) => s.v);
  const weights = samples.map((s) => s.weight);

  function sseFor(v1, bc) {
    const predicted = flightVelocitiesAtTimes(bc, dragModel, v1, times, atmo);
    return weightedSSE(predicted, observed, weights);
  }
  function bestBcFor(v1) {
    const bc = goldenSectionMin((candidate) => sseFor(v1, candidate), bcMin, bcMax, iterations);
    return { bc, sse: sseFor(v1, bc) };
  }

  const v1Lo = v1Guess * (1 - v1BracketFrac);
  const v1Hi = v1Guess * (1 + v1BracketFrac);
  const bestV1 = goldenSectionMin((v1) => bestBcFor(v1).sse, v1Lo, v1Hi, iterations);
  const { bc } = bestBcFor(bestV1);

  if (isAtBoundary(bc, bcMin, bcMax) || isAtBoundary(bestV1, v1Lo, v1Hi)) {
    throw new Error('whole-window BC fit saturated at a search-bracket boundary — no interior optimum found for this data');
  }

  return { bc, v1: bestV1 };
}

// Same idea as estimateBC, but from a single measured time of flight
// between r1 and r2 instead of a measured far velocity v2 — e.g. one
// stopwatch/timer reading over a known distance, with v1 still known (a
// near/muzzle velocity), rather than two chronograph readings.
export function estimateBCFromTof({
  v1, r1, r2, tof, dragModel = 'G1',
  tempC = 15, pressureHpa = 1013, altitudeM = 0, humidityPct = 0,
  bcMin = 0.05, bcMax = 1.5, tol = 1e-5, maxIter = 60
}) {
  if (r2 <= r1) throw new Error('r2 must be greater than r1');
  if (tof <= 0) throw new Error('time of flight must be positive');

  const atmo = { tempC, pressureHpa, altitudeM, humidityPct };
  // g(bc) is monotonically decreasing: a higher BC means less drag, so a
  // higher retained velocity between r1 and r2, so less time to cover the
  // segment — the opposite sign convention from estimateBC's velocity
  // residual above.
  const g = (bc) => flightAt(bc, dragModel, r1, v1, r2, atmo).t - tof;

  let lo = bcMin, hi = bcMax;
  const gLo = g(lo), gHi = g(hi);
  if (gLo < 0 || gHi > 0) {
    throw new Error(`measured time of flight is unreachable with bc in [${bcMin}, ${bcMax}] for ${dragModel} — widen the bracket or check inputs`);
  }

  let mid = (lo + hi) / 2;
  for (let i = 0; i < maxIter; i++) {
    mid = (lo + hi) / 2;
    const gMid = g(mid);
    if (Math.abs(gMid) < tol) break;
    // g is decreasing: g(mid) > 0 means still too slow (tof too long), so
    // bc needs to go up — raise lo, not hi.
    if (gMid > 0) lo = mid; else hi = mid;
  }

  return { bc: mid, dragModel };
}
