import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  loadCdMachCurveAtmosphereState, saveCdMachCurveAtmosphereState,
  loadCdMachCurveInputsState, saveCdMachCurveInputsState,
  resetCdMachCurveStateForTests
} = await import('../src/cd-mach-curve-state.js');
const { getCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_cd_mach_curve_state_v1';

test.beforeEach(() => {
  resetCdMachCurveStateForTests();
  removeCookie(COOKIE_NAME);
});

test('defaults to genuine ICAO standard atmosphere at sea level, including humidity', () => {
  assert.deepEqual(loadCdMachCurveAtmosphereState(), {
    atmospherePreset: 'standard', altitudeM: 0,
    tempC: 15, pressureHpa: 1013.25, humidityPct: 0
  });
});

test('save persists and is readable back, overriding the defaults', () => {
  saveCdMachCurveAtmosphereState({ atmospherePreset: 'custom', tempC: 10, pressureHpa: 990, humidityPct: 40 });
  assert.deepEqual(loadCdMachCurveAtmosphereState(), {
    atmospherePreset: 'custom', altitudeM: 0,
    tempC: 10, pressureHpa: 990, humidityPct: 40
  });
});

test('each save merges into the saved state rather than replacing it outright', () => {
  saveCdMachCurveAtmosphereState({ tempC: 10 });
  saveCdMachCurveAtmosphereState({ pressureHpa: 990 });
  assert.deepEqual(loadCdMachCurveAtmosphereState(), {
    atmospherePreset: 'standard', altitudeM: 0,
    tempC: 10, pressureHpa: 990, humidityPct: 0
  });
});

test('persists to a single cookie a fresh module load would pick up', async () => {
  saveCdMachCurveAtmosphereState({ atmospherePreset: 'swiss', tempC: 7, pressureHpa: 925.3, humidityPct: 0 });
  assert.ok(getCookie(COOKIE_NAME), 'expected the state cookie to be written');

  const fresh = await import(`../src/cd-mach-curve-state.js?reload=${Date.now()}`);
  assert.deepEqual(fresh.loadCdMachCurveAtmosphereState(), {
    atmospherePreset: 'swiss', altitudeM: 0, tempC: 7, pressureHpa: 925.3, humidityPct: 0
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

  const fresh = await import(`../src/cd-mach-curve-state.js?reload=${Date.now()}`);
  assert.deepEqual(fresh.loadCdMachCurveInputsState(), { velocityTableText: '0 850\n100 800\n200 750', massKg: 0.0092 });
});

test('resetCdMachCurveStateForTests() clears the inputs slice too (not the cookie)', () => {
  saveCdMachCurveInputsState({ massKg: 0.01 });
  resetCdMachCurveStateForTests();
  assert.equal(loadCdMachCurveInputsState(), null);
});
