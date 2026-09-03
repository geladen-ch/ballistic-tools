import test from 'node:test';
import assert from 'node:assert/strict';
import {
  circleGongGeometry, rectPlateGeometry,
  circleGongResultSvg, rectPlateResultSvg,
  circleGongDetailSvg, rectPlateDetailSvg
} from '../src/targets/custom-target-render.js';

test('circleGongGeometry derives widthM/heightM/aspectRatio/resultSvg from a diameter in cm', () => {
  const geometry = circleGongGeometry(25);
  assert.equal(geometry.widthM, 0.25);
  assert.equal(geometry.heightM, 0.25);
  assert.equal(geometry.aspectRatio, 1);
  assert.equal(geometry.resultSvg.pointOfAim.x, 125);
  assert.equal(geometry.resultSvg.pointOfAim.y, 125);
  assert.equal(geometry.resultSvg.pxPerMeter, 1000);
});

test('rectPlateGeometry derives widthM/heightM/aspectRatio/resultSvg from width/height in cm', () => {
  const geometry = rectPlateGeometry(40, 50);
  assert.equal(geometry.widthM, 0.4);
  assert.equal(geometry.heightM, 0.5);
  assert.equal(geometry.aspectRatio, 1.25);
  assert.equal(geometry.resultSvg.pointOfAim.x, 200);
  assert.equal(geometry.resultSvg.pointOfAim.y, 250);
  assert.equal(geometry.resultSvg.pxPerMeter, 1000);
});

test('circleGongResultSvg renders a real-scale (1 unit = 1mm) disk matching the given diameter', () => {
  const svg = circleGongResultSvg(250);
  assert.match(svg, /viewBox="0 0 250 250"/);
  assert.match(svg, /<circle cx="125" cy="125" r="125"/);
});

test('rectPlateResultSvg renders a real-scale outline rect inset for its stroke width, matching the given dimensions', () => {
  const svg = rectPlateResultSvg(400, 500);
  assert.match(svg, /viewBox="0 0 400 500"/);
  assert.match(svg, /<rect x="3" y="3" width="394" height="494"/);
});

test('circleGongDetailSvg embeds the given label and stays within the schematic 300x280 viewBox', () => {
  const svg = circleGongDetailSvg('Ø 250 mm');
  assert.match(svg, /viewBox="0 0 300 280"/);
  assert.match(svg, />Ø 250 mm<\/text>/);
});

test('rectPlateDetailSvg scales the schematic rect to the real aspect ratio and embeds the given label', () => {
  const svg = rectPlateDetailSvg(400, 500, '400 × 500 mm');
  assert.match(svg, /viewBox="0 0 300 280"/);
  assert.match(svg, />400 × 500 mm<\/text>/);
  // 400x500 is a 4:5 aspect ratio (taller than wide) — the schematic rect
  // should come out taller than it is wide too.
  const widthMatch = svg.match(/\swidth="([\d.]+)"/);
  const heightMatch = svg.match(/\sheight="([\d.]+)"/);
  assert.ok(parseFloat(heightMatch[1]) > parseFloat(widthMatch[1]));
});

test('rectPlateDetailSvg on a square target renders a square schematic rect', () => {
  const svg = rectPlateDetailSvg(1000, 1000, '1 × 1 m');
  const widthMatch = svg.match(/\swidth="([\d.]+)"/);
  const heightMatch = svg.match(/\sheight="([\d.]+)"/);
  assert.equal(widthMatch[1], heightMatch[1]);
});
