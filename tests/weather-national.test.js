// National and regional adapters: IEM US road weather and DCP, MeteoSwiss, GeoSphere Austria, DWD via Bright Sky, DMI,
// ECCC. Fixtures are saved service responses (dates in each test's header comment).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, fixtureText, near } from './helpers/weather-fixtures.js';
import { degToRad, hpaToPa, kmToM, minToS } from '../src/quantity.js';
import { coverageIntersects } from '../src/weather/activation.js';
import { createMemoryCache } from '../src/weather/cache.js';
import { fetchObservations, markDuplicates, estimate } from '../src/weather/pipeline.js';
import { applyMetadataOverride } from '../src/weather/select.js';
import { reduceToDevice } from '../src/weather/reduce.js';
import { hypsometricShiftPressure, isaShiftTemperature } from '../src/weather/atmosphere.js';
import { iemUs, US_NET, CONUS_OUTLINE, ALASKA_OUTLINE, HAWAII_BOX } from '../src/weather/sources/iem-us.js';
import { iemSynop } from '../src/weather/sources/iem-synop.js';
import { meteoswiss, CH_LI_OUTLINE } from '../src/weather/sources/meteoswiss.js';
import { geosphere, AT_OUTLINE } from '../src/weather/sources/geosphere.js';
import { brightsky, DE_OUTLINE, MAX_SITES } from '../src/weather/sources/brightsky.js';
import { dmi, DMI_PRESSURE_QC } from '../src/weather/sources/dmi.js';
import { eccc, CA_OUTLINE, SABLE_ISLAND_BOX } from '../src/weather/sources/eccc.js';

const rad = degToRad, P = hpaToPa, km = kmToM;
const pt = (latDeg, lonDeg) => ({ latRad: rad(latDeg), lonRad: rad(lonDeg) });
const covers = (cov, latDeg, lonDeg, radiusKm) => coverageIntersects(cov, rad(latDeg), rad(lonDeg), km(radiusKm));
const closed = (ring) => assert.deepEqual(ring[0], ring[ring.length - 1]);

// ---------- IEM US: road weather {ST}_RWIS and HADS platforms {ST}_DCP (Colorado, 2026-11-15 ~22:30Z) ----------
{
  const NOW = new Date('2026-11-15T22:10:00Z');
  const ASPEN = pt(39.19, -106.82);
  const fakeCtx = () => {
    const requested = [];
    const cur = { CO_DCP: fixture('iemus-CO_DCP-currents.json'), CO_RWIS: fixture('iemus-CO_RWIS-currents.json') };
    const getJSON = async (url) => {
      requested.push(url);
      const u = new URL(url);
      if (u.pathname.endsWith('/networks.geojson')) return fixture('iemus-networks.json');
      const m = u.pathname.match(/\/geojson\/network\/(\w+)\.geojson$/);
      if (m && cur[m[1]]) return fixture(`iemus-${m[1]}.geojson.json`);
      if (u.pathname.endsWith('/currents.json') && cur[u.searchParams.get('network')]) return cur[u.searchParams.get('network')];
      if (u.pathname.endsWith('/currents.json') && u.searchParams.getAll('station').length) {
        const want = new Set(u.searchParams.getAll('station'));
        return { data: [...cur.CO_DCP.data, ...cur.CO_RWIS.data].filter((d) => want.has(d.station)) };
      }
      throw new Error(`unexpected URL ${url}`);
    };
    return { requested, ctx: { getJSON, getText: async () => '', cache: createMemoryCache(), now: () => NOW } };
  };

  test('IEM US networks: state RWIS and DCP only (not ASOS, not Canadian provinces)', () => {
    const nets = iemUs.internals.compactNetworks(fixture('iemus-networks.json')).map((n) => n.id).sort();
    assert.deepEqual(nets, ['CO_DCP', 'CO_RWIS', 'UT_DCP']);
    assert.ok(US_NET.test('CA_DCP') && !US_NET.test('CA_AB_DCP') && !US_NET.test('CO_ASOS'));
  });

  test('IEM US station lists: only stations reporting temperature (DCP lists are mostly river gauges), with heights', () => {
    const geo = fixture('iemus-CO_DCP.geojson.json'), cur = fixture('iemus-CO_DCP-currents.json');
    const list = iemUs.internals.buildList(geo, cur, 'CO_DCP', NOW);
    assert.deepEqual([geo.features.length, list.length], [129, 36]);
    const apx = list.find((s) => s.id === 'APXC2');
    assert.deepEqual([apx.elevM, apx.network], [2441.8135, 'CO_DCP']);
    assert.equal(iemUs.internals.buildList(geo, cur, 'CO_DCP', new Date('2026-11-18T22:10:00Z')).length, 0);   // nothing within 48 h
  });

  test('IEM US current values: one per-station request; T and RH, no pressure; lists and currents cached', async () => {
    const { ctx, requested } = fakeCtx();
    const obs = await iemUs.nearest(ASPEN, { radiusM: km(60) }, ctx);
    assert.ok(obs.length && obs.every((o) => o.cloudFraction === null), 'no cloud field');
    assert.ok(obs.length >= 15, `${obs.length}`);                              // 30 asked, the fresh ones (≤ 90 min) kept
    const rw = obs.find((o) => o.station.id === 'CO100');                       // road weather, 1.5 km
    assert.deepEqual([rw.reportType, rw.time.toISOString(), rw.temperatureC, rw.pressure, rw.precision.tC], ['RWIS', '2026-11-15T21:38:00.000Z', 10.1, null, 0.1]);
    assert.ok(Math.abs(rw.humidity - 0.45) < 0.015, `${rw.humidity}`);
    const sn = obs.find((o) => o.station.id === 'ASEC2');                       // DCP with humidity, decimal °F
    assert.deepEqual([sn.reportType, sn.precision.tC, sn.station.elevM], ['DCP', 0.1, 3457]);
    near(sn.humidity, 0.56, 1e-12);
    const apx = obs.find((o) => o.station.id === 'APXC2');                      // DCP, whole °F
    assert.deepEqual([apx.temperatureC, apx.precision.tC], [10, 0.56]);
    assert.ok(obs.every((o) => o.pressure === null && o.notes.some((n) => n.code === 'noPressureTHOnly')));
    const per = requested.filter((u) => u.includes('currents.json?station='));
    assert.equal(per.length, 1);
    assert.ok(new URL(per[0]).searchParams.getAll('station').length <= 30);
    assert.equal(requested.filter((u) => u.includes('currents.json?network=')).length, 2);   // once per network, for the list
    await iemUs.nearest(ASPEN, { radiusM: km(60) }, ctx);
    assert.equal(requested.length, 6);                                          // index, 2 × (list + currents), 1 per-station: all cached
  });

  test('IEM US coverage: contiguous US, Alaska, Hawaii; not Canada, Mexico or Europe', () => {
    const cov = iemUs.coverage;
    for (const [lat, lon] of [[39.19, -106.82], [61.22, -149.9], [21.31, -157.86], [25.76, -80.19], [47.61, -122.33], [44.31, -69.78], [32.72, -117.16], [48.0, -97.0]])
      assert.ok(covers(cov, lat, lon, 0), `${lat},${lon}`);
    for (const [lat, lon, name] of [[51.05, -114.07, 'Calgary'], [19.43, -99.13, 'Mexico City'], [51.5, -0.12, 'London'], [53.55, -113.49, 'Edmonton']])
      assert.ok(!covers(cov, lat, lon, 50), name);
    for (const r of [CONUS_OUTLINE, ALASKA_OUTLINE, HAWAII_BOX]) closed(r);
  });
}

// ---------- MeteoSwiss (files of 2026-11-15 12:00Z; IEM SYNOP around Zürich, 2026-11-14 20:46Z) ----------
{
  const NOW = new Date('2026-11-15T12:19:00Z');
  const META = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/ogd-smn_meta_stations.csv';
  const VQ = 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv';
  const fakeCtx = (now = NOW) => {
    const requested = [];
    const getText = async (url, o = {}) => {
      requested.push({ url, encoding: o.encoding });
      if (url === META) return fixtureText('meteoswiss-meta-stations.csv', o.encoding ?? 'utf-8');
      if (url === VQ) return fixtureText('meteoswiss-VQHA80.csv');
      throw new Error(`unexpected URL ${url}`);
    };
    const getJSON = async (url) => {
      requested.push({ url });
      if (url.endsWith('/geojson/network/WMO_BUFR_SRF.geojson')) return fixture('iem-synop-stations.geojson');
      if (url.includes('/api/1/currents.json?')) {
        const ids = new URL(url).searchParams.getAll('station');
        return { data: fixture('iem-synop-currents.json').data.filter((r) => ids.includes(r.station)) };
      }
      throw new Error(`unexpected URL ${url}`);
    };
    return { requested, ctx: { getJSON, getText, cache: createMemoryCache(), now: () => now } };
  };

  test('MeteoSwiss metadata: ISO-8859-1 names, surveyed heights, WIGOS ids with the Swiss national alias', () => {
    const list = meteoswiss.internals.parseMeta(fixtureText('meteoswiss-meta-stations.csv', 'iso-8859-1'));
    assert.equal(list.length, 158);
    const sma = list.find((s) => s.id === 'SMA');
    assert.deepEqual([sma.name, sma.elevM, sma.barometerM, sma.wigos], ['Zürich / Fluntern', 604, 605, '0-20000-0-06660']);
    near(sma.latRad, rad(47.378), 1e-3);
    assert.equal(list.find((s) => s.id === 'AEG').name, 'Oberägeri');
    assert.equal(list.find((s) => s.id === 'AEG').barometerM, null);
    assert.deepEqual(meteoswiss.internals.idsFor('0-20000-0-06660'), { wigos: ['0-20000-0-06660', '0-756-0-660'], wmo: '06660' });
    assert.deepEqual(meteoswiss.internals.idsFor('0-20000-0-06601').wigos, ['0-20000-0-06601', '0-756-0-601']);
    assert.deepEqual(meteoswiss.internals.idsFor('0-20000-0-10000').wigos, ['0-20000-0-10000']);          // not a Swiss index: no alias
  });

  test('MeteoSwiss current values: one file for all stations, UTC times, station pressure at the barometer', async () => {
    const now = meteoswiss.internals.parseNow(fixtureText('meteoswiss-VQHA80.csv'));
    assert.equal(Object.keys(now).length, 159);
    const s = now.SMA;
    assert.equal(s.time, '2026-11-15T12:00:00.000Z');
    near(s.T, 8.2, 0); near(s.Td, 4.6, 0); near(s.RH, 0.778, 1e-12);
    near(s.qfe, P(942.6), 1e-6); near(s.qff, P(1013.6), 1e-6); near(s.qnh, P(1013.1), 1e-6);
    const { ctx, requested } = fakeCtx();
    const obs = await meteoswiss.nearest(pt(47.37, 8.54), { radiusM: km(30) }, ctx);
    assert.ok(obs.every((o) => o.cloudFraction === null), 'no cloud field');
    assert.ok(obs.length >= 5, `only ${obs.length}`);
    const sma = obs.find((o) => o.station.id === 'SMA');
    assert.deepEqual(sma.pressure, { kind: 'station', pa: P(942.6) });
    assert.deepEqual([sma.station.elevM, sma.station.barometerM, sma.temperatureC], [604, 605, 8.2]);
    near(sma.humidity, 0.778, 1e-12);
    assert.equal(sma.time.toISOString(), '2026-11-15T12:00:00.000Z');
    for (let i = 1; i < obs.length; i++) assert.ok(obs[i].station.distanceM >= obs[i - 1].station.distanceM);
    // stations without a barometer give no station pressure
    const bin = (await meteoswiss.nearest(pt(46.3677, 8.1923), { radiusM: km(2) }, ctx))[0];
    assert.deepEqual([bin.station.id, bin.temperatureC, bin.pressure], ['BIN', 4.3, null]);
    // a wind-only row (AEG at 12:00) is not a usable report
    assert.deepEqual(await meteoswiss.nearest(pt(47.1336, 8.6082), { radiusM: km(1) }, ctx), []);
    assert.equal(requested.filter((r) => r.url === VQ).length, 1);               // cached for 10 min
    assert.equal(requested.find((r) => r.url === META).encoding, 'iso-8859-1');
  });

  test('MeteoSwiss coverage outline: Switzerland and Liechtenstein plus the search radius', () => {
    const cov = meteoswiss.coverage;
    for (const [lat, lon] of [[47.37, 8.54], [46.20, 6.15], [46.00, 8.95], [47.14, 9.52], [46.50, 10.30]]) assert.ok(covers(cov, lat, lon, 0), `${lat},${lon}`);
    assert.ok(covers(cov, 45.46, 9.19, 150), 'Milan within 150 km');
    assert.ok(covers(cov, 47.99, 7.85, 50), 'Freiburg im Breisgau: border ~45 km');
    assert.ok(!covers(cov, 47.99, 7.85, 30));
    assert.ok(!covers(cov, 48.86, 2.35, 150), 'Paris');
    assert.ok(!covers(cov, 48.14, 11.58, 100), 'Munich, 100 km');
    closed(CH_LI_OUTLINE);
  });

  test('MeteoSwiss + IEM SYNOP: national heights fix Fluntern in the SYNOP feed; one report per site; Fluntern pressure from SMA', async () => {
    // SYNOP fixture is from the previous evening: allow a long age so both feeds are present
    const { ctx } = fakeCtx(new Date('2026-11-15T12:19:00Z'));
    const r = await fetchObservations(pt(47.37, 8.54), { radiusM: km(30), maxAgeS: minToS(1200), deviceHeightM: 470, ctx, sources: [iemSynop, meteoswiss] });
    const st = Object.fromEntries(r.status.map((s) => [s.id, s]));
    assert.deepEqual([st['iem-synop'].state, st.meteoswiss.state], ['used', 'used']);
    const fl = r.observations.find((o) => o.station.id === '0-756-0-660');
    assert.deepEqual([fl.station.elevM, fl.station.barometerM], [604, 605]);
    assert.deepEqual(fl.pressure, { kind: 'station', pa: P(945.6) });                    // recovered: implied 603 m vs barometer 605 m
    assert.ok(fl.notes.some((n) => n.code === 'heightFromList' && n.sourceId === 'meteoswiss'));
    const d = markDuplicates(r.observations);
    const flD = d.find((o) => o.station.id === '0-756-0-660'), sma = d.find((o) => o.station.id === 'SMA');
    assert.ok(flD.skip.p && flD.skip.t, JSON.stringify(flD.skip));            // SMA: surveyed barometer, newer report
    assert.deepEqual(Object.keys(sma.skip), []);
    const e = estimate(r.observations, 470, { now: new Date('2026-11-15T12:19:00Z'), maxAgeS: minToS(1200), timeCorrect: false });
    const u = e.pressure.used.find((x) => x.row.obs.station.id === 'SMA');
    const so = u.row.obs;                                                     // temperature moved to the barometer, then the layer
    near(u.value, hypsometricShiftPressure(P(942.6), 605, 470, isaShiftTemperature(so.temperatureC, so.station.elevM, 605)), 1e-6);
  });
}

// ---------- GeoSphere Austria (TAWES, 2026-11-15 12:34Z) ----------
{
  const NOW = new Date('2026-11-15T12:34:00Z');
  const API = 'https://dataset.api.hub.geosphere.at/v1/station/current/tawes-v1-10min';
  const fakeCtx = () => {
    const requested = [];
    const getJSON = async (url) => {
      requested.push(url);
      if (url === `${API}/metadata`) return fixture('geosphere-tawes-metadata.json');
      if (url.startsWith(`${API}?`)) {
        const ids = new URL(url).searchParams.get('station_ids').split(',');
        const all = fixture('geosphere-tawes-current.json');
        return { ...all, features: all.features.filter((f) => ids.includes(String(f.properties.station))) };
      }
      throw new Error(`unexpected URL ${url}`);
    };
    return { requested, ctx: { getJSON, getText: async () => '', cache: createMemoryCache(), now: () => NOW } };
  };

  test('GeoSphere metadata and ids: TAWES 11NNN = WMO index; IEM national alias 0-40-0-NNN', () => {
    const list = geosphere.internals.compactMeta(fixture('geosphere-tawes-metadata.json'));
    assert.ok(list.length >= 280, `${list.length}`);
    const w = list.find((s) => s.id === '11035');
    assert.deepEqual([w.name, w.elevM], ['WIEN/HOHE WARTE', 198]);
    assert.deepEqual(geosphere.internals.idsFor('11035'), { wigos: ['0-20000-0-11035', '0-40-0-35', '0-40-0-035'], wmo: '11035' });
    assert.deepEqual(geosphere.internals.idsFor('11312').wigos, ['0-20000-0-11312', '0-40-0-312']);
    assert.deepEqual(geosphere.internals.idsFor('8989033'), { wigos: [], wmo: null });
  });

  test('GeoSphere current values: one request for the selected stations, latest value per station, station pressure', async () => {
    const { ctx, requested } = fakeCtx();
    const obs = await geosphere.nearest(pt(48.21, 16.37), { radiusM: km(30) }, ctx);           // Vienna
    assert.ok(obs.every((o) => o.cloudFraction === null), 'no cloud field');
    assert.ok(obs.length >= 5, `${obs.length}`);
    const hw = obs.find((o) => o.station.id === '11035');
    assert.equal(hw.time.toISOString(), '2026-11-15T12:20:00.000Z');
    assert.deepEqual([hw.temperatureC, hw.dewpointC], [6.1, 0.6]); near(hw.humidity, 0.68, 1e-12);
    assert.deepEqual(hw.pressure, { kind: 'station', pa: P(991.4) });
    assert.equal(hw.station.ids.wmo, '11035');
    for (let i = 1; i < obs.length; i++) assert.ok(obs[i].station.distanceM >= obs[i - 1].station.distanceM);
    assert.equal(requested.filter((u) => u.startsWith(`${API}?`)).length, 1);
    await geosphere.nearest(pt(48.21, 16.37), { radiusM: km(30) }, ctx);
    assert.equal(requested.filter((u) => u.startsWith(`${API}?`)).length, 1);                               // cached 10 min
  });

  test('GeoSphere pressure check (15 m): Innsbruck Universität (barometer ~604 m, listed 578 m) gives no pressure', async () => {
    const { ctx } = fakeCtx();
    const obs = await geosphere.nearest(pt(47.26, 11.37), { radiusM: km(5) }, ctx);
    const uni = obs.find((o) => o.station.id === '11320'), apt = obs.find((o) => o.station.id === '11121');
    assert.equal(uni.pressure, null); assert.deepEqual(uni.qc, ['pressureInconsistent']); assert.equal(uni.temperatureC, 10.8);
    assert.deepEqual(apt.pressure, { kind: 'station', pa: P(945.8) });                                                // implied ≈ 580 m
  });

  test('GeoSphere coverage outline and height override of IEM SYNOP stations', () => {
    const cov = geosphere.coverage;
    for (const [lat, lon] of [[48.21, 16.37], [47.26, 11.39], [47.07, 15.44], [47.80, 13.04], [47.50, 9.75], [46.62, 14.31]]) assert.ok(covers(cov, lat, lon, 0), `${lat},${lon}`);
    assert.ok(covers(cov, 48.14, 11.58, 100), 'Munich within 100 km');
    assert.ok(!covers(cov, 52.52, 13.40, 150), 'Berlin');
    closed(AT_OUTLINE);
    const syn = { sourceId: 'iem-synop', id: '0-40-0-312', ...pt(46.97, 10.19), elevM: 1600, ids: { wigos: ['0-40-0-312'] } };
    const tw = { sourceId: 'geosphere', id: '11312', ...pt(46.97, 10.19), elevM: 1587, barometerM: null, ids: geosphere.internals.idsFor('11312'), authoritative: true };
    const [s] = applyMetadataOverride([syn, tw]);
    assert.deepEqual([s.elevM, s.barometerM, s.elevFrom.sourceId], [1587, null, 'geosphere']);
  });
}

// ---------- DWD via Bright Sky (Freiburg, 2026-11-15 ~13:40Z) ----------
{
  const NOW = new Date('2026-11-15T13:41:00Z');
  const fakeCtx = ({ fail = false } = {}) => {
    const requested = [];
    const getJSON = async (url) => {
      requested.push(url);
      const u = new URL(url);
      if (u.pathname === '/sources') return fixture('brightsky-sources-freiburg.json');
      if (u.pathname === '/synop') {
        if (fail) throw new Error('HTTP 503');
        const id = u.searchParams.get('dwd_station_id');
        try { return fixture(`brightsky-synop-${id}.json`); } catch { return { weather: [], sources: [] }; }
      }
      throw new Error(`unexpected URL ${url}`);
    };
    return { requested, ctx: { getJSON, getText: async () => '', cache: createMemoryCache(), now: () => NOW } };
  };

  test('Bright Sky stations: live synop sources only (no forecast points, no old records); DWD ids, WMO where given', () => {
    const list = brightsky.internals.compactSources(fixture('brightsky-sources-freiburg.json'), NOW);
    assert.ok(list.length >= 80 && list.length <= 120, `${list.length}`);
    const fr = list.find((s) => s.id === '01443');
    assert.deepEqual([fr.name, fr.wmo, fr.elevM], ['Freiburg', '10803', 236.5]);
    assert.deepEqual(brightsky.internals.idsFor('10803'), { wigos: ['0-20000-0-10803'], wmo: '10803' });
    assert.deepEqual(brightsky.internals.idsFor('Q811'), { wigos: [], wmo: null });
    const t = brightsky.internals.tileOf(rad(47.99), rad(7.85), km(150));
    assert.deepEqual([t.latDeg, t.lonDeg], [47.75, 7.75]);
    assert.ok(t.maxDistM >= km(150 + 30) && t.maxDistM <= km(150 + 40), `${t.maxDistM}`);
  });

  test('Bright Sky current values: latest 10-min record, T and RH; sea-level pressure reported but not used', async () => {
    const { ctx, requested } = fakeCtx();
    const obs = await brightsky.nearest(pt(47.99, 7.85), { radiusM: km(15) }, ctx);
    const fr = obs.find((o) => o.station.id === '01443'), bu = obs.find((o) => o.station.id === '00757');
    // the records carry cloud_cover (100 %), which is deliberately not used: stations borrow the airports' cover
    assert.equal(fr.cloudFraction, null); assert.equal(bu.cloudFraction, null);
    assert.deepEqual([fr.time.toISOString(), fr.temperatureC, fr.dewpointC], ['2026-11-15T13:30:00.000Z', 13.4, 8.41]);
    near(fr.humidity, 0.72, 1e-12);
    assert.deepEqual(fr.pressure, { kind: 'mslp', pa: P(1010.7) });
    assert.equal(reduceToDevice(fr, 300).pressurePa, null);
    assert.equal(bu.pressure, null);
    assert.ok(fr.attribution.startsWith('Source: Deutscher Wetterdienst (via Bright Sky)'));
    assert.equal(requested.filter((u) => u.includes('/sources')).length, 1);
    const n = requested.length;
    await brightsky.nearest(pt(47.99, 7.85), { radiusM: km(15) }, ctx);
    assert.equal(requested.length, n);                                                     // list 90 days, values 10 min
    // at most MAX_SITES station requests per refresh
    const { ctx: c2, requested: r2 } = fakeCtx();
    await brightsky.nearest(pt(47.99, 7.85), { radiusM: km(150) }, c2);
    assert.ok(r2.filter((u) => u.includes('/synop')).length <= MAX_SITES);
  });

  test('Bright Sky: all station requests failing is an error (circuit breaker); coverage outline of Germany', async () => {
    const { ctx } = fakeCtx({ fail: true });
    await assert.rejects(brightsky.nearest(pt(47.99, 7.85), { radiusM: km(15) }, ctx));
    const cov = brightsky.coverage;
    for (const [lat, lon] of [[52.52, 13.40], [48.14, 11.58], [53.55, 9.99], [50.94, 6.96], [47.99, 7.85], [54.32, 10.13], [51.05, 13.74]]) assert.ok(covers(cov, lat, lon, 0), `${lat},${lon}`);
    assert.ok(covers(cov, 47.37, 8.54, 150), 'Zürich within 150 km');
    assert.ok(!covers(cov, 48.86, 2.35, 150), 'Paris');
    assert.ok(!covers(cov, 48.21, 16.37, 150), 'Vienna');
    closed(DE_OUTLINE);
    assert.equal(brightsky.credits.processed, 'Data basis: Deutscher Wetterdienst, averaged over individual values');
    assert.equal(brightsky.credits.processedDe, 'Datenbasis: Deutscher Wetterdienst, Einzelwerte gemittelt');
    // per-area station lists: no learned extent (a visited tile must not hide the rest of Germany)
    assert.equal(brightsky.extent, undefined);
  });
}

// ---------- DMI (stations valid 2026-11-15 15:47Z; four parameters for a box around Zealand) ----------
{
  const NOW = new Date('2026-11-15T15:47:00Z');
  const fakeCtx = () => {
    const requested = [];
    const getJSON = async (url) => {
      requested.push(url);
      const u = new URL(url);
      if (u.pathname.endsWith('/station/items')) return fixture('dmi-stations.json');
      if (u.pathname.endsWith('/observation/items')) return fixture('dmi-obs-zealand.json')[u.searchParams.get('parameterId')];
      throw new Error(`unexpected URL ${url}`);
    };
    return { requested, ctx: { getJSON, getText: async () => '', cache: createMemoryCache(), now: () => NOW } };
  };

  test('DMI stations and ids: records valid now with T or pressure; barometer heights; IEM alias 0-208-0-NNN', () => {
    const list = dmi.internals.compactStations(fixture('dmi-stations.json'));
    assert.ok(list.length >= 100 && list.length <= 130, `${list.length}`);
    const k = list.find((s) => s.id === '06180');
    assert.deepEqual([k.name, k.elevM, k.baroM, k.wmo, k.country], ['Københavns Lufthavn', 5, 5, '06180', 'DNK']);
    assert.ok(!list.some((s) => s.id === '05408' || s.id === '24043'), 'rain gauge and manual snow stations left out');
    assert.deepEqual(dmi.internals.idsFor('06180', '06180'), { wigos: ['0-20000-0-06180', '0-208-0-180'], wmo: '06180' });
    assert.deepEqual(dmi.internals.idsFor('06030', null), { wigos: ['0-208-0-30', '0-208-0-030'], wmo: null });
    assert.deepEqual(dmi.internals.idsFor('04250', '04250').wigos, ['0-20000-0-04250', '0-208-0-250']);
    assert.deepEqual(dmi.internals.idsFor('20228', null), { wigos: [], wmo: null });
  });

  test('DMI current values: four requests (one per parameter) for the box of the selected stations, cached 10 min', async () => {
    const { ctx, requested } = fakeCtx();
    const obs = await dmi.nearest(pt(55.68, 12.57), { radiusM: km(40) }, ctx);                // Copenhagen
    assert.ok(obs.every((o) => o.cloudFraction === null), 'no cloud field');
    assert.deepEqual(obs.map((o) => o.station.id), ['06186', '06180', '06181', '06183', '06188', '06170']);
    const k = obs.find((o) => o.station.id === '06180');
    assert.deepEqual([k.time.toISOString(), k.temperatureC, k.pressure, k.station.barometerM], ['2026-11-15T15:40:00.000Z', 6, { kind: 'station', pa: P(1002.1) }, 5]);
    near(k.humidity, 0.804, 1e-12);
    assert.equal(obs.find((o) => o.station.id === '06186').pressure, null);                                    // no barometer
    const q = requested.filter((u) => u.includes('/observation/items'));
    assert.deepEqual(q.map((u) => new URL(u).searchParams.get('parameterId')), ['temp_dry', 'humidity', 'pressure', 'pressure_at_sea']);
    assert.equal(new URL(q[0]).searchParams.get('bbox'), '12.12,55.52,12.73,55.89');
    assert.equal(new URL(q[0]).searchParams.get('datetime'), '2026-11-15T14:10:00Z/..');
    await dmi.nearest(pt(55.68, 12.57), { radiusM: km(40) }, ctx);
    assert.equal(requested.filter((u) => u.includes('/observation/items')).length, 4);
    assert.equal(requested.filter((u) => u.includes('/station/items')).length, 1);
  });

  test('DMI pressure check (5 m): a barometer height that does not fit the pressures drops the pressure only', () => {
    assert.equal(DMI_PRESSURE_QC.toleranceM, 5);
    const st = { id: 'x', name: 'x', ...pt(55, 12), elevM: 5, barometerM: 5, ids: { wigos: [] } };
    const row = (o) => ({ time: NOW.toISOString(), T: 6, RH: 0.8, P: P(1002.1), PSEA: P(1002.7), ...o });
    const ok = dmi.internals.normalise(st, row(), 1);
    assert.deepEqual(ok.pressure, { kind: 'station', pa: P(1002.1) });
    const bad = dmi.internals.normalise(st, row({ P: P(1001.0) }), 1);   // implies ≈ 14 m (listed 5 m)
    assert.deepEqual([bad.pressure, bad.qc, bad.temperatureC], [null, ['pressureInconsistent'], 6]);
    const sea = dmi.internals.normalise({ ...st, barometerM: null }, row({ P: null }), 1);
    assert.equal(sea.pressure, null);                                                                           // sea-level only: not used
  });

  test('DMI coverage (Denmark, Bornholm, North Sea, Faroe Islands, Greenland) and height override of IEM SYNOP', () => {
    const cov = dmi.coverage;
    for (const s of dmi.internals.compactStations(fixture('dmi-stations.json'))) assert.ok(coverageIntersects(cov, s.latRad, s.lonRad, 0), `${s.id} ${s.name}`);
    for (const [lat, lon] of [[55.68, 12.57], [56.16, 10.20], [57.05, 9.92], [55.10, 14.70], [62.01, -6.77], [64.18, -51.72], [76.53, -68.70]]) assert.ok(covers(cov, lat, lon, 0), `${lat},${lon}`);
    assert.ok(covers(cov, 53.55, 9.99, 150), 'Hamburg within 150 km');
    assert.ok(covers(cov, 55.60, 13.00, 150), 'Malmö within 150 km');
    for (const [lat, lon, name] of [[59.91, 10.75, 'Oslo'], [52.52, 13.40, 'Berlin'], [64.13, -21.90, 'Reykjavik'], [63.75, -68.52, 'Iqaluit']]) assert.ok(!covers(cov, lat, lon, 150), name);
    const syn = { sourceId: 'iem-synop', id: '0-208-0-181', ...pt(55.766, 12.526), elevM: 40, ids: { wigos: ['0-208-0-181'] } };
    const d = { sourceId: 'dmi', id: '06181', ...pt(55.7663, 12.5263), elevM: 40, barometerM: 42, ids: dmi.internals.idsFor('06181', '06181'), authoritative: true };
    const [s] = applyMetadataOverride([syn, d]);
    assert.deepEqual([s.elevM, s.barometerM, s.elevFrom.sourceId], [40, 42, 'dmi']);
  });

  test('DMI latest record: the newest complete time (T, station and sea-level pressure) wins over a newer T-only time', () => {
    const f = (stationId, parameterId, observed, value) => ({ properties: { stationId, parameterId, observed, value } });
    const r = dmi.internals.compactObservations([[f('06030', 'temp_dry', '2026-11-15T16:00:00Z', 3.7), f('06030', 'temp_dry', '2026-11-15T16:10:00Z', 3.6),
      f('06186', 'temp_dry', '2026-11-15T16:10:00Z', 5.9)], [f('06030', 'pressure', '2026-11-15T16:00:00Z', 997.9)], [f('06030', 'pressure_at_sea', '2026-11-15T16:00:00Z', 998.5)]]);
    assert.deepEqual([r['06030'].time, r['06030'].T, r['06030'].P, r['06030'].PSEA], ['2026-11-15T16:00:00.000Z', 3.7, P(997.9), P(998.5)]);
    assert.deepEqual([r['06186'].time, r['06186'].P], ['2026-11-15T16:10:00.000Z', null]);                       // no barometer: newest T
  });
}

// ---------- ECCC SWOB (Montréal and Banff areas, 2026-11-15) ----------
{
  const NOW = new Date('2026-11-15T20:24:00Z');
  const fakeCtx = () => {
    const requested = [];
    const getJSON = async (url) => {
      requested.push(url);
      if (url.includes('/swob-partner-stations/')) return fixture('eccc-swob-partner-stations.json');
      if (url.includes('/swob-stations/')) return fixture('eccc-swob-stations.json');
      if (url.includes('/swob-realtime/')) return fixture('eccc-swob-realtime-montreal.json');
      throw new Error(`unexpected URL ${url}`);
    };
    return { requested, ctx: { getJSON, getText: async () => '', cache: createMemoryCache(), now: () => NOW } };
  };
  const stationLists = () => eccc.internals.compactStations(fixture('eccc-swob-stations.json'), fixture('eccc-swob-partner-stations.json'));

  test('ECCC stations and ids: ECCC/NAV CANADA and partner lists; WMO, IEM alias 0-124-0-NNN; partner attribution', () => {
    const list = stationLists();
    assert.ok(list.length >= 30, `${list.length}`);
    const yul = list.find((s) => s.id === '7025251');
    assert.deepEqual([yul.name, yul.elevM, yul.wmo, yul.provider], ['Montreal/Pierre Elliott Trudeau', 36.5, 71627, 'NAV CANADA']);
    const partner = list.find((s) => s.notice);
    assert.ok(partner && /All rights reserved|provided by/.test(partner.notice), 'partner notice kept');
    assert.deepEqual(eccc.internals.idsFor(71627, null), { wigos: ['0-20000-0-71627', '0-124-0-627'], wmo: '71627', icao: null });
    assert.deepEqual(eccc.internals.idsFor(71035, 'CYOW').wigos, ['0-20000-0-71035', '0-124-0-35', '0-124-0-035']);
    assert.deepEqual(eccc.internals.idsFor(null, null), { wigos: [], wmo: null, icao: null });
  });

  test('ECCC current values: one request for the selected box, only the needed fields, newest record per station', async () => {
    const { ctx, requested } = fakeCtx();
    const obs = await eccc.nearest(pt(45.50, -73.57), { radiusM: km(40) }, ctx);
    assert.ok(obs.every((o) => o.cloudFraction === null), 'no cloud field');
    const mc = obs.find((o) => o.station.id === '7024745');                         // McTavish, minutely
    assert.deepEqual([mc.time.toISOString(), mc.temperatureC, mc.pressure], ['2026-11-15T20:19:00.000Z', 6.5, { kind: 'station', pa: P(1010.3) }]);
    near(mc.humidity, 0.61, 1e-12);
    const yul = obs.find((o) => o.station.id === '7025251');                        // NAV CANADA, hourly
    assert.equal(yul.time.toISOString(), '2026-11-15T20:00:00.000Z'); near(yul.pressure.pa, P(1014.9), 1e-6);
    assert.ok(yul.attribution.endsWith('and NAV CANADA'), yul.attribution);
    const rt = requested.filter((u) => u.includes('/swob-realtime/'));
    assert.equal(rt.length, 1);
    const u = new URL(rt[0]);
    assert.equal(u.searchParams.get('datetime'), '2026-11-15T18:54:00Z/..');
    assert.equal(u.searchParams.get('skipGeometry'), 'true');
    assert.equal(u.searchParams.get('sortby'), '-date_tm-value');
    assert.ok(u.searchParams.get('properties').split(',').includes('stn_pres'));
    await eccc.nearest(pt(45.50, -73.57), { radiusM: km(40) }, ctx);
    assert.equal(requested.filter((x) => x.includes('/swob-realtime/')).length, 1);           // cached 10 min
    assert.equal(requested.filter((x) => x.includes('-stations/')).length, 2);               // lists cached 90 days
  });

  test('ECCC records: QA other than 100 rejected per value; implied-height check from the newest hourly record with sea-level pressure; partners T/RH only', () => {
    const f = (t, p) => ({ properties: { 'msc_id-value': 'X', 'date_tm-value': t, ...p } });
    const r = eccc.internals.compactRecords([
      f('2026-11-15T20:10:00Z', { air_temp: 5.0, 'air_temp-qa': 100, rel_hum: 80, 'rel_hum-qa': -10, stn_pres: 1000.0, 'stn_pres-qa': 100 }),
      f('2026-11-15T20:00:00Z', { air_temp: 4.9, 'air_temp-qa': 100, rel_hum: 81, 'rel_hum-qa': 100, stn_pres: 1000.1, 'stn_pres-qa': 100, mslp: 1012.5 }),
      f('2026-11-15T20:11:00Z', { air_temp: 99, 'air_temp-qa': 0, stn_pres: 1000.0, 'stn_pres-qa': 100 }),
    ]).X;
    assert.deepEqual([r.time, r.T, r.RH, r.P], ['2026-11-15T20:10:00.000Z', 5.0, null, P(1000.0)]);
    assert.deepEqual(r.check, { T: 4.9, P: P(1000.1), SLP: P(1012.5) });                               // implies ≈ 102 m
    const st = { id: 'X', name: 'X', ...pt(45, -73), elevM: 100, ids: { wigos: [] }, network: 'MSC' };
    assert.deepEqual(eccc.internals.normalise(st, r, 1).pressure, { kind: 'station', pa: P(1000.0) });
    const part = eccc.internals.normalise({ ...st, partner: true, notice: 'Data provided by X. All rights reserved.' }, r, 1);
    assert.deepEqual([part.pressure, part.temperatureC, part.attribution], [null, 5.0, 'Data Source: Environment and Climate Change Canada. Data provided by X. All rights reserved.']);
    assert.ok(part.notes.some((n) => n.code === 'partnerPressureNotUsed'));
    const bad = eccc.internals.normalise({ ...st, elevM: 30 }, r, 1);               // listed 30 m, pressures imply ~102 m
    assert.deepEqual([bad.pressure, bad.qc, bad.temperatureC], [null, ['pressureInconsistent'], 5.0]);
  });

  test('ECCC coverage: Canada including Sable Island and the Niagara peninsula; not the US interior', () => {
    const cov = eccc.coverage;
    for (const [lat, lon] of [[45.50, -73.57], [51.05, -114.07], [49.28, -123.12], [63.75, -68.52], [82.5, -62.3], [43.93, -60.01], [42.91, -78.93], [47.56, -52.71], [69.45, -133.0]])
      assert.ok(covers(cov, lat, lon, 0), `${lat},${lon}`);
    assert.ok(covers(cov, 42.33, -83.05, 50), 'Detroit/Windsor within 50 km');
    for (const [lat, lon, name] of [[41.88, -87.63, 'Chicago'], [39.74, -104.99, 'Denver'], [40.71, -74.0, 'New York']]) assert.ok(!covers(cov, lat, lon, 150), name);
    closed(CA_OUTLINE); closed(SABLE_ISLAND_BOX);
    for (const s of stationLists()) assert.ok(coverageIntersects(cov, s.latRad, s.lonRad, km(10)), s.name);
  });
}
