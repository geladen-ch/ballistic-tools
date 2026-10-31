import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reticleZoomExtent, reticleZoomFit, reticleZoomStops, stepReticleZoom,
  RETICLE_ZOOM_FILL, RETICLE_ZOOM_MIN, RETICLE_ZOOM_MAX, RETICLE_ZOOM_UNFITTED
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
  close(extent.x, 0.003);
  close(extent.y, 0.012);
  close(reticleZoomFit(extent, R), RETICLE_ZOOM_FILL * R / 0.012);
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
  assert.deepEqual(reticleZoomExtent([{ type: 'bdc', y: 0.02 }], R), { x: 0, y: 0 });
});

test('the fit: within 1× to 10×, and the unfitted default with nothing to fit', () => {
  const at = (reach) => reticleZoomFit({ x: reach, y: 0 }, R);
  assert.equal(at(R), RETICLE_ZOOM_MIN, 'a reticle filling the field opens at 1×');
  assert.equal(at(0.001), RETICLE_ZOOM_MAX, 'a tiny one is capped');
  close(at(0.012), 4.5);
  assert.equal(reticleZoomFit(reticleZoomExtent([vbar(0.01, 0.06), hline(-0.07, 0.07)], R), R), RETICLE_ZOOM_UNFITTED);
  assert.equal(reticleZoomFit(reticleZoomExtent([], R), R), RETICLE_ZOOM_UNFITTED);
});

test('the − / + stops: whole zooms and the fit, stepping to the ends and no further', () => {
  assert.deepEqual(reticleZoomStops(3.4), [1, 2, 3, 3.4, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(reticleZoomStops(5), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'a whole fit is not doubled');
  assert.equal(stepReticleZoom(3.4, 1, 3.4), 4);
  assert.equal(stepReticleZoom(3.4, -1, 3.4), 3);
  assert.equal(stepReticleZoom(3, 1, 3.4), 3.4, 'the fit can be stepped back to');
  assert.equal(stepReticleZoom(10, 1, 3.4), 10);
  assert.equal(stepReticleZoom(1, -1, 3.4), 1);
});
