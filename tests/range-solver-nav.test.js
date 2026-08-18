import test from 'node:test';
import assert from 'node:assert/strict';

const {
  isInRangeSolverMode, setRangeSolverMode, onRangeSolverModeChange,
  getRangeSolverTab, setRangeSolverTab, onRangeSolverTabChange,
  resetRangeSolverNavForTests
} = await import('../src/range-solver-nav.js');

test.beforeEach(() => resetRangeSolverNavForTests());

test('starts out of Range Solver mode, on the Target tab', () => {
  assert.equal(isInRangeSolverMode(), false);
  assert.equal(getRangeSolverTab(), 'target');
});

test('setRangeSolverMode toggles isInRangeSolverMode', () => {
  setRangeSolverMode(true);
  assert.equal(isInRangeSolverMode(), true);
  setRangeSolverMode(false);
  assert.equal(isInRangeSolverMode(), false);
});

test('onRangeSolverModeChange listeners fire with the new value, only on an actual change', () => {
  const calls = [];
  onRangeSolverModeChange((on) => calls.push(on));

  setRangeSolverMode(true);
  assert.deepEqual(calls, [true]);

  setRangeSolverMode(true); // no-op — already true
  assert.deepEqual(calls, [true]);

  setRangeSolverMode(false);
  assert.deepEqual(calls, [true, false]);
});

test('onRangeSolverModeChange returns an unsubscribe function', () => {
  let calls = 0;
  const unsubscribe = onRangeSolverModeChange(() => { calls++; });
  setRangeSolverMode(true);
  assert.equal(calls, 1);
  unsubscribe();
  setRangeSolverMode(false);
  assert.equal(calls, 1, 'should not fire after unsubscribing');
});

test('entering Range Solver mode always resets the active tab back to Target', () => {
  setRangeSolverMode(true);
  setRangeSolverTab('wind');
  assert.equal(getRangeSolverTab(), 'wind');

  setRangeSolverMode(false);
  setRangeSolverMode(true);
  assert.equal(getRangeSolverTab(), 'target', 'the section never remembers which tab was last open');
});

test('setRangeSolverTab notifies listeners, only on an actual change', () => {
  const calls = [];
  onRangeSolverTabChange((tab) => calls.push(tab));

  setRangeSolverTab('wind');
  assert.deepEqual(calls, ['wind']);

  setRangeSolverTab('wind'); // no-op — already active
  assert.deepEqual(calls, ['wind']);

  setRangeSolverTab('atmosphere');
  assert.deepEqual(calls, ['wind', 'atmosphere']);
});

test('onRangeSolverTabChange returns an unsubscribe function', () => {
  let calls = 0;
  const unsubscribe = onRangeSolverTabChange(() => { calls++; });
  setRangeSolverTab('wind');
  assert.equal(calls, 1);
  unsubscribe();
  setRangeSolverTab('atmosphere');
  assert.equal(calls, 1, 'should not fire after unsubscribing');
});

test('resetRangeSolverNavForTests() clears both the mode and the active tab', () => {
  setRangeSolverMode(true);
  setRangeSolverTab('atmosphere');
  resetRangeSolverNavForTests();
  assert.equal(isInRangeSolverMode(), false);
  assert.equal(getRangeSolverTab(), 'target');
});
