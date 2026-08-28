import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { getSpinDriftMode, setSpinDriftMode, SPIN_DRIFT_MODE_CHOICES } = await import('../src/spin-drift-prefs.js');
const { setCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_spin_drift_mode_v1';
const LEGACY_ENABLED_COOKIE_NAME = 'ballistics_spin_drift_enabled_v1';

test.beforeEach(() => {
  removeCookie(COOKIE_NAME);
  removeCookie(LEGACY_ENABLED_COOKIE_NAME);
});

test('defaults to off with no cookie of either kind saved', () => {
  assert.equal(getSpinDriftMode(), 'off');
});

test('setSpinDriftMode persists and is read back, for every known mode', () => {
  for (const { value } of SPIN_DRIFT_MODE_CHOICES) {
    setSpinDriftMode(value);
    assert.equal(getSpinDriftMode(), value);
  }
});

test('an unrecognized mode is rejected by setSpinDriftMode — the cookie is left untouched', () => {
  setSpinDriftMode('litz');
  setSpinDriftMode('nonsense');
  assert.equal(getSpinDriftMode(), 'litz');
});

test('a garbage/tampered mode cookie falls back to off rather than being trusted verbatim', () => {
  setCookie(COOKIE_NAME, 'nonsense');
  assert.equal(getSpinDriftMode(), 'off');
});

test('migrates the older on/off boolean cookie to litz, the only method it could have meant, when the new cookie has never been saved', () => {
  setCookie(LEGACY_ENABLED_COOKIE_NAME, 'true');
  assert.equal(getSpinDriftMode(), 'litz');
});

test('the legacy boolean is ignored once the new mode cookie has been saved at all, even to off', () => {
  setCookie(LEGACY_ENABLED_COOKIE_NAME, 'true');
  setSpinDriftMode('off');
  assert.equal(getSpinDriftMode(), 'off');
});

test('a legacy boolean of "false" (or anything but "true") still defaults to off, same as no legacy cookie at all', () => {
  setCookie(LEGACY_ENABLED_COOKIE_NAME, 'false');
  assert.equal(getSpinDriftMode(), 'off');
});
