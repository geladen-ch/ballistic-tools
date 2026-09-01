// Drag-the-corners crop overlay shown over a static (no zoom/pan) preview
// image — used by both photo-pick flows during their initial import step
// only (locationPhotoField and Rifle Precision's photo-add-flow.js); there
// is no later "edit crop" on an already-saved photo. Built on Pointer
// Events, same choice as photo-viewport.js's pan/pinch/drag handling, so
// one code path drives mouse, pen and touch alike — no separate touch
// listeners needed for it to work on touch-only devices.
//
// The image is shown at its natural aspect (object-fit is never needed:
// the <img> is simply width/height:auto within a max-width/max-height box,
// so its own rendered box IS the content box) with four corner handles
// dragged independently; the rest of the photo outside the current
// selection is dimmed. `getRect()` returns the current selection as
// {x0,y0,x1,y1} fractions (see image-crop-geometry.js) of whatever image
// is currently shown — callers needing that selection to mean something
// specific (e.g. "relative to the rotated image") own making sure the
// image they pass to setImage() already reflects that.
import { el } from '../dom.js';
import { t } from '../i18n.js';
import { FULL_CROP_RECT, clientPointToImageFraction, moveCorner } from './image-crop-geometry.js';

const CORNERS = ['nw', 'ne', 'sw', 'se'];
const CORNER_LABEL_KEYS = {
  nw: 'common.cropHandleTopLeft',
  ne: 'common.cropHandleTopRight',
  sw: 'common.cropHandleBottomLeft',
  se: 'common.cropHandleBottomRight'
};

// `hintText` is a caller-supplied, already-localized string — the two
// pipelines each own their own i18n key for it (rangeSolverLocations.cropHint
// / riflePrecision.cropHint) since the surrounding copy differs slightly
// between them, same pattern as photoPickerButton's own caller-supplied
// `label`.
export function imageCropper({ hintText } = {}) {
  let rect = FULL_CROP_RECT;
  let activeCorner = null;

  const img = el('img', { class: 'image-cropper-photo', alt: '' });
  img.draggable = false;

  const outline = el('div', { class: 'image-cropper-outline' });
  const dimTop = el('div', { class: 'image-cropper-dim image-cropper-dim-top' });
  const dimBottom = el('div', { class: 'image-cropper-dim image-cropper-dim-bottom' });
  const dimLeft = el('div', { class: 'image-cropper-dim image-cropper-dim-side' });
  const dimRight = el('div', { class: 'image-cropper-dim image-cropper-dim-side' });

  const handles = new Map(CORNERS.map((corner) => [
    corner,
    el('div', { class: `image-cropper-handle image-cropper-handle-${corner}`, 'aria-label': t(CORNER_LABEL_KEYS[corner]) })
  ]));

  const overlay = el('div', { class: 'image-cropper-overlay' }, [
    dimTop, dimBottom, dimLeft, dimRight, outline, ...handles.values()
  ]);
  const frame = el('div', { class: 'image-cropper-frame' }, [img, overlay]);
  const node = el('div', { class: 'image-cropper' }, [
    frame,
    hintText ? el('p', { class: 'hint' }, [hintText]) : null
  ]);

  // Long-press mid-drag otherwise triggers the browser's own "save image"/
  // callout context menu on top of the gesture — same fix photo-viewport.js
  // uses.
  frame.addEventListener('contextmenu', (e) => e.preventDefault());

  function updateOverlay() {
    const leftPct = rect.x0 * 100, rightPct = rect.x1 * 100, topPct = rect.y0 * 100, bottomPct = rect.y1 * 100;

    outline.style.left = `${leftPct}%`;
    outline.style.top = `${topPct}%`;
    outline.style.width = `${rightPct - leftPct}%`;
    outline.style.height = `${bottomPct - topPct}%`;

    dimTop.style.height = `${topPct}%`;
    dimBottom.style.height = `${100 - bottomPct}%`;
    dimLeft.style.top = `${topPct}%`;
    dimLeft.style.height = `${bottomPct - topPct}%`;
    dimLeft.style.width = `${leftPct}%`;
    dimRight.style.top = `${topPct}%`;
    dimRight.style.height = `${bottomPct - topPct}%`;
    dimRight.style.left = `${rightPct}%`;
    dimRight.style.width = `${100 - rightPct}%`;

    handles.get('nw').style.left = `${leftPct}%`; handles.get('nw').style.top = `${topPct}%`;
    handles.get('ne').style.left = `${rightPct}%`; handles.get('ne').style.top = `${topPct}%`;
    handles.get('sw').style.left = `${leftPct}%`; handles.get('sw').style.top = `${bottomPct}%`;
    handles.get('se').style.left = `${rightPct}%`; handles.get('se').style.top = `${bottomPct}%`;
  }
  updateOverlay();

  function bindHandleDrag(corner, handleEl) {
    handleEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handleEl.setPointerCapture(e.pointerId);
      activeCorner = corner;
    });
    handleEl.addEventListener('pointermove', (e) => {
      if (activeCorner !== corner) return;
      const imageRect = img.getBoundingClientRect();
      if (!imageRect.width || !imageRect.height) return; // image not laid out yet
      const { x, y } = clientPointToImageFraction({ clientX: e.clientX, clientY: e.clientY, imageRect });
      rect = moveCorner(rect, corner, x, y);
      updateOverlay();
    });
    function endDrag(e) {
      if (activeCorner !== corner) return;
      activeCorner = null;
      try { handleEl.releasePointerCapture(e.pointerId); } catch { /* already released — some engines throw */ }
    }
    handleEl.addEventListener('pointerup', endDrag);
    handleEl.addEventListener('pointercancel', endDrag);
  }
  CORNERS.forEach((corner) => bindHandleDrag(corner, handles.get(corner)));

  // Swapping in a new preview image (a freshly picked photo, or the same
  // one re-rendered after a rotation change) always resets the selection
  // back to the full frame — any previous crop rect was relative to
  // pixels that, after a rotation, no longer mean the same thing.
  function setImage(src) {
    img.src = src;
    rect = FULL_CROP_RECT;
    updateOverlay();
  }

  return { node, setImage, getRect: () => rect };
}
