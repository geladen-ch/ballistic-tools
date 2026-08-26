// Legend for the analysis diagram (src/ui/rifle-precision/analysis-diagram.js)
// — computeLegendRows() is the single source of truth for "what's currently
// on the diagram", shared by the on-page <table> this module renders AND
// the optional legend panel baked into an exported SVG (see
// buildExportSvgWithLegend() in analysis-diagram.js) — both need the exact
// same row list, so it's computed once here rather than duplicated.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import {
  COLOR_POOLED_SHOT, COLOR_POA, COLOR_POI, COLOR_SIGMA, COLOR_R50, COLOR_R95, COLOR_R99,
  COLOR_ONE_MOA, COLOR_HIT_PROBABILITY, COLOR_GRID, COLOR_ES5X, COLOR_ES10X
} from './analysis-diagram.js';

// +sign on a non-negative formatted value, for an absolute coordinate
// reading (the average PoI's own H/V offset) where the sign itself is the
// point — a negative value's own "-" already comes through
// formatResultValue()'s normal number formatting, so this only ever adds
// the "+", never strips or replaces an existing sign.
function withSign(formattedText) {
  return formattedText.startsWith('-') ? formattedText : `+${formattedText}`;
}

// One row per element that could currently be on the diagram, in drawing
// order (background-most first). `value` is null for markers that don't
// carry an associated number (grid, all impacts, POA).
export function computeLegendRows(stats, options = {}, formatResultValue) {
  const {
    gridSpacingMm = 0, showPoiCi = false, showSigma = false, showR50 = false,
    showR95 = true, showR95Ci = true, showR99 = false, showEs5x = false, showEs10x = false,
    oneMoaRadiusMm = 0, hitProbabilityRadiusMm = 0, hitProbabilityPercent = 0, d5xMm = 0, d10xMm = 0
  } = options;

  const rows = [];
  if (gridSpacingMm > 0) rows.push({ color: COLOR_GRID, shape: 'grid', label: t('riflePrecision.legendGrid'), value: null });
  rows.push({ color: COLOR_POOLED_SHOT, shape: 'dot', label: t('riflePrecision.legendPooledShot'), value: null });
  rows.push({ color: COLOR_POA, shape: 'ring', label: t('riflePrecision.legendPoa'), value: null });
  rows.push({
    color: COLOR_POI, shape: 'dot', label: t('riflePrecision.legendPoi'),
    value: `H ${withSign(formatResultValue(stats.poiMm.x))}, V ${withSign(formatResultValue(stats.poiMm.y))}`
  });
  if (showPoiCi) {
    rows.push({
      color: COLOR_POI, shape: 'box', label: t('riflePrecision.legendPoiCi'),
      value: `H ±${formatResultValue(stats.poiCiMm.x)}, V ±${formatResultValue(stats.poiCiMm.y)}`
    });
  }
  if (showSigma) rows.push({ color: COLOR_SIGMA, shape: 'ring', label: t('riflePrecision.legendSigma'), value: formatResultValue(stats.sigma) });
  if (showR50) rows.push({ color: COLOR_R50, shape: 'ring', label: t('riflePrecision.legendR50'), value: formatResultValue(stats.r50) });
  if (showR95) rows.push({ color: COLOR_R95, shape: 'ring', label: t('riflePrecision.legendR95'), value: formatResultValue(stats.r95) });
  if (showR95Ci) {
    const lowerDelta = formatResultValue(stats.r95 - stats.r95LowerBound);
    const upperDelta = formatResultValue(stats.r95UpperBound - stats.r95);
    rows.push({ color: COLOR_R95, shape: 'fill-pale', label: t('riflePrecision.legendR95Ci'), value: `-${lowerDelta}/+${upperDelta}` });
  }
  if (showR99) rows.push({ color: COLOR_R99, shape: 'ring', label: t('riflePrecision.legendR99'), value: formatResultValue(stats.r99) });
  if (showEs5x) rows.push({ color: COLOR_ES5X, shape: 'ring', label: t('riflePrecision.legendEs5x'), value: formatResultValue(d5xMm) });
  if (showEs10x) rows.push({ color: COLOR_ES10X, shape: 'ring', label: t('riflePrecision.legendEs10x'), value: formatResultValue(d10xMm) });
  if (oneMoaRadiusMm > 0) {
    rows.push({ color: COLOR_ONE_MOA, shape: 'ring-dashed', label: t('riflePrecision.legendOneMoa'), value: formatResultValue(oneMoaRadiusMm * 2) });
  }
  if (hitProbabilityRadiusMm > 0) {
    rows.push({
      color: COLOR_HIT_PROBABILITY, shape: 'ring', label: t('riflePrecision.legendHitProbability'),
      value: `${hitProbabilityPercent}%: ${formatResultValue(hitProbabilityRadiusMm)}`
    });
  }
  return rows;
}

function swatch(color, shape) {
  const node = el('span', { class: `rp-legend-swatch rp-legend-swatch-${shape}` });
  node.style.setProperty('--rp-legend-swatch-color', color);
  return node;
}

export function diagramLegend() {
  const node = el('table', { class: 'rp-legend-table' });

  function update(stats, options = {}, formatResultValue = (mm) => String(mm)) {
    clear(node);
    const rows = computeLegendRows(stats, options, formatResultValue);
    node.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', {}),
      el('th', { i18n: 'riflePrecision.numbersDescriptionHeader' }),
      el('th', { i18n: 'riflePrecision.numbersValueHeader' })
    ])]));
    const tbody = el('tbody');
    for (const row of rows) {
      tbody.appendChild(el('tr', {}, [
        el('td', {}, [swatch(row.color, row.shape)]),
        el('td', { text: row.label }),
        el('td', { text: row.value ?? '' })
      ]));
    }
    node.appendChild(tbody);
  }

  return { node, update };
}
