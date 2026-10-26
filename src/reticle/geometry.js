// Element records → drawable primitives, in radians, plus the mirror and
// repeat expansion and hit-testing. Pure — no DOM; the reticle view maps
// these to pixels itself.
//
// Primitives (all filled, y positive down):
//   { kind: 'polygon', points: [[x, y], ...] }
//   { kind: 'disk', cx, cy, r }
//   { kind: 'ring', cx, cy, rOuter, rInner }
//   { kind: 'arcBand', cx, cy, rOuter, rInner, gapCenter, gap }
//   { kind: 'text', glyphs: [{ d, x, y }], scale, bounds }
//   { kind: 'svg', paths, x, y, scale, flip, bounds }
// An arcBand is a ring with a radial cut of angular size `gap` centred on
// direction `gapCenter` (screen angle, atan2(y, x) with y down, so π/2 is
// straight down). A text primitive is a number's digit outlines (`d` in
// figure-height units, see digit-text.js), each placed at its origin
// (x, y) and scaled by `scale`; it is hit-tested by its ink bounds.
import { ELEMENT_TYPES, axisOf, endKeyOf, staysOnVerticalAxis } from './element-types.js';
import { layoutNumber } from './digit-text.js';
import { parsePathData, flattenCommands } from './svg-import/path-data.js';

const REPEAT_OFFSETS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0]
};

// A BDC mark moves only along the vertical axis it sits on.
export function translateRecord(element, dx, dy) {
  const moved = { ...element, x: staysOnVerticalAxis(element.type) ? element.x : element.x + dx, y: element.y + dy };
  if ('endX' in element) moved.endX = element.endX + dx;
  if ('endY' in element) moved.endY = element.endY + dy;
  return moved;
}

// Reflection about the vertical axis through zero. Every current type is
// either symmetric about its own vertical axis (dots, circles, horseshoes,
// chevrons) or fully described by its two ends, so reflecting the
// coordinates is enough; an asymmetric type added later must also flip its
// own shape here. A number's digits are not mirrored — they must still
// read — but its anchor is: a number ending at x = 2 starts at x = -2.
const MIRRORED_ANCHOR = { left: 'right', right: 'left', centre: 'centre' };
export function mirrorRecord(element) {
  const mirrored = { ...element, x: -element.x };
  if ('endX' in element) mirrored.endX = -element.endX;
  if (element.type === 'number') mirrored.anchor = MIRRORED_ANCHOR[element.anchor] || element.anchor;
  // An SVG shape is reflected only when its `reflect` option is on;
  // otherwise its copy keeps the original orientation.
  if (element.type === 'svg' && element.reflect) mirrored.reflected = !element.reflected;
  return mirrored;
}

// Every drawn copy of an element: the original first, then its repeats,
// then the mirror of each. `role` is 'original' for the element itself
// and 'derived' for every copy, which stay linked to it rather than
// being elements of their own.
export function expandInstances(element) {
  const base = [{ role: 'original', record: element }];
  const repeat = element.repeat;
  if (repeat?.enabled && repeat.count >= 1 && repeat.step > 0) {
    const [ux, uy] = REPEAT_OFFSETS[repeat.direction] || REPEAT_OFFSETS.down;
    for (let k = 1; k <= repeat.count; k++) {
      base.push({ role: 'derived', record: translateRecord(element, ux * k * repeat.step, uy * k * repeat.step) });
    }
  }
  if (!element.mirror) return base;
  return [...base, ...base.map(({ record }) => ({ role: 'derived', record: mirrorRecord(record) }))];
}

function segmentPolygon(element) {
  const horizontal = axisOf(element) === 'x';
  const s = horizontal ? element.x : element.y;
  const e = element[endKeyOf(element)];
  const c = horizontal ? element.y : element.x;
  // Builds in (along, across) and swaps for vertical elements.
  const point = (along, across) => (horizontal ? [along, c + across] : [c + across, along]);
  if (element.type === 'hline' || element.type === 'vline') {
    const h = element.width / 2;
    return [point(s, -h), point(e, -h), point(e, h), point(s, h)];
  }
  // Thinning bar: end width at the start, widening linearly to the
  // nominal width over the thinning length, then nominal to the end. A
  // bar shorter than its thinning length is cut off mid-taper.
  const length = Math.abs(e - s);
  const dir = e >= s ? 1 : -1;
  const taper = Math.min(element.thinningLength, length);
  const widthAtTaperEnd = element.thinningLength > 0
    ? element.endWidth + (element.nominalWidth - element.endWidth) * (taper / element.thinningLength)
    : element.nominalWidth;
  const h0 = element.endWidth / 2;
  const h1 = widthAtTaperEnd / 2;
  const t = s + dir * taper;
  const points = [point(s, -h0), point(t, -h1)];
  if (length > taper) points.push(point(e, -h1), point(e, h1));
  points.push(point(t, h1), point(s, h0));
  return points;
}

// Chevron pointing up, apex at (x, y). Arms run from the apex to the two
// bottom corners of its overall width × height box; `lineWidth` is the
// arms' thickness measured square to the arm. Too thick for its box, it
// fills in to a solid triangle.
function chevronPolygon(element) {
  const { x, y, overallWidth: w, height: h, lineWidth: lw } = element;
  const half = w / 2;
  const armLength = Math.hypot(half, h);
  const sinPhi = half / armLength; // half-angle at the apex
  const cosPhi = h / armLength;
  const innerApexDrop = lw / sinPhi;
  const innerInset = lw / cosPhi;
  if (innerApexDrop >= h || innerInset >= half) {
    return [[x, y], [x + half, y + h], [x - half, y + h]];
  }
  return [
    [x, y],
    [x + half, y + h],
    [x + half - innerInset, y + h],
    [x, y + innerApexDrop],
    [x - half + innerInset, y + h],
    [x - half, y + h]
  ];
}

export function recordPrimitives(element) {
  switch (element.type) {
    case 'hline':
    case 'vline':
    case 'hbar':
    case 'vbar':
      return [{ kind: 'polygon', points: segmentPolygon(element) }];
    case 'dot':
      return [{ kind: 'disk', cx: element.x, cy: element.y, r: element.diameter / 2 }];
    case 'circle':
      return [element.innerDiameter > 0
        ? { kind: 'ring', cx: element.x, cy: element.y, rOuter: element.outerDiameter / 2, rInner: element.innerDiameter / 2 }
        : { kind: 'disk', cx: element.x, cy: element.y, r: element.outerDiameter / 2 }];
    case 'horseshoe':
      return [{
        kind: 'arcBand', cx: element.x, cy: element.y,
        rOuter: element.outerDiameter / 2, rInner: element.innerDiameter / 2,
        gapCenter: Math.PI / 2, gap: element.cutoutAngle
      }];
    case 'chevron':
      return [{ kind: 'polygon', points: chevronPolygon(element) }];
    case 'number': {
      const layout = layoutNumber(element);
      return layout ? [{ kind: 'text', ...layout }] : [];
    }
    case 'svg': {
      const [bx0, by0, bx1, by1] = element.shape.bounds;
      const s = element.scale;
      const flip = Boolean(element.reflected);
      const xa = element.x + (flip ? -bx1 : bx0) * s;
      const xb = element.x + (flip ? -bx0 : bx1) * s;
      return [{
        kind: 'svg', paths: element.shape.paths, x: element.x, y: element.y, scale: s, flip,
        bounds: { minX: xa, maxX: xb, minY: element.y + by0 * s, maxY: element.y + by1 * s }
      }];
    }
    // A BDC mark is not part of the drawn reticle: the view shows it as a
    // marker of fixed screen size, like the zero mark.
    case 'bdc':
    default:
      return [];
  }
}

// Every primitive of an element, each tagged with the role of the copy it
// belongs to.
export function elementPrimitives(element) {
  if (!ELEMENT_TYPES[element.type]) return [];
  return expandInstances(element).flatMap(({ role, record }) =>
    recordPrimitives(record).map((primitive) => ({ ...primitive, role })));
}

export function primitiveBounds(p) {
  if (p.kind === 'text' || p.kind === 'svg') return { ...p.bounds };
  if (p.kind === 'polygon') {
    const xs = p.points.map((pt) => pt[0]);
    const ys = p.points.map((pt) => pt[1]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  const r = p.kind === 'disk' ? p.r : p.rOuter;
  return { minX: p.cx - r, maxX: p.cx + r, minY: p.cy - r, maxY: p.cy + r };
}

function pointInPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Smallest absolute difference between two angles.
function angleGap(a, b) {
  const d = Math.abs(((a - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  return d;
}

// Whether (px, py) falls on the primitive, or within `tolerance` of it —
// the tolerance keeps hairlines and tiny dots clickable at any zoom.
export function primitiveHit(p, px, py, tolerance = 0) {
  if (p.kind === 'svg') return svgHit(p, px, py, tolerance);
  if (p.kind === 'text') {
    const b = p.bounds;
    return px >= b.minX - tolerance && px <= b.maxX + tolerance && py >= b.minY - tolerance && py <= b.maxY + tolerance;
  }
  if (p.kind === 'polygon') {
    if (pointInPolygon(px, py, p.points)) return true;
    if (tolerance <= 0) return false;
    for (let i = 0; i < p.points.length; i++) {
      if (distanceToSegment(px, py, p.points[i], p.points[(i + 1) % p.points.length]) <= tolerance) return true;
    }
    return false;
  }
  const d = Math.hypot(px - p.cx, py - p.cy);
  if (p.kind === 'disk') return d <= p.r + tolerance;
  if (d > p.rOuter + tolerance || d < p.rInner - tolerance) return false;
  if (p.kind === 'ring') return true;
  // arcBand: outside the gap, allowing the tolerance as an arc length.
  const reach = d > 0 ? tolerance / d : Math.PI;
  return angleGap(Math.atan2(py - p.cy, px - p.cx), p.gapCenter) >= p.gap / 2 - reach;
}

// Flattened outlines of an imported path, computed once per path object.
const flattened = new WeakMap();
function flatOutline(path) {
  let flat = flattened.get(path);
  if (!flat) {
    flat = flattenCommands(parsePathData(path.d));
    flattened.set(path, flat);
  }
  return flat;
}

// Inside a filled path (by its fill rule, every subpath closed for the
// purpose) or within half its stroke of the outline — in the shape's own
// units, the point mapped back through the element's placement.
function svgHit(p, px, py, tolerance) {
  const b = p.bounds;
  if (px < b.minX - tolerance || px > b.maxX + tolerance || py < b.minY - tolerance || py > b.maxY + tolerance) return false;
  const u = ((px - p.x) / p.scale) * (p.flip ? -1 : 1);
  const v = (py - p.y) / p.scale;
  const tol = tolerance / p.scale;
  for (const path of p.paths) {
    const subpaths = flatOutline(path);
    if (path.fill) {
      let winding = 0;
      let crossings = 0;
      for (const { points } of subpaths) {
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i];
          const [xj, yj] = points[j];
          if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) {
            crossings += 1;
            winding += yj > yi ? 1 : -1;
          }
        }
      }
      if (path.fillRule === 'evenodd' ? crossings % 2 === 1 : winding !== 0) return true;
    }
    const reach = (path.stroke || 0) / 2 + tol;
    if (reach > 0) {
      for (const { points, closed } of subpaths) {
        const last = closed || path.fill ? points.length : points.length - 1;
        for (let i = 0; i < last; i++) {
          if (distanceToSegment(u, v, points[i], points[(i + 1) % points.length]) <= reach) return true;
        }
      }
    }
  }
  return false;
}

// The extent of an element's own shape (not its mirrored or repeated
// copies), or null for one with nothing drawn (a BDC mark).
export function recordBounds(element) {
  if (!ELEMENT_TYPES[element.type]) return null;
  const boxes = recordPrimitives(element).map(primitiveBounds);
  if (boxes.length === 0) return null;
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxY: Math.max(...boxes.map((b) => b.maxY))
  };
}

// The ids of the elements whose own shape lies wholly inside `rect`
// ({ minX, maxX, minY, maxY }); one with nothing drawn (a BDC mark, shown
// at a fixed screen size) counts by its position. `skip(element)` leaves
// one out (hidden BDC marks).
export function elementsInRect(elements, rect, { skip = () => false } = {}) {
  const inside = (x, y) => x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY;
  const ids = [];
  for (const element of elements) {
    if (skip(element)) continue;
    const b = recordBounds(element);
    const caught = b ? inside(b.minX, b.minY) && inside(b.maxX, b.maxY) : inside(element.x, element.y);
    if (caught) ids.push(element.id);
  }
  return ids;
}

// The topmost element (last drawn) under the point, or null.
export function hitTestElements(elements, px, py, tolerance = 0) {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    if (elementPrimitives(element).some((p) => primitiveHit(p, px, py, tolerance))) return element.id;
  }
  return null;
}
