// File pick -> rotate+crop preview -> confirm/cancel flow for adding a new
// target's photo. Wraps location-photo.js's decodePickedPhoto()/
// renderPhoto() (the file is decoded once on pick) and image-cropper.js's
// drag-the-corners overlay. Rotation and cropping share one preview screen:
// rotating re-renders the (rotation-only, uncropped) preview shown inside
// the cropper — which resets the crop selection back to full-frame, since
// a crop rect drawn before a rotation change no longer means the same
// thing afterward — while dragging the crop corners is a pure overlay
// operation with no re-render at all. Only the final Confirm click does
// the one real encode: rotation + whatever crop is currently selected,
// applied together against the original full-resolution decoded image
// (not the possibly-downscaled preview), in renderPhoto()'s own single
// canvas pass.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { decodePickedPhoto, renderPhoto } from '../../location-photo.js';
import { imageCropper } from '../image-cropper.js';

// onConfirm({ photo, photoWidth, photoHeight, photoFilename }) fires once,
// only from an explicit Confirm click — picking a file alone never creates
// anything, matching every other photo-picker in this app
// (locationPhotoField's own pick-is-not-yet-save posture). onCancel fires
// on the Cancel button, available throughout (even before a photo is
// picked) so "Add target" can always be backed out of.
export function photoAddFlow({ onConfirm, onCancel } = {}) {
  let decoded = null; // { img, rawDataUrl } from decodePickedPhoto(), before rotation/crop/downscale
  let quarterTurns = 0;
  let fileName = null; // the picked File's own .name — rotation/reprocessing never changes it

  const fileInput = el('input', { type: 'file', accept: 'image/*' });
  fileInput.style.display = 'none';

  const cropper = imageCropper({ hintText: t('riflePrecision.cropHint') });
  cropper.node.style.display = 'none';
  const errorMessage = el('p', { class: 'hint warning' });
  errorMessage.style.display = 'none';

  const pickButton = el('button', { type: 'button', class: 'secondary', i18n: 'riflePrecision.choosePhotoButton' });
  pickButton.addEventListener('click', () => fileInput.click());
  const rotateLeftButton = el('button', { type: 'button', class: 'secondary', i18n: 'riflePrecision.rotateLeftButton' });
  const rotateRightButton = el('button', { type: 'button', class: 'secondary', i18n: 'riflePrecision.rotateRightButton' });
  const confirmButton = el('button', { type: 'button', i18n: 'riflePrecision.confirmPhotoButton' });
  const cancelButton = el('button', { type: 'button', class: 'secondary', i18n: 'riflePrecision.cancelButton' });
  [rotateLeftButton, rotateRightButton, confirmButton].forEach((b) => { b.style.display = 'none'; });

  // Rotation-only preview (no crop) — cheap relative to the final encode
  // since it's the same single-pass renderPhoto() either way, just without
  // a crop rect. Its result is only ever shown, never handed to onConfirm.
  function applyRotation() {
    const preview = renderPhoto(decoded.img, decoded.rawDataUrl, { quarterTurns });
    cropper.setImage(preview.dataUrl);
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    errorMessage.style.display = 'none';
    try {
      decoded = await decodePickedPhoto(file);
      fileName = file.name || null;
      quarterTurns = 0;
      applyRotation();
      cropper.node.style.display = '';
      [rotateLeftButton, rotateRightButton, confirmButton].forEach((b) => { b.style.display = ''; });
    } catch {
      decoded = null;
      fileName = null;
      cropper.node.style.display = 'none';
      [rotateLeftButton, rotateRightButton, confirmButton].forEach((b) => { b.style.display = 'none'; });
      errorMessage.textContent = t('riflePrecision.photoProcessingError');
      errorMessage.style.display = '';
    }
  });

  rotateLeftButton.addEventListener('click', () => { quarterTurns -= 1; applyRotation(); });
  rotateRightButton.addEventListener('click', () => { quarterTurns += 1; applyRotation(); });

  confirmButton.addEventListener('click', () => {
    if (!decoded) return;
    const final = renderPhoto(decoded.img, decoded.rawDataUrl, { quarterTurns, cropRect: cropper.getRect() });
    if (onConfirm) onConfirm({ photo: final.dataUrl, photoWidth: final.width, photoHeight: final.height, photoFilename: fileName });
  });
  cancelButton.addEventListener('click', () => { if (onCancel) onCancel(); });

  const node = el('div', { class: 'rp-photo-add-flow' }, [
    el('div', { class: 'arsenal-form-actions' }, [pickButton, cancelButton]),
    fileInput,
    errorMessage,
    cropper.node,
    el('div', { class: 'arsenal-form-actions' }, [rotateLeftButton, rotateRightButton, confirmButton])
  ]);

  return { node };
}
