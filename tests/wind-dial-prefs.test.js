import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { getWindDialAppearance, setWindDialAppearance, WIND_DIAL_APPEARANCE_CHOICES } = await import('../src/wind-dial-prefs.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

test('defaults to "clock"', () => {
  removeCookie('ballistics_wind_dial_appearance_v1');
  assert.equal(getWindDialAppearance(), 'clock');
});

test('setWindDialAppearance updates the read value and persists to a cookie', () => {
  setWindDialAppearance('clean');
  assert.equal(getWindDialAppearance(), 'clean');
  assert.equal(getCookie('ballistics_wind_dial_appearance_v1'), 'clean');
  setWindDialAppearance('clock');
});

test('a garbage/tampered cookie value falls back to the default rather than being trusted verbatim', () => {
  setCookie('ballistics_wind_dial_appearance_v1', 'not-a-real-skin');
  assert.equal(getWindDialAppearance(), 'clock');
  removeCookie('ballistics_wind_dial_appearance_v1');
});

test('a value survives a fresh module load (session-to-session persistence)', async () => {
  setWindDialAppearance('clean');
  const fresh = await import(`../src/wind-dial-prefs.js?reload=${Date.now()}`);
  assert.equal(fresh.getWindDialAppearance(), 'clean');
  setWindDialAppearance('clock');
});

test('WIND_DIAL_APPEARANCE_CHOICES covers exactly what get/set accept', () => {
  assert.deepEqual(WIND_DIAL_APPEARANCE_CHOICES.map((c) => c.value), ['clock', 'clean']);
});
