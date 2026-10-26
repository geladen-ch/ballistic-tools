// SVG path data for the importer and for drawing imported shapes: parsing
// any valid `d` into absolute M/L/Q/C/Z commands (relative commands,
// H/V, the smooth S/T forms and elliptical arcs all rewritten), affine
// transforms, the canonical text form, and flattening into polylines for
// bounds and hit-testing. Pure.
//
// Command shape: { c: 'M' | 'L' | 'Q' | 'C' | 'Z', p: [numbers] } — M/L one
// point, Q control + end, C two controls + end, Z none.
import { ImportError } from './errors.js';
import { degToRad } from '../../quantity.js';

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
// Coordinates beyond this are refused as nonsense rather than drawn.
export const MAX_COORDINATE = 1e7;

function checkNumber(v) {
  if (!Number.isFinite(v) || Math.abs(v) > MAX_COORDINATE) throw new ImportError('badNumber');
  return v;
}

// Elliptical arc (endpoint form, SVG 1.1 implementation notes F.6) →
// cubic Béziers, one per quarter turn at most. Returns C commands.
function arcToCubics(x1, y1, rx, ry, angleDeg, largeArc, sweep, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) return [{ c: 'L', p: [x2, y2] }];
  const phi = degToRad(angleDeg % 360);
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (largeArc === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const parts = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / parts;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (t) => {
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
  };
  const tangent = (t) => {
    const ex = -rx * Math.sin(t);
    const ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  const out = [];
  let t = theta1;
  for (let i = 0; i < parts; i++) {
    const t2 = t + step;
    const [sx, sy] = point(t);
    const [ex, ey] = i === parts - 1 ? [x2, y2] : point(t2);
    const [d1x, d1y] = tangent(t);
    const [d2x, d2y] = tangent(t2);
    out.push({ c: 'C', p: [sx + k * d1x, sy + k * d1y, ex - k * d2x, ey - k * d2y, ex, ey] });
    t = t2;
  }
  return out;
}

// Any valid path data → absolute M/L/Q/C/Z commands. `budget.segments`
// is decremented per command and the parse is refused once it runs out.
export function parsePathData(d, budget = { segments: Infinity }) {
  const out = [];
  let i = 0;
  const n = d.length;
  let cmd = null;
  let cx = 0, cy = 0; // current point
  let sx = 0, sy = 0; // subpath start
  let lastControl = null; // [x, y, kind] of the previous C/S or Q/T control point

  const skip = () => { while (i < n && /[\s,]/.test(d[i])) i++; };
  const number = () => {
    skip();
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(d);
    if (!m) throw new ImportError('badPathData');
    i = NUMBER.lastIndex;
    return checkNumber(Number(m[0]));
  };
  const flag = () => {
    skip();
    const ch = d[i];
    if (ch !== '0' && ch !== '1') throw new ImportError('badPathData');
    i++;
    return ch === '1';
  };
  const push = (command) => {
    budget.segments -= 1;
    if (budget.segments < 0) throw new ImportError('tooComplex');
    out.push(command);
  };

  skip();
  if (i < n && !/[Mm]/.test(d[i])) throw new ImportError('badPathData');
  while (true) {
    skip();
    if (i >= n) break;
    if (/[A-Za-z]/.test(d[i])) {
      cmd = d[i];
      i++;
      if (!(cmd.toUpperCase() in ARGS)) throw new ImportError('badPathData');
    } else if (!cmd || cmd === 'Z' || cmd === 'z') {
      throw new ImportError('badPathData');
    }
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    switch (up) {
      case 'M': {
        const x = number() + ox;
        const y = number() + oy;
        push({ c: 'M', p: [x, y] });
        cx = sx = x; cy = sy = y;
        lastControl = null;
        // Further pairs after a moveto are implicit linetos.
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': {
        const x = number() + ox;
        const y = number() + oy;
        push({ c: 'L', p: [x, y] });
        cx = x; cy = y; lastControl = null;
        break;
      }
      case 'H': {
        const x = number() + ox;
        push({ c: 'L', p: [x, cy] });
        cx = x; lastControl = null;
        break;
      }
      case 'V': {
        const y = number() + oy;
        push({ c: 'L', p: [cx, y] });
        cy = y; lastControl = null;
        break;
      }
      case 'C': case 'S': {
        let x1, y1;
        if (up === 'S') {
          [x1, y1] = lastControl && lastControl[2] === 'C' ? [2 * cx - lastControl[0], 2 * cy - lastControl[1]] : [cx, cy];
        } else {
          x1 = number() + ox; y1 = number() + oy;
        }
        const x2 = number() + ox, y2 = number() + oy;
        const x = number() + ox, y = number() + oy;
        push({ c: 'C', p: [x1, y1, x2, y2, x, y] });
        lastControl = [x2, y2, 'C'];
        cx = x; cy = y;
        break;
      }
      case 'Q': case 'T': {
        let x1, y1;
        if (up === 'T') {
          [x1, y1] = lastControl && lastControl[2] === 'Q' ? [2 * cx - lastControl[0], 2 * cy - lastControl[1]] : [cx, cy];
        } else {
          x1 = number() + ox; y1 = number() + oy;
        }
        const x = number() + ox, y = number() + oy;
        push({ c: 'Q', p: [x1, y1, x, y] });
        lastControl = [x1, y1, 'Q'];
        cx = x; cy = y;
        break;
      }
      case 'A': {
        const rx = number(), ry = number(), angle = number();
        const large = flag(), sweep = flag();
        const x = number() + ox, y = number() + oy;
        for (const seg of arcToCubics(cx, cy, rx, ry, angle, large, sweep, x, y)) push(seg);
        cx = x; cy = y; lastControl = null;
        break;
      }
      case 'Z': {
        push({ c: 'Z', p: [] });
        cx = sx; cy = sy; lastControl = null;
        break;
      }
      default:
        throw new ImportError('badPathData');
    }
  }
  return out;
}

// Affine matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f.
export const IDENTITY = [1, 0, 0, 1, 0, 0];

export function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}

// Béziers and lines are affine-invariant, so transforming the points is
// exact (arcs were already turned into Béziers).
export function transformCommands(commands, m) {
  if (m === IDENTITY) return commands;
  return commands.map(({ c, p }) => {
    const q = [];
    for (let k = 0; k < p.length; k += 2) {
      q.push(checkNumber(m[0] * p[k] + m[2] * p[k + 1] + m[4]), checkNumber(m[1] * p[k] + m[3] * p[k + 1] + m[5]));
    }
    return { c, p: q };
  });
}

function fmt(v) {
  const s = String(Number(v.toPrecision(7)));
  return s === '-0' ? '0' : s;
}

// Canonical text form: absolute commands, numbers to 7 significant digits.
export function formatCommands(commands) {
  return commands.map(({ c, p }) => c + p.map(fmt).join(' ')).join('');
}

const CURVE_STEPS = 12;

// Commands → subpaths as polylines ([[x, y], ...], plus `closed`), curves
// cut into CURVE_STEPS straight pieces — fine for bounds and hit-testing.
export function flattenCommands(commands) {
  const subpaths = [];
  let current = null;
  let cx = 0, cy = 0;
  for (const { c, p } of commands) {
    if (c === 'M') {
      current = { points: [[p[0], p[1]]], closed: false };
      subpaths.push(current);
      cx = p[0]; cy = p[1];
      continue;
    }
    if (!current) {
      current = { points: [[cx, cy]], closed: false };
      subpaths.push(current);
    }
    if (c === 'Z') {
      current.closed = true;
      const [x0, y0] = current.points[0];
      cx = x0; cy = y0;
      current = null;
      continue;
    }
    if (c === 'L') {
      current.points.push([p[0], p[1]]);
    } else if (c === 'Q') {
      for (let k = 1; k <= CURVE_STEPS; k++) {
        const t = k / CURVE_STEPS, u = 1 - t;
        current.points.push([u * u * cx + 2 * u * t * p[0] + t * t * p[2], u * u * cy + 2 * u * t * p[1] + t * t * p[3]]);
      }
    } else if (c === 'C') {
      for (let k = 1; k <= CURVE_STEPS; k++) {
        const t = k / CURVE_STEPS, u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
        current.points.push([a * cx + b * p[0] + d * p[2] + e * p[4], a * cy + b * p[1] + d * p[3] + e * p[5]]);
      }
    }
    cx = p[p.length - 2]; cy = p[p.length - 1];
  }
  return subpaths;
}

// Ink extents of one path from its flattened subpaths: the outline itself
// when filled, plus the stroke — each segment widened square to its own
// direction, caps added only at open ends (none for butt, a half-square
// for square, a half-disc for round), and joins at corners (a disc for
// round; the miter tip, within the miter limit, for miter). Returns
// [x0, y0, x1, y1] or null for a path with no ink.
export function inkBounds(subpaths, { fill = false, stroke = 0, cap = 'butt', join = 'miter', miter = 4 } = {}) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  const h = stroke / 2;
  for (const { points, closed } of subpaths) {
    if (fill) for (const [x, y] of points) add(x, y);
    if (!(h > 0)) continue;
    // Consecutive duplicate points carry no direction.
    const pts = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
    if (closed && pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    if (pts.length === 1) {
      // A zero-length subpath shows only as a round or square dot.
      const [x, y] = pts[0];
      if (cap !== 'butt') { add(x - h, y - h); add(x + h, y + h); }
      continue;
    }
    const segs = [];
    const count = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < count; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const n = [-t[1] * h, t[0] * h];
      add(a[0] + n[0], a[1] + n[1]); add(a[0] - n[0], a[1] - n[1]);
      add(b[0] + n[0], b[1] + n[1]); add(b[0] - n[0], b[1] - n[1]);
      segs.push({ a, b, t });
    }
    if (!closed) {
      for (const [p, dir] of [[pts[0], segs[0].t.map((v) => -v)], [pts[pts.length - 1], segs[segs.length - 1].t]]) {
        if (cap === 'round') { add(p[0] - h, p[1] - h); add(p[0] + h, p[1] + h); }
        if (cap === 'square') {
          const n = [-dir[1] * h, dir[0] * h];
          const e = [p[0] + dir[0] * h, p[1] + dir[1] * h];
          add(e[0] + n[0], e[1] + n[1]); add(e[0] - n[0], e[1] - n[1]);
        }
      }
    }
    const corners = closed ? segs.length : segs.length - 1;
    for (let i = 0; i < corners; i++) {
      const s1 = segs[i];
      const s2 = segs[(i + 1) % segs.length];
      const v = s1.b;
      if (join === 'round') { add(v[0] - h, v[1] - h); add(v[0] + h, v[1] + h); continue; }
      if (join !== 'miter') continue;
      const cross = s1.t[0] * s2.t[1] - s1.t[1] * s2.t[0];
      const dot = s1.t[0] * s2.t[0] + s1.t[1] * s2.t[1];
      if (Math.abs(cross) < 1e-12) continue;
      // The outer side's normals; the miter tip is where their offset
      // lines meet, kept only within the miter limit.
      const side = cross > 0 ? -1 : 1;
      const n1 = [-s1.t[1] * side, s1.t[0] * side];
      const n2 = [-s2.t[1] * side, s2.t[0] * side];
      const cosHalf = Math.sqrt((1 + dot) / 2);
      if (cosHalf > 0 && 1 / cosHalf <= miter) {
        const k = h / (1 + (n1[0] * n2[0] + n1[1] * n2[1]));
        add(v[0] + (n1[0] + n2[0]) * k, v[1] + (n1[1] + n2[1]) * k);
      }
    }
  }
  return x1 >= x0 && y1 >= y0 ? [x0, y0, x1, y1] : null;
}
