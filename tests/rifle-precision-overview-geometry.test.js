import test from 'node:test';
import assert from 'node:assert/strict';
import { computeVisibleCropRect } from '../src/rifle-precision-overview-geometry.js';

function approxEqual(actual, expected, msg, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${msg}: expected ${expected}, got ${actual}`);
}

test('scale=1, no pan, container narrower (relatively) than the image — full width, cropped height (letterboxed vertically)', () => {
  const rect = computeVisibleCropRect({
    scale: 1, tx: 0, ty: 0, containerWidth: 400, containerHeight: 300, photoWidth: 1000, photoHeight: 800
  });
  approxEqual(rect.x, 0, 'x');
  approxEqual(rect.y, 0, 'y');
  approxEqual(rect.width, 1000, 'width — full photo width visible');
  approxEqual(rect.height, 750, 'height — only 300/320 of the rendered image height fits, i.e. 0.9375 * 800');
});

test('scale=1, no pan, image and container share the same aspect ratio — the whole photo is visible', () => {
  const rect = computeVisibleCropRect({
    scale: 1, tx: 0, ty: 0, containerWidth: 400, containerHeight: 320, photoWidth: 1000, photoHeight: 800
  });
  approxEqual(rect.x, 0, 'x');
  approxEqual(rect.y, 0, 'y');
  approxEqual(rect.width, 1000, 'width');
  approxEqual(rect.height, 800, 'height');
});

test('zoomed in and panned — crops to the correct sub-rectangle', () => {
  const rect = computeVisibleCropRect({
    scale: 2, tx: -200, ty: -100, containerWidth: 400, containerHeight: 300, photoWidth: 1000, photoHeight: 800
  });
  // Horizontally: rawX0 = 200/(2*400) = 0.25, rawX1 = 0.25 + 400/(2*400) = 0.75
  approxEqual(rect.x, 250, 'x — 0.25 * 1000');
  approxEqual(rect.width, 500, 'width — 0.5 * 1000');
  // Vertically: baseHeight = 400*800/1000 = 320. rawY0 = 100/(2*320) = 0.15625,
  // rawY1 = 0.15625 + 300/(2*320) = 0.625
  approxEqual(rect.y, 125, 'y — 0.15625 * 800');
  approxEqual(rect.height, 375, 'height — (0.625-0.15625) * 800');
});

test('a pan/scale combination that would extend past the photo edge is clamped to [0,1] per corner, not the rectangle as a whole', () => {
  // scale=1 with tx/ty=0 already covers the full width; a huge negative ty
  // pushes the top edge into negative "content" territory, which must clamp
  // to 0 rather than reporting a negative y.
  const rect = computeVisibleCropRect({
    scale: 1, tx: 0, ty: -10000, containerWidth: 400, containerHeight: 320, photoWidth: 1000, photoHeight: 800
  });
  approxEqual(rect.y, 800, 'y clamps to the bottom of the photo');
  assert.ok(rect.height >= 1, 'height never collapses to zero or negative');
});

test('output is always at least 1x1 even for a degenerate/zero-area input', () => {
  const rect = computeVisibleCropRect({
    scale: 1, tx: -100000, ty: 0, containerWidth: 400, containerHeight: 320, photoWidth: 1000, photoHeight: 800
  });
  assert.ok(rect.width >= 1);
  assert.ok(rect.height >= 1);
});
