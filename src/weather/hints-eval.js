// Which country hints apply to a weather result. Pure: input is the estimate, the candidate reports and the source
// status of a fetch; output the applicable entries of hints.js in table order. Lengths in metres, temperature spans in K.
import { HINTS } from './hints.js';
import { ISO_NUMERIC_TO_ALPHA2 } from './countries.js';
import { contributors } from './refresh-gate.js';
import { kmToM, degToRad } from '../quantity.js';

export const FAR_DISTANCE_M = kmToM(30);
export const FAR_HEIGHT_M = 300;
export const SPREAD_K = 2;

/** Countries of the national services (one service, one country). */
const SERVICE_COUNTRY = { 'iem-us': 'US', meteoswiss: 'CH', geosphere: 'AT', brightsky: 'DE', dmi: 'DK', eccc: 'CA' };

// Latvian stations are published under the Russian WIGOS issuer: a "Russian" station inside Latvia's box is Latvian.
const LATVIA = { south: degToRad(55.6), north: degToRad(58.1), west: degToRad(20.9), east: degToRad(28.25) };
const inLatvia = (st) => st.latRad >= LATVIA.south && st.latRad <= LATVIA.north && st.lonRad >= LATVIA.west && st.lonRad <= LATVIA.east;

/** Country of a METAR report from its IEM network: `CH__ASOS` → CH, `CA_ON_ASOS` → CA, `NY_ASOS` (a US state) → US. */
export function countryOfNetwork(network) {
  const n = String(network ?? '');
  let m = /^([A-Z]{2})__ASOS$/.exec(n);
  if (m) return m[1];
  if (/^CA_[A-Z]{2}_ASOS$/.test(n)) return 'CA';
  if (/^[A-Z]{2}_ASOS$/.test(n)) return 'US';
  return null;
}

/** Country of a national WIGOS id `0-{ISO numeric}-0-…`; the shared WMO issuer 20000 names no country. */
export function countryOfWigos(id) {
  const m = /^0-(\d{1,5})-0-/.exec(String(id ?? ''));
  if (!m || m[1] === '20000') return null;
  return ISO_NUMERIC_TO_ALPHA2[m[1].padStart(3, '0')] ?? null;
}

/**
 * Country of one report, or null when it carries none (a SYNOP report under the shared WMO issuer then takes the
 * country of the nearest METAR report: see evaluateHints).
 */
export function countryOfObservation(o) {
  if (SERVICE_COUNTRY[o.sourceId]) return SERVICE_COUNTRY[o.sourceId];
  if (o.sourceId === 'iem') return countryOfNetwork(o.station.network);
  if (o.sourceId === 'iem-synop') {
    const c = countryOfWigos(o.station.id) ?? (o.station.ids?.wigos ?? []).map(countryOfWigos).find(Boolean) ?? null;
    return c === 'RU' && inLatvia(o.station) ? 'LV' : c;
  }
  return null;
}

/**
 * @param {{result:object, observations:object[]}} input
 *   result: estimate() output; observations: every candidate report of the fetch (carrying `qc` outcomes)
 * @returns {{id:string, severity:'warn'|'info', countries:string[]|null}[]} the entries whose triggers all hold
 */
export function evaluateHints({ result, observations }) {
  if (!result || result.mode === 'none') return [];
  // countries of all candidates; a SYNOP report without its own country takes that of the nearest METAR report
  const metars = observations.filter((o) => o.sourceId === 'iem' && countryOfObservation(o)).sort((a, b) => a.station.distanceM - b.station.distanceM);
  const fallback = metars.length ? countryOfObservation(metars[0]) : null;
  const countryOf = (o) => countryOfObservation(o) ?? (o.sourceId === 'iem-synop' ? fallback : null);

  const who = contributors(result);
  const counted = new Set(who.map((c) => countryOf(c.obs)).filter(Boolean));
  const usedRows = [...new Map([result.pressure, result.temperature, result.humidity]
    .flatMap((q) => q.used).map((u) => [`${u.row.obs.sourceId}:${u.row.obs.station.id}`, u.row])).values()];
  const nearest = usedRows.length ? usedRows.reduce((a, b) => (b.distanceM < a.distanceM ? b : a)) : null;
  if (nearest && countryOf(nearest.obs)) counted.add(countryOf(nearest.obs));

  // weighted height of the contributors (each station once, by its largest weight) against the device
  const byStation = new Map();
  for (const q of [result.pressure, result.temperature, result.humidity]) {
    for (const u of q.used) {
      const k = `${u.row.obs.sourceId}:${u.row.obs.station.id}`;
      byStation.set(k, { elevM: u.row.obs.station.elevM, weight: Math.max(u.weight ?? 0, byStation.get(k)?.weight ?? 0) });
    }
  }
  const withHeight = [...byStation.values()].filter((s) => Number.isFinite(s.elevM));
  const wSum = withHeight.reduce((s, x) => s + x.weight, 0);
  const meanHeight = wSum > 0 ? withHeight.reduce((s, x) => s + x.weight * x.elevM, 0) / wSum : null;
  const heightFar = Number.isFinite(result.deviceHeightM) && meanHeight != null && Math.abs(meanHeight - result.deviceHeightM) > FAR_HEIGHT_M;
  const nearestFar = !!nearest && nearest.distanceM > FAR_DISTANCE_M;

  const facts = {
    far: nearestFar || heightFar,
    altitude: heightFar,
    noSynop: !observations.some((o) => o.reportType === 'SYNOP'),
    spread: (result.temperature.check?.mad ?? 0) > SPREAD_K,
    rejected: [result.pressure, result.temperature, result.humidity].some((q) => q.rejected.length > 0),
  };
  const eventIn = (code, countries) => observations.some((o) => o.qc?.includes(code)
    && counted.has(countryOf(o)) && (!countries || countries.includes(countryOf(o))));

  return HINTS.filter((h) => {
    const t = h.trigger;
    if (t.country && !(h.countries ?? []).some((c) => counted.has(c))) return false;
    if (t.event && !eventIn(t.event, h.countries)) return false;
    for (const k of ['far', 'altitude', 'noSynop', 'spread', 'rejected']) if (t[k] && !facts[k]) return false;
    return true;
  }).map(({ id, severity, countries }) => ({ id, severity, countries }));
}

/** At most `limit` hints, warnings before information (table order otherwise); `dismissed` ids are skipped. */
export function pickHints(applicable, { dismissed = [], limit = 2 } = {}) {
  const open = applicable.filter((h) => !dismissed.includes(h.id));
  return [...open.filter((h) => h.severity === 'warn'), ...open.filter((h) => h.severity !== 'warn')].slice(0, limit);
}
