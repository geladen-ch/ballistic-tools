import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { computeLegendRows, diagramLegend } = await import('../src/ui/rifle-precision/diagram-legend.js');

const identity = (mm) => `${mm.toFixed(2)}mm`;

function baseStats() {
  return {
    poiMm: { x: 1, y: -2 },
    poiCiMm: { x: 0.3, y: 0.4 },
    sigma: 10, r50: 12, r95: 25, r95LowerBound: 20, r95UpperBound: 32, r99: 30
  };
}

test('computeLegendRows always includes all-impacts/POA/average-POI, in that order — all-impacts/POA carry no value, average-POI carries its signed H/V coordinates', () => {
  const rows = computeLegendRows(baseStats(), {}, identity);
  assert.equal(rows[0].label, t('riflePrecision.legendPooledShot'));
  assert.equal(rows[0].value, null);
  assert.equal(rows[1].label, t('riflePrecision.legendPoa'));
  assert.equal(rows[1].value, null);
  assert.equal(rows[2].label, t('riflePrecision.legendPoi'));
  assert.equal(rows[2].value, 'H +1.00mm, V -2.00mm');
});

test('"All impacts" is the current translated text for the pooled-shot row (renamed from "Pooled shot")', () => {
  assert.equal(t('riflePrecision.legendPooledShot'), 'All impacts');
});

test('grid/POI-CI/sigma/R50/R99/ES5x/ES10x/1-MOA/hit-probability rows only appear when their option is truthy', () => {
  const rowsOff = computeLegendRows(baseStats(), {
    gridSpacingMm: 0, showPoiCi: false, showSigma: false, showR50: false, showR99: false,
    showEs5x: false, showEs10x: false, oneMoaRadiusMm: 0, hitProbabilityRadiusMm: 0
  }, identity);
  for (const key of ['legendGrid', 'legendPoiCi', 'legendSigma', 'legendR50', 'legendR99', 'legendEs5x', 'legendEs10x', 'legendOneMoa', 'legendHitProbability']) {
    assert.ok(!rowsOff.some((r) => r.label === t(`riflePrecision.${key}`)), key);
  }

  const rowsOn = computeLegendRows(baseStats(), {
    gridSpacingMm: 5, showPoiCi: true, showSigma: true, showR50: true, showR99: true,
    showEs5x: true, showEs10x: true, d5xMm: 40, d10xMm: 50, oneMoaRadiusMm: 8, hitProbabilityRadiusMm: 6
  }, identity);
  for (const key of ['legendGrid', 'legendPoiCi', 'legendSigma', 'legendR50', 'legendR99', 'legendEs5x', 'legendEs10x', 'legendOneMoa', 'legendHitProbability']) {
    assert.ok(rowsOn.some((r) => r.label === t(`riflePrecision.${key}`)), key);
  }
});

test('R95 and R95-CI are independent rows, each gated by its own flag, R95-CI value is the delta from R95', () => {
  const rowsBoth = computeLegendRows(baseStats(), { showR95: true, showR95Ci: true }, identity);
  assert.ok(rowsBoth.some((r) => r.label === t('riflePrecision.legendR95')));
  const ciRow = rowsBoth.find((r) => r.label === t('riflePrecision.legendR95Ci'));
  assert.ok(ciRow);
  assert.equal(ciRow.value, '-5.00mm/+7.00mm'); // r95=25, lowerBound=20 (delta 5), upperBound=32 (delta 7)

  const r95Only = computeLegendRows(baseStats(), { showR95: true, showR95Ci: false }, identity);
  assert.ok(r95Only.some((r) => r.label === t('riflePrecision.legendR95')));
  assert.ok(!r95Only.some((r) => r.label === t('riflePrecision.legendR95Ci')));

  const ciOnly = computeLegendRows(baseStats(), { showR95: false, showR95Ci: true }, identity);
  assert.ok(!ciOnly.some((r) => r.label === t('riflePrecision.legendR95')));
  assert.ok(ciOnly.some((r) => r.label === t('riflePrecision.legendR95Ci')));
});

test('hit-probability row\'s value leads with the percent, before the radius, matching the slider\'s own readout style', () => {
  const rows = computeLegendRows(baseStats(), { hitProbabilityRadiusMm: 15, hitProbabilityPercent: 62 }, identity);
  const row = rows.find((r) => r.label === t('riflePrecision.legendHitProbability'));
  assert.ok(row);
  assert.equal(row.value, '62%: 15.00mm');
});

test('average-PoI row prepends "+" for zero/positive coordinates and keeps the formatter\'s own "-" for negatives, on each axis independently', () => {
  const stats = { ...baseStats(), poiMm: { x: 0, y: 3.5 } };
  const rows = computeLegendRows(stats, {}, identity);
  const row = rows.find((r) => r.label === t('riflePrecision.legendPoi'));
  assert.equal(row.value, 'H +0.00mm, V +3.50mm');
});

test('POI-CI row formats its H/V value with a ± prefix through the given formatter', () => {
  const rows = computeLegendRows(baseStats(), { showPoiCi: true }, identity);
  const row = rows.find((r) => r.label === t('riflePrecision.legendPoiCi'));
  assert.equal(row.value, 'H ±0.30mm, V ±0.40mm');
});

test('diagramLegend().node is a <table> with one row per computeLegendRows() entry, a swatch/description/value column each', () => {
  const legend = diagramLegend();
  legend.update(baseStats(), { showSigma: true }, identity);
  assert.equal(legend.node.tagName, 'TABLE');
  const bodyRows = legend.node.childNodes.find((c) => c.tagName === 'TBODY').childNodes;
  const expected = computeLegendRows(baseStats(), { showSigma: true }, identity);
  assert.equal(bodyRows.length, expected.length);
  assert.equal(bodyRows[0].childNodes.length, 3, 'swatch, description, value columns');
});
