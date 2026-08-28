import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStepper } from '../src/engine/trajectory.js';
import { makeStepper4dof } from '../src/engine/trajectory-4dof.js';

// Confirms the 4-DOF/MPM stepper is meaningfully more expensive per step
// than the plain 3-DOF one — the whole reason Hit Probability's Monte
// Carlo dispersion loop (thousands of computeImpact() calls per shot
// group) is deliberately kept on the cheap path (see
// resolveSpinDriftMode's own doc comment in spin-drift.js) rather than
// ever offered the mccoy4dof mode. Not a strict "must be under X ms"
// benchmark — wall-clock timing on shared/CI hardware is inherently
// noisy — just a sanity bound wide enough to survive that noise while
// still catching a real regression (e.g. an accidental O(n^2) somewhere,
// or 4-DOF becoming *cheaper* than 3-DOF, which would mean something
// upstream broke rather than something got faster for free).
const REFERENCE_BULLET = {
  massKg: 168 / 15432.358352941432,
  caliberM: 0.308 * 0.0254,
  lengthM: 1.226 * 0.0254,
  muzzleVelocity: 792.48,
  riflingTwistMm: 12 * 25.4,
  twistDirection: 'right',
  bc: 0.462, dragModel: 'G7'
};

function timeSteps(step, initial, count) {
  let pt = initial;
  const start = process.hrtime.bigint();
  for (let i = 0; i < count; i++) pt = step(pt);
  const end = process.hrtime.bigint();
  return { elapsedMs: Number(end - start) / 1e6, final: pt };
}

test('the 4-DOF stepper is slower than the 3-DOF stepper, within a sane bound', () => {
  const STEPS = 20000;
  const TRIALS = 5;

  const { step: step3 } = makeStepper(REFERENCE_BULLET);
  const { step: step4, p0 } = makeStepper4dof(REFERENCE_BULLET);

  const initial3 = { x: 0, y: 0, z: 0, vx: REFERENCE_BULLET.muzzleVelocity, vy: 0, vz: 0, t: 0 };
  const initial4 = { x: 0, y: 0, z: 0, vx: REFERENCE_BULLET.muzzleVelocity, vy: 0, vz: 0, p: p0, t: 0 };

  // Warm up (JIT) before the timed trials, same step count each time so
  // both steppers get equal warm-up.
  timeSteps(step3, initial3, STEPS);
  timeSteps(step4, initial4, STEPS);

  const times3 = [], times4 = [];
  for (let i = 0; i < TRIALS; i++) {
    times3.push(timeSteps(step3, initial3, STEPS).elapsedMs);
    times4.push(timeSteps(step4, initial4, STEPS).elapsedMs);
  }
  const median = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  const t3 = median(times3), t4 = median(times4);
  const ratio = t4 / t3;

  assert.ok(ratio > 1, `expected 4-DOF to be slower than 3-DOF, got ratio ${ratio.toFixed(2)}x (3-DOF=${t3.toFixed(2)}ms, 4-DOF=${t4.toFixed(2)}ms for ${STEPS} steps)`);
  assert.ok(ratio < 20, `4-DOF is more than 20x slower than 3-DOF (${ratio.toFixed(2)}x) — investigate before assuming this is just normal Magnus/yaw-of-repose overhead`);
});
