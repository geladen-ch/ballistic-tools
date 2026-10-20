import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';
import { degToRad } from '../src/quantity.js';

installFakeDom();

const {
  loadRangeSolverTargetState, saveRangeSolverTargetState,
  loadRangeSolverWindState, saveRangeSolverWindState,
  loadRangeSolverAtmosphereState, saveRangeSolverAtmosphereState,
  loadRangeSolverLocationState, saveRangeSolverLocationState,
  markAtmosphereTouched, wasAtmosphereTouchedThisSession,
  resetRangeSolverStateForTests
} = await import('../src/range-solver-state.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_range_solver_state_v2';
const V1_COOKIE_NAME = 'ballistics_range_solver_state_v1';

test.beforeEach(() => {
  resetRangeSolverStateForTests();
  removeCookie(COOKIE_NAME);
  removeCookie(V1_COOKIE_NAME);
});

test('all four slices start out null', () => {
  assert.equal(loadRangeSolverTargetState(), null);
  assert.equal(loadRangeSolverWindState(), null);
  assert.equal(loadRangeSolverAtmosphereState(), null);
  assert.equal(loadRangeSolverLocationState(), null);
});

test('saveRangeSolverTargetState persists and is readable back', () => {
  saveRangeSolverTargetState({ rangeM: 500, losAngleRad: degToRad(10) });
  assert.deepEqual(loadRangeSolverTargetState(), { rangeM: 500, losAngleRad: degToRad(10) });
});

test('each save merges into its own slice rather than replacing it outright', () => {
  saveRangeSolverTargetState({ rangeM: 500 });
  saveRangeSolverTargetState({ losAngleRad: degToRad(5) });
  assert.deepEqual(loadRangeSolverTargetState(), { rangeM: 500, losAngleRad: degToRad(5) });
});

test('saving one slice never touches the others', () => {
  saveRangeSolverTargetState({ rangeM: 500 });
  saveRangeSolverWindState({ speed: 2, angleRad: Math.PI / 4 });
  saveRangeSolverAtmosphereState({ tempC: 10 });
  saveRangeSolverLocationState({ locationId: 'loc-1', targetId: 'tgt-1' });

  assert.deepEqual(loadRangeSolverTargetState(), { rangeM: 500 });
  assert.deepEqual(loadRangeSolverWindState(), { speed: 2, angleRad: Math.PI / 4 });
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
  saveRangeSolverTargetState({ rangeM: 777, losAngleRad: 0 });
  saveRangeSolverWindState({ speed: 1.5, angleRad: Math.PI / 2 });

  assert.ok(getCookie(COOKIE_NAME), 'expected the state cookie to be written');

  const fresh = await import(`../src/range-solver-state.js?reload=${freshId()}`);
  assert.deepEqual(fresh.loadRangeSolverTargetState(), { rangeM: 777, losAngleRad: 0 });
  assert.deepEqual(fresh.loadRangeSolverWindState(), { speed: 1.5, angleRad: Math.PI / 2 });
  assert.equal(JSON.parse(getCookie(COOKIE_NAME)).wind.angleRad, Math.PI / 2, 'stored in radians');
});

test('resetRangeSolverStateForTests() clears every slice in memory (not the cookie), and the touched flag', () => {
  saveRangeSolverTargetState({ rangeM: 500 });
  markAtmosphereTouched();
  resetRangeSolverStateForTests();
  assert.equal(loadRangeSolverTargetState(), null);
  assert.equal(wasAtmosphereTouchedThisSession(), false);
});

test('every slice is stored in SI, as in memory', () => {
  saveRangeSolverAtmosphereState({ tempC: 12, pressurePa: 95000, humidity: 0.4 });
  saveRangeSolverWindState({ speed: 3, angleRad: Math.PI / 2 });
  const stored = JSON.parse(getCookie(COOKIE_NAME));
  assert.deepEqual(stored.atmosphere, { tempC: 12, pressurePa: 95000, humidity: 0.4 });
  assert.deepEqual(stored.wind, { speed: 3, angleRad: Math.PI / 2 });
  assert.equal(getCookie(V1_COOKIE_NAME), null);
});

test('a v1 cookie (degrees, hPa, percent) is converted once into v2, and left in place', async () => {
  const v1 = { target: { rangeM: 500, losAngleDeg: 30 }, wind: { speed: 4, angle: 90 }, atmosphere: { pressureHpa: 1001, humidityPct: 10 }, location: { locationId: 'L1', targetId: 'T1' } };
  setCookie(V1_COOKIE_NAME, JSON.stringify(v1));
  const fresh = await import(`../src/range-solver-state.js?reload=${freshId()}`);
  assert.deepEqual(fresh.loadRangeSolverAtmosphereState(), { pressurePa: 100100, humidity: 0.1 });
  assert.deepEqual(fresh.loadRangeSolverWindState(), { speed: 4, angleRad: Math.PI / 2 });
  assert.equal(fresh.loadRangeSolverTargetState().rangeM, 500);
  assert.ok(Math.abs(fresh.loadRangeSolverTargetState().losAngleRad - Math.PI / 6) < 1e-15);
  assert.deepEqual(fresh.loadRangeSolverLocationState(), { locationId: 'L1', targetId: 'T1' });
  assert.equal(JSON.parse(getCookie(COOKIE_NAME)).atmosphere.pressurePa, 100100);
  assert.deepEqual(JSON.parse(getCookie(V1_COOKIE_NAME)), v1);
});
