import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';

installFakeDom();

const {
  loadCdMachCurveAtmosphereState, saveCdMachCurveAtmosphereState,
  loadCdMachCurveInputsState, saveCdMachCurveInputsState,
  resetCdMachCurveStateForTests
} = await import('../src/cd-mach-curve-state.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_cd_mach_curve_state_v2';
const V1_COOKIE_NAME = 'ballistics_cd_mach_curve_state_v1';

test.beforeEach(() => {
  resetCdMachCurveStateForTests();
  removeCookie(COOKIE_NAME);
  removeCookie(V1_COOKIE_NAME);
});

test('defaults to genuine ICAO standard atmosphere at sea level, including humidity', () => {
  assert.deepEqual(loadCdMachCurveAtmosphereState(), {
    atmospherePreset: 'standard', altitudeM: 0,
    tempC: 15, pressurePa: 101325, humidity: 0
  });
});

test('save persists and is readable back, overriding the defaults', () => {
  saveCdMachCurveAtmosphereState({ atmospherePreset: 'custom', tempC: 10, pressurePa: 99000, humidity: 0.4 });
  assert.deepEqual(loadCdMachCurveAtmosphereState(), {
    atmospherePreset: 'custom', altitudeM: 0,
    tempC: 10, pressurePa: 99000, humidity: 0.4
  });
});

test('each save merges into the saved state rather than replacing it outright', () => {
  saveCdMachCurveAtmosphereState({ tempC: 10 });
  saveCdMachCurveAtmosphereState({ pressurePa: 99000 });
  assert.deepEqual(loadCdMachCurveAtmosphereState(), {
    atmospherePreset: 'standard', altitudeM: 0,
    tempC: 10, pressurePa: 99000, humidity: 0
  });
});

test('persists to a single cookie a fresh module load would pick up', async () => {
  saveCdMachCurveAtmosphereState({ atmospherePreset: 'swiss', tempC: 7, pressurePa: 92530, humidity: 0 });
  assert.ok(getCookie(COOKIE_NAME), 'expected the state cookie to be written');

  const fresh = await import(`../src/cd-mach-curve-state.js?reload=${freshId()}`);
  assert.deepEqual(fresh.loadCdMachCurveAtmosphereState(), {
    atmospherePreset: 'swiss', altitudeM: 0, tempC: 7, pressurePa: 92530, humidity: 0
  });
});

test('resetCdMachCurveStateForTests() clears the saved state in memory (not the cookie)', () => {
  saveCdMachCurveAtmosphereState({ tempC: 10 });
  resetCdMachCurveStateForTests();
  assert.equal(loadCdMachCurveAtmosphereState().tempC, 15);
});

test('inputs slice starts out null (nothing restored on a first-ever visit)', () => {
  assert.equal(loadCdMachCurveInputsState(), null);
});

test('saving inputs persists and is readable back', () => {
  saveCdMachCurveInputsState({ velocityTableText: '0 850\n100 800\n200 750', massKg: 0.0092, caliberM: 0.0069, tableUnitSystem: 'archaic', showCalculated: true, saveSource: 'calculated' });
  assert.deepEqual(loadCdMachCurveInputsState(), {
    velocityTableText: '0 850\n100 800\n200 750', massKg: 0.0092, caliberM: 0.0069,
    tableUnitSystem: 'archaic', showCalculated: true, saveSource: 'calculated'
  });
});

test('each inputs save merges into the saved state rather than replacing it outright', () => {
  saveCdMachCurveInputsState({ massKg: 0.01 });
  saveCdMachCurveInputsState({ caliberM: 0.0078 });
  assert.deepEqual(loadCdMachCurveInputsState(), { massKg: 0.01, caliberM: 0.0078 });
});

test('saving the inputs slice never touches the atmosphere slice, and vice versa', () => {
  saveCdMachCurveInputsState({ massKg: 0.01 });
  saveCdMachCurveAtmosphereState({ tempC: 20 });

  assert.deepEqual(loadCdMachCurveInputsState(), { massKg: 0.01 });
  assert.equal(loadCdMachCurveAtmosphereState().tempC, 20);
});

test('inputs persist to the same single cookie a fresh module load would pick up', async () => {
  saveCdMachCurveInputsState({ velocityTableText: '0 850\n100 800\n200 750', massKg: 0.0092 });

  const fresh = await import(`../src/cd-mach-curve-state.js?reload=${freshId()}`);
  assert.deepEqual(fresh.loadCdMachCurveInputsState(), { velocityTableText: '0 850\n100 800\n200 750', massKg: 0.0092 });
});

test('resetCdMachCurveStateForTests() clears the inputs slice too (not the cookie)', () => {
  saveCdMachCurveInputsState({ massKg: 0.01 });
  resetCdMachCurveStateForTests();
  assert.equal(loadCdMachCurveInputsState(), null);
});

test('the cookie holds the atmosphere in SI, as in memory', () => {
  saveCdMachCurveAtmosphereState({ tempC: 7, pressurePa: 92530, humidity: 0.2 });
  assert.deepEqual(JSON.parse(getCookie(COOKIE_NAME)).atmosphere, { tempC: 7, pressurePa: 92530, humidity: 0.2 });
  assert.equal(getCookie(V1_COOKIE_NAME), null);
});

test('a v1 cookie (hPa, percent) is converted once into v2, and left in place', async () => {
  const v1 = { atmosphere: { tempC: 3, pressureHpa: 990, humidityPct: 55 }, inputs: { tableUnits: 'metric' } };
  setCookie(V1_COOKIE_NAME, JSON.stringify(v1));
  const fresh = await import(`../src/cd-mach-curve-state.js?reload=${freshId()}`);
  const atmosphere = fresh.loadCdMachCurveAtmosphereState();
  assert.equal(atmosphere.pressurePa, 99000);
  assert.equal(atmosphere.humidity, 0.55);
  assert.deepEqual(fresh.loadCdMachCurveInputsState(), { tableUnits: 'metric' });
  assert.deepEqual(JSON.parse(getCookie(COOKIE_NAME)).atmosphere, { tempC: 3, pressurePa: 99000, humidity: 0.55 });
  assert.deepEqual(JSON.parse(getCookie(V1_COOKIE_NAME)), v1);
});
