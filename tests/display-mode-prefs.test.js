import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';

installFakeDom();

const {
  DISPLAY_MODE_CHOICES, getDisplayMode, setDisplayMode, onDisplayModeChange, resetDisplayModePrefsForTests
} = await import('../src/display-mode-prefs.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

test.beforeEach(() => resetDisplayModePrefsForTests());

test('defaults to "auto"', () => {
  assert.equal(getDisplayMode(), 'auto');
});

test('setDisplayMode updates the read value and persists to a cookie', () => {
  setDisplayMode('mobile');
  assert.equal(getDisplayMode(), 'mobile');
  assert.equal(getCookie('ballistics_display_mode_v1'), 'mobile');
});

test('a garbage/tampered cookie value falls back to "auto" rather than being trusted verbatim', async () => {
  setCookie('ballistics_display_mode_v1', 'not-a-real-mode');
  const fresh = await import(`../src/display-mode-prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getDisplayMode(), 'auto');
  removeCookie('ballistics_display_mode_v1');
});

test('DISPLAY_MODE_CHOICES covers exactly what get/set accept', () => {
  assert.deepEqual(DISPLAY_MODE_CHOICES.map((c) => c.value), ['auto', 'desktop', 'mobile']);
});

test('setDisplayMode notifies listeners with the new mode', () => {
  const seen = [];
  const unsubscribe = onDisplayModeChange((mode) => seen.push(mode));
  setDisplayMode('desktop');
  setDisplayMode('mobile');
  assert.deepEqual(seen, ['desktop', 'mobile']);
  unsubscribe();
  setDisplayMode('auto');
  assert.deepEqual(seen, ['desktop', 'mobile']); // no longer listening
});

test('setDisplayMode ignores an unrecognized value', () => {
  setDisplayMode('mobile');
  setDisplayMode('bogus');
  assert.equal(getDisplayMode(), 'mobile');
});

test('a value survives a fresh module load (session-to-session persistence)', async () => {
  setDisplayMode('desktop');
  const fresh = await import(`../src/display-mode-prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getDisplayMode(), 'desktop');
});
