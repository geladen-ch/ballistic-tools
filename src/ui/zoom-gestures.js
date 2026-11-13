// Zoom gestures on an element — no pan, no focal point; what the zoom
// is about is the caller's. Three sources:
// - two fingers pinching (pointer events): multiplicative steps, each move
//   the ratio of their spread to the last, so the steps multiply up to the
//   spread's change;
// - a trackpad pinch, which Chromium and Firefox report as a wheel event
//   with ctrlKey set (pinchWheelFactor), and Safari's own (gesturestart /
//   gesturechange, its scale relative to the gesture's start): likewise
//   multiplicative. iOS fires Safari's alongside the pointers of a touch
//   pinch, which the pointers already cover, so they are ignored while a
//   touch pointer is down;
// - the mouse wheel (and a trackpad's two-finger scroll): linear steps,
//   WHEEL_ZOOM_STEP a notch at every zoom (wheelZoomDelta), for the caller
//   to apply with wheelStepZoom.
//
// `onZoom(factor)` gets every multiplicative step and `onStep(delta)`
// every linear one while `canZoom()`; only then is the event's default —
// the page's scroll or its own zoom — prevented, so a wheel over a view
// with nothing to zoom still scrolls the page. The element needs
// touch-action: none for the browser to hand it a touch pinch.

// A mouse wheel notch, in px of delta, and the zoom it adds or takes
// away: a tenth, as the zoom is labelled.
const WHEEL_NOTCH_PX = 100;
export const WHEEL_ZOOM_STEP = 0.1;
// A wheel's delta, in px, per event: past this, a fast flick or a page
// delta counts as this much.
const WHEEL_MAX_DELTA_PX = 2 * WHEEL_NOTCH_PX;
// A trackpad pinch's zoom per px of delta.
const PINCH_WHEEL_ZOOM_PER_PX = 0.01;
// deltaMode 1 (lines; a notch is three) and 2 (pages), in px.
const LINE_PX = WHEEL_NOTCH_PX / 3;
const PAGE_PX = 800;
// Zooms this close count as the same, against float drift in the steps.
const SAME = 1e-6;

// A wheel event's delta in px, capped; positive rolling away from the
// user.
function wheelPx({ deltaY = 0, deltaMode = 0 }) {
  const px = -deltaY * (deltaMode === 1 ? LINE_PX : deltaMode === 2 ? PAGE_PX : 1);
  if (!Number.isFinite(px)) return 0;
  return Math.max(-WHEEL_MAX_DELTA_PX, Math.min(WHEEL_MAX_DELTA_PX, px)) || 0;
}

// The zoom step a trackpad pinch (a ctrlKey wheel event) asks for: above
// 1 spreading the fingers, below 1 closing them.
export function pinchWheelFactor(event = {}) {
  return Math.exp(wheelPx(event) * PINCH_WHEEL_ZOOM_PER_PX);
}

// The zoom a wheel event adds (rolling away from the user) or takes away:
// WHEEL_ZOOM_STEP a notch, in proportion for a smaller delta.
export function wheelZoomDelta(event = {}) {
  return (wheelPx(event) / WHEEL_NOTCH_PX) * WHEEL_ZOOM_STEP;
}

// `value` moved by `delta`, linearly: a whole zoom the step would jump
// over is where it stops; past either end of `range`, that end. `settle`
// snaps a candidate as the caller's control does (the ring's SFP
// calibration snap); a step that settles back on `value` keeps going, as
// the ring's arrow keys do, so the wheel can always leave the snap.
export function wheelStepZoom(value, delta, { range, settle = (z) => z }) {
  if (!delta || !Number.isFinite(delta) || !range) return value;
  const [lo, hi] = range;
  let candidate = value;
  for (let i = 0; i < 1000; i += 1) {
    const whole = delta > 0 ? Math.floor(candidate + SAME) + 1 : Math.ceil(candidate - SAME) - 1;
    candidate += delta;
    if (delta > 0 ? candidate > whole - SAME : candidate < whole + SAME) candidate = whole;
    if (candidate >= hi - SAME) return settle(hi);
    if (candidate <= lo + SAME) return settle(lo);
    const next = settle(candidate);
    if (next !== value) return next;
  }
  return value;
}

export function zoomGestures(area, { canZoom, onZoom, onStep }) {
  const step = (event, factor) => {
    if (!canZoom()) return;
    event.preventDefault?.();
    if (factor > 0 && Number.isFinite(factor) && factor !== 1) onZoom(factor);
  };

  const pointers = new Map();
  let spread = NaN;
  const measure = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  area.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    spread = pointers.size === 2 ? measure() : NaN;
  });
  area.addEventListener('pointermove', (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointers.size !== 2) return;
    const next = measure();
    if (spread > 0 && next > 0) step(event, next / spread);
    spread = next;
  });
  const lift = (event) => {
    pointers.delete(event.pointerId);
    spread = NaN;
  };
  area.addEventListener('pointerup', lift);
  area.addEventListener('pointercancel', lift);

  area.addEventListener('wheel', (event) => {
    if (event.ctrlKey) { step(event, pinchWheelFactor(event)); return; }
    if (!canZoom()) return;
    event.preventDefault?.();
    const delta = wheelZoomDelta(event);
    if (delta) onStep(delta);
  }, { passive: false });

  let gestureScale = NaN;
  const touching = () => [...pointers.values()].some((p) => p.type === 'touch');
  area.addEventListener('gesturestart', (event) => {
    gestureScale = touching() ? NaN : 1;
    if (!touching() && canZoom()) event.preventDefault?.();
  });
  area.addEventListener('gesturechange', (event) => {
    if (!(gestureScale > 0) || !(event.scale > 0) || touching()) return;
    step(event, event.scale / gestureScale);
    gestureScale = event.scale;
  });
  area.addEventListener('gestureend', () => { gestureScale = NaN; });
}
