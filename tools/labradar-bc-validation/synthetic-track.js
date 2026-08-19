// Builds a synthetic Labradar-shaped track from a known ground-truth
// trajectory, using a real donor track (see donor-corpus.js) for its
// point-timing/SNR cadence — real Labradar spacing widens toward the tail
// in a way no simple formula was worth inventing when a real donor's own
// cadence is right there — plus one of two interchangeable noise value
// sources:
//   'donor'      — the donor's own measured residuals, verbatim (the
//                   reference/gold-standard mode; see donor-corpus.js's
//                   own header comment for how those residuals were
//                   measured against a tail-uncontaminated reference).
//   'parametric' — residuals drawn from parametric-noise.js's model
//                   instead, fit to the same corpus's aggregate shape.
// Severity is deliberately NOT a separate hand-picked axis here: it comes
// from (a) which real donor a trial happens to draw (donors range from
// zero-discard clean tracks to 70+-discard bad sessions — see
// donor-corpus.js), and (b) how much of the true trajectory's flight time
// the caller chooses to window (see timeToRange below) — both real,
// motivated axes, not an invented "noise severity" dial.
import { makeStepper, landOnRange } from '../../src/engine/trajectory.js';

const rangeOfT = (p) => p.t;
const rangeOfX = (p) => p.x;

function walkStepper(trueState, v1) {
  const stepper = makeStepper({ windSpeed: 0, windAngle: 90, ...trueState });
  return {
    cur: { x: 0, y: 0, z: 0, vx: v1, vy: 0, vz: 0, t: 0 },
    prev: null,
    older: null,
    stepper
  };
}

// Walks the true trajectory once, landing on each of `targetTimes`
// (ascending) via landOnRange — same technique
// tests/labradar-bc.test.js's makeSyntheticTrack already uses to
// generate tracks, generalized to arbitrary (not fixed-cadence) target
// times, since real donor cadences are themselves uneven.
export function trueStateAtTimes(trueState, v1, targetTimes) {
  const walk = walkStepper(trueState, v1);
  const out = [];
  for (const t of targetTimes) {
    while (walk.cur.t < t) {
      walk.older = walk.prev;
      walk.prev = walk.cur;
      walk.cur = walk.stepper.step(walk.cur);
    }
    const landed = walk.prev === null
      ? walk.cur
      : landOnRange(walk.older, walk.prev, walk.cur, () => walk.stepper.step(walk.cur), rangeOfT, t);
    out.push({ t: landed.t, v: Math.hypot(landed.vx, landed.vy, landed.vz), x: landed.x });
  }
  return out;
}

// Time of flight for the true trajectory to reach `targetRangeM` — used
// to convert the "reliable to ~100m, noisy but usable to ~150-200m"
// ballpark (a real distance, and explicitly not an algorithmic constant)
// into a time window for whichever config is being simulated, since a
// fast/low-BC round covers that distance in less time than a slow/
// high-BC one.
export function timeToRange(trueState, v1, targetRangeM) {
  const walk = walkStepper(trueState, v1);
  while (walk.cur.x < targetRangeM) {
    walk.older = walk.prev;
    walk.prev = walk.cur;
    walk.cur = walk.stepper.step(walk.cur);
  }
  const landed = walk.prev === null
    ? walk.cur
    : landOnRange(walk.older, walk.prev, walk.cur, () => walk.stepper.step(walk.cur), rangeOfX, targetRangeM);
  return landed.t;
}

// `trueState`: { bc, dragModel, tempC, pressureHpa, altitudeM,
// humidityPct } or { cdTable, massKg, caliberM, ...atmo } — passed
// straight through to makeStepper, so either ground-truth shape (BC/G7
// or a bundled bullet's own measured Cd table) works unchanged.
// `donor`: one entry from donor-corpus.js's loadDonorCorpus().
// `noiseMode`: 'donor' | 'parametric'; 'parametric' requires
// `residualAt(tFrac, snr, rng)` (see parametric-noise.js).
export function generateSyntheticTrack({
  trueState, v1, donor, windowDurationS, noiseMode, residualAt, rng = Math.random
}) {
  if (noiseMode === 'parametric' && typeof residualAt !== 'function') {
    throw new Error('parametric noise mode requires a residualAt(tFrac, snr, rng) function');
  }

  // Rescales the donor's own pts[0]->pts[1] gap (t1Offset) by the same
  // factor as the rest of its timing, rather than dropping it — mapping
  // tFrac=0 straight to target time 0 would otherwise land the first
  // real sample exactly on top of the synthetic pts[0] below.
  const scale = windowDurationS / donor.duration;
  const targetTimes = donor.samples.map((s) => (donor.t1Offset + s.tFrac * donor.duration) * scale);
  const trueStates = trueStateAtTimes(trueState, v1, targetTimes);

  // points[0]: the device's own back-calculated, non-measured t=0 point
  // — present in every real track and excluded from all fit/clean math
  // by src/engine/labradar-clean.js's own convention (see its header
  // comment); reproduced here with snr=0/a=0 to match real tracks
  // exactly, not because anything downstream reads its velocity.
  const points = [{ t: 0, v: v1, dist: 0, snr: 0, a: 0 }];
  for (let i = 0; i < donor.samples.length; i++) {
    const { tFrac, snr } = donor.samples[i];
    const residual = noiseMode === 'donor' ? donor.samples[i].residual : residualAt(tFrac, snr, rng);
    const state = trueStates[i];
    points.push({ t: state.t, v: state.v + residual, dist: state.x, snr, a: snr ? Math.pow(10, snr / 10) : 0 });
  }
  return points;
}
