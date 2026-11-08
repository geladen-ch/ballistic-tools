// Page size of a PDF template, read from the root <svg>'s width/height.
// The template states its size in an absolute unit; it is held in metres
// like every other length in the app, and turned into PDF points only when
// the PDF is written (template-pdf.js).
import { mmToM, cmToM, inToM, pointToM } from '../quantity.js';

const TO_M = { mm: mmToM, cm: cmToM, in: inToM, pt: pointToM };

// Metres from an SVG length such as "210mm" or "8.5in". Unitless lengths
// and px are rejected: their physical size is undefined (CSS px is 1/96 in,
// but authoring tools disagree), and the page size must not be a guess.
export function parseSvgLengthM(value) {
  const m = /^\s*([0-9]*\.?[0-9]+(?:[eE][-+]?\d+)?)\s*(mm|cm|in|pt)\s*$/.exec(String(value ?? ''));
  if (!m) throw new Error(`length "${value}" must be a number with mm, cm, in or pt`);
  return TO_M[m[2]](Number(m[1]));
}

export function pageSizeM(widthAttr, heightAttr) {
  return { widthM: parseSvgLengthM(widthAttr), heightM: parseSvgLengthM(heightAttr) };
}

// Pages of one PDF share a size; 1 µm absorbs float noise from different
// units describing the same paper (210mm vs 21cm).
const SAME_SIZE_TOLERANCE_M = 1e-6;

export function sameSize(a, b) {
  return Math.abs(a.widthM - b.widthM) <= SAME_SIZE_TOLERANCE_M &&
    Math.abs(a.heightM - b.heightM) <= SAME_SIZE_TOLERANCE_M;
}
