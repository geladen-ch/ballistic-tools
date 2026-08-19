// Parses a single Labradar track CSV into the {t, v, dist, snr, a} point
// shape src/engine/labradar-clean.js and labradar-bc.js expect. Ports
// RadarTrack's own content-sniff and row-tolerance rules exactly (see
// data/legacy.code/labrabaco/engine/labrabacoengine.js) — this is the
// one module in the whole feature exempt from "engine code only touches
// metric": it's the ingestion boundary, converting whatever units a
// track's own header declares into metric before anything past this
// point ever sees the data.
import Qty from '../vendor/js-quantities/quantities.mjs';

const TRACK_HEADER_RE = /Time \(s\);[\s\S]+/m;
const VEL_UNIT_RE = /Vel\s+\(([^)]+)\)/;
const DIST_UNIT_RE = /Dist\s+\(([^)]+)\)/;
const MIN_POINTS = 4;

function isNumericStr(s) {
  if (s === undefined || s === '') return false;
  return !Number.isNaN(Number(s));
}

// Returns null for anything that isn't a Labradar track — a device
// report CSV, a stray non-track file that happens to end in .csv, or
// (confirmed against real sample data — see data/labradar.track/) a
// macOS AppleDouble resource-fork file some other tool left in the ZIP,
// which decodes to garbage text that simply never matches this header.
export function sniffLabradarTrack(text) {
  const match = TRACK_HEADER_RE.exec(text);
  if (!match) return null;
  const velUnit = VEL_UNIT_RE.exec(match[0])?.[1];
  if (!velUnit) return null; // can't convert without a declared unit
  const distUnit = DIST_UNIT_RE.exec(match[0])?.[1];
  return { body: match[0], velUnit, distUnit };
}

// Row 1 alone tolerates a missing/non-numeric SNR (it's the device's own
// back-calculated, not measured, t=0 point — see labradar-clean.js's own
// notes) — confirmed against real sample tracks, where that field is
// literally "-". Every other row needs all 4 fields numeric or is
// silently dropped, matching legacy's per-row sanity check exactly.
// Returns null (whole file rejected) if fewer than 4 valid points result.
export function parseLabradarTrack(text) {
  const sniffed = sniffLabradarTrack(text);
  if (!sniffed) return null;

  const lines = sniffed.body.split('\n');
  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    const [tRaw, vRaw, dRaw, snrRaw] = cols;
    if (!isNumericStr(tRaw) || !isNumericStr(vRaw) || !isNumericStr(dRaw)) continue;
    if (i > 1 && !isNumericStr(snrRaw)) continue;

    const t = parseFloat(tRaw);
    const v = Qty(parseFloat(vRaw), sniffed.velUnit).to('m/s').scalar;
    const dist = sniffed.distUnit ? Qty(parseFloat(dRaw), sniffed.distUnit).to('m').scalar : parseFloat(dRaw);
    const snr = isNumericStr(snrRaw) ? parseFloat(snrRaw) : 0;
    const a = snr ? Math.pow(10, snr / 10) : 0;
    points.push({ t, v, dist, snr, a });
  }

  return points.length >= MIN_POINTS ? points : null;
}
