import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const {
  buildConfidenceGaugeSvg, GAUGE_TITLE_SIZE, BAR_W, BAR_H, INFO_W, INFO_H, GAUGE_WIDGET_W, GAUGE_BLOCK_H
} = await import('../src/ui/rifle-precision/confidence-gauge-svg.js');
const { confidenceLevel, confidenceScaleFraction } = await import('../src/engine/rifle-precision-stats.js');
const { URURA_SCORES } = await import('../src/ui/rifle-precision/confidence-o-meter.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('the results pane is the same height as the scale (bar) — both fixed, only the pointer moves', () => {
  assert.equal(INFO_H, BAR_H);
  assert.equal(GAUGE_BLOCK_H, BAR_H);
});

test('buildConfidenceGaugeSvg draws the bar, all 5 band labels (real i18n text, uppercase as translated), and a lowercase threshold caption', () => {
  const g = buildConfidenceGaugeSvg(0.7, 1.25);
  const rects = findByTag(g, 'RECT');
  const bar = rects.find((r) => r.getAttribute('fill') === 'url(#rp-gauge-gradient)');
  assert.ok(bar, 'gradient bar renders');
  assert.equal(Number(bar.getAttribute('width')), BAR_W);
  assert.equal(Number(bar.getAttribute('height')), BAR_H);

  const texts = findByTag(g, 'TEXT').map((n) => n.textContent);
  for (const key of ['confidenceQualityMeaningless', 'confidenceQualityPoor', 'confidenceQualityFair', 'confidenceQualityGood', 'confidenceQualityExcellent']) {
    assert.ok(texts.includes(t(`riflePrecision.${key}`)), key);
  }
  assert.ok(texts.includes(t('riflePrecision.bullshitThresholdLabel')));
  assert.equal(t('riflePrecision.bullshitThresholdLabel'), '(bullshit threshold)', 'reused verbatim, already lowercase');
});

test('the results pane (fixed height, top-aligned with the bar) is filled with the level\'s own color and contains the quality/rating/margin text', () => {
  const confidenceLower = 0.55;
  const confidenceUpper = 1.45;
  const level = confidenceLevel(confidenceLower, confidenceUpper);
  const g = buildConfidenceGaugeSvg(confidenceLower, confidenceUpper);

  const rects = findByTag(g, 'RECT');
  const infoPane = rects.find((r) => Number(r.getAttribute('width')) === INFO_W);
  assert.ok(infoPane, 'results pane renders');
  assert.equal(Number(infoPane.getAttribute('height')), BAR_H, 'same height as the bar');

  const barY = GAUGE_TITLE_SIZE * 1.3 + 6;
  assert.equal(Number(infoPane.getAttribute('y')), barY, 'top-aligned with the bar, not centered on the pointer');

  const texts = findByTag(g, 'TEXT').map((n) => n.textContent);
  assert.ok(texts.some((line) => line.includes(URURA_SCORES[level])), 'URURA score renders');
  assert.ok(texts.some((line) => line.includes(t('riflePrecision.ururaLevelLabel'))), 'rating label renders');
  assert.ok(texts.some((line) => line.includes(t('riflePrecision.confidenceMarginLabel'))), 'margin label renders');
});

test('the pointer\'s own vertical position tracks confidenceScaleFraction() — it is the only element whose position depends on the reading', () => {
  const g1 = buildConfidenceGaugeSvg(0.9, 1.1); // narrow interval -> near the top
  const g2 = buildConfidenceGaugeSvg(0.3, 1.7); // wide interval -> near the bottom
  const pointer1 = findByTag(g1, 'POLYGON')[0];
  const pointer2 = findByTag(g2, 'POLYGON')[0];
  assert.ok(pointer1 && pointer2);
  assert.notEqual(pointer1.getAttribute('points'), pointer2.getAttribute('points'));

  const barY = GAUGE_TITLE_SIZE * 1.3 + 6;
  const fraction1 = confidenceScaleFraction(0.9, 1.1);
  const expectedY1 = barY + BAR_H - fraction1 * BAR_H;
  // The triangle's own middle point (the tip) is the middle coordinate pair.
  const tipY1 = Number(pointer1.getAttribute('points').split(' ')[2].split(',')[1]);
  assert.ok(Math.abs(tipY1 - expectedY1) < 1e-6);
});

test('buildConfidenceGaugeSvg positions itself at the given (x, y) offset', () => {
  const g = buildConfidenceGaugeSvg(0.8, 1.2, { x: 50, y: 30 });
  assert.equal(g.getAttribute('transform'), 'translate(50,30)');
});

test('GAUGE_WIDGET_W accounts for the bar, pointer connector, and results pane widths', () => {
  assert.ok(GAUGE_WIDGET_W > BAR_W + INFO_W, 'includes room for the pointer connector too');
  assert.ok(GAUGE_WIDGET_W < BAR_W + INFO_W + 100, 'not excessively wide');
});
