// IEM (Iowa Environmental Mesonet) adapter: global METAR via ASOS networks.
// Endpoints are CORS "*" and key-less. Etiquette: serialised requests ≥1 s apart (net.js), caches, no polling.
// The wire format (°F, inHg, degrees, percent) is converted here, once, with the named routines of quantity.js.
import { haversineM, bboxContains, bboxDistanceM, polygonBbox, pointsBbox, pointFromGeoJson } from '../geo.js';
import { parseMetar, qnhRoundingCorrection } from '../metar.js';
import { dewpointToRH } from '../atmosphere.js';
import { fahrenheitToCelsius, inhgToPa, percentToFraction, dayToS, minToS, sToMs } from '../../quantity.js';
import { cached, nearestVia, num } from './common.js';

const BASE = 'https://mesonet.agron.iastate.edu';
const TTL = { networks: dayToS(30), stations: dayToS(90), currents: minToS(10), extents: dayToS(365) };
// Multi-station combination needs every fresh station within the radius, capped at the nearest 40.
export const MAX_STATIONS = 40;
const SETTLE_K = MAX_STATIONS; // station lists are loaded until the nearest MAX_STATIONS candidates are certain
const MAX_CURRENTS_NETWORKS = 3;
// IEM network boxes are min/max of signed longitudes (PostGIS extent). A box wider than half the globe cannot be told
// apart from one that wraps across the antimeridian, so its longitude range is ignored until the real extent is learned.
const AMBIGUOUS_WIDTH_RAD = Math.PI;

/** @type {import('./types.js').SourceAdapter & {internals:object}} */
export const iem = {
  id: 'iem',
  name: 'IEM (global METAR)',
  attribution: 'Data: Iowa Environmental Mesonet, Iowa State University',
  homepage: 'https://mesonet.agron.iastate.edu/',
  credits: { text: 'METAR reports: Iowa Environmental Mesonet, Iowa State University', url: 'https://mesonet.agron.iastate.edu/' },
  probe: { url: `${BASE}/api/1/currents.json?station=LSZH` },
  coverage: { kind: 'global' },
  autoDefault: true,
  minRefreshS: minToS(10),
  nominalIntervalS: minToS(30),
  typicalDelayS: minToS(5),
  stations,
  current,
  recentTimes,
  nearest: (point, opts, ctx) => nearestVia(iem, point, opts, ctx),
  internals: { candidateNetworks, compactNetworks, compactStations, compactCurrents, normalise },
};

/**
 * Effective box of a network: the learned extent (from its station list) if known, else IEM's box.
 * @returns {{bbox:number[], lonUnknown:boolean, learned:boolean}}
 */
function effectiveBox(net, extents) {
  const ex = extents?.[net.id];
  if (ex) return { bbox: ex.bbox, lonUnknown: false, learned: true };
  const [w, , e] = net.bbox;
  return { bbox: net.bbox, lonUnknown: e - w > AMBIGUOUS_WIDTH_RAD, learned: false };
}

/**
 * ASOS networks whose box (widened by radiusM) can contain stations within radiusM, nearest box first.
 * @param {{id:string, bbox:number[]}[]} networks  IEM boxes (radians)
 * @param {Record<string,{bbox:number[]}>} [extents] learned extents [west, south, east, north] (west > east wraps)
 */
function candidateNetworks(networks, latRad, lonRad, radiusM, extents = {}) {
  const out = [];
  for (const n of networks) {
    const box = effectiveBox(n, extents);
    const [w, s, e, nn] = box.bbox;
    const hit = box.lonUnknown
      ? bboxContains([-Math.PI, s, Math.PI, nn], latRad, lonRad, radiusM)  // latitude band only
      : bboxContains(box.bbox, latRad, lonRad, radiusM);                    // handles w > e (wraps)
    if (hit) out.push({ ...n, learned: box.learned, minM: bboxDistanceM([w, s, e, nn], latRad, lonRad, { lonUnknown: box.lonUnknown }) });
  }
  return out.sort((a, b) => a.minM - b.minM);
}

/** Learned extents: one map under one key; entries expire individually after TTL.extents. */
async function loadExtents(ctx, now) {
  const all = (await ctx.cache.get('iem:extents')) ?? {};
  const fresh = {};
  for (const [id, ex] of Object.entries(all)) if (now - ex.at < sToMs(TTL.extents)) fresh[id] = ex;
  return fresh;
}
async function learnExtent(ctx, extents, netId, stations, now) {
  const bbox = pointsBbox(stations);
  if (!bbox) return;
  const prev = extents[netId];
  if (prev && prev.n === stations.length && prev.bbox.every((v, i) => v === bbox[i])) return;
  extents[netId] = { bbox, n: stations.length, at: now };
  await ctx.cache.set('iem:extents', extents, Infinity);
}

function compactNetworks(geojson) {
  return geojson.features
    .filter((f) => /ASOS$/.test(String(f.id)) && f.geometry?.type === 'Polygon')
    .map((f) => ({ id: String(f.id), name: f.properties?.name ?? String(f.id), bbox: polygonBbox(f.geometry) }));
}

function compactStations(geojson) {
  return geojson.features
    .filter((f) => f.properties?.online !== false && f.geometry?.type === 'Point')
    .map((f) => ({
      id: String(f.id ?? f.properties.sid),
      name: f.properties.sname ?? String(f.id),
      ...pointFromGeoJson(f.geometry.coordinates),
      elevM: Number.isFinite(f.properties.elevation) ? f.properties.elevation : null,
      network: f.properties.network,
    }));
}

function compactCurrents(json) {
  const out = {};
  for (const d of json.data ?? []) {
    out[d.station] = { utc_valid: d.utc_valid, raw: d.raw ?? null, tmpf: d.tmpf, dwpf: d.dwpf, relh: d.relh,
      alti: d.alti, mslp: d.mslp, name: d.name };
  }
  return out;
}

/** Build a normalised Observation from a station-list entry and its currents row. */
function normalise(st, cur, distanceM) {
  const notes = [];
  const time = new Date(cur.utc_valid);
  const m = parseMetar(cur.raw, time);

  let t = m.temperatureC, td = m.dewpointC;
  if (t == null && num(cur.tmpf) != null) { t = fahrenheitToCelsius(cur.tmpf); notes.push({ code: 'temperatureFromIemTmpf' }); }
  if (td == null && num(cur.dwpf) != null) { td = fahrenheitToCelsius(cur.dwpf); }
  if (m.tempPrecision === '0.1') notes.push({ code: 'temperatureTGroup' });

  let pressure = null;
  if (m.qnhPa != null) {
    // Whole-hPa Q groups are rounded down (ICAO): add the mean rounding error, keep the reported value for display.
    const adj = qnhRoundingCorrection(m.qnhGroup);
    pressure = adj ? { kind: 'qnh', pa: m.qnhPa + adj, reportedPa: m.qnhPa, adjustPa: adj } : { kind: 'qnh', pa: m.qnhPa };
  }
  else if (num(cur.alti) != null) { pressure = { kind: 'qnh', pa: inhgToPa(cur.alti) }; notes.push({ code: 'qnhFromIemAlti' }); }
  else if (m.slpPa != null) pressure = { kind: 'mslp', pa: m.slpPa };
  else if (num(cur.mslp) != null) pressure = { kind: 'mslp', pa: cur.mslp };
  if (m.qnhGroup === 'Q') notes.push({ code: 'qnhQGroupRounded', adjustPa: qnhRoundingCorrection('Q') });

  // RH: METAR carries none; IEM's relh is derived from T/Td as well. Use our (possibly 0.1 °C) T/Td.
  let rh = null;
  if (t != null && td != null) { rh = dewpointToRH(t, td); notes.push({ code: 'humidityDerived' }); }
  else if (num(cur.relh) != null) { rh = percentToFraction(cur.relh); notes.push({ code: 'humidityFromIem' }); }

  return {
    sourceId: 'iem', reportType: 'METAR',
    attribution: iem.attribution,
    station: { id: st.id, name: st.name, latRad: st.latRad, lonRad: st.lonRad, elevM: st.elevM, barometerM: st.barometerM ?? null,
      distanceM, network: st.network, ids: st.ids ?? icaoIds(st.id) },
    time, temperatureC: t, dewpointC: td, humidity: rh, pressure,
    precision: { tC: m.tempPrecision === '0.1' ? 0.1 : 1 },
    raw: cur.raw ?? null, notes,
  };
}

const icaoIds = (id) => ({ icao: /^[A-Z][A-Z0-9]{3}$/.test(id) ? id : null });

/**
 * Step 1: stations within radiusM from the cached network lists. Lists are loaded nearest network box first, until
 * the nearest SETTLE_K stations are certain; each loaded list refreshes the network's learned extent.
 * @returns {Promise<object[]>} [{sourceId, id, name, latRad, lonRad, elevM, network, ids:{icao}, distanceM}], nearest first
 */
async function stations({ latRad, lonRad, radiusM }, ctx) {
  const now = ctx.now ? ctx.now() : new Date();
  const get = (url) => ctx.getJSON(url, { signal: ctx.signal });
  ctx.onProgress?.({ code: 'loadingNetworkIndex' });
  const { value: networks } = await cached(ctx, 'iem:networks', TTL.networks,
    async () => compactNetworks(await get(`${BASE}/geojson/networks.geojson`)));
  const extents = await loadExtents(ctx, +now);
  const cands = candidateNetworks(networks, latRad, lonRad, radiusM, extents);
  const found = [];
  for (const net of cands) {
    const settled = found.length >= SETTLE_K ? found[SETTLE_K - 1].distanceM : Infinity;
    if (net.minM > Math.min(radiusM, settled)) break;
    ctx.onProgress?.({ code: 'loadingStationList', id: net.id });
    const { value: list } = await cached(ctx, `iem:stations:${net.id}`, TTL.stations,
      async () => compactStations(await get(`${BASE}/geojson/network/${encodeURIComponent(net.id)}.geojson`)));
    await learnExtent(ctx, extents, net.id, list, +now);
    for (const s of list) {
      const d = haversineM(latRad, lonRad, s.latRad, s.lonRad);
      if (d <= radiusM) found.push({ ...s, network: s.network ?? net.id, distanceM: d });
    }
    found.sort((a, b) => a.distanceM - b.distanceM);
  }
  return found.map((s) => ({ sourceId: 'iem', id: s.id, name: s.name, latRad: s.latRad, lonRad: s.lonRad, elevM: s.elevM, network: s.network,
    ids: icaoIds(s.id), distanceM: s.distanceM }));
}

/**
 * Step 2: current reports for the given stations, in the caller's order. IEM serves currents per network, so the
 * networks of the first stations are loaded (at most MAX_CURRENTS_NETWORKS). Returns every report found, any age.
 */
async function current(metas, ctx) {
  const get = (url) => ctx.getJSON(url, { signal: ctx.signal });
  const currents = new Map();
  const out = [];
  for (const s of metas) {
    if (!currents.has(s.network)) {
      if (currents.size >= MAX_CURRENTS_NETWORKS) continue;
      ctx.onProgress?.({ code: 'loadingCurrents', id: s.network });
      const r = await cached(ctx, `iem:currents:${s.network}`, TTL.currents,
        async () => compactCurrents(await get(`${BASE}/api/1/currents.json?network=${encodeURIComponent(s.network)}`)));
      currents.set(s.network, r);
    }
    const c = currents.get(s.network);
    const row = c.value[s.id];
    if (!row?.utc_valid) continue;
    const obs = normalise(s, row, s.distanceM);
    obs.fetchedAt = c.fetchedAt;
    obs.fromCache = c.fromCache;
    out.push(obs);
  }
  return out;
}

/**
 * Observation times of one station's last three hours (to learn its reporting interval): one small request to the
 * archive service, which is throttled per IP — the caller asks at most once per station and caches the answer.
 * @returns {Promise<Date[]>} ascending
 */
async function recentTimes(stationId, ctx) {
  const url = `${BASE}/cgi-bin/request/asos.py?station=${encodeURIComponent(stationId)}&data=metar&hours=3&format=onlycomma&tz=UTC`;
  const text = await ctx.getText(url, { signal: ctx.signal });
  const times = [];
  for (const line of String(text).split(/\r?\n/).slice(1)) {
    const valid = line.split(',')[1];
    const t = valid ? Date.parse(`${valid.trim().replace(' ', 'T')}Z`) : NaN;
    if (Number.isFinite(t)) times.push(new Date(t));
  }
  return times.sort((a, b) => a - b);
}
