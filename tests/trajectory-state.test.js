import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';

installFakeDom();

const {
  loadTrajectoryInputsState, saveTrajectoryInputsState, resetTrajectoryStateForTests
} = await import('../src/trajectory-state.js');
const { getCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_trajectory_state_v1';

test.beforeEach(() => {
  resetTrajectoryStateForTests();
  removeCookie(COOKIE_NAME);
});

test('starts out null (nothing restored on a first-ever visit)', () => {
  assert.equal(loadTrajectoryInputsState(), null);
});

test('save persists and is readable back', () => {
  saveTrajectoryInputsState({ maxRange: 1500, rangeStep: 50, losAngleDeg: 10 });
  assert.deepEqual(loadTrajectoryInputsState(), { maxRange: 1500, rangeStep: 50, losAngleDeg: 10 });
});

test('each save merges into the saved state rather than replacing it outright', () => {
  saveTrajectoryInputsState({ maxRange: 1500 });
  saveTrajectoryInputsState({ rangeStep: 50 });
  assert.deepEqual(loadTrajectoryInputsState(), { maxRange: 1500, rangeStep: 50 });
});

test('persists to a single cookie a fresh module load would pick up', async () => {
  saveTrajectoryInputsState({ maxRange: 1800, rangeStep: 25, losAngleDeg: -5 });
  assert.ok(getCookie(COOKIE_NAME), 'expected the state cookie to be written');

  const fresh = await import(`../src/trajectory-state.js?reload=${freshId()}`);
  assert.deepEqual(fresh.loadTrajectoryInputsState(), { maxRange: 1800, rangeStep: 25, losAngleDeg: -5 });
});

test('resetTrajectoryStateForTests() clears the saved state in memory (not the cookie)', () => {
  saveTrajectoryInputsState({ maxRange: 1500 });
  resetTrajectoryStateForTests();
  assert.equal(loadTrajectoryInputsState(), null);
});
