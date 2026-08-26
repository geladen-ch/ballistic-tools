import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const {
  analysisDiagram, buildStandaloneDiagramSvg, buildExportSvgWithLegend, wrapText
} = await import('../src/ui/rifle-precision/analysis-diagram.js');
const { GAUGE_WIDGET_W } = await import('../src/ui/rifle-precision/confidence-gauge-svg.js');

function findByAttr(node, attr, value, out = []) {
  if (node.getAttribute && node.getAttribute(attr) === value) out.push(node);
  for (const child of node.childNodes || []) findByAttr(child, attr, value, out);
  return out;
}
function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function makeStats() {
  return {
    poiMm: { x: 1, y: -1 },
    poiCiMm: { x: 0.3, y: 0.4 },
    sigma: 10, r50: 12, r95: 25, r95LowerBound: 20, r95UpperBound: 32, r99: 30,
    pooledShots: [{ xMm: 0, yMm: 0 }, { xMm: 2, yMm: 1 }, { xMm: -1, yMm: 3 }]
  };
}

test('buildStandaloneDiagramSvg renders the same permanent + optional content as analysisDiagram()\'s own live update() for identical stats/options', () => {
  const stats = makeStats();
  const options = { showSigma: true, showR50: true, showR99: true, showEs5x: true, showEs10x: true, d5xMm: 40, d10xMm: 50 };

  const live = analysisDiagram();
  live.update(stats, options);
  const standalone = buildStandaloneDiagramSvg(stats, options);

  for (const role of ['pooled-shot', 'poa-marker', 'poi-marker', 'sigma-circle', 'r50-circle', 'r99-circle', 'es5x-circle', 'es10x-circle', 'r95-circle']) {
    assert.equal(findByAttr(standalone, 'data-role', role).length, findByAttr(live.node, 'data-role', role).length, role);
  }
  assert.equal(standalone.getAttribute('viewBox'), live.node.getAttribute('viewBox'));
});

test('buildStandaloneDiagramSvg is a fresh, detached node — not the live diagram\'s own node', () => {
  const stats = makeStats();
  const live = analysisDiagram();
  live.update(stats, {});
  const standalone = buildStandaloneDiagramSvg(stats, {});
  assert.notEqual(standalone, live.node);
});

test('buildStandaloneDiagramSvg adds a white background rect behind the graphics, but the live on-page diagram has none (its background stays CSS-only)', () => {
  const stats = makeStats();
  const standalone = buildStandaloneDiagramSvg(stats, {});
  const rects = findByTag(standalone, 'RECT').filter((r) => r.getAttribute('fill') === '#ffffff');
  assert.equal(rects.length, 1, 'exactly one white background rect');
  assert.equal(standalone.childNodes[0], rects[0], 'the background sits behind every other graphic (first child)');

  const live = analysisDiagram();
  live.update(stats, {});
  assert.equal(findByTag(live.node, 'RECT').filter((r) => r.getAttribute('fill') === '#ffffff').length, 0, 'no background rect added to the live diagram');
});

test('ES5x/ES10x circles only render when their own toggle is on and the value is positive, with radius = value / 2', () => {
  const stats = makeStats();
  const svg = buildStandaloneDiagramSvg(stats, { showEs5x: true, showEs10x: true, d5xMm: 40, d10xMm: 50 });
  const es5x = findByAttr(svg, 'data-role', 'es5x-circle')[0];
  const es10x = findByAttr(svg, 'data-role', 'es10x-circle')[0];
  assert.equal(Number(es5x.getAttribute('r')), 20);
  assert.equal(Number(es10x.getAttribute('r')), 25);

  const svgOff = buildStandaloneDiagramSvg(stats, { showEs5x: false, showEs10x: false, d5xMm: 40, d10xMm: 50 });
  assert.equal(findByAttr(svgOff, 'data-role', 'es5x-circle').length, 0);
  assert.equal(findByAttr(svgOff, 'data-role', 'es10x-circle').length, 0);
});

test('the R95 confidence band is a soft, translucent fill (no crisp outline) and is independently toggled from the R95 circle itself', () => {
  const stats = makeStats();
  const svg = buildStandaloneDiagramSvg(stats, { showR95: false, showR95Ci: true });
  assert.equal(findByAttr(svg, 'data-role', 'r95-circle').length, 0, 'R95 circle itself stays off');
  const band = findByAttr(svg, 'data-role', 'r95-band')[0];
  assert.ok(band, 'the band still renders, independent of the R95 circle toggle');
  assert.equal(band.getAttribute('fill'), 'none');
  assert.ok(Number(band.getAttribute('stroke-opacity')) < 1, 'translucent, not a hard-edged border');
});

test('the POI confidence box is optional (off by default via the diagram\'s own showPoiCi option)', () => {
  const stats = makeStats();
  assert.equal(findByAttr(buildStandaloneDiagramSvg(stats, {}), 'data-role', 'poi-ci-box').length, 0);
  assert.equal(findByAttr(buildStandaloneDiagramSvg(stats, { showPoiCi: true }), 'data-role', 'poi-ci-box').length, 1);
});

const headerLinesFixture = [
  { text: 'Home Range — 100 m, 7.62mm', weight: 'bold', size: 24 },
  { text: '5 shot(s)', weight: 'normal', size: 15 }
];

test('buildExportSvgWithLegend embeds the diagram, the confidence gauge, and the legend, with a canvas at least 600 tall and 1180 wide for a small (non-wrapping) case', () => {
  const stats = makeStats();
  const legendRows = [
    { color: '#111', shape: 'dot', label: 'All impacts', value: null },
    { color: '#222', shape: 'ring', label: 'R95', value: '25.00mm' }
  ];

  const svg = buildExportSvgWithLegend(stats, { showR95: true }, legendRows, headerLinesFixture, 0.68, 1.32);
  assert.equal(Number(svg.getAttribute('height')), 600, 'small content — diagram/canvas stay at the normal 600 size');
  assert.equal(Number(svg.getAttribute('width')), 600 + 580, 'diagram size + the fixed 580px panel width');

  const diagram = svg.childNodes.find((c) => c.tagName === 'SVG');
  assert.ok(diagram, 'the diagram itself is embedded');
  assert.ok(findByAttr(diagram, 'data-role', 'pooled-shot').length > 0, 'embedded diagram actually has content, not an empty shell');

  // Gauge: gradient bar + all 5 band labels + threshold caption, all real i18n text.
  assert.equal(findByTag(svg, 'LINEARGRADIENT').length, 1, 'the bar\'s gradient is defined');
  const texts = findByTag(svg, 'TEXT').map((n) => n.textContent);
  for (const key of ['confidenceQualityMeaningless', 'confidenceQualityPoor', 'confidenceQualityFair', 'confidenceQualityGood', 'confidenceQualityExcellent']) {
    assert.ok(texts.includes(t(`riflePrecision.${key}`)), key);
  }
  assert.ok(texts.includes(t('riflePrecision.bullshitThresholdLabel')), 'the lowercase threshold caption renders, reusing the app\'s own translated string');

  for (const line of headerLinesFixture) assert.ok(texts.includes(line.text), line.text);
  for (const row of legendRows) {
    const expected = row.value ? `${row.label}: ${row.value}` : row.label;
    assert.ok(texts.includes(expected), expected);
  }
});

test('buildExportSvgWithLegend grows the canvas height (and scales the diagram to match) once the real content — e.g. a long legend — needs more room than 600px', () => {
  const stats = makeStats();
  const manyRows = Array.from({ length: 13 }, (_, i) => (
    { color: '#222', shape: 'ring', label: `Row ${i}`, value: '12.34mm' }
  ));
  const svg = buildExportSvgWithLegend(stats, {}, manyRows, headerLinesFixture, 0.68, 1.32);
  const h = Number(svg.getAttribute('height'));
  assert.ok(h > 600, `expected the canvas to grow past 600 for 13 rows, got ${h}`);

  const diagram = svg.childNodes.find((c) => c.tagName === 'SVG');
  assert.equal(Number(diagram.getAttribute('width')), h, 'the diagram scales up to match — always the same height as the panel');
  assert.equal(Number(svg.getAttribute('width')), h + 580);
});

test('buildExportSvgWithLegend honors each header line\'s own weight — it is not hardcoded to "only the first line is bold"', () => {
  const stats = makeStats();
  const headerLines = [
    { text: 'Normal first line', weight: 'normal', size: 15 },
    { text: 'Bold second line', weight: 'bold', size: 24 }
  ];
  const svg = buildExportSvgWithLegend(stats, {}, [], headerLines, 0.68, 1.32);
  const texts = findByTag(svg, 'TEXT');

  const first = texts.find((n) => n.textContent === 'Normal first line');
  const second = texts.find((n) => n.textContent === 'Bold second line');
  assert.ok(first && second);
  assert.notEqual(first.getAttribute('font-weight'), 'bold');
  assert.equal(second.getAttribute('font-weight'), 'bold');
});

test('buildExportSvgWithLegend wraps a long header line at the confidence gauge\'s own width, not the full panel', () => {
  const stats = makeStats();
  const longLine = 'This confidence interval is unusually wide because there were very few shots recorded in this particular session';
  const headerLines = [{ text: longLine, weight: 'bold', size: 24 }];
  const svg = buildExportSvgWithLegend(stats, {}, [], headerLines, 0.68, 1.32);
  const texts = findByTag(svg, 'TEXT').map((n) => n.textContent);
  const expectedWrapped = wrapText(longLine, GAUGE_WIDGET_W, 24);

  assert.ok(expectedWrapped.length > 1, 'sanity: the fixture text actually needs to wrap at this width');
  assert.ok(!texts.includes(longLine), 'the long header line is not left as one overflowing line');
  for (const line of expectedWrapped) assert.ok(texts.includes(line), `expected wrapped line: "${line}"`);
});

test('buildExportSvgWithLegend wraps a legend entry\'s text across multiple <text> lines once it would overflow the panel', () => {
  const stats = makeStats();
  const longLabel = 'Circular error probable, the radius of a circle where 50% of impacts are expected to fall';
  const legendRows = [{ color: '#222', shape: 'ring', label: longLabel, value: '12.34mm' }];

  const svg = buildExportSvgWithLegend(stats, {}, legendRows, [], 0.68, 1.32);
  const texts = findByTag(svg, 'TEXT').map((n) => n.textContent);
  const legendColW = 580 - 24 * 2; // EXPORT_PANEL_W - EXPORT_MARGIN*2
  const swatchSize = 15 * 0.9;
  const expectedWrapped = wrapText(`${longLabel}: 12.34mm`, legendColW - swatchSize * 1.8, 15);

  assert.ok(expectedWrapped.length > 1, 'sanity: the fixture text actually needs to wrap at this width');
  assert.ok(!texts.includes(`${longLabel}: 12.34mm`), 'no single line still holds the whole unwrapped string');
  for (const line of expectedWrapped) assert.ok(texts.includes(line), `expected wrapped line: "${line}"`);
});

test('buildExportSvgWithLegend stacks a wrapped row\'s swatch with its first line and pushes the next row down to clear every wrapped line', () => {
  const stats = makeStats();
  const longLabel = 'Circular error probable, the radius of a circle where 50% of impacts are expected to fall';
  const legendRows = [
    { color: '#222', shape: 'ring', label: longLabel, value: '12.34mm' },
    { color: '#333', shape: 'dot', label: 'Short row', value: null }
  ];

  const svg = buildExportSvgWithLegend(stats, {}, legendRows, [], 0.68, 1.32);
  const texts = findByTag(svg, 'TEXT');
  const shortRowText = texts.find((n) => n.textContent === 'Short row');
  assert.ok(shortRowText, 'the second row still renders');

  const firstRowLines = texts.filter((n) => n.textContent !== 'Short row' && n.textContent.length > 0);
  const lastFirstRowY = Math.max(...firstRowLines.map((n) => Number(n.getAttribute('y'))));
  assert.ok(Number(shortRowText.getAttribute('y')) > lastFirstRowY, 'second row starts below every wrapped line of the first');
});
