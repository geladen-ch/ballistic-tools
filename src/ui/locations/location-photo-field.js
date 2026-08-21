// Photo picker used inside location-form.js — one photo per location,
// picked either from the device's own file/photo picker or (where the
// platform honors the hint) straight from its camera. Every picked file
// is downscaled unconditionally via location-photo.js before being held
// as this field's value (a data URL string, or null).
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { processPickedPhoto } from '../../location-photo.js';

// `onChange`, when given, fires with the field's new value every time the
// photo is picked, replaced, or removed — locations-view.js uses it to
// live-preview the not-placed badges (see notPlacedBadge()) against
// whatever's currently in this field, not just the last-saved photo.
export function locationPhotoField({ value = null, onChange } = {}) {
  let photo = value;

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

  async function handleFile(file) {
    if (!file) return;
    errorMessage.style.display = 'none';
    try {
      photo = await processPickedPhoto(file);
      refresh();
      if (onChange) onChange(photo);
    } catch {
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
  }
  refresh();

  const node = el('div', { class: 'field location-photo-field' }, [
    el('label', { i18n: 'rangeSolverLocations.photoLabel' }),
    thumb,
    emptyHint,
    el('div', { class: 'arsenal-form-actions' }, [chooseButton, captureButton, removeButton]),
    chooseInput,
    captureInput,
    errorMessage,
    el('p', { class: 'hint', i18n: 'rangeSolverLocations.photoHint' })
  ]);

  return { node, getValue: () => photo };
}
