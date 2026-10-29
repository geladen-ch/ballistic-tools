// Zoom for the clinometer's camera view: the + / − / reset buttons (the
// same glyphs as Reticle Designer's view, zoom-glyphs.js) and two-finger
// pinch.
//
// Digital only — the video is scaled about its centre with CSS — and
// deliberately so: the camera's own zoom switches to a telephoto lens on
// many phones, and a second lens points a little differently from the
// main one, so the crosshair would no longer sit on the axis the
// calibration measured. Scaling about the centre keeps the screen's centre
// on the same lens's optical axis at every zoom.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { ZOOM_GLYPHS } from '../zoom-glyphs.js';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
const BUTTON_ZOOM_STEP = 1.5;

export function clampZoom(zoom) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

// The zoom a pinch has reached: the start zoom scaled by how far the two
// fingers have spread (or closed) since they touched down.
export function pinchZoom(startZoom, startDistance, distance) {
  if (!(startDistance > 0) || !(distance > 0)) return clampZoom(startZoom);
  return clampZoom(startZoom * (distance / startDistance));
}

// `video`: the element to scale. `pinchArea`: the element pinches are read
// on. Returns the controls' node, reset(), and dispose() for the pinch
// listeners.
export function cameraZoom({ video, pinchArea }) {
  let zoom = MIN_ZOOM;
  const level = el('span', { class: 'angle-meter-zoom-level', 'aria-live': 'polite' });

  function apply(next) {
    zoom = clampZoom(next);
    video.style.transform = zoom === MIN_ZOOM ? '' : `scale(${zoom})`;
    level.textContent = zoom === MIN_ZOOM ? '' : `${zoom.toFixed(1)}×`;
    zoomOut.disabled = zoom <= MIN_ZOOM;
    zoomIn.disabled = zoom >= MAX_ZOOM;
    reset.disabled = zoom === MIN_ZOOM;
  }

  const button = (key, glyph, onClick) => {
    const b = el('button', { type: 'button', class: 'icon-button angle-meter-zoom-button', title: t(key), 'aria-label': t(key), text: glyph });
    b.addEventListener('click', onClick);
    return b;
  };
  const zoomIn = button('angleMeter.zoomIn', ZOOM_GLYPHS.in, () => apply(zoom * BUTTON_ZOOM_STEP));
  const zoomOut = button('angleMeter.zoomOut', ZOOM_GLYPHS.out, () => apply(zoom / BUTTON_ZOOM_STEP));
  const reset = button('angleMeter.zoomReset', ZOOM_GLYPHS.reset, () => apply(MIN_ZOOM));
  const node = el('div', { class: 'angle-meter-zoom', role: 'group', 'aria-label': t('angleMeter.zoomGroup') }, [zoomIn, zoomOut, reset, level]);

  // ---- pinch ----
  const pointers = new Map();
  let pinch = null;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  function onDown(evt) {
    pointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
    if (pointers.size === 2) pinch = { zoom, distance: spread() };
  }
  function onMove(evt) {
    if (!pointers.has(evt.pointerId)) return;
    pointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
    if (pinch && pointers.size === 2) {
      evt.preventDefault?.();
      apply(pinchZoom(pinch.zoom, pinch.distance, spread()));
    }
  }
  function onUp(evt) {
    pointers.delete(evt.pointerId);
    if (pointers.size < 2) pinch = null;
  }
  pinchArea.addEventListener('pointerdown', onDown);
  pinchArea.addEventListener('pointermove', onMove);
  pinchArea.addEventListener('pointerup', onUp);
  pinchArea.addEventListener('pointercancel', onUp);

  apply(MIN_ZOOM);
  return {
    node,
    reset: () => apply(MIN_ZOOM),
    get zoom() { return zoom; },
    dispose() {
      pinchArea.removeEventListener('pointerdown', onDown);
      pinchArea.removeEventListener('pointermove', onMove);
      pinchArea.removeEventListener('pointerup', onUp);
      pinchArea.removeEventListener('pointercancel', onUp);
    }
  };
}
