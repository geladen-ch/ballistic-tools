// The Get weather block in the tools: when it shows, when the button shows, Range Solver's location coordinates choice
// and save offer (exact boundaries), the GPS flow, and writing the result into the atmosphere section.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';
import { degToRad, hpaToPa, minToS, sToMs } from '../src/quantity.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { setCookie } = await import('../src/cookies.js');
const { reloadOnlineWeatherPrefsForTests } = await import('../src/online-weather-prefs.js');
const { setWeatherRuntimeForTests } = await import('../src/weather/runtime.js');
const { createAvailability } = await import('../src/weather/availability.js');
const { createMemoryCache } = await import('../src/weather/cache.js');
const { resetDevicePositionForTests, getDevicePosition, DEFAULT_DEVICE_POSITION } = await import('../src/device-position-state.js');
const { weatherBlock, wantsSaveOffer, locationHasFullPosition, SAVE_OFFER_HORIZONTAL_M, SAVE_OFFER_VERTICAL_M } = await import('../src/ui/weather/weather-block.js');
const { atmosphereSection } = await import('../src/ui/sections/atmosphere-section.js');
const { ellipsoidalToOrthometric } = await import('../src/weather/geoid.js');
const { haversineM } = await import('../src/weather/geo.js');

const all = (node, test, out = []) => { if (test(node)) out.push(node); for (const c of node.childNodes || []) all(c, test, out); return out; };
const byId = (root, id) => all(root, (n) => n.id === id)[0];
const byClass = (root, cls) => all(root, (n) => (n.className || '').split(' ').includes(cls))[0];
const flush = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); await new Promise((r) => setTimeout(r, 5)); };
const type = (root, id, value) => { const n = byId(root, id); n.value = String(value); fireEvent(n, 'input'); };
const shown = (node) => !!node && !node.hidden && node.style?.display !== 'none';

const ZH = { latRad: degToRad(47.37), lonRad: degToRad(8.54), altitudeM: 430 };
const fullLocation = { id: 'l1', name: 'Range A', latitudeRad: ZH.latRad, longitudeRad: ZH.lonRad, altitudeM: 430, targets: [] };

let availabilityState;
function installRuntime(extra = {}) {
  const probe = async () => ({ state: availabilityState });
  const availability = createAvailability({ probe });
  setWeatherRuntimeForTests({ net: { getJSON: async () => { throw new Error('offline'); }, getText: async () => '', probe }, cache: createMemoryCache(), availability, ...extra });
  return availability;
}
function enable(on = true) {
  setCookie('ballistics_online_weather_v1', JSON.stringify({ enabled: on }));
  reloadOnlineWeatherPrefsForTests();
}
test.beforeEach(() => {
  availabilityState = 'available';
  resetDevicePositionForTests();
  enable(true);
  installRuntime();
});
test.after(() => setWeatherRuntimeForTests(null));

/** A stand-in service: answers get() with the queued results, status() with a fixed answer. */
function fakeService(results = []) {
  const calls = [];
  let plan = null, edited = false;
  return {
    calls,
    async noteEdited() { edited = true; },
    async get(req) {
      calls.push(req);
      const r = results.shift() ?? { ok: false, code: 'noStation', errors: [] };
      if (r.ok) { plan = r.plan; edited = false; }
      return r;
    },
    async status() {
      return plan
        ? { hasLast: true, edited, allowed: false, nextExpectedAt: plan.nextExpectedAt, intervalS: plan.intervalS, altitudeChanged: false }
        : { hasLast: false, edited: false, allowed: true, nextExpectedAt: null, intervalS: null, altitudeChanged: false };
    },
  };
}
const goodResult = (over = {}) => ({
  ok: true, fetched: true, values: { tempC: 6.5, pressurePa: hpaToPa(955), humidity: 0.62 }, missing: [], stationCount: 3,
  at: Date.UTC(2026, 10, 16, 14, 32), plan: { nextExpectedAt: Date.UTC(2026, 10, 16, 15, 20), intervalS: minToS(30) }, ...over,
});
function mount({ location = null, service = fakeService(), apply = () => {}, defaultPosition = null } = {}) {
  const loc = { current: location };
  const source = location !== undefined && location !== false ? {
    getLocation: () => loc.current,
    saveCoordinates: (l, p) => { loc.current = { ...l, latitudeRad: p.latRad, longitudeRad: p.lonRad, altitudeM: p.altitudeM }; (source.saved ||= []).push(p); },
  } : null;
  const block = weatherBlock({ applyValues: apply, locationSource: source, service, defaultPosition });
  return { block, loc, source, node: block.node, button: () => byClass(block.node, 'weather-get'), service };
}
const fillPosition = (node, { lat = 47.37, lon = 8.54, alt = 430 } = {}) => {
  type(node, 'latitudeRad', lat); type(node, 'longitudeRad', lon); type(node, 'deviceAltitudeM', alt);
};

// ---------- visibility ----------
test('hidden while the feature is off, and while every Auto service is known to be unreachable; shown otherwise', async () => {
  enable(false);
  assert.equal(weatherBlock({ applyValues() {} }).usable, false);
  assert.equal(weatherBlock({ applyValues() {} }).node.hidden, true);

  enable(true);
  availabilityState = 'unreachable';
  const availability = installRuntime();
  const { sources } = await import('../src/weather/sources/index.js');
  await availability.check(sources, { force: true });
  assert.equal(weatherBlock({ applyValues() {} }).usable, false, 'nothing reachable: unusable');

  availabilityState = 'available';
  const ok = installRuntime();
  assert.equal(weatherBlock({ applyValues() {} }).usable, true, 'unknown counts as reachable');
  await ok.check(sources, { force: true });
  assert.equal(weatherBlock({ applyValues() {} }).usable, true);
});

test('the button shows only for a complete, valid position; the position inputs are always there', () => {
  const { node, button } = mount({ location: null });
  assert.equal(shown(button()), false);
  assert.equal(shown(byId(node, 'latitudeRad')), true);
  assert.ok(shown(all(node, (n) => n.getAttribute?.('data-i18n') === 'onlineWeather.tool.needPosition')[0]), 'the hint says what is missing');
  type(node, 'latitudeRad', 47.37); assert.equal(shown(button()), false);
  type(node, 'longitudeRad', 8.54); assert.equal(shown(button()), false);
  type(node, 'deviceAltitudeM', 430); assert.equal(shown(button()), true);
  assert.equal(shown(all(node, (n) => n.getAttribute?.('data-i18n') === 'onlineWeather.tool.needPosition')[0]), false);
  type(node, 'latitudeRad', 95); assert.equal(shown(button()), false, 'latitude beyond ±90°');
  type(node, 'latitudeRad', 47.37);
  type(node, 'longitudeRad', 181); assert.equal(shown(button()), false, 'longitude beyond ±180°');
  type(node, 'latitudeRad', 0); type(node, 'longitudeRad', 0); assert.equal(shown(button()), false, 'exactly 0, 0');
  type(node, 'longitudeRad', 8.54); type(node, 'latitudeRad', 47.37);
  type(node, 'deviceAltitudeM', 7000); assert.equal(shown(button()), false, 'altitude beyond the bound');
  type(node, 'deviceAltitudeM', -501); assert.equal(shown(button()), false);
  type(node, 'deviceAltitudeM', -500); assert.equal(shown(button()), true);
  type(node, 'deviceAltitudeM', ''); assert.equal(shown(button()), false, 'altitude blank');
});

test('typed values are remembered on the device and prefill the next block', () => {
  const first = mount({ location: null });
  fillPosition(first.node, { lat: 46.5, lon: 7.25, alt: 1200 });
  const saved = getDevicePosition();
  assert.ok(Math.abs(saved.latRad - degToRad(46.5)) < 1e-12);
  assert.equal(saved.altitudeM, 1200); assert.equal(saved.altitudeSource, 'manual');
  const second = mount({ location: null });
  assert.equal(byId(second.node, 'latitudeRad').value, '46.5');
  assert.equal(byId(second.node, 'deviceAltitudeM').value, '1200');
  assert.equal(shown(second.button()), true);
});

test('pasting "lat, lon" into either coordinate box fills both', () => {
  const { node } = mount({ location: null });
  const lon = byId(node, 'longitudeRad');
  let prevented = false;
  for (const handler of lon._listeners.paste) handler({ clipboardData: { getData: () => '47.37, 8.54' }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(byId(node, 'latitudeRad').value, '47.37');
  assert.equal(lon.value, '8.54');
});

test('the inputs start with the built-in default position, which is never stored and gives way to anything entered', () => {
  const first = mount({ location: null, defaultPosition: DEFAULT_DEVICE_POSITION });
  assert.equal(byId(first.node, 'latitudeRad').value, '47.10724');
  assert.equal(byId(first.node, 'longitudeRad').value, '8.64244');
  assert.equal(byId(first.node, 'deviceAltitudeM').value, '730');
  assert.equal(shown(first.button()), true, 'a complete position: Get weather is offered');
  assert.equal(getDevicePosition().latRad, null, 'nothing was stored');
  // typed values are remembered and win over the default next time
  type(first.node, 'latitudeRad', 46.5);
  const second = mount({ location: null, defaultPosition: DEFAULT_DEVICE_POSITION });
  assert.equal(byId(second.node, 'latitudeRad').value, '46.5');
  assert.equal(byId(second.node, 'longitudeRad').value, '8.64244', 'the part not entered still starts at the default');
  // the active location's own values come before the default
  const withLoc = mount({ location: { ...fullLocation, altitudeM: null }, defaultPosition: DEFAULT_DEVICE_POSITION });
  assert.equal(byId(withLoc.node, 'deviceAltitudeM').value, '730');
  resetDevicePositionForTests();
  const own = mount({ location: fullLocation, defaultPosition: DEFAULT_DEVICE_POSITION });
  assert.equal(byId(own.node, 'latitudeRad').value, '47.37', "the location's value, not the default");
  const exact = DEFAULT_DEVICE_POSITION;
  assert.ok(Math.abs(exact.latRad * 180 / Math.PI - 47.10723988713254) < 1e-12);
});

// ---------- Range Solver: location coordinates and the save offer ----------
test('location with latitude, longitude and altitude: checkbox (checked), inputs hidden, button uses the location', async () => {
  const service = fakeService([goodResult()]);
  const { node, button, loc } = mount({ location: fullLocation, service });
  const box = byId(node, 'weather-use-location');
  assert.equal(box.checked, true);
  const row = box.parentNode.parentNode;
  assert.equal(shown(row), true);
  assert.equal(box.parentNode.textContent, 'Use Range A coordinates: 47.37, 8.54, 430 m');
  assert.equal(shown(byClass(node, 'weather-position')), false, 'device GPS inputs hidden while checked');
  assert.equal(shown(button()), true);
  assert.equal(shown(byClass(node, 'weather-save-offer')), false, 'no offer while checked');
  fireEvent(button(), 'click');
  await flush();
  assert.equal(service.calls.length, 1);
  assert.equal(service.calls[0].altitudeM, 430);
  assert.equal(service.calls[0].point.latRad, fullLocation.latitudeRad);
  assert.equal(loc.current, fullLocation);
});

test('unchecking shows the position inputs (prefilled from the location) and they are what gets used', async () => {
  const service = fakeService([goodResult()]);
  const { node, button } = mount({ location: fullLocation, service });
  const box = byId(node, 'weather-use-location');
  box.checked = false; fireEvent(box, 'change');
  assert.equal(shown(byClass(node, 'weather-position')), true);
  assert.equal(byId(node, 'latitudeRad').value, '47.37');
  assert.equal(byId(node, 'deviceAltitudeM').value, '430');
  assert.equal(shown(byClass(node, 'weather-save-offer')), false, 'same as the location: nothing to offer');
  type(node, 'deviceAltitudeM', 700);
  fireEvent(button(), 'click');
  await flush();
  assert.equal(service.calls[0].altitudeM, 700);
});

test('save offer: strictly more than 50 m vertically or 100 m horizontally, or a location lacking a part', () => {
  const near = (dNorthM) => ({ latRad: ZH.latRad + dNorthM / 6371008.8, lonRad: ZH.lonRad, altitudeM: 430 });
  assert.ok(Math.abs(haversineM(ZH.latRad, ZH.lonRad, near(100).latRad, near(100).lonRad) - 100) < 0.01);
  assert.equal(wantsSaveOffer(fullLocation, near(0)), false);
  assert.equal(wantsSaveOffer(fullLocation, near(99.9)), false);
  assert.equal(wantsSaveOffer(fullLocation, near(100.1)), true);
  assert.equal(wantsSaveOffer(fullLocation, { ...near(0), latRad: ZH.latRad - 100.1 / 6371008.8 }), true, 'south too');
  assert.equal(wantsSaveOffer(fullLocation, { ...near(0), lonRad: ZH.lonRad + 100.1 / (6371008.8 * Math.cos(ZH.latRad)) }), true, 'east-west too');
  assert.equal(wantsSaveOffer(fullLocation, { ...near(0), altitudeM: 480 }), false, 'exactly 50 m is not more than 50 m');
  assert.equal(wantsSaveOffer(fullLocation, { ...near(0), altitudeM: 480.01 }), true);
  assert.equal(wantsSaveOffer(fullLocation, { ...near(0), altitudeM: 380 }), false);
  assert.equal(wantsSaveOffer(fullLocation, { ...near(0), altitudeM: 379.99 }), true);
  for (const lacking of [{ latitudeRad: null, longitudeRad: null }, { altitudeM: null }]) {
    assert.equal(wantsSaveOffer({ ...fullLocation, ...lacking }, near(0)), true);
  }
  assert.equal(wantsSaveOffer(null, near(0)), false);
  assert.equal([SAVE_OFFER_HORIZONTAL_M, SAVE_OFFER_VERTICAL_M].join(), '100,50');
  assert.equal(locationHasFullPosition(fullLocation), true);
  assert.equal(locationHasFullPosition({ ...fullLocation, altitudeM: null }), false);
});

test('offer in the block: shown when the typed position differs; pressing it saves and switches to the location checkbox', () => {
  const { node, loc, source } = mount({ location: fullLocation });
  const box = byId(node, 'weather-use-location');
  box.checked = false; fireEvent(box, 'change');
  const offer = byClass(node, 'weather-save-offer');
  type(node, 'deviceAltitudeM', 480); assert.equal(shown(offer), false);
  type(node, 'deviceAltitudeM', 481); assert.equal(shown(offer), true);
  const button = all(offer, (n) => n.tagName === 'BUTTON')[0];
  assert.equal(button.textContent, 'Save these as coordinates for Range A');
  assert.equal(all(offer, (n) => n.className === 'hint' && n.textContent)[0]?.textContent, t('onlineWeather.tool.saveOfferReplaces'));
  fireEvent(button, 'click');
  assert.equal(source.saved.length, 1);
  assert.equal(loc.current.altitudeM, 481);
  assert.equal(box.checked, true);
  assert.equal(shown(offer), false);
  assert.equal(shown(byClass(node, 'weather-position')), false);
  assert.equal(box.parentNode.textContent, 'Use Range A coordinates: 47.37, 8.54, 481 m');
  assert.equal(byClass(node, 'weather-status').textContent, 'Coordinates saved for Range A.');
});

test('location with only some parts: no checkbox, inputs shown and prefilled; the offer appears once the position is complete', () => {
  const partial = { ...fullLocation, altitudeM: null };
  const { node, button } = mount({ location: partial });
  assert.equal(shown(byId(node, 'weather-use-location').parentNode.parentNode), false, 'no checkbox without all three');
  assert.equal(shown(byClass(node, 'weather-position')), true);
  assert.equal(byId(node, 'latitudeRad').value, '47.37', "prefilled from the location's own latitude");
  assert.equal(byId(node, 'deviceAltitudeM').value, '');
  assert.equal(shown(button()), false);
  assert.equal(shown(byClass(node, 'weather-save-offer')), false, 'nothing to save until complete');
  type(node, 'deviceAltitudeM', 430);
  assert.equal(shown(button()), true);
  assert.equal(shown(byClass(node, 'weather-save-offer')), true);
  assert.equal(all(byClass(node, 'weather-save-offer'), (n) => n.className === 'hint' && n.textContent).length, 1, 'it replaces a saved latitude/longitude');
  const bare = mount({ location: { id: 'l2', name: 'Bare', altitudeM: null, targets: [] } });
  fillPosition(bare.node);
  assert.equal(shown(byClass(bare.node, 'weather-save-offer')), true);
  assert.equal(all(byClass(bare.node, 'weather-save-offer'), (n) => n.className === 'hint' && n.textContent).length, 0, 'filling blanks needs no warning');
});

test('no active location: no checkbox, no offer; Trajectory (no location source) has neither', () => {
  for (const m of [mount({ location: null }), mount({ location: false })]) {
    assert.equal(shown(byId(m.node, 'weather-use-location').parentNode.parentNode), false);
    fillPosition(m.node);
    assert.equal(shown(byClass(m.node, 'weather-save-offer')), false);
    assert.equal(shown(m.button()), true);
  }
});

// ---------- the button: results and errors ----------
test('a successful press writes the values, labels the button Refresh, shows the status and the next report', async () => {
  const applied = [];
  const { node, button } = mount({ location: null, service: fakeService([goodResult()]), apply: (v) => applied.push(v) });
  fillPosition(node);
  assert.equal(button().textContent, 'Get weather');
  fireEvent(button(), 'click');
  await flush();
  assert.deepEqual(applied, [{ tempC: 6.5, pressurePa: hpaToPa(955), humidity: 0.62 }]);
  assert.equal(button().textContent, 'Refresh');
  assert.match(byClass(node, 'weather-status').textContent, /^Updated .+ · stations used: 3\.$/);
  assert.match(byClass(node, 'weather-next').textContent, /^Next report expected .+ \(every 30 min\)$/);
  assert.equal(button().disabled, false);
});

test('a recalculation says so; values missing from the stations are named and left alone', async () => {
  const applied = [];
  const { node, button } = mount({
    location: null, apply: (v) => applied.push(v),
    service: fakeService([goodResult({ fetched: false, values: { tempC: 6.5, pressurePa: hpaToPa(955), humidity: null }, missing: ['humidity'] })]),
  });
  fillPosition(node);
  fireEvent(button(), 'click');
  await flush();
  assert.deepEqual(Object.keys(applied[0]).sort(), ['pressurePa', 'tempC']);
  assert.match(byClass(node, 'weather-status').textContent, /^Recalculated .+ from the saved reports/);
  assert.match(byClass(node, 'weather-status').textContent, /No value for: humidity \(unchanged\)\.$/);
});

test('failures leave the values alone; an unreachable service points to Settings without checking anything', async () => {
  const applied = [];
  const probes = [];
  installRuntime({ net: { probe: async (u) => { probes.push(u); return { state: 'available' }; }, getJSON: async () => {}, getText: async () => '' } });
  const { node, button } = mount({
    location: null, apply: (v) => applied.push(v),
    service: fakeService([{ ok: false, code: 'unreachable', errors: [] }, { ok: false, code: 'noStation', errors: [] }, { ok: false, code: 'noFresh', errors: [] }]),
  });
  fillPosition(node);
  fireEvent(button(), 'click'); await flush();
  const status = byClass(node, 'weather-status');
  assert.match(status.textContent, /^Could not get weather data\. Values unchanged\. Check in Settings/);
  const link = all(status, (n) => n.tagName === 'A')[0];
  assert.equal(link.getAttribute('href'), '#/settings/weather');
  fireEvent(button(), 'click'); await flush();
  assert.match(status.textContent, /^No station with a current report/);
  assert.equal(all(status, (n) => n.tagName === 'A').length, 0);
  fireEvent(button(), 'click'); await flush();
  assert.match(status.textContent, /^Stations were found, but none has a recent enough report/);
  assert.deepEqual(applied, []);
  assert.equal(button().textContent, 'Get weather', 'still no success this session');
  assert.deepEqual(probes, [], 'no reachability check outside Settings');
});

test('a thrown error counts as unreachable', async () => {
  const { node, button } = mount({ location: null, service: { get: async () => { throw new Error('x'); }, status: async () => ({}) } });
  fillPosition(node);
  fireEvent(button(), 'click'); await flush();
  assert.match(byClass(node, 'weather-status').textContent, /Check in Settings/);
});

test('the button is disabled while a request runs; progress codes show as plain status text', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const service = {
    async get({ onProgress }) { onProgress({ id: 'x' }, { code: 'loadingSynopList' }); await gate; return goodResult(); },
    async status() { return { hasLast: false }; },
  };
  const { node, button } = mount({ location: null, service });
  fillPosition(node);
  fireEvent(button(), 'click');
  await flush(3);
  assert.equal(button().disabled, true);
  assert.equal(byClass(node, 'weather-status').textContent, t('onlineWeather.tool.progress.synopList'));
  assert.ok(!/warn|defer/i.test(byClass(node, 'weather-status').textContent));
  release(); await flush();
  assert.equal(button().disabled, false);
});

test('the altitude hint and the next-report hint come from the service status', async () => {
  const service = { get: async () => goodResult(), status: async () => ({ hasLast: true, allowed: false, nextExpectedAt: Date.UTC(2026, 10, 16, 15, 20), intervalS: minToS(30), altitudeChanged: true }) };
  const { node } = mount({ location: null, service });
  fillPosition(node);
  await flush();
  assert.match(byClass(node, 'weather-next').textContent, /^Next report expected .+ \(every 30 min\)$/);
  assert.equal(byClass(node, 'weather-altitude').textContent, 'Your altitude changed by more than 200 m since the last fetch. Refresh to pick stations for the new altitude.');
});

test('a station list still downloading is said so, with or without a result', async () => {
  const { node, button } = mount({
    location: null,
    service: fakeService([{ ok: false, code: 'listLoading', errors: [] }, goodResult({ listLoading: true })]),
  });
  fillPosition(node);
  fireEvent(button(), 'click'); await flush();
  assert.match(byClass(node, 'weather-status').textContent, /^A station list is still downloading/);
  fireEvent(button(), 'click'); await flush();
  assert.match(byClass(node, 'weather-status').textContent, /One station list is still downloading and will be used from the next fetch on\.$/);
});

test('the Station details link: absent before a result, shown after one, hidden once a value is edited by hand', async () => {
  const service = fakeService([goodResult(), goodResult()]);
  const { node, button } = mount({ location: null, service });
  const link = () => byClass(node, 'weather-details-link');
  fillPosition(node);
  await flush();
  assert.equal(shown(link()), false, 'nothing fetched yet');
  fireEvent(button(), 'click'); await flush();
  assert.equal(shown(link()), true);
  assert.equal(link().textContent, 'Station details');
  fireEvent(button(), 'click'); await flush();
  assert.equal(shown(link()), true, 'a new result brings it back');
});

test('in the atmosphere section, typing into a value hides the Station details link; a preset change does too', async () => {
  const adapter = fakeSource({ reports: { temperatureC: 9, humidity: 0.7, pressure: { kind: 'qnh', pa: hpaToPa(1016) } } });
  installRuntime({ sources: [adapter] });
  const section = atmosphereSection({ includeWind: false, onlineWeather: {}, onInput() {}, load: () => ({}), save() {} });
  const node = section.node;
  fillPosition(node, { alt: 470 });
  fireEvent(byClass(node, 'weather-get'), 'click');
  await flush(60);
  assert.equal(shown(byClass(node, 'weather-details-link')), true);
  type(node, 'pressure', 950);
  assert.equal(shown(byClass(node, 'weather-details-link')), false);
  await flush();
  assert.equal(shown(byClass(node, 'weather-details-link')), false, 'the edit is remembered with the stored result');
  fireEvent(byClass(node, 'weather-get'), 'click');
  await flush(60);
  assert.equal(shown(byClass(node, 'weather-details-link')), true, 'a fresh result');
});

test('country hints show under the block with the result, can be dismissed, and go when a value is edited', async () => {
  const { estimate } = await import('../src/weather/pipeline.js');
  const { resetDismissedHints } = await import('../src/weather-hints-prefs.js');
  resetDismissedHints();
  const now = new Date();
  const st = (id, dLat) => ({
    sourceId: 'brightsky', reportType: 'DWD', attribution: 'x', notes: [], qc: [], skip: {}, precision: { tC: 0.1 },
    station: { id, name: id, latRad: degToRad(48 + dLat), lonRad: degToRad(9), elevM: 450, barometerM: null, distanceM: 5000 + dLat * 1e5, ids: {} },
    time: new Date(+now - 600000), temperatureC: 8, humidity: 0.6, pressure: null,
  });
  const observations = [st('D1', 0.01), st('D2', 0.02)];
  const stored = { last: { observations }, result: estimate(observations, 450, { now }) };
  const service = { ...fakeService([goodResult()]), lastEstimate: async () => stored };
  const { node, button, block } = mount({ location: null, service });
  fillPosition(node);
  fireEvent(button(), 'click'); await flush();
  const hint = () => byClass(node, 'weather-hint');
  assert.ok(hint(), 'a hint for Germany');
  assert.equal(hint().getAttribute('data-hint'), 'E-NS-DE');
  fireEvent(all(hint(), (n) => n.tagName === 'BUTTON')[0], 'click');
  assert.equal(byClass(node, 'weather-hint'), undefined, 'dismissed');
  resetDismissedHints();
  block.noteValuesEdited();
  assert.equal(byClass(node, 'weather-hint'), undefined);
  resetDismissedHints();
});

// ---------- sign buttons ----------
// Android number pads have no minus key, so each coordinate box has a ± button beside it.
test('the ± button beside a coordinate flips its sign, counts as an edit, and leaves a blank box alone', () => {
  const { node } = mount({ location: null });
  const signOf = (id) => all(byId(node, id).parentNode, (n) => n.tagName === 'BUTTON' && n.textContent === '±')[0];
  fireEvent(signOf('latitudeRad'), 'click');
  assert.equal(byId(node, 'latitudeRad').value, '', 'nothing to flip yet');
  type(node, 'latitudeRad', 33.8688); type(node, 'longitudeRad', 151.2093); type(node, 'deviceAltitudeM', 20);
  fireEvent(signOf('latitudeRad'), 'click');
  assert.equal(byId(node, 'latitudeRad').value, '-33.8688');
  assert.ok(Math.abs(getDevicePosition().latRad - degToRad(-33.8688)) < 1e-9, 'the flipped value is remembered');
  fireEvent(signOf('longitudeRad'), 'click');
  assert.equal(byId(node, 'longitudeRad').value, '-151.2093');
  fireEvent(signOf('longitudeRad'), 'click');
  assert.equal(byId(node, 'longitudeRad').value, '151.2093');
  assert.equal(shown(byClass(node, 'weather-get')), true);
});

// ---------- GPS ----------
function setNavigator(geolocation) {
  Object.defineProperty(globalThis, 'navigator', { value: { ...globalThis.navigator, geolocation }, configurable: true, writable: true });
}
const gpsButton = (node) => all(byClass(node, 'weather-position'), (n) => n.tagName === 'BUTTON' && n.textContent === 'Use GPS')[0];

test('Use GPS fills latitude, longitude and the geoid-corrected altitude, remembers them, and Stop ends the run', async () => {
  let watcher = null, cleared = false;
  const fix = { coords: { latitude: 47.3769, longitude: 8.5417, accuracy: 6, altitude: 480, altitudeAccuracy: 4 } };
  setNavigator({
    watchPosition(ok) { watcher = ok; setTimeout(() => ok(fix), 0); return 7; },
    clearWatch() { cleared = true; },
  });
  const { node } = mount({ location: null });
  const gps = gpsButton(node);
  fireEvent(gps, 'click');
  assert.equal(gps.textContent, 'Stop');
  await flush();
  assert.match(byClass(node, 'weather-gps-status').textContent, /^Position ±6 m, altitude .+ \(1 readings\)…$/);
  fireEvent(gps, 'click');                                                     // Stop
  await flush();
  assert.equal(cleared, true);
  assert.equal(gps.textContent, 'Use GPS');
  const expectedH = Math.round(ellipsoidalToOrthometric(480, degToRad(47.3769), degToRad(8.5417)));
  assert.equal(byId(node, 'latitudeRad').value, '47.3769');
  assert.equal(byId(node, 'longitudeRad').value, '8.5417');
  assert.equal(byId(node, 'deviceAltitudeM').value, String(expectedH));
  const saved = getDevicePosition();
  assert.equal(saved.altitudeSource, 'gps');
  assert.equal(saved.gps.accuracyM, 6);
  assert.equal(shown(byClass(node, 'weather-get')), true);
  assert.ok(watcher);
});

test('Use GPS reports a denial in the status line and changes nothing else', async () => {
  setNavigator({
    watchPosition(ok, err) { setTimeout(() => err({ code: 1 }), 0); return 1; }, clearWatch() {},
  });
  const { node } = mount({ location: null });
  const gps = gpsButton(node);
  fireEvent(gps, 'click');
  await flush();
  assert.match(byClass(node, 'weather-gps-status').textContent, /^Location access was denied/);
  assert.equal(byId(node, 'latitudeRad').value, '');
  assert.equal(gps.textContent, 'Use GPS');
});

// ---------- in the atmosphere section ----------
function fakeSource({ reports }) {
  const station = { id: 'A', name: 'Alpha', latRad: degToRad(47.38), lonRad: degToRad(8.55), elevM: 460, ids: {} };
  return {
    id: 'fake', name: 'Fake', attribution: 'x', homepage: '', coverage: { kind: 'global' }, minRefreshS: minToS(10), nominalIntervalS: minToS(30),
    async stations() { return [station]; },
    async current(metas) {
      return metas.map((m) => ({
        sourceId: 'fake', reportType: 'METAR', attribution: 'x', notes: [], qc: [], precision: { tC: 0.1 },
        station: { ...station, barometerM: null, distanceM: m.distanceM }, time: new Date(Date.now() - sToMs(minToS(12))), ...reports,
      }));
    },
  };
}

test('in the atmosphere section: values land in the three fields, the preset becomes Real conditions, dependents hear about it', async () => {
  const adapter = fakeSource({ reports: { temperatureC: 9, humidity: 0.7, pressure: { kind: 'qnh', pa: hpaToPa(1016) } } });
  installRuntime({ sources: [adapter] });
  const saves = [];
  let inputs = 0;
  const section = atmosphereSection({
    includeWind: false, onlineWeather: {}, onInput: () => { inputs++; },
    load: () => ({ atmospherePreset: 'swiss' }), save: (v) => saves.push(v),
  });
  const node = section.node;
  assert.equal(byId(node, 'atmospherePreset').value, 'swiss');
  fillPosition(node, { alt: 470 });
  fireEvent(byClass(node, 'weather-get'), 'click');
  await flush(60);
  const values = section.getValues();
  assert.equal(values.atmospherePreset, 'custom');
  assert.equal(byId(node, 'atmospherePreset').value, 'custom');
  assert.ok(Math.abs(values.humidity - 0.7) < 0.2);
  assert.ok(values.pressurePa > 90000 && values.pressurePa < 100000, `station pressure at 470 m, got ${values.pressurePa}`);
  assert.ok(Number.isFinite(values.tempC));
  assert.ok(inputs >= 1);
  assert.equal(saves.at(-1).atmospherePreset, 'custom');
  assert.equal(byClass(node, 'weather-get').textContent, 'Refresh');
  assert.match(byClass(node, 'weather-status').textContent, /^Updated /);
  // typing into a value afterwards: the status line no longer describes it
  type(node, 'tempC', 12);
  assert.equal(byClass(node, 'weather-status').textContent, '');
});

test('other callers of the atmosphere section get no weather block', () => {
  const section = atmosphereSection({ includeWind: false, onInput() {}, load: () => ({}), save() {} });
  assert.equal(byClass(section.node, 'weather-block'), undefined);
  assert.equal(byId(section.node, 'latitudeRad'), undefined);
});
