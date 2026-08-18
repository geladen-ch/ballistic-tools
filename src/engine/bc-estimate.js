// Ballistic coefficient estimation from measurements taken at a near and a
// far range (e.g. two chronograph readings, or a near velocity plus a
// measured time of flight). Solves for the BC that makes the drag model's
// predicted velocity (or elapsed time) between the two ranges match what
// was actually measured, via bisection over BC.
import { makeStepper, landOnRange } from './trajectory.js';
import { MAX_STEPS } from './constants.js';

const rangeOfX = (p) => p.x;

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
