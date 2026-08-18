import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStepper, landOnRange } from '../src/engine/trajectory.js';
import { makeCdLookup, DRAG_TABLES } from '../src/engine/drag-tables.js';
import { MAX_STEPS } from '../src/engine/constants.js';
import { computeCdMachCurve, scaledReferenceCurve, MACH_BREAKPOINTS } from '../src/engine/cd-mach-curve.js';

const ATMO = { tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0 };
const rangeOfX = (p) => p.x;

// Same "restart fresh at the segment's own start velocity, land exactly
// on dd via landOnRange()" physics computeCdMachCurve's own internal
// flightAt() uses, so the only source of error when recovering a known
// curve is the real "blanket Cd within one segment" approximation
// itself, not a simulation mismatch between test and production code.
function buildSyntheticTable(ranges, v0, dragConfig, massKg, caliberM) {
  const velocities = [v0];
  for (let i = 0; i < ranges.length - 1; i++) {
    const dd = ranges[i + 1] - ranges[i];
    const stepper = makeStepper({ ...dragConfig, massKg, caliberM, windSpeed: 0, windAngle: 90, ...ATMO });
    let older = null, prev = null, cur = { x: 0, y: 0, z: 0, vx: velocities[i], vy: 0, vz: 0, t: 0 };
    let steps = 0;
    while (cur.x < dd && steps < MAX_STEPS) { older = prev; prev = cur; cur = stepper.step(cur); steps++; }
    const landed = prev === null
      ? cur
      : landOnRange(older, prev, cur, () => (steps < MAX_STEPS ? stepper.step(cur) : null), rangeOfX, dd);
    velocities.push(Math.hypot(landed.vx, landed.vy, landed.vz));
  }
  return ranges.map((r, i) => ({ rangeM: r, velocityMs: velocities[i] }));
}

test('recovers a known flat Cd from a 3-point synthetic table', () => {
  const massKg = 0.0092, caliberM = 0.0069, trueCd = 0.3;
  const points = buildSyntheticTable([0, 120, 260], 850, { cdTable: [[0, trueCd], [5, trueCd]] }, massKg, caliberM);

  const { calculated } = computeCdMachCurve({ points, massKg, caliberM, ...ATMO });
  assert.equal(calculated.length, 2);
  for (const p of calculated) assert.ok(Math.abs(p.cd - trueCd) < 1e-3, `recovered cd ${p.cd}, expected ~${trueCd}`);
});

test('recovers a known Mach-varying (G1) curve across several segments', () => {
  const massKg = 0.011, caliberM = 0.0069;
  const points = buildSyntheticTable([0, 80, 180, 300], 850, { cdTable: DRAG_TABLES.G1 }, massKg, caliberM);

  const { calculated } = computeCdMachCurve({ points, massKg, caliberM, ...ATMO });
  assert.equal(calculated.length, 3);
  const trueCdAt = makeCdLookup(DRAG_TABLES.G1);
  for (const p of calculated) {
    const trueCd = trueCdAt(p.mach);
    assert.ok(Math.abs(p.cd - trueCd) / trueCd < 0.05, `mach ${p.mach}: recovered cd ${p.cd}, true ~${trueCd}`);
  }
});

test('throws when fewer than 3 points are given', () => {
  assert.throws(() => computeCdMachCurve({ points: [{ rangeM: 0, velocityMs: 800 }, { rangeM: 100, velocityMs: 700 }], massKg: 0.01, caliberM: 0.007 }));
});

test('extends a segment past the immediately-next row when its own velocity drop is below MIN_DELTA_V (20 m/s)', () => {
  const massKg = 0.0092, caliberM = 0.0069, trueCd = 0.3;
  // ranges[0]->ranges[1] is only 5m apart — a real velocity drop over that
  // short a distance, for this bullet's own ballistics, is well under the
  // 20 m/s floor. Every point here comes from buildSyntheticTable (so all
  // four are mutually physically consistent, unlike an arbitrarily-chosen
  // intermediate value would be) — the adaptive search starting at index 0
  // should skip past index 1 and use index 2 as its endpoint instead of
  // deriving a Cd from that tiny, ill-conditioned 5m hop.
  const points = buildSyntheticTable([0, 5, 120, 260], 850, { cdTable: [[0, trueCd], [5, trueCd]] }, massKg, caliberM);

  const { calculated, skipped } = computeCdMachCurve({ points, massKg, caliberM, ...ATMO });
  assert.deepEqual(skipped, [], 'the tiny-drop row should be bridged over, not reported as a skip');
  // 4 points -> 3 possible starts, all resolve (index 1's own segment,
  // r=5->r=120, is a normal 115m hop with plenty of its own Δv).
  assert.equal(calculated.length, 3);
  for (const p of calculated) assert.ok(Math.abs(p.cd - trueCd) < 0.01, `recovered cd ${p.cd}, expected ~${trueCd}`);
});

test('skips a segment whose velocity increases when no later row can rescue it (forced to the table\'s own last row)', () => {
  const massKg = 0.0092, caliberM = 0.0069, trueCd = 0.3;
  const good = buildSyntheticTable([0, 120, 260], 850, { cdTable: [[0, trueCd], [5, trueCd]] }, massKg, caliberM);
  // The bad pair sits at the very end of the table: for the second-to-last
  // start, the adaptive search has nowhere left to extend to (its only
  // candidate endpoint is the table's own last row), so an increasing
  // velocity there can't be bridged over the way an intermediate one could.
  const points = [good[0], good[1], { rangeM: 400, velocityMs: good[1].velocityMs + 10 }];

  const { calculated, skipped } = computeCdMachCurve({ points, massKg, caliberM, ...ATMO });
  assert.deepEqual(skipped, [{ index: 1, reason: 'nonDecreasingVelocity' }]);
  assert.equal(calculated.length, 1);
});

test('skips a segment with a non-increasing distance when no later row can rescue it', () => {
  const massKg = 0.0092, caliberM = 0.0069, trueCd = 0.3;
  const good = buildSyntheticTable([0, 120, 260], 850, { cdTable: [[0, trueCd], [5, trueCd]] }, massKg, caliberM);
  // Duplicate distance at the very end (same rangeM as good[1]) — again
  // with nothing left after it for the adaptive search to fall back to.
  const points = [good[0], good[1], { rangeM: 120, velocityMs: good[1].velocityMs - 50 }];

  const { calculated, skipped } = computeCdMachCurve({ points, massKg, caliberM, ...ATMO });
  assert.deepEqual(skipped, [{ index: 1, reason: 'nonIncreasingDistance' }]);
  assert.equal(calculated.length, 1);
});

test('returns an empty interpolated table (not a throw) when too few Mach breakpoints survive', () => {
  const massKg = 0.0092, caliberM = 0.0069, trueCd = 0.3;
  // A short, slow table (well under Mach 0.4 throughout) whose segments
  // may or may not individually clear MIN_DELTA_V — either way, every
  // recovered Mach stays below the first non-zero breakpoint (0.4).
  const points = buildSyntheticTable([0, 5, 10], 90, { cdTable: [[0, trueCd], [5, trueCd]] }, massKg, caliberM);

  const { calculated, interpolated } = computeCdMachCurve({ points, massKg, caliberM, ...ATMO });
  assert.ok(calculated.every((p) => p.mach < 0.4), `expected all machs below 0.4, got ${calculated.map((p) => p.mach)}`);
  assert.deepEqual(interpolated, []);
});

test('dedupes near-identical-Mach calculated points into one row', () => {
  const massKg = 0.0092, caliberM = 0.0069;
  // Segment 0 (idx0->idx1: v1=850,v2=800,dd=100) and segment 2 (idx2->idx3:
  // v1=850,v2=800,dd=100) are solved independently and only ever depend on
  // (v1, v2, dd, massKg, caliberM, atmo) — never on absolute range or on
  // neighboring segments — so two non-adjacent segments sharing the exact
  // same (v1, v2, dd) resolve to bit-identical cd and mach, regardless of
  // what's skipped in between. Segment 1 (idx1->idx2: v1=800 rising to
  // 850, then falling back to 800 with nowhere left to extend to) is
  // deliberately invalid and gets skipped, but that has no bearing on
  // segments 0 and 2.
  const points = [
    { rangeM: 0, velocityMs: 850 },
    { rangeM: 100, velocityMs: 800 },
    { rangeM: 200, velocityMs: 850 },
    { rangeM: 300, velocityMs: 800 }
  ];

  const { calculated, skipped } = computeCdMachCurve({ points, massKg, caliberM, ...ATMO });
  assert.deepEqual(skipped, [{ index: 1, reason: 'nonDecreasingVelocity' }]);
  assert.equal(calculated.length, 1, `expected the two identical segments to dedupe into one row, got ${JSON.stringify(calculated)}`);
});

test('scaledReferenceCurve returns null when ownCurve has fewer than 2 points', () => {
  assert.equal(scaledReferenceCurve(DRAG_TABLES.G1, []), null);
  assert.equal(scaledReferenceCurve(DRAG_TABLES.G1, [{ mach: 1, cd: 0.4 }]), null);
});

test('scaledReferenceCurve scales to exactly 1x when ownCurve already equals the reference table', () => {
  const ownCurve = DRAG_TABLES.G1.map(([mach, cd]) => ({ mach, cd }));
  const result = scaledReferenceCurve(DRAG_TABLES.G1, ownCurve, { anchorMach: 2.0 });
  assert.ok(Math.abs(result.scaleFactor - 1) < 1e-9, `scaleFactor ${result.scaleFactor}`);

  const trueCdAt = makeCdLookup(DRAG_TABLES.G1);
  for (const p of result.points) {
    assert.ok(Math.abs(p.cd - trueCdAt(p.mach)) < 1e-9);
  }
});

test('scaledReferenceCurve domain always contains the anchor Mach, even when ownCurve does not', () => {
  const ownCurve = [{ mach: 0.5, cd: 0.25 }, { mach: 0.6, cd: 0.26 }];
  const result = scaledReferenceCurve(DRAG_TABLES.G1, ownCurve, { anchorMach: 2.0 });
  const machs = result.points.map((p) => p.mach);
  assert.ok(Math.min(...machs) <= 2.0 && Math.max(...machs) >= 2.0);
});

test('recovers a known Mach-varying (G7) curve, transonic spike included, from a sparse whole-m/s-rounded table', () => {
  // The scenario this whole adaptive-endpoint approach was built for: a
  // sparse (~100m/segment), whole-m/s-rounded table — the tool's primary
  // real-world use case — reconstructed against G7's own sharp Mach-1.0
  // spike, the stress case that plain exact-fit interpolation over
  // consecutive-row segments used to visibly under-recover.
  const massKg = 0.0113, caliberM = 0.00782; // plausible G7-modeled .308-class boat-tail
  const ranges = Array.from({ length: 20 }, (_, i) => i * 130); // ~130m/segment
  const rawTable = buildSyntheticTable(ranges, 1000, { cdTable: DRAG_TABLES.G7 }, massKg, caliberM);
  const points = rawTable.map((p) => ({ rangeM: p.rangeM, velocityMs: Math.round(p.velocityMs) }));

  const { interpolated } = computeCdMachCurve({ points, massKg, caliberM, ...ATMO });
  assert.ok(interpolated.length > 5, `expected several breakpoints, got ${interpolated.length}`);

  const trueCdAt = makeCdLookup(DRAG_TABLES.G7);
  const relErrs = interpolated.map((p) => Math.abs(p.cd - trueCdAt(p.mach)) / trueCdAt(p.mach));
  const rmsRelPct = 100 * Math.sqrt(relErrs.reduce((s, e) => s + e * e, 0) / relErrs.length);
  assert.ok(rmsRelPct < 10, `expected the curve to stay within ~10% RMS of the true G7 curve, got ${rmsRelPct.toFixed(2)}%`);
});

test('recovers a known Mach-varying (G1) curve from a dense, whole-m/s-rounded table', () => {
  // The other half of the scenario: many closely-spaced points (small real
  // velocity change per consecutive row) with velocities rounded to whole
  // m/s — exactly where per-segment Cd differentiation used to be most
  // sensitive to input rounding before the adaptive endpoint existed.
  const massKg = 0.01, caliberM = 0.00783; // representative .308-class bullet
  const ranges = Array.from({ length: 30 }, (_, i) => i * 30); // 30 pts, 30m apart
  const rawTable = buildSyntheticTable(ranges, 850, { cdTable: DRAG_TABLES.G1 }, massKg, caliberM);
  const points = rawTable.map((p) => ({ rangeM: p.rangeM, velocityMs: Math.round(p.velocityMs) }));

  const { interpolated } = computeCdMachCurve({ points, massKg, caliberM, ...ATMO });
  assert.ok(interpolated.length > 5, `expected several breakpoints, got ${interpolated.length}`);

  const trueCdAt = makeCdLookup(DRAG_TABLES.G1);
  const relErrs = interpolated.map((p) => Math.abs(p.cd - trueCdAt(p.mach)) / trueCdAt(p.mach));
  const rmsRelPct = 100 * Math.sqrt(relErrs.reduce((s, e) => s + e * e, 0) / relErrs.length);
  assert.ok(rmsRelPct < 10, `expected the curve to stay within ~10% RMS of the true G1 curve despite whole-m/s rounding, got ${rmsRelPct.toFixed(2)}%`);
});

test('MACH_BREAKPOINTS is a near-uniform 0.05 Mach grid across the whole domain, collapsing to sparse points past Mach 3', () => {
  assert.deepEqual(MACH_BREAKPOINTS, [
    0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50,
    0.55, 0.60, 0.65, 0.70, 0.725, 0.75, 0.775, 0.80, 0.825, 0.85, 0.875,
    0.90, 0.925, 0.95, 0.975, 1.0, 1.025, 1.05, 1.075, 1.10, 1.125, 1.15,
    1.20, 1.25, 1.30, 1.35, 1.40, 1.50, 1.55, 1.60, 1.65, 1.70, 1.75,
    1.80, 1.85, 1.90, 1.95, 2.00, 2.05, 2.10, 2.15, 2.20, 2.25, 2.30,
    2.35, 2.40, 2.45, 2.50, 2.55, 2.60, 2.65, 2.70, 2.75, 2.80, 2.85,
    2.90, 2.95, 3.00, 4, 5
  ]);
});
