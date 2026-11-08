// The location photo with its targets marked, for the card template's
// `photo` slot (clip mode: template units, 0.01 mm), and the ruled notes
// that fill a media box left out.
//
// The photo is cropped to a box round every placed target (with room for
// their badges), widened to the photo area's proportions and kept inside
// the image; with no placed target, the whole image is fitted. Each target
// is a ring with a white halo, a leader and a black badge with its ID —
// legible on any background and in a grey print. Badges are placed so
// they don't overlap each other or another target's ring: each takes the
// first free spot of a fixed list round its target. A legend beside the
// photo lists each target: ID, distance and angle, name (its tail clipped
// at the slot's edge when long).
import { escapeXml } from './svg-text.js';
import { UNITS_PER_MM } from './table-svg.js';

const INK = '#111111';
const DIM = '#4d4d4d';
const RULE = '#b3b3b3';
// The legend: its width, and its badges and text at this fraction of the
// photo's (title 2.6 mm): room for the longest title, e.g. "1095 yd · −12°".
const LEGEND_MM = 29;
const LEGEND_SCALE = 0.867;
const BADGE_W = 7.2;
const BADGE_H = 4.6;
const RING = 1.3;
// Badge centres relative to the target, in mm, in order of preference.
const BADGE_SPOTS = [[0, -7], [0, 7], [7, -6], [-7, -6], [7, 6], [-7, 6], [9, 0], [-9, 0], [0, -12], [0, 12]];

const n = (mm) => String(Math.round(mm * UNITS_PER_MM * 10) / 10);

function text(x, y, s, size, { weight = 400, fill = INK, anchor = 'start' } = {}) {
  if (!s) return '';
  return `<text x="${n(x)}" y="${n(y)}" font-family="Overpass" font-size="${n(size)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(s)}</text>`;
}

// The source box to show, in image pixels: { x0, y0, x1, y1 }.
export function cropBox({ imageWidth, imageHeight, points, areaAspect, padFraction = 0.06 }) {
  if (!points.length) return { x0: 0, y0: 0, x1: imageWidth, y1: imageHeight, fit: true };
  const pad = padFraction * Math.max(imageWidth, imageHeight);
  let x0 = Math.min(...points.map((p) => p.x)) - pad;
  let x1 = Math.max(...points.map((p) => p.x)) + pad;
  let y0 = Math.min(...points.map((p) => p.y)) - 2 * pad;
  let y1 = Math.max(...points.map((p) => p.y)) + pad;
  if ((x1 - x0) / (y1 - y0) < areaAspect) {
    const g = (y1 - y0) * areaAspect - (x1 - x0); x0 -= g / 2; x1 += g / 2;
  } else {
    const g = (x1 - x0) / areaAspect - (y1 - y0); y0 -= g / 2; y1 += g / 2;
  }
  // Larger than the image: the whole image, fitted.
  if (x1 - x0 > imageWidth || y1 - y0 > imageHeight) return { x0: 0, y0: 0, x1: imageWidth, y1: imageHeight, fit: true };
  if (x0 < 0) { x1 -= x0; x0 = 0; }
  if (x1 > imageWidth) { x0 -= x1 - imageWidth; x1 = imageWidth; }
  if (y0 < 0) { y1 -= y0; y0 = 0; }
  if (y1 > imageHeight) { y0 -= y1 - imageHeight; y1 = imageHeight; }
  return { x0, y0, x1, y1, fit: false };
}

const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// Badge centres for target points (mm, in the photo area), avoiding each
// other and every ring, inside the area where possible.
export function placeBadges(points, areaW, areaH) {
  const rings = points.map((p) => ({ x0: p.x - RING - 0.5, x1: p.x + RING + 0.5, y0: p.y - RING - 0.5, y1: p.y + RING + 0.5 }));
  const taken = [];
  return points.map((p) => {
    const box = ([dx, dy]) => ({
      x0: p.x + dx - BADGE_W / 2 - 0.4, x1: p.x + dx + BADGE_W / 2 + 0.4, y0: p.y + dy - BADGE_H / 2 - 0.4, y1: p.y + dy + BADGE_H / 2 + 0.4
    });
    const inside = (b) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= areaW && b.y1 <= areaH;
    const free = (b) => !taken.some((t) => overlaps(t, b)) && !rings.some((r) => overlaps(r, b));
    const spot = BADGE_SPOTS.find((s) => { const b = box(s); return inside(b) && free(b); })
      || BADGE_SPOTS.find((s) => free(box(s)))
      || BADGE_SPOTS[0];
    taken.push(box(spot));
    return { x: p.x + spot[0], y: p.y + spot[1] };
  });
}

// `photo`: { href (data URL), width, height } in pixels; `targets`: [{ id,
// coords: { x, y } fractions or null, title, subtitle }] in legend order.
export function photoSvg({ photo, targets, widthMm, heightMm, idPrefix = 'card-photo' }) {
  const areaW = widthMm - LEGEND_MM;
  const placed = targets.filter((tg) => tg.coords);
  const box = cropBox({
    imageWidth: photo.width, imageHeight: photo.height,
    points: placed.map((tg) => ({ x: tg.coords.x * photo.width, y: tg.coords.y * photo.height })),
    areaAspect: areaW / heightMm
  });
  const s = Math.min(areaW / (box.x1 - box.x0), heightMm / (box.y1 - box.y0));
  const shownW = (box.x1 - box.x0) * s;
  const shownH = (box.y1 - box.y0) * s;
  const offX = (areaW - shownW) / 2;
  const offY = (heightMm - shownH) / 2;
  const clipId = `${idPrefix}-crop`;
  const legendClipId = `${idPrefix}-legend`;
  const out = [
    `<rect x="0" y="0" width="${n(widthMm)}" height="${n(heightMm)}" fill="#ffffff"/>`,
    `<clipPath id="${clipId}"><rect x="${n(offX)}" y="${n(offY)}" width="${n(shownW)}" height="${n(shownH)}"/></clipPath>`,
    `<clipPath id="${legendClipId}"><rect x="${n(areaW)}" y="0" width="${n(LEGEND_MM)}" height="${n(heightMm)}"/></clipPath>`,
    `<g clip-path="url(#${clipId})"><image x="${n(offX - box.x0 * s)}" y="${n(offY - box.y0 * s)}" width="${n(photo.width * s)}" height="${n(photo.height * s)}" preserveAspectRatio="none" href="${photo.href}"/></g>`,
    `<line x1="${n(areaW)}" y1="0" x2="${n(areaW)}" y2="${n(heightMm)}" stroke="${INK}" stroke-width="${n(0.3)}"/>`
  ];
  const points = placed.map((tg) => ({ x: offX + (tg.coords.x * photo.width - box.x0) * s, y: offY + (tg.coords.y * photo.height - box.y0) * s }));
  const badges = placeBadges(points, areaW, heightMm);
  placed.forEach((tg, i) => {
    const p = points[i];
    const b = badges[i];
    const len = Math.hypot(b.x - p.x, b.y - p.y) || 1;
    const ex = p.x + (b.x - p.x) / len * RING;
    const ey = p.y + (b.y - p.y) / len * RING;
    for (const [stroke, w] of [['#ffffff', 1.0], [INK, 0.35]]) {
      out.push(`<line x1="${n(ex)}" y1="${n(ey)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="${stroke}" stroke-width="${n(w)}"/>`);
    }
    out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(RING)}" fill="none" stroke="#ffffff" stroke-width="${n(0.9)}"/>`);
    out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(RING)}" fill="none" stroke="${INK}" stroke-width="${n(0.35)}"/>`);
    out.push(`<rect x="${n(b.x - BADGE_W / 2)}" y="${n(b.y - BADGE_H / 2 + 0.2)}" width="${n(BADGE_W)}" height="${n(BADGE_H)}" rx="${n(1)}" fill="${INK}" stroke="#ffffff" stroke-width="${n(0.5)}"/>`);
    out.push(text(b.x, b.y + 1.25, tg.id, 3.0, { weight: 700, fill: '#ffffff', anchor: 'middle' }));
  });
  const legend = [];
  const lx = areaW + 2.5;
  const fullPitch = 7 * LEGEND_SCALE;
  const pitch = Math.min(fullPitch, (heightMm - 4) / Math.max(targets.length, 1));
  const scale = LEGEND_SCALE * Math.min(1, pitch / fullPitch);
  targets.forEach((tg, i) => {
    const y = 3 + i * pitch;
    legend.push(`<rect x="${n(lx)}" y="${n(y)}" width="${n(BADGE_W * scale)}" height="${n(BADGE_H * scale)}" rx="${n(scale)}" fill="${INK}"/>`);
    legend.push(text(lx + BADGE_W * scale / 2, y + 3.45 * scale, tg.id, 3.0 * scale, { weight: 700, fill: '#ffffff', anchor: 'middle' }));
    legend.push(text(lx + (BADGE_W + 1.6) * scale, y + 3.4 * scale, tg.title, 3.0 * scale, { weight: 700 }));
    legend.push(text(lx + (BADGE_W + 1.6) * scale, y + 6.3 * scale, tg.subtitle, 2.3 * scale, { fill: DIM }));
  });
  out.push(`<g clip-path="url(#${legendClipId})">${legend.join('')}</g>`);
  return out.join('');
}

// Ruled lines for notes, filling a box (clip mode: template units).
export function notesSvg({ widthMm, heightMm, pitchMm = 7 }) {
  const out = [`<rect x="0" y="0" width="${n(widthMm)}" height="${n(heightMm)}" fill="#ffffff"/>`];
  for (let y = pitchMm; y < heightMm - 1; y += pitchMm) {
    out.push(`<line x1="${n(3)}" y1="${n(y)}" x2="${n(widthMm - 3)}" y2="${n(y)}" stroke="${RULE}" stroke-width="${n(0.2)}"/>`);
  }
  return out.join('');
}
