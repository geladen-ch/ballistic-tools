import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';

installFakeDom();

const { getUnit, setUnit, getAllUnits, resetUnits, onUnitsChange } = await import('../src/prefs.js');
const { getCookie, removeCookie } = await import('../src/cookies.js');
const { UNIT_GROUPS } = await import('../src/units.js');

test('defaults match each unit group\'s defaultUnit', () => {
  const all = getAllUnits();
  for (const [key, group] of Object.entries(UNIT_GROUPS)) {
    assert.equal(all[key], group.defaultUnit);
  }
});

test('setUnit updates the in-memory value and persists it to a cookie', () => {
  setUnit('velocity', 'ft/s');
  assert.equal(getUnit('velocity'), 'ft/s');

  const cookieValue = JSON.parse(getCookie('ballistics_unit_prefs_v1'));
  assert.equal(cookieValue.velocity, 'ft/s');

  resetUnits();
});

test('windSpeed has its own preference, independent of velocity', () => {
  setUnit('velocity', 'ft/s');
  assert.equal(getUnit('windSpeed'), UNIT_GROUPS.windSpeed.defaultUnit);

  setUnit('windSpeed', 'mph');
  assert.equal(getUnit('velocity'), 'ft/s');
  assert.equal(getUnit('windSpeed'), 'mph');

  resetUnits();
});

test('resetUnits restores every group to its default and persists that too', () => {
  setUnit('temperature', 'tempF');
  resetUnits();
  assert.equal(getUnit('temperature'), UNIT_GROUPS.temperature.defaultUnit);

  const cookieValue = JSON.parse(getCookie('ballistics_unit_prefs_v1'));
  assert.equal(cookieValue.temperature, UNIT_GROUPS.temperature.defaultUnit);
});

test('onUnitsChange fires with the updated prefs on both setUnit and resetUnits', () => {
  const seen = [];
  const unsubscribe = onUnitsChange((prefs) => seen.push({ ...prefs }));

  setUnit('pressure', 'inHg');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].pressure, 'inHg');

  resetUnits();
  assert.equal(seen.length, 2);
  assert.equal(seen[1].pressure, UNIT_GROUPS.pressure.defaultUnit);

  unsubscribe();
  setUnit('pressure', 'mmHg');
  assert.equal(seen.length, 2, 'listener should not fire after unsubscribing');
  resetUnits();
});

test('a cookie value survives a fresh module load (session-to-session persistence)', async () => {
  setUnit('altitude', 'ft');

  // Force a genuinely fresh module instance (bypassing the ESM cache) to
  // simulate a new page load reading back whatever was persisted.
  const fresh = await import(`../src/prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getUnit('altitude'), 'ft');

  resetUnits();
});

test('an existing legacy localStorage value is migrated into the cookie on load, then removed', async () => {
  removeCookie('ballistics_unit_prefs_v1'); // simulate a user with no cookie yet
  const legacyKey = 'ballistics-tools:unit-prefs:v1';
  localStorage.setItem(legacyKey, JSON.stringify({ distance: 'yd' }));

  const fresh = await import(`../src/prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getUnit('distance'), 'yd');
  assert.equal(localStorage.getItem(legacyKey), null, 'legacy key should be cleared after migrating');

  const cookieValue = JSON.parse(getCookie('ballistics_unit_prefs_v1'));
  assert.equal(cookieValue.distance, 'yd');

  fresh.resetUnits();
});
