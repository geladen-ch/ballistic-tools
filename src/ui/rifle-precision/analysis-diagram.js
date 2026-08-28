// Pooled-shot scatterplot for the analysis view (src/views/rifle-precision-analysis-view.js),
// hand-built as real SVG DOM via svgEl() (not string concatenation) — the
// SVG export button serializes this exact <svg> node with XMLSerializer,
// so every visible element genuinely has to exist in the DOM tree, not be
// baked into a raster or a <canvas>. Ports the coordinate-space idea of
// legacy's synth-pane.js (a scatter of pooled shots plus overlay circles
// around the pooled POI) but as a fresh, composable element-tree builder,
// not a byte-for-byte port — legacy's own drawing code is canvas-based and
// pixel-space, this is SVG and millimetre-space (pooledShots/poiMm are
// already in mm, POA-relative — see rifle-precision-stats.js).
//
// Colors are hardcoded hex (not CSS custom properties) on purpose: the
// exported .svg file has no stylesheet of its own, so anything driven by
// var(--foo) would render colorless in an image viewer.
import { svgEl } from '../../svg.js';
import { t } from '../../i18n.js';
import { getUnit } from '../../prefs.js';
import { UNIT_GROUPS, unitChoice, engineToDisplay, displayToEngine } from '../../units.js';
import { wrapText, estimateTextWidth } from './svg-text-wrap.js';
import { buildConfidenceGaugeSvg, GAUGE_TITLE_SIZE, GAUGE_BLOCK_H, GAUGE_WIDGET_W } from './confidence-gauge-svg.js';

export { wrapText, estimateTextWidth };

const SVG_NS = 'http://www.w3.org/2000/svg';
const DIAGRAM_PX = 600; // fixed pixel size for the exported/standalone file; CSS overrides for on-page responsive display

// Exported so diagram-legend.js can reuse the exact same swatch colors
// rather than duplicating the hex values in a second file.
export const COLOR_POOLED_SHOT = '#3a7bd5';
export const COLOR_POA = '#e0605a';
export const COLOR_POI = '#e8a33d';
export const COLOR_SIGMA = '#9a9a9a';
export const COLOR_R50 = '#7a5cff';
export const COLOR_R95 = '#2ecc71';
export const COLOR_R99 = '#c26a1d';
export const COLOR_ONE_MOA = '#888888';
export const COLOR_HIT_PROBABILITY = '#8b0000';
export const COLOR_GRID = '#5c7a99';
export const COLOR_SCALE = '#767676';
export const COLOR_ES5X = '#1f9e9e';
export const COLOR_ES10X = '#a83279';

function mmCircle(cx, cy, r, attrs, role) {
  return svgEl('circle', { cx, cy, r, 'data-role': role, ...attrs });
}

function poaMarker(size) {
  const title = svgEl('title');
  title.textContent = t('riflePrecision.poaTargetCentreLabel');
  return svgEl('g', { 'data-role': 'poa-marker' }, [
    title,
    svgEl('circle', {
      cx: 0, cy: 0, r: size, fill: 'none', stroke: COLOR_POA, 'stroke-width': size * 0.3
    }),
    svgEl('line', { x1: -size * 1.7, y1: 0, x2: size * 1.7, y2: 0, stroke: COLOR_POA, 'stroke-width': size * 0.22 }),
    svgEl('line', { x1: 0, y1: -size * 1.7, x2: 0, y2: size * 1.7, stroke: COLOR_POA, 'stroke-width': size * 0.22 })
  ]);
}

function poiMarker(poiMm, size) {
  return svgEl('circle', {
    cx: poiMm.x, cy: poiMm.y, r: size, fill: COLOR_POI, stroke: '#fff', 'stroke-width': size * 0.25, 'data-role': 'poi-marker'
  });
}

// A crosshair-style grid, lines spaced spacingMm apart, with a crossing
// (not just a line) exactly at poiMm — since half is itself a multiple of
// no particular grid spacing, lines are generated as poiMm ± k*spacingMm
// rather than at round view-space coordinates, which is what guarantees a
// real crossing sits exactly on the POI regardless of spacing/extent.
function gridLines(poiMm, half, spacingMm, strokeWidth) {
  const group = svgEl('g', {
    'data-role': 'grid-lines', stroke: COLOR_GRID, 'stroke-width': strokeWidth, 'stroke-opacity': 0.4
  });
  const maxK = Math.floor(half / spacingMm);
  for (let k = -maxK; k <= maxK; k++) {
    const x = poiMm.x + k * spacingMm;
    group.appendChild(svgEl('line', { x1: x, y1: poiMm.y - half, x2: x, y2: poiMm.y + half }));
  }
  for (let k = -maxK; k <= maxK; k++) {
    const y = poiMm.y + k * spacingMm;
    group.appendChild(svgEl('line', { x1: poiMm.x - half, y1: y, x2: poiMm.x + half, y2: y }));
  }
  return group;
}

function poiConfidenceBox(poiMm, poiCiMm) {
  return svgEl('rect', {
    x: poiMm.x - poiCiMm.x, y: poiMm.y - poiCiMm.y,
    width: Math.max(poiCiMm.x * 2, 0.001), height: Math.max(poiCiMm.y * 2, 0.001),
    fill: COLOR_POI, 'fill-opacity': 0.12, stroke: COLOR_POI, 'stroke-width': 0.4, 'stroke-dasharray': '2 1.5',
    'data-role': 'poi-ci-box'
  });
}

// Computes a viewBox half-extent (mm) that comfortably fits the pooled
// shots, the R99 circle, and the 1 MOA reference circle — the view is
// centered on the (possibly off-origin) POI, not the POA/origin, so each
// term has to be re-expressed as a distance from POI rather than from the
// origin:
//  - every circle drawn in update() (including the 1-MOA reference) is
//    centered on POI, so each only needs its own radius;
//  - the POA marker is still drawn at the origin, so it needs
//    distance(POI, origin) to stay inside the view;
//  - every pooled shot's distance is measured from POI, not the origin.
// Deliberately independent of the interactive hit-probability radius
// (bounded by R99 anyway, since the slider tops out at 99%) so the diagram
// doesn't rescale while dragging it.
function computeHalfExtentMm(stats, oneMoaRadiusMm) {
  const poiDist = Math.hypot(stats.poiMm.x, stats.poiMm.y);
  const maxShotDistFromPoi = stats.pooledShots.reduce(
    (m, p) => Math.max(m, Math.hypot(p.xMm - stats.poiMm.x, p.yMm - stats.poiMm.y)), 0
  );
  const extent = Math.max(poiDist, oneMoaRadiusMm, stats.r99, maxShotDistFromPoi) || 10;
  return extent * 1.3;
}

// Rounds to the nearest whole multiple of its own order of magnitude — e.g.
// 349 -> 300, 526 -> 500, 3 -> 3, 0.06 -> 0.06 — so the scale bar's real-world
// length reads as a clean round number instead of an arbitrary fraction of
// the view width.
function roundToOrderOfMagnitude(value) {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.round(value / magnitude) * magnitude;
}

// `value` is already a "nice" round number in its own order of magnitude
// (see roundToOrderOfMagnitude() above), so only as many decimals as that
// magnitude actually needs are shown (no fixed per-unit decimal count).
function formatNiceLength(value, label) {
  const decimals = Math.max(0, -Math.floor(Math.log10(value)));
  return `${value.toFixed(decimals)} ${label}`;
}

// A horizontal scale bar with end-ticks and a length legend above it,
// sized to ~1/4 of the current view width and snapped to a round number in
// the user's chosen smallLength display unit (mm/cm/in — same
// bulletLength-flavored unit conversion formatLengthMm() in
// rifle-precision-analysis-view.js uses for every other on-diagram length).
// Placed in the bottom-left corner of the current viewBox, inset by a
// margin proportional to the view's own half-extent (half) — same "scale
// everything off half" convention every other size in this diagram
// (stroke widths, marker sizes) already follows, so it stays legible at
// any zoom level.
function scaleBar(poiMm, half, strokeWidth) {
  const targetMm = half * 0.5; // 1/4 of the (half*2)-wide square view
  const displayUnit = getUnit('smallLength');
  const choice = unitChoice('bulletLength', displayUnit) ||
    UNIT_GROUPS.smallLength.choices.find((c) => c.unit === UNIT_GROUPS.smallLength.defaultUnit);
  const niceDisplay = roundToOrderOfMagnitude(engineToDisplay('bulletLength', targetMm, choice.unit));
  if (niceDisplay <= 0) return null;
  const lengthMm = displayToEngine('bulletLength', niceDisplay, choice.unit);

  const margin = half * 0.08;
  const tick = half * 0.02;
  const x0 = poiMm.x - half + margin;
  const x1 = x0 + lengthMm;
  const y = poiMm.y + half - margin;
  const fontSize = half * 0.045;

  const label = svgEl('text', {
    x: (x0 + x1) / 2, y: y - tick - fontSize * 0.6, 'text-anchor': 'middle',
    'font-size': fontSize, fill: COLOR_SCALE, 'font-family': 'sans-serif'
  });
  label.textContent = formatNiceLength(niceDisplay, choice.label);

  return svgEl('g', { 'data-role': 'scale-bar' }, [
    label,
    svgEl('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: COLOR_SCALE, 'stroke-width': strokeWidth }),
    svgEl('line', { x1: x0, y1: y - tick, x2: x0, y2: y + tick, stroke: COLOR_SCALE, 'stroke-width': strokeWidth }),
    svgEl('line', { x1: x1, y1: y - tick, x2: x1, y2: y + tick, stroke: COLOR_SCALE, 'stroke-width': strokeWidth })
  ]);
}

// Draws every diagram element into `svg` (sets its own viewBox too) —
// shared by analysisDiagram()'s own live update() and
// buildStandaloneDiagramSvg() below, so the exported "with legend" image
// (which needs a fresh, detached copy — the fake-DOM test shim has no
// cloneNode, and reparenting the live on-page node would blank the
// screen) renders pixel-for-pixel the same content as the on-page one,
// from the same drawing code, rather than a second hand-kept copy.
function renderDiagramContent(svg, stats, options = {}) {
  const {
    showSigma, showR50, showR99, hitProbabilityRadiusMm, oneMoaRadiusMm = 0,
    impactsToScale = false, caliberMm = 0, gridSpacingMm = 0, showScale = false,
    showR95 = true, showR95Ci = true, showPoiCi = false, showEs5x = false, showEs10x = false,
    d5xMm = 0, d10xMm = 0
  } = options;

  const half = computeHalfExtentMm(stats, oneMoaRadiusMm);
  // Centered on the POI (not the POA/origin) — see computeHalfExtentMm()
  // above for how the extent math was re-derived for this.
  svg.setAttribute('viewBox', `${stats.poiMm.x - half} ${stats.poiMm.y - half} ${half * 2} ${half * 2}`);

  const thin = half * 0.003;
  const med = half * 0.006;
  // "Impacts to scale": true bore radius in the same mm-space every other
  // circle here already uses, instead of the fixed visible-marker size.
  const dotR = impactsToScale && caliberMm > 0 ? caliberMm / 2 : half * 0.012;
  const poaSize = half * 0.02;
  const poiSize = half * 0.016;

  // Furthest background layer of all — a crossing sits exactly on the
  // POI (see gridLines()'s own comment), same "centered on POI, not the
  // POA/origin" convention every other overlay here already follows.
  if (gridSpacingMm > 0) {
    svg.appendChild(gridLines(stats.poiMm, half, gridSpacingMm, thin));
  }

  // Background reference: 1 MOA circle, centered on the POI like every
  // other circle in this diagram (not the POA/origin, where only the
  // crosshair marker itself still sits).
  if (oneMoaRadiusMm > 0) {
    svg.appendChild(mmCircle(stats.poiMm.x, stats.poiMm.y, oneMoaRadiusMm, {
      fill: 'none', stroke: COLOR_ONE_MOA, 'stroke-width': thin, 'stroke-dasharray': `${med} ${thin * 2}`
    }, 'one-moa-circle'));
  }

  // R95 confidence-interval band — a pale, borderless fill spanning the
  // lower..upper confidence bound, independent of the crisp R95 circle
  // itself (each now has its own toggle — see showR95/showR95Ci above).
  const bandMid = (stats.r95LowerBound + stats.r95UpperBound) / 2;
  const bandWidth = Math.max(stats.r95UpperBound - stats.r95LowerBound, 0);
  if (showR95Ci && bandWidth > 0) {
    svg.appendChild(mmCircle(stats.poiMm.x, stats.poiMm.y, bandMid, {
      fill: 'none', stroke: COLOR_R95, 'stroke-width': bandWidth, 'stroke-opacity': 0.25
    }, 'r95-band'));
  }
  if (showR95) {
    svg.appendChild(mmCircle(stats.poiMm.x, stats.poiMm.y, stats.r95, {
      fill: 'none', stroke: COLOR_R95, 'stroke-width': thin
    }, 'r95-circle'));
  }

  if (showEs5x && d5xMm > 0) {
    svg.appendChild(mmCircle(stats.poiMm.x, stats.poiMm.y, d5xMm / 2, {
      fill: 'none', stroke: COLOR_ES5X, 'stroke-width': thin
    }, 'es5x-circle'));
  }
  if (showEs10x && d10xMm > 0) {
    svg.appendChild(mmCircle(stats.poiMm.x, stats.poiMm.y, d10xMm / 2, {
      fill: 'none', stroke: COLOR_ES10X, 'stroke-width': thin
    }, 'es10x-circle'));
  }

  if (showSigma) {
    svg.appendChild(mmCircle(stats.poiMm.x, stats.poiMm.y, stats.sigma, {
      fill: 'none', stroke: COLOR_SIGMA, 'stroke-width': thin
    }, 'sigma-circle'));
  }
  if (showR50) {
    svg.appendChild(mmCircle(stats.poiMm.x, stats.poiMm.y, stats.r50, {
      fill: 'none', stroke: COLOR_R50, 'stroke-width': thin
    }, 'r50-circle'));
  }
  if (showR99) {
    svg.appendChild(mmCircle(stats.poiMm.x, stats.poiMm.y, stats.r99, {
      fill: 'none', stroke: COLOR_R99, 'stroke-width': thin
    }, 'r99-circle'));
  }

  if (hitProbabilityRadiusMm > 0) {
    svg.appendChild(mmCircle(stats.poiMm.x, stats.poiMm.y, hitProbabilityRadiusMm, {
      fill: 'none', stroke: COLOR_HIT_PROBABILITY, 'stroke-width': med
    }, 'hit-probability-circle'));
  }

  for (const shot of stats.pooledShots) {
    svg.appendChild(mmCircle(shot.xMm, shot.yMm, dotR, { fill: COLOR_POOLED_SHOT }, 'pooled-shot'));
  }

  if (showPoiCi) {
    svg.appendChild(poiConfidenceBox(stats.poiMm, stats.poiCiMm));
  }
  svg.appendChild(poiMarker(stats.poiMm, poiSize));
  svg.appendChild(poaMarker(poaSize));

  // Drawn last so it always sits on top of every other overlay, since it
  // occupies a fixed screen corner rather than a data-driven position.
  if (showScale) {
    const bar = scaleBar(stats.poiMm, half, thin);
    if (bar) svg.appendChild(bar);
  }
}

export function analysisDiagram() {
  const svg = svgEl('svg', {
    xmlns: SVG_NS, class: 'rp-diagram-svg', width: DIAGRAM_PX, height: DIAGRAM_PX, viewBox: '-10 -10 20 20'
  });

  function update(stats, options = {}) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    renderDiagramContent(svg, stats, options);
  }

  return { node: svg, update };
}

// A fresh, detached diagram <svg> with the exact same content
// analysisDiagram()'s own live node currently shows for the same
// stats/options — used for every export path (both the bare "Save image"
// download and buildExportSvgWithLegend() below) instead of cloning or
// reusing the mounted node. Unlike the live on-page node (which relies on
// .rp-diagram-svg's own CSS background — see layout.css — deliberately
// left untouched), an exported SVG file has no stylesheet of its own, so
// this prepends an actual white background rect behind the graphics; the
// oversized bounds get clipped down to the real viewBox by the SVG's own
// default overflow:hidden, so it doesn't need to know the (dynamically
// computed, per-project) extent up front.
export function buildStandaloneDiagramSvg(stats, options = {}, { widthPx = DIAGRAM_PX, heightPx = DIAGRAM_PX } = {}) {
  const svg = svgEl('svg', { xmlns: SVG_NS, class: 'rp-diagram-svg', width: widthPx, height: heightPx, viewBox: '-10 -10 20 20' });
  svg.appendChild(svgEl('rect', { x: -1e6, y: -1e6, width: 2e6, height: 2e6, fill: '#ffffff' }));
  renderDiagramContent(svg, stats, options);
  return svg;
}

function legendSwatchSvg(color, shape, cx, cy, size) {
  const r = size / 2;
  if (shape === 'dot') return svgEl('circle', { cx, cy, r, fill: color });
  if (shape === 'fill-pale') return svgEl('circle', { cx, cy, r, fill: color, 'fill-opacity': 0.35 });
  if (shape === 'ring') return svgEl('circle', { cx, cy, r, fill: 'none', stroke: color, 'stroke-width': size * 0.16 });
  if (shape === 'ring-dashed') {
    return svgEl('circle', {
      cx, cy, r, fill: 'none', stroke: color, 'stroke-width': size * 0.16, 'stroke-dasharray': `${size * 0.22} ${size * 0.14}`
    });
  }
  if (shape === 'box') {
    return svgEl('rect', {
      x: cx - r, y: cy - r, width: size, height: size, fill: 'none', stroke: color,
      'stroke-width': size * 0.16, 'stroke-dasharray': `${size * 0.22} ${size * 0.14}`
    });
  }
  // 'grid' — a small crosshair, matching .rp-legend-swatch-grid's own on-page icon.
  return svgEl('g', {}, [
    svgEl('line', { x1: cx - r, y1: cy, x2: cx + r, y2: cy, stroke: color, 'stroke-width': size * 0.12 }),
    svgEl('line', { x1: cx, y1: cy - r, x2: cx, y2: cy + r, stroke: color, 'stroke-width': size * 0.12 })
  ]);
}

// Fixed panel geometry. Unlike the old side-by-side layout, panel width
// no longer scales off the diagram's own size: the confidence gauge and
// legend both need a real, fixed amount of room to stay legible (band
// labels, wrapped legend rows), so the panel is a fixed width and the
// *diagram* is the one that scales, to match whatever height the panel's
// actual content ends up needing.
const EXPORT_PANEL_W = 580;
const EXPORT_MARGIN = 24;
const EXPORT_LEGEND_FONT_SIZE = 15;

// Combines a fresh diagram render with a header, the confidence-o-meter
// gauge, and the legend, stacked in a panel to the diagram's right — the
// "Save legend with results image" export option in
// rifle-precision-analysis-view.js. `legendRows` is diagram-legend.js's
// own computeLegendRows() output (the caller may enrich individual rows —
// e.g. adding average-PoI coordinates — before passing it in; whatever's
// in the array is rendered verbatim). `headerLines` is
// `[{ text, weight, size }, ...]`, each wrapped independently to the
// gauge widget's own width (not the full panel) so it visually caps that
// section specifically. The panel's total height is computed from its
// actual content (header + fixed gauge block + real legend row count),
// and the diagram is scaled up to match if that exceeds its own normal
// size — the two are always the same height, since they sit side by side.
export function buildExportSvgWithLegend(stats, options, legendRows, headerLines, confidenceLower, confidenceUpper) {
  const headerMaxWidth = GAUGE_WIDGET_W;
  const headerLineData = headerLines.map((line) => ({ ...line, wrapped: wrapText(line.text, headerMaxWidth, line.size) }));
  const headerH = headerLineData.reduce((sum, line) => sum + line.wrapped.length * (line.size * 1.3), 0) + 14;

  const legendLineHeight = EXPORT_LEGEND_FONT_SIZE * 1.35;
  const legendRowGap = EXPORT_LEGEND_FONT_SIZE * 0.5;
  const legendSwatchSize = EXPORT_LEGEND_FONT_SIZE * 0.9;
  const legendColW = EXPORT_PANEL_W - EXPORT_MARGIN * 2;
  const legendTextX = EXPORT_MARGIN + legendSwatchSize * 1.8;
  const legendMaxTextWidth = legendColW - legendSwatchSize * 1.8;
  const legendRowData = legendRows.map((row) => {
    const fullText = row.value ? `${row.label}: ${row.value}` : row.label;
    const wrapped = wrapText(fullText, legendMaxTextWidth, EXPORT_LEGEND_FONT_SIZE);
    return { row, wrapped, height: Math.max(legendLineHeight, wrapped.length * legendLineHeight) };
  });
  const legendContentH = legendRowData.reduce((sum, r) => sum + r.height + legendRowGap, 0);

  let y = EXPORT_MARGIN;
  y += headerH;
  y += 16;
  const gaugeTop = y;
  y += GAUGE_BLOCK_H + GAUGE_TITLE_SIZE * 1.3 + 6;
  y += 24;
  const legendTop = y;
  y += legendContentH;
  y += EXPORT_MARGIN;

  const panelH = Math.ceil(y);
  const diagramSize = Math.max(DIAGRAM_PX, panelH);
  const canvasH = diagramSize;
  const totalWidth = diagramSize + EXPORT_PANEL_W;

  const root = svgEl('svg', { xmlns: SVG_NS, width: totalWidth, height: canvasH, viewBox: `0 0 ${totalWidth} ${canvasH}` });
  root.appendChild(buildStandaloneDiagramSvg(stats, options, { widthPx: diagramSize, heightPx: diagramSize }));

  const panel = svgEl('g', { transform: `translate(${diagramSize}, 0)` });
  panel.appendChild(svgEl('rect', { x: 0, y: 0, width: EXPORT_PANEL_W, height: canvasH, fill: '#ffffff' }));

  let hy = EXPORT_MARGIN;
  for (const line of headerLineData) {
    for (const wrappedText of line.wrapped) {
      const text = svgEl('text', {
        x: EXPORT_MARGIN, y: hy + line.size, 'font-size': line.size, 'font-family': 'sans-serif',
        'font-weight': line.weight, fill: '#1a1a1a'
      });
      text.textContent = wrappedText;
      panel.appendChild(text);
      hy += line.size * 1.3;
    }
  }

  panel.appendChild(buildConfidenceGaugeSvg(confidenceLower, confidenceUpper, { x: EXPORT_MARGIN, y: gaugeTop }));

  let ly = legendTop;
  for (const { row, wrapped, height } of legendRowData) {
    panel.appendChild(legendSwatchSvg(row.color, row.shape, EXPORT_MARGIN + legendSwatchSize / 2, ly + legendLineHeight / 2, legendSwatchSize));
    wrapped.forEach((lineText, i) => {
      const lineNode = svgEl('text', {
        x: legendTextX, y: ly + legendLineHeight * i + legendLineHeight * 0.72, 'font-size': EXPORT_LEGEND_FONT_SIZE,
        'font-family': 'sans-serif', fill: '#1a1a1a'
      });
      lineNode.textContent = lineText;
      panel.appendChild(lineNode);
    });
    ly += height + legendRowGap;
  }

  root.appendChild(panel);
  return root;
}

