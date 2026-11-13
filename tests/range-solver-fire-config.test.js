import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { FIRE_CONFIG_DEFAULTS, getFireConfig, setFireConfig, onFireConfigChange, resetFireConfigForTests } = await import('../src/range-solver-fire-config.js');
const { isScopeViewOn, setScopeViewOn } = await import('../src/range-solver-prefs.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE = 'ballistics_range_solver_fire_config_v1';
const SCOPE_COOKIE = 'ballistics_range_solver_scope_view_v1';
const ROWS_COOKIE = 'ballistics_range_card_row_count_v1';

test.beforeEach(() => {
  resetFireConfigForTests();
  removeCookie(COOKIE);
  removeCookie(SCOPE_COOKIE);
  removeCookie(ROWS_COOKIE);
});

test('defaults: readout, list and picker on, Optimal fit on, LoS not ignored, scope view off', () => {
  assert.deepEqual(getFireConfig(), { scope: false, ...FIRE_CONFIG_DEFAULTS, listRows: 6 });
  assert.deepEqual(FIRE_CONFIG_DEFAULTS, { readout: true, list: true, picker: true, listRowsOptimal: true, ignoreLos: false });
});

test('a change survives a round trip through the cookie', () => {
  setFireConfig({ readout: false, picker: false, listRowsOptimal: false, ignoreLos: true });
  assert.deepEqual(JSON.parse(getCookie(COOKIE)), { readout: false, list: true, picker: false, listRowsOptimal: false, ignoreLos: true });
  assert.deepEqual(getFireConfig(), { scope: false, readout: false, list: true, picker: false, listRowsOptimal: false, ignoreLos: true, listRows: 6 });
});

test('a malformed cookie, or fields that are not booleans, fall back to the defaults', () => {
  setCookie(COOKIE, '{not json');
  assert.deepEqual(getFireConfig(), { scope: false, ...FIRE_CONFIG_DEFAULTS, listRows: 6 });
  setCookie(COOKIE, JSON.stringify({ readout: 'no', list: false, picker: 1, extra: true }));
  assert.deepEqual(getFireConfig(), { scope: false, ...FIRE_CONFIG_DEFAULTS, list: false, listRows: 6 });
  setCookie(COOKIE, JSON.stringify([true, false]));
  assert.deepEqual(getFireConfig(), { scope: false, ...FIRE_CONFIG_DEFAULTS, listRows: 6 });
});

test('the scope view keeps its own cookie, in both directions', () => {
  setScopeViewOn(true);
  assert.equal(getFireConfig().scope, true);
  setFireConfig({ scope: false });
  assert.equal(isScopeViewOn(), false);
  assert.equal(getCookie(SCOPE_COOKIE), 'false');
  assert.equal(JSON.parse(getCookie(COOKIE)).scope, undefined, 'scope is not written to the fire config cookie');
});

test('the fixed row count goes through its own cookie, clamped, and notifies like any other change', () => {
  const seen = [];
  onFireConfigChange((c) => seen.push(c.listRows));
  setFireConfig({ listRows: 9 });
  assert.equal(getCookie(ROWS_COOKIE), '9');
  setFireConfig({ listRows: 40 });
  assert.equal(getFireConfig().listRows, 12);
  assert.deepEqual(seen, [9, 12]);
});

test('listeners fire once per real change, with the new configuration, and can unsubscribe', () => {
  const seen = [];
  const off = onFireConfigChange((c) => seen.push(c));
  setFireConfig({ list: false, scope: true });
  setFireConfig({ list: false });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].list, false);
  assert.equal(seen[0].scope, true);
  off();
  setFireConfig({ list: true });
  assert.equal(seen.length, 1);
});
