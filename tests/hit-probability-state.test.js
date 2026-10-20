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

test('the pressure estimation error is stored in hPa under its field id, and read back in Pa', async () => {
  saveHitProbabilityState({ pressureMedianError: 700, pressureMedianErrorPreset: 'byAltitude' });
  assert.equal(JSON.parse(getCookie(COOKIE_NAME)).pressureMedianError, 7);
  const fresh = await import(`../src/hit-probability-state.js?reload=${freshId()}`);
  assert.equal(fresh.loadHitProbabilityState().pressureMedianError, 700);
});

test('aim offsets and custom target sizes are stored in cm under their field ids, and read back in metres', async () => {
  saveHitProbabilityState({ aimOffsetX: 0.03, aimOffsetY: -0.04, circleGongDiameter: 0.25, rectPlateWidth: 0.4, rectPlateHeight: 0.5 });
  const stored = JSON.parse(getCookie(COOKIE_NAME));
  assert.deepEqual([stored.aimOffsetX, stored.aimOffsetY, stored.circleGongDiameter, stored.rectPlateWidth, stored.rectPlateHeight], [3, -4, 25, 40, 50]);
  const fresh = await import(`../src/hit-probability-state.js?reload=${freshId()}`);
  const state = fresh.loadHitProbabilityState();
  assert.deepEqual([state.aimOffsetX, state.aimOffsetY, state.circleGongDiameter, state.rectPlateWidth, state.rectPlateHeight], [0.03, -0.04, 0.25, 0.4, 0.5]);
});

test('precisions are stored in mrad and estimation errors in percent under their field ids, and read back in rad and fractions', async () => {
  saveHitProbabilityState({ benchPrecision: 0.00014, spotterMeasure: 0.0001, distanceMedianError: 0.04, movingTargetSpeedError: 0.2 });
  const stored = JSON.parse(getCookie(COOKIE_NAME));
  assert.ok(Math.abs(stored.benchPrecision - 0.14) < 1e-12 && Math.abs(stored.spotterMeasure - 0.1) < 1e-12);
  assert.ok(Math.abs(stored.distanceMedianError - 4) < 1e-12 && Math.abs(stored.movingTargetSpeedError - 20) < 1e-12);
  const fresh = await import(`../src/hit-probability-state.js?reload=${freshId()}`);
  const state = fresh.loadHitProbabilityState();
  assert.ok(Math.abs(state.benchPrecision - 0.00014) < 1e-15 && Math.abs(state.distanceMedianError - 0.04) < 1e-15);
});
