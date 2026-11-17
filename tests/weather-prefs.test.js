import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { getCookie, setCookie } = await import('../src/cookies.js');
const { kmToM, minToS } = await import('../src/quantity.js');
const {
  ONLINE_WEATHER_DEFAULTS, getOnlineWeatherSettings, isOnlineWeatherEnabled, updateOnlineWeatherSettings, setServiceMode,
  onOnlineWeatherChange, reloadOnlineWeatherPrefsForTests
} = await import('../src/online-weather-prefs.js');

const COOKIE = 'ballistics_online_weather_v1';
test.beforeEach(() => {
  setCookie(COOKIE, JSON.stringify({}));
  reloadOnlineWeatherPrefsForTests();
});

test('defaults: off, 150 km, 90 min, both estimation switches on, no service choices', () => {
  const s = getOnlineWeatherSettings();
  assert.deepEqual(s, { enabled: false, searchRadiusM: 150000, maxAgeS: 5400, combine: true, timeCorrect: true, sources: {} });
  assert.deepEqual(s, { ...ONLINE_WEATHER_DEFAULTS, sources: {} });
  assert.equal(s.searchRadiusM, kmToM(150)); assert.equal(s.maxAgeS, minToS(90));
  assert.equal(isOnlineWeatherEnabled(), false);
});

test('changes are stored in SI, persisted to the cookie and read back after a reload', () => {
  updateOnlineWeatherSettings({ enabled: true, searchRadiusM: 80000, maxAgeS: 1800, combine: false, timeCorrect: false });
  assert.equal(isOnlineWeatherEnabled(), true);
  const stored = JSON.parse(getCookie(COOKIE));
  assert.deepEqual(stored, { enabled: true, searchRadiusM: 80000, maxAgeS: 1800, combine: false, timeCorrect: false, sources: {} });
  reloadOnlineWeatherPrefsForTests();
  assert.deepEqual(getOnlineWeatherSettings(), stored);
});

test('values are clamped to the allowed range; garbage falls back to the default', () => {
  updateOnlineWeatherSettings({ searchRadiusM: 5, maxAgeS: 1e9 });
  assert.equal(getOnlineWeatherSettings().searchRadiusM, 10000);
  assert.equal(getOnlineWeatherSettings().maxAgeS, 21600);
  setCookie(COOKIE, JSON.stringify({ enabled: 'yes', searchRadiusM: 'far', maxAgeS: null, combine: 1, sources: { a: 'on', b: 'off', c: 'auto', d: 5 } }));
  reloadOnlineWeatherPrefsForTests();
  assert.deepEqual(getOnlineWeatherSettings(), { enabled: false, searchRadiusM: 150000, maxAgeS: 5400, combine: true, timeCorrect: true, sources: { b: 'off', c: 'auto' } });
  setCookie(COOKIE, '{not json');
  reloadOnlineWeatherPrefsForTests();
  assert.equal(getOnlineWeatherSettings().searchRadiusM, 150000);
});

test('a service mode equal to its default is not stored; others are', () => {
  setServiceMode('dmi', 'off', 'auto');
  assert.deepEqual(getOnlineWeatherSettings().sources, { dmi: 'off' });
  setServiceMode('dmi', 'auto', 'auto');
  assert.deepEqual(getOnlineWeatherSettings().sources, {});
  setServiceMode('new', 'auto', 'off');                     // an unvalidated service the user switched on
  assert.deepEqual(getOnlineWeatherSettings().sources, { new: 'auto' });
  assert.deepEqual(JSON.parse(getCookie(COOKIE)).sources, { new: 'auto' });
});

test('the returned settings are copies; listeners hear every change and can unsubscribe', () => {
  const seen = [];
  const off = onOnlineWeatherChange((s) => seen.push(s.enabled));
  getOnlineWeatherSettings().sources.x = 'off';
  assert.deepEqual(getOnlineWeatherSettings().sources, {});
  updateOnlineWeatherSettings({ enabled: true });
  setServiceMode('x', 'off', 'auto');
  off();
  updateOnlineWeatherSettings({ enabled: false });
  assert.deepEqual(seen, [true, true]);
});
