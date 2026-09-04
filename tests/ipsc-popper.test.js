import test from 'node:test';
import assert from 'node:assert/strict';
import { erf } from '../src/engine/target-shapes.js';
import { hitProbability as popperHitProbability } from '../src/targets/ipsc-popper.js';
import { hitProbability as miniPopperHitProbability } from '../src/targets/ipsc-popper-mini.js';

// An independent (non-quadrature) ground truth for the popper's own
// geometry: a plain fine-grained Riemann sum in y, re-deriving the taper/
// circle union from scratch rather than importing anything from
// target-shapes.js or ipsc-popper.js. Used to cross-check
// profileHitProbability's composite quadrature — in particular the case
// that first exposed it under-resolving a shape's taper/circle kink when
// an off-axis offsetX made the per-row probability curve steep right at
// that kink (fixed by splitting the quadrature at the shape's own
// declared breakpoints — see target-shapes.js's profileHitProbability).
// Works in the geometry's own base-relative y (base=0), unlike
// hitProbability() itself, whose public y=0 is the circular head's own
// center (see toPublicOffsetY below) — the natural real-world point of aim.
function bruteForcePopper(r, cy, chordHalfWidth, baseHalfWidth, topY, sdX, sdY, offsetX, rawOffsetY, steps = 200000) {
  const chordY = cy - Math.sqrt(r * r - chordHalfWidth * chordHalfWidth);
  const halfWidthAt = (y) => {
    const taper = (y >= 0 && y <= chordY) ? baseHalfWidth + (chordHalfWidth - baseHalfWidth) * (y / chordY) : 0;
    const dy = y - cy;
    const arc = Math.abs(dy) <= r ? Math.sqrt(r * r - dy * dy) : 0;
    return Math.max(taper, arc);
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
const STANDARD_GEOMETRY = [15, 70, 10, 7.5, 85]; // r, cy, chordHalfWidth, baseHalfWidth, topY (cm)
const MINI_GEOMETRY = [10, 46, 6.75, 5, 56];
const STANDARD_CENTER_Y = 70; // cm, base to circle center (STANDARD_GEOMETRY's own cy)
const MINI_CENTER_Y = 46; // cm, base to circle center (MINI_GEOMETRY's own cy)

// hitProbability()'s own offsetY is relative to the circular head's own
// center, not the target's base — this converts a base-relative (raw)
// height, as used by bruteForcePopper and the source drawings, into the
// public offsetY hitProbability() itself expects.
const toPublicOffsetY = (rawOffsetY, centerY) => rawOffsetY - centerY;

test('ipsc-popper: a shot dead-center on the head with a tiny SD is ~certain to hit', () => {
  const zones = popperHitProbability(0.5, 0.5, 0, toPublicOffsetY(75, STANDARD_CENTER_Y));
  assert.equal(zones.length, 1);
  assert.equal(zones[0].zoneId, 'hit');
  assert.ok(zones[0].probability > 0.999, `expected ~1, got ${zones[0].probability}`);
});

test('ipsc-popper: a shot dead-center on the base with a tiny SD is ~certain to hit', () => {
  const zones = popperHitProbability(0.3, 0.3, 0, toPublicOffsetY(5, STANDARD_CENTER_Y));
  assert.ok(zones[0].probability > 0.999, `expected ~1, got ${zones[0].probability}`);
});

test('ipsc-popper: a shot dead-center at y=0 (the circular head\'s own center) with a tiny SD is ~certain to hit', () => {
  const zones = popperHitProbability(0.3, 0.3, 0, 0);
  assert.ok(zones[0].probability > 0.999, `expected ~1, got ${zones[0].probability}`);
});

test('ipsc-popper: a shot far off-target is ~certain to miss', () => {
  const zones = popperHitProbability(1, 1, 500, 0);
  assert.ok(zones[0].probability < 1e-6, `expected ~0, got ${zones[0].probability}`);
});

test('ipsc-popper: a shot well below the base is ~certain to miss', () => {
  const zones = popperHitProbability(1, 1, 0, toPublicOffsetY(-100, STANDARD_CENTER_Y));
  assert.ok(zones[0].probability < 1e-6, `expected ~0, got ${zones[0].probability}`);
});

test('ipsc-popper: hit probability is exactly symmetric under mirroring offsetX (target is symmetric about x=0)', () => {
  const left = popperHitProbability(3, 3, -6, 0)[0].probability;
  const right = popperHitProbability(3, 3, 6, 0)[0].probability;
  assert.ok(Math.abs(left - right) < 1e-9, `expected equal, got ${left} vs ${right}`);
});

test('ipsc-popper: a very large SD spanning the whole target caps out below 1 (finite target)', () => {
  const zones = popperHitProbability(1000, 1000, 0, 0);
  assert.ok(zones[0].probability < 1, `expected <1, got ${zones[0].probability}`);
  assert.ok(zones[0].probability > 0);
});

test('ipsc-popper-mini: scales down consistently with the full popper (tiny SD, centered on the head, ~certain hit)', () => {
  const zones = miniPopperHitProbability(0.3, 0.3, 0, toPublicOffsetY(50, MINI_CENTER_Y));
  assert.ok(zones[0].probability > 0.999, `expected ~1, got ${zones[0].probability}`);
});

test('ipsc-popper-mini: is smaller than the full popper end-to-end (same SD/offset lands fewer hits on the mini)', () => {
  // With a dispersion wide relative to both targets' size, the physically
  // smaller mini popper should capture strictly less probability mass.
  const full = popperHitProbability(15, 15, 0, 0)[0].probability;
  const mini = miniPopperHitProbability(15, 15, 0, 0)[0].probability;
  assert.ok(mini < full, `expected mini (${mini}) < full (${full})`);
});

test('ipsc-popper: an off-axis mean whose narrow dispersion straddles the taper/circle kink matches an independent brute-force integral', () => {
  // Regression case: offsetX far enough off-axis to make the per-row X
  // probability curve steep right where the taper meets the circle
  // (~58.8cm up) used to be off by ~4e-4 with a single quadrature panel
  // across the whole shape — profileHitProbability now splits at the
  // shape's own declared breakpoints instead.
  const impl = popperHitProbability(2, 2, -15, toPublicOffsetY(60, STANDARD_CENTER_Y))[0].probability;
  const brute = bruteForcePopper(...STANDARD_GEOMETRY, 2, 2, -15, 60);
  assert.ok(Math.abs(impl - brute) < 1e-6, `expected ~${brute}, got ${impl}`);
});

test('ipsc-popper: matches an independent brute-force integral across a spread of off-axis means and dispersions', () => {
  const cases = [
    [3, 3, 20, 40], [3, 3, -20, 40], [10, 10, 30, 20], [2, 2, -15, 60],
    [5, 5, 9, 5], [4, 6, -12, 80], [1.5, 8, 8, 65], [6, 2, -5, 10]
  ];
  for (const [sdX, sdY, offsetX, rawOffsetY] of cases) {
    const impl = popperHitProbability(sdX, sdY, offsetX, toPublicOffsetY(rawOffsetY, STANDARD_CENTER_Y))[0].probability;
    const brute = bruteForcePopper(...STANDARD_GEOMETRY, sdX, sdY, offsetX, rawOffsetY);
    assert.ok(Math.abs(impl - brute) < 1e-4,
      `sdX=${sdX} sdY=${sdY} offsetX=${offsetX} rawOffsetY=${rawOffsetY}: expected ~${brute}, got ${impl}`);
  }
});

test('ipsc-popper-mini: matches an independent brute-force integral across a spread of off-axis means and dispersions', () => {
  const cases = [[2, 2, -10, 40], [1, 5, 5, 45], [4, 4, -6, 15]];
  for (const [sdX, sdY, offsetX, rawOffsetY] of cases) {
    const impl = miniPopperHitProbability(sdX, sdY, offsetX, toPublicOffsetY(rawOffsetY, MINI_CENTER_Y))[0].probability;
    const brute = bruteForcePopper(...MINI_GEOMETRY, sdX, sdY, offsetX, rawOffsetY);
    assert.ok(Math.abs(impl - brute) < 1e-4,
      `sdX=${sdX} sdY=${sdY} offsetX=${offsetX} rawOffsetY=${rawOffsetY}: expected ~${brute}, got ${impl}`);
  }
});
