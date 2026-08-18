import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  loadRangeSolverTargetState, saveRangeSolverTargetState,
  loadRangeSolverWindState, saveRangeSolverWindState,
  loadRangeSolverAtmosphereState, saveRangeSolverAtmosphereState,
  resetRangeSolverStateForTests
} = await import('../src/range-solver-state.js');
const { getCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_range_solver_state_v1';

test.beforeEach(() => {
  resetRangeSolverStateForTests();
  removeCookie(COOKIE_NAME);
});

test('all three slices start out null', () => {
  assert.equal(loadRangeSolverTargetState(), null);
  assert.equal(loadRangeSolverWindState(), null);
  assert.equal(loadRangeSolverAtmosphereState(), null);
});

test('saveRangeSolverTargetState persists and is readable back', () => {
  saveRangeSolverTargetState({ rangeM: 500, losAngleDeg: 10 });
  assert.deepEqual(loadRangeSolverTargetState(), { rangeM: 500, losAngleDeg: 10 });
});

test('each save merges into its own slice rather than replacing it outright', () => {
  saveRangeSolverTargetState({ rangeM: 500 });
  saveRangeSolverTargetState({ losAngleDeg: 5 });
  assert.deepEqual(loadRangeSolverTargetState(), { rangeM: 500, losAngleDeg: 5 });
});

test('saving one slice never touches the other two', () => {
  saveRangeSolverTargetState({ rangeM: 500 });
  saveRangeSolverWindState({ speed: 2, angle: 45 });
  saveRangeSolverAtmosphereState({ tempC: 10 });

  assert.deepEqual(loadRangeSolverTargetState(), { rangeM: 500 });
  assert.deepEqual(loadRangeSolverWindState(), { speed: 2, angle: 45 });
  assert.deepEqual(loadRangeSolverAtmosphereState(), { tempC: 10 });
});

test('persists to a single cookie a fresh module load would pick up', async () => {
  saveRangeSolverTargetState({ rangeM: 777, losAngleDeg: 0 });
  saveRangeSolverWindState({ speed: 1.5, angle: 90 });

  assert.ok(getCookie(COOKIE_NAME), 'expected the state cookie to be written');

  const fresh = await import(`../src/range-solver-state.js?reload=${Date.now()}`);
  assert.deepEqual(fresh.loadRangeSolverTargetState(), { rangeM: 777, losAngleDeg: 0 });
  assert.deepEqual(fresh.loadRangeSolverWindState(), { speed: 1.5, angle: 90 });
});

test('resetRangeSolverStateForTests() clears all three slices in memory (not the cookie)', () => {
  saveRangeSolverTargetState({ rangeM: 500 });
  resetRangeSolverStateForTests();
  assert.equal(loadRangeSolverTargetState(), null);
});
