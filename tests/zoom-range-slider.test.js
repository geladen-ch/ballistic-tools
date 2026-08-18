import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();

const { zoomRangeSlider } = await import('../src/ui/zoom-range-slider.js');

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

test('starts fully zoomed out over [0, minWindowM]', () => {
  const slider = zoomRangeSlider({ minWindowM: 20 });
  const { startM, endM } = slider.getWindow();
  assert.equal(startM, 0);
  assert.equal(endM, 20);
});

test('setBounds widens the window while staying fully zoomed out', () => {
  const slider = zoomRangeSlider({ minWindowM: 20 });
  slider.setBounds(1000);
  const { startM, endM } = slider.getWindow();
  assert.equal(startM, 0);
  assert.equal(endM, 1000);
});

test('regression: setBounds(NaN) is ignored rather than poisoning the sliders permanently', () => {
  const slider = zoomRangeSlider({ minWindowM: 20 });
  slider.setBounds(1000);

  slider.setBounds(NaN);
  const afterNaN = slider.getWindow();
  assert.ok(!Number.isNaN(afterNaN.startM), 'startM should not have become NaN');
  assert.ok(!Number.isNaN(afterNaN.endM), 'endM should not have become NaN');

  const [startInput, endInput] = findInputs(slider.node);
  assert.ok(!Number.isNaN(parseFloat(startInput.min)));
  assert.ok(!Number.isNaN(parseFloat(startInput.max)));
  assert.ok(!Number.isNaN(parseFloat(startInput.value)));
  assert.ok(!Number.isNaN(parseFloat(endInput.min)));
  assert.ok(!Number.isNaN(parseFloat(endInput.max)));
  assert.ok(!Number.isNaN(parseFloat(endInput.value)));

  // A subsequent valid call must still work normally.
  slider.setBounds(1500);
  const after = slider.getWindow();
  assert.equal(after.startM, 0);
  assert.equal(after.endM, 1500);
});

test('regression: setBounds(Infinity) is also ignored', () => {
  const slider = zoomRangeSlider({ minWindowM: 20 });
  slider.setBounds(1000);
  slider.setBounds(Infinity);
  const { startM, endM } = slider.getWindow();
  assert.equal(startM, 0);
  assert.equal(endM, 1000);
});

test('dragging the end slider inward is clamped to minWindowM from start, and reported by getWindow()', () => {
  const slider = zoomRangeSlider({ minWindowM: 20 });
  slider.setBounds(1000);
  const [, endInput] = findInputs(slider.node);

  endInput.value = '5'; // below the 20m floor
  fireEvent(endInput, 'input');

  const { startM, endM } = slider.getWindow();
  assert.equal(startM, 0);
  assert.ok(endM >= 20 - 1e-9, `expected endM clamped to >= 20, got ${endM}`);
});
