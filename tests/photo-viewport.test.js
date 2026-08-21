import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { photoViewport } = await import('../src/ui/locations/photo-viewport.js');

const TEST_PHOTO = 'data:image/gif;base64,AAA';

test('with no initialViewport, opens fully zoomed out and getViewport() reports the default', () => {
  const viewport = photoViewport({ photo: TEST_PHOTO });
  assert.deepEqual(viewport.getViewport(), { scale: 1, tx: 0, ty: 0 });
  // No transform applied at all — matches how this already behaved before
  // initialViewport existed (identity, so nothing to set).
  const inner = viewport.node.firstChild;
  assert.equal(inner.style.transform, undefined);
});

test('initialViewport seeds getViewport() immediately and applies the CSS transform up front', () => {
  const viewport = photoViewport({ photo: TEST_PHOTO, initialViewport: { scale: 2.5, tx: -40, ty: -15 } });
  assert.deepEqual(viewport.getViewport(), { scale: 2.5, tx: -40, ty: -15 });
  const inner = viewport.node.firstChild;
  assert.equal(inner.style.transform, 'translate(-40px, -15px) scale(2.5)');
});

test('zoomIn/zoomOut are reflected back through getViewport()', () => {
  const viewport = photoViewport({ photo: TEST_PHOTO });
  viewport.zoomIn();
  assert.equal(viewport.getViewport().scale, 1.5);
  viewport.zoomOut();
  assert.ok(Math.abs(viewport.getViewport().scale - 1) < 1e-9);
});
