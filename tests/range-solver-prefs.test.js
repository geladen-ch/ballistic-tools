import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';

installFakeDom();

const {
  THEME_CHOICES, getTheme, setTheme, onThemeChange, resetThemeForTests,
  INDICATOR_STYLE_CHOICES, getIndicatorStyle, setIndicatorStyle
} = await import('../src/range-solver-prefs.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

const THEME_COOKIE_NAME = 'ballistics_theme_v1';
const LEGACY_HIGH_CONTRAST_COOKIE_NAME = 'ballistics_range_solver_high_contrast_v1';
const INDICATOR_COOKIE_NAME = 'ballistics_range_solver_indicator_style_v1';

test.beforeEach(() => {
  resetThemeForTests();
  removeCookie(THEME_COOKIE_NAME);
  removeCookie(LEGACY_HIGH_CONTRAST_COOKIE_NAME);
  removeCookie(INDICATOR_COOKIE_NAME);
});

test('THEME_CHOICES covers exactly what get/set accept, "dark" first (the default)', () => {
  assert.deepEqual(THEME_CHOICES.map((c) => c.value), ['dark', 'high-contrast-light', 'high-contrast-dark']);
});

test('defaults to "dark"', () => {
  assert.equal(getTheme(), 'dark');
});

test('setTheme updates the read value and persists to a cookie', () => {
  setTheme('high-contrast-dark');
  assert.equal(getTheme(), 'high-contrast-dark');
  assert.equal(getCookie(THEME_COOKIE_NAME), 'high-contrast-dark');
});

test('setTheme back to "dark" persists too, not just a non-default choice', () => {
  setTheme('high-contrast-light');
  setTheme('dark');
  assert.equal(getTheme(), 'dark');
  assert.equal(getCookie(THEME_COOKIE_NAME), 'dark');
});

test('setTheme ignores an unrecognized value', () => {
  setTheme('high-contrast-dark');
  setTheme('neon');
  assert.equal(getTheme(), 'high-contrast-dark');
});

test('a garbage/tampered cookie value falls back to "dark" rather than being trusted verbatim', async () => {
  setCookie(THEME_COOKIE_NAME, 'not-a-real-theme');
  const fresh = await import(`../src/range-solver-prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getTheme(), 'dark');
});

test('setTheme notifies listeners with the new value', () => {
  const seen = [];
  const unsubscribe = onThemeChange((value) => seen.push(value));
  setTheme('high-contrast-light');
  setTheme('high-contrast-dark');
  assert.deepEqual(seen, ['high-contrast-light', 'high-contrast-dark']);
  unsubscribe();
  setTheme('dark');
  assert.deepEqual(seen, ['high-contrast-light', 'high-contrast-dark']); // no longer listening
});

test('setTheme to the same value twice in a row only notifies once (no-op on an unchanged value)', () => {
  const seen = [];
  onThemeChange((value) => seen.push(value));
  setTheme('high-contrast-light');
  setTheme('high-contrast-light');
  assert.deepEqual(seen, ['high-contrast-light']);
});

test('a value survives a fresh module load (session-to-session persistence)', async () => {
  setTheme('high-contrast-dark');
  const fresh = await import(`../src/range-solver-prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getTheme(), 'high-contrast-dark');
});

test('someone who had the old boolean high-contrast toggle on migrates to "high-contrast-light" (the only high-contrast theme that existed before this one)', async () => {
  setCookie(LEGACY_HIGH_CONTRAST_COOKIE_NAME, 'true');
  const fresh = await import(`../src/range-solver-prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getTheme(), 'high-contrast-light');
});

test('the legacy cookie is ignored once a real theme cookie already exists', async () => {
  setCookie(LEGACY_HIGH_CONTRAST_COOKIE_NAME, 'true');
  setCookie(THEME_COOKIE_NAME, 'high-contrast-dark');
  const fresh = await import(`../src/range-solver-prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getTheme(), 'high-contrast-dark');
});

test('someone who never touched the old boolean toggle still defaults to "dark"', async () => {
  removeCookie(LEGACY_HIGH_CONTRAST_COOKIE_NAME);
  const fresh = await import(`../src/range-solver-prefs.js?reload=${freshId()}`);
  assert.equal(fresh.getTheme(), 'dark');
});

test('INDICATOR_STYLE_CHOICES covers exactly what get/set accept', () => {
  assert.deepEqual(INDICATOR_STYLE_CHOICES.map((c) => c.value), ['signs', 'arrows']);
});

test('indicator style defaults to "signs"', () => {
  assert.equal(getIndicatorStyle(), 'signs');
});

test('setIndicatorStyle updates the read value and persists to a cookie', () => {
  setIndicatorStyle('arrows');
  assert.equal(getIndicatorStyle(), 'arrows');
  assert.equal(getCookie(INDICATOR_COOKIE_NAME), 'arrows');
});

test('a garbage/tampered cookie value falls back to "signs" rather than being trusted verbatim', () => {
  setCookie(INDICATOR_COOKIE_NAME, 'not-a-real-style');
  assert.equal(getIndicatorStyle(), 'signs');
});

test('setIndicatorStyle ignores an unrecognized value', () => {
  setIndicatorStyle('arrows');
  setIndicatorStyle('bogus');
  assert.equal(getIndicatorStyle(), 'arrows');
});
