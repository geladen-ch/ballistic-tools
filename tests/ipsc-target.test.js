import test from 'node:test';
import assert from 'node:assert/strict';
import { erf } from '../src/engine/target-shapes.js';
import { hitProbability as targetHitProbability } from '../src/targets/ipsc-target.js';
import { hitProbability as miniTargetHitProbability } from '../src/targets/ipsc-target-mini.js';

// An independent (non-quadrature) ground truth: a plain fine-grained
// Riemann sum in y, re-deriving each zone's own taper/flat/taper profile
// from scratch. `points` is the same [y, halfWidth] list the source
// modules pass to polylineHalfWidth. Used to cross-check
// profileHitProbability's composite quadrature for a genuinely different
// shape family (multi-segment polylines, not a taper+circle union).
function bruteForceZone(points, topY, sdX, sdY, offsetX, rawOffsetY, steps = 200000) {
  const halfWidthAt = (y) => {
    if (y < points[0][0] || y > points[points.length - 1][0]) return 0;
    for (let i = 1; i < points.length; i++) {
      const [y1, hw1] = points[i];
      if (y <= y1) {
        const [y0, hw0] = points[i - 1];
        const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
        return hw0 + t * (hw1 - hw0);
      }
    }
    return 0;
  };
  const dy = topY / steps;
  const sqrt2 = Math.sqrt(2);
  let total = 0;
  for (let i = 0; i < steps; i++) {
    const y = (i + 0.5) * dy;
    const hw = halfWidthAt(y);
    if (hw <= 0) continue;
    const probX = (erf((hw - offsetX) / sdX / sqrt2) - erf((-hw - offsetX) / sdX / sqrt2)) / 2;
    const z = (y - rawOffsetY) / sdY;
    const densityY = Math.exp(-0.5 * z * z) / (sdY * Math.sqrt(2 * Math.PI));
    total += probX * densityY * dy;
  }
  return total;
}

const STANDARD = {
  topY: 57,
  centerY: (2.5 + 35) / 2,
  D: [[0, 7.5], [19, 22.5], [38, 22.5], [57, 7.5]],
  C: [[0, 7.5], [19, 15], [33.5, 15], [45, 5]],
  A: [[2.5, 2.5], [19, 7.5], [27.5, 7.5], [35, 2.5]]
};
const MINI = {
  topY: 37.5,
  centerY: (1.5 + 23) / 2,
  D: [[0, 5], [12.5, 15], [25, 15], [37.5, 5]],
  C: [[0, 5], [12.5, 10], [22, 10], [30, 3.5]],
  A: [[1.5, 2], [12.5, 5], [18, 5], [23, 2]]
};

function bruteForceZones(geom, sdX, sdY, offsetX, offsetY) {
  const rawOffsetY = geom.centerY - offsetY;
  const pA = bruteForceZone(geom.A, geom.topY, sdX, sdY, offsetX, rawOffsetY);
  const pC = bruteForceZone(geom.C, geom.topY, sdX, sdY, offsetX, rawOffsetY);
  const pD = bruteForceZone(geom.D, geom.topY, sdX, sdY, offsetX, rawOffsetY);
  return { a: pA, c: pC - pA, d: pD - pC };
}

test('ipsc-target: dead-center on the A-zone (offsetY=0) with negligible dispersion scores ~all in zone A', () => {
  const zones = targetHitProbability(0.5, 0.5, 0, 0);
  assert.deepEqual(zones.map((z) => z.zoneId), ['a', 'c', 'd']);
  assert.ok(zones[0].probability > 0.999, `expected ~1 in A, got ${zones[0].probability}`);
});

test('ipsc-target: zone probabilities are never negative across a range of dispersions and offsets', () => {
  const cases = [[3, 3, 0, 0], [10, 10, 0, 0], [15, 20, 5, -8], [1, 30, 0, 15], [30, 1, 10, 0], [50, 50, 0, 0]];
  for (const [sdX, sdY, offsetX, offsetY] of cases) {
    const zones = targetHitProbability(sdX, sdY, offsetX, offsetY);
    for (const z of zones) {
      assert.ok(z.probability >= -1e-9, `zone ${z.zoneId} went negative (${z.probability}) at sdX=${sdX} sdY=${sdY} offsetX=${offsetX} offsetY=${offsetY}`);
    }
  }
});

test('ipsc-target: hit probability is exactly symmetric under mirroring offsetX', () => {
  const left = targetHitProbability(4, 4, -7, 3);
  const right = targetHitProbability(4, 4, 7, 3);
  for (let i = 0; i < left.length; i++) {
    assert.ok(Math.abs(left[i].probability - right[i].probability) < 1e-9, `zone ${left[i].zoneId} not symmetric`);
  }
});

test('ipsc-target: a shot far off-target scores ~zero everywhere', () => {
  const zones = targetHitProbability(1, 1, 500, 0);
  for (const z of zones) assert.ok(z.probability < 1e-6, `zone ${z.zoneId} expected ~0, got ${z.probability}`);
});

test('ipsc-target: matches an independent brute-force integral across a spread of dispersions/offsets', () => {
  const cases = [[3, 3, 0, 0], [8, 8, 2, -3], [5, 12, -4, 6], [15, 6, 3, -10], [2, 2, 1, 1]];
  for (const [sdX, sdY, offsetX, offsetY] of cases) {
    const impl = targetHitProbability(sdX, sdY, offsetX, offsetY);
    const brute = bruteForceZones(STANDARD, sdX, sdY, offsetX, offsetY);
    for (const z of impl) {
      assert.ok(Math.abs(z.probability - brute[z.zoneId]) < 1e-4,
        `zone ${z.zoneId} sdX=${sdX} sdY=${sdY} offsetX=${offsetX} offsetY=${offsetY}: expected ~${brute[z.zoneId]}, got ${z.probability}`);
    }
  }
});

test('ipsc-target-mini: dead-center on the A-zone with negligible dispersion scores ~all in zone A', () => {
  const zones = miniTargetHitProbability(0.3, 0.3, 0, 0);
  assert.ok(zones[0].probability > 0.999, `expected ~1 in A, got ${zones[0].probability}`);
});

test('ipsc-target-mini: zone probabilities are never negative across a range of dispersions and offsets', () => {
  const cases = [[2, 2, 0, 0], [8, 8, 0, 0], [10, 15, 3, -5], [20, 20, 0, 0]];
  for (const [sdX, sdY, offsetX, offsetY] of cases) {
    const zones = miniTargetHitProbability(sdX, sdY, offsetX, offsetY);
    for (const z of zones) {
      assert.ok(z.probability >= -1e-9, `zone ${z.zoneId} went negative (${z.probability})`);
    }
  }
});

test('ipsc-target-mini: matches an independent brute-force integral across a spread of dispersions/offsets', () => {
  const cases = [[2, 2, 0, 0], [5, 5, 1, -2], [3, 8, -2, 3], [10, 4, 2, -6]];
  for (const [sdX, sdY, offsetX, offsetY] of cases) {
    const impl = miniTargetHitProbability(sdX, sdY, offsetX, offsetY);
    const brute = bruteForceZones(MINI, sdX, sdY, offsetX, offsetY);
    for (const z of impl) {
      assert.ok(Math.abs(z.probability - brute[z.zoneId]) < 1e-4,
        `zone ${z.zoneId} sdX=${sdX} sdY=${sdY} offsetX=${offsetX} offsetY=${offsetY}: expected ~${brute[z.zoneId]}, got ${z.probability}`);
    }
  }
});

test('ipsc-target is bigger than ipsc-target-mini: same wide dispersion scores strictly higher total hit probability on the full target', () => {
  const sum = (zones) => zones.reduce((s, z) => s + z.probability, 0);
  const full = sum(targetHitProbability(20, 20, 0, 0));
  const mini = sum(miniTargetHitProbability(20, 20, 0, 0));
  assert.ok(full > mini, `expected full (${full}) > mini (${mini})`);
});
