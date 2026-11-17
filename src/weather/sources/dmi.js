// DMI adapter: Danish Meteorological Institute observations for Denmark, Greenland and the Faroe Islands.
// Documented OGC API Features (https://opendataapi.dmi.dk/v2/metObs; no key since 2025, CORS "*"). Licence CC BY 4.0
// (credit, link to the licence, note changes); observations are raw, not quality-controlled. Fair use: filter, cache,
// no needless polling; mobile apps must not update in the background (the app never refreshes on its own).
// - stations: `collections/station/items?status=Active&datetime=<now>` (records valid now; ~270, of which ~115 measure
//   temperature or pressure: types Synop and GIWS), with station height, barometer height and WMO id; cached 90 days;
// - current values: `collections/observation/items?parameterId=…&bbox=…&datetime=<now − 90 min>/..` (one parameter per
//   request, long format: one feature per station, time and parameter): temp_dry, humidity, pressure (at the barometer
//   height) and pressure_at_sea (implied-height check only); 4 requests per refresh for the selected stations' box.
// Denmark reports every 10 min (online 1–3 min later); Greenland hourly.
import { pointsBbox, outlineFromDegrees } from '../geo.js';
import { choosePressure, PRESSURE_QC } from '../qc.js';
import { degToRad, hpaToPa, percentToFraction, dayToS, minToS, sToMs } from '../../quantity.js';
import { cached, nearestVia, queryBoxDegrees } from './common.js';

const API = 'https://opendataapi.dmi.dk/v2/metObs/collections';
const TTL = { stations: dayToS(90), current: minToS(10) };
const LIST_KEY = 'dmi:stations';
const PARAMS = ['temp_dry', 'humidity', 'pressure', 'pressure_at_sea'];
const WINDOW_MS = sToMs(minToS(90));       // = the default maximum age: hourly Greenland stations stay in the window
const SLOT_MS = sToMs(minToS(10));         // the query window starts on a 10-minute boundary
const ATTRIBUTION = 'Source: DMI (Danish Meteorological Institute)';
/**
 * Pressure check with a 5 m tolerance: DMI gives barometer heights, and its station pressure, sea-level pressure and
 * temperature imply the listed barometer height with a median deviation of −0.2 m (MAD 0.3 m) below 800 m; 82 of 88
 * stations agree within 5 m (snapshot of 2026-11-15). The others are 5–11 m off, and where an airport METAR allows a
 * check (Aalborg: listed 13 m, implied 6 m) the implied height is the right one: about 1 hPa.
 */
export const DMI_PRESSURE_QC = Object.freeze({ ...PRESSURE_QC, toleranceM: 5 });

/** Simplified outlines, ±10 km with coastal waters ([lonDeg, latDeg]): activation geometry, not station data. */
export const DK_OUTLINE = outlineFromDegrees([
  [8.05, 55.10], [7.95, 55.55], [8.00, 56.05], [8.05, 56.65], [8.50, 57.15], [9.45, 57.25], [9.85, 57.68], [10.55, 57.82],
  [10.75, 57.75], [11.20, 57.45], [11.80, 56.80], [12.20, 56.20], [12.70, 56.15], [12.75, 55.65], [12.65, 55.20], [12.65, 54.95],
  [12.05, 54.50], [11.20, 54.55], [10.60, 54.70], [9.95, 54.75], [9.40, 54.78], [8.65, 54.88], [8.35, 55.00], [8.05, 55.10],
]);
export const BORNHOLM_OUTLINE = outlineFromDegrees([[14.60, 54.92], [15.30, 54.92], [15.30, 55.38], [14.60, 55.38], [14.60, 54.92]]);
/** Danish North Sea platforms (Harald B, Gorm C). */
export const DK_NORTH_SEA_BOX = outlineFromDegrees([[4.00, 55.30], [5.30, 55.30], [5.30, 56.60], [4.00, 56.60], [4.00, 55.30]]);
export const FO_OUTLINE = outlineFromDegrees([[-7.80, 61.30], [-6.15, 61.30], [-6.15, 62.45], [-7.80, 62.45], [-7.80, 61.30]]);
export const GL_OUTLINE = outlineFromDegrees([
  [-43.9, 59.5], [-42.6, 59.8], [-41.6, 61.5], [-40.2, 64.3], [-37.0, 65.3], [-32.0, 67.6], [-25.5, 68.3], [-21.6, 70.0],
  [-21.3, 71.0], [-18.2, 74.5], [-17.8, 77.0], [-16.8, 79.3], [-10.5, 81.6], [-20.0, 82.9], [-30.0, 83.8], [-45.0, 83.8],
  [-60.0, 82.2], [-67.0, 80.2], [-73.6, 78.7], [-74.0, 76.6], [-69.5, 76.1], [-66.0, 75.8], [-59.0, 75.4], [-57.0, 72.5],
  [-55.6, 70.3], [-54.8, 68.5], [-53.8, 66.0], [-51.2, 63.0], [-48.8, 60.6], [-43.9, 59.5],
]);

/** @type {import('./types.js').SourceAdapter & {internals:object}} */
export const dmi = {
  id: 'dmi',
  name: 'DMI (Denmark, Greenland, Faroe Islands)',
  attribution: ATTRIBUTION,
  credits: {
    text: 'Stations in Denmark, Greenland and the Faroe Islands: Danish Meteorological Institute (DMI), licence CC BY 4.0; raw observations, converted to your altitude and combined with other stations',
    url: 'https://www.dmi.dk/friedata/dokumentation/terms-of-use',
    links: [{ text: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }],
  },
  homepage: 'https://www.dmi.dk/frie-data/',
  probe: { url: `${API}/station/items?limit=1` },
  coverage: { kind: 'region', polygons: [DK_OUTLINE, BORNHOLM_OUTLINE, DK_NORTH_SEA_BOX, FO_OUTLINE, GL_OUTLINE] },
  autoDefault: true,                       // validated on 2025 data
  authoritativeMetadata: true,             // DMI station and barometer heights
  minRefreshS: minToS(10),
  nominalIntervalS: minToS(10),
  typicalDelayS: minToS(3),                // created − observed: median 1.4 min, p90 3.2 min
  stations,
  current,
  extent,
  nearest: (point, opts, ctx) => nearestVia(dmi, point, opts, ctx),
  internals: { compactStations, compactObservations, normalise, idsFor },
};

/**
 * Identifiers for matching other feeds: the WMO index where DMI gives one; IEM lists DMI's SYNOP stations under the
 * Danish national WIGOS id `0-208-0-NNN`, NNN = the last three digits of the DMI id (82 of 82 IEM stations within 2 km
 * of a DMI station; Danish `06NNN` and Greenland `04NNN` share the series, so the 10 km limit of id matches keeps
 * them apart).
 */
function idsFor(id, wmo) {
  const wigos = [];
  const w = /^\d{5}$/.test(wmo ?? '') ? wmo : null;
  if (w) wigos.push(`0-20000-0-${w}`);
  if (/^0[46]\d{3}$/.test(id)) { const n = id.slice(2); wigos.push(`0-208-0-${Number(n)}`, `0-208-0-${n}`); }
  return { wigos: [...new Set(wigos)], wmo: w };
}

/** Station records valid now → [{id, name, latRad, lonRad, elevM, baroM, wmo, country}] (stations with T or pressure only). */
function compactStations(json) {
  const out = new Map();
  for (const f of json.features ?? []) {
    const p = f.properties ?? {}, [lon, lat] = f.geometry?.coordinates ?? [];
    const params = new Set(p.parameterId ?? []);
    if (p.status !== 'Active' || p.validTo != null || !(params.has('temp_dry') || params.has('pressure'))) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.set(p.stationId, { id: p.stationId, name: p.name, latRad: degToRad(lat), lonRad: degToRad(lon),
      elevM: Number.isFinite(p.stationHeight) ? p.stationHeight : null,
      baroM: Number.isFinite(p.barometerHeight) ? p.barometerHeight : null, wmo: p.wmoStationId ?? null, country: p.country ?? null });
  }
  return [...out.values()];
}

/** Long-format features of several parameters → {stationId: {time, T, RH (fraction), P, PSEA (Pa)}} at each station's latest time. */
function compactObservations(featureLists) {
  const by = {};
  for (const f of featureLists.flat()) {
    const p = f.properties ?? {};
    if (!p.stationId || !p.observed || !Number.isFinite(p.value)) continue;
    ((by[p.stationId] ??= {})[p.observed] ??= {})[p.parameterId] = p.value;
  }
  // Per station the latest time with temperature, station and sea-level pressure (the pressures arrive a few minutes
  // after the temperature; without both the pressure check cannot run, found live at Aalborg); else the latest time
  // with temperature or pressure (stations without a barometer).
  const out = {};
  for (const [id, times] of Object.entries(by)) {
    const ks = Object.keys(times).sort();
    const full = ks.filter((k) => times[k].temp_dry != null && times[k].pressure != null && times[k].pressure_at_sea != null).pop();
    const t = full ?? ks.filter((k) => times[k].temp_dry != null || times[k].pressure != null).pop();
    if (!t) continue;
    const v = times[t];
    out[id] = { time: new Date(t).toISOString(), T: v.temp_dry ?? null, RH: v.humidity == null ? null : percentToFraction(v.humidity),
      P: v.pressure == null ? null : hpaToPa(v.pressure), PSEA: v.pressure_at_sea == null ? null : hpaToPa(v.pressure_at_sea) };
  }
  return out;
}

async function loadList(ctx) {
  const now = ctx.now ? ctx.now() : new Date();
  const { value } = await cached(ctx, LIST_KEY, TTL.stations, async () => {
    ctx.onProgress?.({ code: 'loadingStationListOf', source: 'dmi' });
    return compactStations(await ctx.getJSON(`${API}/station/items?status=Active&datetime=${now.toISOString().slice(0, 19)}Z&limit=10000`, { signal: ctx.signal }));
  });
  return value;
}

async function extent(ctx) {
  const list = await ctx.cache.get(LIST_KEY);
  return list ? pointsBbox(list) : null;
}

/** Step 1: DMI stations measuring temperature or pressure (all; the core keeps those within the radius). */
async function stations(_area, ctx) {
  return (await loadList(ctx)).map((s) => ({ sourceId: 'dmi', id: s.id, name: s.name, latRad: s.latRad, lonRad: s.lonRad, elevM: s.elevM,
    barometerM: s.baroM, network: 'DMI', ids: idsFor(s.id, s.wmo) }));
}

/** Step 2: latest values of the selected stations: one request per parameter for their box (cached 10 min). */
async function current(metas, ctx) {
  if (!metas.length) return [];
  const now = ctx.now ? ctx.now() : new Date();
  const ids = [...new Set(metas.map((m) => m.id))].sort();
  const from = new Date(Math.floor((+now - WINDOW_MS) / SLOT_MS) * SLOT_MS).toISOString().slice(0, 19) + 'Z';
  const box = queryBoxDegrees(metas).join(',');
  ctx.onProgress?.({ code: 'loadingCurrentsOf', source: 'dmi' });
  const r = await cached(ctx, `dmi:now:${ids.join(',')}`, TTL.current, async () => {
    const lists = [];
    for (const q of PARAMS) {
      const json = await ctx.getJSON(`${API}/observation/items?parameterId=${q}&bbox=${box}&datetime=${from}/..&limit=10000`, { signal: ctx.signal });
      lists.push(json.features ?? []);
    }
    const all = compactObservations(lists);
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

/** One station's latest values → Observation. Station pressure refers to the barometer height (station height if none). */
function normalise(st, row, distanceM) {
  const notes = [{ code: 'rawNotChecked' }];
  const p = choosePressure({ stationPa: row.P, seaPa: row.PSEA, seaKind: 'mslp', tempC: row.T, heightM: st.barometerM ?? st.elevM }, DMI_PRESSURE_QC);
  let pressure = p.pressure;
  if (pressure?.kind === 'mslp') pressure = null;                  // sea-level pressure alone is not used
  notes.push(...p.notes.filter((n) => n.code !== 'pressureSeaLevelOnly'));
  if (pressure) notes.push(st.barometerM != null ? { code: 'stationPressureBaro', barometerM: st.barometerM } : { code: 'stationPressureAtStationHeight' });
  if (row.RH != null) notes.push({ code: 'humidityMeasured' });
  return {
    sourceId: 'dmi', reportType: 'DMI', attribution: ATTRIBUTION,
    station: { id: st.id, name: st.name, latRad: st.latRad, lonRad: st.lonRad, elevM: st.elevM, barometerM: st.barometerM ?? null, distanceM,
      network: 'DMI', ids: st.ids },
    time: new Date(row.time), temperatureC: row.T, dewpointC: null, humidity: row.RH, pressure,
    precision: { tC: 0.1 },
    raw: null, notes, qc: p.qc,
  };
}
