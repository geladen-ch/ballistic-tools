// Annotated target-photo PNG export — exportGroupOverviewImage(): the
// marking view's own "Save group overview image" button — the *active*
// group specifically, plus the calibration line/label, cropped to match
// whatever the user currently has zoomed/panned to on screen (see
// rifle-precision-overview-geometry.js), using the exact colors/glyphs the
// precision-report diagram itself uses (see src/ui/rifle-precision/marker-style.js)
// and impacts sized to the rifle's own caliber.
//
// Both download the canvas's own Blob directly (URL.createObjectURL, same
// technique download.js itself uses internally) rather than routing
// through downloadFile(), since that helper always re-wraps its `content`
// argument in `new Blob([content])` — double-wrapping an already-a-Blob
// canvas.toBlob() result.
import { computeGroupStats, computeScale } from './engine/rifle-precision-stats.js';
import { computeVisibleCropRect } from './rifle-precision-overview-geometry.js';
import { COLOR_POOLED_SHOT, COLOR_POA, COLOR_POI, COLOR_CALIBRATION } from './ui/rifle-precision/marker-style.js';

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to decode target photo'));
    img.src = dataUrl;
  });
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// A small pill: a translucent white background box behind dark text, so
// the label reads regardless of what's underneath it in the photo — same
// "hardcoded, not themed" reasoning as analysis-diagram.js's own exported
// colors (a raster PNG has no stylesheet of its own to react to a theme
// with, and the label needs to sit on top of an arbitrary real photo, not
// this app's own panel background).
function drawLabel(ctx, text, x, y, canvasWidth) {
  const fontSize = Math.max(10, canvasWidth * 0.022);
  ctx.font = `600 ${fontSize}px sans-serif`;
  const paddingX = fontSize * 0.5;
  const paddingY = fontSize * 0.35;
  const boxW = ctx.measureText(text).width + paddingX * 2;
  const boxH = fontSize + paddingY * 2;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// The active group's own overview PNG — everything rifle-precision-marking-view.js's
// own live overlay can show for one group (PoA, its shots, the extreme-
// spread line/label, the average-POI marker) plus the calibration line/
// label, which the live marking view only ever shows during the
// calibration step itself but this export always includes regardless of
// which step is currently on screen.
//
// `viewport` = {scale, tx, ty} (photo-viewport.js's own getViewport())
// plus {containerWidth, containerHeight} (the widget's own
// getBoundingClientRect() at export time) — together, exactly what
// computeVisibleCropRect() needs to figure out which native-pixel
// rectangle of the photo is currently on screen, so the export can be
// cropped to match it (see that module's own comment) rather than always
// exporting the whole photo.
//
// `extremeSpreadLabelText` is pre-formatted by the caller (e.g.
// "45.2 mm") — this module has no opinion on the user's own preferred
// display unit, unlike the calibration length label below, which is
// always literally the millimetre value the user typed into the
// calibration step's own input (same hardcoded-mm convention
// rifle-precision-marking-view.js's own setCalibrationLabelValue() uses).
export async function exportGroupOverviewImage({
  target, group, project, viewport, extremeSpreadLabelText, filename = 'rifle-precision-group-overview.png'
}) {
  if (!target || !target.photo || !group) return;

  const img = await loadImage(target.photo);
  const crop = computeVisibleCropRect({
    scale: viewport.scale, tx: viewport.tx, ty: viewport.ty,
    containerWidth: viewport.containerWidth, containerHeight: viewport.containerHeight,
    photoWidth: target.photoWidth, photoHeight: target.photoHeight
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.width);
  canvas.height = Math.round(crop.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);

  // Relative (0..1 of the *full* photo) -> this cropped canvas's own px.
  const toPx = (pt) => ({
    x: (pt.x * target.photoWidth - crop.x) * (canvas.width / crop.width),
    y: (pt.y * target.photoHeight - crop.y) * (canvas.height / crop.height)
  });

  const lineWidth = Math.max(2, canvas.width * 0.003);
  // Fixed-on-screen-size markers (PoA, POI) are sized as a fraction of the
  // *output canvas's own* dimensions — since that canvas represents "the
  // same on-screen framing" the user was looking at regardless of zoom
  // level, this reproduces a marker that stayed a constant CSS-pixel size
  // on screen (see rifle-precision-marking-view.js's own
  // --marker-scale-compensation counter-scale) without needing to know
  // the on-screen CSS pixel size at all.
  const poaSize = canvas.width * 0.014;
  const poiRadius = canvas.width * 0.011;

  const cal = target.calibration;
  if (cal && cal.point1 && cal.point2) {
    const a = toPx(cal.point1);
    const b = toPx(cal.point2);
    ctx.strokeStyle = COLOR_CALIBRATION;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (cal.realLengthMm) drawLabel(ctx, `${cal.realLengthMm} mm`, (a.x + b.x) / 2, (a.y + b.y) / 2, canvas.width);
  }

  if (group.poa) {
    const p = toPx(group.poa);
    ctx.strokeStyle = COLOR_POA;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(p.x, p.y, poaSize, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - poaSize * 1.7, p.y);
    ctx.lineTo(p.x + poaSize * 1.7, p.y);
    ctx.moveTo(p.x, p.y - poaSize * 1.7);
    ctx.lineTo(p.x, p.y + poaSize * 1.7);
    ctx.stroke();
  }

  // Impacts: a fixed *physical* diameter (the rifle's own caliber),
  // unlike every other marker here — see .rp-impact-marker's own CSS
  // comment for why this one deliberately isn't sized off the canvas/
  // viewport at all. computeScale() is native px-per-mm, and this canvas
  // is native photo pixels 1:1 within the crop (no separate rescale), so
  // the physical radius in native px *is* the radius in canvas px.
  const pxPerMm = computeScale(target);
  const impactRadius = pxPerMm && project.caliberMm > 0 ? (project.caliberMm / 2) * pxPerMm : canvas.width * 0.007;
  ctx.fillStyle = COLOR_POOLED_SHOT;
  for (const shot of group.shots) {
    const p = toPx(shot);
    ctx.beginPath();
    ctx.arc(p.x, p.y, impactRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  const stats = computeGroupStats(group, target);
  if (stats && stats.extremePairIndices[0] != null && stats.extremePairIndices[1] != null) {
    const [i1, i2] = stats.extremePairIndices;
    const a = toPx(group.shots[i1]);
    const b = toPx(group.shots[i2]);
    ctx.strokeStyle = COLOR_POOLED_SHOT;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    const poiRel = {
      x: group.shots.reduce((sum, s) => sum + s.x, 0) / group.shots.length,
      y: group.shots.reduce((sum, s) => sum + s.y, 0) / group.shots.length
    };
    const p = toPx(poiRel);
    ctx.fillStyle = COLOR_POI;
    ctx.beginPath();
    ctx.arc(p.x, p.y, poiRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = poiRadius * 0.5;
    ctx.stroke();

    // Drawn last (on top of the line and, since they can land close
    // together or overlap outright, the POI marker too) — same "always
    // topmost" placement as the live marking view's own renderGroupOverlay().
    if (extremeSpreadLabelText) drawLabel(ctx, extremeSpreadLabelText, (a.x + b.x) / 2, (a.y + b.y) / 2, canvas.width);
  }

  await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(filename, blob);
      resolve();
    }, 'image/png');
  });
}
