// File pick -> rotate-preview -> confirm/cancel flow for adding a new
// target's photo. Wraps location-photo.js's processPickedPhoto() (same
// downscale-on-pick pipeline Locations uses) with a higher dimension cap —
// target photos get zoomed in up to 6x (photo-viewport.js's own MAX_SCALE)
// to place individual bullet holes precisely, so they need more headroom
// than Locations' own 1600px default, which is tuned for a much coarser
// "which target is this" glance.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { processPickedPhoto } from '../../location-photo.js';

export const RIFLE_PRECISION_MAX_DIMENSION_PX = 2200;

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to decode image'));
    img.src = dataUrl;
  });
}

// Rotates a data URL by a multiple of 90 degrees, returning the rotated
// data URL plus its natural size post-rotation (width/height swap on an
// odd number of quarter turns). quarterTurns:0 still round-trips through a
// decode (no re-encode) so the caller always gets a real {width,height}
// back regardless of whether any actual rotation happened yet.
export async function rotateImageDataUrl(dataUrl, quarterTurns) {
  const img = await loadImage(dataUrl);
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) return { dataUrl, width: img.naturalWidth, height: img.naturalHeight };

  const swapped = turns % 2 === 1;
  const width = swapped ? img.naturalHeight : img.naturalWidth;
  const height = swapped ? img.naturalWidth : img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.translate(width / 2, height / 2);
  ctx.rotate((turns * 90 * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width, height };
}

// onConfirm({ photo, photoWidth, photoHeight, photoFilename }) fires once,
// only from an explicit Confirm click — picking a file alone never creates
// anything, matching every other photo-picker in this app
// (locationPhotoField's own pick-is-not-yet-save posture). onCancel fires
// on the Cancel button, available throughout (even before a photo is
// picked) so "Add target" can always be backed out of.
export function photoAddFlow({ onConfirm, onCancel } = {}) {
  let rawPhoto = null; // as returned by processPickedPhoto, before rotation
  let rotated = null; // { dataUrl, width, height }, refreshed by applyRotation()
  let quarterTurns = 0;
  let fileName = null; // the picked File's own .name — rotation/reprocessing never changes it

  const fileInput = el('input', { type: 'file', accept: 'image/*' });
  fileInput.style.display = 'none';

  const preview = el('img', { class: 'rp-photo-preview', alt: '' });
  preview.style.display = 'none';
  const errorMessage = el('p', { class: 'hint warning' });
  errorMessage.style.display = 'none';

  const pickButton = el('button', { type: 'button', class: 'secondary', i18n: 'riflePrecision.choosePhotoButton' });
  pickButton.addEventListener('click', () => fileInput.click());
  const rotateLeftButton = el('button', { type: 'button', class: 'secondary', i18n: 'riflePrecision.rotateLeftButton' });
  const rotateRightButton = el('button', { type: 'button', class: 'secondary', i18n: 'riflePrecision.rotateRightButton' });
  const confirmButton = el('button', { type: 'button', i18n: 'riflePrecision.confirmPhotoButton' });
  const cancelButton = el('button', { type: 'button', class: 'secondary', i18n: 'riflePrecision.cancelButton' });
  [rotateLeftButton, rotateRightButton, confirmButton].forEach((b) => { b.style.display = 'none'; });

  async function applyRotation() {
    rotated = await rotateImageDataUrl(rawPhoto, quarterTurns);
    preview.src = rotated.dataUrl;
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    errorMessage.style.display = 'none';
    try {
      rawPhoto = await processPickedPhoto(file, RIFLE_PRECISION_MAX_DIMENSION_PX);
      fileName = file.name || null;
      quarterTurns = 0;
      await applyRotation();
      preview.style.display = '';
      [rotateLeftButton, rotateRightButton, confirmButton].forEach((b) => { b.style.display = ''; });
    } catch {
      rawPhoto = null;
      rotated = null;
      fileName = null;
      preview.style.display = 'none';
      [rotateLeftButton, rotateRightButton, confirmButton].forEach((b) => { b.style.display = 'none'; });
      errorMessage.textContent = t('riflePrecision.photoProcessingError');
      errorMessage.style.display = '';
    }
  });

  rotateLeftButton.addEventListener('click', async () => { quarterTurns -= 1; await applyRotation(); });
  rotateRightButton.addEventListener('click', async () => { quarterTurns += 1; await applyRotation(); });

  confirmButton.addEventListener('click', () => {
    if (!rotated) return;
    if (onConfirm) onConfirm({ photo: rotated.dataUrl, photoWidth: rotated.width, photoHeight: rotated.height, photoFilename: fileName });
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'rp-photo-add-flow' }, [
    el('div', { class: 'arsenal-form-actions' }, [pickButton, cancelButton]),
    fileInput,
    errorMessage,
    preview,
    el('div', { class: 'arsenal-form-actions' }, [rotateLeftButton, rotateRightButton, confirmButton])
  ]);

  return { node };
}
