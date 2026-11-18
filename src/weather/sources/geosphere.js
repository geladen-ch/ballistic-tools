// GeoSphere Austria adapter: TAWES automatic stations, 10-min current values.
// Documented dataset API (https://dataset.api.hub.geosphere.at/v1/docs/, CORS "*", no key; limits 5 requests/s and
// 240/hour per client, sent as x-ratelimit headers). Licence CC BY 4.0; credit "Datenquelle: GeoSphere Austria -
// https://data.hub.geosphere.at". The current values are raw, unchecked measurements.
// - metadata `station/current/tawes-v1-10min/metadata`: ~288 stations, SYNOP-style ids (`11035`), altitude, position;
// - current values `station/current/tawes-v1-10min?parameters=…&station_ids=…`: the latest value of each station
//   (GeoJSON; per station its own latest time), one request for all selected stations.
import { pointsBbox, outlineFromDegrees } from '../geo.js';
import { choosePressure, PRESSURE_QC } from '../qc.js';
import { degToRad, hpaToPa, percentToFraction, dayToS, minToS } from '../../quantity.js';
import { cached, nearestVia } from './common.js';

const API = 'https://dataset.api.hub.geosphere.at/v1/station/current/tawes-v1-10min';
const TTL = { stations: dayToS(90), current: minToS(10) };
const LIST_KEY = 'geosphere:stations';
const PARAMS = 'TL,TP,RF,P,PRED';
const ATTRIBUTION = 'Datenquelle: GeoSphere Austria - https://data.hub.geosphere.at';
/**
 * Pressure check with a tighter tolerance than the generic 30 m: TAWES gives no barometer height, and the pressure
 * refers to the station altitude at 155 of 158 stations below 800 m within 15 m (snapshot of 2026-11-15). The
 * exceptions (Innsbruck Universität +30 m, Graz airport +22 m, Wolfsegg −20 m) would add 2–3.5 hPa at the device.
 */
export const GEOSPHERE_PRESSURE_QC = Object.freeze({ ...PRESSURE_QC, toleranceM: 15 });

/** Simplified outline of Austria, ±5 km ([lonDeg, latDeg]): activation geometry, not station data. */
export const AT_OUTLINE = outlineFromDegrees([
  [9.56, 47.50], [9.73, 47.55], [9.98, 47.54], [10.17, 47.27], [10.47, 47.55], [10.90, 47.48], [11.27, 47.40], [11.63, 47.59],
  [12.20, 47.60], [12.75, 47.67], [12.95, 47.75], [13.00, 47.85], [12.85, 48.00], [13.03, 48.27], [13.44, 48.56], [13.73, 48.52],
  [13.84, 48.77], [14.70, 48.58], [15.00, 49.02], [15.75, 48.86], [16.95, 48.62], [17.07, 48.13], [17.16, 48.01], [17.05, 47.71],
  [16.45, 47.42], [16.65, 47.30], [16.53, 46.98], [16.11, 46.87], [15.99, 46.68], [15.65, 46.70], [14.87, 46.60], [14.55, 46.38],
  [13.72, 46.53], [12.70, 46.65], [12.30, 46.80], [12.10, 47.05], [11.50, 46.99], [11.05, 46.77], [10.49, 46.86], [10.47, 46.98],
  [10.10, 46.85], [9.88, 47.02], [9.61, 47.06], [9.56, 47.27], [9.67, 47.46], [9.56, 47.50],
]);

/** @type {import('./types.js').SourceAdapter & {internals:object}} */
export const geosphere = {
  id: 'geosphere',
  name: 'GeoSphere Austria (TAWES)',
  attribution: ATTRIBUTION,
  credits: { text: 'Datenquelle: GeoSphere Austria - https://data.hub.geosphere.at (Austrian stations; CC BY 4.0; raw 10-minute values)', url: 'https://data.hub.geosphere.at/dataset/tawes-v1-10min' },
  homepage: 'https://data.hub.geosphere.at/',
  probe: { url: `${API}?parameters=TL&station_ids=11035` },
  coverage: { kind: 'region', polygons: [AT_OUTLINE] },
  autoDefault: true,                       // validated on 2025 data
  authoritativeMetadata: true,             // surveyed station altitudes (no barometer heights)
  minRefreshS: minToS(10),
  nominalIntervalS: minToS(10),
  typicalDelayS: minToS(7),                // :30 values online 12:34–12:37, :40 at 12:44
  stations,
  current,
  extent,
  nearest: (point, opts, ctx) => nearestVia(geosphere, point, opts, ctx),
  internals: { compactMeta, compactCurrent, normalise, idsFor },
};

/**
 * Identifiers for matching other feeds: TAWES ids of the form `11NNN` are WMO indexes; IEM lists the same stations
 * under the Austrian national WIGOS id `0-40-0-NNN` (verified for 146 of 156 such ids). Other ids (e.g. Innsbruck city
 * stations `8989033`) carry no WMO index.
 */
function idsFor(id) {
  if (!/^11\d{3}$/.test(id)) return { wigos: [], wmo: null };
  const n = id.slice(2);
  return { wigos: [...new Set([`0-20000-0-${id}`, `0-40-0-${Number(n)}`, `0-40-0-${n}`])], wmo: id };
}

function compactMeta(json) {
  return (json.stations ?? []).filter((s) => s.is_active !== false && Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((s) => ({ id: String(s.id), name: s.name, latRad: degToRad(s.lat), lonRad: degToRad(s.lon), elevM: Number.isFinite(s.altitude) ? s.altitude : null }));
}

/** GeoJSON → {id: {time, T, Td, RH (fraction), P, PRED (Pa)}}: per station the latest time with temperature or pressure. */
function compactCurrent(json) {
  const ts = json.timestamps ?? [];
  const out = {};
  const pa = (v) => (v == null ? null : hpaToPa(v));
  for (const f of json.features ?? []) {
    const p = f.properties?.parameters ?? {};
    const at = (q, i) => p[q]?.data?.[i] ?? null;
    let i = ts.length - 1;
    while (i >= 0 && at('TL', i) == null && at('P', i) == null) i--;
    if (i < 0) continue;
    const rh = at('RF', i);
    out[String(f.properties.station)] = { time: new Date(ts[i]).toISOString(), T: at('TL', i), Td: at('TP', i),
      RH: rh == null ? null : percentToFraction(rh), P: pa(at('P', i)), PRED: pa(at('PRED', i)) };
  }
  return out;
}

async function loadList(ctx) {
  const { value } = await cached(ctx, LIST_KEY, TTL.stations, async () => {
    ctx.onProgress?.({ code: 'loadingStationListOf', source: 'geosphere' });
    return compactMeta(await ctx.getJSON(`${API}/metadata`, { signal: ctx.signal }));
  });
  return value;
}

async function extent(ctx) {
  const list = await ctx.cache.get(LIST_KEY);
  return list ? pointsBbox(list) : null;
}

/** Step 1: active TAWES stations (all; the core keeps those within the radius). */
async function stations(_area, ctx) {
  return (await loadList(ctx)).map((s) => ({ sourceId: 'geosphere', id: s.id, name: s.name, latRad: s.latRad, lonRad: s.lonRad, elevM: s.elevM,
    barometerM: null, network: 'TAWES', ids: idsFor(s.id) }));
}

/** Step 2: latest values of the selected stations, one request (cached 10 min). */
async function current(metas, ctx) {
  if (!metas.length) return [];
  const ids = [...new Set(metas.map((m) => m.id))].sort();
  ctx.onProgress?.({ code: 'loadingCurrentsOf', source: 'geosphere' });
  const r = await cached(ctx, `geosphere:now:${ids.join(',')}`, TTL.current, async () =>
    compactCurrent(await ctx.getJSON(`${API}?parameters=${PARAMS}&station_ids=${ids.join(',')}`, { signal: ctx.signal })));
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

/** One station's latest values → Observation. Station pressure refers to the station altitude (no barometer height). */
function normalise(st, row, distanceM) {
  const notes = [{ code: 'rawUnchecked' }];
  const p = choosePressure({ stationPa: row.P, seaPa: row.PRED, seaKind: 'mslp', tempC: row.T, heightM: st.barometerM ?? st.elevM }, GEOSPHERE_PRESSURE_QC);
  let pressure = p.pressure;
  if (pressure?.kind === 'mslp') pressure = null;                  // reduced pressure alone is not used
  notes.push(...p.notes.filter((n) => n.code !== 'pressureSeaLevelOnly'));
  if (pressure) notes.push({ code: 'stationPressureAtStation' });
  if (row.RH != null) notes.push({ code: 'humidityMeasured' });
  return {
    sourceId: 'geosphere', reportType: 'TAWES', attribution: ATTRIBUTION,
    station: { id: st.id, name: st.name, latRad: st.latRad, lonRad: st.lonRad, elevM: st.elevM, barometerM: st.barometerM ?? null, distanceM,
      network: 'TAWES', ids: st.ids },
    time: new Date(row.time), temperatureC: row.T, dewpointC: row.Td, humidity: row.RH, pressure,
    cloudFraction: null,
    precision: { tC: 0.1 },
    raw: null, notes, qc: p.qc,
  };
}
