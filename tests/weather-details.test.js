// The station-details dialog body: summary, contributor tables (a left-out station stays, struck out), station reports,
// service rows with off / used / unused, credits; values in the user's units; every note, flag and reason code has text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { installFakeDom } from './helpers/fake-dom.js';
import { degToRad, hpaToPa, kmToM, minToS, sToMs } from '../src/quantity.js';

installFakeDom();
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { createWeatherService } = await import('../src/weather/service.js');
const { createMemoryCache } = await import('../src/weather/cache.js');
const { stationDetailsBody } = await import('../src/ui/weather/station-details.js');
const { noteText, flagText, reasonText, pressureText, temperatureText, heightText, distanceText } = await import('../src/ui/weather/weather-text.js');
const { setUnit, resetUnits } = await import('../src/prefs.js');

const ll = (latDeg, lonDeg) => ({ latRad: degToRad(latDeg), lonRad: degToRad(lonDeg) });
const T0 = Date.UTC(2026, 10, 16, 12, 0);
const min = (m) => sToMs(minToS(m));
const HERE = ll(47.37, 8.54);

const all = (node, test, out = []) => { if (test(node)) out.push(node); for (const c of node.childNodes || []) all(c, test, out); return out; };
const text = (node) => node.textContent;
const byTag = (root, tag) => all(root, (n) => n.tagName === tag.toUpperCase());
const rowsOf = (tableNode) => byTag(tableNode, 'tr').slice(1).map((tr) => ({ tr, cells: byTag(tr, 'td').map(text) }));

function fakeAdapter(id, stations, over = {}) {
  return {
    id, name: `Service ${id}`, attribution: id, homepage: '', coverage: { kind: 'global' }, minRefreshS: 600, nominalIntervalS: 1800,
    credits: { text: `Credit for ${id}`, ...(over.processed ? { processed: over.processed } : {}) },
    async stations() { return stations.map(({ report, ...m }) => m); },
    async current(metas) {
      return metas.map((m) => {
        const r = stations.find((s) => s.id === m.id).report;
        return {
          sourceId: id, reportType: over.reportType ?? 'METAR', attribution: id, notes: [{ code: 'humidityMeasured' }], qc: [], precision: { tC: 0.1 },
          raw: `RAW ${m.id}`,
          station: { id: m.id, name: m.name, latRad: m.latRad, lonRad: m.lonRad, elevM: m.elevM, barometerM: null, distanceM: m.distanceM, ids: m.ids },
          time: new Date(T0 - min(15)), ...r,
        };
      });
    },
  };
}
const rep = (temperatureC, qnhHpa = 1015) => ({ temperatureC, humidity: 0.6, pressure: { kind: 'qnh', pa: hpaToPa(qnhHpa) } });

async function scenario({ modes = {}, cloudAlpha } = {}) {
  const near = [
    { id: 'AAAA', name: 'Alpha', ...ll(47.38, 8.55), elevM: 460, ids: {}, report: { ...rep(8), ...(cloudAlpha === undefined ? {} : { cloudFraction: cloudAlpha }) } },
    { id: 'BBBB', name: 'Beta', ...ll(47.33, 8.60), elevM: 520, ids: {}, report: rep(8.4) },
    { id: 'CCCC', name: 'Gamma', ...ll(47.45, 8.45), elevM: 480, ids: {}, report: rep(7.7) },
    { id: 'DDDD', name: 'Delta', ...ll(47.30, 8.50), elevM: 500, ids: {}, report: rep(8.1) },
    { id: 'EEEE', name: 'Echo', ...ll(47.40, 8.70), elevM: 450, ids: {}, report: rep(24) },     // far from the others
  ];
  const a = fakeAdapter('a', near);
  const b = fakeAdapter('b', [{ id: 'B1', name: 'Bee', ...ll(47.36, 8.53), elevM: 450, ids: {}, report: rep(8) }]);
  const c = fakeAdapter('c', [], { processed: 'Data basis: example' });
  const cache = createMemoryCache(() => T0);
  const svc = createWeatherService({
    runtime: { net: { getJSON: async () => { throw new Error('no network'); }, getText: async () => '' }, cache, sources: [a, b, c] },
    now: () => T0, getSettings: () => ({ searchRadiusM: kmToM(150), maxAgeS: minToS(90), combine: true, timeCorrect: true }), getModes: () => modes,
  });
  const r = await svc.get({ point: HERE, altitudeM: 470 });
  assert.equal(r.ok, true);
  return { stored: await svc.lastEstimate(), svc, r, adapters: [a, b, c] };
}

test('summary, one table per quantity, a left-out station stays struck out with the reason', async () => {
  resetUnits();
  const { stored } = await scenario({ modes: { b: 'off' } });
  const body = stationDetailsBody(stored, { online: true });
  const heads = byTag(body, 'h3').map(text);
  assert.deepEqual(heads, [t('onlineWeather.details.atYourPosition'), t('onlineWeather.hints.heading'), t('onlineWeather.details.tablesHeading'), t('onlineWeather.details.reportsHeading'), t('onlineWeather.details.sourcesHeading'), t('onlineWeather.details.creditsHeading')]);
  assert.match(text(body), /One station disagreed with its neighbours and was left out\./, 'the general hint for a left-out station');
  assert.match(text(body), /5 stations · for \d/);
  assert.match(text(body), /At 470 m, combined from the stations within 150 km/);
  const tables = byTag(body, 'table');
  assert.equal(tables.length, 4, 'temperature, pressure, humidity and services');
  const temp = rowsOf(tables[0]);
  assert.equal(temp.length, 5);
  const struck = all(tables[0], (n) => n.className === 'weather-rejected');
  assert.equal(struck.length, 1, 'Echo disagrees by far');
  assert.ok(text(struck[0]).startsWith('EEEE'));
  assert.ok(text(struck[0]).endsWith(t('onlineWeather.details.leftOut')));
  const weights = temp.filter((r) => r.cells.at(-1).endsWith('%')).map((r) => parseInt(r.cells.at(-1), 10));
  assert.ok(Math.abs(weights.reduce((s, x) => s + x, 0) - 100) <= 2);
  assert.match(text(body), /EEEE left out: \+15\.6 °C from the median of the nearest 5 \(limit 5\.0 °C\)\./);
  assert.match(text(body), /Stations left out because they disagreed strongly with the others: 1/);
  assert.match(text(body), /Δh = station height − your height\. Effective distance counts 100 m of height difference like 20\.0 km\./);
  assert.ok(text(tables[0]).includes('Temperature') === false, 'the title is a heading, not a cell');
  assert.ok(byTag(body, 'h4').map(text).includes('Temperature (°C)'));
});

test('method sentence names kriging with its range and the distance limit; weights by kriging are shown as percentages', async () => {
  resetUnits();
  const { stored } = await scenario({ modes: { b: 'off' } });
  const body = stationDetailsBody(stored, { online: true });
  assert.match(text(body), /Weights by kriging: nearer stations count more, stations close together share their weight, and a station behind a nearer one in the same direction counts less \(correlation length 200\.0 km\)\./);
  assert.match(text(body), /If the nearest station is more than 100\.0 km away \(effective distance\), weight ∝ 1 \/ \(effective distance\)\^1\.5 instead\./);
  assert.equal(stored.result.temperature.method, 'kriging');
  assert.ok(!text(body).includes(t('onlineWeather.details.zeroWeightLegend')), 'no 0 % row, no legend');
  assert.ok(!text(body).includes('Weights by distance only'));
});

test('a station covered by nearer ones shows 0 % with its legend; a quantity that fell back to distance weights says so', async () => {
  resetUnits();
  const { stored } = await scenario({ modes: { b: 'off' } });
  const edit = (patch) => ({ ...stored, result: { ...stored.result, ...patch(stored.result) } });
  // 0 %: the last contributor's weight is clipped to nothing, the first one takes it
  const zero = edit((r) => {
    const used = r.temperature.used.map((u, i, a) => ({ ...u, weight: i === 0 ? u.weight + a.at(-1).weight : i === a.length - 1 ? 0 : u.weight }));
    return { temperature: { ...r.temperature, used } };
  });
  const bz = stationDetailsBody(zero, { online: true });
  const rows = rowsOf(byTag(bz, 'table')[0]);
  assert.ok(rows.some((r) => r.cells.at(-1) === '0 %'), 'a 0 % row stays in the table');
  assert.ok(text(bz).includes(t('onlineWeather.details.zeroWeightLegend')));
  // fallback: far, and the other reasons
  const far = stationDetailsBody(edit((r) => ({ temperature: { ...r.temperature, method: 'idw', fallback: 'far' } })), { online: true });
  assert.match(text(far), /Weights by distance only: the nearest station is more than 100\.0 km away\./);
  const other = stationDetailsBody(edit((r) => ({ pressure: { ...r.pressure, method: 'idw', fallback: 'noPosition' } })), { online: true });
  assert.match(text(other), /Weights by distance only for this value\./);
  assert.ok(!text(other).includes('the nearest station is more than 100.0 km away.'), 'the reason is only given for the distance limit');
});

test('cloud column: own cover as a percentage, "≈" and the legend for an area cover, "–" without or with the correction off', async () => {
  resetUnits();
  const cloudy = await scenario({ cloudAlpha: 0.75 });
  const body = stationDetailsBody(cloudy.stored, { online: true });
  const temp = rowsOf(byTag(body, 'table')[0]);
  const head = byTag(byTag(body, 'table')[0], 'th').map(text);
  const i = head.indexOf(t('onlineWeather.details.col.cloud'));
  assert.equal(i, head.indexOf(t('onlineWeather.details.col.reported')) + 1);
  assert.equal(head[i + 1], t('onlineWeather.details.col.timeDelta'));
  const cell = (id) => temp.find((r) => r.cells[0].startsWith(id)).cells[i];
  assert.equal(cell('AAAA'), '75 %');
  assert.equal(cell('BBBB'), '≈ 75 %', 'the others borrow the one cover there is');
  assert.ok(text(body).includes(t('onlineWeather.details.cloudAreaLegend')));
  assert.ok(text(body).includes('Cloud cover 75 %'), 'the report itself shows its cover');
  assert.ok(text(body).includes('scaled by the cloud cover'));
  // no cover anywhere: no value, no legend
  const plain = stationDetailsBody((await scenario()).stored, { online: true });
  assert.ok(rowsOf(byTag(plain, 'table')[0]).every((r) => r.cells[i] === '–'));
  assert.ok(!text(plain).includes(t('onlineWeather.details.cloudAreaLegend')));
  assert.ok(!text(plain).includes('Cloud cover'));
  assert.ok(text(plain).includes(t('onlineWeather.details.noCloudCover')), 'the summary says no cloud cover was available');
  assert.ok(!text(body).includes(t('onlineWeather.details.noCloudCover')), 'and says nothing when one was used');
  // an older stored result whose rows carry no cloud entry renders too
  const old = { ...cloudy.stored, result: { ...cloudy.stored.result, stations: cloudy.stored.result.stations.map(({ cloud, ...row }) => row) } };
  assert.doesNotThrow(() => stationDetailsBody(old, { online: true }));
});

test('cloud table: every station that gave a cover is listed, with what else it is used for; one that gave only the cover says so', async () => {
  resetUnits();
  // The airport (cover 75 %, older) and a national station (newer) are one site: the airport keeps no quantity.
  const here = ll(47.38, 8.55);
  const a = fakeAdapter('a', [
    { id: 'LSZH', name: 'Airport', ...here, elevM: 430, ids: { icao: 'LSZH' }, report: { ...rep(8), cloudFraction: 0.75, time: new Date(T0 - min(40)) } },
    { id: 'LSXX', name: 'Other airport', ...ll(47.45, 8.45), elevM: 480, ids: {}, report: { ...rep(8.2), cloudFraction: 0.25 } },
    { id: 'CCCC', name: 'Gamma', ...ll(47.30, 8.50), elevM: 500, ids: {}, report: rep(8.1) },
  ]);
  const b = fakeAdapter('b', [{ id: 'KLO', name: 'Kloten', ...ll(47.3801, 8.5501), elevM: 428, ids: {}, report: { ...rep(8.1), time: new Date(T0 - min(10)) } }], { reportType: 'SYNOP' });
  const svc = createWeatherService({
    runtime: { net: { getJSON: async () => { throw new Error('no network'); }, getText: async () => '' }, cache: createMemoryCache(() => T0), sources: [a, b] },
    now: () => T0, getSettings: () => ({ searchRadiusM: kmToM(150), maxAgeS: minToS(90), combine: true, timeCorrect: true }), getModes: () => ({}),
  });
  assert.equal((await svc.get({ point: HERE, altitudeM: 470 })).ok, true);
  const body = stationDetailsBody(await svc.lastEstimate(), { online: true });
  const heads = byTag(body, 'h4').map(text);
  const title = heads.find((h) => h.startsWith('Cloud cover'));
  assert.ok(title, `a cloud cover table: ${heads}`);
  const tables = byTag(body, 'table');
  const cloud = tables.find((tb) => text(byTag(tb, 'th').at(-1)) === t('onlineWeather.details.col.usedFor'));
  const rows = rowsOf(cloud).map((r) => r.cells);
  assert.deepEqual(rows.map((r) => r[0]), ['LSZH', 'LSXX']);
  assert.equal(rows[0][2], '75'); assert.equal(rows[1][2], '25');
  assert.equal(rows[0][4], t('onlineWeather.details.cloudOnly'), 'the airport contributes nothing else');
  assert.ok(rows[1][4].includes('temperature'), `the other airport also gives temperature: ${rows[1][4]}`);
  assert.ok(Math.abs(rows.reduce((s, r) => s + parseInt(r[3], 10), 0) - 100) <= 1);
  // its report block is listed with the note
  assert.match(text(body), new RegExp(t('onlineWeather.details.cloudOnlyNote').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  // and the table is absent with the time correction off
  const off = { ...(await svc.lastEstimate()) };
  off.result = { ...off.result, timeCorrect: false };
  assert.ok(!byTag(stationDetailsBody(off, { online: true }), 'h4').map(text).some((h) => h.startsWith('Cloud cover')));
});

test('station reports: raw report, notes, fetch time and the credit are shown', async () => {
  const { stored } = await scenario({ modes: { b: 'off' } });
  const body = stationDetailsBody(stored);
  const reports = all(body, (n) => n.className === 'weather-report');
  assert.equal(reports.length, 5);
  const first = text(reports[0]);
  assert.match(first, /^Alpha \(AAAA\) · METAR · \d+\.\d km · 460 m a\.s\.l\. · observed /);
  assert.match(first, /RAW AAAA/);
  assert.match(first, /Humidity measured\./);
});

test('services: off / used / unused, with the reason; no row is struck out', async () => {
  const { stored } = await scenario({ modes: { b: 'off' } });
  const body = stationDetailsBody(stored);
  const services = rowsOf(byTag(body, 'table').at(-1));
  const by = Object.fromEntries(services.map((r) => [r.cells[0], r.cells]));
  assert.equal(by['Service a'][1], 'used');
  assert.equal(by['Service a'][2], '5 stations used');
  assert.equal(by['Service b'][1], 'off');
  assert.equal(by['Service c'][1], 'unused');
  assert.equal(by['Service c'][2], 'No station within the search radius');
  assert.equal(all(byTag(body, 'table').at(-1), (n) => n.className === 'weather-rejected').length, 0);
  // a service that is Auto but did not contribute is "unused"
  const auto = await scenario();
  const rows = Object.fromEntries(rowsOf(byTag(stationDetailsBody(auto.stored), 'table').at(-1)).map((r) => [r.cells[0], r.cells]));
  assert.equal(rows['Service b'][1], 'used');
  // one station: singular wording
  const single = await scenario({ modes: { a: 'off' } });
  const one = Object.fromEntries(rowsOf(byTag(stationDetailsBody(single.stored), 'table').at(-1)).map((r) => [r.cells[0], r.cells]));
  assert.equal(one['Service b'][2], '1 station used');
  assert.match(text(stationDetailsBody(single.stored)), /1 station · for \d/);
});

test('credits: the provider\'s own wording; the processed-data note only for a contributing service', async () => {
  const { stored, adapters } = await scenario({ modes: { b: 'off' } });
  const body = stationDetailsBody(stored, { adapters });
  assert.match(text(body), /Credit for a/);
  assert.ok(!/Credit for b|Credit for c/.test(text(body)));
  assert.ok(!/Data basis: example/.test(text(body)), 'service c contributed nothing');
  const withC = await scenario();
  withC.adapters[2].credits.processed = 'Data basis: example';
  const same = stationDetailsBody(withC.stored, { adapters: [{ ...withC.adapters[0], credits: { text: 'x', processed: 'Data basis: example' } }] });
  assert.match(text(same), /Data basis: example\./, 'a contributing service\'s processed-data note is shown');
});

test('values follow the user\'s display units', async () => {
  const { stored } = await scenario({ modes: { b: 'off' } });
  setUnit('pressure', 'inHg'); setUnit('temperature', 'tempF'); setUnit('altitude', 'ft'); setUnit('weatherRadius', 'mi');
  try {
    const body = stationDetailsBody(stored);
    const heads = byTag(body, 'h4').map(text);
    assert.deepEqual(heads, ['Temperature (°F)', 'Pressure (inHg)', 'Humidity (%)']);
    assert.match(text(body), /At 1542 ft, combined from the stations within 93 mi/);
    assert.match(text(byTag(body, 'table')[0]), /Distance \(mi\)/);
    assert.match(text(byTag(body, 'table')[0]), /Δh \(ft\)/);
  } finally { resetUnits(); }
});

test('the offline and altitude banners', async () => {
  const { stored } = await scenario({ modes: { b: 'off' } });
  assert.match(text(stationDetailsBody(stored, { online: false })), /You are offline: this is the saved result\./);
  assert.ok(!/offline/.test(text(stationDetailsBody(stored, { online: true }))));
  assert.match(text(stationDetailsBody(stored, { currentAltitudeM: 671 })), /Your altitude changed by more than 200 m since this fetch/);
  assert.ok(!/altitude changed/.test(text(stationDetailsBody(stored, { currentAltitudeM: 670 }))), '200 m is not more than 200 m');
});

test('weather-text: notes, flags and reasons render with formatted parameters; unknown codes show the code', () => {
  resetUnits();
  assert.equal(noteText({ code: 'stationPressureBaro', barometerM: 605 }), 'Station pressure (barometer at 605 m).');
  assert.equal(noteText({ code: 'qnhQGroupRounded', adjustPa: 50 }), 'QNH from the Q group: whole hPa, rounded down by rule; +0.50 hPa added (mean rounding error).');
  assert.equal(noteText({ code: 'pressureOutOfRange', pa: hpaToPa(0.1), kind: 'station' }), 'Station pressure 0.10 hPa is out of range; not used.');
  assert.equal(noteText({ code: 'sameSiteNewer', label: 'Alpha (AAAA, METAR)' }), 'Alpha (AAAA, METAR) reports the same site more recently.');
  assert.equal(noteText({ code: 'madeUpCode' }), 'madeUpCode');
  assert.equal(flagText('pressureIsa'), t('onlineWeather.flag.pressureIsa'));
  assert.equal(flagText('whatever'), 'whatever');
  assert.equal(reasonText('error', { kind: 'timeout', message: 'Timed out: x' }), 'Error: Timed out');
  assert.equal(reasonText('error', { kind: 'http', status: 503, message: 'x' }), 'Error: HTTP error 503');
  assert.equal(reasonText('error', { kind: null, message: 'plain message' }), 'Error: plain message');
  assert.equal(pressureText(hpaToPa(955)), '955.00 hPa');
  assert.equal(temperatureText(7.25), '7.3 °C');
  assert.equal(heightText(-12.4, { sign: true }), '−12 m');
  assert.equal(distanceText(12345), '12.3 km');
});

test('every note code, flag and skip reason the engine can produce has text in all five languages', () => {
  const dir = new URL('../src/weather/', import.meta.url);
  const files = [...readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => new URL(f, dir)),
    ...readdirSync(new URL('sources/', dir)).map((f) => new URL(`sources/${f}`, dir))];
  const codes = new Set(), flags = new Set(), reasons = new Set();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/code: '([A-Za-z]+)'/g)) codes.add(m[1]);
    for (const m of src.matchAll(/code: [a-zA-Z.]+ \? '([A-Za-z]+)' : '([A-Za-z]+)'/g)) { codes.add(m[1]); codes.add(m[2]); }
    for (const m of src.matchAll(/flags\.push\('([A-Za-z]+)'\)/g)) flags.add(m[1]);
  }
  // not notes: progress messages and result codes of the service itself
  const notNotes = /^(loading|unreachable|noStation|noFresh|noValues|listLoading)/;
  const reasonsFile = readFileSync(new URL('activation.js', dir), 'utf8');
  for (const m of reasonsFile.matchAll(/'([A-Za-z]+)'/g)) if (/^(used|off|notValidated|outside|noStationsInArea|paused|noNearby|notSelected|error|noFresh|listLoading)$/.test(m[1])) reasons.add(m[1]);
  assert.ok(codes.size > 25 && flags.size >= 7, `scan found ${codes.size} codes, ${flags.size} flags`);
  const locales = ['en', 'de', 'fr', 'it', 'ru'].map((l) => [l, JSON.parse(readFileSync(new URL(`../src/locales/${l}.json`, import.meta.url), 'utf8')).onlineWeather]);
  for (const [lang, ow] of locales) {
    for (const code of codes) if (!notNotes.test(code)) assert.ok(ow.note?.[code], `${lang}: note ${code}`);
    for (const flag of flags) if (flag !== 'noDeviceAltitude') assert.ok(ow.flag?.[flag], `${lang}: flag ${flag}`);
    for (const reason of reasons) if (reason !== 'used') assert.ok(ow.details.reason[reason], `${lang}: reason ${reason}`);
    for (const kind of ['network', 'timeout', 'throttled', 'http', 'parse']) assert.ok(ow.details.errorKind[kind], `${lang}: error kind ${kind}`);
  }
});
