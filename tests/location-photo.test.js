import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDownscaledDimensions, MAX_DIMENSION_PX, shouldClearTargetCoords } from '../src/location-photo.js';

test('computeDownscaledDimensions leaves an already-small image untouched', () => {
  const result = computeDownscaledDimensions(800, 600);
  assert.deepEqual(result, { width: 800, height: 600, scaled: false });
});

test('computeDownscaledDimensions caps a too-wide image on its width', () => {
  const result = computeDownscaledDimensions(3200, 1600);
  assert.equal(result.scaled, true);
  assert.equal(result.width, MAX_DIMENSION_PX);
  assert.equal(result.height, 800);
});

test('computeDownscaledDimensions caps a too-tall image on its height', () => {
  const result = computeDownscaledDimensions(1200, 4800);
  assert.equal(result.scaled, true);
  assert.equal(result.height, MAX_DIMENSION_PX);
  assert.equal(result.width, 400);
});

test('computeDownscaledDimensions treats an exact-at-cap image as unscaled', () => {
  const result = computeDownscaledDimensions(MAX_DIMENSION_PX, 900);
  assert.deepEqual(result, { width: MAX_DIMENSION_PX, height: 900, scaled: false });
});

test('computeDownscaledDimensions preserves aspect ratio (to rounding) on a very large image', () => {
  const result = computeDownscaledDimensions(8000, 6000);
  assert.equal(result.scaled, true);
  assert.equal(result.width, MAX_DIMENSION_PX);
  assert.equal(result.height, Math.round(MAX_DIMENSION_PX * 6000 / 8000));
});

test('computeDownscaledDimensions honors a custom cap', () => {
  const result = computeDownscaledDimensions(2000, 1000, 1000);
  assert.deepEqual(result, { width: 1000, height: 500, scaled: true });
});

test('shouldClearTargetCoords is true when a location gets its first photo', () => {
  assert.equal(shouldClearTargetCoords(null, 'data:image/jpeg;base64,BBB'), true);
});

test('shouldClearTargetCoords is true when the photo is replaced with a genuinely different one', () => {
  assert.equal(shouldClearTargetCoords('data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'), true);
});

test('shouldClearTargetCoords is false when the photo is saved unchanged', () => {
  assert.equal(shouldClearTargetCoords('data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,AAA'), false);
});

test('shouldClearTargetCoords is true when the photo is removed', () => {
  assert.equal(shouldClearTargetCoords('data:image/jpeg;base64,AAA', null), true);
});

test('shouldClearTargetCoords is false with no photo before or after', () => {
  assert.equal(shouldClearTargetCoords(null, null), false);
});
