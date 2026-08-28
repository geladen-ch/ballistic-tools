// Static SVG replica of the confidence-o-meter widget (confidence-o-meter.js),
// for the analysis view's "Save legend with results image" SVG export.
// Shares computeConfidenceFacts()/BANDS/THRESHOLD_LINE_BOTTOM_PERCENT
// with the real on-page widget (single source of truth for the
// level/fraction/quality-text math), and wrapText() with
// analysis-diagram.js's own legend-row wrapping.
//
// Unlike the on-page widget, this bar is fixed-size, not squeezed into
// whatever column width a page layout happens to give it — sized wide
// enough (150px) that the on-bar quality-band labels (MEANINGLESS/POOR/
// FAIR/GOOD/EXCELLENT) and the "(bullshit threshold)" caption are legible
// in the exported file, where there's no way to hover or zoom for detail.
// The results pane is deliberately the *same* height as the bar and
// fixed in place — only the pointer arrow moves to indicate the level —
// matching the on-page widget's own flexbox-stretch behavior (the two
// were designed independently and happened to converge on this).
import { svgEl } from '../../svg.js';
import { t } from '../../i18n.js';
import { wrapText } from './svg-text-wrap.js';
import { computeConfidenceFacts, BANDS, THRESHOLD_LINE_BOTTOM_PERCENT } from './confidence-o-meter.js';

export const GAUGE_TITLE_SIZE = 14;
export const BAR_W = 150;
export const BAR_H = 170;
const BAND_LABEL_SIZE = 11;
const THRESHOLD_CAPTION_SIZE = 9.5;
// A fixed offset below the dashed line, not the on-page widget's own
// percentage-based caption position — an annotation directly on the line
// reads clearly at any bar height, and is what keeps this bar compressible
// without the caption colliding with the "MEANINGLESS" label below it.
const THRESHOLD_CAPTION_GAP = 13;
export const INFO_W = 230;
export const INFO_H = BAR_H;
const POINTER_COL_W = 30;
export const GAUGE_WIDGET_W = BAR_W + POINTER_COL_W + INFO_W;
export const GAUGE_BLOCK_H = Math.max(BAR_H, INFO_H);

function svgText(attrs, content) {
  const node = svgEl('text', attrs);
  node.textContent = content;
  return node;
}

// Builds the gauge as a <g>, its own top-left corner at (x, y) — the
// title sits at the very top; everything below is the GAUGE_BLOCK_H-tall
// bar/pointer/info row.
export function buildConfidenceGaugeSvg(confidenceLower, confidenceUpper, { x = 0, y = 0 } = {}) {
  const facts = computeConfidenceFacts(confidenceLower, confidenceUpper);
  const g = svgEl('g', { transform: `translate(${x},${y})` });

  g.appendChild(svgText(
    { x: 0, y: GAUGE_TITLE_SIZE, 'font-size': GAUGE_TITLE_SIZE, 'font-weight': 'bold', 'font-family': 'sans-serif', fill: '#1a1a1a' },
    t('riflePrecision.confidenceMeterTitle')
  ));

  const barY = GAUGE_TITLE_SIZE * 1.3 + 6;
  g.appendChild(svgEl('defs', {}, [
    svgEl('linearGradient', { id: 'rp-gauge-gradient', x1: 0, y1: 1, x2: 0, y2: 0 }, [
      svgEl('stop', { offset: '0%', 'stop-color': '#7a5901' }),
      svgEl('stop', { offset: '17%', 'stop-color': '#7a5901' }),
      svgEl('stop', { offset: '40%', 'stop-color': '#ff0000' }),
      svgEl('stop', { offset: '60%', 'stop-color': '#ffa500' }),
      svgEl('stop', { offset: '80%', 'stop-color': '#ffff00' }),
      svgEl('stop', { offset: '100%', 'stop-color': '#00ff00' })
    ])
  ]));
  g.appendChild(svgEl('rect', { x: 0, y: barY, width: BAR_W, height: BAR_H, rx: 5, fill: 'url(#rp-gauge-gradient)' }));

  for (const band of BANDS) {
    const labelY = barY + BAR_H - (band.bottomPercent / 100) * BAR_H;
    g.appendChild(svgText(
      {
        x: BAR_W / 2, y: labelY, 'font-size': BAND_LABEL_SIZE, 'font-weight': 700, 'font-family': 'sans-serif',
        fill: band.light ? '#ffffff' : '#1a1a1a', 'text-anchor': 'middle', 'letter-spacing': 0.3
      },
      t(band.key)
    ));
  }

  const thresholdY = barY + BAR_H - (THRESHOLD_LINE_BOTTOM_PERCENT / 100) * BAR_H;
  g.appendChild(svgEl('line', {
    x1: 0, y1: thresholdY, x2: BAR_W, y2: thresholdY, stroke: 'rgba(255,255,255,0.9)', 'stroke-width': 2, 'stroke-dasharray': '5 3'
  }));
  g.appendChild(svgText(
    {
      x: BAR_W / 2, y: thresholdY + THRESHOLD_CAPTION_GAP, 'font-size': THRESHOLD_CAPTION_SIZE, 'font-weight': 700,
      'font-family': 'sans-serif', fill: '#ffffff', 'text-anchor': 'middle'
    },
    t('riflePrecision.bullshitThresholdLabel')
  ));

  // Pointer — the only thing that moves. Bridges the bar's own edge to
  // the results pane, which is a fixed, full-height block below.
  const pointerY = barY + BAR_H - facts.fraction * BAR_H;
  const triX = BAR_W;
  g.appendChild(svgEl('polygon', { points: `${triX},${pointerY - 7} ${triX},${pointerY + 7} ${triX + 12},${pointerY}`, fill: '#9a9a9a' }));
  g.appendChild(svgEl('rect', { x: triX + 11, y: pointerY - 2.5, width: 18, height: 5, rx: 2.5, fill: '#9a9a9a' }));

  // Results pane — same height as the bar, top-aligned with it, fixed in
  // place regardless of the level (see this module's own comment above).
  const infoX = triX + 30;
  const infoY = barY;
  g.appendChild(svgEl('rect', { x: infoX, y: infoY, width: INFO_W, height: INFO_H, rx: 6, fill: facts.color }));

  const infoLines = [
    { text: facts.quality, size: 17, weight: 'bold', gapBefore: 0 },
    { text: `${t('riflePrecision.ururaLevelLabel')} ${facts.ururaScore}`, size: 12, weight: 'normal', gapBefore: 12 },
    { text: `${t('riflePrecision.confidenceMarginLabel')}: ${facts.marginText}`, size: 10.5, weight: 'normal', gapBefore: 9 }
  ];
  let blockHeight = 0;
  const measured = infoLines.map((line) => {
    const wrapped = wrapText(line.text, INFO_W - 20, line.size);
    const h = wrapped.length * (line.size * 1.25);
    blockHeight += line.gapBefore + h;
    return { ...line, wrapped };
  });
  let cursorY = infoY + (INFO_H - blockHeight) / 2;
  for (const line of measured) {
    cursorY += line.gapBefore;
    for (const wrappedLine of line.wrapped) {
      cursorY += line.size * 1.25;
      g.appendChild(svgText(
        {
          x: infoX + INFO_W / 2, y: cursorY - line.size * 0.25, 'font-size': line.size, 'font-weight': line.weight,
          'font-family': 'sans-serif', fill: '#1a1a1a', 'text-anchor': 'middle'
        },
        wrappedLine
      ));
    }
  }

  return g;
}
