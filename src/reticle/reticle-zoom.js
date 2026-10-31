// Zoom to reticle: how much a fixed scope's view can be magnified so that
// a reticle sitting small in the field fills it. Pure — no DOM. Angles in
// radians (reticle subtensions, y positive down), the factor a plain ratio.
//
// The view zooms about the reticle centre and never pans, so the extent
// that matters is each axis's farthest reach from the centre, not the
// bounding box: a tree hanging only below the centre counts as twice its
// depth. The larger axis is fitted to RETICLE_ZOOM_FILL of the field
// diameter; corners may run past the view's edge.
//
// Not counted: thinning bars, and lines reaching RETICLE_ZOOM_FILL of the
// field radius along their own axis — frame lines that would otherwise
// keep the reticle "full" for good. With nothing counted the factor is
// the cap.
import { elementPrimitives, primitiveBounds } from './geometry.js';

export const RETICLE_ZOOM_FILL = 0.9;
export const RETICLE_ZOOM_MAX = 5;

const LINE_AXES = { hline: 'x', vline: 'y' };

// { drawn, x, y }: whether any element draws anything, and the counted
// elements' farthest reach from the centre along x and along y.
export function reticleZoomExtent(elements, fieldRadius) {
  let drawn = false;
  let x = 0;
  let y = 0;
  for (const element of elements || []) {
    let primitives;
    try {
      primitives = elementPrimitives(element);
    } catch {
      continue;
    }
    for (const p of primitives) {
      drawn = true;
      if (element.type === 'hbar' || element.type === 'vbar') continue;
      const b = primitiveBounds(p);
      const reachX = Math.max(Math.abs(b.minX), Math.abs(b.maxX));
      const reachY = Math.max(Math.abs(b.minY), Math.abs(b.maxY));
      const axis = LINE_AXES[element.type];
      if (axis && (axis === 'x' ? reachX : reachY) >= RETICLE_ZOOM_FILL * fieldRadius) continue;
      x = Math.max(x, reachX);
      y = Math.max(y, reachY);
    }
  }
  return { drawn, x, y };
}

// { available, factor }: offered when something is drawn and the counted
// reticle covers less than RETICLE_ZOOM_FILL of the field on both axes;
// the factor fits the larger axis to it, capped at RETICLE_ZOOM_MAX.
export function reticleZoomFactor(extent, fieldRadius) {
  if (!extent?.drawn || !(fieldRadius > 0)) return { available: false, factor: 1 };
  const reach = Math.max(extent.x, extent.y);
  const raw = reach > 0 ? (RETICLE_ZOOM_FILL * fieldRadius) / reach : Infinity;
  if (!(raw > 1)) return { available: false, factor: 1 };
  return { available: true, factor: Math.min(RETICLE_ZOOM_MAX, raw) };
}
