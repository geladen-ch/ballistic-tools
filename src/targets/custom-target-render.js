// Geometry and artwork generation for the two user-sizeable targets
// (Circle gong, Rectangle plate). Every other target's widthM/heightM/
// aspectRatio/resultSvg and its -detail.svg/-result.svg files are fixed at
// build time; these two instead take their dimensions from the user's own
// input (see hit-probability-view.js's diameter/width/height fields), so
// their geometry and artwork have to be derived here at render time
// instead. The result SVG follows the same 1-unit-= 1mm convention
// (pxPerMeter: 1000) every other target's resultSvg uses; the detail SVG
// follows the same non-to-scale schematic convention the static
// -detail.svg files use (see e.g. the old plate-40x60-detail.svg: a fixed
// 120x180 rect for a real 400x600mm plate) — only the dimension label is
// ever the real value.

// Schematic drawing conventions shared with the (now-static) -detail.svg
// files this replaces: a 300x280 viewBox, the shape centered on the point
// of aim at (150,110), capped at 180 schematic units in its longer
// dimension, with the dimension line(s)/label positioned the same way
// circle-100mm-detail.svg and plate-40x60-detail.svg always did.
const DETAIL_CENTER_X = 150;
const DETAIL_CENTER_Y = 110;
const DETAIL_MAX_EXTENT = 180;
const DETAIL_DIM_LINE_Y = 215;
const DETAIL_DIM_LINE_GAP = 15;
const DETAIL_LABEL_Y = 250;
const DETAIL_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
const DETAIL_SHAPE_COLOR = '#7c8790';
const DETAIL_AIM_COLOR = '#e8a33d';
const DETAIL_LABEL_COLOR = '#d9e0e6';

// Real-scale (1 unit = 1mm) result-artwork conventions carried over from
// circle-100mm-result.svg (solid filled disk) and plate-40x60-result.svg
// (outline only, inset so the stroke doesn't clip) — stroke width and
// inset stay fixed in real mm (a physical board-edge thickness), not
// scaled with the target's own size.
const RESULT_RECT_STROKE_MM = 6;
const RESULT_RECT_INSET_MM = 3;

export function circleGongGeometry(diameterCm) {
  const diameterMm = diameterCm * 10;
  return {
    widthM: diameterCm / 100,
    heightM: diameterCm / 100,
    aspectRatio: 1,
    resultSvg: { pointOfAim: { x: diameterMm / 2, y: diameterMm / 2 }, pxPerMeter: 1000 }
  };
}

export function rectPlateGeometry(widthCm, heightCm) {
  const widthMm = widthCm * 10;
  const heightMm = heightCm * 10;
  return {
    widthM: widthCm / 100,
    heightM: heightCm / 100,
    aspectRatio: heightCm / widthCm,
    resultSvg: { pointOfAim: { x: widthMm / 2, y: heightMm / 2 }, pxPerMeter: 1000 }
  };
}

export function circleGongResultSvg(diameterMm) {
  const r = diameterMm / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${diameterMm} ${diameterMm}"><circle cx="${r}" cy="${r}" r="${r}" fill="#000000"/></svg>`;
}

export function rectPlateResultSvg(widthMm, heightMm) {
  const x = RESULT_RECT_INSET_MM;
  const w = widthMm - RESULT_RECT_INSET_MM * 2;
  const h = heightMm - RESULT_RECT_INSET_MM * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthMm} ${heightMm}"><rect x="${x}" y="${x}" width="${w}" height="${h}" fill="none" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="${RESULT_RECT_STROKE_MM}"/></svg>`;
}

function detailPointOfAimMarkup() {
  return `
  <line x1="${DETAIL_CENTER_X - 8}" y1="${DETAIL_CENTER_Y}" x2="${DETAIL_CENTER_X + 8}" y2="${DETAIL_CENTER_Y}" stroke="${DETAIL_AIM_COLOR}" stroke-width="1.6"/>
  <line x1="${DETAIL_CENTER_X}" y1="${DETAIL_CENTER_Y - 8}" x2="${DETAIL_CENTER_X}" y2="${DETAIL_CENTER_Y + 8}" stroke="${DETAIL_AIM_COLOR}" stroke-width="1.6"/>`;
}

function detailLabelMarkup(label) {
  return `\n  <text x="${DETAIL_CENTER_X}" y="${DETAIL_LABEL_Y}" text-anchor="middle" fill="${DETAIL_LABEL_COLOR}" font-size="20" font-weight="600">${label}</text>`;
}

export function circleGongDetailSvg(label) {
  const r = DETAIL_MAX_EXTENT / 2;
  const x0 = DETAIL_CENTER_X - r;
  const x1 = DETAIL_CENTER_X + r;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 280" font-family="${DETAIL_FONT_FAMILY}">
  <circle cx="${DETAIL_CENTER_X}" cy="${DETAIL_CENTER_Y}" r="${r}" fill="none" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="2"/>${detailPointOfAimMarkup()}
  <line x1="${x0}" y1="${DETAIL_DIM_LINE_Y}" x2="${x1}" y2="${DETAIL_DIM_LINE_Y}" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="1"/>
  <line x1="${x0}" y1="${DETAIL_DIM_LINE_Y - 5}" x2="${x0}" y2="${DETAIL_DIM_LINE_Y + 5}" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="1"/>
  <line x1="${x1}" y1="${DETAIL_DIM_LINE_Y - 5}" x2="${x1}" y2="${DETAIL_DIM_LINE_Y + 5}" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="1"/>${detailLabelMarkup(label)}
</svg>`;
}

export function rectPlateDetailSvg(widthMm, heightMm, label) {
  const scale = Math.min(DETAIL_MAX_EXTENT / widthMm, DETAIL_MAX_EXTENT / heightMm);
  const w = widthMm * scale;
  const h = heightMm * scale;
  const x0 = DETAIL_CENTER_X - w / 2;
  const x1 = DETAIL_CENTER_X + w / 2;
  const y0 = DETAIL_CENTER_Y - h / 2;
  const y1 = DETAIL_CENTER_Y + h / 2;
  const heightLineX = x1 + DETAIL_DIM_LINE_GAP;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 280" font-family="${DETAIL_FONT_FAMILY}">
  <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="2"/>${detailPointOfAimMarkup()}
  <line x1="${x0}" y1="${DETAIL_DIM_LINE_Y}" x2="${x1}" y2="${DETAIL_DIM_LINE_Y}" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="1"/>
  <line x1="${x0}" y1="${DETAIL_DIM_LINE_Y - 5}" x2="${x0}" y2="${DETAIL_DIM_LINE_Y + 5}" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="1"/>
  <line x1="${x1}" y1="${DETAIL_DIM_LINE_Y - 5}" x2="${x1}" y2="${DETAIL_DIM_LINE_Y + 5}" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="1"/>
  <line x1="${heightLineX}" y1="${y0}" x2="${heightLineX}" y2="${y1}" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="1"/>
  <line x1="${heightLineX - 5}" y1="${y0}" x2="${heightLineX + 5}" y2="${y0}" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="1"/>
  <line x1="${heightLineX - 5}" y1="${y1}" x2="${heightLineX + 5}" y2="${y1}" stroke="${DETAIL_SHAPE_COLOR}" stroke-width="1"/>${detailLabelMarkup(label)}
</svg>`;
}
