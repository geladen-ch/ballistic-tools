import test from 'node:test';
import assert from 'node:assert/strict';

const { resampleChartPoints, CHART_POINTS_TARGET } = await import('../src/trajectory-columns.js');

function densePoints() {
  // Ten points, range 0..900 step 100, a trivial linear "velocity" field.
  const out = [];
  for (let i = 0; i <= 9; i++) out.push({ range: i * 100, velocity: 1000 - i * 50 });
  return out;
}

test('resamples count+1 evenly-spaced points landing exactly on both window edges', () => {
  const points = resampleChartPoints(densePoints(), 0, 900, 4);
  assert.equal(points.length, 5);
  assert.equal(points[0].range, 0);
  assert.equal(points[4].range, 900);
});

test('defaults to CHART_POINTS_TARGET samples', () => {
  const points = resampleChartPoints(densePoints(), 0, 900);
  assert.equal(points.length, CHART_POINTS_TARGET + 1);
});

test('returns [] for an empty dense array', () => {
  assert.deepEqual(resampleChartPoints([], 0, 900), []);
});

test('clamps the window to wherever the dense trajectory actually reached', () => {
  const points = resampleChartPoints(densePoints(), 0, 5000, 4);
  assert.equal(points[points.length - 1].range, 900, 'should clamp to the last real dense point, not extrapolate');
});

test('regression: a non-finite start/end (e.g. NaN from an upstream unvalidated field) returns [] instead of producing NaN-filled points', () => {
  assert.deepEqual(resampleChartPoints(densePoints(), NaN, 900), []);
  assert.deepEqual(resampleChartPoints(densePoints(), 0, NaN), []);
  assert.deepEqual(resampleChartPoints(densePoints(), NaN, NaN), []);
});
