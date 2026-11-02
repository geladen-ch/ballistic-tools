// The scope view's BDC callouts (the Callout BDC range display): each
// range number level with its mark, in a lane by the square's right edge,
// joined to its mark by a leader that crosses no other leader, no number,
// no hold of the overlay and no corner's controls. Pure — no DOM; drawing
// units, y down, the square [0, size] on both axes.
//
// calloutLayout({ marks, size, unit, zones, text }) → { labelSize, numbers,
// leaders }. `marks` are the overlay's rows in view, top down, each
// { row, cx, cy, holds }: its hold on screen and the boxes ({ x0, x1, y0,
// y1 }) of its holds as drawn, its own first, then its wind holds. `unit`
// is drawing units per radian of reticle subtension, `zones` the corners'
// controls' boxes, `text(row)` a number's text. `numbers` are { row, x,
// cy } (x the number's centre, cy its middle), `leaders` one point list
// per number — null for one drawn over its own row's holds.
//
// The numbers: one lane, unless a number would overlap the one above —
// then it moves to a second, outer lane, the first stepping in beside it;
// where two lanes are not enough, every number shrinks, down to
// LABEL_MIN_SCALE; one still overlapping after that is left out. Beside a
// corner's controls a number may land on its own row's holds: it is
// drawn over them, and needs no leader.
//
// The leaders start at the mark where a line can leave its row there (a
// gap above or below its holds, clear of the neighbouring rows'), and
// route from it without detours; otherwise, or if that would cross
// something, they start just past the row's outermost hold on the right.
import { degToRad, mradToRad } from '../../quantity.js';

// The numbers, in drawing units and label sizes: full size, least share
// of it, least distance between two baselines, a digit's width and the
// figures' height.
export const LABEL_SIZE = 36;
export const LABEL_MIN_SCALE = 0.75;
const LABEL_PITCH = 1.1;
const DIGIT_WIDTH = 0.6;
export const CAP_HEIGHT = 0.72;
// A leader's stroke; the gap between its end and the number's top, and
// between its end and the number's side; between the two lanes; between
// the lanes and the square's edge; round a number a leader keeps off; and
// round a hold of the overlay.
export const LEADER_STROKE = 2;
const LEADER_GAP = 3;
const SIDE_GAP = 5;
const LANE_GAP = 14;
const EDGE_MARGIN = 14;
const NUMBER_PAD = 3;

// Leader routing. A leader runs from its mark's hold to its number — onto
// its left side, arriving level, or onto its top, from above — keeping
// clear of the other leaders, the numbers, the corners' controls and the
// overlay's holds (every row's wind holds and every other mark's hold).
// Where it must, it jumps: 45 degrees up or down, MARK_JUMPS_MRAD off the
// mark, or NUMBER_JUMPS_MRAD onto the number's side (reticle subtension).
// Between the two:
// - level at the jump's height, with a leg (upright or 45 degrees) where
//   the heights differ;
// - at one of `heights` (the gaps just past and between the numbers,
//   midway between rows, just clear of each row's holds, and the jumps'
//   heights): a leg there, across, a leg to the arrival;
// - for a number in the outer lane: across at such a height through the
//   inner lane, along the gutter between the lanes, into the number;
// - onto the top: across, then down (upright or 45 degrees);
// - last of all, one straight segment to the top.
// Every route is scored by how much of it slopes — level runs are all but
// free, upright ones cost a little, 45 degrees more, other angles most
// (SLOPE_WEIGHT, per unit of length; an upright first leg, leaving the
// mark, more than a diagonal one) — plus BEND_COST a bend, so long runs
// are level and jumps are taken only when the way is blocked; the routes
// are tried in tiers — no jumps; the smallest jump; that or a jump into
// the middle of the gap either side of the mark's row; every jump; and
// then the detours too — best first within each, and the first crossing
// nothing is taken; failing that, the one crossing fewest.
const MARK_JUMPS_MRAD = [0.2, 0.5, 1, 2];
const NUMBER_JUMPS_MRAD = [0.2, 0.5, 1];
const LEG_ANGLES = [90, 45];
const TOP_ANGLES = [90, 45, 15, 5];
const SLOPE_WEIGHT = { level: 0.02, upright: 0.4, diagonal: 1, other: 2 };
// Leaving the mark, though, a leader goes at 45 degrees where it can, not
// straight up or down: there an upright leg costs more than a diagonal.
const FIRST_UPRIGHT_WEIGHT = 1.5;
const BEND_COST = 12;
// A level stretch before an arrival, in drawing units.
const SIDE_RUN = 10;
// How far a leader keeps off a wind hold or a mark's hold (their ink, not
// their white halo — a leader may cross that), in drawing units.
const HOLD_CLEAR = 1;

function routeScore(points) {
  let score = (points.length - 2) * BEND_COST;
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i].x - points[i - 1].x), dy = Math.abs(points[i].y - points[i - 1].y);
    const length = Math.hypot(dx, dy);
    if (length < 1e-9) continue;
    const kind = dy < 1e-6 ? 'level' : dx < 1e-6 ? 'upright' : Math.abs(dx - dy) < 1e-3 * length ? 'diagonal' : 'other';
    score += length * (i === 1 && kind === 'upright' ? FIRST_UPRIGHT_WEIGHT : SLOPE_WEIGHT[kind]);
  }
  return score;
}

// The point a leg at `angle` (90 or 45) from `from` reaches at height
// `h`, going up or down as it must.
function legTo(from, angle, h) {
  return angle === 90 ? { x: from.x, y: h } : { x: from.x + Math.abs(h - from.y) / Math.tan(degToRad(angle)), y: h };
}
// Drops repeated points (a leg of no length).
const tidy = (points) => points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 1e-6);
// Jumps as signed heights (positive up), none included.
const signedJumps = (list, unit) => [0, ...list.flatMap((m) => [mradToRad(m) * unit, -mradToRad(m) * unit])];

// `markJumps` and `numberJumps` are the jumps tried, as signed heights in
// drawing units (positive up, none included).
function leaderShapes(hold, to, side, heights, gutterX, markJumps, numberJumps) {
  const shapes = [];
  const add = (points) => shapes.push(tidy(points));
  for (const j1 of markJumps) {
    const from = { x: hold.x + Math.abs(j1), y: hold.y - j1 };
    const head = j1 === 0 ? [hold] : [hold, from];
    // Onto the side, from the jump's height or another, along the gutter.
    for (const j2 of numberJumps) {
      const a = { x: side.x - Math.abs(j2), y: side.y - j2 };
      const tail = j2 === 0 ? [side] : [a, side];
      for (const a1 of LEG_ANGLES) {
        const e1 = legTo(from, a1, a.y);
        if (e1.x <= a.x + 1e-6) add([...head, e1, ...tail]);
      }
      for (const h of heights) {
        for (const a1 of LEG_ANGLES) {
          const e1 = legTo(from, a1, h);
          for (const a3 of LEG_ANGLES) {
            const run = a3 === 90 ? 0 : Math.abs(a.y - h);
            const e2 = { x: a.x - SIDE_RUN - run, y: h };
            if (e2.x >= e1.x - 1e-6) add([...head, e1, e2, { x: a.x - SIDE_RUN, y: a.y }, ...tail]);
          }
          if (gutterX !== null && gutterX >= e1.x && gutterX <= a.x) add([...head, e1, { x: gutterX, y: h }, { x: gutterX, y: a.y }, ...tail]);
        }
      }
    }
    // Onto the top, from above.
    for (const h of heights) {
      if (!(h < to.y - 1)) continue;
      for (const a1 of LEG_ANGLES) {
        const e1 = legTo(from, a1, h);
        for (const a2 of TOP_ANGLES) {
          const e2 = { x: a2 === 90 ? to.x : to.x - (to.y - h) / Math.tan(degToRad(a2)), y: h };
          if (e2.x >= e1.x - 1e-6) add([...head, e1, e2, to]);
        }
      }
    }
    add([...head, to]);
  }
  return shapes;
}

// Whether segments ab and cd cross (touching at an end counts).
function segmentsCross(a, b, c, d) {
  const side = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = side(c, d, a), d2 = side(c, d, b), d3 = side(a, b, c), d4 = side(a, b, d);
  if (d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0) {
    // Collinear: they cross only where they overlap.
    return Math.max(a.x, b.x) >= Math.min(c.x, d.x) && Math.max(c.x, d.x) >= Math.min(a.x, b.x)
      && Math.max(a.y, b.y) >= Math.min(c.y, d.y) && Math.max(c.y, d.y) >= Math.min(a.y, b.y);
  }
  return ((d1 > 0) !== (d2 > 0) || d1 === 0 || d2 === 0) && ((d3 > 0) !== (d4 > 0) || d3 === 0 || d4 === 0);
}

// Whether segment pq runs through `box` ({ x0, y0, x1, y1 }), by clipping.
function segmentHitsBox(p, q, box) {
  let t0 = 0, t1 = 1;
  const dx = q.x - p.x, dy = q.y - p.y;
  for (const [pk, qk] of [[-dx, p.x - box.x0], [dx, box.x1 - p.x], [-dy, p.y - box.y0], [dy, box.y1 - p.y]]) {
    if (pk === 0) { if (qk < 0) return false; continue; }
    const r = qk / pk;
    if (pk < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 < t1;
}

function crossings(points, segments, boxes, limit = Infinity) {
  let n = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1], q = points[i];
    for (const [c, d] of segments) if (segmentsCross(p, q, c, d) && ++n >= limit) return n;
    for (const box of boxes) if (segmentHitsBox(p, q, box) && ++n >= limit) return n;
  }
  return n;
}

// The route for one leader, [hold, ...] to its number's top `to` or side
// `side`: `unit` is drawing units per radian of reticle subtension,
// `segments` those already laid, `boxes` those to keep clear of (the
// overlay's holds among them), `rowHeights` the heights between and beside
// the rows, `gutterX` the gutter's x for a number in the outer lane (else
// null), `limit` the square's size, `detours` whether the last tier (the
// detours) is tried, `gapJumps` jumps (signed heights) into the middle of
// the gaps either side of the mark's row, tried after the smallest jump.
function routeLeader(hold, to, side, unit, segments, boxes, rowHeights, gutterX, limit, detours = true, gapJumps = []) {
  const low = Math.min(hold.y, to.y), high = Math.max(hold.y, side.y);
  const near = (h) => h > 0 && h < limit && h > low - 90 && h < high + 60;
  // Just past each box's edges, midway between any two neighbouring
  // edges (the middle of every gap, however narrow), and the jumps'.
  const edges = [...new Set(boxes.flatMap((b) => [b.y0, b.y1]))].sort((a, b) => a - b);
  const mids = edges.slice(1).map((e, i) => (e + edges[i]) / 2);
  const jumpHeights = [
    ...signedJumps(MARK_JUMPS_MRAD, unit).map((j) => hold.y - j),
    ...signedJumps(NUMBER_JUMPS_MRAD, unit).map((j) => side.y - j)
  ];
  const heights = [...edges.flatMap((e) => [e - 4, e + 4]), ...mids, ...jumpHeights, ...rowHeights].filter(near).sort((a, b) => a - b)
    .filter((h, i, all) => i === 0 || h - all[i - 1] >= 1);
  const counted = new Map();
  const segmentCrossings = (p, q) => {
    const key = `${p.x.toFixed(2)},${p.y.toFixed(2)},${q.x.toFixed(2)},${q.y.toFixed(2)}`;
    let n = counted.get(key);
    if (n === undefined) {
      n = crossings([p, q], segments, boxes);
      counted.set(key, n);
    }
    return n;
  };
  // In tiers, simplest first — no jumps and no detours; jumps; the lot —
  // each best first, stopping at the first route crossing nothing.
  const smallMark = signedJumps(MARK_JUMPS_MRAD.slice(0, 1), unit);
  const smallNumber = signedJumps(NUMBER_JUMPS_MRAD.slice(0, 1), unit);
  const markJumps = [...signedJumps(MARK_JUMPS_MRAD, unit), ...gapJumps];
  const numberJumps = [...signedJumps(NUMBER_JUMPS_MRAD, unit), ...gapJumps];
  const tiers = [
    [[0], [0], []],
    [smallMark, smallNumber, []],
    ...(gapJumps.length ? [[[...smallMark, ...gapJumps], [...smallNumber, ...gapJumps], []]] : []),
    [markJumps, numberJumps, []],
    ...(detours ? [[markJumps, numberJumps, heights]] : [])
  ];
  let best = null;
  for (const [tierMarkJumps, tierNumberJumps, tierHeights] of tiers) {
    const candidates = leaderShapes(hold, to, side, tierHeights, gutterX, tierMarkJumps, tierNumberJumps)
      .map((points) => ({ points, score: routeScore(points) }))
      .sort((a, b) => a.score - b.score);
    for (const { points } of candidates) {
      let n = 0;
      for (let i = 1; i < points.length && (!best || n < best.n); i++) n += segmentCrossings(points[i - 1], points[i]);
      if (!best || n < best.n) best = { points, n };
      if (n === 0) return best;
    }
  }
  return best;
}

export function calloutLayout({ marks, size, unit, zones, text }) {
  if (!marks.length) return { labelSize: LABEL_SIZE, numbers: [], leaders: [] };
  const widest = Math.max(...marks.map(({ row }) => text(row).length));
  // The lanes' right edge at a level: the square's, stepping in beside a
  // right-hand corner's controls. `half`: half a number's height.
  const rightEdge = (cy, half) => {
    let edge = size - EDGE_MARGIN;
    for (const z of zones) {
      if (z.x1 >= size && cy + half + NUMBER_PAD > z.y0 && cy - half - NUMBER_PAD < z.y1) edge = Math.min(edge, z.x0 - EDGE_MARGIN);
    }
    return edge;
  };
  // The overlay's holds, kept clear of, and how far right each row's reach.
  const holdBoxes = marks.map(({ holds }) => holds.map(({ x0, x1, y0, y1 }) => ({
    x0: x0 - HOLD_CLEAR, x1: x1 + HOLD_CLEAR, y0: y0 - HOLD_CLEAR, y1: y1 + HOLD_CLEAR
  })));
  const rowEnd = (r) => Math.max(marks[r].cx, ...holdBoxes[r].map((b) => b.x1));
  // How far right each row's holds are drawn.
  const rowInk = (r) => Math.max(marks[r].cx, ...marks[r].holds.map((b) => b.x1));

  // The numbers' lanes at `labelSize` with up to two lanes; null if one
  // doesn't fit (or, `final`, it is left out).
  function place(labelSize, final) {
    const pitch = labelSize * LABEL_PITCH;
    const last = [-Infinity, -Infinity];
    const placed = [];
    for (let r = 0; r < marks.length; r++) {
      const mark = marks[r];
      let lane = -1;
      if (mark.cy - last[0] >= pitch) lane = 0;
      else if (mark.cy - last[1] >= pitch) lane = 1;
      if (lane < 0) {
        if (!final) return null;
        continue;
      }
      last[lane] = mark.cy;
      placed.push({ ...mark, r, lane });
    }
    return placed;
  }
  const sizes = [];
  for (let s = LABEL_SIZE; s > LABEL_SIZE * LABEL_MIN_SCALE + 1e-9; s *= 0.95) sizes.push(s);
  sizes.push(LABEL_SIZE * LABEL_MIN_SCALE);
  let labelSize = LABEL_SIZE;
  let placed = null;
  for (const s of sizes) {
    labelSize = s;
    placed = place(s, false);
    if (placed) break;
  }
  if (!placed) placed = place(labelSize, true);
  const laneWidth = widest * DIGIT_WIDTH * labelSize;
  const capHeight = CAP_HEIGHT * labelSize;
  const halfWidth = (row) => (text(row).length * DIGIT_WIDTH * labelSize) / 2;
  // The outer lane, when any number needs it, is the edge's; the inner one
  // steps in beside it.
  const staggered = placed.some(({ lane }) => lane === 1);
  const laneX = (cy, lane) => rightEdge(cy, capHeight / 2) - laneWidth / 2
    - (staggered && lane === 0 ? laneWidth + LANE_GAP : 0);
  const gutterX = (cy) => laneX(cy, 1) - laneWidth / 2 - LANE_GAP / 2;

  // The numbers' boxes and the corners' controls, kept clear of by every
  // leader, its own number's included (it arrives just beside or above it).
  const boxes = [...zones, ...placed.map(({ row, cy, lane }) => {
    const x = laneX(cy, lane);
    const half = halfWidth(row) + NUMBER_PAD;
    return { x0: x - half, x1: x + half, y0: cy - capHeight / 2 - NUMBER_PAD + 1, y1: cy + capHeight / 2 + NUMBER_PAD };
  })];
  const rowYs = marks.map(({ cy }) => cy);
  const rowHeights = [
    ...rowYs.slice(1).map((y, i) => (y + rowYs[i]) / 2),
    ...holdBoxes.flatMap((row) => (row.length ? [Math.min(...row.map((b) => b.y0)) - 2, Math.max(...row.map((b) => b.y1)) + 2] : []))
  ];
  // Whether a line can leave row `r` at its mark: a gap above or below
  // its holds, clear of the neighbouring rows' holds, wide enough for it.
  const rowSpan = (r) => [Math.min(...holdBoxes[r].map((b) => b.y0)), Math.max(...holdBoxes[r].map((b) => b.y1))];
  const rowCanBeLeft = (r) => {
    if (!holdBoxes[r].length) return true;
    const own = rowSpan(r);
    const need = LEADER_STROKE + 2;
    const clearAbove = r === 0 || !holdBoxes[r - 1].length || own[0] - rowSpan(r - 1)[1] >= need;
    const clearBelow = r === marks.length - 1 || !holdBoxes[r + 1].length || rowSpan(r + 1)[0] - own[1] >= need;
    return clearAbove || clearBelow;
  };
  // Jumps from row r's mark into the middle of the gap above its holds and
  // of the one below — however high, so a leader finds a narrow gap
  // between rows that the usual jumps would overshoot or fall short of.
  const gapJumps = (r) => {
    if (!holdBoxes[r].length) return [];
    const own = rowSpan(r);
    const need = LEADER_STROKE + 2;
    const jumps = [];
    const above = r > 0 && holdBoxes[r - 1].length ? rowSpan(r - 1)[1] : own[0] - 2 * need;
    if (own[0] - above >= need) jumps.push(marks[r].cy - (own[0] + above) / 2);
    const below = r < marks.length - 1 && holdBoxes[r + 1].length ? rowSpan(r + 1)[0] : own[1] + 2 * need;
    if (below - own[1] >= need) jumps.push(marks[r].cy - (own[1] + below) / 2);
    return jumps;
  };
  // Every leader not yet routed keeps a short stub at its row's end.
  const stubs = placed.map(({ r, cy }) => [{ x: rowEnd(r), y: cy }, { x: rowEnd(r) + 4, y: cy }]);

  // Routed one by one, each clear of those routed before it — top down,
  // and if that leaves a crossing, the outer lane first — keeping the
  // order that crosses least.
  const indices = placed.map((_, i) => i);
  const orders = [indices, [...indices].sort((a, b) => placed[b].lane - placed[a].lane || a - b)];
  let best = null;
  for (const order of orders) {
    const routed = [];
    const leaders = [];
    let total = 0;
    const done = new Set();
    for (const index of order) {
      const { r, cx, cy, lane, row } = placed[index];
      const x = laneX(cy, lane);
      const to = { x, y: cy - capHeight / 2 - LEADER_GAP };
      const side = { x: x - halfWidth(row) - SIDE_GAP, y: cy };
      const others = [...stubs.filter((_, j) => j !== index && !done.has(j)), ...routed];
      const gutter = lane === 1 ? gutterX(cy) : null;
      const otherRows = holdBoxes.filter((_, j) => j !== r).flat();
      // A number on its own row's holds needs no leader.
      if (side.x <= rowInk(r) + LEADER_STROKE) {
        leaders[index] = null;
        done.add(index);
        continue;
      }
      let route = null;
      if (rowCanBeLeft(r)) {
        const fromMark = routeLeader({ x: cx, y: cy }, to, side, unit, others, [...boxes, ...otherRows, ...holdBoxes[r].slice(1)], rowHeights, gutter, size, false, gapJumps(r));
        if (fromMark.n === 0) route = fromMark;
      }
      // From the row's end; a number close up to it (beside a corner's
      // controls) is joined by just the short level stretch between.
      if (!route && side.x <= rowEnd(r) + SIDE_RUN) route = { points: [{ x: rowInk(r), y: cy }, side], n: 0 };
      if (!route) route = routeLeader({ x: rowEnd(r), y: cy }, to, side, unit, others, [...boxes, ...otherRows], rowHeights, gutter, size);
      for (let i = 1; i < route.points.length; i++) routed.push([route.points[i - 1], route.points[i]]);
      leaders[index] = route.points;
      total += route.n;
      done.add(index);
    }
    if (!best || total < best.total) best = { leaders, total };
    if (total === 0) break;
  }
  return {
    labelSize,
    numbers: placed.map(({ row, cy, lane }) => ({ row, x: laneX(cy, lane), cy })),
    leaders: best.leaders
  };
}
