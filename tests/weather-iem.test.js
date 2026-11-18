import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, near } from './helpers/weather-fixtures.js';
import { degToRad, hpaToPa, inhgToPa, kmToM, minToS } from '../src/quantity.js';
import { polygonBbox } from '../src/weather/geo.js';
import { iem } from '../src/weather/sources/iem.js';
import { iemSynop, MAX_SYNOP_SITES } from '../src/weather/sources/iem-synop.js';
import { createMemoryCache } from '../src/weather/cache.js';
import { markDuplicates, estimate } from '../src/weather/pipeline.js';
import { isaPressureFromQnh, hypsometricShiftPressure } from '../src/weather/atmosphere.js';

const rad = degToRad, P = hpaToPa, km = kmToM;
const pt = (latDeg, lonDeg) => ({ latRad: rad(latDeg), lonRad: rad(lonDeg) });
const BASE = 'https://mesonet.agron.iastate.edu';

// ---------- METAR (IEM ASOS networks); fixtures captured 2026-11-13 ~22:30Z ----------
const NOW = new Date('2026-11-13T22:45:00Z');

/** Fake SourceContext serving fixtures; unknown networks return an empty list; records requested URLs. */
function fakeCtx() {
  const requested = [];
  const getJSON = async (url) => {
    requested.push(url.replace(BASE, ''));
    let m;
    if (url.endsWith('/geojson/networks.geojson')) return fixture('iem-networks.geojson');
    if ((m = /\/geojson\/network\/(\w+)\.geojson$/.exec(url))) {
      try { return fixture(`iem-stations-${m[1]}.geojson`); } catch { return { type: 'FeatureCollection', features: [] }; }
    }
    if ((m = /currents\.json\?network=(\w+)$/.exec(url))) {
      try { return fixture(`iem-currents-${m[1]}.json`); } catch { return { data: [] }; }
    }
    throw new Error(`unexpected URL ${url}`);
  };
  return { requested, ctx: { getJSON, getText: async () => '', cache: createMemoryCache(), now: () => NOW } };
}
const networks = () => fixture('iem-networks.geojson').features.map((f) => ({ id: f.id, bbox: polygonBbox(f.geometry) }));

test('IEM candidate networks for Zürich (bbox + 150 km)', () => {
  const ids = iem.internals.candidateNetworks(networks(), rad(47.37), rad(8.54), km(150)).map((n) => n.id).sort();
  assert.deepEqual(ids, ['AT__ASOS', 'CH__ASOS', 'DE__ASOS', 'FR__ASOS', 'IT__ASOS', 'RU__ASOS']);
});

test('IEM nearest: Zürich → a Swiss station with QNH, elevation and derived RH', async () => {
  const { ctx, requested } = fakeCtx();
  const [o] = await iem.nearest(pt(47.37, 8.54), { k: 1, maxAgeS: minToS(90), radiusM: km(150) }, ctx);
  assert.ok(o, 'no observation');
  assert.ok(['LSMD', 'LSZH'].includes(o.station.id), `got ${o.station.id}`);
  assert.ok(o.station.distanceM < km(15));
  assert.equal(o.pressure.kind, 'qnh');
  assert.ok(Number.isFinite(o.station.elevM), 'elevation missing');
  assert.ok(o.notes.some((n) => n.code === 'humidityDerived'));
  assert.equal(o.stale, undefined);
  // only the CH currents were needed; RU station list is fetched (wide bbox) but its currents are not
  assert.ok(requested.includes('/api/1/currents.json?network=CH__ASOS'));
  assert.ok(!requested.some((u) => u.includes('currents.json?network=RU__ASOS')));
  // second call within TTL: no new requests
  const n = requested.length;
  await iem.nearest(pt(47.37, 8.54), { k: 1 }, ctx);
  assert.equal(requested.length, n);
});

test('IEM nearest: LSZH coordinates → LSZH, values from the raw METAR', async () => {
  const { ctx } = fakeCtx();
  const [o] = await iem.nearest(pt(47.4784, 8.5302), {}, ctx);
  assert.equal(o.station.id, 'LSZH');
  assert.equal(o.raw, 'LSZH 132220Z 01005KT 320V030 CAVOK M00/M01 Q1018 NOSIG');
  assert.equal(o.cloudFraction, 0, 'CAVOK');
  assert.deepEqual(o.pressure, { kind: 'qnh', pa: P(1018.5), reportedPa: P(1018), adjustPa: 50 });   // Q group rounded down → +0.5 hPa
  assert.equal(o.temperatureC, 0); assert.equal(o.dewpointC, -1);
  near(o.humidity, 0.929, 0.001);
  assert.equal(o.time.toISOString(), '2026-11-13T22:20:00.000Z');
  assert.ok(o.notes.some((n) => n.code === 'qnhQGroupRounded' && n.adjustPa === 50));
});

test('IEM nearest: Basel → LFSB from the French network (cross-border)', async () => {
  const { ctx } = fakeCtx();
  const [o] = await iem.nearest(pt(47.56, 7.59), {}, ctx);
  assert.equal(o.station.id, 'LFSB');
  assert.equal(o.station.network, 'FR__ASOS');
  assert.deepEqual(o.pressure, { kind: 'qnh', pa: P(1019.5), reportedPa: P(1019), adjustPa: 50 });
  assert.equal(o.temperatureC, -1);
});

test('IEM normalise: A-group altimeter (0.01 inHg, rounded to nearest) is not corrected', () => {
  const st = { id: 'KMCI', name: 'Kansas City', ...pt(39.2976, -94.7139), elevM: 312, network: 'MO_ASOS' };
  const o = iem.internals.normalise(st, { utc_valid: '2026-11-14T18:53:00Z', raw: 'KMCI 141853Z 18010KT 10SM CLR 12/M01 A3002 RMK AO2 SLP171 T01221011' }, 10);
  assert.equal(o.pressure.kind, 'qnh'); near(o.pressure.pa, inhgToPa(30.02), 0.01);
  assert.equal(o.pressure.adjustPa, undefined);
  assert.equal(o.temperatureC, 12.2);
  assert.equal(o.cloudFraction, 0, 'CLR');
});

test('IEM normalise: the cloud cover comes from the raw METAR layers; none reported gives null', () => {
  const st = { id: 'LSMA', name: 'Alpnach', ...pt(46.94, 8.29), elevM: 451, network: 'CH__ASOS' };
  const n = (raw) => iem.internals.normalise(st, { utc_valid: '2026-11-13T22:20:00Z', raw }, 10).cloudFraction;
  assert.equal(n('LSMA 132220Z AUTO 19004KT 9999NDV BKN036 01/01 Q1018 RMK'), 0.875);
  assert.equal(n('LSMA 132220Z AUTO 19004KT 9999NDV FEW031 SCT050 01/01 Q1018'), 0.5);
  assert.equal(n('LSMA 132220Z AUTO 19004KT 9999NDV ////// 01/01 Q1018'), null);
});

test('IEM nearest: stale data → nearest older report flagged', async () => {
  const { ctx } = fakeCtx();
  ctx.now = () => new Date('2026-11-14T03:00:00Z');
  const [o] = await iem.nearest(pt(47.4784, 8.5302), { maxAgeS: minToS(90) }, ctx);
  assert.equal(o.stale, true);
});

test('IEM nearest: mid-Pacific → nothing within radius', async () => {
  const { ctx } = fakeCtx();
  assert.deepEqual(await iem.nearest(pt(0, -150), { radiusM: km(150) }, ctx), []);
});

test('IEM wrapping networks: latitude-band match until learned (Chukotka sees RU)', () => {
  const nets = networks();
  const ids = iem.internals.candidateNetworks(nets, rad(65), rad(-178), km(150)).map((n) => n.id);
  assert.ok(ids.includes('RU__ASOS'), 'RU must be a candidate at 65N 178W');
  const learned = { RU__ASOS: { bbox: [rad(20.6167), rad(42.7), rad(-173.2433), rad(72.1)] } };
  assert.ok(iem.internals.candidateNetworks(nets, rad(65), rad(-178), km(150), learned).some((n) => n.id === 'RU__ASOS'));
  assert.ok(!iem.internals.candidateNetworks(nets, rad(47.37), rad(8.54), km(150), learned).some((n) => n.id === 'RU__ASOS'));
});

test('IEM learned extents: once the RU list was seen, Zürich no longer downloads it (after list expiry)', async () => {
  const { ctx, requested } = fakeCtx();
  await iem.nearest(pt(47.37, 8.54), {}, ctx);
  assert.ok(requested.includes('/geojson/network/RU__ASOS.geojson'), 'first use loads RU once');
  const ex = await ctx.cache.get('iem:extents');
  near(ex.RU__ASOS.bbox[0], rad(20.6167), 1e-6); near(ex.RU__ASOS.bbox[2], rad(-173.2433), 1e-6);
  for (const n of ['AT__ASOS', 'CH__ASOS', 'DE__ASOS', 'FR__ASOS', 'IT__ASOS', 'RU__ASOS']) await ctx.cache.delete(`iem:stations:${n}`);
  await ctx.cache.delete('iem:currents:CH__ASOS');
  const before = requested.length;
  const [o] = await iem.nearest(pt(47.37, 8.54), {}, ctx);
  const again = requested.slice(before);
  assert.ok(!again.includes('/geojson/network/RU__ASOS.geojson'), `RU reloaded: ${again.join(' ')}`);
  assert.ok(again.includes('/geojson/network/CH__ASOS.geojson'));
  assert.ok(['LSMD', 'LSZH'].includes(o.station.id));
});

// ---------- SYNOP: fixtures captured 2026-11-14 20:46Z ----------
const SNOW = new Date('2026-11-14T20:46:00Z');

function fakeSynopCtx() {
  const requested = [];
  const getJSON = async (url, o = {}) => {
    requested.push({ url: url.replace(BASE, ''), timeoutMs: o.timeoutMs });
    if (url.endsWith('/geojson/network/WMO_BUFR_SRF.geojson')) return fixture('iem-synop-stations.geojson');
    if (url.includes('/api/1/currents.json?')) {
      const ids = new URL(url).searchParams.getAll('station');
      const all = fixture('iem-synop-currents.json');
      return { data: all.data.filter((r) => ids.includes(r.station)) };
    }
    throw new Error(`unexpected URL ${url}`);
  };
  return { requested, ctx: { getJSON, getText: async () => '', cache: createMemoryCache(), now: () => SNOW } };
}

test('SYNOP adapter: Zürich → fresh Swiss SYNOP stations with station pressure and 0.1 °C values', async () => {
  const { ctx, requested } = fakeSynopCtx();
  const obs = await iemSynop.nearest(pt(47.37, 8.54), { radiusM: km(150), maxAgeS: minToS(90) }, ctx);
  assert.ok(obs.length >= 10, `only ${obs.length}`);
  assert.ok(obs.every((o) => o.cloudFraction === null), 'SYNOP currents carry no cloud field');
  const flu = obs[0];
  assert.equal(flu.station.id, '0-756-0-660'); assert.equal(flu.station.name, 'ZUERICH / FLUNTERN');
  assert.equal(flu.reportType, 'SYNOP'); assert.equal(flu.station.elevM, 556);
  assert.equal(flu.temperatureC, 0.9); assert.equal(flu.dewpointC, -0.5);              // 33.62 °F, 31.1 °F
  assert.equal(flu.time.toISOString(), '2026-11-14T20:00:00.000Z');
  // IEM lists Fluntern at 556 m; MeteoSwiss: 604 m (barometer 605 m). 945.6 / 1018.9 hPa at 0.9 °C imply ~603 m → not used
  assert.equal(flu.pressure, null);
  const bad = flu.notes.find((n) => n.code === 'pressureInconsistent');
  assert.ok(bad && bad.impliedM >= 600 && bad.impliedM < 610, JSON.stringify(flu.notes));
  assert.deepEqual(flu.qc, ['pressureInconsistent']);
  const klo = obs.find((o) => o.station.id === '0-756-0-670');
  assert.deepEqual(klo.pressure, { kind: 'station', pa: P(966.7) });                  // consistent: implied ≈ 427 m, listed 426.3 m
  for (let i = 1; i < obs.length; i++) assert.ok(obs[i].station.distanceM >= obs[i - 1].station.distanceM, 'sorted');
  // one list download (long timeout), one currents request for ≤ MAX_SYNOP_SITES sites
  assert.equal(requested.filter((r) => r.url.includes('WMO_BUFR_SRF.geojson')).length, 1);
  assert.ok(requested[0].timeoutMs >= 120000, 'list download needs a long timeout');
  assert.equal(requested.filter((r) => r.url.includes('currents.json')).length, 1);
  // second call within 10 min: served from cache
  const n = requested.length;
  await iemSynop.nearest(pt(47.37, 8.54), {}, ctx);
  assert.equal(requested.length, n);
});

test('SYNOP adapter: a site listed under two ids (national and WMO) gives one report', async () => {
  const { ctx } = fakeSynopCtx();
  const obs = await iemSynop.nearest(pt(47.43, 8.52), { radiusM: km(30) }, ctx);
  const aff = obs.filter((o) => o.station.name === 'ZUERICH / AFFOLTERN');
  assert.equal(aff.length, 1);
  assert.equal(aff[0].station.id, '0-756-0-664');                               // the record with data, not the empty 06664
  const list = iemSynop.internals.compactStations(fixture('iem-synop-stations.geojson'));
  const sites = iemSynop.internals.selectSites(list, rad(47.37), rad(8.54), km(150), 5);
  const keys = new Set(sites.map((s) => `${s.latRad.toFixed(5)},${s.lonRad.toFixed(5)},${s.elevM}`));
  assert.equal(keys.size, 5);
  assert.ok(sites.length > 5, 'both ids of a duplicated site are requested');
});

test('SYNOP pressure QC: implied height, placeholder values, mountain stations exempt', () => {
  const { impliedHeight, normalise } = iemSynop.internals;
  near(impliedHeight(P(964.5), P(1016.2), 4.3), 428, 3);                   // Kloten, MeteoSwiss barometer 428 m
  near(impliedHeight(P(943.7), P(1015.5), 5.5), 602, 3);                   // Fluntern, MeteoSwiss barometer 605 m
  const row = (o) => ({ utc_valid: '2026-11-14T20:00:00Z', tmpf: 32.126, dwpf: null, relh: null, ...o });
  const st = (elevM) => ({ id: 'X', name: 'X', ...pt(56.4, 21.2), elevM });
  const lv = normalise(st(19), row({ pres: 0.1, mslp: 1014.2 }), 1);   // Latvia sends a 0.1 hPa placeholder
  assert.deepEqual(lv.pressure, { kind: 'mslp', pa: P(1014.2) });
  assert.ok(lv.notes.some((n) => n.code === 'stationPressureOutOfRange'));
  assert.deepEqual(lv.qc, ['pressureOutOfRange']);
  assert.deepEqual(normalise(st(1500), row({ pres: 800, mslp: 1100 }), 1).pressure, { kind: 'station', pa: P(800) });   // ≥ 800 m: no test
  assert.deepEqual(normalise(st(null), row({ pres: 950, mslp: 1013 }), 1).pressure, { kind: 'station', pa: P(950) });   // no elevation: no test
});

test('SYNOP adapter: nothing within the radius; no fresh report → the nearest older one alone, flagged stale', async () => {
  const { ctx } = fakeSynopCtx();
  assert.deepEqual(await iemSynop.nearest(pt(0, -150), {}, ctx), []);
  ctx.now = () => new Date('2026-11-15T03:00:00Z');
  const old = await iemSynop.nearest(pt(47.37, 8.54), { maxAgeS: minToS(90) }, ctx);
  assert.equal(old.length, 1); assert.equal(old[0].stale, true); assert.equal(old[0].station.id, '0-756-0-660');
  assert.equal(MAX_SYNOP_SITES, 20);
});

// ---------- same-site de-duplication ----------
const T0 = new Date('2026-11-14T20:20:00Z');
function obs(type, id, latDeg, lonDeg, elevM, { T = 1, p = { kind: type === 'SYNOP' ? 'station' : 'qnh', pa: P(1000) }, at = T0, rh = 0.8 } = {}) {
  return { sourceId: type === 'SYNOP' ? 'iem-synop' : 'iem', reportType: type, attribution: '',
    station: { id, name: id, ...pt(latDeg, lonDeg), elevM, distanceM: km(5) }, time: at, temperatureC: T, dewpointC: null,
    humidity: rh, pressure: p, raw: null, notes: [] };
}

test('markDuplicates: SYNOP station pressure wins; the newer report gives T and RH', () => {
  const m = obs('METAR', 'LSZH', 47.4784, 8.5302, 432, { at: new Date('2026-11-14T20:20:00Z') });
  const s = obs('SYNOP', '0-756-0-670', 47.4796, 8.5360, 426, { at: new Date('2026-11-14T20:00:00Z') });
  const [m2, s2] = markDuplicates([m, s]);
  assert.ok(m2.skip.p && !s2.skip.p, 'METAR QNH skipped for pressure');
  assert.ok(s2.skip.t && s2.skip.rh && !m2.skip.t, 'older SYNOP skipped for T and RH');
  assert.ok(!m.skip, 'inputs are not mutated');
  // same time → SYNOP (0.1 °C) wins T as well
  const [m3, s3] = markDuplicates([m, { ...s, time: m.time }]);
  assert.ok(m3.skip.t && !s3.skip.t);
});

test('markDuplicates: METAR QNH wins over SYNOP sea-level pressure; distant or higher stations are not merged', () => {
  const m = obs('METAR', 'LSZH', 47.4784, 8.5302, 432);
  const s = obs('SYNOP', 'X', 47.48, 8.53, 430, { p: { kind: 'mslp', pa: P(1019) } });
  const [m2, s2] = markDuplicates([m, s]);
  assert.ok(s2.skip.p && !m2.skip.p);
  const far = obs('SYNOP', 'FAR', 47.50, 8.53, 432);                    // 2.4 km
  const high = obs('SYNOP', 'HIGH', 47.48, 8.53, 480);                  // 48 m higher
  for (const o of markDuplicates([m, far, high])) assert.equal(Object.keys(o.skip).length, 0, o.station.id);
});

test('estimate: a station with sea-level pressure only gives temperature, not pressure', () => {
  const now = new Date('2026-11-14T20:30:00Z');
  const a = obs('SYNOP', 'A', 47.40, 8.50, 450, { p: { kind: 'station', pa: P(960) }, at: new Date('2026-11-14T20:00:00Z') });
  const b = obs('SYNOP', 'B', 47.45, 8.60, 500, { p: { kind: 'mslp', pa: P(1018) }, at: new Date('2026-11-14T20:00:00Z') });
  const e = estimate([a, b], 470, { now, timeCorrect: false });
  assert.deepEqual(e.pressure.used.map((u) => u.row.obs.station.id), ['A']);
  assert.deepEqual(e.temperature.used.map((u) => u.row.obs.station.id).sort(), ['A', 'B']);
  const n = estimate([b], 470, { now, combine: false });
  assert.equal(n.pressure.value, null); assert.ok(Number.isFinite(n.temperature.value));
});

test('estimate: a SYNOP station pressure is shifted from its elevation; duplicates count once', () => {
  const now = new Date('2026-11-14T20:30:00Z');
  const m = obs('METAR', 'LSZH', 47.4784, 8.5302, 432, { p: { kind: 'qnh', pa: P(1017) }, at: new Date('2026-11-14T20:20:00Z'), T: 1 });
  const s = obs('SYNOP', '0-756-0-670', 47.4796, 8.5360, 426, { p: { kind: 'station', pa: P(966.7) }, at: new Date('2026-11-14T20:00:00Z'), T: -0.9 });
  const f = obs('SYNOP', '0-756-0-660', 47.3779, 8.5657, 556, { p: { kind: 'station', pa: P(945.6) }, at: new Date('2026-11-14T20:00:00Z'), T: 0.9 });
  const e = estimate([m, s, f], 470, { now, timeCorrect: false });
  const ids = (q) => e[q].used.map((u) => u.row.obs.station.id).sort();
  assert.deepEqual(ids('pressure'), ['0-756-0-660', '0-756-0-670']);
  assert.deepEqual(ids('temperature'), ['0-756-0-660', 'LSZH']);
  const kl = e.pressure.used.find((u) => u.row.obs.station.id === '0-756-0-670');
  near(kl.value, hypsometricShiftPressure(P(966.7), 426, 470, -0.9), 1e-6);           // with the station's temperature
  assert.ok(Math.abs(kl.value - isaPressureFromQnh(P(1017), 470)) < P(1.5), 'SYNOP and QNH agree within truncation + rounding');
});
