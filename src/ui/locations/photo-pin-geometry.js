// Pure pointer/transform math for photo-viewport.js's pinch-zoom/pan/tap
// widget — kept DOM-free so the trickiest part of that widget (converting
// a pointer position through the current pan/zoom transform into a 0..1
// fraction of the photo's own natural size) is unit-testable without a
// real browser.
export const MIN_SCALE = 1;
export const MAX_SCALE = 6;

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function clamp01(v) {
  return clamp(v, 0, 1);
}

// Maps a pointer's client (viewport) coordinates to a 0..1 fraction of the
// photo's *natural* content — independent of the current pan/zoom and of
// however large the widget happens to be rendered.
//
// `containerRect` = the outer widget's own getBoundingClientRect() (never
// itself transformed, so this is safe to read at any zoom level).
// `tx, ty, scale` = the *inner* viewport's current CSS transform
// (translate then scale, transform-origin 0 0).
// naturalWidth/naturalHeight = the photo's own intrinsic pixel size.
export function clientPointToRelative({ clientX, clientY, containerRect, tx, ty, scale, naturalWidth, naturalHeight }) {
  const baseWidth = containerRect.width; // the viewport's un-transformed width == container width (img is width:100%)
  const baseHeight = baseWidth * (naturalHeight / naturalWidth);
  const localX = clientX - containerRect.left;
  const localY = clientY - containerRect.top;
  const contentX = (localX - tx) / scale;
  const contentY = (localY - ty) / scale;
  return { x: clamp01(contentX / baseWidth), y: clamp01(contentY / baseHeight) };
}

export function computeDistance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function computeMidpoint(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

// Keeps panning from going past the image edges. The image is rendered at
// width:100% of the container with height:auto, so its own width always
// matches containerWidth exactly — but its *height* (contentHeight) only
// matches containerHeight when their aspect ratios happen to coincide.
// Letterboxed (image shorter than the container) or overflowing (image
// taller than the container, even at scale=1 — e.g. a portrait photo in a
// landscape/short viewport) are both the normal case, not edge cases, so
// contentHeight — not containerHeight — is what bounds vertical panning.
export function clampPan(tx, ty, scale, containerWidth, containerHeight, contentHeight) {
  const minTx = Math.min(0, containerWidth - containerWidth * scale);
  const minTy = Math.min(0, containerHeight - contentHeight * scale);
  return { tx: clamp(tx, minTx, 0), ty: clamp(ty, minTy, 0) };
}

// Recomputes tx/ty so the same content point that was under `midpointLocal`
// before the zoom stays under it after — i.e. "zoom about your fingers,"
// not about the top-left corner.
export function zoomAboutPoint({ tx, ty, scale }, midpointLocal, newScale) {
  const contentX = (midpointLocal.x - tx) / scale;
  const contentY = (midpointLocal.y - ty) / scale;
  return { tx: midpointLocal.x - contentX * newScale, ty: midpointLocal.y - contentY * newScale };
}
