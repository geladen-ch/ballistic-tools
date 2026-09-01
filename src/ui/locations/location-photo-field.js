// Photo picker used inside location-form.js — one photo per location,
// picked either from the device's own file/photo picker or (where the
// platform honors the hint) straight from its camera. Every picked file
// goes through a crop step (image-cropper.js, drag-the-corners, defaulting
// to the full frame) during this initial pick only — there's no later
// "edit crop" on an already-saved photo — before being downscaled
// unconditionally via location-photo.js's renderPhoto() and held as this
// field's value (a data URL string, or null).
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { decodePickedPhoto, renderPhoto } from '../../location-photo.js';
import { imageCropper } from '../image-cropper.js';

// `onChange`, when given, fires with the field's new value every time the
// photo is picked, replaced, or removed — locations-view.js uses it to
// live-preview the not-placed badges (see notPlacedBadge()) against
// whatever's currently in this field, not just the last-saved photo.
export function locationPhotoField({ value = null, onChange } = {}) {
  let photo = value;
  let decoded = null; // { img, rawDataUrl } from decodePickedPhoto(), while the crop step is open

  const thumb = el('img', { class: 'location-photo-thumb', alt: '' });
  const emptyHint = el('p', { class: 'hint', i18n: 'rangeSolverLocations.noPhotoHint' });
  const errorMessage = el('p', { class: 'hint warning' });
  errorMessage.style.display = 'none';

  const chooseInput = el('input', { type: 'file', accept: 'image/*' });
  chooseInput.style.display = 'none';
  // No `capture` attribute here on purpose — some browsers (notably older
  // iOS Safari) restrict a file input to camera-only once `capture` is
  // present, so this one stays a plain library/file picker.
  const captureInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment' });
  captureInput.style.display = 'none';

  const chooseButton = el('button', { type: 'button', class: 'secondary', i18n: 'rangeSolverLocations.choosePhotoButton' });
  chooseButton.addEventListener('click', () => chooseInput.click());
  const captureButton = el('button', { type: 'button', class: 'secondary', i18n: 'rangeSolverLocations.takePhotoButton' });
  captureButton.addEventListener('click', () => captureInput.click());
  const removeButton = el('button', { type: 'button', class: 'secondary', i18n: 'rangeSolverLocations.removePhotoButton' });
  removeButton.addEventListener('click', () => {
    photo = null;
    refresh();
    if (onChange) onChange(photo);
  });
  const pickActions = el('div', { class: 'arsenal-form-actions' }, [chooseButton, captureButton, removeButton]);

  const cropper = imageCropper({ hintText: t('rangeSolverLocations.cropHint') });
  const cropConfirmButton = el('button', { type: 'button', i18n: 'rangeSolverLocations.confirmPhotoButton' });
  const cropCancelButton = el('button', { type: 'button', class: 'secondary', i18n: 'rangeSolverLocations.cropCancelButton' });
  const cropActions = el('div', { class: 'arsenal-form-actions' }, [cropConfirmButton, cropCancelButton]);
  const cropStep = el('div', {}, [cropper.node, cropActions]);
  cropStep.style.display = 'none';

  function showCropStep() {
    thumb.style.display = 'none';
    emptyHint.style.display = 'none';
    pickActions.style.display = 'none';
    cropStep.style.display = '';
  }

  cropConfirmButton.addEventListener('click', () => {
    if (!decoded) return;
    const result = renderPhoto(decoded.img, decoded.rawDataUrl, { cropRect: cropper.getRect() });
    photo = result.dataUrl;
    decoded = null;
    cropStep.style.display = 'none';
    refresh();
    if (onChange) onChange(photo);
  });
  cropCancelButton.addEventListener('click', () => {
    decoded = null;
    cropStep.style.display = 'none';
    refresh();
  });

  async function handleFile(file) {
    if (!file) return;
    errorMessage.style.display = 'none';
    try {
      decoded = await decodePickedPhoto(file);
      cropper.setImage(decoded.rawDataUrl);
      showCropStep();
    } catch {
      decoded = null;
      errorMessage.textContent = t('rangeSolverLocations.photoProcessingError');
      errorMessage.style.display = '';
    }
  }
  chooseInput.addEventListener('change', () => {
    const file = chooseInput.files && chooseInput.files[0];
    chooseInput.value = '';
    handleFile(file);
  });
  captureInput.addEventListener('change', () => {
    const file = captureInput.files && captureInput.files[0];
    captureInput.value = '';
    handleFile(file);
  });

  function refresh() {
    thumb.style.display = photo ? '' : 'none';
    thumb.src = photo || '';
    emptyHint.style.display = photo ? 'none' : '';
    removeButton.style.display = photo ? '' : 'none';
    pickActions.style.display = '';
  }
  refresh();

  const node = el('div', { class: 'field location-photo-field' }, [
    el('label', { i18n: 'rangeSolverLocations.photoLabel' }),
    thumb,
    emptyHint,
    pickActions,
    cropStep,
    chooseInput,
    captureInput,
    errorMessage,
    el('p', { class: 'hint', i18n: 'rangeSolverLocations.photoHint' })
  ]);

  return { node, getValue: () => photo };
}
