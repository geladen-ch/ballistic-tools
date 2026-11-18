// ECCC adapter: Canadian surface observations (SWOB) from Environment and Climate Change Canada and its partners.
// Documented OGC API (MSC GeoMet, https://api.weather.gc.ca; CORS "*", no key).
// Licence: ECCC Data Server End-use Licence (attribution "Data Source: Environment and Climate Change Canada", plus the
// third-party contributor where possible); by decision (2026-11-15) the same terms are assumed for partner data.
// - stations: `swob-stations` (ECCC, NAV CANADA, DND; ~940) + `swob-partner-stations` (provincial and other networks;
//   ~2030), position and height (third coordinate), WMO / ICAO ids, partner attribution; cached 90 days;
// - current values: `swob-realtime/items?bbox=…&datetime=<now − 90 min>/..&properties=…&skipGeometry=true&sortby=
//   -date_tm-value`: one request for the box of the selected stations, only the needed fields. Most stations report
//   every minute (online ~1 min later), partners hourly or every 15 min. Station pressure (`stn_pres`, hPa) at the
//   station elevation; `mslp` (hourly records only) is used for the implied-height check. Partner stations give
//   temperature and humidity only: their heights cannot be checked (no sea-level pressure), and their pressure made the
//   result worse in the validation.
import { pointsBbox, outlineFromDegrees } from '../geo.js';
import { choosePressure } from '../qc.js';
import { degToRad, hpaToPa, percentToFraction, dayToS, minToS, sToMs } from '../../quantity.js';
import { cached, nearestVia, queryBoxDegrees } from './common.js';

const API = 'https://api.weather.gc.ca/collections';
const TTL = { stations: dayToS(90), current: minToS(10) };
const LIST_KEY = 'eccc:stations';
const WINDOW_MS = sToMs(minToS(90));
const SLOT_MS = sToMs(minToS(1));
const FIELDS = ['msc_id-value', 'date_tm-value', 'air_temp', 'air_temp-qa', 'rel_hum', 'rel_hum-qa', 'stn_pres', 'stn_pres-qa', 'mslp'];
const ATTRIBUTION = 'Data Source: Environment and Climate Change Canada';
export const LICENCE_URL = 'https://eccc-msc.github.io/open-data/licence/readme_en/';

/** Simplified outline of Canada, coastal waters and border margins included ([lonDeg, latDeg]); activation geometry only. */
export const CA_OUTLINE = outlineFromDegrees([
  [-123.15, 48.25], [-125.0, 48.3], [-128.6, 50.4], [-131.6, 51.7], [-133.6, 54.2], [-130.7, 54.6], [-130.0, 55.9], [-132.0, 57.0],
  [-135.5, 59.8], [-137.6, 59.2], [-139.1, 60.4], [-141.1, 60.3], [-141.1, 69.8], [-136.5, 69.6], [-129.5, 70.2], [-125.6, 71.9],
  [-124.6, 74.6], [-120.0, 76.6], [-110.0, 78.9], [-100.0, 80.2], [-90.0, 81.6], [-75.0, 83.3], [-62.0, 82.7], [-60.0, 82.1],
  [-70.0, 79.4], [-74.0, 78.3], [-77.5, 76.5], [-79.0, 74.2], [-68.0, 70.6], [-61.4, 66.8], [-64.4, 63.0], [-64.4, 60.4],
  [-61.4, 57.4], [-57.8, 54.4], [-55.4, 52.0], [-52.4, 47.6], [-52.9, 46.55], [-53.4, 46.5], [-56.0, 46.5], [-59.5, 47.4],
  [-59.7, 45.9], [-61.0, 44.9], [-65.9, 43.3], [-66.9, 44.6], [-67.7, 45.6], [-67.7, 47.1], [-69.2, 47.5], [-70.0, 46.7],
  [-71.5, 45.0], [-74.7, 44.9], [-76.3, 44.1], [-79.2, 43.3], [-78.85, 42.85], [-80.2, 42.45], [-82.5, 41.6], [-83.2, 42.1],
  [-82.4, 43.0], [-82.2, 45.4], [-84.4, 46.4], [-88.4, 48.2], [-89.6, 47.9], [-95.2, 48.9], [-122.95, 48.85], [-123.15, 48.25],
]);
export const SABLE_ISLAND_BOX = outlineFromDegrees([[-60.3, 43.85], [-59.6, 43.85], [-59.6, 44.05], [-60.3, 44.05], [-60.3, 43.85]]);

/** @type {import('./types.js').SourceAdapter & {internals:object}} */
export const eccc = {
  id: 'eccc',
  name: 'ECCC and partners (Canada)',
  attribution: ATTRIBUTION,
  credits: {
    text: 'Canadian stations: Data Source: Environment and Climate Change Canada, NAV CANADA and partner networks (provincial and other agencies, named in each station report). Contains information licenced under the Data Server End-use Licence of Environment and Climate Change Canada. Values are converted to your altitude and combined with other stations',
    url: 'https://eccc-msc.github.io/open-data/msc-data/obs_station/readme_obs_insitu_swobdatamart_en/',
    links: [{ text: 'licence', url: LICENCE_URL }],
  },
  homepage: 'https://api.weather.gc.ca/',
  probe: { url: `${API}/swob-stations/items?f=json&limit=1` },
  coverage: { kind: 'region', polygons: [CA_OUTLINE, SABLE_ISLAND_BOX] },
  autoDefault: true,                       // validated on 30 days of 2026 data
  authoritativeMetadata: true,             // ECCC station heights
  minRefreshS: minToS(10),
  nominalIntervalS: minToS(1),
  typicalDelayS: minToS(2),                // processed ~1 min after the observation
  stations,
  current,
  extent,
  nearest: (point, opts, ctx) => nearestVia(eccc, point, opts, ctx),
  internals: { compactStations, compactRecords, normalise, idsFor },
};

/**
 * Identifiers for matching other feeds: WMO index (`71NNN`), and IEM's Canadian SYNOP id `0-124-0-NNN` (NNN = last
 * three digits of the WMO index; 388 of 390 IEM stations within 2 km of a SWOB station); ICAO where given.
 */
function idsFor(wmo, icao) {
  const w = /^\d{5}$/.test(String(wmo ?? '')) ? String(wmo) : null;
  const wigos = w ? [`0-20000-0-${w}`, `0-124-0-${Number(w.slice(2))}`, `0-124-0-${w.slice(2)}`] : [];
  return { wigos: [...new Set(wigos)], wmo: w, icao: /^[A-Z]{4}$/.test(icao ?? '') ? icao : null };
}

/** Station collections → [{id, name, latRad, lonRad, elevM, wmo, icao, provider, partner, notice}]. */
function compactStations(msc, partners) {
  const out = new Map();
  const add = (f, partner) => {
    const p = f.properties ?? {}, [lon, lat, z] = f.geometry?.coordinates ?? [];
    if (!p.msc_id || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    out.set(String(p.msc_id), {
      id: String(p.msc_id), name: p.name ?? p.name_en ?? String(p.msc_id), latRad: degToRad(lat), lonRad: degToRad(lon),
      elevM: Number.isFinite(z) ? z : null,
      wmo: p.wmo_id ?? null, icao: p.icao_id ?? (p.iata_id && String(p.iata_id).length === 3 ? `C${p.iata_id}` : null),
      provider: partner ? p.data_provider_en ?? null : p.data_provider ?? null, partner,
      notice: partner ? p.data_attribution_notice_en ?? null : null,
    });
  };
  for (const f of msc.features ?? []) add(f, false);
  for (const f of partners.features ?? []) add(f, true);
  return [...out.values()];
}

async function loadList(ctx) {
  const { value } = await cached(ctx, LIST_KEY, TTL.stations, async () => {
    ctx.onProgress?.({ code: 'loadingStationListOf', source: 'eccc' });
    const msc = await ctx.getJSON(`${API}/swob-stations/items?f=json&limit=10000`, { signal: ctx.signal });
    const partners = await ctx.getJSON(`${API}/swob-partner-stations/items?f=json&limit=10000`, { signal: ctx.signal });
    return compactStations(msc, partners);
  });
  return value;
}

async function extent(ctx) {
  const list = await ctx.cache.get(LIST_KEY);
  return list ? pointsBbox(list) : null;
}

/** Step 1: all SWOB stations (ECCC, NAV CANADA, DND, partners); the core keeps those within the radius. */
async function stations(_area, ctx) {
  return (await loadList(ctx)).map((s) => ({ sourceId: 'eccc', id: s.id, name: s.name, latRad: s.latRad, lonRad: s.lonRad, elevM: s.elevM,
    barometerM: null, network: s.provider ?? 'ECCC', ids: idsFor(s.wmo, s.icao), notice: s.notice, partner: !!s.partner }));
}

const ok = (v, qa) => Number.isFinite(v) && (qa == null || qa === 100);       // SWOB QA: 100 = passed

/**
 * swob-realtime features → {msc_id: {time, T, RH (fraction), P (Pa), check}}: the newest record with temperature (QA
 * passed) gives T, RH and, if present, station pressure; `check` = the newest record with station pressure, sea-level
 * pressure and temperature (hourly records), for the implied-height check.
 */
function compactRecords(features) {
  const by = {};
  for (const f of features) {
    const p = f.properties ?? {}, id = p['msc_id-value'], t = p['date_tm-value'];
    if (!id || !t) continue;
    (by[id] ??= []).push({ t, T: ok(p.air_temp, p['air_temp-qa']) ? p.air_temp : null,
      RH: ok(p.rel_hum, p['rel_hum-qa']) ? percentToFraction(p.rel_hum) : null,
      P: ok(p.stn_pres, p['stn_pres-qa']) ? hpaToPa(p.stn_pres) : null, SLP: Number.isFinite(p.mslp) ? hpaToPa(p.mslp) : null });
  }
  const out = {};
  for (const [id, recs] of Object.entries(by)) {
    recs.sort((a, b) => (a.t < b.t ? 1 : -1));                              // newest first
    const r = recs.find((x) => x.T != null) ?? recs.find((x) => x.P != null);
    if (!r) continue;
    const c = recs.find((x) => x.T != null && x.P != null && x.SLP != null);
    out[id] = { time: new Date(r.t).toISOString(), T: r.T, RH: r.RH, P: r.P, check: c ? { T: c.T, P: c.P, SLP: c.SLP } : null };
  }
  return out;
}

/** Step 2: latest values of the selected stations, one request for their box (cached 10 min). */
async function current(metas, ctx) {
  if (!metas.length) return [];
  const now = ctx.now ? ctx.now() : new Date();
  const ids = [...new Set(metas.map((m) => m.id))].sort();
  const from = new Date(Math.floor((+now - WINDOW_MS) / SLOT_MS) * SLOT_MS).toISOString().slice(0, 19) + 'Z';
  ctx.onProgress?.({ code: 'loadingCurrentsOf', source: 'eccc' });
  const r = await cached(ctx, `eccc:now:${ids.join(',')}`, TTL.current, async () => {
    const url = `${API}/swob-realtime/items?f=json&bbox=${queryBoxDegrees(metas).join(',')}&datetime=${from}/..&properties=${FIELDS.join(',')}`
      + '&skipGeometry=true&sortby=-date_tm-value&limit=10000';
    const all = compactRecords((await ctx.getJSON(url, { signal: ctx.signal })).features ?? []);
    return Object.fromEntries(ids.filter((id) => all[id]).map((id) => [id, all[id]]));
  });
  const out = [];
  for (const m of metas) {
    const row = r.value[m.id];
    if (!row) continue;
    const o = normalise(m, row, m.distanceM);
    o.fetchedAt = r.fetchedAt; o.fromCache = r.fromCache;
    out.push(o);
  }
  return out;
}

/** One station's latest values → Observation. Station pressure at the station elevation (no barometer height given). */
function normalise(st, row, distanceM) {
  const credit = `${ATTRIBUTION}${st.notice ? `. ${st.notice}` : st.network && st.network !== 'MSC' ? ` and ${st.network}` : ''}`;
  const notes = [];
  const qc = [];
  let pressure = Number.isFinite(row.P) ? { kind: 'station', pa: row.P } : null;
  if (pressure && st.partner) {
    pressure = null;
    notes.push({ code: 'partnerPressureNotUsed' });
  } else if (row.check) {
    const c = choosePressure({ stationPa: row.check.P, seaPa: row.check.SLP, seaKind: 'mslp', tempC: row.check.T, heightM: st.elevM });
    if (c.qc.length) { pressure = null; qc.push(...c.qc); notes.push(...c.notes); }
  }
  if (pressure) notes.push({ code: 'stationPressureAtStation' });
  if (row.RH != null) notes.push({ code: 'humidityMeasured' });
  return {
    sourceId: 'eccc', reportType: 'SWOB', attribution: credit,
    station: { id: st.id, name: st.name, latRad: st.latRad, lonRad: st.lonRad, elevM: st.elevM, barometerM: null, distanceM, network: st.network, ids: st.ids },
    time: new Date(row.time), temperatureC: row.T, dewpointC: null, humidity: row.RH, pressure,
    cloudFraction: null,
    precision: { tC: 0.1 },
    raw: null, notes, qc,
  };
}
