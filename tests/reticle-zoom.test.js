import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reticleZoomExtent, reticleZoomFactor, RETICLE_ZOOM_FILL, RETICLE_ZOOM_MAX
} from '../src/reticle/reticle-zoom.js';

const R = 0.06;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} ≠ ${b}`);
const dot = (x, y, diameter = 0.001) => ({ type: 'dot', x, y, diameter });
const hline = (x, endX, y = 0, width = 0.0002) => ({ type: 'hline', x, y, endX, width });
const vline = (y, endY, x = 0, width = 0.0002) => ({ type: 'vline', x, y, endY, width });
const vbar = (y, endY) => ({ type: 'vbar', x: 0, y, endY, nominalWidth: 0.004, endWidth: 0.001, thinningLength: 0.01 });
const hbar = (x, endX) => ({ type: 'hbar', x, y: 0, endX, nominalWidth: 0.004, endWidth: 0.001, thinningLength: 0.01 });

test('the extent is the farthest reach from the centre on each axis, not the bounding box', () => {
  // A tree hanging only below the centre.
  const extent = reticleZoomExtent([vline(0.001, 0.012), hline(-0.003, 0.003, 0.008)], R);
  assert.equal(extent.drawn, true);
  close(extent.x, 0.003);
  close(extent.y, 0.012);
  const { available, factor } = reticleZoomFactor(extent, R);
  assert.equal(available, true);
  close(factor, RETICLE_ZOOM_FILL * R / 0.012);
});

test('thinning bars and lines reaching the fill fraction of the radius do not count; shorter lines do', () => {
  const frame = [vbar(0.02, 0.06), hbar(-0.02, -0.07), hline(0.01, 0.06), vline(-0.054, 0.002)];
  const extent = reticleZoomExtent([...frame, hline(-0.004, 0.004), dot(0, 0.002)], R);
  close(extent.x, 0.004);
  close(extent.y, 0.0025);
  // Just under the fill reach, a line counts.
  close(reticleZoomExtent([hline(0, 0.05)], R).x, 0.05);
});

test('mirrored and repeated copies count; BDC marks draw nothing', () => {
  let extent = reticleZoomExtent([{ ...hline(0.002, 0.012), mirror: true }], R);
  close(extent.x, 0.012);
  extent = reticleZoomExtent([{ ...dot(0, 0.001, 0), repeat: { enabled: true, count: 4, step: 0.003, direction: 'down' } }], R);
  close(extent.y, 0.013);
  extent = reticleZoomExtent([{ type: 'bdc', y: 0.02 }], R);
  assert.deepEqual(extent, { drawn: false, x: 0, y: 0 });
});

test('the factor: offered only below the fill, capped, and the cap when nothing counts', () => {
  const at = (reach) => reticleZoomFactor({ drawn: true, x: reach, y: 0 }, R);
  assert.equal(at(RETICLE_ZOOM_FILL * R).available, false);
  assert.equal(at(R).available, false);
  assert.equal(at(RETICLE_ZOOM_FILL * R * 0.999).available, true);
  assert.equal(at(0.001).factor, RETICLE_ZOOM_MAX);
  // Bars and frame lines only.
  const framesOnly = reticleZoomFactor(reticleZoomExtent([vbar(0.01, 0.06), hline(-0.07, 0.07)], R), R);
  assert.deepEqual(framesOnly, { available: true, factor: RETICLE_ZOOM_MAX });
  // Nothing drawn at all.
  assert.equal(reticleZoomFactor(reticleZoomExtent([], R), R).available, false);
  assert.equal(reticleZoomFactor(reticleZoomExtent([{ type: 'bdc', y: 0 }], R), R).available, false);
});
