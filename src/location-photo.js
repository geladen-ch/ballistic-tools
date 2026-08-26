// File -> data-URL pipeline for a location's photo. Resizing is always
// applied (no user setting) so storage/export size stays bounded — see
// docs/plans/range-solver-location-photos.md.
export const MAX_DIMENSION_PX = 1600;
export const JPEG_QUALITY = 0.85;

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

// Always downscales when the picked photo exceeds maxDim on its longest
// side, re-encoding as JPEG at JPEG_QUALITY; otherwise returns the
// original data URL untouched — no benefit to re-encoding an already-small
// photo, and it'd be a needless quality loss. `maxDim` defaults to the
// shared MAX_DIMENSION_PX (Locations' own cap) so every existing caller is
// unaffected; the Rifle Precision Calculator passes its own higher cap
// (see rifle-precision/photo-add-flow.js) since its photos get zoomed in
// much further to place individual bullet holes precisely.
export async function processPickedPhoto(file, maxDim = MAX_DIMENSION_PX) {
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);
  const { width, height, scaled } = computeDownscaledDimensions(img.naturalWidth, img.naturalHeight, maxDim);
  if (!scaled) return rawDataUrl;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
