import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
const { setCookie } = await import('../src/cookies.js');
const { reloadOnlineWeatherPrefsForTests, getOnlineWeatherSettings, updateOnlineWeatherSettings } = await import('../src/online-weather-prefs.js');
const { setWeatherRuntimeForTests } = await import('../src/weather/runtime.js');
const { createAvailability } = await import('../src/weather/availability.js');
const { sources } = await import('../src/weather/sources/index.js');
const { onlineWeatherSection } = await import('../src/ui/weather/online-weather-settings.js');

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const all = (node, test, out = []) => { if (test(node)) out.push(node); for (const c of node.childNodes || []) all(c, test, out); return out; };
const byId = (root, id) => all(root, (n) => n.id === id)[0];
const hostsOf = (urls) => [...new Set(urls.map((u) => new URL(u).host))].sort();

let calls, answers, cleared;
function mount() {
  const container = makeElement('main');
  container.appendChild(onlineWeatherSection().node);
  return container;
}
test.beforeEach(() => {
  calls = []; answers = {}; cleared = 0;
  setCookie('ballistics_online_weather_v1', JSON.stringify({}));
  reloadOnlineWeatherPrefsForTests();
  const probe = async (url) => { calls.push(url); await Promise.resolve(); return { state: answers[new URL(url).host] ?? 'available' }; };
  setWeatherRuntimeForTests({
    net: { probe }, cache: { clear: async () => { cleared++; } }, availability: createAvailability({ probe })
  });
});
test.after(() => setWeatherRuntimeForTests(null));

test('off by default: the options are hidden and no service is contacted', async () => {
  const c = mount();
  assert.equal(byId(c, 'settings-online-weather-enabled').checked, false);
  assert.equal(byId(c, 'settings-online-weather-body').style.display, 'none');
  await flush();
  assert.equal(calls.length, 0);
});

test('switching the feature on shows the options with the PoC defaults and checks every Auto service, once per host', async () => {
  const c = mount();
  const box = byId(c, 'settings-online-weather-enabled');
  box.checked = true; fireEvent(box, 'change');
  assert.equal(getOnlineWeatherSettings().enabled, true);
  assert.equal(byId(c, 'settings-online-weather-body').style.display, '');
  assert.equal(byId(c, 'weatherSearchRadius').value, '150');
  assert.equal(byId(c, 'weatherMaxAge').value, '90');
  assert.equal(byId(c, 'settings-online-weather-combine').checked, true);
  assert.equal(byId(c, 'settings-online-weather-time-correct').checked, true);
  for (const s of sources) assert.equal(byId(c, `settings-online-weather-mode-${s.id}`).value, 'auto', s.id);
  assert.equal(byId(c, 'settings-online-weather-availability-iem').textContent.startsWith('Checking'), true);
  await flush();
  assert.deepEqual(hostsOf(calls), ['api.brightsky.dev', 'api.weather.gc.ca', 'data.geo.admin.ch', 'dataset.api.hub.geosphere.at', 'mesonet.agron.iastate.edu', 'opendataapi.dmi.dk']);
  assert.equal(calls.length, 6);                                      // the three IEM services share one request
  for (const s of sources) assert.match(byId(c, `settings-online-weather-availability-${s.id}`).textContent, /^Reachable \(checked /, s.id);
  assert.equal(byId(c, 'settings-online-weather-unusable').style.display, 'none');
});

test('opening the page with the feature on checks at once; a valid result is not asked again on the next visit', async () => {
  updateOnlineWeatherSettings({ enabled: true });
  mount(); await flush();
  assert.equal(calls.length, 6);
  mount(); await flush();
  assert.equal(calls.length, 6);                                      // cached for 30 minutes
});

test('switching a service to Auto forces a check of it; Off stores the choice and shows no hint', async () => {
  updateOnlineWeatherSettings({ enabled: true, sources: { dmi: 'off' } });
  const c = mount(); await flush();
  assert.equal(calls.length, 5);                                      // dmi is Off: not checked
  assert.equal(byId(c, 'settings-online-weather-availability-dmi').textContent, '');
  const sel = byId(c, 'settings-online-weather-mode-dmi');
  sel.value = 'auto'; fireEvent(sel, 'change'); await flush();
  assert.equal(calls.length, 6); assert.ok(calls.at(-1).includes('opendataapi.dmi.dk'));
  assert.deepEqual(getOnlineWeatherSettings().sources, {});          // Auto is dmi's default: nothing stored
  assert.match(byId(c, 'settings-online-weather-availability-dmi').textContent, /^Reachable/);
  sel.value = 'off'; fireEvent(sel, 'change');
  assert.deepEqual(getOnlineWeatherSettings().sources, { dmi: 'off' });
  assert.equal(byId(c, 'settings-online-weather-availability-dmi').textContent, '');
});

test('"Check availability" forces a re-check of all Auto services and is disabled while it runs', async () => {
  updateOnlineWeatherSettings({ enabled: true });
  const c = mount(); await flush();
  const button = byId(c, 'settings-online-weather-check');
  assert.equal(button.disabled, false);
  fireEvent(button, 'click');
  assert.equal(button.disabled, true);
  await flush();
  assert.equal(calls.length, 12);
  assert.equal(button.disabled, false);
});

test('unusable hint: shown when no Auto service is reachable, hidden as soon as one is', async () => {
  for (const h of ['mesonet.agron.iastate.edu', 'data.geo.admin.ch', 'dataset.api.hub.geosphere.at', 'api.brightsky.dev', 'opendataapi.dmi.dk', 'api.weather.gc.ca']) answers[h] = 'unreachable';
  updateOnlineWeatherSettings({ enabled: true });
  const c = mount(); await flush();
  const hint = byId(c, 'settings-online-weather-unusable');
  assert.match(hint.textContent, /unusable right now: no service set to Auto is reachable/);
  assert.equal(hint.style.display, '');
  assert.match(byId(c, 'settings-online-weather-availability-eccc').textContent, /^Not reachable/);
  // one service comes back
  answers['api.weather.gc.ca'] = 'available';
  fireEvent(byId(c, 'settings-online-weather-check'), 'click'); await flush();
  assert.equal(hint.style.display, 'none');
});

test('unusable hint: every service Off is unusable too; busy is reported as busy', async () => {
  answers['opendataapi.dmi.dk'] = 'busy';
  updateOnlineWeatherSettings({ enabled: true });
  const c = mount(); await flush();
  assert.match(byId(c, 'settings-online-weather-availability-dmi').textContent, /^Busy, try again later/);
  assert.equal(byId(c, 'settings-online-weather-unusable').style.display, 'none');
  for (const s of sources) { const sel = byId(c, `settings-online-weather-mode-${s.id}`); sel.value = 'off'; fireEvent(sel, 'change'); }
  await flush();
  assert.match(byId(c, 'settings-online-weather-unusable').textContent, /unusable right now/);
});

test('radius and maximum age are stored in SI; an out-of-range value is not stored', () => {
  updateOnlineWeatherSettings({ enabled: true });
  const c = mount();
  const radius = byId(c, 'weatherSearchRadius');
  radius.value = '80'; fireEvent(radius, 'input');
  assert.equal(getOnlineWeatherSettings().searchRadiusM, 80000);
  radius.value = '900'; fireEvent(radius, 'input');
  assert.equal(getOnlineWeatherSettings().searchRadiusM, 80000);
  const age = byId(c, 'weatherMaxAge');
  age.value = '45'; fireEvent(age, 'input');
  assert.equal(getOnlineWeatherSettings().maxAgeS, 2700);
  age.value = '5'; fireEvent(age, 'input');
  assert.equal(getOnlineWeatherSettings().maxAgeS, 2700);
});

test('the two estimation switches are stored', () => {
  updateOnlineWeatherSettings({ enabled: true });
  const c = mount();
  const combine = byId(c, 'settings-online-weather-combine'), time = byId(c, 'settings-online-weather-time-correct');
  combine.checked = false; fireEvent(combine, 'change');
  time.checked = false; fireEvent(time, 'change');
  const s = getOnlineWeatherSettings();
  assert.deepEqual([s.combine, s.timeCorrect], [false, false]);
});

test('clearing the weather cache empties the cache and says so', async () => {
  updateOnlineWeatherSettings({ enabled: true });
  const c = mount();
  fireEvent(byId(c, 'settings-online-weather-clear-cache'), 'click'); await flush();
  assert.equal(cleared, 1);
  assert.ok(all(c, (n) => n.textContent === 'Weather cache cleared.').length > 0);
});

test('each service shows the provider\'s own credit line with its link', () => {
  updateOnlineWeatherSettings({ enabled: true });
  const c = mount();
  const links = all(c, (n) => n.tagName === 'A').map((a) => a.getAttribute('href'));
  assert.ok(links.includes('https://opendatadocs.meteoswiss.ch/general/terms-of-use'));
  assert.ok(links.includes('https://creativecommons.org/licenses/by/4.0/'));
  assert.ok(all(c, (n) => n.textContent === 'Datenquelle: GeoSphere Austria - https://data.hub.geosphere.at (Austrian stations; CC BY 4.0; raw 10-minute values)').length > 0);
});

test('unusable hint says "offline" while the device is offline', async () => {
  for (const h of ['mesonet.agron.iastate.edu', 'data.geo.admin.ch', 'dataset.api.hub.geosphere.at', 'api.brightsky.dev', 'opendataapi.dmi.dk', 'api.weather.gc.ca']) answers[h] = 'unreachable';
  updateOnlineWeatherSettings({ enabled: true });
  navigator.onLine = false;
  try {
    const c = mount(); await flush();
    assert.match(byId(c, 'settings-online-weather-unusable').textContent, /you are offline/);
  } finally { delete navigator.onLine; }
});
