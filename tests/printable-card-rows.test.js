import test from 'node:test';
import assert from 'node:assert/strict';
import {
  referenceDistances, neighbourDistances, tableRows, farthestDistance, STEP_LEVELS
} from '../src/printable-card/rows.js';

const distances = (rows) => rows.map((r) => r.distance);

test('reference distances start one step out and stop at the max distance', () => {
  assert.deepEqual(distances(referenceDistances({ initialStep: 100, maxDistance: 500 })), [100, 200, 300, 400, 500]);
  assert.deepEqual(distances(referenceDistances({ initialStep: 200, maxDistance: 700 })), [200, 400, 600]);
  assert.deepEqual(referenceDistances({ initialStep: 100, maxDistance: 0 }), []);
});

test('an unknown step falls back to 100', () => {
  assert.deepEqual(distances(referenceDistances({ initialStep: 70, maxDistance: 300 })), [100, 200, 300]);
});

test('no refinement with a zero threshold, whatever the elevations', () => {
  const rows = referenceDistances({ initialStep: 100, maxDistance: 400, refineThreshold: 0, elevationAt: (d) => d * d });
  assert.deepEqual(rows.map((r) => r.step), [100, 100, 100, 100]);
});

test('refinement drops a level when the elevation to the next distance exceeds the threshold, cascading, never growing', () => {
  // Elevation grows with the square of the distance: the change to the next
  // step grows, so the step shrinks further out and stays shrunk.
  const elevationAt = (d) => (d / 100) ** 2;
  const rows = referenceDistances({ initialStep: 200, maxDistance: 1000, refineThreshold: 13, elevationAt });
  const steps = rows.map((r) => r.step);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] <= steps[i - 1], 'never coarser again');
  assert.equal(steps[0], 200);
  assert.ok(steps.includes(100) && steps.includes(50), `cascades: ${steps}`);
  for (const row of rows) assert.ok(STEP_LEVELS.includes(row.step));
  // Every distance stays on the grid of its step.
  for (let i = 1; i < rows.length; i++) assert.equal(rows[i].distance - rows[i - 1].distance, rows[i - 1].step);
});

test('refinement stops at the finest level', () => {
  const rows = referenceDistances({ initialStep: 25, maxDistance: 200, refineThreshold: 0.001, elevationAt: (d) => d });
  assert.ok(rows.every((r) => r.step === 25));
});

test('an elevation that cannot be had decides no refinement', () => {
  const rows = referenceDistances({ initialStep: 100, maxDistance: 300, refineThreshold: 1, elevationAt: () => NaN });
  assert.deepEqual(rows.map((r) => r.step), [100, 100, 100]);
});

test('neighbours follow the row\'s own step; none at or below zero', () => {
  assert.deepEqual(neighbourDistances({ distance: 800, step: 200 }), [700, 750, 850, 900]);
  assert.deepEqual(neighbourDistances({ distance: 800, step: 100 }), [750, 775, 825, 850]);
  assert.deepEqual(neighbourDistances({ distance: 800, step: 50 }), [780, 790, 810, 820]);
  assert.deepEqual(neighbourDistances({ distance: 800, step: 25 }), [790, 795, 805, 810]);
  assert.deepEqual(neighbourDistances({ distance: 50, step: 100 }), [null, 25, 75, 100]);
});

test('targets merge in distance order, after a reference row at the same distance; beyond the max they are left out', () => {
  const references = referenceDistances({ initialStep: 100, maxDistance: 400 });
  const { rows, omitted, lastDistance } = tableRows({
    references,
    targets: [{ label: 'T1', distance: 250 }, { label: 'T2', distance: 300 }, { label: 'T3', distance: 450 }],
    maxDistance: 400
  });
  assert.deepEqual(rows.map((r) => (r.kind === 'target' ? r.label : r.distance)), [100, 200, 'T1', 300, 'T2', 400]);
  assert.equal(omitted, 0);
  assert.equal(lastDistance, 400);
});

test('at most the paper\'s row count: the rest are counted and the farthest kept is reported', () => {
  const references = referenceDistances({ initialStep: 25, maxDistance: 1000 });
  for (const maxRows of [37, 25]) {
    const { rows, omitted, lastDistance } = tableRows({ references, maxDistance: 1000, maxRows });
    assert.equal(rows.length, maxRows);
    assert.equal(omitted, 40 - maxRows);
    assert.equal(lastDistance, 25 * maxRows);
  }
});

test('the farthest distance to solve includes the last row\'s far neighbour', () => {
  const rows = tableRows({ references: referenceDistances({ initialStep: 100, maxDistance: 300 }), maxDistance: 300 }).rows;
  assert.equal(farthestDistance(rows), 350);
});
