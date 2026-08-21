// Shared full-screen zoomable/pannable photo container — the interaction
// engine behind location-placement-view.js's two modes (placing one
// target's pin, or browsing/selecting among several). Built on Pointer
// Events (no external library) and a CSS transform on an inner viewport;
// same design this app's very first pinch/pan widget
// (the now-retired target-pin-field.js) used, generalized here: this
// module owns pan/pinch/zoom interaction only — the caller owns
// rendering. Append whatever marker/pin elements you need into the
// returned `markersLayer` (positioned via left/top % on it, same
// convention every pin in this app already uses); a real `<button>`
// among them (e.g. a select-mode pin) is automatically left alone by the
// gesture handling below, so its own click still fires natively.
//
// If you also need ONE specific marker to be draggable/tap-to-place
// (placement mode's own pin), give it `class: 'photo-viewport-marker'`
// and pass `onMarkerMove` — it's called with the new relative `{x,y}`
// point on every drag step and on a plain tap on empty background; you
// own repositioning that marker's own left/top % from there.
//
// Pass `initialViewport: {scale, tx, ty}` to open already zoomed/panned
// (e.g. restoring whatever the user last left it at for this same photo)
// instead of the default fully-zoomed-out view, and read `getViewport()`
// back (e.g. on unmount) to persist it for next time — this module has
// no opinion on *where* that gets stored, callers own that (see
// location-placement-view.js's own per-location Map).
import { el } from '../../dom.js';
import {
  clamp, clampPan, clientPointToRelative, computeDistance, computeMidpoint, zoomAboutPoint,
  MIN_SCALE, MAX_SCALE
} from './photo-pin-geometry.js';

const MOVE_THRESHOLD_PX = 6;
const ZOOM_STEP = 1.5;

export function photoViewport({ photo, onMarkerMove, initialViewport } = {}) {
  let naturalWidth = 0;
  let naturalHeight = 0;

  let scale = initialViewport?.scale ?? 1;
  let tx = initialViewport?.tx ?? 0;
  let ty = initialViewport?.ty ?? 0;
  const activePointers = new Map(); // pointerId -> {x, y}
  let gestureMode = 'none'; // 'none' | 'pan' | 'pinch' | 'drag-marker'
  let pointerDownPos = null;
  let moved = false;
  let panStart = null; // {x, y, tx, ty}
  let pinchStart = null; // {distance, midLocal:{x,y}, scale}

  const img = el('img', { src: photo, alt: '' });
  const markersLayer = el('div', { class: 'photo-viewport-markers' });
  const viewport = el('div', { class: 'photo-viewport-inner' }, [img, markersLayer]);
  const widget = el('div', { class: 'photo-viewport' }, [viewport]);

  function applyTransform() {
    viewport.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    // Markers live inside markersLayer, itself inside this same
    // transformed viewport (so their position tracks the photo correctly
    // on pan/zoom) — but their own on-screen size shouldn't change with
    // zoom. layout.css's marker rules read this custom property back to
    // counter-scale themselves; set here (rather than on viewport itself)
    // only because it's a convenient, stable ancestor — custom properties
    // inherit down through descendants regardless of any transform in
    // between.
    widget.style.setProperty('--marker-scale-compensation', String(1 / scale));
  }
  // Restoring a non-default viewport is just setting the CSS transform up
  // front — no re-clamp against live layout needed (unlike zoomTo()/pan
  // below): a saved {scale,tx,ty} was already a valid clamp the last time
  // this exact photo was shown, and the very next pan/zoom action
  // naturally re-clamps against current layout anyway if anything's
  // actually changed since (e.g. the device was rotated in between).
  if (initialViewport) applyTransform();

  img.addEventListener('load', () => {
    naturalWidth = img.naturalWidth;
    naturalHeight = img.naturalHeight;
  });

  function pointToRelative(clientX, clientY) {
    const rect = widget.getBoundingClientRect();
    return clientPointToRelative({ clientX, clientY, containerRect: rect, tx, ty, scale, naturalWidth, naturalHeight });
  }

  // The image's own rendered height at scale=1 (width:100% of the
  // container, height:auto) — may be taller or shorter than the
  // container itself; see clampPan()'s own comment.
  function contentHeight() {
    return naturalWidth ? widget.clientWidth * (naturalHeight / naturalWidth) : widget.clientHeight;
  }

  function zoomTo(newScaleRaw, midLocal) {
    const newScale = clamp(newScaleRaw, MIN_SCALE, MAX_SCALE);
    const zoomed = zoomAboutPoint({ tx, ty, scale }, midLocal, newScale);
    scale = newScale;
    ({ tx, ty } = clampPan(zoomed.tx, zoomed.ty, scale, widget.clientWidth, widget.clientHeight, contentHeight()));
    applyTransform();
  }

  // Zoom controls replace pinching on non-touch devices — same pure
  // zoomAboutPoint() math pinch already uses, just anchored at the
  // viewport's own center instead of the pinch midpoint.
  function zoomStep(factor) {
    const center = { x: widget.clientWidth / 2, y: widget.clientHeight / 2 };
    zoomTo(scale * factor, center);
  }
  function zoomIn() { zoomStep(ZOOM_STEP); }
  function zoomOut() { zoomStep(1 / ZOOM_STEP); }

  // A long-press mid-drag/pan otherwise fires the browser's own
  // right-click-equivalent context menu (Android's "long press" menu,
  // iOS's callout) on top of the gesture — CSS alone (user-select/
  // -webkit-touch-callout above) doesn't reliably suppress it everywhere.
  widget.addEventListener('contextmenu', (e) => e.preventDefault());

  widget.addEventListener('pointerdown', (e) => {
    if (!naturalWidth) return; // photo not decoded yet
    // A real <button> among the caller's own markers (e.g. a select-mode
    // pin) — leave it alone entirely, no gesture capture, so its own
    // click still fires natively.
    if (e.target.closest('button')) return;
    widget.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      moved = false;
      const onMarker = onMarkerMove && e.target.closest('.photo-viewport-marker');
      if (onMarker) {
        gestureMode = 'drag-marker';
      } else {
        gestureMode = 'pan';
        panStart = { x: e.clientX, y: e.clientY, tx, ty };
      }
    } else if (activePointers.size === 2) {
      gestureMode = 'pinch';
      const [p1, p2] = [...activePointers.values()];
      const rect = widget.getBoundingClientRect();
      const mid = computeMidpoint(p1, p2);
      pinchStart = {
        distance: computeDistance(p1, p2),
        midLocal: { x: mid.x - rect.left, y: mid.y - rect.top },
        scale, tx, ty
      };
    }
  });

  widget.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointerDownPos && computeDistance(pointerDownPos, { x: e.clientX, y: e.clientY }) > MOVE_THRESHOLD_PX) moved = true;

    if (gestureMode === 'pan') {
      const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
      ({ tx, ty } = clampPan(panStart.tx + dx, panStart.ty + dy, scale, widget.clientWidth, widget.clientHeight, contentHeight()));
      applyTransform();
    } else if (gestureMode === 'pinch') {
      const [p1, p2] = [...activePointers.values()];
      zoomTo(pinchStart.scale * (computeDistance(p1, p2) / pinchStart.distance), pinchStart.midLocal);
    } else if (gestureMode === 'drag-marker') {
      onMarkerMove(pointToRelative(e.clientX, e.clientY));
    }
  });

  function endPointer(e) {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.delete(e.pointerId);

    if (gestureMode === 'pan' && !moved && onMarkerMove) {
      // A plain tap on empty photo — place/move the marker here.
      onMarkerMove(pointToRelative(e.clientX, e.clientY));
    }
    // 'drag-marker' already live-updated on every move; a tap with no
    // movement on an already-placed marker is a no-op, leaving it in place.

    if (activePointers.size === 1) {
      // A pinch just ended with one finger still down — reseed pan from
      // the remaining pointer so it continues smoothly, no jump.
      const [remaining] = [...activePointers.values()];
      gestureMode = 'pan';
      panStart = { x: remaining.x, y: remaining.y, tx, ty };
      moved = true; // a pinch already happened this gesture — never treat the eventual release as a fresh tap
    } else if (activePointers.size === 0) {
      gestureMode = 'none';
    }
    try { widget.releasePointerCapture(e.pointerId); } catch { /* already released — some engines throw */ }
  }
  widget.addEventListener('pointerup', endPointer);
  widget.addEventListener('pointercancel', endPointer);

  return { node: widget, markersLayer, zoomIn, zoomOut, getViewport: () => ({ scale, tx, ty }) };
}
