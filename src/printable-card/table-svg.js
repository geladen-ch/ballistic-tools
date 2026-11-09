// The corrections table as SVG for the card template's `table` slot (clip
// mode, so in the template's own user units: 0.01 mm). Geometry below is
// in mm and scaled on output; font sizes come out at 100 units and more,
// as the PDF renderer needs them (tools/pdf-templates/README.md).
//
// Layout: a header band, then one row per entry, as tall as the slot
// allows. Rows of 6 mm and more are stacked (distance above, elevation
// below, the reference column large); shorter rows (a long table) put
// both on one line. Values are right-aligned at a fixed inset from their
// column's right edge, so units digits line up down a column; nothing is
// positioned from a measured text width.
import { escapeXml } from './svg-text.js';

export const UNITS_PER_MM = 100;
const INK = '#111111';
const DIM = '#4d4d4d';
const RULE = '#8c8c8c';
const TARGET_BG = '#e6e6e6';
const HEAD_BG = '#f2f2f2';
const HEAD = 9;
const STACKED_MIN_ROW = 6;
// The row height the stacked layout is drawn for; shorter stacked rows
// scale it down, so the large elevation stays inside its row.
const STACKED_DESIGN_ROW = 7.6;
// The shortest row the one-line layout is drawn for: its fonts stay at
// the sizes the column widths were laid out for.
const MIN_ROW = 3.075;

// How many rows a table slot of this height holds.
export function tableRowCapacity(heightMm) {
  return Math.floor((heightMm - HEAD) / MIN_ROW + 1e-9);
}

const n = (mm) => String(Math.round(mm * UNITS_PER_MM * 10) / 10);

function text(x, y, s, size, { weight = 400, fill = INK, anchor = 'middle' } = {}) {
  if (s === null || s === undefined || s === '') return '';
  return `<text x="${n(x)}" y="${n(y)}" font-family="Overpass" font-size="${n(size)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(s)}</text>`;
}
const rect = (x, y, w, h, attrs) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attrs}/>`;
const line = (x1, y1, x2, y2, stroke, width) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${n(width)}"/>`;

// The fonts' share of their designed sizes: the compact layout's.
const FONT_SCALE = 0.97;

// Column widths (mm) at the slot's full width, and each value's distance
// from its column's right edge. Sized for realistic values at FONT_SCALE:
// elevations up to "U 250" / "U 41.5", slope and temperature cells up to
// "D 11.5", spin drift up to "L 8.5"; larger ones (extreme ranges) shrink
// the whole table's fonts until they fit (see tableSvg's `measure`).
const WIDTH = { tgt: 16, n: 14.2, ref: 16.8, wind: 10.5, spin: 9.6, cell: 7.8 };
const INSET = { n: 2.5, ref: 3.0, wind: 2.5, spin: 1.8, cell: 1.0 };
// Single-line rows: where the distance ends, from the column's left edge.
const DENSE_DISTANCE_END = { n: 5.6, ref: 6.6 };
const GAP = 0.6;
const MARGIN = 0.4;

// `labels`: { target, angle, shorter, longer, distance, distanceUnit,
// wind, windUnit, spin, slope, temperature, temperatureColumns: [5] };
// `rows` from card-data.js; `spin`/`slope`/`temperature`: whether those
// columns are shown. `widthMm`/`heightMm`: the slot's size. `measure`
// (optional, (text, { family, weight }, sizeMm) → mm): with it, the
// fonts shrink further where a value would not fit its room; positions
// stay where they are, so columns stay aligned.
export function tableSvg({ rows, labels, spin, slope, temperature = false, widthMm, heightMm, slopeAngles, measure = null }) {
  const first = layoutTable({ rows, labels, spin, slope, temperature, widthMm, heightMm, slopeAngles, fontScale: FONT_SCALE });
  if (!measure) return first.svg;
  let fit = 1;
  for (const it of first.items) {
    const need = measure(it.s, { family: 'Overpass', weight: it.weight }, it.size);
    if (need > 0 && it.room < need) fit = Math.min(fit, it.room / need);
  }
  if (fit >= 1) return first.svg;
  return layoutTable({ rows, labels, spin, slope, temperature, widthMm, heightMm, slopeAngles, fontScale: FONT_SCALE * fit * 0.99 }).svg;
}

function layoutTable({ rows, labels, spin, slope, temperature, widthMm, heightMm, slopeAngles, fontScale }) {
  const temps = temperature ? (labels.temperatureColumns || []) : [];
  const cols = [['tgt', WIDTH.tgt], ['n2', WIDTH.n], ['n1', WIDTH.n], ['ref', WIDTH.ref], ['p1', WIDTH.n], ['p2', WIDTH.n], ['wind', WIDTH.wind]];
  if (spin) cols.push(['spin', WIDTH.spin]);
  if (slope) for (const a of slopeAngles) cols.push([`a${a}`, WIDTH.cell]);
  temps.forEach((_, i) => cols.push([`t${i}`, WIDTH.cell]));
  const scale = widthMm / cols.reduce((sum, [, w]) => sum + w, 0);
  const x = {};
  let acc = 0;
  for (const [k, w] of cols) { x[k] = { x0: acc, w: w * scale }; acc += w * scale; }
  const cx = (k) => x[k].x0 + x[k].w / 2;
  const right = (k) => x[k].x0 + x[k].w;
  const span = (a, b) => (x[a].x0 + right(b)) / 2;
  const count = Math.max(rows.length, 1);
  const rh = (heightMm - HEAD) / count;
  const stacked = rh >= STACKED_MIN_ROW;
  const sc = Math.min(1, rh / STACKED_DESIGN_ROW);
  const NEIGHBOURS = ['n2', 'n1', 'p1', 'p2'];
  const isCell = (k) => k.startsWith('a') || k.startsWith('t') && k !== 'tgt';
  const insetOf = (k) => (isCell(k) ? INSET.cell : NEIGHBOURS.includes(k) ? INSET.n : INSET[k]);
  const edge = (k) => right(k) - insetOf(k);

  const out = [rect(0, 0, widthMm, heightMm, 'fill="#ffffff"'), rect(0, 0, widthMm, HEAD, `fill="${HEAD_BG}"`)];
  // Every text the fit check looks at: its string, font and the room it has
  // (from its anchor to the nearest thing it must not reach, times two for
  // centred text).
  const items = [];
  const put = (xx, y, str, size, opts, room) => {
    const sz = size * fontScale;
    const t = text(xx, y, str, sz, opts);
    if (!t) return;
    out.push(t);
    if (room !== undefined) items.push({ s: String(str), size: sz, weight: opts.weight || 400, room });
  };
  const centred = (c, a, b) => 2 * Math.min(c - a, b - c) - 2 * MARGIN;
  const head = (c, from, to, a, b) => {
    put(c, 4.0, a, 2.5, { weight: 700 }, centred(c, from, to));
    if (b) put(c, 7.4, b, 2.1, { fill: DIM }, centred(c, from, to));
  };
  head(cx('tgt'), x.tgt.x0, right('tgt'), labels.target, labels.angle);
  head(span('n2', 'n1'), x.n2.x0, right('n1'), labels.shorter, labels.distanceUnit);
  head(cx('ref'), x.ref.x0, right('ref'), labels.distance, labels.distanceUnit);
  head(span('p1', 'p2'), x.p1.x0, right('p2'), labels.longer, labels.distanceUnit);
  head(cx('wind'), x.wind.x0, right('wind'), labels.wind, labels.windUnit);
  if (spin) head(cx('spin'), x.spin.x0, right('spin'), labels.spin, null);
  // A group of value columns (slope, temperature): its title across them,
  // and each column's heading on the edge its values end at, digits under
  // digits; a unit sign (the slope's °) hangs past that edge, into the inset.
  const group = (keys, title, subs, sign = '') => {
    const a = keys[0];
    const b = keys[keys.length - 1];
    put(span(a, b), 4.0, title, 2.5, { weight: 700 }, centred(span(a, b), x[a].x0, right(b)));
    keys.forEach((k, i) => {
      put(edge(k), 7.4, subs[i], 2.1, { fill: DIM, anchor: 'end' }, edge(k) - x[k].x0 - MARGIN);
      // The sign is one fixed glyph (° is 0.83 mm here), inside the 1 mm inset.
      if (sign) put(edge(k), 7.4, sign, 2.1, { fill: DIM, anchor: 'start' });
    });
  };
  if (slope) group(slopeAngles.map((a) => `a${a}`), labels.slope, slopeAngles.map(String), '°');
  if (temps.length) group(temps.map((_, i) => `t${i}`), labels.temperature, temps);

  rows.forEach((row, i) => {
    const y = HEAD + i * rh;
    const mid = y + rh / 2;
    const base = (fs) => mid + fs * fontScale * 0.36;
    if (row.kind === 'target') {
      out.push(rect(0, y, widthMm, rh, `fill="${TARGET_BG}"`));
      const bh = Math.min(4.6, rh - 0.7) * fontScale;
      const bw = bh * 1.75;
      const fs = bh * 0.62 / fontScale;
      const bx = x.tgt.x0 + 1.0;
      out.push(rect(bx, mid - bh / 2, bw, bh, `rx="${n(bh * 0.2)}" fill="${INK}"`));
      put(bx + bw / 2, base(fs), row.id, fs, { weight: 700, fill: '#ffffff' });
      const ax = right('tgt') - 1.0;
      put(ax, base(fs * 0.95), row.angle, fs * 0.95, { weight: 700, anchor: 'end' }, ax - (bx + bw + GAP));
    } else {
      NEIGHBOURS.forEach((k, j) => {
        const cell = row.neighbours[j];
        if (!cell) return;
        if (stacked) {
          put(edge(k), y + 3.1 * sc, cell.distance, 2.4 * sc, { fill: DIM, anchor: 'end' }, edge(k) - x[k].x0 - MARGIN);
          put(edge(k), y + 6.6 * sc, cell.elevation, 3.3 * sc, { anchor: 'end' }, edge(k) - x[k].x0 - MARGIN);
        } else {
          const fs = Math.min(2.6, rh * 0.78);
          const dx = x[k].x0 + DENSE_DISTANCE_END.n;
          put(dx, base(fs * 0.85), cell.distance, fs * 0.85, { fill: DIM, anchor: 'end' }, DENSE_DISTANCE_END.n - MARGIN);
          const ex = right(k) - 0.9;
          put(ex, base(fs), cell.elevation, fs, { anchor: 'end' }, ex - dx - GAP);
        }
      });
      const cells = (keys, values) => {
        if (!values) return;
        const fs = stacked ? 2.6 * sc : Math.min(2.5, rh * 0.75);
        keys.forEach((k, j) => put(edge(k), base(fs), values[j], fs, { anchor: 'end' }, edge(k) - x[k].x0 - MARGIN));
      };
      if (slope) cells(slopeAngles.map((a) => `a${a}`), row.slope);
      if (temps.length) cells(temps.map((_, j) => `t${j}`), row.temperature);
    }
    if (stacked) {
      put(edge('ref'), y + 3.2 * sc, row.distance, 3.0 * sc, { weight: 700, anchor: 'end' }, edge('ref') - x.ref.x0 - MARGIN);
      put(edge('ref'), y + 7.0 * sc, row.elevation, 4.6 * sc, { weight: 700, anchor: 'end' }, edge('ref') - x.ref.x0 - MARGIN);
    } else {
      const fs = Math.min(2.9, rh * 0.85);
      const dx = x.ref.x0 + DENSE_DISTANCE_END.ref;
      put(dx, base(fs * 0.9), row.distance, fs * 0.9, { weight: 700, anchor: 'end' }, DENSE_DISTANCE_END.ref - MARGIN);
      const ex = right('ref') - 1.2;
      put(ex, base(fs), row.elevation, fs, { weight: 700, anchor: 'end' }, ex - dx - GAP);
    }
    const fs = stacked ? 3.6 * sc : Math.min(2.7, rh * 0.8);
    put(edge('wind'), base(fs), row.windage, fs, { weight: 700, anchor: 'end' }, edge('wind') - x.wind.x0 - MARGIN);
    if (spin && row.spin !== null) put(edge('spin'), base(fs * 0.92), row.spin, fs * 0.92, { anchor: 'end' }, edge('spin') - x.spin.x0 - MARGIN);
    out.push(line(0, y + rh, widthMm, y + rh, RULE, stacked ? 0.15 : 0.1));
  });

  const dividers = ['n2', 'wind', ...(spin ? ['spin'] : []), ...(slope ? [`a${slopeAngles[0]}`] : []), ...(temps.length ? ['t0'] : [])];
  for (const k of dividers) out.push(line(x[k].x0, 0, x[k].x0, heightMm, RULE, 0.2));
  for (const xx of [x.ref.x0, right('ref')]) out.push(line(xx, 0, xx, heightMm, INK, 0.6));
  out.push(line(0, HEAD, widthMm, HEAD, INK, 0.4));
  out.push(rect(0, 0, widthMm, heightMm, `fill="none" stroke="${INK}" stroke-width="${n(0.4)}"`));
  return { svg: out.join(''), items };
}
