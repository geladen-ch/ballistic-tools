// IEM US non-airport networks: road weather `{ST}_RWIS` (state DOTs) and HADS platforms `{ST}_DCP` (GOES data
// collection platforms: RAWS fire-weather and SNOTEL stations, some river gauges). Temperature and humidity only:
// these networks carry no usable pressure. Same provider, terms and etiquette as the METAR adapter (CORS "*", no key).
// Two-step interface:
//   stations(): network boxes from IEM's index → station lists of the nearby networks, cached 90 days. The DCP lists
//     do not say which platforms measure temperature (most are river gauges), so each list is built once from the
//     station list (positions, heights) and the network's current data (which stations report temperature now);
//     ~0.1–2.5 MB + 0.05–4 MB per network, once per 90 days;
//   current(): one per-station request for the selected stations (a few KB), cached 10 min.
import { haversineM, polygonBbox, pointFromGeoJson, outlineFromDegrees } from '../geo.js';
import { dewpointToRH } from '../atmosphere.js';
import { fahrenheitToCelsius, percentToFraction, dayToS, minToS, hToS, sToMs } from '../../quantity.js';
import { cached, nearestVia, num, round2 } from './common.js';
import { iem } from './iem.js';

const BASE = 'https://mesonet.agron.iastate.edu';
const TTL = { networks: dayToS(30), stations: dayToS(90), currents: minToS(10) };
/** Sites asked for per refresh; the core ranks them by effective distance and keeps k = 8. */
export const MAX_US_SITES = 30;
/** Stations whose newest temperature is older than this when the list is built are left out (dead or seasonal). */
const LIST_MAX_AGE_MS = sToMs(hToS(48));
const LIST_TIMEOUT_MS = 180000;                          // large uncompressed lists (CA_DCP) on a slow connection
/** US state networks only: `CA_DCP` is California; Canadian provinces are `CA_AB_DCP` etc. */
export const US_NET = /^[A-Z]{2}_(RWIS|DCP)$/;
const ATTRIBUTION = 'Data: Iowa Environmental Mesonet, Iowa State University';

// Coverage: coarse outlines of the contiguous US, Alaska and Hawaii (written as [lonDeg, latDeg]); the network boxes
// do the real work.
export const CONUS_OUTLINE = outlineFromDegrees([[-124.9, 48.6], [-123.3, 49.1], [-95.2, 49.1], [-94.8, 49.5], [-89.5, 48.1], [-84.5, 46.6],
  [-82.4, 45.4], [-82.5, 42.5], [-79.0, 43.4], [-76.4, 44.2], [-74.7, 45.1], [-71.5, 45.1], [-69.2, 47.5], [-67.7, 47.2],
  [-66.8, 44.8], [-69.8, 41.2], [-73.9, 40.3], [-75.4, 35.2], [-80.6, 31.9], [-79.9, 26.6], [-80.1, 25.0], [-81.8, 24.4],
  [-82.9, 27.5], [-84.3, 29.8], [-89.4, 28.9], [-94.0, 29.4], [-97.2, 25.8], [-99.5, 27.4], [-101.4, 29.8], [-103.2, 28.9],
  [-104.7, 29.9], [-106.5, 31.8], [-108.2, 31.3], [-111.1, 31.3], [-114.8, 32.5], [-117.2, 32.5], [-120.7, 34.4],
  [-124.5, 40.4], [-124.7, 42.8], [-124.9, 48.6]]);
export const ALASKA_OUTLINE = outlineFromDegrees([[-141.0, 60.3], [-141.0, 69.7], [-156.8, 71.4], [-166.5, 68.9], [-166.2, 61.5], [-170.0, 57.0],
  [-178.5, 51.5], [-163.0, 54.3], [-152.0, 57.0], [-137.0, 58.2], [-130.0, 54.7], [-133.0, 58.3], [-141.0, 60.3]]);
export const HAWAII_BOX = outlineFromDegrees([[-160.5, 18.8], [-154.6, 18.8], [-154.6, 22.4], [-160.5, 22.4], [-160.5, 18.8]]);

/** @type {import('./types.js').SourceAdapter & {internals:object}} */
export const iemUs = {
  id: 'iem-us',
  name: 'IEM (US road weather and RAWS/DCP)',
  attribution: ATTRIBUTION,
  credits: { text: 'US road-weather (state DOTs) and HADS platform reports (RAWS, SNOTEL, …): Iowa Environmental Mesonet, Iowa State University', url: 'https://mesonet.agron.iastate.edu/' },
  homepage: 'https://mesonet.agron.iastate.edu/',
  probe: { url: `${BASE}/api/1/currents.json?station=LSZH` },
  coverage: { kind: 'region', polygons: [CONUS_OUTLINE, ALASKA_OUTLINE, HAWAII_BOX] },
  autoDefault: true,                       // validated on four weeks of 2025: West −9.7 % at airports, −29.7 % elsewhere
  minRefreshS: minToS(10),
  nominalIntervalS: minToS(20),            // RWIS ~10–20 min; DCP mostly hourly
  typicalDelayS: minToS(25),               // arrival at IEM: median 26 min (RWIS), 24 min (DCP)
  maxStationsPerRefresh: MAX_US_SITES,
  stations,
  current,
  nearest: (point, opts, ctx) => nearestVia(iemUs, point, opts, ctx),
  internals: { compactNetworks, buildList, compactCurrents, normalise },
};

function compactNetworks(geojson) {
  return geojson.features
    .filter((f) => US_NET.test(String(f.id)) && f.geometry?.type === 'Polygon')
    .map((f) => ({ id: String(f.id), name: f.properties?.name ?? String(f.id), bbox: polygonBbox(f.geometry) }));
}

/**
 * Station list of one network: online stations with a position and height that reported temperature within
 * LIST_MAX_AGE_MS before `now` (from the network's current data).
 * @returns {{id, name, latRad, lonRad, elevM, network}[]}
 */
function buildList(geojson, currentsJson, net, now) {
  const withT = new Set();
  for (const d of currentsJson.data ?? []) {
    if (typeof d.tmpf === 'number' && d.utc_valid && (now - new Date(d.utc_valid)) <= LIST_MAX_AGE_MS) withT.add(d.station);
  }
  return geojson.features
    .filter((f) => f.properties?.online !== false && f.geometry?.type === 'Point' && Number.isFinite(f.properties?.elevation))
    .map((f) => ({ id: String(f.properties.sid ?? f.id), name: f.properties.sname ?? String(f.id), ...pointFromGeoJson(f.geometry.coordinates),
      elevM: f.properties.elevation, network: net }))
    .filter((s) => withT.has(s.id));
}

function compactCurrents(json) {
  const out = {};
  for (const d of json.data ?? []) out[`${d.network}:${d.station}`] = { utc_valid: d.utc_valid, tmpf: d.tmpf, dwpf: d.dwpf, relh: d.relh };
  return out;
}

/**
 * Step 1: stations within radiusM that report temperature, from the lists of the networks whose box (widened by
 * radiusM) contains the point, nearest box first, until the nearest MAX_US_SITES are certain.
 */
async function stations({ latRad, lonRad, radiusM }, ctx) {
  const now = ctx.now ? ctx.now() : new Date();
  const { value: networks } = await cached(ctx, 'iem-us:networks', TTL.networks,
    async () => compactNetworks(await ctx.getJSON(`${BASE}/geojson/networks.geojson`, { signal: ctx.signal })));
  const cands = iem.internals.candidateNetworks(networks, latRad, lonRad, radiusM);
  const found = [];
  for (const net of cands) {
    const settled = found.length >= MAX_US_SITES ? found[MAX_US_SITES - 1].distanceM : Infinity;
    if (net.minM > Math.min(radiusM, settled)) break;
    const key = `iem-us:stations:${net.id}`;
    if ((await ctx.cache.get(key)) === undefined) ctx.onProgress?.({ code: 'loadingUsStationList', id: net.id });
    const { value: list } = await cached(ctx, key, TTL.stations, async () => {
      const o = { signal: ctx.signal, timeoutMs: LIST_TIMEOUT_MS };
      const geo = await ctx.getJSON(`${BASE}/geojson/network/${encodeURIComponent(net.id)}.geojson`, o);
      const cur = await ctx.getJSON(`${BASE}/api/1/currents.json?network=${encodeURIComponent(net.id)}`, o);
      return buildList(geo, cur, net.id, now);
    });
    for (const s of list) {
      const d = haversineM(latRad, lonRad, s.latRad, s.lonRad);
      if (d <= radiusM) found.push({ ...s, distanceM: d });
    }
    found.sort((a, b) => a.distanceM - b.distanceM);
  }
  return found.map((s) => ({ sourceId: 'iem-us', id: s.id, name: s.name, latRad: s.latRad, lonRad: s.lonRad, elevM: s.elevM, network: s.network, ids: {}, distanceM: s.distanceM }));
}

/** Step 2: current reports of the given stations (at most MAX_US_SITES, one request). Any age; the core filters. */
async function current(metas, ctx) {
  const pick = metas.slice(0, MAX_US_SITES);
  if (!pick.length) return [];
  const ids = [...new Set(pick.map((s) => s.id))].sort();
  ctx.onProgress?.({ code: 'loadingUsCurrents' });
  const cur = await cached(ctx, `iem-us:currents:${ids.join(',')}`, TTL.currents, async () =>
    compactCurrents(await ctx.getJSON(`${BASE}/api/1/currents.json?${ids.map((id) => `station=${encodeURIComponent(id)}`).join('&')}`,
      { signal: ctx.signal })));
  const out = [];
  for (const s of pick) {
    const row = cur.value[`${s.network}:${s.id}`];
    if (!row?.utc_valid || typeof row.tmpf !== 'number') continue;
    const obs = normalise(s, row, s.distanceM);
    obs.fetchedAt = cur.fetchedAt; obs.fromCache = cur.fromCache;
    out.push(obs);
  }
  return out;
}

// A whole-°F reading steps in 5/9 K.
const WHOLE_F_STEP_C = fahrenheitToCelsius(33) - fahrenheitToCelsius(32);

/** Normalised Observation (no pressure). Most DCP temperatures are whole °F (precision 0.56 °C). */
function normalise(st, cur, distanceM) {
  const dcp = /_DCP$/.test(st.network);
  const wholeF = Number.isInteger(cur.tmpf);
  const notes = [{ code: dcp ? 'hadsPlatform' : 'roadWeatherStation' }, { code: 'noPressureTHOnly' }];
  if (wholeF) notes.push({ code: 'temperatureWholeF' });
  const t = num(cur.tmpf) != null ? round2(fahrenheitToCelsius(cur.tmpf)) : null;
  const td = num(cur.dwpf) != null ? round2(fahrenheitToCelsius(cur.dwpf)) : null;
  let rh = null;
  if (num(cur.relh) != null && dcp) { rh = percentToFraction(cur.relh); notes.push({ code: 'humidityMeasured' }); }
  else if (t != null && td != null) { rh = dewpointToRH(t, td); notes.push({ code: 'humidityDerived' }); }
  else if (num(cur.relh) != null) { rh = percentToFraction(cur.relh); notes.push({ code: 'humidityFromIem' }); }
  return {
    sourceId: 'iem-us', reportType: dcp ? 'DCP' : 'RWIS', attribution: ATTRIBUTION,
    station: { id: st.id, name: st.name, latRad: st.latRad, lonRad: st.lonRad, elevM: st.elevM, barometerM: null, distanceM, network: st.network, ids: st.ids ?? {} },
    time: new Date(cur.utc_valid), temperatureC: t, dewpointC: td, humidity: rh, pressure: null,
    cloudFraction: null,
    precision: { tC: wholeF ? round2(WHOLE_F_STEP_C) : 0.1 },
    raw: null, notes,
  };
}
