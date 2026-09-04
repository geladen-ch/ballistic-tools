import test from 'node:test';
import assert from 'node:assert/strict';
import {
  erf, rectangleHitProbability, circleHitProbability,
  gaussLegendreNodes, profileHitProbability,
  polylineHalfWidth, circularArcHalfWidth, unionHalfWidth
} from '../src/engine/target-shapes.js';

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

test('gaussLegendreNodes: weights sum to 2 (the length of [-1,1])', () => {
  for (const n of [2, 5, 8, 24, 33]) {
    const { weights } = gaussLegendreNodes(n);
    assert.equal(weights.length, n);
    const sum = weights.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 2) < 1e-10, `n=${n}: expected weight sum 2, got ${sum}`);
  }
});

test('gaussLegendreNodes: nodes are sorted, symmetric about 0, within (-1,1)', () => {
  for (const n of [2, 5, 8, 24]) {
    const { nodes } = gaussLegendreNodes(n);
    for (let i = 1; i < nodes.length; i++) assert.ok(nodes[i] > nodes[i - 1]);
    for (const x of nodes) assert.ok(x > -1 && x < 1);
    for (let i = 0; i < nodes.length; i++) {
      assert.ok(Math.abs(nodes[i] + nodes[nodes.length - 1 - i]) < 1e-12);
    }
  }
});

test('gaussLegendreNodes: integrates x^2 over [-1,1] exactly (=2/3) for n>=2', () => {
  const { nodes, weights } = gaussLegendreNodes(4);
  let sum = 0;
  for (let i = 0; i < nodes.length; i++) sum += weights[i] * nodes[i] * nodes[i];
  assert.ok(Math.abs(sum - 2 / 3) < 1e-12);
});

test('polylineHalfWidth interpolates linearly and is 0 outside its range', () => {
  const hw = polylineHalfWidth([[0, 10], [10, 20], [20, 20]]);
  assert.equal(hw(-1), 0);
  assert.equal(hw(21), 0);
  assert.equal(hw(0), 10);
  assert.equal(hw(5), 15);
  assert.equal(hw(10), 20);
  assert.equal(hw(15), 20);
});

test('circularArcHalfWidth traces a circle and is 0 outside [cy-r, cy+r]', () => {
  const hw = circularArcHalfWidth(100, 5);
  assert.ok(Math.abs(hw(100) - 5) < 1e-12);
  assert.ok(Math.abs(hw(103) - 4) < 1e-12); // 3-4-5 triangle
  assert.equal(hw(94), 0);
  assert.equal(hw(106), 0);
});

test('unionHalfWidth takes the pointwise max of its profiles', () => {
  const a = polylineHalfWidth([[0, 10], [10, 0]]);
  const b = polylineHalfWidth([[0, 0], [10, 10]]);
  const u = unionHalfWidth(a, b);
  assert.equal(u(0), 10);
  assert.equal(u(10), 10);
  assert.ok(Math.abs(u(5) - 5) < 1e-12);
});

test('profileHitProbability of a constant-width band matches rectangleHitProbability', () => {
  // A profile with no taper (same half-width top and bottom) over [y0,y0+h]
  // is exactly the rectangle [-hw,hw] x [y0,y0+h] — cross-checks the new
  // quadrature-based primitive against the existing erf-product one.
  const hw = polylineHalfWidth([[-5, 3], [8, 3]]);
  const viaProfile = profileHitProbability(hw, -5, 8, 1.3, 0.9, 0.4, -0.2);
  const viaRectangle = rectangleHitProbability(-3, -5, 6, 13, 1.3, 0.9, 0.4, -0.2);
  assert.ok(Math.abs(viaProfile - viaRectangle) < 1e-6, `expected ${viaRectangle}, got ${viaProfile}`);
});

test('profileHitProbability of a full circular profile is close to the exact Rayleigh CDF (equal SD, no offset)', () => {
  // Unlike circleHitProbability (equal-area square approximation), this
  // integrates the true circular boundary, so it should track the exact
  // closed form far more tightly than that primitive's own ~2% tolerance.
  for (const [r, sd] of [[1, 1], [2, 1], [0.5, 1], [3, 2]]) {
    const hw = circularArcHalfWidth(0, r);
    const approx = profileHitProbability(hw, -r, r, sd, sd);
    const exact = 1 - Math.exp(-(r * r) / (2 * sd * sd));
    assert.ok(Math.abs(approx - exact) < 1e-3, `r=${r} sd=${sd}: expected ~${exact}, got ${approx}`);
  }
});

test('profileHitProbability: a dispersion much tighter than the shape captures ~all the probability', () => {
  // Unlike rectangleHitProbability/circleHitProbability (unbounded erf
  // domain, so a huge window trivially captures ~everything), this
  // primitive integrates only over the shape's own finite [yMin,yMax] — so
  // the analogous "captures everything" case is a shape much larger than
  // the dispersion, not an artificially huge integration domain (which a
  // fixed 24-node quadrature can't resolve against a narrow Gaussian bump).
  const hw = polylineHalfWidth([[-50, 50], [50, 50]]);
  const p = profileHitProbability(hw, -50, 50, 0.01, 0.01);
  // Bounded by erf's own ~1.2e-7 rational-approximation precision (see erf's
  // doc comment above), not by the quadrature itself.
  assert.ok(Math.abs(p - 1) < 1e-6, `expected ~1, got ${p}`);
});

test('profileHitProbability: a profile far from the dispersion mean captures ~none of it', () => {
  const hw = polylineHalfWidth([[99, 1], [101, 1]]);
  const p = profileHitProbability(hw, 99, 101, 1, 1);
  assert.ok(p < 1e-9, `expected ~0, got ${p}`);
});

test('profileHitProbability: offsetX/offsetY shift the dispersion mean, not the shape', () => {
  const hw = circularArcHalfWidth(0, 2);
  const centered = profileHitProbability(hw, -2, 2, 1, 1);
  const shiftedHw = circularArcHalfWidth(-9, 2);
  const shifted = profileHitProbability(shiftedHw, -11, -7, 1, 1, 4, -9, 4);
  assert.ok(Math.abs(centered - shifted) < 1e-9);
});
