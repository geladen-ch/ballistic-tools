// The Fire! pane's layout: one arrangement per orientation (landscape folds
// three columns into two when a large element is hidden), shared
// by the pane itself (range-solver-view.js) and the Layout dialog's
// preview (fire-config-dialog.js), so the preview always shows exactly
// what the pane will.
//
// The gun is always the first element and the location line the second.
// Phones in portrait get their own arrangement (phonePortrait()): the
// readout stands side by side across the pane, and the wind dial keeps its
// size, on its own line when there is room and beside a narrow range/LoS
// column otherwise.
//
// A layout is a tree. A leaf is an element id ('gun', 'context', 'scope',
// 'readout', 'flight', 'manual', 'list', 'wind', 'picker'); a container is
// { dir, w, items } with dir 'col' or 'row' (a grid along that axis),
// 'wrap' (columns side by side that wrap below the fold when they don't
// fit at their floors) or 'pair' (two items side by side when both fit,
// stacked otherwise). `w` is the node's fr weight in its parent; fixed-
// height elements have none.
//
// Every flexible track is minmax(<floor>, <weight>fr): elements grow into
// spare room and the pane scrolls exactly when their floors no longer fit.
// The floors and weights were chosen in a layout study across common phone
// and tablet sizes; they are design constants, not measured at run time.
import { el } from '../../dom.js';

export const FIRE_LAYOUT_GAP = 8;
export const FIXED_ELEMENTS = Object.freeze(['gun', 'context', 'flight', 'manual']);
const FIXED = new Set(FIXED_ELEMENTS);
const ALWAYS = ['gun', 'context', 'flight', 'manual', 'wind'];

// Floors, CSS px.
const FIELD_W = 112; // one range/LoS field at its smallest readable width
const ICON = 40; // touch target
const SCOPE_RING_BESIDE = 68;
const SCOPE_RING_BELOW = 56;
const SCOPE_CORNER = 12; // corner controls overhang the reticle by 6 px each side
const SCOPE_FLOOR = 200;
const READOUT = { full: { font: 54, label: 20 }, compact: { font: 32, label: 13 } };
const READOUT_W_FACTOR = 0.39; // font ≤ 39 % of one stat's width
const LIST = { w: 240, h: 25 + 64 + 2 * 34 + 2 }; // header, selected row, two rows, border
const WIND = { w: 187, h: 130 }; // dial 130 px; the control is 1.44 × the dial wide
const PICKER = 160;
const WIND_W_PER_D = 1.44;
// The narrow range/LoS column beside the wind dial (phone portrait): the
// range field across it; the LoS field, without its angle glyph, and the
// angle meter under it.
export const MANUAL_NARROW_W = 136;
// Phone portrait: below this share of its full height the scope keeps its
// full width and the pane scrolls instead.
const SCOPE_MIN_SHARE = 0.6;

const leaf = (id, extra = {}) => ({ id, ...extra });
const col = (w, items) => ({ dir: 'col', w, items });
const row = (w, items) => ({ dir: 'row', w, items });

// Portrait on a tablet: one column, by priority. The readout (elevation
// beside windage) sits beside the wind dial; list and picker pair up when
// the pane is wide enough for both and stack otherwise.
function tabletPortraitTree() {
  return col(1, [leaf('gun'), leaf('context'), leaf('scope', { w: 10 }),
    row(3.5, [leaf('readout', { mode: 'stack', w: 1 }), leaf('wind', { w: 1.4 })]),
    leaf('flight'), leaf('manual'), targetsPair()]);
}

const targetsPair = () => ({ dir: 'pair', w: 4.5, items: [leaf('list', { w: 1 }), leaf('picker', { w: 1 })] });

// A phone in portrait: the readout's share of the row beside the wind dial
// would be too narrow for elevation and windage side by side.
export function phonePortrait(ctx) {
  const pair = leafFloor(leaf('readout', { minMode: 'row' }), ctx).w;
  return !!ctx.paneWidth && (ctx.paneWidth - FIRE_LAYOUT_GAP) / 2.4 < pair;
}

// Portrait on a phone: gun, location line, scope, the readout side by side
// across the pane (as tall as the full-size readout even with the scope),
// flight data, then the wind dial and range/LoS, then list and picker.
// The dial and range/LoS take separate lines when those fit the pane
// without scrolling, leave the scope its full width, and give the dial at
// least the size it gets beside range/LoS; otherwise the dial sits beside
// the narrow range/LoS column and takes the rest of the width. Either way
// the dial's floor is that size, so a scrolling pane can't squeeze it.
function phonePortraitTree(effective, ctx) {
  const dial = Math.max(WIND.h, Math.floor((ctx.paneWidth - FIRE_LAYOUT_GAP - MANUAL_NARROW_W) / WIND_W_PER_D));
  const head = [leaf('gun'), leaf('context'), leaf('scope', { w: 10 }),
    leaf('readout', { w: 1.5, minMode: 'row', strip: true }), leaf('flight')];
  const lines = col(1, [...head, leaf('wind', { w: 2.5, dial }), leaf('manual', { oneRow: true }), targetsPair()]);
  if (linesFit(lines, effective, ctx)) return lines;
  return col(1, [...head, row(2.5, [leaf('manual', { narrow: true }), leaf('wind', { w: 1, dial })]), targetsPair()]);
}

function linesFit(tree, effective, ctx) {
  if (!ctx.paneHeight) return true;
  const h = layoutFloor(pruneLayout(tree, effective), ctx).h;
  if (h > ctx.paneHeight) return false;
  if (!effective.has('scope')) return true;
  const scope = leafFloor(leaf('scope'), ctx).h;
  return ctx.paneHeight - (h - scope) >= leafFloor(leaf('scope'), { ...ctx, scopeFull: true }).h;
}

// Landscape: up to three column groups, solution (scope, readout), inputs
// (range/LoS, wind) and targets (list, picker), with the gun and the
// location line always heading the first column. When a large element is
// hidden, a two-column fold is tried first; it is used only if every column
// fits the pane at its floors. Otherwise the three columns stay, wrapping
// below the fold where they don't fit side by side. With the scope on,
// flight data ends the wind column: the gun above the scope costs height a
// landscape phone doesn't have.
function landscapeTree(effective, ctx) {
  const scope = effective.has('scope');
  const readout = effective.has('readout');
  const targetCount = ['list', 'picker'].filter((id) => effective.has(id)).length;
  const head = () => [leaf('gun'), leaf('context')];
  const targets = () => [leaf('list', { w: 1 }), leaf('picker', { w: 1.2 })];
  const wrap = (items) => ({ dir: 'wrap', w: 1, items });

  let fold = null;
  if (scope && (!readout || targetCount === 1)) {
    // The targets join the inputs column, so the scope's column widens.
    fold = wrap([
      col(1.6, [...head(), leaf('scope', { w: 5 }), leaf('readout', { w: 1.5, minMode: 'row' })]),
      col(1.2, [leaf('manual'), leaf('wind', { w: 1.2 }), leaf('list', { w: 1.5 }), leaf('picker', { w: 1.8 }), leaf('flight')])]);
  } else if (!scope && readout && targetCount) {
    // The readout, side by side, joins the inputs column under the gun.
    fold = wrap([
      col(1.2, [...head(), leaf('readout', { w: 1, minMode: 'row' }), leaf('manual'), leaf('wind', { w: 2 }), leaf('flight')]),
      col(1, targets())]);
  } else if (!scope && readout) {
    // Readout alone: its column takes most of the width so the pair fits
    // side by side at a useful size.
    fold = wrap([
      col(2.4, [...head(), leaf('readout', { w: 1, minMode: 'row' }), leaf('flight')]),
      col(1, [leaf('manual'), leaf('wind', { w: 1.5 })])]);
  }
  if (fold && fitsPane(pruneLayout(fold, effective), ctx)) return fold;

  if (scope || readout) {
    return wrap([
      col(1.6, [...head(), leaf('scope', { w: 5 }), leaf('readout', { w: 1.5, minMode: scope ? 'row' : 'stack' }), ...(scope ? [] : [leaf('flight')])]),
      col(1.2, [leaf('manual'), leaf('wind', { w: 1.5 }), ...(scope ? [leaf('flight')] : [])]),
      col(0.8, targets())]);
  }
  return wrap([col(1, [...head(), leaf('manual'), leaf('wind', { w: 1.5 }), leaf('flight')]), col(1, targets())]);
}

// True when the columns sit side by side within the pane's width and each
// fits the pane's height, all at their floors.
function fitsPane(tree, ctx) {
  if (!tree || !ctx.paneWidth || !ctx.paneHeight) return false;
  const floors = (tree.dir === 'wrap' ? tree.items : [tree]).map((node) => layoutFloor(node, ctx));
  const width = floors.reduce((sum, f) => sum + f.w, 0) + FIRE_LAYOUT_GAP * (floors.length - 1);
  return width <= ctx.paneWidth && floors.every((f) => f.h <= ctx.paneHeight);
}

// Drops absent elements; a container left with one item collapses into it
// (keeping the container's weight); an empty one vanishes.
export function pruneLayout(node, present) {
  if (!node.dir) return present.has(node.id) ? node : null;
  const items = node.items.map((child) => pruneLayout(child, present)).filter(Boolean);
  if (!items.length) return null;
  if (items.length === 1) return { ...items[0], w: node.w ?? items[0].w };
  return { ...node, items };
}

export function manualFieldHeight(vmin) {
  const font = Math.min(34, Math.max(24, 0.07 * vmin));
  return Math.round(font * 1.2) + 22;
}

// The smallest box an element stays readable in. `ctx`: { paneWidth, vmin,
// compact (the readout's reduced size, while the scope shows), pictureIcon,
// ignoreLos, scopeFull }.
export function leafFloor(node, ctx) {
  switch (node.id) {
    case 'gun': return { w: 216, h: 57 };
    case 'context': return { w: 200, h: 18 };
    case 'flight': return { w: 150, h: 14 };
    case 'manual': {
      const fields = ctx.ignoreLos ? 1 : 2;
      const fieldH = manualFieldHeight(ctx.vmin);
      // Beside the wind dial: picture icon (own line), range, LoS + meter.
      if (node.narrow) return { w: MANUAL_NARROW_W, h: fields * fieldH + (fields - 1) * 8 + (ctx.pictureIcon ? 8 + ICON : 0) };
      // A full-width line on a phone: one row whenever the pane allows.
      if (node.oneRow && ctx.paneWidth >= manualRowWidth(ctx)) return { w: manualRowWidth(ctx), h: fieldH };
      // The narrowest form: fields stacked, icons beside them.
      return { w: FIELD_W + 8 + ICON, h: fields * fieldH + (fields - 1) * 8 };
    }
    case 'readout': {
      // A phone's readout strip keeps the full-size floor even with the scope.
      const r = ctx.compact && !node.strip ? READOUT.compact : READOUT.full;
      const statW = Math.ceil(r.font / READOUT_W_FACTOR);
      return (node.minMode || node.mode) === 'stack'
        ? { w: statW, h: 2 * (r.font + r.label) + 8 }
        : { w: 2 * statW + 16, h: r.font + r.label };
    }
    case 'scope':
      return ctx.scopeFull
        ? { w: ctx.paneWidth, h: ctx.paneWidth - SCOPE_CORNER + SCOPE_RING_BELOW + SCOPE_CORNER }
        : { w: SCOPE_FLOOR + SCOPE_CORNER + SCOPE_RING_BESIDE, h: SCOPE_FLOOR + SCOPE_CORNER };
    case 'list': return { ...LIST };
    case 'wind':
      // `dial`: a larger floor diameter, as far as the pane width allows.
      return node.dial
        ? { w: Math.min(ctx.paneWidth, Math.ceil(node.dial * WIND_W_PER_D)), h: Math.min(node.dial, Math.floor(ctx.paneWidth / WIND_W_PER_D)) }
        : { ...WIND };
    case 'picker': return { w: PICKER, h: PICKER };
    default: throw new Error(`unknown Fire! pane element ${node.id}`);
  }
}

// The width the manual input needs to show range, LoS, the angle meter
// (and the picture icon) on one row — the cell switches to that form at
// this width (a container query on its cell, see layout.css).
export function manualRowWidth({ pictureIcon = false, ignoreLos = false } = {}) {
  const fields = ignoreLos ? 1 : 2;
  return fields * FIELD_W + (fields - 1) * 12 + (ignoreLos ? 0 : 8 + ICON) + (pictureIcon ? 8 + ICON : 0);
}

export function layoutFloor(node, ctx) {
  if (!node.dir) return leafFloor(node, ctx);
  const floors = node.items.map((child) => layoutFloor(child, ctx));
  const gaps = FIRE_LAYOUT_GAP * (floors.length - 1);
  const sum = (k) => floors.reduce((a, f) => a + f[k], 0) + gaps;
  const max = (k) => Math.max(...floors.map((f) => f[k]));
  if (node.dir === 'row') return { w: sum('w'), h: max('h') };
  if (node.dir === 'pair') return sum('w') <= ctx.paneWidth ? { w: sum('w'), h: max('h') } : { w: max('w'), h: sum('h') };
  if (node.dir === 'wrap') {
    // Columns side by side while they fit, wrapped lines below otherwise.
    let lineW = 0, lineH = 0, height = 0, width = 0;
    for (const f of floors) {
      if (lineW && lineW + FIRE_LAYOUT_GAP + f.w > ctx.paneWidth) {
        height += Math.max(lineH, ctx.paneHeight || 0) + FIRE_LAYOUT_GAP;
        lineW = 0; lineH = 0;
      }
      lineW += (lineW ? FIRE_LAYOUT_GAP : 0) + f.w;
      lineH = Math.max(lineH, f.h);
      width = Math.max(width, f.w);
    }
    return { w: width, h: height + Math.max(lineH, ctx.paneHeight || 0) };
  }
  return { w: max('w'), h: sum('h') };
}

// The layout for an orientation and a set of effective element ids.
// Returns { tree, minHeight, scopeFull, floorCtx }: `minHeight` is the
// summed floor height (the pane scrolls when it is taller than the pane);
// `scopeFull` is the portrait rule that when the pane has to scroll anyway
// (or, on a phone, when fitting would leave the scope under 60 % of its
// full height), the scope keeps its full width instead of shrinking;
// `floorCtx` is what buildFireLayout() needs. `ctx`: { paneWidth,
// paneHeight, vmin, pictureIcon, ignoreLos }.
export function fireLayoutFor(orientation, effectiveIds, ctx) {
  const effective = new Set([...ALWAYS, ...effectiveIds]);
  const base = { ...ctx, compact: effective.has('scope'), scopeFull: false };
  const phone = orientation !== 'landscape' && phonePortrait(base);
  const raw = orientation === 'landscape' ? landscapeTree(effective, base)
    : phone ? phonePortraitTree(effective, base) : tabletPortraitTree();
  const tree = pruneLayout(raw, effective);
  const minHeight = layoutFloor(tree, base).h;
  let scopeFull = orientation !== 'landscape' && effective.has('scope') && !!ctx.paneHeight && minHeight > ctx.paneHeight;
  if (phone && !scopeFull && effective.has('scope') && ctx.paneHeight) {
    // Fitting without scrolling would leave the scope too small.
    const scope = leafFloor(leaf('scope'), base).h;
    scopeFull = ctx.paneHeight - (minHeight - scope) < SCOPE_MIN_SHARE * leafFloor(leaf('scope'), { ...base, scopeFull: true }).h;
  }
  return { tree, minHeight, scopeFull, floorCtx: { ...base, scopeFull } };
}

function track(node, axis, ctx) {
  if (node.narrow && axis === 'w') return `${MANUAL_NARROW_W}px`;
  if (node.w == null || (!node.dir && FIXED.has(node.id) && axis === 'h')) return 'auto';
  const f = layoutFloor(node, ctx);
  return `minmax(${Math.ceil(axis === 'h' ? f.h : f.w)}px, ${node.w}fr)`;
}

// Builds the nested grids for `tree`, placing `cells[id]` in each leaf.
// `ctx`: fireLayoutFor()'s `floorCtx`. Cross-axis tracks, the wrapping
// columns' height and the pair's rows are CSS (layout.css, .fire-grid-*).
export function buildFireLayout(tree, cells, ctx) {
  const build = (node) => {
    if (!node.dir) {
      cells[node.id].classList.toggle('fire-cell-narrow', !!node.narrow);
      return cells[node.id];
    }
    const g = el('div', { class: `fire-grid fire-grid-${node.dir}` });
    if (node.dir === 'wrap') {
      for (const child of node.items) {
        const f = layoutFloor(child, ctx);
        const c = build(child);
        c.style.flex = `${child.w ?? 1} 1 ${Math.ceil(f.w)}px`;
        c.style.minWidth = `${Math.ceil(f.w)}px`;
        g.appendChild(c);
      }
      return g;
    }
    if (node.dir === 'pair') {
      const colMin = Math.max(...node.items.map((child) => layoutFloor(child, ctx).w));
      g.style.gridTemplateColumns = `repeat(auto-fit, minmax(${Math.ceil(colMin)}px, 1fr))`;
      for (const child of node.items) g.appendChild(build(child));
      return g;
    }
    const tracks = node.items.map((child) => track(child, node.dir === 'col' ? 'h' : 'w', ctx)).join(' ');
    if (node.dir === 'col') g.style.gridTemplateRows = tracks;
    else g.style.gridTemplateColumns = tracks;
    for (const child of node.items) g.appendChild(build(child));
    return g;
  };
  const root = build(tree.dir ? tree : col(1, [tree]));
  root.classList.add('fire-grid-root');
  return root;
}

// Every leaf id in a tree, in order.
export function layoutElementIds(node) {
  return node.dir ? node.items.flatMap(layoutElementIds) : [node.id];
}
