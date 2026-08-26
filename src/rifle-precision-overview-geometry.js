// Pure math for "Save group overview image" (see
// rifle-precision-photo-export.js's own exportGroupOverviewImage()) —
// converts the marking view's current pan/zoom transform
// (photo-viewport.js's own {scale, tx, ty}, read via getViewport()) into
// the rectangle of the target's *native* pixels currently visible on
// screen, so the exported PNG can be cropped to match exactly what the
// user sees. Inverts the same tx/ty/scale/baseWidth reasoning
// photo-pin-geometry.js's own clientPointToRelative() uses to map one
// screen point to a photo fraction — this maps the whole visible screen
// rectangle (0,0)..(containerWidth,containerHeight) to a photo-fraction
// rectangle instead. Kept DOM-free/pure for unit testing, same split as
// photo-pin-geometry.js itself.
function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

// {scale, tx, ty}: photo-viewport.js's own getViewport() shape.
// containerWidth/containerHeight: the on-screen widget's own rendered
// size (getBoundingClientRect()).
// photoWidth/photoHeight: the target's natural pixel size.
// Returns {x, y, width, height} in native photo pixels — each corner
// clamped to the photo's own [0,1] bounds independently (not just the
// rectangle as a whole), since a letterboxed edge (e.g. a portrait photo
// in a wide/short viewport, per photo-viewport.js's own contentHeight()
// comment) can't crop into image content that doesn't exist.
export function computeVisibleCropRect({ scale, tx, ty, containerWidth, containerHeight, photoWidth, photoHeight }) {
  const baseWidth = containerWidth; // the image is always rendered width:100% of the container
  const baseHeight = containerWidth * (photoHeight / photoWidth);

  const rawX0 = -tx / (scale * baseWidth);
  const rawY0 = -ty / (scale * baseHeight);
  const rawX1 = rawX0 + containerWidth / (scale * baseWidth);
  const rawY1 = rawY0 + containerHeight / (scale * baseHeight);

  const relX0 = clamp01(rawX0);
  const relY0 = clamp01(rawY0);
  const relX1 = clamp01(rawX1);
  const relY1 = clamp01(rawY1);

  return {
    x: relX0 * photoWidth,
    y: relY0 * photoHeight,
    width: Math.max(1, (relX1 - relX0) * photoWidth),
    height: Math.max(1, (relY1 - relY0) * photoHeight)
  };
}
