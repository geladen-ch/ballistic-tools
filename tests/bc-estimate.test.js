import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStepper, landOnRange } from '../src/engine/trajectory.js';
import { estimateBC, estimateBCFromTof, estimateBCFromTimeWindow, estimateBCWholeWindow, predictVelocityAtTimes } from '../src/engine/bc-estimate.js';
import { MAX_STEPS } from '../src/engine/constants.js';

const atmo = { tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0 };
const rangeOfX = (p) => p.x;

// Lands exactly on r2 the same way estimateBC's own speedAt() now does
// (see bc-estimate.js), so this "ground truth" generator is methodologically
// consistent with what's being tested — comparing against a raw-overshoot
// value would reintroduce the very bias landOnRange() was added to remove.
function forwardVelocity(bc, dragModel, r1, v1, r2) {
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
  return Math.hypot(landed.vx, landed.vy, landed.vz);
}

test('recovers a known BC from synthetic near/far velocities', () => {
  const trueBC = 0.42;
  const r1 = 3, r2 = 300, v1 = 880;
  const v2 = forwardVelocity(trueBC, 'G1', r1, v1, r2);

  const { bc } = estimateBC({ v1, r1, v2, r2, dragModel: 'G1', ...atmo });
  assert.ok(Math.abs(bc - trueBC) < 1e-3, `estimated ${bc}, expected ~${trueBC}`);
});

test('throws when v2 is not less than v1', () => {
  assert.throws(() => estimateBC({ v1: 800, r1: 0, v2: 850, r2: 100, ...atmo }));
});

test('throws when r2 is not past r1', () => {
  assert.throws(() => estimateBC({ v1: 800, r1: 100, v2: 700, r2: 50, ...atmo }));
});

// Same "forward-simulate a known bc, check the solver recovers it"
// methodology as forwardVelocity() above, but reading off elapsed time
// instead of retained velocity.
function forwardTime(bc, dragModel, r1, v1, r2) {
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
  return landed.t;
}

test('recovers a known BC from a synthetic time of flight', () => {
  const trueBC = 0.42;
  const r1 = 3, r2 = 300, v1 = 880;
  const tof = forwardTime(trueBC, 'G1', r1, v1, r2);

  const { bc } = estimateBCFromTof({ v1, r1, r2, tof, dragModel: 'G1', ...atmo });
  assert.ok(Math.abs(bc - trueBC) < 1e-3, `estimated ${bc}, expected ~${trueBC}`);
});

test('estimateBCFromTof: a higher bc gives a lower time of flight over the same segment', () => {
  const r1 = 3, r2 = 300, v1 = 880;
  const tofLowBc = forwardTime(0.20, 'G1', r1, v1, r2);
  const tofHighBc = forwardTime(0.80, 'G1', r1, v1, r2);
  assert.ok(tofHighBc < tofLowBc, 'higher BC (less drag) should take less time to cover the same distance');
});

test('estimateBCFromTof: throws when r2 is not past r1', () => {
  assert.throws(() => estimateBCFromTof({ v1: 800, r1: 100, r2: 50, tof: 0.3, ...atmo }));
});

test('estimateBCFromTof: throws on a non-positive time of flight', () => {
  assert.throws(() => estimateBCFromTof({ v1: 800, r1: 0, r2: 100, tof: 0, ...atmo }));
  assert.throws(() => estimateBCFromTof({ v1: 800, r1: 0, r2: 100, tof: -1, ...atmo }));
});

test('estimateBCFromTof: throws when the measured time of flight is unreachable within the bc bracket', () => {
  assert.throws(() => estimateBCFromTof({ v1: 800, r1: 0, r2: 300, tof: 1e-6, ...atmo }));
});

// estimateBCFromTimeWindow — the Labradar track fitter's own shape (see
// src/engine/labradar-bc.js): unlike estimateBC/estimateBCFromTof above,
// there's no known range at all, just a start velocity, an elapsed time
// window, and an observed end velocity. v1 is walked forward from x=0,t=0
// as if it were a muzzle velocity — same "forward-simulate a known bc,
// check the solver recovers it" methodology as forwardVelocity()/
// forwardTime() above, just landing on time via rangeOfT instead of
// range via rangeOfX.
const rangeOfT = (p) => p.t;

function forwardVelocityAtTime(bc, dragModel, v1, t2) {
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
  return Math.hypot(landed.vx, landed.vy, landed.vz);
}

test('estimateBCFromTimeWindow: recovers a known BC from a synthetic start velocity/time window/end velocity', () => {
  const trueBC = 0.30;
  const v1 = 800, t2 = 0.15;
  const v2 = forwardVelocityAtTime(trueBC, 'G7', v1, t2);

  const { bc } = estimateBCFromTimeWindow({ v1, t2, v2, dragModel: 'G7', ...atmo });
  assert.ok(Math.abs(bc - trueBC) < 1e-3, `estimated ${bc}, expected ~${trueBC}`);
});

test('estimateBCFromTimeWindow: a higher bc retains a higher velocity over the same time window', () => {
  const v1 = 800, t2 = 0.15;
  const vLowBc = forwardVelocityAtTime(0.20, 'G7', v1, t2);
  const vHighBc = forwardVelocityAtTime(0.80, 'G7', v1, t2);
  assert.ok(vHighBc > vLowBc, 'higher BC (less drag) should retain more velocity over the same window');
});

test('estimateBCFromTimeWindow: throws on a non-positive time window', () => {
  assert.throws(() => estimateBCFromTimeWindow({ v1: 800, t2: 0, v2: 700, ...atmo }));
  assert.throws(() => estimateBCFromTimeWindow({ v1: 800, t2: -0.1, v2: 700, ...atmo }));
});

test('estimateBCFromTimeWindow: throws when v2 is not less than v1', () => {
  assert.throws(() => estimateBCFromTimeWindow({ v1: 800, t2: 0.15, v2: 850, ...atmo }));
});

test('estimateBCFromTimeWindow: throws when the observed v2 is unreachable within the bc bracket', () => {
  assert.throws(() => estimateBCFromTimeWindow({ v1: 800, t2: 1e-6, v2: 1, ...atmo }));
});

// estimateBCWholeWindow — the Labradar track fitter's whole-window shape
// (see src/engine/labradar-bc.js's estimateTrackBCWholeWindow, the real
// caller): fits bc jointly with a reference velocity against every
// sample in a window at once, rather than just two endpoints. Same
// "forward-simulate a known bc, check the solver recovers it"
// methodology as forwardVelocityAtTime() above, generalized to several
// sample times across one window (one integration walk, not one per
// sample — see estimateBCWholeWindow's own flightVelocitiesAtTimes()).
function forwardSamplesAtTimes(bc, dragModel, v1, times) {
  const stepper = makeStepper({ bc, dragModel, windSpeed: 0, windAngle: 90, ...atmo });
  let older = null, prev = null, cur = { x: 0, y: 0, z: 0, vx: v1, vy: 0, vz: 0, t: 0 };
  let steps = 0;
  return times.map((t) => {
    while (cur.t < t && steps < MAX_STEPS) {
      older = prev;
      prev = cur;
      cur = stepper.step(cur);
      steps++;
    }
    const landed = prev === null
      ? cur
      : landOnRange(older, prev, cur, () => (steps < MAX_STEPS ? stepper.step(cur) : null), rangeOfT, t);
    return Math.hypot(landed.vx, landed.vy, landed.vz);
  });
}

test('estimateBCWholeWindow: recovers a known BC and v1 from several synthetic samples across a window', () => {
  const trueBC = 0.30, v1 = 800;
  const times = Array.from({ length: 20 }, (_, i) => (i + 1) * 0.005); // 5ms..100ms
  const velocities = forwardSamplesAtTimes(trueBC, 'G7', v1, times);
  const samples = times.map((t, i) => ({ t, v: velocities[i], weight: 1 }));

  const { bc, v1: fittedV1 } = estimateBCWholeWindow({ samples, v1Guess: v1, dragModel: 'G7', ...atmo });
  assert.ok(Math.abs(bc - trueBC) < 1e-3, `estimated ${bc}, expected ~${trueBC}`);
  assert.ok(Math.abs(fittedV1 - v1) < 1, `estimated v1 ${fittedV1}, expected ~${v1}`);
});

test('estimateBCWholeWindow: a higher bc retains higher velocities across the same window', () => {
  const v1 = 800;
  const times = Array.from({ length: 20 }, (_, i) => (i + 1) * 0.005);
  const lowBcV = forwardSamplesAtTimes(0.20, 'G7', v1, times);
  const highBcV = forwardSamplesAtTimes(0.80, 'G7', v1, times);
  for (let i = 0; i < times.length; i++) {
    assert.ok(highBcV[i] > lowBcV[i], `sample ${i}: higher BC should retain more velocity`);
  }
});

test('estimateBCWholeWindow: throws when the search saturates at a bracket boundary rather than a real optimum', () => {
  const trueBC = 0.30, v1 = 800;
  const times = Array.from({ length: 20 }, (_, i) => (i + 1) * 0.005);
  const velocities = forwardSamplesAtTimes(trueBC, 'G7', v1, times);
  const samples = times.map((t, i) => ({ t, v: velocities[i], weight: 1 }));
  // v1Guess wildly off from the real v1=800 the samples were generated
  // from — the +-15% v1 bracket around it can't contain the truth, so no
  // (v1, bc) pair in range fits well; the search should throw rather
  // than silently return a saturated, meaningless boundary value.
  assert.throws(() => estimateBCWholeWindow({ samples, v1Guess: 400, dragModel: 'G7', ...atmo }));
});

// predictVelocityAtTimes — the public curve-prediction wrapper used by
// the Labradar per-track chart's fitted-curve overlay (see
// src/ui/labradar/track-chart.js). Just a public entry point onto the
// same physics estimateBCWholeWindow's own search already walks, so
// this checks it against an independent forward simulation rather than
// re-deriving a whole new methodology.
test('predictVelocityAtTimes matches an independent forward simulation at the same times', () => {
  const bc = 0.30, v1 = 800;
  const times = [0.01, 0.05, 0.1, 0.15];
  const expected = forwardSamplesAtTimes(bc, 'G7', v1, times);

  const actual = predictVelocityAtTimes({ bc, v1, times, dragModel: 'G7', ...atmo });
  assert.equal(actual.length, times.length);
  for (let i = 0; i < times.length; i++) {
    assert.ok(Math.abs(actual[i] - expected[i]) < 1e-6, `sample ${i}: ${actual[i]} vs ${expected[i]}`);
  }
});
