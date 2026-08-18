import test from 'node:test';
import assert from 'node:assert/strict';
import { erf, rectangleHitProbability, circleHitProbability } from '../src/engine/target-shapes.js';

test('erf matches known reference values to 1e-6', () => {
  // The rational approximation is documented precise to ~1.2e-7 — even at
  // v=0, where the true value is exact, so this uses the same tolerance
  // as every other reference value here rather than an exact match.
  assert.ok(Math.abs(erf(0) - 0) < 1e-6);
  assert.ok(Math.abs(erf(0.5) - 0.5204998778130465) < 1e-6);
  assert.ok(Math.abs(erf(1) - 0.8427007929497149) < 1e-6);
  assert.ok(Math.abs(erf(2) - 0.9953222650189527) < 1e-6);
});

test('erf is odd: erf(-v) === -erf(v)', () => {
  for (const v of [0.1, 0.5, 1, 2, 3.7]) {
    assert.ok(Math.abs(erf(-v) + erf(v)) < 1e-9, `erf(-${v}) should be -erf(${v})`);
  }
});

test('rectangleHitProbability: the classic "one sigma" 1D interval is ~68.27% per axis', () => {
  // A square window spanning exactly [-sd, +sd] on both axes, no offset —
  // each axis independently captures the well-known 68.27% "1 sigma" mass,
  // so the joint probability is that fraction squared.
  const p = rectangleHitProbability(-1, -1, 2, 2, 1, 1);
  const oneSigma = 0.6826894921370859;
  assert.ok(Math.abs(p - oneSigma * oneSigma) < 1e-6, `expected ${oneSigma * oneSigma}, got ${p}`);
});

test('rectangleHitProbability: a window many SDs wide captures ~all the probability', () => {
  const p = rectangleHitProbability(-1e6, -1e6, 2e6, 2e6, 1, 1);
  assert.ok(Math.abs(p - 1) < 1e-9);
});

test('rectangleHitProbability: a window far from the dispersion mean captures ~none of it', () => {
  const p = rectangleHitProbability(100, 100, 1, 1, 1, 1);
  assert.ok(p < 1e-9, `expected ~0, got ${p}`);
});

test('rectangleHitProbability: offsetX/offsetY shift the dispersion mean, not the rectangle', () => {
  // Centering the rectangle on the (nonzero) offset should reproduce the
  // same "1 sigma" result as the zero-offset case above.
  const p = rectangleHitProbability(4, -9, 2, 2, 1, 1, 5, -8);
  const oneSigma = 0.6826894921370859;
  assert.ok(Math.abs(p - oneSigma * oneSigma) < 1e-6, `expected ${oneSigma * oneSigma}, got ${p}`);
});

test('rectangleHitProbability is symmetric between X and Y when the inputs are', () => {
  const p1 = rectangleHitProbability(-2, -3, 4, 6, 1.5, 2, 0.3, -0.4);
  const p2 = rectangleHitProbability(-3, -2, 6, 4, 2, 1.5, -0.4, 0.3);
  assert.ok(Math.abs(p1 - p2) < 1e-12);
});

test('circleHitProbability (equal-SD, no offset) is close to the exact Rayleigh CDF', () => {
  // circleHitProbability approximates the circle as an equal-area square,
  // so it isn't exact — but for the equal-SD, zero-offset case there's an
  // exact closed form to check it against: P(within R) = 1 - exp(-R^2 /
  // (2*sd^2)) (the Rayleigh CDF). This catches a transcription slip (wrong
  // factor of 2, r vs r/2, missing sqrt(pi), ...) while still tolerating
  // the approximation's own inherent error.
  for (const [r, sd] of [[1, 1], [2, 1], [0.5, 1], [3, 2]]) {
    const approx = circleHitProbability(0, 0, r, sd, sd);
    const exact = 1 - Math.exp(-(r * r) / (2 * sd * sd));
    assert.ok(Math.abs(approx - exact) < 0.02, `r=${r} sd=${sd}: expected ~${exact}, got ${approx}`);
  }
});

test('circleHitProbability: a circle many SDs wide captures ~all the probability', () => {
  const p = circleHitProbability(0, 0, 1e6, 1, 1);
  assert.ok(Math.abs(p - 1) < 1e-9);
});

test('circleHitProbability: a circle far from the dispersion mean captures ~none of it', () => {
  const p = circleHitProbability(100, 100, 1, 1, 1);
  assert.ok(p < 1e-9, `expected ~0, got ${p}`);
});

test('circleHitProbability: offsetX/offsetY shift the dispersion mean, not the circle', () => {
  const centered = circleHitProbability(0, 0, 2, 1, 1);
  const shifted = circleHitProbability(4, -9, 2, 1, 1, 4, -9);
  assert.ok(Math.abs(centered - shifted) < 1e-9);
});

test('circleHitProbability is symmetric under swapping X and Y', () => {
  const p1 = circleHitProbability(3, -2, 5, 1.5, 2, 0.3, -0.4);
  const p2 = circleHitProbability(-2, 3, 5, 2, 1.5, -0.4, 0.3);
  assert.ok(Math.abs(p1 - p2) < 1e-12);
});
