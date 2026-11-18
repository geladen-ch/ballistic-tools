// Country hints: where a report's country comes from, the table's integrity, which hints apply to a result, how many
// show and in what order, dismissal, and the two places they appear.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';
import { degToRad, hpaToPa, minToS, sToMs } from '../src/quantity.js';

installFakeDom();
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { HINTS } = await import('../src/weather/hints.js');
const { ISO_NUMERIC_TO_ALPHA2 } = await import('../src/weather/countries.js');
const { countryOfNetwork, countryOfWigos, countryOfObservation, evaluateHints, pickHints } = await import('../src/weather/hints-eval.js');
const { estimate } = await import('../src/weather/pipeline.js');
const { haversineM } = await import('../src/weather/geo.js');
const { getDismissedHints, dismissHint, resetDismissedHints, reloadHintPrefsForTests } = await import('../src/weather-hints-prefs.js');
const { renderBlockHints, hintsSection, hintText } = await import('../src/ui/weather/weather-hints.js');
const { makeElement } = await import('./helpers/fake-dom.js');

const NOW = new Date('2026-11-16T12:00:00Z');
const HERE = { latRad: degToRad(47.0), lonRad: degToRad(8.0) };
const all = (node, test, out = []) => { if (test(node)) out.push(node); for (const c of node.childNodes || []) all(c, test, out); return out; };

/** One report `distKm` north of HERE. */
function obs(sourceId, id, { distKm = 10, elevM = 450, network, reportType = sourceId === 'iem-synop' ? 'SYNOP' : 'METAR', T = 8, qc = [], wigos, lat, lon } = {}) {
  const latRad = lat ?? HERE.latRad + (distKm * 1000) / 6371008.8;
  const lonRad = lon ?? HERE.lonRad;
  return {
    sourceId, reportType, attribution: 'x', notes: [], qc, skip: {},
    station: { id, name: id, latRad, lonRad, elevM, barometerM: null, distanceM: haversineM(HERE.latRad, HERE.lonRad, latRad, lonRad), network, ids: wigos ? { wigos: [wigos] } : {} },
    time: new Date(+NOW - sToMs(minToS(10))), temperatureC: T, humidity: 0.6, pressure: { kind: 'qnh', pa: hpaToPa(1015) }, precision: { tC: 0.1 },
  };
}
const run = (observations, deviceHeightM = 450) => {
  const result = estimate(observations, deviceHeightM, { now: NOW, maxAgeS: minToS(90) });
  return { result, ids: evaluateHints({ result, observations }).map((h) => h.id) };
};

// ---------- where a country comes from ----------
test('country of a METAR network, a national WIGOS id, a service, and the Latvian special case', () => {
  assert.equal(countryOfNetwork('CH__ASOS'), 'CH');
  assert.equal(countryOfNetwork('DE__ASOS'), 'DE');
  assert.equal(countryOfNetwork('CA_ON_ASOS'), 'CA');
  assert.equal(countryOfNetwork('NY_ASOS'), 'US');
  assert.equal(countryOfNetwork('AK_ASOS'), 'US');
  assert.equal(countryOfNetwork('WMO_BUFR_SRF'), null);
  assert.equal(countryOfNetwork(undefined), null);
  assert.equal(countryOfWigos('0-756-0-660'), 'CH');
  assert.equal(countryOfWigos('0-76-0-83743'), 'BR', 'numeric without padding');
  assert.equal(countryOfWigos('0-076-0-83743'), 'BR');
  assert.equal(countryOfWigos('0-20000-0-06660'), null, 'the shared WMO issuer names no country');
  assert.equal(countryOfWigos('junk'), null);
  assert.equal(countryOfObservation(obs('meteoswiss', 'SMA')), 'CH');
  assert.equal(countryOfObservation(obs('brightsky', '01234')), 'DE');
  assert.equal(countryOfObservation(obs('iem', 'LSZH', { network: 'CH__ASOS' })), 'CH');
  assert.equal(countryOfObservation(obs('iem-synop', '0-643-0-26422', { lat: degToRad(56.9), lon: degToRad(24.1) })), 'LV', 'issuer 643 inside Latvia');
  assert.equal(countryOfObservation(obs('iem-synop', '0-643-0-27612', { lat: degToRad(55.75), lon: degToRad(37.6) })), 'RU', 'Moscow stays Russian');
  assert.equal(countryOfObservation(obs('geosphere', '11035')), 'AT');
});

test('the ISO table: numeric to alpha-2', () => {
  assert.equal(ISO_NUMERIC_TO_ALPHA2['756'], 'CH');
  assert.equal(ISO_NUMERIC_TO_ALPHA2['076'], 'BR');
  assert.equal(ISO_NUMERIC_TO_ALPHA2['643'], 'RU');
  assert.ok(Object.keys(ISO_NUMERIC_TO_ALPHA2).length >= 245);
});

// ---------- the table ----------
test('the table: unique ids, known triggers, valid countries, text in all five languages, entries not older than a year', () => {
  const valid = new Set(Object.values(ISO_NUMERIC_TO_ALPHA2));
  const known = new Set(['country', 'event', 'noSynop', 'far', 'spread', 'altitude', 'rejected']);
  const locales = ['en', 'de', 'fr', 'it', 'ru'].map((l) => [l, JSON.parse(readFileSync(new URL(`../src/locales/${l}.json`, import.meta.url), 'utf8')).onlineWeather]);
  const ids = HINTS.map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length);
  const yearAgo = Date.now() - 366 * 24 * 3600 * 1000;
  for (const h of HINTS) {
    assert.ok(['warn', 'info'].includes(h.severity), h.id);
    for (const k of Object.keys(h.trigger)) assert.ok(known.has(k), `${h.id}: trigger ${k}`);
    if (h.trigger.country) assert.ok(h.countries?.length, `${h.id}: country trigger needs countries`);
    for (const c of h.countries ?? []) assert.ok(valid.has(c), `${h.id}: ${c}`);
    assert.match(h.checked, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Date.parse(h.checked) > yearAgo, `${h.id} was last checked ${h.checked}: verify the entry against live data again, then update the date`);
    for (const [lang, ow] of locales) assert.ok(ow.hint?.[h.id]?.length > 10, `${lang}: ${h.id}`);
  }
  for (const [lang, ow] of locales) { assert.ok(ow.hints.heading, lang); assert.ok(ow.hints.dismiss, lang); }
});

// ---------- which hints apply ----------
test('national service countries: Germany (via Bright Sky) gets its note, Switzerland none', () => {
  assert.deepEqual(run([obs('brightsky', 'D1'), obs('brightsky', 'D2', { distKm: 14 })]).ids, ['E-NS-DE']);
  assert.deepEqual(run([obs('meteoswiss', 'SMA'), obs('iem', 'LSZH', { network: 'CH__ASOS', distKm: 12 })]).ids, []);
});

test('USA: the warning needs "far" — a distant nearest station or a height far from the device', () => {
  const near = [obs('iem', 'KAAA', { network: 'NY_ASOS', distKm: 10 }), obs('iem', 'KBBB', { network: 'NY_ASOS', distKm: 18 })];
  assert.deepEqual(run(near).ids, []);
  const far = [obs('iem', 'KAAA', { network: 'NY_ASOS', distKm: 40 }), obs('iem', 'KBBB', { network: 'NY_ASOS', distKm: 45 })];
  assert.deepEqual(run(far).ids, ['E-US-1']);
  assert.equal(HINTS.find((h) => h.id === 'E-US-1').severity, 'warn');
  const high = [obs('iem', 'KAAA', { network: 'NY_ASOS', distKm: 10, elevM: 50 }), obs('iem', 'KBBB', { network: 'NY_ASOS', distKm: 12, elevM: 60 })];
  assert.deepEqual(run(high, 1500).ids.filter((id) => id !== 'E-G-2'), ['E-US-1'], 'contributors 1.4 km lower than the device');
});

test('exact limits of "far": 30 km and 300 m are not "more than"', () => {
  const at = (km, elev, dev) => run([obs('iem', 'KAAA', { network: 'NY_ASOS', distKm: km, elevM: elev }), obs('iem', 'KBBB', { network: 'NY_ASOS', distKm: km + 2, elevM: elev })], dev).ids;
  assert.ok(!at(29.9, 450, 450).includes('E-US-1'));
  assert.ok(at(30.2, 450, 450).includes('E-US-1'));
  assert.ok(!at(10, 450, 750).includes('E-G-2'), '300 m exactly');
  assert.ok(at(10, 450, 751).includes('E-G-2'));
});

test('only airports where no SYNOP exists: country, no SYNOP candidate and far, all three', () => {
  const metars = [obs('iem', 'VIDP', { network: 'IN__ASOS', distKm: 40 }), obs('iem', 'VIJP', { network: 'IN__ASOS', distKm: 46 })];
  const ids = run(metars).ids;
  assert.ok(ids.includes('E-NOSYN-1') && ids.includes('E-LATE-1'));
  const withSynop = [...metars, obs('iem-synop', '0-356-0-42182', { distKm: 41 })];
  assert.ok(!run(withSynop).ids.includes('E-NOSYN-1'), 'a SYNOP candidate was available');
  const close = [obs('iem', 'VIDP', { network: 'IN__ASOS', distKm: 10 }), obs('iem', 'VIJP', { network: 'IN__ASOS', distKm: 12 })];
  assert.ok(!run(close).ids.includes('E-NOSYN-1'), 'not far');
});

test('data-check events: a flagged candidate of a counted country triggers its entry', () => {
  const brazil = (qc) => [
    obs('iem', 'SBAA', { network: 'BR__ASOS', distKm: 10 }),
    obs('iem-synop', '0-76-0-83743', { distKm: 11, qc }),
  ];
  assert.ok(!run(brazil([])).ids.includes('E-BR-1'));
  const ids = run(brazil(['pressureInconsistent'])).ids;
  assert.ok(ids.includes('E-BR-1'));
  assert.ok(ids.includes('E-CH-1'), 'the any-country entry fires on the same event');
  assert.ok(ids.includes('E-NS-META') && ids.includes('E-DELAY-1'), 'country-only entries of Brazil');
  // the event in a country that is not counted does not count (a far station behind a near one gets under 10 % weight)
  const other = [obs('iem', 'LSZH', { network: 'CH__ASOS', distKm: 10 }), { ...obs('iem-synop', '0-76-0-83743', { distKm: 250, qc: ['pressureInconsistent'] }) }];
  assert.ok(!run(other).ids.includes('E-BR-1'));
  // Latvia: issuer 643 inside Latvia, out-of-range placeholder pressure
  const lv = [
    obs('iem', 'EVRA', { network: 'LV__ASOS', distKm: 10, lat: degToRad(56.9), lon: degToRad(24.1) }),
    obs('iem-synop', '0-643-0-26422', { distKm: 12, lat: degToRad(56.95), lon: degToRad(24.2), qc: ['pressureOutOfRange'] }),
  ];
  const lvIds = run(lv, 450).ids;
  assert.ok(lvIds.includes('E-LV-1') && lvIds.includes('E-NS-NOCORS'));
});

test('a SYNOP report under the shared WMO issuer takes the country of the nearest METAR report', () => {
  const o = [obs('iem', 'SBAA', { network: 'BR__ASOS', distKm: 10 }), obs('iem-synop', '0-20000-0-83743', { distKm: 12, qc: ['pressureInconsistent'] })];
  assert.ok(run(o).ids.includes('E-BR-1'));
});

test('general entries: spread of the neighbours, a left-out station, altitude', () => {
  const temps = (...ts) => ts.map((T, i) => obs('iem', `K${i}${i}${i}`, { network: 'NY_ASOS', distKm: 5 + i * 2, T }));
  assert.ok(!run(temps(8, 8.5, 9, 8.2, 8.8)).ids.includes('E-G-1'));
  assert.ok(run(temps(0, 4, 8, 12, 16)).ids.includes('E-G-1'), 'median absolute deviation above 2 K');
  const outlier = run(temps(8, 8.2, 8.4, 8.1, 8.3, 25)).ids;
  assert.ok(outlier.includes('E-G-3') && !outlier.includes('E-G-1'));
  assert.ok(!run(temps(8, 8.2, 8.4, 8.1)).ids.includes('E-G-3'));
});

test('nothing to say without a result', () => {
  assert.deepEqual(evaluateHints({ result: null, observations: [] }), []);
  assert.deepEqual(evaluateHints({ result: { mode: 'none' }, observations: [] }), []);
});

// ---------- picking, dismissing, showing ----------
test('pickHints: warnings first, at most two, dismissed ones skipped', () => {
  const list = [{ id: 'a', severity: 'info' }, { id: 'b', severity: 'info' }, { id: 'c', severity: 'warn' }, { id: 'd', severity: 'info' }];
  assert.deepEqual(pickHints(list).map((h) => h.id), ['c', 'a']);
  assert.deepEqual(pickHints(list, { dismissed: ['c'] }).map((h) => h.id), ['a', 'b']);
  assert.deepEqual(pickHints(list, { dismissed: ['a', 'b', 'c'] }).map((h) => h.id), ['d']);
  assert.deepEqual(pickHints(list, { limit: 3 }).map((h) => h.id), ['c', 'a', 'b']);
  assert.deepEqual(pickHints([]), []);
});

test('dismissal is remembered on the device', () => {
  resetDismissedHints();
  assert.deepEqual(getDismissedHints(), []);
  dismissHint('E-NS-DE'); dismissHint('E-NS-DE'); dismissHint('E-G-2');
  assert.deepEqual(getDismissedHints(), ['E-NS-DE', 'E-G-2']);
  reloadHintPrefsForTests();
  assert.deepEqual(getDismissedHints(), ['E-NS-DE', 'E-G-2']);
  resetDismissedHints();
  reloadHintPrefsForTests();
  assert.deepEqual(getDismissedHints(), []);
});

test('under the weather block: two hints, × removes one and the next takes its place; the dialog lists all of them', () => {
  resetDismissedHints();
  const applicable = ['E-US-1', 'E-G-2', 'E-NS-DE', 'E-G-3'].map((id) => ({ id, severity: HINTS.find((h) => h.id === id).severity, countries: null }));
  const box = makeElement('div');
  renderBlockHints(box, applicable);
  const shown = () => all(box, (n) => n.getAttribute?.('data-hint')).map((n) => n.getAttribute('data-hint'));
  assert.deepEqual(shown(), ['E-US-1', 'E-G-2'], 'the warning first');
  assert.ok(box.textContent.startsWith(hintText('E-US-1')));
  const first = all(box, (n) => n.tagName === 'BUTTON')[0];
  fireEvent(first, 'click');
  assert.deepEqual(shown(), ['E-G-2', 'E-NS-DE']);
  assert.deepEqual(getDismissedHints(), ['E-US-1']);
  // the dialog's section lists every applicable hint, dismissed or not
  const section = hintsSection(applicable);
  assert.equal(all(section, (n) => n.tagName === 'P').length, 4);
  assert.equal(section.textContent.includes(hintText('E-US-1')), true);
  assert.equal(hintsSection([]), null);
  assert.equal(t('onlineWeather.hints.heading'), 'Notes for this area');
  resetDismissedHints();
});
