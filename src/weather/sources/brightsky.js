// Bright Sky adapter: Deutscher Wetterdienst (DWD) observations via Bright Sky.
// Bright Sky (https://brightsky.dev/, open source, MIT; "free-to-use for all purposes", no key, CORS "*") re-serves
// DWD open data, whose own server allows no browser access. The DWD terms apply: CC BY 4.0 with a source note.
// - stations: `/sources?lat=&lon=&max_dist=` (only by area): the live `synop` sources (DWD 10-min observations,
//   ~1000 stations in Germany, with DWD id, WMO id where there is one, height); cached per 0.5° tile for 90 days;
// - current values: `/synop?dwd_station_id=&date=&last_date=` (raw 10-min records of one station), one request per
//   selected station, at most MAX_SITES per refresh.
// Temperature and humidity only: the pressure is sea-level only (`pressure_msl`) and is not used.
// The API takes degrees and metres: the query is built at that edge.
import { EARTH_RADIUS_M, outlineFromDegrees } from '../geo.js';
import { degToRad, radToDeg, hpaToPa, percentToFraction, dayToS, minToS, sToMs } from '../../quantity.js';
import { cached, nearestVia } from './common.js';

const BASE = 'https://api.brightsky.dev';
const TTL = { stations: dayToS(90), current: minToS(10) };
/** Per-station requests per refresh (the core ranks by effective distance; k = 8 per quantity). */
export const MAX_SITES = 10;
/** A station counts as live if its last record is at most this old when the list is loaded. */
const LIVE_MS = sToMs(dayToS(3));
const TILE_DEG = 0.5;
const RECORD_WINDOW_MS = sToMs(minToS(120)), RECORD_AHEAD_MS = sToMs(minToS(10));
const ATTRIBUTION = 'Source: Deutscher Wetterdienst (via Bright Sky)';

/** Simplified outline of Germany, ±10 km, coastal waters included ([lonDeg, latDeg]): activation geometry, not station data. */
export const DE_OUTLINE = outlineFromDegrees([
  [6.65, 53.60], [8.50, 54.10], [8.30, 55.06], [9.40, 54.83], [11.00, 54.55], [12.00, 54.45], [13.40, 54.68], [14.20, 54.00],
  [14.45, 53.25], [14.15, 52.85], [14.55, 52.35], [14.73, 51.70], [15.04, 51.27], [14.83, 50.87], [13.60, 50.72], [12.95, 50.40],
  [12.15, 50.32], [12.40, 49.75], [12.95, 49.35], [13.85, 48.77], [13.73, 48.52], [13.03, 48.27], [12.85, 48.00], [13.00, 47.85],
  [13.00, 47.47], [12.20, 47.60], [11.63, 47.59], [11.27, 47.40], [10.90, 47.48], [10.47, 47.55], [10.17, 47.27], [9.98, 47.54],
  [9.56, 47.50], [9.17, 47.66], [8.86, 47.66], [8.71, 47.75], [8.61, 47.81], [8.50, 47.65], [8.42, 47.57], [8.23, 47.61],
  [7.79, 47.56], [7.59, 47.59], [7.52, 47.66], [7.55, 48.05], [7.80, 48.60], [8.20, 48.97], [7.00, 49.13], [6.85, 49.20],
  [6.36, 49.47], [6.13, 49.98], [6.12, 50.13], [6.40, 50.33], [6.03, 50.73], [6.10, 51.15], [5.87, 51.05], [6.20, 51.55],
  [5.95, 51.83], [6.80, 51.97], [6.95, 52.45], [7.05, 52.65], [7.20, 53.25], [6.65, 53.60],
]);

/** @type {import('./types.js').SourceAdapter & {internals:object}} */
export const brightsky = {
  id: 'brightsky',
  name: 'DWD via Bright Sky',
  attribution: ATTRIBUTION,
  credits: {
    text: 'German stations: Deutscher Wetterdienst (DWD), licence CC BY 4.0, retrieved via Bright Sky (by Jakob de Maeyer, open source, MIT licence). Values are converted to your altitude and combined with other stations',
    url: 'https://www.dwd.de/EN/ourservices/opendata/opendata.html',
    links: [{ text: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }, { text: 'Bright Sky', url: 'https://brightsky.dev/' }],
    // DWD template for processed data, shown next to results a DWD station contributed to
    processed: 'Data basis: Deutscher Wetterdienst, averaged over individual values',
    processedDe: 'Datenbasis: Deutscher Wetterdienst, Einzelwerte gemittelt',
  },
  homepage: 'https://brightsky.dev/',
  probe: { url: `${BASE}/sources?lat=52.5&lon=13.4&max_dist=1000` },
  coverage: { kind: 'region', polygons: [DE_OUTLINE] },
  autoDefault: true,                       // set from the validation
  authoritativeMetadata: true,             // DWD station heights
  minRefreshS: minToS(10),
  nominalIntervalS: minToS(10),
  typicalDelayS: minToS(30),
  maxStationsPerRefresh: MAX_SITES,
  stations,
  current,
  // No `extent`: the station list is loaded per area (tile), so a cached list never shows the whole network; a learned
  // extent from it would wrongly skip unvisited parts of Germany (found live: Berlin after Freiburg).
  nearest: (point, opts, ctx) => nearestVia(brightsky, point, opts, ctx),
  internals: { compactSources, latestRecord, normalise, idsFor, tileOf },
};

function idsFor(wmo) { return /^\d{5}$/.test(wmo ?? '') ? { wigos: [`0-20000-0-${wmo}`], wmo } : { wigos: [], wmo: null }; }

/** /sources → live synop stations [{id (DWD), name, latRad, lonRad, elevM, wmo}]. */
function compactSources(json, now) {
  const since = new Date(+now - LIVE_MS).toISOString();
  const out = new Map();
  for (const s of json.sources ?? []) {
    if (s.observation_type !== 'synop' || !s.dwd_station_id || (s.last_record ?? '') < since) continue;
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
    out.set(s.dwd_station_id, { id: s.dwd_station_id, name: s.station_name, latRad: degToRad(s.lat), lonRad: degToRad(s.lon),
      elevM: Number.isFinite(s.height) ? s.height : null, wmo: s.wmo_station_id ?? null });
  }
  return [...out.values()];
}

/**
 * Tile of a point: centre of its 0.5° cell (degrees, for the query), and the query radius (m) that covers the search
 * circle from anywhere in it.
 */
function tileOf(latRad, lonRad, radiusM) {
  const tileRad = degToRad(TILE_DEG);
  const c = (rad) => (Math.floor(radToDeg(rad) / TILE_DEG) + 0.5) * TILE_DEG;
  const halfDiagM = EARTH_RADIUS_M * Math.hypot(tileRad / 2, tileRad / 2 * Math.cos(latRad));
  return { latDeg: c(latRad), lonDeg: c(lonRad), maxDistM: Math.ceil(radiusM + halfDiagM) };
}

/** Step 1: live DWD synop stations around the point (one request per 0.5° tile, cached 90 days). */
async function stations({ latRad, lonRad, radiusM }, ctx) {
  const now = ctx.now ? ctx.now() : new Date();
  const t = tileOf(latRad, lonRad, radiusM);
  const key = `brightsky:sources:${t.latDeg},${t.lonDeg},${t.maxDistM}`;
  const { value: list } = await cached(ctx, key, TTL.stations, async () => {
    ctx.onProgress?.({ code: 'loadingStationListOf', source: 'brightsky' });
    return compactSources(await ctx.getJSON(`${BASE}/sources?lat=${t.latDeg}&lon=${t.lonDeg}&max_dist=${t.maxDistM}`, { signal: ctx.signal }), now);
  });
  return list.map((s) => ({ sourceId: 'brightsky', id: s.id, name: s.name, latRad: s.latRad, lonRad: s.lonRad, elevM: s.elevM, barometerM: null,
    network: 'DWD', ids: idsFor(s.wmo) }));
}

/** Latest 10-min record with a temperature, from a /synop response. */
function latestRecord(json) {
  const w = (json.weather ?? []).filter((r) => Number.isFinite(r.temperature)).sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  return w.length ? w[w.length - 1] : null;
}

/** Step 2: the latest record of each selected station (one request each, at most MAX_SITES; cached 10 min). */
async function current(metas, ctx) {
  const now = ctx.now ? ctx.now() : new Date();
  const from = new Date(+now - RECORD_WINDOW_MS).toISOString().slice(0, 16), to = new Date(+now + RECORD_AHEAD_MS).toISOString().slice(0, 16);
  const pick = metas.slice(0, MAX_SITES);
  const out = [];
  let failures = 0, lastError = null;
  for (const m of pick) {
    ctx.onProgress?.({ code: 'loadingStation', name: m.name, source: 'brightsky' });
    try {
      const r = await cached(ctx, `brightsky:synop:${m.id}`, TTL.current, async () =>
        latestRecord(await ctx.getJSON(`${BASE}/synop?dwd_station_id=${encodeURIComponent(m.id)}&date=${from}&last_date=${to}`, { signal: ctx.signal })));
      if (!r.value) continue;
      const o = normalise(m, r.value, m.distanceM);
      o.fetchedAt = r.fetchedAt; o.fromCache = r.fromCache;
      out.push(o);
    } catch (e) { failures++; lastError = e; }
  }
  if (pick.length && failures === pick.length) throw lastError;     // all failed: let the circuit breaker count it
  return out;
}

/** One /synop record → Observation (temperature and humidity; sea-level pressure reported but not used). */
function normalise(st, rec, distanceM) {
  const notes = [];
  const rh = Number.isFinite(rec.relative_humidity) ? percentToFraction(rec.relative_humidity) : null;
  if (rh != null) notes.push({ code: 'humidityMeasured' });
  const pressure = Number.isFinite(rec.pressure_msl) ? { kind: 'mslp', pa: hpaToPa(rec.pressure_msl) } : null;
  if (!pressure) notes.push({ code: 'noPressureReported' });
  return {
    sourceId: 'brightsky', reportType: 'DWD', attribution: ATTRIBUTION,
    station: { id: st.id, name: st.name, latRad: st.latRad, lonRad: st.lonRad, elevM: st.elevM, barometerM: null, distanceM, network: 'DWD', ids: st.ids },
    time: new Date(rec.timestamp), temperatureC: rec.temperature, dewpointC: Number.isFinite(rec.dew_point) ? rec.dew_point : null,
    humidity: rh, pressure, precision: { tC: 0.1 }, raw: null, notes, qc: [],
  };
}
