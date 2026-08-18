import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSpinDrift, spinDriftCm } from '../src/engine/spin-drift.js';

const FULL_INPUTS = { massKg: 0.0109, caliberM: 0.00782, lengthM: 0.0305, muzzleVelocity: 807, riflingTwistMm: 279.4 };

function driftInchesReference(sg, tofSec) {
  return 1.25 * (sg + 1.2) * tofSec ** 1.83;
}

test('spinDriftCm matches the imperial reference formula (scaled to cm)', () => {
  const sg = 1.8, tof = 0.85;
  const expectedCm = driftInchesReference(sg, tof) * 2.54;
  const actual = spinDriftCm({ sg, twistDirection: 'left' }, tof);
  assert.ok(Math.abs(actual - expectedCm) < 1e-9, `got ${actual}, expected ~${expectedCm}`);
});

test('right-hand twist drifts negative (this engine\'s +z is left); left-hand is the mirror', () => {
  const right = spinDriftCm({ sg: 1.8, twistDirection: 'right' }, 0.85);
  const left = spinDriftCm({ sg: 1.8, twistDirection: 'left' }, 0.85);
  assert.ok(right < 0);
  assert.ok(left > 0);
  assert.equal(right, -left);
});

test('an unrecognized/missing twistDirection defaults to right (negative)', () => {
  const result = spinDriftCm({ sg: 1.8, twistDirection: undefined }, 0.5);
  assert.ok(result < 0);
});

test('resolveSpinDrift returns null when the setting is off', () => {
  assert.equal(resolveSpinDrift({ calculateSpinDrift: false, ...FULL_INPUTS }, FULL_INPUTS.muzzleVelocity), null);
  assert.equal(resolveSpinDrift({ ...FULL_INPUTS }, FULL_INPUTS.muzzleVelocity), null); // calculateSpinDrift absent entirely
});

test('resolveSpinDrift returns null when any required field is missing, even with the setting on', () => {
  for (const key of Object.keys(FULL_INPUTS)) {
    // muzzleVelocity is passed as resolveSpinDrift's own 2nd argument (the
    // caller's already-resolved value), not read off state — blank it out
    // there instead of on the state object for that one field.
    const state = { calculateSpinDrift: true, ...FULL_INPUTS, [key]: key === 'muzzleVelocity' ? FULL_INPUTS.muzzleVelocity : null };
    const muzzleVelocity = key === 'muzzleVelocity' ? null : FULL_INPUTS.muzzleVelocity;
    assert.equal(resolveSpinDrift(state, muzzleVelocity), null, `${key}: null should block`);
  }
});

test('resolveSpinDrift returns {sg, twistDirection} when the setting is on and all data is present', () => {
  const state = { calculateSpinDrift: true, twistDirection: 'left', ...FULL_INPUTS };
  const result = resolveSpinDrift(state, FULL_INPUTS.muzzleVelocity);
  assert.ok(result);
  assert.equal(result.twistDirection, 'left');
  assert.ok(result.sg > 0);
});

test('resolveSpinDrift defaults twistDirection to right when absent', () => {
  const state = { calculateSpinDrift: true, ...FULL_INPUTS };
  const result = resolveSpinDrift(state, FULL_INPUTS.muzzleVelocity);
  assert.equal(result.twistDirection, 'right');
});
