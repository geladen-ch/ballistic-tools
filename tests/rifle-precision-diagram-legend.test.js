import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { computeLegendRows, diagramLegend } = await import('../src/ui/rifle-precision/diagram-legend.js');
const { setImpactColor, getImpactColorHex, resetImpactColorForTests } = await import('../src/hit-probability-prefs.js');

test.beforeEach(() => resetImpactColorForTests());

const identity = (m) => `${(m * 1000).toFixed(2)}mm`;

function baseStats() {
  return {
    poiM: { x: 0.001, y: -0.002 },
    poiCiM: { x: 0.0003, y: 0.0004 },
    sigma: 0.01, r50: 0.012, r95: 0.025, r95LowerBound: 0.02, r95UpperBound: 0.032, r99: 0.03
  };
}

test('computeLegendRows always includes all-impacts/POA/average-POI, in that order — all-impacts/POA carry no value, average-POI carries its signed H/V coordinates', () => {
  const rows = computeLegendRows(baseStats(), {}, identity);
  assert.equal(rows[0].label, t('riflePrecision.legendPooledShot'));
  assert.equal(rows[0].value, null);
  assert.equal(rows[1].label, t('riflePrecision.legendPoa'));
  assert.equal(rows[1].value, null);
  assert.equal(rows[2].label, t('riflePrecision.legendPoi'));
  // baseStats()'s poiM is in the engine's image frame (+y downward), so
  // y:-2 is a group 2mm ABOVE the point of aim and the row — which a human
  // reads against a turret — reports it as +2. See toShooterFrame().
  assert.equal(rows[2].value, 'H +1.00mm, V +2.00mm');
});

test('"All impacts" is the current translated text for the pooled-shot row (renamed from "Pooled shot")', () => {
  assert.equal(t('riflePrecision.legendPooledShot'), 'All impacts');
});

test('grid/POI-CI/sigma/R50/R99/ES5x/ES10x/1-MOA/hit-probability rows only appear when their option is truthy', () => {
  const rowsOff = computeLegendRows(baseStats(), {
    gridSpacingM: 0, showPoiCi: false, showSigma: false, showR50: false, showR99: false,
    showEs5x: false, showEs10x: false, oneMoaRadiusM: 0, hitProbabilityRadiusM: 0
  }, identity);
  for (const key of ['legendGrid', 'legendPoiCi', 'legendSigma', 'legendR50', 'legendR99', 'legendEs5x', 'legendEs10x', 'legendOneMoa', 'legendHitProbability']) {
    assert.ok(!rowsOff.some((r) => r.label === t(`riflePrecision.${key}`)), key);
  }

  const rowsOn = computeLegendRows(baseStats(), {
    gridSpacingM: 0.005, showPoiCi: true, showSigma: true, showR50: true, showR99: true,
    showEs5x: true, showEs10x: true, d5xM: 0.04, d10xM: 0.05, oneMoaRadiusM: 0.008, hitProbabilityRadiusM: 0.006
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
  const rows = computeLegendRows(baseStats(), { hitProbabilityRadiusM: 0.015, hitProbabilityPercent: 62 }, identity);
  const row = rows.find((r) => r.label === t('riflePrecision.legendHitProbability'));
  assert.ok(row);
  assert.equal(row.value, '62%: 15.00mm');
});

test('average-PoI row prepends "+" for zero/positive coordinates and keeps the formatter\'s own "-" for negatives, on each axis independently', () => {
  // y:+3.5 is image-frame, i.e. 3.5mm BELOW the point of aim — a rifle
  // shooting low, which the row reports as -3.50 after toShooterFrame().
  // Zero H and negative V exercise both branches of withSign() at once.
  const stats = { ...baseStats(), poiM: { x: 0, y: 0.0035 } };
  const rows = computeLegendRows(stats, {}, identity);
  const row = rows.find((r) => r.label === t('riflePrecision.legendPoi'));
  assert.equal(row.value, 'H +0.00mm, V -3.50mm');
});

test('average-PoI row never prints a negated zero as "-0.00"', () => {
  const rows = computeLegendRows({ ...baseStats(), poiM: { x: 0, y: 0 } }, {}, identity);
  const row = rows.find((r) => r.label === t('riflePrecision.legendPoi'));
  assert.equal(row.value, 'H +0.00mm, V +0.00mm');
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

test('the all-impacts swatch is the user\'s own Settings impact color, read per call rather than captured at import', () => {
  assert.equal(computeLegendRows(baseStats(), {}, identity)[0].color, getImpactColorHex());

  setImpactColor('red');
  assert.equal(computeLegendRows(baseStats(), {}, identity)[0].color, '#ff3b30', 'follows what the diagram itself just drew');
});
