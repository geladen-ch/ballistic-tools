// Velocity-vs-time chart for whichever track row was last clicked in the
// track list (one chart, not one per track — a chart per row would be
// unusable clutter for a batch of dozens). New functionality beyond the
// legacy tool's own scope (it has no chart at all) — follows
// cd-mach-curve-view.js's exact multi-series pattern: kept points as one
// scatter series, discarded points as a second, differently-colored
// scatter series, with a matching swatch legend.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { LineChart, AutoScaleAxis } from '../../vendor/chartist/index.js';
import { downloadButton } from '../download-button.js';
import { exportChartSvg } from '../../chart-svg-export.js';
import { predictVelocityAtTimes } from '../../engine/bc-estimate.js';

const FITTED_CURVE_SAMPLES = 50;

// The fitted curve's own physics can only be walked forward from v1's
// anchor (kept[1].t — see estimateTrackBCWholeWindow), never back to the
// track's very first (synthetic, t=0) point — this app's stepper has no
// backward-integration mode. Spans to the latest time among *all*
// plotted points (kept and discarded together), so a late discarded
// outlier stays visually comparable against the curve that correctly
// ignored it, not just the kept points.
function fittedCurveSeries(track) {
  const anchorT = track.keptPoints[1].t;
  const allPoints = track.keptPoints.concat(track.discardedPoints);
  const maxT = allPoints.reduce((m, p) => Math.max(m, p.t), anchorT);
  if (maxT <= anchorT) return [];

  const relTimes = Array.from({ length: FITTED_CURVE_SAMPLES }, (_, i) => (i / (FITTED_CURVE_SAMPLES - 1)) * (maxT - anchorT));
  const velocities = predictVelocityAtTimes({ bc: track.bc, v1: track.v1, times: relTimes, dragModel: track.dragModel, ...track.atmo });
  return relTimes.map((relT, i) => ({ x: (anchorT + relT) * 1000, y: velocities[i] }));
}

function legendItem(letter, key, params) {
  return el('span', { class: `chart-legend-item chart-legend-${letter}` }, [
    el('span', { class: 'chart-legend-swatch' }),
    document.createTextNode(t(key, params))
  ]);
}

export function trackChart() {
  const chartLegend = el('div', { class: 'chart-legend labradar-track-chart-legend' });
  const chartContainer = el('div', { class: 'chart-container labradar-track-chart' });
  const heading = el('h3', { i18n: 'bcToolsLabradar.chartHeading' });
  const emptyHint = el('p', { class: 'hint', i18n: 'bcToolsLabradar.chartEmptyHint' });
  const axisLabel = el('div', { class: 'chart-axis-label', i18n: 'bcToolsLabradar.timeAxisLabel' });

  const node = el('div', { class: 'card' }, [
    el('div', { class: 'card-header-row' }, [
      heading,
      downloadButton({
        label: t('bcToolsLabradar.downloadChartSvg'),
        onClick: () => exportChartSvg(chartContainer, 'labradar-track-chart.svg')
      })
    ]),
    chartLegend,
    chartContainer,
    axisLabel,
    emptyHint
  ]);

  let chart = null;

  function render(track) {
    if (!track) {
      clear(chartLegend);
      chartContainer.style.display = 'none';
      axisLabel.style.display = 'none';
      emptyHint.style.display = '';
      return;
    }
    chartContainer.style.display = '';
    axisLabel.style.display = '';
    emptyHint.style.display = 'none';

    // A track with no computed BC (status 'error' — a worker failure,
    // e.g. the physics-fit's own boundary-saturation guard) has nothing
    // to draw a fitted curve from and no kept/discarded split to show —
    // every one of its raw points (bar the device's own synthetic index
    // 0, same exclusion kept/discarded always apply) is shown as
    // rejected instead, so the user can still see what the radar
    // actually recorded.
    const isErrorTrack = track.bc === undefined;

    // Points arrive in whatever order they were kept/discarded in (the
    // discard order is worst-point-removed-first, not chronological) —
    // Chartist positions {x,y} data by its actual x value only when
    // axisX.type is AutoScaleAxis (below), so the series arrays
    // themselves don't need sorting for correct placement, only for a
    // sane left-to-right line if one were ever drawn.
    const series = [
      { name: 'kept', data: isErrorTrack ? [] : track.keptPoints.map((p) => ({ x: p.t * 1000, y: p.v })) },
      {
        name: 'discarded',
        data: (isErrorTrack ? track.points.slice(1) : track.discardedPoints).map((p) => ({ x: p.t * 1000, y: p.v }))
      },
      { name: 'fitted', data: isErrorTrack ? [] : fittedCurveSeries(track) }
    ];
    clear(chartLegend);
    chartLegend.appendChild(legendItem('a', 'bcToolsLabradar.legendKept'));
    chartLegend.appendChild(legendItem('b', 'bcToolsLabradar.legendDiscarded'));
    if (!isErrorTrack) {
      chartLegend.appendChild(legendItem('c', 'bcToolsLabradar.legendFittedBc', { bc: track.bc.toFixed(4) }));
    }

    const options = {
      fullWidth: true,
      chartPadding: { right: 24 },
      // Without an explicit axisX.type, LineChart defaults to a StepAxis,
      // which places points by their array index rather than their x
      // value — harmless for the time-sorted "kept" series but scrambles
      // "discarded" (removal order, not time order). AutoScaleAxis makes
      // the X position reflect the actual millisecond value instead.
      axisX: { type: AutoScaleAxis, onlyInteger: false },
      axisY: { onlyInteger: false },
      showPoint: true,
      showLine: false,
      // series-c's own solid-blue treatment (base.css's
      // .labradar-track-chart .ct-series-c .ct-line override — Chartist's
      // own default series-c color is too close to the kept-points
      // orange to read as distinct) is what visually marks "fitted" as a
      // model prediction, not measured/derived data, alongside the
      // scatter series.
      series: {
        kept: { showPoint: true, showLine: false },
        discarded: { showPoint: true, showLine: false },
        fitted: { showPoint: false, showLine: true }
      }
    };
    if (chart) chart.update({ series }, options);
    else chart = new LineChart(chartContainer, { series }, options);
  }

  render(null);
  return { node, render };
}
