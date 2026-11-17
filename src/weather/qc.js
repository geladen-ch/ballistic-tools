// Data checks shared by all sources. Adapters call choosePressure() when a report carries station and sea-level
// pressure; the pipeline runs sanitise() on every observation of every source. Notes are codes with parameters (the UI
// translates them); `qc` holds the codes that hint triggers react to.
// The hypsometric equation is used here only as a data check, never to move values in height (atmosphere.js does that).
import { hpaToPa, celsiusToKelvin } from '../quantity.js';
import { ISA, R_DRY } from './atmosphere.js';

/**
 * Pressure plausibility (measured on a snapshot of the IEM feed): plain ranges first (placeholders such as Latvia's
 * 0.1 hPa), then, below maxElevM, the barometer height implied by station pressure, sea-level pressure and
 * temperature must agree with the listed height within toleranceM.
 */
export const PRESSURE_QC = Object.freeze({
  stationRangePa: Object.freeze([hpaToPa(450), hpaToPa(1100)]),
  seaRangePa: Object.freeze([hpaToPa(870), hpaToPa(1100)]),
  maxElevM: 800, toleranceM: 30,
});
/** Ranges for the generic sanity check (all sources). Humidity is a fraction. */
export const VALUE_QC = Object.freeze({ temperatureC: Object.freeze([-90, 60]), dewpointAboveTC: 0.5, humidityMax: 1.03 });

const inRange = (v, [lo, hi]) => v != null && Number.isFinite(v) && v >= lo && v <= hi;

/** Barometer height (m) implied by station pressure, sea-level pressure and station temperature (hypsometric). */
export function impliedHeight(pStationPa, pSeaPa, tStationC) {
  let h = 0;
  for (let i = 0; i < 3; i++) h = (R_DRY / ISA.g0) * (celsiusToKelvin(tStationC) + ISA.L * h / 2) * Math.log(pSeaPa / pStationPa);
  return h;
}

/**
 * Pick the pressure to use from a report that may carry station and sea-level pressure.
 * @param {{stationPa?:number|null, seaPa?:number|null, seaKind?:'mslp'|'qnh', tempC?:number|null, heightM?:number|null}} r
 *   heightM: barometer height if known, else station elevation
 * @returns {{pressure:{kind:string,pa:number}|null, notes:object[], qc:string[]}}
 *   qc codes: 'pressureOutOfRange', 'pressureInconsistent' (country-hint triggers)
 */
export function choosePressure({ stationPa = null, seaPa = null, seaKind = 'mslp', tempC = null, heightM = null }, q = PRESSURE_QC) {
  const notes = [], qc = [];
  const stOk = inRange(stationPa, q.stationRangePa), seaOk = inRange(seaPa, q.seaRangePa);
  if (stationPa != null && !stOk) { notes.push({ code: 'stationPressureOutOfRange', pa: stationPa }); qc.push('pressureOutOfRange'); }
  if (seaPa != null && !seaOk) { notes.push({ code: 'seaPressureOutOfRange', pa: seaPa }); qc.push('pressureOutOfRange'); }
  // The implied-height test needs a true sea-level reduction (QFF/SLP); QNH is an ISA construct and is skipped.
  if (stOk && seaOk && seaKind === 'mslp' && Number.isFinite(tempC) && Number.isFinite(heightM) && heightM < q.maxElevM) {
    const h = impliedHeight(stationPa, seaPa, tempC);
    if (Math.abs(h - heightM) > q.toleranceM) {
      notes.push({ code: 'pressureInconsistent', impliedM: Math.round(h), listedM: Math.round(heightM) });
      qc.push('pressureInconsistent');
      return { pressure: null, notes, qc };
    }
  }
  if (stOk) return { pressure: { kind: 'station', pa: stationPa }, notes, qc };
  if (seaOk) {
    notes.push({ code: seaKind === 'qnh' ? 'pressureQnhOnly' : 'pressureSeaLevelOnly' });
    return { pressure: { kind: seaKind, pa: seaPa }, notes, qc };
  }
  return { pressure: null, notes, qc };
}

/**
 * Generic sanity check for any observation (returns a copy; drops implausible values with a note and a qc code).
 * Pressure ranges by kind; temperature range; dew point not above T; RH ≤ 1.03 (clipped to 1), else dropped.
 */
export function sanitise(obs) {
  const o = { ...obs, notes: [...(obs.notes ?? [])], qc: [...(obs.qc ?? [])] };
  const drop = (note, code) => { o.notes.push(note); if (!o.qc.includes(code)) o.qc.push(code); };
  if (o.temperatureC != null && !inRange(o.temperatureC, VALUE_QC.temperatureC)) {
    drop({ code: 'temperatureOutOfRange', tempC: o.temperatureC }, 'temperatureOutOfRange');
    o.temperatureC = null; o.dewpointC = null; o.humidity = null;
  }
  if (o.dewpointC != null && o.temperatureC != null && o.dewpointC > o.temperatureC + VALUE_QC.dewpointAboveTC) {
    drop({ code: 'dewpointAboveTemperature', dewpointC: o.dewpointC }, 'humidityImplausible');
    o.dewpointC = null; o.humidity = null;
  }
  if (o.humidity != null) {
    if (!(o.humidity >= 0 && o.humidity <= VALUE_QC.humidityMax)) {
      drop({ code: 'humidityOutOfRange', humidity: o.humidity }, 'humidityImplausible'); o.humidity = null;
    } else if (o.humidity > 1) o.humidity = 1;
  }
  if (o.pressure) {
    const range = o.pressure.kind === 'station' ? PRESSURE_QC.stationRangePa : PRESSURE_QC.seaRangePa;
    if (!inRange(o.pressure.pa, range)) {
      drop({ code: 'pressureOutOfRange', pa: o.pressure.pa, kind: o.pressure.kind }, 'pressureOutOfRange'); o.pressure = null;
    }
  }
  return o;
}
