// Pane 2: the reticle itself, drawn the way it looks through the scope —
// black on a light field, inside a thin circle for the visible field of
// view, everything beyond it blacked out. Elements are placed, selected
// and dragged here, BDC marks too (as fixed-size blue markers, like the
// zero mark — they aim, they aren't drawn in the glass). On an
// illuminated reticle, lit elements can be shown in the illumination
// colour and the field dimmed, as in low light. Shift- (or Ctrl/Cmd-)
// dragging on empty field draws a selection rectangle that adds every
// element wholly inside it — its own shape, not its copies — to the
// selection; a group only when all its members are inside. BDC marks are
// never caught by it. The view zooms (wheel, pinch, buttons), pans (drag on
// empty field, or middle-button drag) and resets to the whole field.
//
// Geometry stays in radians (reticle/geometry.js); this module maps it to
// the SVG's own 1000×1000 drawing units with one scale factor, `k` (drawing
// units per radian) — a view transform, not a unit conversion (see
// reticle/render.js). The field circle is the reference scope's assumed
// field (reticle/scope.js).
import { ZOOM_GLYPHS } from '../zoom-glyphs.js';
import { el } from '../../dom.js';
import { svgEl } from '../../svg.js';
import { t } from '../../i18n.js';
import { mradToRad } from '../../quantity.js';
import { visibleFieldRadius, fieldRadiusAtZoom, zoomRange, referenceOptics } from '../../reticle/scope.js';
import { axisOf, CLICK_LINE_LENGTH } from '../../reticle/element-types.js';
import { elementsInRect, hitTestElements } from '../../reticle/geometry.js';
import { fmt } from '../../reticle/render.js';
import { findElement, groupMembers, isLit, moveEndpoint, spanSegment, translate, ILLUMINATION_COLOURS } from '../../reticle/model.js';
import { snapAngle } from '../../reticle/angle-units.js';
import { patchReticleEditor } from '../../reticle-designer-state.js';
import { PALETTE_DRAG_TYPE } from './element-palette.js';
import { elementNodes } from './element-nodes.js';
import { elementIcon } from './element-icons.js';

// Imported strokes thinner than this many drawing units are drawn at it.
const MIN_STROKE = 1.2;

const SIZE = 1000;
const HALF = SIZE / 2;
// The field circle's radius at zoom 1, leaving a margin inside the canvas.
const FIT_RADIUS = 470;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 400;
const BUTTON_ZOOM_STEP = 1.5;
const WHEEL_ZOOM_RATE = 0.0015;
// Drawing units: how far a pointer must travel before a press becomes a
// drag, how close counts as on an element, and the handle size.
const DRAG_THRESHOLD = 4;
const HIT_TOLERANCE = 8;
const HANDLE_SIZE = 14;
const HANDLE_HIT = 10;
// A BDC mark's marker: its radius, and that of the ring showing it selected.
const BDC_RADIUS = 6;
const BDC_SELECTED_RADIUS = 10;
const MIN_GRID_SPACING = 6;
const MAJOR_GRID_EVERY = 5;
// Drawn while the scope's field of view is invalid (mid-edit, say).
const FALLBACK_FIELD_RADIUS = mradToRad(50);

const signOr = (v, fallback) => (v > 0 ? 1 : v < 0 ? -1 : fallback);

export function reticleView(ctl) {
  const clipId = 'reticle-field-clip';
  const clipCircle = svgEl('circle', {});
  const glass = svgEl('circle', { class: 'reticle-glass' });
  const rim = svgEl('circle', { class: 'reticle-rim' });
  const gridMinor = svgEl('path', { class: 'reticle-grid' });
  const gridMajor = svgEl('path', { class: 'reticle-grid major' });
  const elementLayer = svgEl('g', { class: 'reticle-elements' });
  const zeroLayer = svgEl('g', { class: 'reticle-zero' });
  const bdcLayer = svgEl('g', { class: 'reticle-bdc' });
  const handleLayer = svgEl('g', { class: 'reticle-handles' });
  const marquee = svgEl('rect', { class: 'reticle-marquee' });
  marquee.style.display = 'none';
  const svg = svgEl('svg', {
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    class: 'reticle-canvas',
    role: 'img',
    'aria-label': t('reticleDesigner.panes.view')
  }, [
    svgEl('defs', {}, [svgEl('clipPath', { id: clipId }, [clipCircle])]),
    svgEl('rect', { class: 'reticle-outside', x: '0', y: '0', width: String(SIZE), height: String(SIZE) }),
    glass,
    svgEl('g', { 'clip-path': `url(#${clipId})` }, [gridMinor, gridMajor, elementLayer, zeroLayer, bdcLayer]),
    rim,
    handleLayer,
    marquee
  ]);

  const zoomButton = (key, onClick, text) => {
    const button = el('button', { type: 'button', class: 'icon-button reticle-zoom-button', title: t(key), 'aria-label': t(key), text });
    button.addEventListener('click', onClick);
    return button;
  };
  // The scope's zoom ring: previews the reticle from the lowest to the
  // highest magnification. Hidden for a fixed scope.
  const magnificationSlider = el('input', { type: 'range', id: 'reticle-magnification', step: 'any' });
  const magnificationValue = el('span', { class: 'reticle-magnification-value' });
  const sfpNote = el('span', { class: 'reticle-magnification-note' });
  magnificationSlider.addEventListener('input', () => {
    patchReticleEditor({ magnification: Number(magnificationSlider.value) });
    render();
  });
  const magnificationBar = el('div', { class: 'reticle-magnification' }, [
    el('label', { for: 'reticle-magnification', i18n: 'reticleDesigner.view.magnification' }),
    magnificationSlider,
    magnificationValue,
    sfpNote
  ]);

  // Undo and redo, as icons left of the zoom ring — shown for every scope,
  // the zoom ring only for a variable one.
  const historyButton = (key, onClick) => {
    const button = el('button', { type: 'button', class: 'icon-button reticle-history-button', title: t(`reticleDesigner.view.${key}`), 'aria-label': t(`reticleDesigner.view.${key}`) }, [elementIcon(key, 18)]);
    button.addEventListener('click', onClick);
    return button;
  };
  const undoButton = historyButton('undo', () => ctl.undo());
  const redoButton = historyButton('redo', () => ctl.redo());
  const viewBar = el('div', { class: 'reticle-view-bar' }, [
    el('div', { class: 'reticle-history', role: 'group' }, [undoButton, redoButton]),
    magnificationBar
  ]);

  const controls = el('div', { class: 'reticle-zoom-controls' }, [
    zoomButton('reticleDesigner.view.zoomIn', () => zoomAbout(HALF, HALF, BUTTON_ZOOM_STEP), ZOOM_GLYPHS.in),
    zoomButton('reticleDesigner.view.zoomOut', () => zoomAbout(HALF, HALF, 1 / BUTTON_ZOOM_STEP), ZOOM_GLYPHS.out),
    zoomButton('reticleDesigner.view.reset', resetView, ZOOM_GLYPHS.reset)
  ]);
  // Live coordinates of the element being dragged, next to the pointer:
  // at normal zoom a snap step is smaller than a pixel, so the readout is
  // where snapping shows.
  const readout = el('div', { class: 'reticle-readout', 'aria-live': 'off' });
  readout.style.display = 'none';
  const node = el('section', { class: 'reticle-pane reticle-stage', 'aria-label': t('reticleDesigner.panes.view') }, [
    viewBar,
    el('div', { class: 'reticle-canvas-wrap' }, [svg, readout]),
    controls
  ]);

  // ---- view transform ----
  const view = () => ctl.editor.view || { cx: 0, cy: 0, zoom: 1 };
  const optics = () => referenceOptics(ctl.doc.referenceScope);
  function fieldRadius() {
    const r = visibleFieldRadius(optics());
    return r > 0 && Number.isFinite(r) ? r : FALLBACK_FIELD_RADIUS;
  }
  // The magnification the view shows, within the scope's zoom range.
  function magnification() {
    const range = zoomRange(optics());
    if (!range) return null;
    const m = ctl.editor.magnification ?? range[0];
    return Math.min(range[1], Math.max(range[0], m));
  }
  // Radius of the field circle as drawn: the field at the previewed
  // magnification.
  function displayRadius() {
    const r = fieldRadiusAtZoom(optics(), magnification());
    return r > 0 && Number.isFinite(r) ? r : FALLBACK_FIELD_RADIUS;
  }
  const scale = (v = view()) => (FIT_RADIUS / displayRadius()) * v.zoom;
  function toScreen(x, y, v = view()) {
    const k = scale(v);
    return [HALF + (x - v.cx) * k, HALF + (y - v.cy) * k];
  }
  function toAngle(sx, sy, v = view()) {
    const k = scale(v);
    return { x: v.cx + (sx - HALF) / k, y: v.cy + (sy - HALF) / k };
  }
  function setView(next) {
    patchReticleEditor({ view: { ...next, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next.zoom)) } });
    render();
  }
  // Zooms by `factor` keeping the point under drawing position (sx, sy) put.
  function zoomAbout(sx, sy, factor, base = view()) {
    const anchor = toAngle(sx, sy, base);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, base.zoom * factor));
    const k = (FIT_RADIUS / displayRadius()) * zoom;
    setView({ cx: anchor.x - (sx - HALF) / k, cy: anchor.y - (sy - HALF) / k, zoom });
  }

  // Back to the whole field: centred, unzoomed, at the lowest
  // magnification (the maximum field of view).
  function resetView() {
    patchReticleEditor({ magnification: null });
    setView({ cx: 0, cy: 0, zoom: 1 });
  }

  function screenPoint(event) {
    const rect = svg.getBoundingClientRect ? svg.getBoundingClientRect() : null;
    if (!rect || !rect.width) return { sx: event.offsetX ?? HALF, sy: event.offsetY ?? HALF };
    return { sx: ((event.clientX - rect.left) / rect.width) * SIZE, sy: ((event.clientY - rect.top) / rect.height) * SIZE };
  }

  const snapPoint = (p) => (ctl.editor.snap
    ? { x: snapAngle(p.x, ctl.units.snapRad), y: snapAngle(p.y, ctl.units.snapRad) }
    : p);

  // ---- rendering ----
  function renderGrid(radius) {
    const show = ctl.editor.grid;
    gridMinor.style.display = show ? '' : 'none';
    gridMajor.style.display = show ? '' : 'none';
    if (!show) return;
    const v = view();
    const k = scale(v);
    let every = 1;
    while (ctl.units.gridRad * every * k < MIN_GRID_SPACING) every *= MAJOR_GRID_EVERY;
    const step = ctl.units.gridRad * every;
    const lo = toAngle(0, 0, v);
    const hi = toAngle(SIZE, SIZE, v);
    const minor = [];
    const major = [];
    const lines = (from, to, push) => {
      for (let i = Math.ceil(Math.max(from, -radius) / step); i * step <= Math.min(to, radius); i++) push(i);
    };
    lines(lo.x, hi.x, (i) => {
      const [sx] = toScreen(i * step, 0, v);
      (i % MAJOR_GRID_EVERY === 0 ? major : minor).push(`M${fmt(sx)} 0V${SIZE}`);
    });
    lines(lo.y, hi.y, (i) => {
      const [, sy] = toScreen(0, i * step, v);
      (i % MAJOR_GRID_EVERY === 0 ? major : minor).push(`M0 ${fmt(sy)}H${SIZE}`);
    });
    gridMinor.setAttribute('d', minor.join(''));
    gridMajor.setAttribute('d', major.join(''));
  }

  function renderElements() {
    while (elementLayer.firstChild) elementLayer.removeChild(elementLayer.firstChild);
    const selection = new Set(ctl.editor.selection);
    for (const element of ctl.doc.elements) {
      // One element failing to draw must not take the rest of the view
      // with it.
      try {
        renderElement(element, selection);
      } catch {
        // skip it
      }
    }
  }

  function renderElement(element, selection) {
    const selected = selection.has(element.id) || Boolean(element.groupId && selection.has(element.groupId));
    const lit = ctl.editor.showIllumination && isLit(ctl.doc, element);
    const nodes = elementNodes(element, {
      toScreen: (x, y) => toScreen(x, y),
      k: scale(),
      classFor: (primitive) => {
        const cls = ['reticle-shape'];
        if (selected) cls.push('selected');
        if (lit) cls.push('lit');
        if (primitive.role === 'derived') cls.push('derived');
        return cls.join(' ');
      },
      minStroke: MIN_STROKE,
      data: { 'data-element': element.id }
    });
    for (const node of nodes) elementLayer.appendChild(node);
  }

  function renderZero() {
    while (zeroLayer.firstChild) zeroLayer.removeChild(zeroLayer.firstChild);
    if (!ctl.editor.showZero) return;
    const [x, y] = toScreen(0, 0);
    const r = 9;
    zeroLayer.appendChild(svgEl('circle', { cx: fmt(x), cy: fmt(y), r: String(r) }));
    zeroLayer.appendChild(svgEl('path', { d: `M${fmt(x - 2 * r)} ${fmt(y)}H${fmt(x + 2 * r)}M${fmt(x)} ${fmt(y - 2 * r)}V${fmt(y + 2 * r)}` }));
  }

  // BDC marks, when shown: a fixed-size dot each, ringed when selected.
  const bdcMarks = () => (ctl.editor.showBdc ? ctl.doc.elements.filter((e) => e.type === 'bdc') : []);

  function renderBdc() {
    while (bdcLayer.firstChild) bdcLayer.removeChild(bdcLayer.firstChild);
    const selection = new Set(ctl.editor.selection);
    for (const mark of bdcMarks()) {
      const [x, y] = toScreen(mark.x, mark.y);
      const selected = selection.has(mark.id) || Boolean(mark.groupId && selection.has(mark.groupId));
      if (selected) bdcLayer.appendChild(svgEl('circle', { class: 'reticle-bdc-ring', cx: fmt(x), cy: fmt(y), r: String(BDC_SELECTED_RADIUS) }));
      bdcLayer.appendChild(svgEl('circle', {
        class: `reticle-bdc-mark${selected ? ' selected' : ''}`, cx: fmt(x), cy: fmt(y), r: String(BDC_RADIUS), 'data-element': mark.id
      }));
    }
  }

  // The topmost BDC mark under drawing position (sx, sy), or null. Marks
  // are drawn over the reticle, so they are hit first.
  function hitBdc(sx, sy) {
    const marks = bdcMarks();
    for (let i = marks.length - 1; i >= 0; i--) {
      const [x, y] = toScreen(marks[i].x, marks[i].y);
      if (Math.hypot(x - sx, y - sy) <= BDC_RADIUS + HIT_TOLERANCE) return marks[i].id;
    }
    return null;
  }

  // The element whose ends get drag handles: a single selected line or
  // thinning bar.
  function handleElement() {
    const { selection } = ctl.editor;
    if (selection.length !== 1) return null;
    const element = findElement(ctl.doc, selection[0]);
    return element && axisOf(element) ? element : null;
  }

  function handlePoints(element) {
    const end = axisOf(element) === 'x' ? { x: element.endX, y: element.y } : { x: element.x, y: element.endY };
    return { start: { x: element.x, y: element.y }, end };
  }

  function renderHandles() {
    while (handleLayer.firstChild) handleLayer.removeChild(handleLayer.firstChild);
    const element = handleElement();
    if (!element) return;
    for (const [which, p] of Object.entries(handlePoints(element))) {
      const [x, y] = toScreen(p.x, p.y);
      handleLayer.appendChild(svgEl('rect', {
        class: `reticle-handle ${which}`,
        x: fmt(x - HANDLE_SIZE / 2), y: fmt(y - HANDLE_SIZE / 2),
        width: String(HANDLE_SIZE), height: String(HANDLE_SIZE),
        'data-handle': which
      }));
    }
  }

  function renderHistory() {
    undoButton.disabled = !ctl.canUndo();
    redoButton.disabled = !ctl.canRedo();
  }

  function renderMagnification() {
    const range = zoomRange(optics());
    magnificationBar.style.display = range ? '' : 'none';
    if (!range) return;
    const m = magnification();
    magnificationSlider.min = String(range[0]);
    magnificationSlider.max = String(range[1]);
    magnificationSlider.value = String(m);
    magnificationValue.textContent = `${String(Number(m.toFixed(1)))}×`;
    // SFP: the picture doesn't change, what the subtensions are worth does.
    const ref = ctl.doc.referenceScope;
    const sfp = ref.type === 'sfp' && ref.calibrationZoom > 0;
    sfpNote.textContent = sfp
      ? t('reticleDesigner.view.sfpScale', { factor: String(Number((ref.calibrationZoom / m).toFixed(2))) })
      : '';
  }

  // The illumination colour and the dimmed field, as classes on the
  // canvas for the stylesheet.
  function renderIllumination() {
    const { enabled, colour } = ctl.doc.illumination;
    for (const c of ILLUMINATION_COLOURS) svg.classList.toggle(`illum-${c}`, enabled && c === colour);
    svg.classList.toggle('dim', enabled && ctl.editor.dimField);
  }

  function render() {
    renderHistory();
    renderMagnification();
    renderIllumination();
    const radius = displayRadius();
    const [cx, cy] = toScreen(0, 0);
    const r = radius * scale();
    for (const circle of [clipCircle, glass, rim]) {
      circle.setAttribute('cx', fmt(cx));
      circle.setAttribute('cy', fmt(cy));
      circle.setAttribute('r', fmt(r));
    }
    renderGrid(radius);
    renderElements();
    renderZero();
    renderBdc();
    renderHandles();
    svg.classList.toggle('placing', ctl.editor.tool !== 'select');
  }

  // ---- placing ----
  // The end a plain click gives a new line or bar: lines get a short
  // segment outward from the click, bars run outward to the field circle.
  function defaultEnd(type, start) {
    const axis = type === 'hline' || type === 'hbar' ? 'x' : 'y';
    const along = start[axis];
    const across = start[axis === 'x' ? 'y' : 'x'];
    const dir = signOr(along, 1);
    const length = CLICK_LINE_LENGTH[ctl.editor.units];
    if (type === 'hbar' || type === 'vbar') {
      const radius = fieldRadius();
      if (Math.abs(across) < radius) {
        const edge = Math.sqrt(radius * radius - across * across);
        if (edge > Math.abs(along)) return dir * edge;
      }
    }
    return along + dir * length;
  }

  // Places a `type` element at angle point p; segments get their default
  // end. Returns the new id.
  function placeAt(type, p, coalesceKey) {
    const start = snapPoint(p);
    const isSegment = ['hline', 'vline', 'hbar', 'vbar'].includes(type);
    const element = ctl.newElement(type, start.x, start.y, isSegment ? defaultEnd(type, start) : undefined);
    return ctl.place(element, { coalesceKey });
  }

  // ---- pointer gestures ----
  const pointers = new Map();
  let gesture = null;

  function beginPinch() {
    const [a, b] = [...pointers.values()];
    gesture = {
      kind: 'pinch',
      distance: Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1,
      mid: { sx: (a.sx + b.sx) / 2, sy: (a.sy + b.sy) / 2 },
      base: view()
    };
    hideReadout();
    marquee.style.display = 'none';
    ctl.breakCoalescing();
  }

  function onPointerDown(event) {
    const p = screenPoint(event);
    pointers.set(event.pointerId, p);
    if (svg.setPointerCapture && event.pointerId !== undefined) {
      try { svg.setPointerCapture(event.pointerId); } catch { /* not capturable (synthetic event) */ }
    }
    if (pointers.size === 2) {
      beginPinch();
      return;
    }
    if (pointers.size > 2) return;
    event.preventDefault?.();
    const at = toAngle(p.sx, p.sy);
    const k = scale();

    if (event.button === 1) {
      gesture = { kind: 'pan', start: p, base: view(), moved: true };
      return;
    }

    const tool = ctl.editor.tool;
    if (tool !== 'select') {
      const key = ctl.gestureKey('place');
      const isSegment = ['hline', 'vline', 'hbar', 'vbar'].includes(tool);
      const start = snapPoint(at);
      const element = ctl.newElement(tool, start.x, start.y, isSegment ? (tool === 'hline' || tool === 'hbar' ? start.x : start.y) : undefined);
      const id = ctl.place(element, { coalesceKey: key });
      gesture = { kind: isSegment ? 'place-segment' : 'move', key, start: p, id, ids: [id], base: ctl.doc, anchor: start, moved: false, type: tool };
      return;
    }

    const handled = handleElement();
    if (handled) {
      for (const [which, hp] of Object.entries(handlePoints(handled))) {
        const [hx, hy] = toScreen(hp.x, hp.y);
        if (Math.abs(hx - p.sx) <= HANDLE_HIT && Math.abs(hy - p.sy) <= HANDLE_HIT) {
          gesture = { kind: 'endpoint', which, id: handled.id, key: ctl.gestureKey('endpoint'), base: ctl.doc, start: p, moved: false };
          return;
        }
      }
    }

    const hit = hitBdc(p.sx, p.sy) || hitTestElements(ctl.doc.elements, at.x, at.y, HIT_TOLERANCE / k);
    const modifier = event.shiftKey || event.ctrlKey || event.metaKey;
    if (hit) {
      const entry = ctl.entryForElement(hit);
      if (modifier) {
        ctl.toggleSelection(entry);
        gesture = null;
        return;
      }
      if (!ctl.editor.selection.includes(entry)) ctl.setSelection([entry]);
      const element = findElement(ctl.doc, hit);
      gesture = {
        kind: 'move', key: ctl.gestureKey('move'), start: p, id: hit, ids: ctl.selectedElementIds(), base: ctl.doc,
        anchor: { x: element.x, y: element.y }, moved: false
      };
      return;
    }
    // Empty field: a modified drag selects by rectangle, a plain one pans.
    gesture = modifier ? { kind: 'marquee', start: p, moved: false } : { kind: 'pan', start: p, base: view(), moved: false };
  }

  function marqueeBox(a, b) {
    return { x: Math.min(a.sx, b.sx), y: Math.min(a.sy, b.sy), w: Math.abs(a.sx - b.sx), h: Math.abs(a.sy - b.sy) };
  }

  function showMarquee(a, b) {
    const box = marqueeBox(a, b);
    marquee.setAttribute('x', fmt(box.x));
    marquee.setAttribute('y', fmt(box.y));
    marquee.setAttribute('width', fmt(box.w));
    marquee.setAttribute('height', fmt(box.h));
    marquee.style.display = '';
  }

  // Adds what the rectangle from a to b (drawing units) holds to the
  // selection: ungrouped elements wholly inside, and groups all of whose
  // members are. BDC marks are left out: a mark on its own is never
  // added, and one in a group neither counts towards nor stops that
  // group being whole (selecting the group still covers it).
  function selectInMarquee(a, b) {
    const box = marqueeBox(a, b);
    const lo = toAngle(box.x, box.y);
    const hi = toAngle(box.x + box.w, box.y + box.h);
    const isBdc = (e) => e.type === 'bdc';
    const ids = new Set(elementsInRect(ctl.doc.elements, { minX: lo.x, maxX: hi.x, minY: lo.y, maxY: hi.y }, { skip: isBdc }));
    const entries = [];
    for (const element of ctl.doc.elements) {
      if (!ids.has(element.id)) continue;
      if (!element.groupId) entries.push(element.id);
      else if (groupMembers(ctl.doc, element.groupId).every((m) => isBdc(m) || ids.has(m.id))) entries.push(element.groupId);
    }
    if (entries.length) ctl.setSelection([...ctl.editor.selection, ...entries]);
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    const p = screenPoint(event);
    pointers.set(event.pointerId, p);
    if (!gesture) return;
    if (gesture.kind === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1;
      const mid = { sx: (a.sx + b.sx) / 2, sy: (a.sy + b.sy) / 2 };
      const anchor = toAngle(gesture.mid.sx, gesture.mid.sy, gesture.base);
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, gesture.base.zoom * (distance / gesture.distance)));
      const k = (FIT_RADIUS / displayRadius()) * zoom;
      setView({ cx: anchor.x - (mid.sx - HALF) / k, cy: anchor.y - (mid.sy - HALF) / k, zoom });
      return;
    }
    if (!gesture.moved && Math.hypot(p.sx - gesture.start.sx, p.sy - gesture.start.sy) < DRAG_THRESHOLD) return;
    gesture.moved = true;

    if (gesture.kind === 'marquee') {
      showMarquee(gesture.start, p);
      return;
    }
    if (gesture.kind === 'pan') {
      const k = scale(gesture.base);
      setView({ ...gesture.base, cx: gesture.base.cx - (p.sx - gesture.start.sx) / k, cy: gesture.base.cy - (p.sy - gesture.start.sy) / k });
      return;
    }
    const at = toAngle(p.sx, p.sy);
    if (gesture.kind === 'move') {
      const from = toAngle(gesture.start.sx, gesture.start.sy);
      const target = snapPoint({ x: gesture.anchor.x + at.x - from.x, y: gesture.anchor.y + at.y - from.y });
      const moved = translate(gesture.base, gesture.ids, target.x - gesture.anchor.x, target.y - gesture.anchor.y);
      ctl.commit(moved.doc, { coalesceKey: gesture.key });
    } else if (gesture.kind === 'endpoint') {
      ctl.commit(moveEndpoint(gesture.base, gesture.id, gesture.which, snapPoint(at)), { coalesceKey: gesture.key });
    } else if (gesture.kind === 'place-segment') {
      // A new segment spans the press point and the pointer, whichever
      // way it is drawn: the end nearer zero becomes its start.
      const axis = gesture.type === 'hline' || gesture.type === 'hbar' ? 'x' : 'y';
      const doc = spanSegment(gesture.base, gesture.id, gesture.anchor[axis], snapPoint(at)[axis]);
      ctl.commit(doc, { coalesceKey: gesture.key });
    }
    showReadout(p, gesture.id);
  }

  // "x 3.4  y −1.2 mrad" for a dot, circle, chevron...; a line or bar
  // shows both ends along its axis: "x 1 … 4  y 2 mrad"; a BDC mark,
  // which only moves up and down, just "y 2 mrad".
  function readoutText(element) {
    const f = (v) => {
      const shown = String(Number(ctl.units.toDisplay(v).toFixed(ctl.units.decimals)) + 0);
      return shown.replace('-', '\u2212');
    };
    if (element.type === 'bdc') return `y ${f(element.y)} ${ctl.units.label}`;
    const axis = axisOf(element);
    const x = axis === 'x' ? `${f(element.x)} \u2026 ${f(element.endX)}` : f(element.x);
    const y = axis === 'y' ? `${f(element.y)} \u2026 ${f(element.endY)}` : f(element.y);
    return `x ${x}   y ${y} ${ctl.units.label}`;
  }

  function showReadout(p, id) {
    const element = findElement(ctl.doc, id);
    if (!element) return;
    readout.textContent = readoutText(element);
    readout.style.left = `${p.sx / (SIZE / 100)}%`;
    readout.style.top = `${p.sy / (SIZE / 100)}%`;
    // Kept inside the view: flipped to the pointer's left near the right
    // edge, below it near the top.
    readout.classList.toggle('flip-x', p.sx > SIZE * 0.6);
    readout.classList.toggle('flip-y', p.sy < SIZE * 0.12);
    readout.style.display = '';
  }

  function hideReadout() {
    readout.style.display = 'none';
  }

  function onPointerUp(event) {
    pointers.delete(event.pointerId);
    if (!gesture) return;
    if (gesture.kind === 'pinch') {
      // The remaining finger, if any, does nothing until lifted.
      if (pointers.size === 0) gesture = null;
      return;
    }
    if (gesture.kind === 'place-segment' && !gesture.moved) {
      const element = findElement(ctl.doc, gesture.id);
      const end = defaultEnd(gesture.type, { x: element.x, y: element.y });
      ctl.commit(moveEndpoint(gesture.base, gesture.id, 'end', { x: end, y: end }), { coalesceKey: gesture.key });
    }
    if (gesture.kind === 'pan' && !gesture.moved) ctl.setSelection([]);
    if (gesture.kind === 'marquee') {
      marquee.style.display = 'none';
      if (gesture.moved) selectInMarquee(gesture.start, screenPoint(event));
    }
    gesture = null;
    hideReadout();
    ctl.breakCoalescing();
  }

  function onWheel(event) {
    event.preventDefault?.();
    const p = screenPoint(event);
    zoomAbout(p.sx, p.sy, Math.exp(-event.deltaY * WHEEL_ZOOM_RATE));
  }

  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerUp);
  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('dragover', (event) => {
    if ([...(event.dataTransfer?.types || [])].includes(PALETTE_DRAG_TYPE)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  });
  svg.addEventListener('drop', (event) => {
    const type = event.dataTransfer?.getData(PALETTE_DRAG_TYPE);
    if (!type) return;
    event.preventDefault();
    const p = screenPoint(event);
    placeAt(type, toAngle(p.sx, p.sy));
  });

  return { node, update: render, placeAt, toAngle, toScreen };
}
