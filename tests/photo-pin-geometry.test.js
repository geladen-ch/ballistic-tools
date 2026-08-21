import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp, clamp01, clientPointToRelative, clampPan, computeDistance, computeMidpoint, zoomAboutPoint,
  MIN_SCALE, MAX_SCALE
} from '../src/ui/locations/photo-pin-geometry.js';

test('clamp/clamp01 bound a value within range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp01(1.5), 1);
  assert.equal(clamp01(-0.5), 0);
});

test('clientPointToRelative maps the center of an untransformed square image to (0.5, 0.5)', () => {
  const containerRect = { left: 0, top: 0, width: 200 };
  const result = clientPointToRelative({
    clientX: 100, clientY: 100, containerRect, tx: 0, ty: 0, scale: 1, naturalWidth: 400, naturalHeight: 400
  });
  assert.equal(result.x, 0.5);
  assert.equal(result.y, 0.5);
});

test('clientPointToRelative accounts for a non-square (portrait) image', () => {
  const containerRect = { left: 0, top: 0, width: 200 }; // baseHeight = 200 * (800/400) = 400
  const result = clientPointToRelative({
    clientX: 50, clientY: 100, containerRect, tx: 0, ty: 0, scale: 1, naturalWidth: 400, naturalHeight: 800
  });
  assert.equal(result.x, 0.25);
  assert.equal(result.y, 0.25);
});

test('clientPointToRelative clamps a point outside the image to the nearest edge', () => {
  const containerRect = { left: 0, top: 0, width: 200 };
  const result = clientPointToRelative({
    clientX: -50, clientY: 999, containerRect, tx: 0, ty: 0, scale: 1, naturalWidth: 400, naturalHeight: 400
  });
  assert.equal(result.x, 0);
  assert.equal(result.y, 1);
});

test('clientPointToRelative accounts for the widget\'s own offset and current pan/zoom transform', () => {
  const containerRect = { left: 10, top: 20, width: 100 };
  // At scale 2 with tx=-50, content point (100,100) in un-transformed
  // local space renders at (100*2 - 50, 100*2) = (150, 200) local.
  const result = clientPointToRelative({
    clientX: 10 + 150, clientY: 20 + 200, containerRect, tx: -50, ty: 0, scale: 2, naturalWidth: 100, naturalHeight: 100
  });
  assert.ok(Math.abs(result.x - 1) < 1e-9);
  assert.ok(Math.abs(result.y - 1) < 1e-9);
});

test('clampPan forces tx=ty=0 at scale=1 (no dead space to pan into) when the image exactly fills the container', () => {
  assert.deepEqual(clampPan(50, -50, 1, 300, 200, 200), { tx: 0, ty: 0 });
});

test('clampPan allows panning within the extra room a zoomed-in image has, and clamps beyond it, when the image exactly fills the container', () => {
  // At scale 2, a 300-wide container has 300px of extra width (150 either
  // side once centered at tx=-150), so tx ranges over [-300, 0]; same for
  // height here since contentHeight (200) matches containerHeight (200).
  assert.deepEqual(clampPan(-100, -50, 2, 300, 200, 200), { tx: -100, ty: -50 });
  assert.deepEqual(clampPan(100, 100, 2, 300, 200, 200), { tx: 0, ty: 0 });
  assert.deepEqual(clampPan(-9999, -9999, 2, 300, 200, 200), { tx: -300, ty: -200 });
});

test('clampPan lets a portrait image already taller than the container pan vertically even at scale=1', () => {
  // A 400-wide, 800-tall image (contentHeight=800) inside a 400x300
  // container already overflows vertically before any zoom — this is the
  // "hits a border limit before the actual image edge" bug: with the old
  // formula (which used containerHeight=300 for both the range check and
  // the range itself) this would have been wrongly forced to ty=0.
  assert.deepEqual(clampPan(0, 0, 1, 400, 300, 800), { tx: 0, ty: 0 });
  assert.deepEqual(clampPan(0, -500, 1, 400, 300, 800), { tx: 0, ty: -500 });
  assert.deepEqual(clampPan(0, -9999, 1, 400, 300, 800), { tx: 0, ty: -500 }, 'clamped at the true bottom edge: 300 - 800');
});

test('clampPan pins a landscape image shorter than the container to ty=0 (letterboxed) as long as it stays shorter once zoomed', () => {
  // A 400-wide, 200-tall image (contentHeight=200) inside a 400x500
  // container: at scale=2 it's still only 400px tall, still short of the
  // 500px container, so still no vertical panning — the old formula would
  // instead have derived the range from containerHeight*scale, wrongly
  // permitting a large pan into blank space below the image.
  assert.deepEqual(clampPan(0, 50, 1, 400, 500, 200), { tx: 0, ty: 0 });
  assert.deepEqual(clampPan(0, -50, 2, 400, 500, 200), { tx: 0, ty: 0 });
});

test('computeDistance/computeMidpoint compute plane geometry between two points', () => {
  assert.equal(computeDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.deepEqual(computeMidpoint({ x: 0, y: 0 }, { x: 4, y: 10 }), { x: 2, y: 5 });
});

test('zoomAboutPoint keeps the content point under the pinch midpoint fixed before and after', () => {
  const before = { tx: -20, ty: -10, scale: 1.5 };
  const midpointLocal = { x: 80, y: 60 };
  // The content point under the midpoint before zooming:
  const contentBefore = { x: (midpointLocal.x - before.tx) / before.scale, y: (midpointLocal.y - before.ty) / before.scale };

  const newScale = 3;
  const after = zoomAboutPoint(before, midpointLocal, newScale);
  const contentAfter = { x: (midpointLocal.x - after.tx) / newScale, y: (midpointLocal.y - after.ty) / newScale };

  assert.ok(Math.abs(contentAfter.x - contentBefore.x) < 1e-9);
  assert.ok(Math.abs(contentAfter.y - contentBefore.y) < 1e-9);
});

test('MIN_SCALE/MAX_SCALE bound the zoom range used by the pin widget', () => {
  assert.equal(MIN_SCALE, 1);
  assert.ok(MAX_SCALE > MIN_SCALE);
});
