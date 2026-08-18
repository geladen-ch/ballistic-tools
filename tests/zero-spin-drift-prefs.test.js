import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { isZeroForSpinDriftEnabled, setZeroForSpinDriftEnabled } = await import('../src/zero-spin-drift-prefs.js');
const { setCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_zero_for_spin_drift_enabled_v1';

test.beforeEach(() => {
  removeCookie(COOKIE_NAME);
});

test('defaults to off, unlike spin drift\'s own library-style toggles', () => {
  assert.equal(isZeroForSpinDriftEnabled(), false);
});

test('setZeroForSpinDriftEnabled persists and is read back', () => {
  setZeroForSpinDriftEnabled(true);
  assert.equal(isZeroForSpinDriftEnabled(), true);
  setZeroForSpinDriftEnabled(false);
  assert.equal(isZeroForSpinDriftEnabled(), false);
});

test('a garbage/tampered cookie value falls back to the default rather than being trusted verbatim', () => {
  setCookie(COOKIE_NAME, 'not-a-boolean');
  assert.equal(isZeroForSpinDriftEnabled(), false);
});
