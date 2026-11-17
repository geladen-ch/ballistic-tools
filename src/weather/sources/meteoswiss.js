// MeteoSwiss adapter: SwissMetNet automatic stations, open government data.
// Documented OGD files on data.geo.admin.ch (CORS "*", no key, CC BY 4.0, "Source: MeteoSwiss"):
// - station metadata `ch.meteoschweiz.ogd-smn/ogd-smn_meta_stations.csv` (ISO-8859-1; WIGOS id, station height,
//   barometer height, WGS84 position): authoritative heights, also for the same stations in other feeds;
// - current values of all stations in one file `ch.meteoschweiz.messwerte-aktuell/VQHA80.csv` ("main parameters of
//   all stations, every 10 minutes, most recent values"; times in UTC; online about 9–10 min after the value time,
//   MeteoSwiss recommends querying from minute xx:x9).
import { pointsBbox, outlineFromDegrees } from '../geo.js';
import { choosePressure } from '../qc.js';
import { degToRad, hpaToPa, percentToFraction, dayToS, minToS } from '../../quantity.js';
import { cached, nearestVia } from './common.js';

const META_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/ogd-smn_meta_stations.csv';
const NOW_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv';
const TTL = { stations: dayToS(90), current: minToS(10) };
const LIST_KEY = 'meteoswiss:stations';
const ATTRIBUTION = 'Source: MeteoSwiss';

/** Simplified outline of Switzerland and Liechtenstein, ±5 km ([lonDeg, latDeg]): activation geometry, not station data. */
export const CH_LI_OUTLINE = outlineFromDegrees([
  [5.96, 46.14], [6.12, 46.30], [6.06, 46.42], [6.18, 46.62], [6.44, 46.77], [6.46, 46.91], [6.71, 47.04], [6.95, 47.26],
  [6.94, 47.42], [7.01, 47.50], [7.25, 47.43], [7.55, 47.58], [7.79, 47.56], [8.23, 47.61], [8.42, 47.57], [8.50, 47.65],
  [8.61, 47.81], [8.71, 47.75], [8.86, 47.66], [9.17, 47.66], [9.38, 47.55], [9.56, 47.50], [9.65, 47.45], [9.56, 47.32],
  [9.56, 47.22], [9.61, 47.15], [9.58, 47.05], [9.88, 47.02], [10.10, 46.85], [10.47, 46.98], [10.49, 46.86], [10.45, 46.55],
  [10.15, 46.40], [10.10, 46.23], [9.53, 46.30], [9.33, 46.50], [9.15, 46.27], [9.03, 46.04], [9.02, 45.82], [8.86, 45.99],
  [8.71, 46.10], [8.56, 46.17], [8.45, 46.46], [8.07, 46.25], [7.86, 45.92], [7.66, 45.98], [7.17, 45.87], [7.04, 45.92],
  [6.95, 46.05], [6.80, 46.39], [6.50, 46.45], [6.23, 46.30], [6.11, 46.15], [5.96, 46.14],
]);

/** @type {import('./types.js').SourceAdapter & {internals:object}} */
export const meteoswiss = {
  id: 'meteoswiss',
  name: 'MeteoSwiss (SwissMetNet)',
  attribution: ATTRIBUTION,
  credits: {
    text: 'Source: MeteoSwiss (Swiss stations; Federal Office of Meteorology and Climatology, open data, CC BY 4.0)',
    url: 'https://opendatadocs.meteoswiss.ch/general/terms-of-use',
  },
  homepage: 'https://www.meteoswiss.admin.ch/',
  probe: { url: NOW_URL },
  coverage: { kind: 'region', polygons: [CH_LI_OUTLINE] },
  autoDefault: true,                       // validated on 2025 data
  authoritativeMetadata: true,             // surveyed station and barometer heights
  minRefreshS: minToS(10),
  nominalIntervalS: minToS(10),
  typicalDelayS: minToS(10),
  stations,
  current,
  extent,
  nearest: (point, opts, ctx) => nearestVia(meteoswiss, point, opts, ctx),
  internals: { parseMeta, parseNow, normalise, idsFor },
};

/** Semicolon CSV → array of objects (no quoted fields in these files). */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const head = lines[0].split(';');
  return lines.slice(1).map((l) => Object.fromEntries(l.split(';').map((v, i) => [head[i], v])));
}
const num = (v) => (v == null || v === '' || v === '-' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Identifiers for matching other feeds: the WIGOS id, the WMO index, and the Swiss national WIGOS id that IEM uses for
 * the same station (`0-756-0-NNN` for WMO `06NNN`; verified for 152 of 153 Swiss stations in IEM's SYNOP list).
 */
function idsFor(wigos) {
  const m = /^0-20000-0-(\d{5})$/.exec(wigos ?? '');
  if (!m) return { wigos: wigos ? [wigos] : [], wmo: null };
  const wmo = m[1], aliases = [wigos];
  if (wmo.startsWith('06')) { aliases.push(`0-756-0-${wmo.slice(2)}`); aliases.push(`0-756-0-${Number(wmo.slice(2))}`); }
  return { wigos: [...new Set(aliases)], wmo };
}

/** Station metadata → compact list (cached 90 days). The file's coordinates are degrees. */
function parseMeta(text) {
  return parseCsv(text).map((r) => {
    const latDeg = num(r.station_coordinates_wgs84_lat), lonDeg = num(r.station_coordinates_wgs84_lon);
    return {
      id: r.station_abbr, name: r.station_name,
      latRad: latDeg == null ? NaN : degToRad(latDeg), lonRad: lonDeg == null ? NaN : degToRad(lonDeg),
      elevM: num(r.station_height_masl), barometerM: num(r.station_height_barometer_masl),
      wigos: r.station_wigos_id || null,
    };
  }).filter((s) => s.id && Number.isFinite(s.latRad) && Number.isFinite(s.lonRad));
}

/** VQHA80.csv → {ABBR: {time, T (°C), Td (°C), RH (fraction), qfe, qff, qnh (Pa)}} */
function parseNow(text) {
  const out = {};
  const pa = (v) => { const x = num(v); return x == null ? null : hpaToPa(x); };
  for (const r of parseCsv(text)) {
    const d = r.Date ?? '';
    if (!/^\d{12}$/.test(d)) continue;
    const time = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +d.slice(8, 10), +d.slice(10, 12)));
    const rh = num(r.ure200s0);
    out[r['Station/Location']] = { time: time.toISOString(), T: num(r.tre200s0), Td: num(r.tde200s0), RH: rh == null ? null : percentToFraction(rh),
      qfe: pa(r.prestas0), qff: pa(r.pp0qffs0), qnh: pa(r.pp0qnhs0) };
  }
  return out;
}

async function loadList(ctx) {
  const { value } = await cached(ctx, LIST_KEY, TTL.stations, async () => {
    ctx.onProgress?.({ code: 'loadingStationListOf', source: 'meteoswiss' });
    return parseMeta(await ctx.getText(META_URL, { signal: ctx.signal, encoding: 'iso-8859-1' }));
  });
  return value;
}

/** Learned extent of the cached station list (no request). */
async function extent(ctx) {
  const list = await ctx.cache.get(LIST_KEY);
  return list ? pointsBbox(list) : null;
}

/** Step 1: SwissMetNet stations (all; the core keeps those within the radius). */
async function stations(_area, ctx) {
  const list = await loadList(ctx);
  return list.map((s) => ({ sourceId: 'meteoswiss', id: s.id, name: s.name, latRad: s.latRad, lonRad: s.lonRad, elevM: s.elevM,
    barometerM: s.barometerM, network: 'SwissMetNet', ids: idsFor(s.wigos) }));
}

/** Step 2: the latest 10-min values of the selected stations, from one file for all stations (cached 10 min). */
async function current(metas, ctx) {
  if (!metas.length) return [];
  ctx.onProgress?.({ code: 'loadingCurrentsOf', source: 'meteoswiss' });
  const r = await cached(ctx, 'meteoswiss:now', TTL.current, async () => parseNow(await ctx.getText(NOW_URL, { signal: ctx.signal })));
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

/** One station's latest values → Observation. */
function normalise(st, row, distanceM) {
  const notes = [];
  const baro = Number.isFinite(st.barometerM) ? st.barometerM : null;
  // QFE at the barometer; QFF only for the implied-height check. Without a barometer height there is no station
  // pressure (and MeteoSwiss sends none for such stations).
  const p = choosePressure({ stationPa: baro != null ? row.qfe : null, seaPa: row.qff, seaKind: 'mslp', tempC: row.T, heightM: baro ?? st.elevM });
  let pressure = p.pressure;
  if (pressure?.kind === 'mslp') pressure = null;                  // QFF alone is not used: QNH is exact for ISA
  if (!pressure && baro == null && row.qnh != null) { pressure = { kind: 'qnh', pa: row.qnh }; notes.push({ code: 'pressureQnhNoBaro' }); }
  notes.push(...p.notes.filter((n) => n.code !== 'pressureSeaLevelOnly'));
  if (pressure?.kind === 'station') notes.push({ code: 'stationPressureBaro', barometerM: Math.round(baro) });
  const rh = row.RH != null ? row.RH : null;
  if (rh != null) notes.push({ code: 'humidityMeasured' });
  return {
    sourceId: 'meteoswiss', reportType: 'SMN', attribution: ATTRIBUTION,
    station: { id: st.id, name: st.name, latRad: st.latRad, lonRad: st.lonRad, elevM: st.elevM, barometerM: baro, distanceM,
      network: 'SwissMetNet', ids: st.ids },
    time: new Date(row.time), temperatureC: row.T, dewpointC: row.Td, humidity: rh, pressure,
    precision: { tC: 0.1 },
    raw: null, notes, qc: p.qc,
  };
}
