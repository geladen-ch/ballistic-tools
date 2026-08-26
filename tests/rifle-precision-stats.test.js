import test from 'node:test';
import assert from 'node:assert/strict';

const {
  computeScale, computeGroupStats, computeCombinedStats,
  hitProbabilityRadiusMm, confidenceLevel, confidenceScaleFraction, mmToAngularUnit, oneMoaWidthMm, oneMradWidthMm,
  targetUsabilityGaps
} = await import('../src/engine/rifle-precision-stats.js');
const { RAYLEIGH_COEFF, CONF_LOWER, CONF_UPPER, TDIST_QUANTILE } = await import('../src/engine/rifle-precision-constants.js');

function closeTo(actual, expected, tolerance, msg) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${msg}: expected ${expected}, got ${actual}`);
}

function makeTarget(overrides = {}) {
  return {
    id: 't1', name: 'Target', notes: '', photo: null,
    photoWidth: 1000, photoHeight: 1000,
    calibration: { point1: { x: 0, y: 0.5 }, point2: { x: 1, y: 0.5 }, realLengthMm: 100 }, // scale = 1000px / 100mm = 10 px/mm
    groups: [],
    ...overrides
  };
}

test('computeScale: 1000px across 100mm gives 10 px/mm', () => {
  assert.equal(computeScale(makeTarget()), 10);
});

test('computeScale: returns null when calibration is incomplete or degenerate', () => {
  assert.equal(computeScale(makeTarget({ calibration: { point1: null, point2: null, realLengthMm: null } })), null);
  assert.equal(computeScale(makeTarget({ calibration: { point1: { x: 0, y: 0 }, point2: { x: 1, y: 0 }, realLengthMm: 0 } })), null);
  assert.equal(computeScale(makeTarget({ photoWidth: null })), null);
});

test('targetUsabilityGaps: a freshly-created target (no calibration, no groups) is missing all three', () => {
  assert.deepEqual(targetUsabilityGaps(makeTarget({ calibration: { point1: null, point2: null, realLengthMm: null } })), ['calibration', 'poa', 'impact']);
});

test('targetUsabilityGaps: calibrated with a group that has a POA but no shots yet is only missing "impact"', () => {
  const target = makeTarget({ groups: [{ id: 'g1', poa: { x: 0.5, y: 0.5 }, shots: [] }] });
  assert.deepEqual(targetUsabilityGaps(target), ['impact']);
});

test('targetUsabilityGaps: a group with shots but no POA (shouldn\'t normally happen, but the check is independent) still flags "poa"', () => {
  const target = makeTarget({ groups: [{ id: 'g1', poa: null, shots: [{ x: 0.5, y: 0.5 }] }] });
  assert.deepEqual(targetUsabilityGaps(target), ['poa']);
});

test('targetUsabilityGaps: fully calibrated with a POA and at least one shot in some group is usable (empty array)', () => {
  const target = makeTarget({
    groups: [
      { id: 'g1', poa: { x: 0.5, y: 0.5 }, shots: [] },
      { id: 'g2', poa: { x: 0.4, y: 0.4 }, shots: [{ x: 0.41, y: 0.41 }] }
    ]
  });
  assert.deepEqual(targetUsabilityGaps(target), [], 'POA and impact requirements only need to be met by *some* group, not every group');
});

test('targetUsabilityGaps: a degenerate (zero-length) calibration ruler still counts as missing calibration', () => {
  const target = makeTarget({
    calibration: { point1: { x: 0.5, y: 0.5 }, point2: { x: 0.5, y: 0.5 }, realLengthMm: 100 },
    groups: [{ id: 'g1', poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.5, y: 0.5 }] }]
  });
  assert.deepEqual(targetUsabilityGaps(target), ['calibration']);
});

test('computeGroupStats: extreme spread, pair indices, POI, and H/V offset for a hand-computed 3-shot group', () => {
  // scale = 10 px/mm, photo 1000x1000 -> poa at rel (0.5,0.5) = mm (50,50).
  // shot0 = poa exactly; shot1 = +1mm x; shot2 = -2mm y (up, since rel y grows downward).
  const target = makeTarget();
  const group = {
    id: 'g1',
    poa: { x: 0.5, y: 0.5 },
    shots: [
      { x: 0.5, y: 0.5 },
      { x: 0.51, y: 0.5 }, // +10px = +1mm x (scale is 10 px/mm)
      { x: 0.5, y: 0.48 }  // -20px = -2mm y
    ]
  };
  const stats = computeGroupStats(group, target);
  closeTo(stats.extremeSpreadMm, Math.sqrt(5), 1e-9, 'ES between shot1 (+1,0) and shot2 (0,-2mm from poa) = sqrt(1^2+2^2)');
  assert.deepEqual(stats.extremePairIndices, [1, 2]);
  closeTo(stats.poiMm.x, 50 + 1 / 3, 1e-9, 'POI x = mean of (0,+1,0) offsets from 50');
  closeTo(stats.poiMm.y, 50 - 2 / 3, 1e-9, 'POI y = mean of (0,0,-2) offsets from 50');
  closeTo(stats.hOffsetMm, 1 / 3, 1e-9, 'H offset = poi.x - poa.x');
  closeTo(stats.vOffsetMm, 2 / 3, 1e-9, 'V offset = poa.y - poi.y (up-positive)');
});

test('computeGroupStats: returns null with fewer than 2 shots or no scale/POA yet', () => {
  const target = makeTarget();
  assert.equal(computeGroupStats({ id: 'g1', poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.5, y: 0.5 }] }, target), null);
  assert.equal(computeGroupStats({ id: 'g1', poa: null, shots: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }] }, target), null);
  assert.equal(computeGroupStats({ id: 'g1', poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }] }, makeTarget({ calibration: { point1: null, point2: null, realLengthMm: null } })), null);
});

// Builds a project with one target/group whose shots produce exactly the
// given (x,y) mm offsets from the group's own POA, via the same
// scale=10px/mm, 1000x1000 photo as makeTarget() above.
function projectWithPooledOffsets(offsetsMm) {
  const scale = 10;
  const poaRel = { x: 0.5, y: 0.5 };
  const poaMm = { x: 500 / scale, y: 500 / scale }; // 50,50
  const shots = offsetsMm.map(([dx, dy]) => ({
    x: ((poaMm.x + dx) * scale) / 1000,
    y: ((poaMm.y + dy) * scale) / 1000
  }));
  return {
    id: 'p1', name: 'Project', distanceM: 100, caliberMm: 7.62,
    targets: [makeTarget({ groups: [{ id: 'g1', poa: poaRel, shots }] })],
    createdAt: '2020-01-01T00:00:00.000Z'
  };
}

test('computeCombinedStats: status is tooFewShots below 3 pooled shots, tooManyShots above 1000', () => {
  const few = computeCombinedStats(projectWithPooledOffsets([[1, 0], [-1, 0]]));
  assert.equal(few.status, 'tooFewShots');
  assert.equal(few.shotCount, 2);
  assert.equal(few.pooledShots.length, 2, 'pooled shots are still returned even when there are too few for sigma (CSV export needs them)');

  const offsets1001 = Array.from({ length: 1001 }, (_, i) => [i * 0.0001, 0]);
  const many = computeCombinedStats(projectWithPooledOffsets(offsets1001));
  assert.equal(many.status, 'tooManyShots');
  assert.equal(many.shotCount, 1001);
});

test('computeCombinedStats: n=3 pooled dispersion matches the Rayleigh/chi-square/t-quantile formulas evaluated independently', () => {
  // Pooled offsets from POA: (1,0), (-1,0), (0,0) mm.
  const project = projectWithPooledOffsets([[1, 0], [-1, 0], [0, 0]]);
  const result = computeCombinedStats(project);
  assert.equal(result.status, 'ok');
  assert.equal(result.shotCount, 3);

  const n = 3;
  const avgX = 0, avgY = 0; // (1 - 1 + 0)/3, (0+0+0)/3
  const vx = ((1 - 0) ** 2 + (-1 - 0) ** 2 + (0 - 0) ** 2) / (n - 1); // = 1
  const vy = 0;
  const v = (vx + vy) / 2; // 0.5
  const sigma = RAYLEIGH_COEFF[n] * Math.sqrt(v);
  const confidenceLower = (RAYLEIGH_COEFF[n] * Math.sqrt(CONF_LOWER[n] * v)) / sigma;
  const confidenceUpper = (RAYLEIGH_COEFF[n] * Math.sqrt(CONF_UPPER[n] * v)) / sigma;
  const tdistc = TDIST_QUANTILE[n] / Math.sqrt(n);

  closeTo(result.poiMm.x, avgX, 1e-9, 'pooled POI x');
  closeTo(result.poiMm.y, avgY, 1e-9, 'pooled POI y');
  closeTo(result.sigma, sigma, 1e-9, 'sigma');
  closeTo(result.confidenceLower, confidenceLower, 1e-9, 'confidenceLower');
  closeTo(result.confidenceUpper, confidenceUpper, 1e-9, 'confidenceUpper');
  closeTo(result.poiCiMm.x, Math.sqrt(vx) * tdistc, 1e-9, 'poiCi x');
  closeTo(result.poiCiMm.y, Math.sqrt(vy) * tdistc, 1e-9, 'poiCi y');
  closeTo(result.r50, sigma * 1.18, 1e-9, 'R50');
  closeTo(result.r95, sigma * 2.45, 1e-9, 'R95');
  closeTo(result.r95LowerBound, sigma * 2.45 * confidenceLower, 1e-9, 'R95 lower bound');
  closeTo(result.r95UpperBound, sigma * 2.45 * confidenceUpper, 1e-9, 'R95 upper bound');
  closeTo(result.r99, sigma * 3.03, 1e-9, 'R99');
  closeTo(result.d5x, sigma * 3.06, 1e-9, 'D5x');
  closeTo(result.d10x, sigma * 3.79, 1e-9, 'D10x');
});

test('computeCombinedStats: shots are re-centered per their own group POA before pooling', () => {
  // Two groups on the same target, aimed at very different POAs. If
  // pooling used absolute coordinates instead of per-group offsets, this
  // would show huge bogus dispersion; re-centered, it's identical to a
  // single group with these small offsets repeated twice.
  const scale = 10;
  const target = makeTarget({
    groups: [
      { id: 'g1', poa: { x: 0.2, y: 0.2 }, shots: [
        { x: 0.2 + 1 * scale / 1000, y: 0.2 },
        { x: 0.2 - 1 * scale / 1000, y: 0.2 },
        { x: 0.2, y: 0.2 }
      ] },
      { id: 'g2', poa: { x: 0.8, y: 0.8 }, shots: [
        { x: 0.8 + 1 * scale / 1000, y: 0.8 },
        { x: 0.8 - 1 * scale / 1000, y: 0.8 },
        { x: 0.8, y: 0.8 }
      ] }
    ]
  });
  const project = { id: 'p1', name: 'P', distanceM: 100, caliberMm: 7.62, targets: [target], createdAt: '2020-01-01T00:00:00.000Z' };
  const result = computeCombinedStats(project);
  assert.equal(result.status, 'ok');
  assert.equal(result.shotCount, 6);
  closeTo(result.poiMm.x, 0, 1e-9, 'pooled POI stays near zero across both re-centered groups');
  closeTo(result.poiMm.y, 0, 1e-9, 'pooled POI stays near zero across both re-centered groups');
});

test('hitProbabilityRadiusMm matches the Rayleigh-quantile formula directly, 0% giving a zero radius', () => {
  closeTo(hitProbabilityRadiusMm(5, 0), 0, 1e-9); // -0 for v=1 (log(1)=0), same magnitude as 0
  closeTo(hitProbabilityRadiusMm(2, 50), 2 * Math.sqrt(-Math.log(0.5 * 0.5)), 1e-9, '50%');
  closeTo(hitProbabilityRadiusMm(2, 99), 2 * Math.sqrt(-Math.log(0.01 * 0.01)), 1e-9, '99%');
});

test('confidenceLevel scans the 8 thresholds in the same order as legacy CONFI_LEVELS', () => {
  assert.equal(confidenceLevel(0, 0.6), 0, '>0.5 -> level 0 (Useless)');
  assert.equal(confidenceLevel(0, 0.49), 1, '(0.45,0.5] -> level 1');
  assert.equal(confidenceLevel(0, 0.42), 2, '(0.4,0.45] -> level 2');
  assert.equal(confidenceLevel(0, 0.37), 3, '(0.35,0.4] -> level 3');
  assert.equal(confidenceLevel(0, 0.32), 4, '(0.3,0.35] -> level 4');
  assert.equal(confidenceLevel(0, 0.27), 5, '(0.25,0.3] -> level 5');
  assert.equal(confidenceLevel(0, 0.22), 6, '(0.2,0.25] -> level 6');
  assert.equal(confidenceLevel(0, 0.1), 7, '<=0.2 -> level 7 (Awesome)');
});

test('confidenceScaleFraction: continuous 0..1, clamped beyond ci=0.2 and ci=1.5, continuous through the ci=0.5 threshold', () => {
  closeTo(confidenceScaleFraction(0, 0.1), 1, 1e-9, 'ci well below 0.2 clamps to the very top');
  closeTo(confidenceScaleFraction(0, 0.2), 1, 1e-9, 'ci exactly 0.2 is still the very top');
  closeTo(confidenceScaleFraction(0, 0.5), 0.2, 1e-9, 'ci exactly 0.5 sits at the 20% mark (the bullshit threshold line)');
  closeTo(confidenceScaleFraction(0, 1.5), 0, 1e-9, 'ci exactly 1.5 clamps to the very bottom');
  closeTo(confidenceScaleFraction(0, 3), 0, 1e-9, 'ci well beyond 1.5 also clamps to the very bottom');

  // Both branches must agree exactly at their shared boundary, ci=0.5 —
  // a real gauge can't have a visible jump right at the "bullshit
  // threshold" line.
  const justBelow = confidenceScaleFraction(0, 0.5 - 1e-6);
  const justAbove = confidenceScaleFraction(0, 0.5 + 1e-6);
  closeTo(justBelow, justAbove, 1e-4, 'continuous across the ci=0.5 branch boundary');

  // Midpoint of the "real" 0.2..0.5 range lands at the midpoint of the
  // gauge's own top 80% (0.2..1.0), i.e. 0.6.
  closeTo(confidenceScaleFraction(0, 0.35), 0.6, 1e-9);
});

test('oneMoaWidthMm / mmToAngularUnit round-trip through the app\'s own exact unit conversion', () => {
  const rangeM = 100;
  const moaWidthMm = oneMoaWidthMm(rangeM);
  closeTo(moaWidthMm, 29.0888, 1e-3, '1 MOA at 100m is ~29.09mm');
  closeTo(mmToAngularUnit(moaWidthMm, 'arcmin', rangeM), 1, 1e-9, 'converting that width back gives exactly 1 MOA');
  closeTo(mmToAngularUnit(moaWidthMm * 2, 'arcmin', rangeM), 2, 1e-9);
});

test('oneMradWidthMm / mmToAngularUnit round-trip, same shape as oneMoaWidthMm\'s own test', () => {
  const rangeM = 100;
  const mradWidthMm = oneMradWidthMm(rangeM);
  closeTo(mradWidthMm, 100, 1e-6, '1 mrad at 100m is exactly 100mm by the small-angle definition');
  closeTo(mmToAngularUnit(mradWidthMm, 'mrad', rangeM), 1, 1e-9, 'converting that width back gives exactly 1 mrad');
  closeTo(mmToAngularUnit(mradWidthMm * 2, 'mrad', rangeM), 2, 1e-9);
});
