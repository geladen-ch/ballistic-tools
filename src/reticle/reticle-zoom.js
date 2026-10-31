// Zoom to reticle: the extra magnification a fixed scope's view can be
// given on top of the scope's own, RETICLE_ZOOM_MIN to RETICLE_ZOOM_MAX,
// and the one it opens at — the zoom at which the reticle fills the
// field. Pure — no DOM. Angles in radians (reticle subtensions, y
// positive down), zooms plain ratios.
//
// The view zooms about the reticle centre and never pans, so the extent
// that matters is each axis's farthest reach from the centre, not the
// bounding box: a tree hanging only below the centre counts as twice its
// depth. The fit puts the larger axis at RETICLE_ZOOM_FILL of the field
// diameter; corners may run past the view's edge.
//
// Not counted: thinning bars, and lines reaching RETICLE_ZOOM_FILL of the
// field radius along their own axis — frame lines that would otherwise
// keep the reticle "full" for good. With nothing counted there is no fit,
// and the view opens at RETICLE_ZOOM_UNFITTED.
import { elementPrimitives, primitiveBounds } from './geometry.js';

export const RETICLE_ZOOM_FILL = 0.9;
export const RETICLE_ZOOM_MIN = 1;
export const RETICLE_ZOOM_MAX = 10;
export const RETICLE_ZOOM_UNFITTED = 5;

const LINE_AXES = { hline: 'x', vline: 'y' };
// Zooms this close (as a fraction) count as the same stop.
const SAME_STOP = 1e-6;

const clampZoom = (z) => Math.min(RETICLE_ZOOM_MAX, Math.max(RETICLE_ZOOM_MIN, z));

// { x, y }: the counted elements' farthest reach from the centre along x
// and along y.
export function reticleZoomExtent(elements, fieldRadius) {
  let x = 0;
  let y = 0;
  for (const element of elements || []) {
    if (element.type === 'hbar' || element.type === 'vbar') continue;
    let primitives;
    try {
      primitives = elementPrimitives(element);
    } catch {
      continue;
    }
    for (const p of primitives) {
      const b = primitiveBounds(p);
      const reachX = Math.max(Math.abs(b.minX), Math.abs(b.maxX));
      const reachY = Math.max(Math.abs(b.minY), Math.abs(b.maxY));
      const axis = LINE_AXES[element.type];
      if (axis && (axis === 'x' ? reachX : reachY) >= RETICLE_ZOOM_FILL * fieldRadius) continue;
      x = Math.max(x, reachX);
      y = Math.max(y, reachY);
    }
  }
  return { x, y };
}

// The zoom the view opens at: the larger axis fitted to RETICLE_ZOOM_FILL
// of the field, within the range; RETICLE_ZOOM_UNFITTED with nothing to fit.
export function reticleZoomFit(extent, fieldRadius) {
  const reach = Math.max(extent?.x || 0, extent?.y || 0);
  if (!(reach > 0) || !(fieldRadius > 0)) return RETICLE_ZOOM_UNFITTED;
  return clampZoom((RETICLE_ZOOM_FILL * fieldRadius) / reach);
}

// The stops the − / + buttons step through: every whole zoom in the range
// and the fit, ascending.
export function reticleZoomStops(fit) {
  const stops = [];
  for (let z = RETICLE_ZOOM_MIN; z <= RETICLE_ZOOM_MAX; z += 1) stops.push(z);
  if (Number.isFinite(fit) && !stops.some((z) => Math.abs(z / fit - 1) < SAME_STOP)) stops.push(clampZoom(fit));
  return stops.sort((a, b) => a - b);
}

// The next stop above (`direction` 1) or below (-1) `zoom`, or `zoom`
// itself at the end of the range.
export function stepReticleZoom(zoom, direction, fit) {
  const stops = reticleZoomStops(fit);
  const next = direction > 0
    ? stops.find((z) => z > zoom * (1 + SAME_STOP))
    : stops.findLast((z) => z < zoom * (1 - SAME_STOP));
  return next ?? zoom;
}
