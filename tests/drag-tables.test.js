import test from 'node:test';
import assert from 'node:assert/strict';
import { G1_TABLE, G7_TABLE, makeCdLookup } from '../src/engine/drag-tables.js';

test('returns exact table values at table points', () => {
  const cdAt = makeCdLookup(G1_TABLE);
  for (const [mach, cd] of G1_TABLE) {
    assert.ok(Math.abs(cdAt(mach) - cd) < 1e-9);
  }
});

test('cursor walks backward correctly when mach decreases below current position', () => {
  const cdAt = makeCdLookup(G1_TABLE);
  cdAt(2.0);
  const backValue = cdAt(0.5);
  const freshValue = makeCdLookup(G1_TABLE)(0.5);
  assert.equal(backValue, freshValue);
});

test('clamps at the top of the table for mach beyond its range', () => {
  const cdAt = makeCdLookup(G1_TABLE);
  const last = G1_TABLE[G1_TABLE.length - 1][1];
  assert.equal(cdAt(50), last);
});

test('clamps at the bottom of the table for mach below its range', () => {
  const cdAt = makeCdLookup(G1_TABLE);
  assert.equal(cdAt(-1), G1_TABLE[0][1]);
});

// A true quadratic is the sharpest possible test of the interpolation
// scheme: a 2nd-degree fit through any 3 of its points recovers the exact
// original polynomial, so every interior lookup should reproduce f(x)
// to floating-point precision — something plain linear interpolation
// could never do except exactly at the table points.
function quadraticTable(f, xs) {
  return xs.map((x) => [x, f(x)]);
}

test('interior points reproduce an exact quadratic to floating-point precision', () => {
  const f = (x) => 2 * x * x - 3 * x + 1;
  const table = quadraticTable(f, [0, 0.3, 0.5, 0.9, 1.2, 1.6, 2.0]);
  const cdAt = makeCdLookup(table);
  // every interior bracket is fit from 3 real points of the same true
  // quadratic, so both curves either side of any bracket already equal f
  // exactly — no blend weight can move the result off of it.
  for (const x of [0.42, 0.62, 0.97, 1.05, 1.5]) {
    assert.ok(Math.abs(cdAt(x) - f(x)) < 1e-9, `at x=${x}: got ${cdAt(x)}, expected ${f(x)}`);
  }
});

test('a mach near the first table point blends mostly the boundary\'s linear fit with a little of the interior quadratic', () => {
  // A curved (non-collinear) start, so the linear and quadratic curves
  // visibly disagree, making the blend weight observable.
  const f = (x) => 3 * x * x + 1;
  const table = quadraticTable(f, [0, 0.1, 0.2, 0.4, 0.7, 1.0]);
  const cdAt = makeCdLookup(table);

  const [x0, y0] = table[0];
  const [x1, y1] = table[1];
  const rate = (y1 - y0) / (x1 - x0);
  const w1 = 0.1; // 10% of the way from point 0 to point 1
  const nearFirst = x0 + (x1 - x0) * w1;
  const linearValue = y0 + rate * (nearFirst - x0); // curves[0], the boundary's linear fit
  const quadraticValue = f(nearFirst); // curves[1] is fit through 3 real points of f, so it IS f here
  const blended = linearValue + w1 * (quadraticValue - linearValue);

  assert.ok(Math.abs(cdAt(nearFirst) - blended) < 1e-9);
  assert.ok(Math.abs(cdAt(nearFirst) - linearValue) > 1e-6, 'should not fully match the pure linear fit — 10% of the interior quadratic should show through');
  assert.ok(Math.abs(cdAt(nearFirst) - f(nearFirst)) > 1e-6, 'should not fully match the true quadratic either — 90% of the boundary linear fit should dominate');
});

test('a mach near the last table point blends mostly the boundary\'s linear fit with a little of the interior quadratic', () => {
  const f = (x) => 3 * x * x + 1;
  const table = quadraticTable(f, [0, 0.3, 0.6, 0.8, 0.9, 1.0]);
  const cdAt = makeCdLookup(table);

  const [xPrev, yPrev] = table[table.length - 2];
  const [xLast, yLast] = table[table.length - 1];
  const rate = (yLast - yPrev) / (xLast - xPrev);
  const w1 = 0.9; // 90% of the way from xPrev to xLast
  const nearLast = xPrev + (xLast - xPrev) * w1;
  const quadraticValue = f(nearLast); // curves[n-2] is fit through 3 real points of f, so it IS f here
  const linearValue = yPrev + rate * (nearLast - xPrev); // curves[n-1], the boundary's linear fit
  const blended = quadraticValue + w1 * (linearValue - quadraticValue);

  assert.ok(Math.abs(cdAt(nearLast) - blended) < 1e-9);
  assert.ok(Math.abs(cdAt(nearLast) - linearValue) > 1e-6, 'should not fully match the pure linear fit — 10% of the interior quadratic should show through');
  assert.ok(Math.abs(cdAt(nearLast) - f(nearLast)) > 1e-6, 'should not fully match the true quadratic either — 90% of the boundary linear fit should dominate');
});

test('has no discontinuity at the switch point between two brackets (regression: used to jump by several percent)', () => {
  // G7 has a sharp transonic rise and genuinely uneven spacing — exactly
  // the shape that exposed the old "pick the nearer curve" jump.
  const cdAt = makeCdLookup(G7_TABLE);
  let maxRelJump = 0;
  for (let i = 0; i < G7_TABLE.length - 1; i++) {
    const mid = (G7_TABLE[i][0] + G7_TABLE[i + 1][0]) / 2;
    const eps = 1e-6;
    const below = cdAt(mid - eps);
    const above = cdAt(mid + eps);
    const relJump = Math.abs(above - below) / Math.max(Math.abs(below), Math.abs(above), 1e-9);
    maxRelJump = Math.max(maxRelJump, relJump);
  }
  assert.ok(maxRelJump < 1e-4, `expected no visible jump anywhere, worst relative jump was ${(maxRelJump * 100).toFixed(3)}%`);
});

test('applies identically to a library bullet\'s own Cd table, not just G1/G7 (same makeCdLookup, no special-casing)', () => {
  const f = (x) => -0.5 * x * x + 0.2 * x + 0.15;
  const customTable = quadraticTable(f, [0, 0.5, 1.0, 1.5, 2.0, 2.5]);
  const cdAt = makeCdLookup(customTable);
  assert.ok(Math.abs(cdAt(1.2) - f(1.2)) < 1e-9);
});

test('fitted curves are cached per table: mutating the table after first use does not change already-computed results', () => {
  const table = [[0, 1], [0.5, 1.5], [1, 3], [1.5, 4], [2, 5]];
  const cdAt1 = makeCdLookup(table);
  const before = cdAt1(1.2);

  table[2][1] = 999; // corrupt a middle point after the curves were fit

  const cdAt2 = makeCdLookup(table); // same table reference — should hit the cache
  assert.equal(cdAt2(1.2), before, 'a second lookup on the same table object should reuse the cached fit, not the corrupted data');
});
