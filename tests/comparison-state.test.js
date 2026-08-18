import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getComparisonSelection, isSelectedForComparison, canAddToComparison,
  addToComparison, removeFromComparison, removeRifleFromComparison, resetComparisonForTests
} from '../src/comparison-state.js';

test.beforeEach(() => resetComparisonForTests());

test('starts empty', () => {
  assert.deepEqual(getComparisonSelection(), []);
  assert.equal(canAddToComparison(), true);
});

test('adding a config marks it selected and appears in the selection', () => {
  assert.equal(addToComparison('rifle-1', 'c1'), true);
  assert.equal(isSelectedForComparison('rifle-1', 'c1'), true);
  assert.deepEqual(getComparisonSelection(), [{ rifleId: 'rifle-1', cartridgeId: 'c1' }]);
});

test('the same rifle+cartridge cannot be added twice', () => {
  assert.equal(addToComparison('rifle-1', 'c1'), true);
  assert.equal(addToComparison('rifle-1', 'c1'), false);
  assert.deepEqual(getComparisonSelection(), [{ rifleId: 'rifle-1', cartridgeId: 'c1' }]);
});

test('the same rifle with a different cartridge can be added', () => {
  assert.equal(addToComparison('rifle-1', 'c1'), true);
  assert.equal(addToComparison('rifle-1', 'c2'), true);
  assert.deepEqual(getComparisonSelection(), [
    { rifleId: 'rifle-1', cartridgeId: 'c1' },
    { rifleId: 'rifle-1', cartridgeId: 'c2' }
  ]);
});

test('at most two configs can be selected at once', () => {
  addToComparison('rifle-1', 'c1');
  addToComparison('rifle-2', 'c2');
  assert.equal(canAddToComparison(), false);
  assert.equal(addToComparison('rifle-3', 'c3'), false);
  assert.equal(getComparisonSelection().length, 2);
});

test('removeFromComparison drops exactly the matching pair', () => {
  addToComparison('rifle-1', 'c1');
  addToComparison('rifle-1', 'c2');
  removeFromComparison('rifle-1', 'c1');
  assert.deepEqual(getComparisonSelection(), [{ rifleId: 'rifle-1', cartridgeId: 'c2' }]);
  assert.equal(canAddToComparison(), true);
});

test('removeRifleFromComparison drops every entry for that rifle regardless of cartridge', () => {
  addToComparison('rifle-1', 'c1');
  addToComparison('rifle-1', 'c2');
  removeRifleFromComparison('rifle-1');
  assert.deepEqual(getComparisonSelection(), []);
});

test('removeRifleFromComparison leaves other rifles\' entries untouched', () => {
  addToComparison('rifle-1', 'c1');
  addToComparison('rifle-2', 'c2');
  removeRifleFromComparison('rifle-1');
  assert.deepEqual(getComparisonSelection(), [{ rifleId: 'rifle-2', cartridgeId: 'c2' }]);
});
