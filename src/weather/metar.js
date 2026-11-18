// Minimal METAR parser: what the app needs for pressure, temperature and humidity.
// Handles: report type/station/time, AUTO/COR/NIL, TT/TdTd with M prefix, Qxxxx (hPa), Axxxx (inHg),
// and in remarks the T-group (0.1 °C) and SLPxxx (mean-sea-level pressure, North America). Also the total cloud cover
// of the body (layer groups FEW/SCT/BKN/OVC, vertical visibility VV, and the clear-sky words), as a fraction 0..1.
import { hpaToPa, inhgToPa } from '../quantity.js';

// "M00" is −0 °C in METAR; + 0 turns −0 into 0 for display.
const tempVal = (s) => (s == null || s === '' || s.includes('/')) ? null : (s[0] === 'M' ? -1 : 1) * Number(s.replace('M', '')) + 0;
// METAR groups carry quantities in their own coding (Qxxxx whole hPa, Axxxx hundredths of inHg, T-group tenths of
// °C, SLP tenths of hPa): the scale below is the group's own definition, not a unit conversion.
const TENTHS = 10, HUNDREDTHS = 100;
const DAY_MS = 86400000;
// Cloud cover is coded in eighths of the sky (oktas). The layer values are the coding the cloud-damping factor was
// validated with (FEW 2, SCT 4, BKN 7, OVC 8 oktas, not the middle of each range); the total is the largest layer.
const OKTAS_PER_SKY = 8;
const LAYER_OKTAS = Object.freeze({ FEW: 2, SCT: 4, BKN: 7, OVC: 8 });
const CLEAR_WORDS = new Set(['CLR', 'SKC', 'NSC', 'NCD', 'CAVOK']);

/**
 * @param {string} raw     METAR/SPECI text (with or without the METAR/SPECI keyword)
 * @param {Date} [ref]     reference time used to resolve the DDHHMMZ group's month and year (default: now)
 * @returns {{type:string, station:string|null, time:Date|null, auto:boolean, cor:boolean, nil:boolean,
 *            temperatureC:number|null, dewpointC:number|null, tempPrecision:'1'|'0.1'|null,
 *            qnhPa:number|null, qnhGroup:'Q'|'A'|null, slpPa:number|null,
 *            cloudFraction:number|null, cloudGroups:string[]}}
 *   cloudFraction: total cloud cover, the largest layer (FEW 2/8, SCT 4/8, BKN 7/8, OVC and vertical visibility 8/8;
 *   CLR, SKC, NSC, NCD, CAVOK 0); null when the report has no cloud group. cloudGroups: the recognised tokens.
 */
export function parseMetar(raw, ref = new Date()) {
  const r = {
    type: 'METAR', station: null, time: null, auto: false, cor: false, nil: false,
    temperatureC: null, dewpointC: null, tempPrecision: null, qnhPa: null, qnhGroup: null, slpPa: null,
    cloudFraction: null, cloudGroups: [],
  };
  if (!raw) return r;
  const tokens = raw.trim().replace(/=$/, '').split(/\s+/);
  if (tokens[0] === 'METAR' || tokens[0] === 'SPECI') r.type = tokens.shift();
  if (tokens[0] === 'COR') { r.cor = true; tokens.shift(); }
  if (/^[A-Z][A-Z0-9]{3}$/.test(tokens[0] ?? '')) r.station = tokens.shift();
  const tm = /^(\d{2})(\d{2})(\d{2})Z$/.exec(tokens[0] ?? '');
  if (tm) { r.time = resolveTime(+tm[1], +tm[2], +tm[3], ref); tokens.shift(); }

  // Body: up to remarks or a trend section.
  let layerOktas = null, clearSky = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'RMK' || t === 'TEMPO' || t === 'BECMG' || t === 'NOSIG') break;
    if (t === 'NIL') r.nil = true;
    else if (t === 'AUTO') r.auto = true;
    else if (t === 'COR') r.cor = true;
    else if (r.temperatureC == null && /^M?\d{2}\/(M?\d{2}|\/\/)?$/.test(t)) {
      const [a, b] = t.split('/');
      r.temperatureC = tempVal(a); r.dewpointC = tempVal(b); r.tempPrecision = '1';
    } else if (r.qnhPa == null && /^Q\d{4}$/.test(t)) { r.qnhPa = hpaToPa(+t.slice(1)); r.qnhGroup = 'Q'; }
    else if (r.qnhPa == null && /^A\d{4}$/.test(t)) { r.qnhPa = inhgToPa(+t.slice(1) / HUNDREDTHS); r.qnhGroup = 'A'; }
    else if (CLEAR_WORDS.has(t)) { clearSky = true; r.cloudGroups.push(t); }
    else if (/^VV(\d{3}|\/{3})$/.test(t)) { layerOktas = Math.max(layerOktas ?? 0, OKTAS_PER_SKY); r.cloudGroups.push(t); }
    else {
      const layer = /^(FEW|SCT|BKN|OVC)(?:\d{3}|\/{3})(?:CB|TCU|\/{3})?$/.exec(t);
      if (layer) { layerOktas = Math.max(layerOktas ?? 0, LAYER_OKTAS[layer[1]]); r.cloudGroups.push(t); }
    }
  }
  // Layers win over a clear-sky word; a report with neither has no cover.
  if (layerOktas != null) r.cloudFraction = layerOktas / OKTAS_PER_SKY;
  else if (clearSky) r.cloudFraction = 0;
  // Remarks: T-group and SLP.
  const rmk = tokens.indexOf('RMK');
  if (rmk >= 0) for (const t of tokens.slice(rmk + 1)) {
    const tg = /^T([01])(\d{3})(?:([01])(\d{3}))?$/.exec(t);
    if (tg) {
      r.temperatureC = (tg[1] === '1' ? -1 : 1) * +tg[2] / TENTHS;
      if (tg[3]) r.dewpointC = (tg[3] === '1' ? -1 : 1) * +tg[4] / TENTHS;
      r.tempPrecision = '0.1';
    }
    const slp = /^SLP(\d{3})$/.exec(t);
    if (slp) { const v = +slp[1] / TENTHS; r.slpPa = hpaToPa(v < 50 ? 1000 + v : 900 + v); }
  }
  return r;
}

/** Resolve day/hour/minute (UTC) to the most recent date not more than one day in the future of ref. */
function resolveTime(day, hh, mm, ref) {
  for (const dm of [0, -1, 1]) {
    const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + dm, day, hh, mm));
    if (d.getUTCDate() !== day) continue;                     // e.g. day 31 in a 30-day month
    const diff = d - ref;
    if (diff <= DAY_MS && diff > -25 * DAY_MS) return d;
  }
  return null;
}

/**
 * QNH rounding correction. ICAO Annex 3 rounds `Q` groups DOWN to whole hPa, so a reported QNH is on average
 * 0.5 hPa low (measured on a year of hourly reports: −0.37 → +0.01 hPa bias with the correction). `A` groups
 * (0.01 inHg) are rounded to nearest and get no correction. Applied by the source adapter; the parser reports
 * values as sent.
 */
export const Q_GROUP_ROUNDING_PA = hpaToPa(0.5);
export function qnhRoundingCorrection(group) { return group === 'Q' ? Q_GROUP_ROUNDING_PA : 0; }
