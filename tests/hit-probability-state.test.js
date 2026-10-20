import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';

installFakeDom();

const {
  loadHitProbabilityState, saveHitProbabilityState, resetHitProbabilityStateForTests
} = await import('../src/hit-probability-state.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_hit_probability_state_v2';
const V1_COOKIE_NAME = 'ballistics_hit_probability_state_v1';

test.beforeEach(() => {
  resetHitProbabilityStateForTests();
  removeCookie(COOKIE_NAME);
  removeCookie(V1_COOKIE_NAME);
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

test('field values are stored as held in memory, in their engine units', () => {
  const state = { pressureMedianError: 700, aimOffsetX: 0.03, benchPrecision: 0.00014, distanceMedianError: 0.04 };
  saveHitProbabilityState(state);
  assert.deepEqual(JSON.parse(getCookie(COOKIE_NAME)), state);
  assert.equal(getCookie(V1_COOKIE_NAME), null, 'the v1 cookie is never written');
});

test('a v1 cookie (cm, mrad, hPa, percent under the same field ids) is converted once into v2, and left in place', async () => {
  const v1 = {
    pressureMedianError: 7, pressureMedianErrorPreset: 'byAltitude', aimOffsetX: 3, aimOffsetY: -4, circleGongDiameter: 25, rectPlateWidth: 40, rectPlateHeight: 50,
    benchPrecision: 0.14, spotterMeasure: 0.1, distanceMedianError: 4, movingTargetSpeedError: 20, simulationShots: 1000
  };
  setCookie(V1_COOKIE_NAME, JSON.stringify(v1));
  const fresh = await import(`../src/hit-probability-state.js?reload=${freshId()}`);
  const state = fresh.loadHitProbabilityState();
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-15, `${a} != ${b}`);
  assert.equal(state.pressureMedianError, 700);
  assert.equal(state.pressureMedianErrorPreset, 'byAltitude');
  assert.equal(state.simulationShots, 1000);
  [[state.aimOffsetX, 0.03], [state.aimOffsetY, -0.04], [state.circleGongDiameter, 0.25], [state.rectPlateWidth, 0.4], [state.rectPlateHeight, 0.5],
    [state.benchPrecision, 0.00014], [state.spotterMeasure, 0.0001], [state.distanceMedianError, 0.04], [state.movingTargetSpeedError, 0.2]].forEach(([a, b]) => close(a, b));
  assert.deepEqual(JSON.parse(getCookie(COOKIE_NAME)), state, 'written under v2 straight away');
  assert.deepEqual(JSON.parse(getCookie(V1_COOKIE_NAME)), v1, 'v1 kept for a rollback');
});

test('a v2 cookie wins over a v1 one', async () => {
  setCookie(V1_COOKIE_NAME, JSON.stringify({ aimOffsetX: 3 }));
  setCookie(COOKIE_NAME, JSON.stringify({ aimOffsetX: 0.05 }));
  const fresh = await import(`../src/hit-probability-state.js?reload=${freshId()}`);
  assert.equal(fresh.loadHitProbabilityState().aimOffsetX, 0.05);
});
