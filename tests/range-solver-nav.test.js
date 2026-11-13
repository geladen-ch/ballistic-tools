import test from 'node:test';
import assert from 'node:assert/strict';

const {
  isInRangeSolverMode, setRangeSolverMode, onRangeSolverModeChange,
  getRangeSolverTab, setRangeSolverTab, onRangeSolverTabChange, setNextRangeSolverTab,
  resetRangeSolverNavForTests, RANGE_SOLVER_TABS
} = await import('../src/range-solver-nav.js');

test.beforeEach(() => resetRangeSolverNavForTests());

test('starts out of Range Solver mode, on the Fire! pane; the two panes are Fire! and Atmosphere', () => {
  assert.equal(isInRangeSolverMode(), false);
  assert.equal(getRangeSolverTab(), 'fire');
  assert.deepEqual([...RANGE_SOLVER_TABS], ['fire', 'atmosphere']);
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

test('entering Range Solver mode always resets the active pane back to Fire!, before mode listeners run', () => {
  setRangeSolverMode(true);
  setRangeSolverTab('atmosphere');
  assert.equal(getRangeSolverTab(), 'atmosphere');
  setRangeSolverMode(false);
  let seen = null;
  const off = onRangeSolverModeChange(() => { seen = getRangeSolverTab(); });
  setRangeSolverMode(true);
  off();
  assert.equal(getRangeSolverTab(), 'fire', 'the section never remembers which pane was last open');
  assert.equal(seen, 'fire');
});

test('setRangeSolverTab notifies listeners, only on an actual change', () => {
  const calls = [];
  onRangeSolverTabChange((tab) => calls.push(tab));
  setRangeSolverTab('atmosphere');
  assert.deepEqual(calls, ['atmosphere']);
  setRangeSolverTab('atmosphere'); // no-op — already active
  assert.deepEqual(calls, ['atmosphere']);
  setRangeSolverTab('fire');
  assert.deepEqual(calls, ['atmosphere', 'fire']);
});

test('unknown tabs, including the old Target and Range Card ones, mean the Fire! pane', () => {
  setRangeSolverTab('atmosphere');
  setRangeSolverTab('rangeCard');
  assert.equal(getRangeSolverTab(), 'fire');
  setRangeSolverTab('atmosphere');
  setRangeSolverTab('target');
  assert.equal(getRangeSolverTab(), 'fire');
  setNextRangeSolverTab('rangeCard');
  setRangeSolverMode(true);
  assert.equal(getRangeSolverTab(), 'fire');
});

test('onRangeSolverTabChange returns an unsubscribe function', () => {
  let calls = 0;
  const unsubscribe = onRangeSolverTabChange(() => { calls++; });
  setRangeSolverTab('atmosphere');
  assert.equal(calls, 1);
  unsubscribe();
  setRangeSolverTab('fire');
  assert.equal(calls, 1, 'should not fire after unsubscribing');
});

test('resetRangeSolverNavForTests() clears both the mode and the active pane', () => {
  setRangeSolverMode(true);
  setRangeSolverTab('atmosphere');
  resetRangeSolverNavForTests();
  assert.equal(isInRangeSolverMode(), false);
  assert.equal(getRangeSolverTab(), 'fire');
});

test('setNextRangeSolverTab picks the pane for the next entry only', () => {
  setNextRangeSolverTab('atmosphere');
  setRangeSolverMode(true);
  assert.equal(getRangeSolverTab(), 'atmosphere');
  setRangeSolverMode(false);
  setRangeSolverMode(true);
  assert.equal(getRangeSolverTab(), 'fire', 'one-shot: the entry after that resets to Fire! again');
});
