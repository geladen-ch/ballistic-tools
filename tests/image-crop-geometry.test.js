import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FULL_CROP_RECT, MIN_CROP_FRACTION, clamp, clamp01, isFullCropRect, clientPointToImageFraction, moveCorner
} from '../src/ui/image-crop-geometry.js';

test('clamp/clamp01 bound a value within range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp01(1.5), 1);
  assert.equal(clamp01(-0.5), 0);
});

test('isFullCropRect is true only for the exact full-frame rect', () => {
  assert.equal(isFullCropRect(FULL_CROP_RECT), true);
  assert.equal(isFullCropRect({ x0: 0, y0: 0, x1: 1, y1: 1 }), true);
  assert.equal(isFullCropRect({ x0: 0.01, y0: 0, x1: 1, y1: 1 }), false);
});

test('clientPointToImageFraction maps the image box\'s own corners/center correctly', () => {
  const imageRect = { left: 10, top: 20, width: 200, height: 100 };
  assert.deepEqual(clientPointToImageFraction({ clientX: 10, clientY: 20, imageRect }), { x: 0, y: 0 });
  assert.deepEqual(clientPointToImageFraction({ clientX: 210, clientY: 120, imageRect }), { x: 1, y: 1 });
  assert.deepEqual(clientPointToImageFraction({ clientX: 110, clientY: 70, imageRect }), { x: 0.5, y: 0.5 });
});

test('clientPointToImageFraction clamps a point outside the image box to its nearest edge', () => {
  const imageRect = { left: 0, top: 0, width: 200, height: 100 };
  assert.deepEqual(clientPointToImageFraction({ clientX: -50, clientY: 999, imageRect }), { x: 0, y: 1 });
});

test('moveCorner moves the dragged corner\'s own two coordinates, leaving the opposite corner fixed', () => {
  const rect = { x0: 0, y0: 0, x1: 1, y1: 1 };
  assert.deepEqual(moveCorner(rect, 'nw', 0.2, 0.3), { x0: 0.2, y0: 0.3, x1: 1, y1: 1 });
  assert.deepEqual(moveCorner(rect, 'se', 0.8, 0.7), { x0: 0, y0: 0, x1: 0.8, y1: 0.7 });
  assert.deepEqual(moveCorner(rect, 'ne', 0.6, 0.4), { x0: 0, y0: 0.4, x1: 0.6, y1: 1 });
  assert.deepEqual(moveCorner(rect, 'sw', 0.3, 0.6), { x0: 0.3, y0: 0, x1: 1, y1: 0.6 });
});

test('moveCorner never lets the dragged corner cross the opposite one closer than MIN_CROP_FRACTION', () => {
  const rect = { x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.6 };
  const moved = moveCorner(rect, 'se', 0.1, 0.1); // dragged past the opposite (nw) corner entirely
  assert.equal(moved.x1, rect.x0 + MIN_CROP_FRACTION);
  assert.equal(moved.y1, rect.y0 + MIN_CROP_FRACTION);
  assert.ok(moved.x1 > rect.x0 && moved.y1 > rect.y0, 'rect never inverts');
});

test('moveCorner clamps the dragged corner to the 0..1 image bounds', () => {
  const rect = { x0: 0, y0: 0, x1: 1, y1: 1 };
  assert.deepEqual(moveCorner(rect, 'nw', -5, -5), { x0: 0, y0: 0, x1: 1, y1: 1 });
  assert.deepEqual(moveCorner(rect, 'se', 5, 5), { x0: 0, y0: 0, x1: 1, y1: 1 });
});

test('moveCorner leaves an unknown corner untouched', () => {
  const rect = { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 };
  assert.deepEqual(moveCorner(rect, 'bogus', 0.5, 0.5), rect);
});
