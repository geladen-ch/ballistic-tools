import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';

installFakeDom();

const {
  loadHitProbabilityState, saveHitProbabilityState, resetHitProbabilityStateForTests
} = await import('../src/hit-probability-state.js');
const { getCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_hit_probability_state_v1';

test.beforeEach(() => {
  resetHitProbabilityStateForTests();
  removeCookie(COOKIE_NAME);
});

test('starts out null (nothing restored on a first-ever visit)', () => {
  assert.equal(loadHitProbabilityState(), null);
});

test('save persists and is readable back', () => {
  saveHitProbabilityState({ targetRange: 600, windMedianError: 1 });
  assert.deepEqual(loadHitProbabilityState(), { targetRange: 600, windMedianError: 1 });
});

test('each save merges into the saved state rather than replacing it outright', () => {
  saveHitProbabilityState({ targetRange: 600 });
  saveHitProbabilityState({ windMedianError: 1 });
  assert.deepEqual(loadHitProbabilityState(), { targetRange: 600, windMedianError: 1 });
});

test('persists to a single cookie a fresh module load would pick up', async () => {
  saveHitProbabilityState({ targetRange: 800, illustrationZoom: 2, impactsToScale: false });
  assert.ok(getCookie(COOKIE_NAME), 'expected the state cookie to be written');

  const fresh = await import(`../src/hit-probability-state.js?reload=${freshId()}`);
  assert.deepEqual(fresh.loadHitProbabilityState(), { targetRange: 800, illustrationZoom: 2, impactsToScale: false });
});

test('resetHitProbabilityStateForTests() clears the saved state in memory (not the cookie)', () => {
  saveHitProbabilityState({ targetRange: 600 });
  resetHitProbabilityStateForTests();
  assert.equal(loadHitProbabilityState(), null);
});
