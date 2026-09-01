// Pure geometry for image-cropper.js's drag-the-corners crop rectangle —
// kept DOM-free, same split as photo-pin-geometry.js/photo-viewport.js,
// so the trickiest part (clamping a dragged corner without ever letting
// the rectangle invert or collapse) is unit-testable without a real
// browser.
//
// A crop rect is always {x0, y0, x1, y1}, each a 0..1 fraction of the
// (possibly already-rotated) image's own natural size, with x0<x1 and
// y0<y1. FULL_CROP_RECT — the whole photo, corners at the edges — is both
// the default selection shown on entry and, semantically, "no crop":
// location-photo.js's renderPhoto() special-cases it to skip re-encoding,
// same as an unrotated, undownscaled photo already does.
export const FULL_CROP_RECT = { x0: 0, y0: 0, x1: 1, y1: 1 };

// A crop narrower or shorter than this (as a fraction of the image's own
// full extent) would be fiddly to keep dragging further and, in practice,
// is almost certainly an accidental near-collapse rather than an
// intentional tiny crop — so a corner drag is clamped to stop here rather
// than letting the rectangle keep shrinking toward a sliver or a point.
export const MIN_CROP_FRACTION = 0.1;

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function clamp01(v) {
  return clamp(v, 0, 1);
}

export function isFullCropRect(rect) {
  return rect.x0 === 0 && rect.y0 === 0 && rect.x1 === 1 && rect.y1 === 1;
}

// Maps a pointer's client (viewport) coordinates to a 0..1 fraction of the
// displayed image — `imageRect` is the <img> element's own
// getBoundingClientRect(). Unlike photo-viewport.js's own
// clientPointToRelative(), there's no pan/zoom transform to undo here: the
// cropper never scales or pans, so the image's rendered box *is* the
// content box, whatever CSS sizing produced it.
export function clientPointToImageFraction({ clientX, clientY, imageRect }) {
  return {
    x: clamp01((clientX - imageRect.left) / imageRect.width),
    y: clamp01((clientY - imageRect.top) / imageRect.height)
  };
}

// Returns a new rect with the given corner ('nw'|'ne'|'sw'|'se') moved to
// the new fractional pointer position, clamped so that corner can never
// cross past MIN_CROP_FRACTION short of the opposite corner — the
// rectangle can shrink right down to that minimum size but never invert
// or collapse to a line/point.
export function moveCorner(rect, corner, fx, fy) {
  switch (corner) {
    case 'nw':
      return { ...rect, x0: clamp(fx, 0, rect.x1 - MIN_CROP_FRACTION), y0: clamp(fy, 0, rect.y1 - MIN_CROP_FRACTION) };
    case 'ne':
      return { ...rect, x1: clamp(fx, rect.x0 + MIN_CROP_FRACTION, 1), y0: clamp(fy, 0, rect.y1 - MIN_CROP_FRACTION) };
    case 'sw':
      return { ...rect, x0: clamp(fx, 0, rect.x1 - MIN_CROP_FRACTION), y1: clamp(fy, rect.y0 + MIN_CROP_FRACTION, 1) };
    case 'se':
      return { ...rect, x1: clamp(fx, rect.x0 + MIN_CROP_FRACTION, 1), y1: clamp(fy, rect.y0 + MIN_CROP_FRACTION, 1) };
    default:
      return rect;
  }
}
