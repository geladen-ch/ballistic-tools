// Lays out a number element's digits from the outlines in
// vendor/reticle-digits: where each glyph goes, in radians, and the
// bounds of the ink. Pure — no DOM.
//
// The outlines are in figure-height units (height 1, baseline 0, y down),
// so a glyph is placed by its origin and drawn scaled by the digit height.
// The anchor aligns the ink, not the advance boxes, so a right-anchored
// number ends exactly at its x whatever the font's side bearings.
import { DIGIT_FONTS } from '../vendor/reticle-digits/digit-glyphs.js';
import { DEFAULT_DIGIT_FONT } from './element-types.js';

export function digitFont(id) {
  return DIGIT_FONTS[id] || DIGIT_FONTS[DEFAULT_DIGIT_FONT];
}

// { glyphs: [{ d, x, y }] (x, y: the glyph's origin — baseline, left of its
// advance box — in rad), scale (rad per outline unit), bounds } for a
// number element; null when there is nothing to draw.
export function layoutNumber(element) {
  const font = digitFont(element.font);
  const chars = [...String(element.text || '')].filter((c) => font.glyphs[c]);
  const h = element.digitHeight;
  if (chars.length === 0 || !(h > 0)) return null;
  let pen = 0;
  const placed = chars.map((c) => {
    const glyph = font.glyphs[c];
    const at = { glyph, origin: pen };
    pen += glyph.advance;
    return at;
  });
  const inkLeft = placed[0].origin + placed[0].glyph.bbox[0];
  const last = placed[placed.length - 1];
  const inkRight = last.origin + last.glyph.bbox[2];
  const shift = element.anchor === 'left' ? -inkLeft : element.anchor === 'right' ? -inkRight : -(inkLeft + inkRight) / 2;
  // y is the vertical middle of the figures: the baseline sits half a
  // digit height below it.
  const baseline = element.y + h / 2;
  const glyphs = placed.map(({ glyph, origin }) => ({ d: glyph.d, x: element.x + (origin + shift) * h, y: baseline }));
  const ys = placed.flatMap(({ glyph }) => [glyph.bbox[1], glyph.bbox[3]]);
  return {
    glyphs,
    scale: h,
    bounds: {
      minX: element.x + (inkLeft + shift) * h,
      maxX: element.x + (inkRight + shift) * h,
      minY: baseline + Math.min(...ys) * h,
      maxY: baseline + Math.max(...ys) * h
    }
  };
}
