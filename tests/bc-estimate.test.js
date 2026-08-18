import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStepper, landOnRange } from '../src/engine/trajectory.js';
import { estimateBC, estimateBCFromTof } from '../src/engine/bc-estimate.js';
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
