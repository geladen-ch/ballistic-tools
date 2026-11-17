// IEM SYNOP adapter: WMO BUFR surface reports decoded by IEM, network WMO_BUFR_SRF.
// Global, mostly hourly, with station pressure and 0.1 °C temperatures. Coverage ≈ 45 countries (Europe, Canada,
// Brazil, Australia, NZ, Turkey, Chile…); not the US. Same provider, terms and etiquette as the METAR adapter.
// Two-step interface: stations(area) from the cached list, current(stations) for the selected ones.
import { haversineM, pointsBbox, pointFromGeoJson } from '../geo.js';
import { dewpointToRH } from '../atmosphere.js';
import { choosePressure, impliedHeight, PRESSURE_QC } from '../qc.js';
import { wmoFromWigos } from '../select.js';
import { fahrenheitToCelsius, hpaToPa, percentToFraction, dayToS, minToS } from '../../quantity.js';
import { cached, nearestVia, num, round2 } from './common.js';

const BASE = 'https://mesonet.agron.iastate.edu';
export const SYNOP_NETWORK = 'WMO_BUFR_SRF';
// Station list: 90 days (4.5 MB; the station set changes slowly). Currents: 10 min, as for METAR.
const TTL = { stations: dayToS(90), currents: minToS(10) };
/** Sites (distinct positions) asked for per refresh; the core ranks them by effective distance and keeps k = 8. */
export const MAX_SYNOP_SITES = 20;
/** The station list is ~4.5 MB and served uncompressed: allow a slow mobile connection to finish. */
const LIST_TIMEOUT_MS = 180000;
const ATTRIBUTION = 'Data: Iowa Environmental Mesonet, Iowa State University';
const LIST_KEY = 'iem-synop:stations';

export { PRESSURE_QC, impliedHeight };

/** @type {import('./types.js').SourceAdapter & {internals:object}} */
export const iemSynop = {
  id: 'iem-synop',
  name: 'IEM (global SYNOP)',
  attribution: ATTRIBUTION,
  credits: { text: 'SYNOP reports: Iowa Environmental Mesonet, Iowa State University (decoded WMO BUFR)', url: 'https://mesonet.agron.iastate.edu/' },
  homepage: 'https://mesonet.agron.iastate.edu/',
  probe: { url: `${BASE}/api/1/currents.json?station=LSZH` },
  coverage: { kind: 'global' },
  autoDefault: true,                       // validated on a year of hourly reports
  minRefreshS: minToS(10),
  nominalIntervalS: minToS(60),
  typicalDelayS: minToS(15),               // arrival at IEM: 6–21 min after the hour by country
  maxStationsPerRefresh: MAX_SYNOP_SITES,
  stations,
  current,
  extent,
  nearest: (point, opts, ctx) => nearestVia(iemSynop, point, opts, ctx),
  internals: { compactStations, compactCurrents, selectSites, normalise, collapseDuplicates, impliedHeight },
};

/** Station list → [{id, name, latRad, lonRad, elevM}] (online stations with a position). Cached 90 days. */
function compactStations(geojson) {
  return geojson.features
    .filter((f) => f.properties?.online !== false && f.geometry?.type === 'Point')
    .map((f) => ({
      id: String(f.id ?? f.properties.sid),
      name: f.properties.sname ?? String(f.id),
      ...pointFromGeoJson(f.geometry.coordinates),
      elevM: Number.isFinite(f.properties.elevation) ? f.properties.elevation : null,
    }));
}

function compactCurrents(json) {
  const out = {};
  for (const d of json.data ?? []) {
    out[d.station] = { utc_valid: d.utc_valid, tmpf: d.tmpf, dwpf: d.dwpf, relh: d.relh, pres: d.pres, mslp: d.mslp, raw: d.raw ?? null };
  }
  return out;
}

// Two ids at one site have the same position and elevation; the key rounds the position to about 60 m.
const POSITION_KEY_DIGITS = 5;
const siteKey = (s) => `${s.latRad.toFixed(POSITION_KEY_DIGITS)},${s.lonRad.toFixed(POSITION_KEY_DIGITS)},${s.elevM ?? ''}`;

/**
 * Stations within radiusM, nearest first, covering at most maxSites distinct sites. IEM lists some stations twice
 * (national and WMO WIGOS ids, same position and elevation); both ids of a site are kept, because only the current
 * data tell which one carries the report.
 */
function selectSites(list, latRad, lonRad, radiusM, maxSites = MAX_SYNOP_SITES) {
  const near = [];
  for (const s of list) {
    const d = haversineM(latRad, lonRad, s.latRad, s.lonRad);
    if (d <= radiusM) near.push({ ...s, distanceM: d });
  }
  near.sort((a, b) => a.distanceM - b.distanceM);
  return firstSites(near, maxSites);
}
function firstSites(sorted, maxSites) {
  const sites = new Set(); const out = [];
  for (const s of sorted) {
    const k = siteKey(s);
    if (!sites.has(k)) { if (sites.size >= maxSites) break; sites.add(k); }
    out.push(s);
  }
  return out;
}

async function loadList(ctx) {
  if ((await ctx.cache.get(LIST_KEY)) === undefined) ctx.onProgress?.({ code: 'loadingSynopList' });
  const { value } = await cached(ctx, LIST_KEY, TTL.stations, async () =>
    compactStations(await ctx.getJSON(`${BASE}/geojson/network/${SYNOP_NETWORK}.geojson`, { signal: ctx.signal, timeoutMs: LIST_TIMEOUT_MS, parallel: true })));
  return value;
}

/** Learned extent [W, S, E, N] (radians) of the cached list, or null when the list is not cached (no request). */
async function extent(ctx) {
  const list = await ctx.cache.get(LIST_KEY);
  return list ? pointsBbox(list) : null;
}

/**
 * Step 1: station metadata within the search circle (from the 90-day list). Each entry carries all WIGOS ids listed
 * at its site (aliases) and the WMO index, for matching across feeds.
 * @returns {Promise<object[]>} [{sourceId, id, name, latRad, lonRad, elevM, ids:{wigos, wmo}}]
 */
async function stations({ latRad, lonRad, radiusM }, ctx) {
  const list = await loadList(ctx);
  const near = list.filter((s) => haversineM(latRad, lonRad, s.latRad, s.lonRad) <= radiusM);
  const bySite = new Map();
  for (const s of near) { const k = siteKey(s); if (!bySite.has(k)) bySite.set(k, []); bySite.get(k).push(s.id); }
  return near.map((s) => {
    const wigos = bySite.get(siteKey(s));
    return { sourceId: 'iem-synop', id: s.id, name: s.name, latRad: s.latRad, lonRad: s.lonRad, elevM: s.elevM, network: SYNOP_NETWORK,
      ids: { wigos, wmo: wigos.map(wmoFromWigos).find(Boolean) ?? null } };
  });
}

/**
 * Step 2: current reports for the given stations (in the caller's order; at most MAX_SYNOP_SITES sites, one request).
 * Returns every report found, any age; one per site. The caller filters by age.
 */
async function current(metas, ctx) {
  const pick = firstSites(metas, MAX_SYNOP_SITES);
  if (!pick.length) return [];
  const ids = [...new Set(pick.map((s) => s.id))];
  ctx.onProgress?.({ code: 'loadingSynopCurrents' });
  const cur = await cached(ctx, `iem-synop:currents:${ids.join(',')}`, TTL.currents, async () =>
    compactCurrents(await ctx.getJSON(`${BASE}/api/1/currents.json?${ids.map((id) => `station=${encodeURIComponent(id)}`).join('&')}`,
      { signal: ctx.signal })));
  const out = [];
  for (const s of pick) {
    const row = cur.value[s.id];
    if (!row?.utc_valid) continue;
    const obs = normalise(s, row, s.distanceM);
    obs.fetchedAt = cur.fetchedAt; obs.fromCache = cur.fromCache;
    out.push(obs);
  }
  return collapseDuplicates(out);
}

/** Build a normalised Observation from a station entry (possibly with overridden heights) and its currents row. */
function normalise(st, cur, distanceM) {
  const notes = [{ code: 'synopDecoded' }];
  const t = num(cur.tmpf) != null ? round2(fahrenheitToCelsius(cur.tmpf)) : null;
  const td = num(cur.dwpf) != null ? round2(fahrenheitToCelsius(cur.dwpf)) : null;
  const baro = Number.isFinite(st.barometerM) ? st.barometerM : null;
  // Pressure checks (qc.js): ranges, then the implied barometer height below 800 m. IEM gives pressures in hPa.
  const p = choosePressure({
    stationPa: num(cur.pres) != null ? hpaToPa(cur.pres) : null, seaPa: num(cur.mslp) != null ? hpaToPa(cur.mslp) : null,
    seaKind: 'mslp', tempC: t, heightM: baro ?? st.elevM,
  });
  notes.push(...p.notes);
  if (p.pressure?.kind === 'station') notes.push(baro != null ? { code: 'stationPressureBaro', barometerM: Math.round(baro) } : { code: 'stationPressureAssumedBaro' });
  if (st.elevFrom) notes.push({ code: 'heightFromList', sourceId: st.elevFrom.sourceId, iemElevM: st.elevFrom.elevM });
  let rh = null;
  if (t != null && td != null) { rh = dewpointToRH(t, td); notes.push({ code: 'humidityDerived' }); }
  else if (num(cur.relh) != null) { rh = percentToFraction(cur.relh); notes.push({ code: 'humidityFromIem' }); }
  return {
    sourceId: 'iem-synop', reportType: 'SYNOP', attribution: ATTRIBUTION,
    station: { id: st.id, name: st.name, latRad: st.latRad, lonRad: st.lonRad, elevM: st.elevM, barometerM: baro, distanceM, network: SYNOP_NETWORK, ids: st.ids },
    time: new Date(cur.utc_valid), temperatureC: t, dewpointC: td, humidity: rh, pressure: p.pressure,
    precision: { tC: 0.1 },
    raw: null, notes, qc: p.qc,
  };
}

/** One observation per site: prefer the record with temperature and pressure, then the newer one. */
function collapseDuplicates(observations) {
  const score = (o) => (o.temperatureC != null) + (o.pressure?.kind === 'station') * 2 + (o.pressure != null);
  const best = new Map();
  for (const o of observations) {
    const k = siteKey({ latRad: o.station.latRad, lonRad: o.station.lonRad, elevM: o.station.elevM });
    const b = best.get(k);
    if (!b || score(o) > score(b) || (score(o) === score(b) && o.time > b.time)) best.set(k, o);
  }
  return [...best.values()].sort((a, b) => a.station.distanceM - b.station.distanceM);
}
