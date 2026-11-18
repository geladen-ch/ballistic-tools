// Source plumbing: two-step interface, selection, metadata override, cross-feed de-duplication, automatic activation,
// shared QC. Uses fake adapters; no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/weather-fixtures.js';
import { degToRad, hpaToPa, kmToM, minToS, sToMs } from '../src/quantity.js';
import { choosePressure, sanitise } from '../src/weather/qc.js';
import { idsMatch, wmoFromWigos, applyMetadataOverride, groupSites, selectStations, pickFresh } from '../src/weather/select.js';
import { coverageIntersects, planSources, breakerState, recordOutcome, sourceMode, BREAKER } from '../src/weather/activation.js';
import { createMemoryCache } from '../src/weather/cache.js';
import { fetchObservations, markDuplicates, estimate, regionalCloudFraction, cloudReports } from '../src/weather/pipeline.js';
import { cloudFactor, diurnalCorrection } from '../src/weather/diurnal.js';
import { iemSynop } from '../src/weather/sources/iem-synop.js';

const rad = degToRad, P = hpaToPa, km = kmToM;
const ll = (latDeg, lonDeg) => ({ latRad: rad(latDeg), lonRad: rad(lonDeg) });

// A rough outline of Switzerland as a national adapter would declare it ([lonRad, latRad] pairs).
const CH = [[5.96, 46.13], [6.79, 45.99], [7.86, 45.92], [8.44, 46.46], [9.02, 45.82], [9.55, 46.30], [10.49, 46.55],
  [10.47, 46.87], [9.53, 47.27], [8.56, 47.81], [7.59, 47.59], [6.84, 47.17], [5.96, 46.13]].map(([lon, lat]) => [rad(lon), rad(lat)]);

// ---------- QC ----------
test('qc.choosePressure: station pressure, placeholders, inconsistent heights, QNH-only reports', () => {
  assert.deepEqual(choosePressure({ stationPa: P(966.7), seaPa: P(1019.6), tempC: -0.9, heightM: 426.3 }).pressure, { kind: 'station', pa: P(966.7) });
  const flu = choosePressure({ stationPa: P(945.6), seaPa: P(1018.9), tempC: 0.9, heightM: 556 });
  assert.equal(flu.pressure, null); assert.deepEqual(flu.qc, ['pressureInconsistent']);
  assert.equal(flu.notes[0].code, 'pressureInconsistent'); assert.equal(flu.notes[0].listedM, 556);
  assert.equal(choosePressure({ stationPa: P(945.6), seaPa: P(1018.9), tempC: 0.9, heightM: 605 }).pressure.kind, 'station');   // surveyed height
  const lv = choosePressure({ stationPa: P(0.1), seaPa: P(1014.2), tempC: 0, heightM: 19 });
  assert.deepEqual(lv.pressure, { kind: 'mslp', pa: P(1014.2) }); assert.deepEqual(lv.qc, ['pressureOutOfRange']);
  // QNH is an ISA construct: no implied-height test against it
  assert.equal(choosePressure({ stationPa: P(945.6), seaPa: P(1017), seaKind: 'qnh', tempC: 0.9, heightM: 556 }).pressure.kind, 'station');
  assert.deepEqual(choosePressure({ seaPa: P(1017), seaKind: 'qnh' }).pressure, { kind: 'qnh', pa: P(1017) });
});

test('qc.sanitise: implausible values are dropped with a note and a code; RH just above 100 % is clipped', () => {
  const base = { station: {}, time: new Date(), temperatureC: 12, dewpointC: 5, humidity: 0.62, pressure: { kind: 'qnh', pa: P(1013) }, notes: [] };
  assert.deepEqual(sanitise(base).qc, []);
  const t = sanitise({ ...base, temperatureC: 99 });
  assert.equal(t.temperatureC, null); assert.equal(t.humidity, null); assert.deepEqual(t.qc, ['temperatureOutOfRange']);
  assert.equal(t.notes[0].code, 'temperatureOutOfRange');
  assert.equal(sanitise({ ...base, humidity: 1.015 }).humidity, 1);
  assert.equal(sanitise({ ...base, humidity: 1.4 }).humidity, null);
  assert.equal(sanitise({ ...base, dewpointC: 14 }).humidity, null);
  assert.equal(sanitise({ ...base, pressure: { kind: 'station', pa: P(0.1) } }).pressure, null);
  assert.ok(!base.qc, 'input not mutated');
});

// ---------- ids, override, selection ----------
test('ids: WIGOS aliases, WMO index, ICAO', () => {
  assert.equal(wmoFromWigos('0-20000-0-06660'), '06660'); assert.equal(wmoFromWigos('0-756-0-660'), null);
  assert.ok(idsMatch({ wigos: ['0-756-0-664', '0-20000-0-06664'] }, { wigos: ['0-20000-0-06664'] }));
  assert.ok(idsMatch({ wmo: '06660' }, { wigos: ['x'], wmo: '06660' }));
  assert.ok(idsMatch({ icao: 'LSZH' }, { icao: 'LSZH' }));
  assert.ok(!idsMatch({ icao: 'LSZH' }, { wmo: '06670' }));
  assert.ok(!idsMatch(undefined, { wmo: '1' }));
});

const flMeta = { sourceId: 'iem-synop', id: '0-756-0-660', name: 'ZUERICH / FLUNTERN', ...ll(47.3779, 8.5657), elevM: 556, ids: { wigos: ['0-756-0-660'], wmo: null } };
const smaMeta = { sourceId: 'ch-test', id: 'SMA', name: 'Zürich / Fluntern', ...ll(47.37792, 8.56575), elevM: 604, barometerM: 605,
  ids: { wigos: ['0-20000-0-06660'], wmo: '06660' }, authoritative: true };

test("metadata override: the national height replaces IEM's for the same mast; Fluntern's pressure is recovered", () => {
  const [fl, sma] = applyMetadataOverride([flMeta, smaMeta]);
  assert.equal(fl.elevM, 604); assert.equal(fl.barometerM, 605);
  assert.deepEqual(fl.elevFrom, { sourceId: 'ch-test', id: 'SMA', elevM: 556, barometerM: null });
  assert.equal(sma.elevM, 604); assert.ok(!sma.elevFrom);
  assert.ok(!flMeta.elevFrom, 'input not mutated');
  // 300 m away (another mast) and no common id: no override
  const [other] = applyMetadataOverride([{ ...flMeta, latRad: rad(47.3806) }, smaMeta]);
  assert.equal(other.elevM, 556);
  // a common WMO id overrides even a few km apart (positions differ between lists)
  const [byId] = applyMetadataOverride([{ ...flMeta, latRad: rad(47.40), ids: { wigos: ['0-20000-0-06660'], wmo: '06660' } }, smaMeta]);
  assert.equal(byId.elevM, 604);
  // with the surveyed height, the 20:00Z Fluntern report passes the implied-height check
  const cur = fixture('iem-synop-currents.json').data.find((r) => r.station === '0-756-0-660');
  const o = iemSynop.internals.normalise({ ...fl, distanceM: km(2.1) }, cur, km(2.1));
  assert.deepEqual(o.pressure, { kind: 'station', pa: P(945.6) }); assert.equal(o.station.barometerM, 605); assert.equal(o.station.elevM, 604);
  assert.ok(o.notes.some((n) => n.code === 'heightFromList' && n.sourceId === 'ch-test'), JSON.stringify(o.notes));
});

test('selection: sites grouped across feeds; horizontal and effective-distance lists; per-source caps', () => {
  const m = (sourceId, id, dKm, elevM, extra = {}) => ({ sourceId, id, name: id, latRad: rad(47 + dKm / 111.2), lonRad: rad(8), elevM, distanceM: km(dKm), ...extra });
  const metas = [
    m('a', 'A1', 1, 400), m('b', 'B1', 1.5, 410),                  // same site (0.5 km, 10 m)
    m('a', 'A2', 5, 1500), m('b', 'B2', 20, 420), m('b', 'B3', 30, 430), m('c', 'C1', 60, 900),
  ];
  const site = groupSites(metas);
  assert.ok(site[0] === site[1] && site[0] !== site[2], 'A1/B1 one site');
  // a chain of one network's stations 1.1 km apart is not collapsed through another source's station
  const chain = [0, 1, 2].map((i) => m('a', `N${i}`, i * 1.1, 470)).concat([m('c', 'C', 1.1, 470)]);
  assert.equal(new Set(groupSites(chain)).size, 3);
  // IEM aliases (same source, identical position) are one site
  const al = groupSites([m('s', 'X1', 3, 400), m('s', 'X2', 3, 400)]);
  assert.equal(al[0], al[1]);
  const h = selectStations(metas, null, {}, { horizontal: 3, effective: 2, lambda: 200 });
  assert.deepEqual(h.selected.map((x) => x.id).sort(), ['A1', 'A2', 'B1', 'B2']);    // 3 sites by distance: A1/B1, A2, B2
  // device at 900 m: C1 (60 km, Δh 0) is effectively nearer than B2/B3; A2 (Δh 600 m → 120 km) is not
  const e = selectStations(metas, 900, {}, { horizontal: 2, effective: 2, lambda: 200 });
  assert.deepEqual(e.selected.map((x) => x.id).sort(), ['A1', 'A2', 'B1', 'C1']);
  const capped = selectStations(metas, null, { b: 1 }, { horizontal: 10, effective: 0, lambda: 200 });
  assert.deepEqual(capped.bySource.get('b').map((x) => x.id), ['B1']);
  // a capped source does not use up slots: with 3 slots and b capped at 1, C1 is still reached
  const slots = selectStations(metas, null, { b: 1 }, { horizontal: 3, effective: 0, lambda: 200 });
  assert.deepEqual(slots.selected.map((x) => x.id).sort(), ['A1', 'A2', 'B1', 'C1']);
});

test('pickFresh: fresh first; nothing fresh → nearest older alone, flagged; future timestamps ignored', () => {
  const now = Date.parse('2026-11-15T12:00:00Z');
  const o = (id, dKm, min, T = 1) => ({ sourceId: 's', station: { id, distanceM: km(dKm) }, time: new Date(now - sToMs(minToS(min))), temperatureC: T, pressure: null, notes: [] });
  const maxAgeS = minToS(90);
  assert.deepEqual(pickFresh([o('far', 9, 10), o('near', 1, 120)], { now, maxAgeS }).map((x) => x.station.id), ['far']);
  const stale = pickFresh([o('a', 3, 200), o('b', 1, 300), o('c', 0.5, 100, null)], { now, maxAgeS });
  assert.equal(stale.length, 1); assert.equal(stale[0].station.id, 'b'); assert.equal(stale[0].stale, true);
  assert.equal(stale[0].notes.at(-1).code, 'noFreshNearestOlder');
  assert.equal(pickFresh([o('future', 1, -30)], { now, maxAgeS })[0].stale, true);
});

// ---------- activation ----------
test('activation: coverage outline vs search circle; modes; validation; breaker; learned extent', () => {
  const region = { kind: 'region', polygons: [CH] };
  const at = (latDeg, lonDeg, radiusKm) => coverageIntersects(region, rad(latDeg), rad(lonDeg), km(radiusKm));
  assert.ok(at(47.37, 8.54, 150), 'Zürich inside');
  assert.ok(at(48.0, 7.85, 50), 'Freiburg: Swiss border within 50 km');
  assert.ok(!at(48.78, 9.18, 50), 'Stuttgart: border ~100 km away');
  assert.ok(at(48.78, 9.18, 150));
  assert.ok(!at(52.52, 13.40, 150), 'Berlin');
  const reg = [
    { id: 'g', coverage: { kind: 'global' } },
    { id: 'ch', coverage: region },
    { id: 'new', coverage: { kind: 'global' }, autoDefault: false },
    { id: 'br', coverage: { kind: 'global' } },
    { id: 'ex', coverage: { kind: 'global' } },
  ];
  const r = (pt, o = {}) => Object.fromEntries(planSources(reg, pt, { radiusM: km(150), ...o }).map((p) => [p.source.id, p.reason]));
  const zh = ll(47.37, 8.54);
  const farBox = [rad(-80), rad(20), rad(-60), rad(40)];
  assert.deepEqual(r(zh, { breakers: { br: { open: true } }, extents: { ex: farBox } }),
    { g: 'used', ch: 'used', new: 'notValidated', br: 'paused', ex: 'noStationsInArea' });
  assert.equal(r(ll(52.52, 13.4)).ch, 'outside');
  // modes: Auto / Off only. An unvalidated source is Off until set to Auto; the breaker applies in Auto.
  const m = r(zh, { modes: { new: 'auto', br: 'auto', g: 'off' }, breakers: { br: { open: true } } });
  assert.deepEqual([m.new, m.br, m.g], ['used', 'paused', 'off']);
  assert.equal(sourceMode({ id: 'x', autoDefault: false }, {}), 'off');
  assert.equal(sourceMode({ id: 'x', autoDefault: false }, { x: 'auto' }), 'auto');
  assert.equal(sourceMode({ id: 'x' }, { x: 'bogus' }), 'auto');
});

test('circuit breaker: opens after 3 consecutive failures, closes after the pause or a success', async () => {
  const store = createMemoryCache();
  const t0 = 1e12;
  for (let i = 0; i < BREAKER.failures - 1; i++) await recordOutcome(store, 's', false, t0);
  assert.ok(!(await breakerState(store, 's', t0)).open);
  await recordOutcome(store, 's', false, t0);
  assert.ok((await breakerState(store, 's', t0 + 60000)).open);
  assert.ok(!(await breakerState(store, 's', t0 + sToMs(BREAKER.pauseS) + 1)).open);
  assert.equal(BREAKER.pauseS, 10800);
  await recordOutcome(store, 's', true, t0);
  assert.equal((await breakerState(store, 's', t0)).failures, 0);
});

// ---------- pipeline with fake adapters ----------
const NOW = new Date('2026-11-15T12:00:00Z');
const minAgo = (m) => new Date(+NOW - sToMs(minToS(m)));
function fakeSource(id, stationList, reports, extra = {}) {
  const calls = { stations: 0, current: [] };
  return {
    calls,
    adapter: {
      id, name: id, attribution: id, homepage: '', coverage: { kind: 'global' }, minRefreshS: minToS(10), nominalIntervalS: minToS(10),
      ...extra,
      async stations() { calls.stations++; return stationList; },
      async current(metas) {
        calls.current.push(metas.map((m) => m.id));
        if (extra.failCurrent) throw new Error('boom');
        return metas.filter((m) => reports[m.id]).map((m) => ({
          sourceId: id, reportType: extra.reportType ?? 'NAT', attribution: id, notes: [], qc: [],
          station: { id: m.id, name: m.name, latRad: m.latRad, lonRad: m.lonRad, elevM: m.elevM, barometerM: m.barometerM ?? null, distanceM: m.distanceM, ids: m.ids },
          precision: { tC: extra.reportType === 'METAR' ? 1 : 0.1 },
          ...reports[m.id],
        }));
      },
    },
  };
}
const ctxFor = (store = createMemoryCache()) => ({ getJSON: async () => { throw new Error('no network'); }, getText: async () => '', cache: store, now: () => NOW });

test('fetchObservations: national station overrides SYNOP height, status per source, de-duplication, combination', async () => {
  const pt = ll(47.37, 8.54);
  const metar = fakeSource('metar', [{ id: 'LSZH', name: 'Zürich airport', ...ll(47.4784, 8.5302), elevM: 432, ids: { icao: 'LSZH' } }],
    { LSZH: { time: minAgo(10), temperatureC: 2, humidity: 0.8, pressure: { kind: 'qnh', pa: P(1018.5) } } }, { reportType: 'METAR' });
  const synop = fakeSource('synop', [{ ...flMeta, sourceId: undefined }, { id: '0-756-0-670', name: 'KLOTEN', ...ll(47.4796, 8.536), elevM: 426.3, ids: { wigos: ['0-756-0-670'] } }],
    { '0-756-0-660': { time: minAgo(60), temperatureC: 0.9, humidity: 0.9, pressure: { kind: 'station', pa: P(945.6) } },
      '0-756-0-670': { time: minAgo(60), temperatureC: -0.9, humidity: 0.95, pressure: { kind: 'station', pa: P(966.7) } } }, { reportType: 'SYNOP' });
  const nat = fakeSource('ch', [{ ...smaMeta, sourceId: undefined, authoritative: undefined }],
    { SMA: { time: minAgo(12), temperatureC: 1.1, humidity: 0.88, pressure: { kind: 'station', pa: P(945.5) } } },
    { coverage: { kind: 'region', polygons: [CH] }, authoritativeMetadata: true });
  const far = fakeSource('far', [], {}, { coverage: { kind: 'region', polygons: [[[rad(-80), rad(20)], [rad(-60), rad(20)], [rad(-60), rad(40)], [rad(-80), rad(20)]]] } });
  const r = await fetchObservations(pt, {
    radiusM: km(150), maxAgeS: minToS(90), deviceHeightM: 470, ctx: ctxFor(),
    sources: [metar.adapter, synop.adapter, nat.adapter, far.adapter],
  });
  assert.equal(far.calls.stations, 0);
  const st = Object.fromEntries(r.status.map((s) => [s.id, s]));
  assert.deepEqual([st.metar.state, st.synop.state, st.ch.state, st.far.reason], ['used', 'used', 'used', 'outside']);
  assert.equal(st.ch.nextExpected, +minAgo(12) + sToMs(minToS(10)));
  const fl = r.observations.find((o) => o.station.id === '0-756-0-660');
  assert.equal(fl.station.elevM, 604); assert.equal(fl.station.barometerM, 605);   // the adapter received the national heights
  assert.equal(r.selectedFor, 470);
  // de-duplication: Fluntern SYNOP vs national SMA (same mast): national station pressure (surveyed barometer) and
  // the newer national T; Kloten SYNOP vs LSZH METAR: SYNOP station pressure, newer METAR T.
  const d = markDuplicates(r.observations);
  const by = (src) => d.find((o) => o.sourceId === src && (src !== 'synop' || o.station.id === '0-756-0-660'));
  assert.ok(by('synop').skip.p?.label.includes('Zürich / Fluntern') && by('synop').skip.t, JSON.stringify(by('synop').skip));
  assert.equal(by('synop').skip.p.code, 'sameSitePressure'); assert.equal(by('synop').skip.p.kind, 'station');
  assert.deepEqual(Object.keys(by('ch').skip), []);
  const klo = d.find((o) => o.station.id === '0-756-0-670');
  assert.ok(klo.skip.t && !klo.skip.p && by('metar').skip.p && !by('metar').skip.t);
  const e = estimate(r.observations, 470, { now: NOW, timeCorrect: false });
  assert.equal(e.mode, 'multi');
  assert.deepEqual(e.pressure.used.map((u) => u.row.obs.station.id).sort(), ['0-756-0-670', 'SMA']);
});

test('fetchObservations: unselected sources are not asked; failures open the breaker; nothing fresh → stale fallback', async () => {
  const pt = ll(47.37, 8.54);
  const near = Array.from({ length: 45 }, (_, i) => ({ id: `N${i}`, name: `N${i}`, ...ll(47.37 + i * 0.01, 8.54), elevM: 470 }));
  const a = fakeSource('a', near, Object.fromEntries(near.map((s) => [s.id, { time: minAgo(5), temperatureC: 1, humidity: 0.8, pressure: null }])));
  const b = fakeSource('b', [{ id: 'FAR', name: 'far', ...ll(48.6, 8.54), elevM: 470 }], { FAR: { time: minAgo(5), temperatureC: 1, pressure: null } });
  const c = fakeSource('c', [{ id: 'C', name: 'c', ...ll(47.38, 8.54), elevM: 470 }], {}, { failCurrent: true });
  const store = createMemoryCache();
  const run = (srcs, s = store) => fetchObservations(pt, { radiusM: km(150), maxAgeS: minToS(90), ctx: ctxFor(s), sources: srcs });
  let r;
  for (let i = 0; i < BREAKER.failures; i++) r = await run([a.adapter, b.adapter, c.adapter]);
  const st = Object.fromEntries(r.status.map((s) => [s.id, s]));
  assert.equal(st.b.reason, 'notSelected'); assert.equal(b.calls.current.length, 0);        // 137 km away, 40 nearer sites
  assert.equal(st.c.state, 'error'); assert.equal(r.errors[0].error.message, 'boom');
  assert.equal(st.c.error.message, 'boom');
  assert.ok(a.calls.current[0].length <= 40);
  r = await run([a.adapter, b.adapter, c.adapter]);
  assert.equal(r.status.find((s) => s.id === 'c').reason, 'paused');
  const old = fakeSource('old', [{ id: 'O', name: 'o', ...ll(47.4, 8.54), elevM: 470 }], { O: { time: minAgo(300), temperatureC: 1, pressure: null } });
  r = await run([old.adapter], createMemoryCache());
  assert.equal(r.observations.length, 1); assert.equal(r.observations[0].stale, true);
  assert.equal(r.status[0].reason, 'used');
});

test('markDuplicates, three feeds at one site: one report per quantity, never two reports of one source merged', () => {
  const o = (sourceId, id, latDeg, elev, x) => ({ sourceId, reportType: sourceId === 'metar' ? 'METAR' : sourceId === 'synop' ? 'SYNOP' : 'NAT', attribution: '',
    station: { id, name: id, latRad: rad(latDeg), lonRad: rad(8.5), elevM: elev, distanceM: km(5), ...(x.st ?? {}) }, time: minAgo(x.age), temperatureC: 1, humidity: 0.8,
    pressure: x.p, notes: [], precision: { tC: sourceId === 'metar' ? 1 : 0.1 } });
  const M = o('metar', 'LSZH', 47.4784, 432, { age: 20, p: { kind: 'qnh', pa: P(1018.5) }, st: { ids: { icao: 'LSZH' } } });
  const S = o('synop', 'KLO', 47.4796, 426, { age: 50, p: { kind: 'station', pa: P(966.7) } });
  const N = o('nat', 'KLO-N', 47.4797, 427, { age: 5, p: { kind: 'station', pa: P(966.9) }, st: { barometerM: 428 } });
  const out = markDuplicates([M, S, N]);
  const g = (id) => out.find((x) => x.station.id === id).skip;
  assert.deepEqual(Object.keys(g('KLO-N')), []);                                       // newest T and surveyed station pressure
  assert.ok(g('KLO').p && g('KLO').t && g('LSZH').p && g('LSZH').t);
  // a second METAR station nearer to the site: it joins the site, LSZH stays a separate station (one per source)
  const M2 = o('metar', 'LSZX', 47.4790, 430, { age: 2, p: { kind: 'qnh', pa: P(1018.5) } });
  const out2 = markDuplicates([M, S, N, M2]);
  const g2 = (id) => out2.find((x) => x.station.id === id).skip;
  assert.deepEqual(Object.keys(g2('LSZH')), []);
  assert.deepEqual(Object.keys(g2('LSZX')).sort(), ['p']);                             // newest T wins; surveyed station pressure wins p
  // T tie → finer resolution; older national vs newer METAR → METAR T
  const tie = markDuplicates([{ ...M, time: minAgo(5) }, { ...N, time: minAgo(5) }]);
  assert.ok(tie[0].skip.t && !tie[1].skip.t);
});

test('markDuplicates: a failed pressure check makes the barometer height suspect for all station pressures referred to it', () => {
  const o = (sourceId, id, x) => ({ sourceId, reportType: sourceId.toUpperCase(), attribution: '', station: { id, name: id, latRad: rad(57.0963), lonRad: rad(9.8505),
    elevM: 3, barometerM: x.baro ?? null, distanceM: km(5) }, time: minAgo(x.age), temperatureC: 4, humidity: 0.8, pressure: x.p, qc: x.qc ?? [],
    notes: [], precision: { tC: 0.1 } });
  // Aalborg: DMI says its pressures imply a barometer at 5 m, listed 13 m; IEM SYNOP got the same 13 m by the override
  const D = o('dmi', '06030', { age: 5, baro: 13, p: null, qc: ['pressureInconsistent'] });
  const S = o('iem-synop', '0-208-0-30', { age: 30, baro: 13, p: { kind: 'station', pa: P(997.9) } });
  const M = o('iem', 'EKYT', { age: 20, p: { kind: 'qnh', pa: P(998) } });
  const out = markDuplicates([D, S, M]);
  assert.equal(out[1].skip.p?.code, 'sameSiteInconsistentBarometer'); assert.equal(out[1].skip.p.barometerM, 13);
  assert.equal(out[2].skip.p, undefined);                                            // QNH stays
  // a station pressure referred to another (corrected) height stays usable
  const S2 = o('iem-synop', '0-208-0-30', { age: 30, baro: 5, p: { kind: 'station', pa: P(998.9) } });
  assert.equal(markDuplicates([D, S2])[1].skip.p, undefined);
});

test('fetchObservations: a station list still loading after the patience limit is left to finish; the others answer', async () => {
  const pt = ll(47.37, 8.54);
  const fast = fakeSource('fast', [{ id: 'F', name: 'Fast', ...ll(47.38, 8.55), elevM: 470 }], { F: { time: minAgo(5), temperatureC: 4, humidity: 0.7, pressure: { kind: 'qnh', pa: P(1015) } } });
  const slow = fakeSource('slow', [{ id: 'S', name: 'Slow', ...ll(47.39, 8.55), elevM: 470 }], { S: { time: minAgo(5), temperatureC: 5, pressure: null } });
  let release;
  slow.adapter.stations = () => new Promise((resolve) => { release = () => resolve([{ id: 'S', name: 'Slow', ...ll(47.39, 8.55), elevM: 470 }]); });
  const store = createMemoryCache();
  const r = await fetchObservations(pt, { radiusM: km(150), maxAgeS: minToS(90), ctx: ctxFor(store), sources: [fast.adapter, slow.adapter], listWaitMs: 30 });
  const st = Object.fromEntries(r.status.map((s) => [s.id, s]));
  assert.deepEqual([st.fast.state, st.slow.state, st.slow.reason], ['used', 'inactive', 'listLoading']);
  assert.deepEqual(r.observations.map((o) => o.station.id), ['F']);
  assert.equal(r.errors.length, 0);
  assert.equal(slow.calls.current.length, 0, 'not asked for reports');
  release();                                            // the list finishes later; nothing blows up
  await new Promise((resolve) => setTimeout(resolve, 5));
  // a list that fails late is swallowed too
  const bad = fakeSource('bad', [], {});
  let fail;
  bad.adapter.stations = () => new Promise((_resolve, reject) => { fail = () => reject(new Error('late failure')); });
  const r2 = await fetchObservations(pt, { radiusM: km(150), maxAgeS: minToS(90), ctx: ctxFor(), sources: [fast.adapter, bad.adapter], listWaitMs: 30 });
  assert.equal(r2.status.find((s) => s.id === 'bad').reason, 'listLoading');
  fail();
  await new Promise((resolve) => setTimeout(resolve, 5));
});

// ---------- cloud cover in the time correction ----------
test('regionalCloudFraction: distance-weighted (1 / d^1.5, floor 1 km), 100 km radius, nulls ignored', () => {
  const c = (dKm, cloudFraction) => ({ cloudFraction, station: { distanceM: km(dKm) } });
  const near4 = (x, y) => assert.ok(Math.abs(x - y) < 1e-4, `${x} vs ${y}`);
  near4(regionalCloudFraction([c(10, 1), c(40, 0.25)]), 0.9167);
  near4(cloudFactor(regionalCloudFraction([c(10, 1), c(40, 0.25)])), 0.4628);
  near4(regionalCloudFraction([c(0.5, 0.5), c(30, 1)]), 0.5030);                         // 0.5 km is floored to 1 km
  near4(cloudFactor(regionalCloudFraction([c(0.5, 0.5), c(30, 1)])), 0.9222);
  assert.equal(regionalCloudFraction([c(120, 1), c(10, 0)]), 0, 'a report at 120 km is ignored');
  assert.equal(regionalCloudFraction([c(120, 1)]), null);
  assert.equal(regionalCloudFraction([c(10, null), c(20, undefined)]), null);
  assert.equal(regionalCloudFraction([]), null);
});

const CNOW = new Date('2026-06-21T06:20:00Z');
const cobs = (id, dKm, cloudFraction, { latDeg = 47.4, lonDeg = 8.5, sourceId = 'test', reportType, T = 12, ageMin = 30, ids } = {}) => ({
  sourceId, reportType, attribution: '', cloudFraction,
  station: { id, name: id, latRad: rad(latDeg), lonRad: rad(lonDeg), elevM: 450, distanceM: km(dKm), ...(ids ? { ids } : {}) },
  time: new Date(+CNOW - sToMs(minToS(ageMin))), temperatureC: T, dewpointC: null, humidity: 0.7,
  pressure: { kind: 'qnh', pa: P(1015) }, notes: [], precision: { tC: 1 },
});
const curve = (o) => diurnalCorrection(o.station.latRad, o.station.lonRad, o.time, CNOW).dT;
const rowOf = (e, id) => e.stations.find((r) => r.obs.station.id === id);

test('estimate: a station uses its own cover, one without borrows the regional one, none anywhere leaves the curve', () => {
  const a = cobs('A', 10, 1), b = cobs('B', 15, null, { lonDeg: 8.6, sourceId: 'other' });
  const e = estimate([a, b], 450, { now: CNOW });
  const ra = rowOf(e, 'A'), rb = rowOf(e, 'B');
  assert.deepEqual([ra.cloud.from, rb.cloud.from], ['report', 'area']);
  assert.equal(e.regionalCloudFraction, 1);                                               // only A reports a cover
  assert.ok(Math.abs(ra.cloud.factor - cloudFactor(1)) < 1e-12 && Math.abs(rb.cloud.factor - cloudFactor(1)) < 1e-12);
  assert.ok(Math.abs(ra.dT - curve(a) * cloudFactor(1)) < 1e-12);
  assert.ok(Math.abs(ra.diurnal.dT - curve(a)) < 1e-12, 'the curve before the factor stays available');
  assert.ok(Math.abs(rb.dT - curve(b) * cloudFactor(1)) < 1e-12);
  const none = estimate([cobs('A', 10, null), cobs('B', 15, null, { lonDeg: 8.6 })], 450, { now: CNOW });
  assert.equal(none.regionalCloudFraction, null);
  for (const r of none.stations) { assert.deepEqual([r.cloud.from, r.cloud.factor, r.cloud.fraction], [null, 1, null]); assert.ok(Math.abs(r.dT - curve(r.obs)) < 1e-12); }
});

test('estimate: a clear sky stretches the correction, an overcast one shrinks it; humidity follows; pressure is unaffected', () => {
  const run = (cover) => estimate([cobs('A', 10, cover), cobs('B', 20, cover, { lonDeg: 8.6 })], 450, { now: CNOW });
  const clear = run(0), over = run(1), unknown = run(null);
  const dT = (e) => rowOf(e, 'A').dT;
  assert.ok(dT(clear) > dT(unknown) && dT(unknown) > dT(over) && dT(over) > 0, 'June morning warms');
  assert.ok(clear.temperature.value > unknown.temperature.value && unknown.temperature.value > over.temperature.value);
  assert.ok(clear.humidity.value < over.humidity.value, 'more warming → lower RH at constant vapour pressure');
  assert.equal(clear.pressure.value, over.pressure.value); assert.equal(clear.pressure.value, unknown.pressure.value);
});

test('estimate: time correction off gives no ΔT; single-station mode applies the factor too', () => {
  const o = [cobs('A', 10, 0.5), cobs('B', 15, null, { lonDeg: 8.6 })];
  const off = estimate(o, 450, { now: CNOW, timeCorrect: false });
  assert.ok(off.stations.every((r) => r.dT == null));
  assert.equal(off.temperature.value, estimate(o, 450, { now: CNOW, timeCorrect: false }).temperature.value);
  const one = estimate(o, 450, { now: CNOW, combine: false });
  assert.equal(one.mode, 'nearest');
  assert.deepEqual([one.stations[0].cloud.from, one.regionalCloudFraction], ['report', 0.5]);
  assert.ok(Math.abs(one.stations[0].dT - curve(o[0]) * cloudFactor(0.5)) < 1e-12);
  const borrower = estimate([cobs('B', 5, null), cobs('A', 10, 0.5)], 450, { now: CNOW, combine: false });
  assert.deepEqual([borrower.stations[0].obs.station.id, borrower.stations[0].cloud.from], ['B', 'area']);
});

test('estimate: a report left out of every quantity by de-duplication still gives its cloud cover, and is listed', () => {
  // The METAR (overcast, older) and the national report (newer, no cover) are one site: the national one carries the
  // temperature, but the airport's cover is exactly what the national station lacks.
  const metar = cobs('LSZH', 8, 1, { reportType: 'METAR', sourceId: 'metar', latDeg: 47.4784, lonDeg: 8.5302, ageMin: 40, ids: { icao: 'LSZH' } });
  const nat = cobs('KLO', 8, null, { reportType: 'SMN', sourceId: 'nat', latDeg: 47.4785, lonDeg: 8.5303, ageMin: 10 });
  const e = estimate([metar, nat], 450, { now: CNOW });
  assert.ok(rowOf(e, 'LSZH').obs.skip?.t, 'the METAR is the older report of the site');
  assert.equal(e.regionalCloudFraction, 1);
  assert.deepEqual(rowOf(e, 'KLO').cloud, { fraction: 1, from: 'area', factor: cloudFactor(1) });
  assert.deepEqual(e.cloudReports.map((c) => [c.obs.station.id, c.fraction, c.weight]), [['LSZH', 1, 1]]);
});

test('cloudReports: weights add up to 1 and match the regional cover; stations beyond the radius are not listed', () => {
  const c = (id, dKm, cloudFraction) => ({ cloudFraction, station: { id, distanceM: km(dKm) } });
  const list = cloudReports([c('A', 10, 1), c('B', 40, 0.25), c('C', 120, 0), c('D', 5, null)]);
  assert.deepEqual(list.map((r) => r.obs.station.id), ['A', 'B']);
  assert.ok(Math.abs(list.reduce((s, r) => s + r.weight, 0) - 1) < 1e-12);
  assert.ok(Math.abs(list.reduce((s, r) => s + r.weight * r.fraction, 0) - regionalCloudFraction([c('A', 10, 1), c('B', 40, 0.25)])) < 1e-12);
  assert.deepEqual(cloudReports([]), []);
});

test('estimate: a Bright Sky station next to airports borrows their cover (its own cloud_cover is not used)', () => {
  const metar = cobs('EDDM', 20, 0.25, { reportType: 'METAR', sourceId: 'iem', latDeg: 47.9, lonDeg: 7.9 });
  const dwd = cobs('01443', 5, null, { reportType: 'DWD', sourceId: 'brightsky', latDeg: 47.99, lonDeg: 7.85, T: 13 });
  const e = estimate([dwd, metar], 450, { now: CNOW });
  assert.equal(rowOf(e, '01443').cloud.from, 'area');
  assert.equal(rowOf(e, '01443').cloud.fraction, 0.25);
});
