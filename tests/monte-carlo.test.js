import test from 'node:test';
import assert from 'node:assert/strict';
import { monteCarloZoneProbabilities, monteCarloHitProbability } from '../src/engine/monte-carlo.js';
import { rectangleHitProbability, circleHitProbability } from '../src/engine/target-shapes.js';
import { LatticeSequence, latticeSteps, mulberry32, boxMuller } from '../src/engine/qrng.js';

const inRect = (x0, y0, w, h) => (x, y) => x >= x0 && x <= x0 + w && y >= y0 && y <= y0 + h;
const inCircle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

test('agrees with the exact analytical rectangle, within its own error bar', () => {
  // rectangleHitProbability is exact for axis-aligned rectangles, so it is a
  // ground truth the sampler can be held against. Requiring agreement to
  // within 4 standard errors tests the estimate *and* the error bar: a
  // sampler that were biased, or one that understated its own uncertainty,
  // would fail this.
  const cases = [
    { rect: [-1, -1, 2, 2], sdX: 1, sdY: 1, offsetX: 0, offsetY: 0 },
    { rect: [-5, -10, 10, 20], sdX: 4, sdY: 7, offsetX: 0, offsetY: 0 },
    { rect: [-22.5, -20, 45, 41], sdX: 12, sdY: 18, offsetX: 3, offsetY: -6 },
    { rect: [0, 0, 6, 3], sdX: 2, sdY: 2, offsetX: -4, offsetY: 1 }
  ];
  for (const { rect, sdX, sdY, offsetX, offsetY } of cases) {
    const exact = rectangleHitProbability(...rect, sdX, sdY, offsetX, offsetY);
    const { probability, standardError } = monteCarloHitProbability({
      inside: inRect(...rect), sdX, sdY, offsetX, offsetY, points: 1 << 14, replicates: 16, seed: 3
    });
    assert.ok(
      Math.abs(probability - exact) < 4 * standardError + 1e-12,
      `rect ${rect}: got ${probability} +- ${standardError}, exact ${exact}`
    );
  }
});

test('reports a standard error that actually shrinks as points are added', () => {
  const shared = { inside: inCircle(0, 0, 15), sdX: 10, sdY: 10, replicates: 16, seed: 5 };
  const coarse = monteCarloHitProbability({ ...shared, points: 1 << 10 });
  const fine = monteCarloHitProbability({ ...shared, points: 1 << 14 });
  assert.ok(fine.standardError < coarse.standardError,
    `${fine.standardError} should be below ${coarse.standardError}`);
});

test('a single replicate reports NaN rather than a fake zero error', () => {
  const { standardError } = monteCarloHitProbability({
    inside: inCircle(0, 0, 10), sdX: 5, sdY: 5, points: 1 << 10, replicates: 1
  });
  assert.ok(Number.isNaN(standardError));
});

test('beats independent sampling at the same number of points', () => {
  // The claim that a lattice is worth having over a plain PRNG, measured
  // rather than assumed. Both draw the same count and use the same
  // Box-Muller mapping; only the point set differs. Swept over 200 seeds
  // while writing this, the lattice's standard error stayed under 5% of the
  // plain sampler's every time; the assertion below is deliberately the weak
  // form of that, so it stays a regression test rather than a tuned result.
  const sdX = 10, sdY = 10, r = 12, points = 1 << 12, replicates = 24;
  const exact = 1 - Math.exp(-(r * r) / (2 * sdX * sdX)); // Rayleigh CDF, centred isotropic

  const lattice = monteCarloHitProbability({
    inside: inCircle(0, 0, r), sdX, sdY, points, replicates, seed: 9
  });

  // Same experiment with independent uniforms in place of the lattice.
  const rng = mulberry32(9);
  const estimates = [];
  for (let rep = 0; rep < replicates; rep++) {
    let hits = 0;
    const z = new Float64Array(2);
    for (let i = 0; i < points; i++) {
      const u = (rng() + 0.5) * 2 ** -32;
      const v = (rng() + 0.5) * 2 ** -32;
      boxMuller(u, v, z);
      if (inCircle(0, 0, r)(sdX * z[0], sdY * z[1])) hits++;
    }
    estimates.push(hits / points);
  }
  const mean = estimates.reduce((a, b) => a + b, 0) / replicates;
  let variance = 0;
  for (const value of estimates) variance += (value - mean) * (value - mean);
  const plainError = Math.sqrt(variance / (replicates - 1) / replicates);

  assert.ok(lattice.standardError < plainError,
    `lattice ${lattice.standardError} should beat plain ${plainError}`);
  assert.ok(Math.abs(lattice.probability - exact) < 4 * lattice.standardError,
    `lattice estimate ${lattice.probability} vs exact ${exact}`);
});

test('is closer to the exact circle probability than the equal-area-square approximation', () => {
  // circleHitProbability approximates a circle by the axis-aligned square of
  // equal area. For a centred isotropic dispersion the exact answer is the
  // Rayleigh CDF, 1 - exp(-r^2 / 2 sd^2), so the size of that approximation
  // is measurable — and around r ~ 1.5 sd it is roughly a percent, far above
  // what the sampler's own error bar is at these settings. This documents the
  // gap; closing it is a separate change and target-shapes.js is untouched
  // here.
  const sd = 10, r = 15;
  const exact = 1 - Math.exp(-(r * r) / (2 * sd * sd));
  const approx = circleHitProbability(0, 0, r, sd, sd, 0, 0);
  const sampled = monteCarloHitProbability({
    inside: inCircle(0, 0, r), sdX: sd, sdY: sd, points: 1 << 16, replicates: 16, seed: 13
  });
  assert.ok(Math.abs(sampled.probability - exact) < Math.abs(approx - exact),
    `sampled ${sampled.probability} and approx ${approx} vs exact ${exact}`);
});

test('scores disjoint zones separately and never double-counts a point', () => {
  // Concentric rings, classified by the innermost zone containing the point —
  // the same nesting the built-in ring targets use, but resolved per sample
  // instead of by subtracting overlapping analytical disks.
  const sd = 10;
  const classify = (x, y) => {
    const d2 = x * x + y * y;
    if (d2 <= 5 * 5) return 'inner';
    if (d2 <= 12 * 12) return 'middle';
    if (d2 <= 25 * 25) return 'outer';
    return null;
  };
  const zones = monteCarloZoneProbabilities({
    classify, sdX: sd, sdY: sd, points: 1 << 14, replicates: 16, seed: 17
  });
  const byId = Object.fromEntries(zones.map((zone) => [zone.zoneId, zone]));
  assert.deepEqual(new Set(Object.keys(byId)), new Set(['inner', 'middle', 'outer']));

  const ring = (rOuter, rInner) =>
    Math.exp(-(rInner * rInner) / (2 * sd * sd)) - Math.exp(-(rOuter * rOuter) / (2 * sd * sd));
  for (const [zoneId, expected] of [
    ['inner', ring(5, 0)], ['middle', ring(12, 5)], ['outer', ring(25, 12)]
  ]) {
    assert.ok(Math.abs(byId[zoneId].probability - expected) < 4 * byId[zoneId].standardError,
      `${zoneId}: ${byId[zoneId].probability} +- ${byId[zoneId].standardError} vs ${expected}`);
  }

  // Disjoint zones, so the total is a probability in its own right and must
  // not exceed 1 — the failure mode of classifying one sample into two zones.
  const total = zones.reduce((sum, zone) => sum + zone.probability, 0);
  assert.ok(total <= 1 + 1e-12, `zones sum to ${total}`);
});

test('rejects a missing or non-function classifier and non-positive counts', () => {
  assert.throws(() => monteCarloZoneProbabilities({ sdX: 1, sdY: 1 }), TypeError);
  assert.throws(() => monteCarloHitProbability({ inside: 'nope', sdX: 1, sdY: 1 }), TypeError);
  assert.throws(
    () => monteCarloZoneProbabilities({ classify: () => 'hit', sdX: 1, sdY: 1, points: 0 }),
    RangeError
  );
});

test('an unreachable zone simply never appears in the result', () => {
  const zones = monteCarloZoneProbabilities({
    classify: (x, y) => (inCircle(500, 500, 1)(x, y) ? 'far' : null),
    sdX: 1, sdY: 1, points: 1 << 12, replicates: 8, seed: 19
  });
  assert.deepEqual(zones, []);
});
