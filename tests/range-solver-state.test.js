import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  loadRangeSolverTargetState, saveRangeSolverTargetState,
  loadRangeSolverWindState, saveRangeSolverWindState,
  loadRangeSolverAtmosphereState, saveRangeSolverAtmosphereState,
  loadRangeSolverLocationState, saveRangeSolverLocationState,
  markAtmosphereTouched, wasAtmosphereTouchedThisSession,
  resetRangeSolverStateForTests
} = await import('../src/range-solver-state.js');
const { getCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_range_solver_state_v1';

test.beforeEach(() => {
  resetRangeSolverStateForTests();
  removeCookie(COOKIE_NAME);
});

test('all four slices start out null', () => {
  assert.equal(loadRangeSolverTargetState(), null);
  assert.equal(loadRangeSolverWindState(), null);
  assert.equal(loadRangeSolverAtmosphereState(), null);
  assert.equal(loadRangeSolverLocationState(), null);
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

test('saving one slice never touches the others', () => {
  saveRangeSolverTargetState({ rangeM: 500 });
  saveRangeSolverWindState({ speed: 2, angle: 45 });
  saveRangeSolverAtmosphereState({ tempC: 10 });
  saveRangeSolverLocationState({ locationId: 'loc-1', targetId: 'tgt-1' });

  assert.deepEqual(loadRangeSolverTargetState(), { rangeM: 500 });
  assert.deepEqual(loadRangeSolverWindState(), { speed: 2, angle: 45 });
  assert.deepEqual(loadRangeSolverAtmosphereState(), { tempC: 10 });
  assert.deepEqual(loadRangeSolverLocationState(), { locationId: 'loc-1', targetId: 'tgt-1' });
});

test('saveRangeSolverLocationState merges into its own slice rather than replacing it outright', () => {
  saveRangeSolverLocationState({ locationId: 'loc-1' });
  saveRangeSolverLocationState({ targetId: 'tgt-1' });
  assert.deepEqual(loadRangeSolverLocationState(), { locationId: 'loc-1', targetId: 'tgt-1' });
});

test('wasAtmosphereTouchedThisSession starts false and flips true after markAtmosphereTouched()', () => {
  assert.equal(wasAtmosphereTouchedThisSession(), false);
  markAtmosphereTouched();
  assert.equal(wasAtmosphereTouchedThisSession(), true);
});

test('the atmosphere-touched flag is session-only — not written to the cookie', () => {
  markAtmosphereTouched();
  const raw = getCookie(COOKIE_NAME);
  assert.ok(!raw || !raw.includes('atmosphereTouched'), 'the touched flag must never reach the cookie');
});

test('persists to a single cookie a fresh module load would pick up', async () => {
  saveRangeSolverTargetState({ rangeM: 777, losAngleDeg: 0 });
  saveRangeSolverWindState({ speed: 1.5, angle: 90 });

  assert.ok(getCookie(COOKIE_NAME), 'expected the state cookie to be written');

  const fresh = await import(`../src/range-solver-state.js?reload=${Date.now()}`);
  assert.deepEqual(fresh.loadRangeSolverTargetState(), { rangeM: 777, losAngleDeg: 0 });
  assert.deepEqual(fresh.loadRangeSolverWindState(), { speed: 1.5, angle: 90 });
});

test('resetRangeSolverStateForTests() clears every slice in memory (not the cookie), and the touched flag', () => {
  saveRangeSolverTargetState({ rangeM: 500 });
  markAtmosphereTouched();
  resetRangeSolverStateForTests();
  assert.equal(loadRangeSolverTargetState(), null);
  assert.equal(wasAtmosphereTouchedThisSession(), false);
});
