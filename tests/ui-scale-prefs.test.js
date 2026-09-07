import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';

installFakeDom();

const {
  UI_SCALE_CHOICES, getUiScale, setUiScale, onUiScaleChange, resetUiScalePrefsForTests
} = await import('../src/ui-scale-prefs.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

test.beforeEach(() => resetUiScalePrefsForTests());

test('defaults to "100"', () => {
  assert.equal(getUiScale(), '100');
});

test('setUiScale updates the read value and persists to a cookie', () => {
  setUiScale('150');
  assert.equal(getUiScale(), '150');
  assert.equal(getCookie('ballistics_ui_scale_v1'), '150');
});

test('a garbage/tampered cookie value falls back to "100" rather than being trusted verbatim', async () => {
  setCookie('ballistics_ui_scale_v1', 'not-a-real-scale');
  const fresh = await import(`../src/ui-scale-prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getUiScale(), '100');
  removeCookie('ballistics_ui_scale_v1');
});

test('UI_SCALE_CHOICES covers exactly what get/set accept', () => {
  assert.deepEqual(UI_SCALE_CHOICES, ['100', '125', '150', '175', '200']);
});

test('setUiScale notifies listeners with the new scale', () => {
  const seen = [];
  const unsubscribe = onUiScaleChange((scale) => seen.push(scale));
  setUiScale('125');
  setUiScale('200');
  assert.deepEqual(seen, ['125', '200']);
  unsubscribe();
  setUiScale('100');
  assert.deepEqual(seen, ['125', '200']); // no longer listening
});

test('setUiScale ignores an unrecognized value', () => {
  setUiScale('150');
  setUiScale('999');
  assert.equal(getUiScale(), '150');
});

test('a value survives a fresh module load (session-to-session persistence)', async () => {
  setUiScale('175');
  const fresh = await import(`../src/ui-scale-prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getUiScale(), '175');
});
