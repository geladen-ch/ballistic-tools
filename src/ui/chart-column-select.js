import { el } from '../dom.js';
import { t } from '../i18n.js';

// Builds the "which column to plot" <select> shared by the Trajectory
// chart and the Arsenal Comparison chart, from the same COLUMNS array
// (see trajectory-view.js) so both always offer exactly the same set of
// plottable values. Pulled out here rather than duplicated because the
// energy/velocity/drop/windage columns need special handling: an
// <option> can't hold element children the way a <th>/<label> can (see
// trajectory-view.js's i18nSpan-based unit suffix in its table header),
// so their unit suffix has to be folded into one plain-text label
// instead of the usual `i18n` prop live-binding.
export function chartColumnSelect(columns, { id, energyChoice, velocityChoice, smallLengthChoice, defaultColumnId } = {}) {
  const unitChoiceById = { energy: energyChoice, velocity: velocityChoice, dropCm: smallLengthChoice, windageCm: smallLengthChoice };
  const select = el('select', { id }, columns.map((col) => (unitChoiceById[col.id]
    ? el('option', { value: col.id, text: `${t(col.headerKey)} (${unitChoiceById[col.id].label})` })
    : el('option', { value: col.id, i18n: col.headerKey }))));
  if (defaultColumnId) select.value = defaultColumnId;
  return select;
}

// The zero-level "Line of sight" reference series shown on drop-family
// columns (see showLineOfSight in trajectory-columns.js), plus its
// matching legend item — a fixed custom className rather than letting
// Chartist auto-assign the next ct-series-<letter>, so it never collides
// with the Arsenal Comparison chart's own second real data series
// (ct-series-b, a rifle+cartridge's actual trajectory, not a reference
// line). Shared by the Trajectory chart and the Arsenal Comparison chart
// so the series shape, CSS class, and translated label can't drift
// between them.
export function lineOfSightSeries(length) {
  return { data: new Array(length).fill(0), className: 'ct-series-zero-line' };
}

export function lineOfSightLegendItem() {
  return el('span', { class: 'chart-legend-item chart-legend-zero-line' }, [
    el('span', { class: 'chart-legend-swatch' }),
    document.createTextNode(t('trajectory.lineOfSightLabel'))
  ]);
}
