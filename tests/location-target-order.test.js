import test from 'node:test';
import assert from 'node:assert/strict';
import { TARGET_ORDERS, targetOrderOf, orderedTargets, defaultTargetNumber, moveTarget } from '../src/location-target-order.js';

const near = { id: 'a', rangeM: 300 };
const far = { id: 'b', rangeM: 800 };
const mid = { id: 'c', rangeM: 500 };

test('TARGET_ORDERS lists both modes, distance first', () => {
  assert.deepEqual(TARGET_ORDERS, ['distance', 'custom']);
});

test('targetOrderOf: only an explicit "custom" is custom — absent, unknown or no location reads as distance', () => {
  assert.equal(targetOrderOf({ targets: [] }), 'distance');
  assert.equal(targetOrderOf({ targets: [], targetOrder: 'distance' }), 'distance');
  assert.equal(targetOrderOf({ targets: [], targetOrder: 'custom' }), 'custom');
  assert.equal(targetOrderOf({ targets: [], targetOrder: 'alphabetical' }), 'distance');
  assert.equal(targetOrderOf(null), 'distance');
});

test('orderedTargets: distance mode sorts nearest first, custom mode keeps the stored order', () => {
  const targets = [far, near, mid];
  assert.deepEqual(orderedTargets({ targets }).map((t) => t.id), ['a', 'c', 'b']);
  assert.deepEqual(orderedTargets({ targets, targetOrder: 'custom' }).map((t) => t.id), ['b', 'a', 'c']);
});

test('orderedTargets returns a new array of the same target objects and never reorders the location\'s own', () => {
  const location = { targets: [far, near] };
  const out = orderedTargets(location);
  assert.notEqual(out, location.targets);
  assert.deepEqual(location.targets, [far, near]);
  assert.equal(out[0], near);
});

test('orderedTargets: targets at equal ranges keep their stored order in distance mode', () => {
  const x = { id: 'x', rangeM: 400 };
  const y = { id: 'y', rangeM: 400 };
  assert.deepEqual(orderedTargets({ targets: [y, x, near] }).map((t) => t.id), ['a', 'y', 'x']);
});

test('orderedTargets of no location, or one without targets, is empty', () => {
  assert.deepEqual(orderedTargets(null), []);
  assert.deepEqual(orderedTargets({}), []);
});

test('defaultTargetNumber is the 1-based place in the stored array, whatever the display order', () => {
  const location = { targets: [far, near, mid] };
  assert.equal(defaultTargetNumber(location, 'b'), 1);
  assert.equal(defaultTargetNumber(location, 'c'), 3);
  assert.equal(defaultTargetNumber(location, 'missing'), 0);
});

test('moveTarget moves one element down or up and leaves the input untouched', () => {
  const targets = [near, mid, far];
  assert.deepEqual(moveTarget(targets, 0, 2).map((t) => t.id), ['c', 'b', 'a']);
  assert.deepEqual(moveTarget(targets, 2, 0).map((t) => t.id), ['b', 'a', 'c']);
  assert.deepEqual(moveTarget(targets, 1, 2).map((t) => t.id), ['a', 'b', 'c']);
  assert.deepEqual(targets.map((t) => t.id), ['a', 'c', 'b']);
});

test('moveTarget returns the same array for a no-op or out-of-range move', () => {
  const targets = [near, mid];
  assert.equal(moveTarget(targets, 1, 1), targets);
  assert.equal(moveTarget(targets, -1, 0), targets);
  assert.equal(moveTarget(targets, 0, 2), targets);
  assert.equal(moveTarget(targets, 0.5, 1), targets);
});
