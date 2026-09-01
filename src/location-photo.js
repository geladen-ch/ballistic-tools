// File -> data-URL pipeline for a location's and a rifle-precision target's
// photo. Cropping, then downscaling, is always applied (no user setting to
// turn either off) so storage/export size stays bounded — cropping is
// offered up front, during the initial import only, via decodePickedPhoto()
// + renderPhoto() below; there's no later "edit crop" on an already-saved
// photo. One shared cap/quality for both pipelines — Locations
// (locationPhotoField) and Rifle Precision (photo-add-flow.js) — so a
// photo looks the same whichever tool encoded it.
import { FULL_CROP_RECT, isFullCropRect } from './ui/image-crop-geometry.js';

export const MAX_DIMENSION_PX = 2400;
export const JPEG_QUALITY = 0.9;

// Pure — given a source image's natural size and the cap, returns the
// draw target size. Returns scaled:false (and the original dims) when
// already at or under the cap on its longest side, so a small photo never
// gets a needless lossy re-encode.
export function computeDownscaledDimensions(width, height, maxDim = MAX_DIMENSION_PX) {
  const longest = Math.max(width, height);
  if (longest <= maxDim) return { width, height, scaled: false };
  const scale = maxDim / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale), scaled: true };
}

// True whenever the photo actually changes — set for the first time,
// replaced with a different one, or removed entirely — since a pin placed
// on the old photo means nothing once it's gone. locations-view.js uses
// this to decide whether to clear every target's coords back to "not
// placed" on save. A user who saves a photo removal by mistake and wants
// those pins back can still Cancel the edit instead of saving it.
export function shouldClearTargetCoords(previousPhoto, newPhoto) {
  return newPhoto !== previousPhoto;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('failed to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to decode image'));
    img.src = dataUrl;
  });
}

// Decodes a picked file into an <img> plus its raw (un-cropped,
// un-downscaled, un-rotated) data URL. Both pipelines' pick flows use
// this — Locations' locationPhotoField and Rifle Precision's
// photo-add-flow.js — since both now show a crop step (photo-add-flow.js
// also a rotate step) that re-renders the same decoded image several
// times, as the user adjusts the corners/orientation, before settling on
// a final result; decoding once up front avoids re-reading or
// re-decoding the file on every adjustment.
export async function decodePickedPhoto(file) {
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);
  return { img, rawDataUrl };
}

// Natural size of `img` after a rotation by `quarterTurns` (width/height
// swap on an odd number of quarter turns), before any cropping/downscaling.
export function computeRotatedDimensions(width, height, quarterTurns) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  return turns % 2 === 1 ? { width: height, height: width } : { width, height };
}

// cropRect (see image-crop-geometry.js) is in the *rotated* image's own
// 0..1 fraction space — i.e. it's applied after rotation, matching what
// the user actually sees and drags corners over in the crop UI.
function cropRectToPixelBox(cropRect, width, height) {
  const x = Math.round(cropRect.x0 * width);
  const y = Math.round(cropRect.y0 * height);
  return {
    x, y,
    width: Math.max(1, Math.round(cropRect.x1 * width) - x),
    height: Math.max(1, Math.round(cropRect.y1 * height) - y)
  };
}

// Renders `img` rotated by `quarterTurns` (a multiple of 90 degrees),
// cropped to `cropRect`, and downscaled to maxDim on its longest side —
// one JPEG encode total, no matter how many of those three operations are
// actually needed, rather than a separate re-encode per step (each of
// which would be a fresh lossy pass even though rotation and cropping
// themselves touch no pixel values). Returns the original rawDataUrl
// untouched when there's no rotation, no crop, and no downscale needed,
// so an unadjusted photo never takes a needless quality hit.
export function renderPhoto(img, rawDataUrl, { quarterTurns = 0, cropRect = FULL_CROP_RECT, maxDim = MAX_DIMENSION_PX } = {}) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  const rotatedNatural = computeRotatedDimensions(img.naturalWidth, img.naturalHeight, turns);
  const cropBox = cropRectToPixelBox(cropRect, rotatedNatural.width, rotatedNatural.height);
  const { width, height, scaled } = computeDownscaledDimensions(cropBox.width, cropBox.height, maxDim);
  if (turns === 0 && isFullCropRect(cropRect) && !scaled) return { dataUrl: rawDataUrl, width, height };

  // Pass 1 (only when actually rotating): draw the image rotated, at full
  // natural resolution, onto an intermediate canvas — a plain pixel
  // buffer that's never encoded, so it costs no quality. The final
  // toDataURL below is the only lossy step, and it happens exactly once.
  let source = img;
  if (turns !== 0) {
    const rotatedCanvas = document.createElement('canvas');
    rotatedCanvas.width = rotatedNatural.width;
    rotatedCanvas.height = rotatedNatural.height;
    const rctx = rotatedCanvas.getContext('2d');
    rctx.translate(rotatedNatural.width / 2, rotatedNatural.height / 2);
    rctx.rotate((turns * 90 * Math.PI) / 180);
    rctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    source = rotatedCanvas;
  }

  // Pass 2: crop + downscale in one draw, then encode once.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(source, cropBox.x, cropBox.y, cropBox.width, cropBox.height, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY), width, height };
}
