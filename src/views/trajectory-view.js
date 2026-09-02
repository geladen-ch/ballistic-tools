import { el, clear } from '../dom.js';
import { getPool } from '../pool.js';
import { unitField } from '../ui/unit-field.js';
import { cartridgeSection } from '../ui/sections/cartridge-section.js';
import { rifleSection } from '../ui/sections/rifle-section.js';
import { gunsSummary } from '../ui/sections/guns-summary.js';
import { atmosphereSection } from '../ui/sections/atmosphere-section.js';
import { columnToggles } from '../ui/column-toggles.js';
import { zoomRangeSlider } from '../ui/zoom-range-slider.js';
import { engineToDisplay, displayToEngine, unitChoice, convertAngularValue, FIELD_BOUNDS, formatFieldValue } from '../units.js';
import { getUnit } from '../prefs.js';
import { loadColumnVisibility, saveColumnVisibility } from '../table-columns.js';
import { applyI18nText, i18nSpan, t } from '../i18n.js';
import { LineChart } from '../vendor/chartist/index.js';
import { chartColumnSelect as buildChartColumnSelect, lineOfSightSeries, lineOfSightLegendItem } from '../ui/chart-column-select.js';
import { COLUMNS, CHART_POINTS_TARGET, MIN_ZOOM_WINDOW_M, CHART_DENSE_RANGE_STEP_M, resampleChartPoints, thinChartLabels } from '../trajectory-columns.js';
import { downloadButton } from '../ui/download-button.js';
import { copyButton } from '../ui/copy-button.js';
import { exportChartSvg } from '../chart-svg-export.js';
import { buildCsv, formatCsvNumber } from '../csv-export.js';
import { downloadFile } from '../download.js';
import { getFieldSeparator, getDecimalSeparator } from '../csv-prefs.js';
import { getSpinDriftMode } from '../spin-drift-prefs.js';
import { isZeroForSpinDriftEnabled } from '../zero-spin-drift-prefs.js';
import { canComputeStability } from '../engine/stability.js';
import { collapsibleHint } from '../ui/collapsible-hint.js';
import { loadTrajectoryInputsState, saveTrajectoryInputsState } from '../trajectory-state.js';

export function mount(container) {
  clear(container);

  const status = el('div', { class: 'status', i18n: 'common.idle' });

  // Spin drift's own status line — shown only while the Settings toggle
  // (spin-drift-prefs.js) is on; hidden entirely otherwise, same as
  // before this feature existed. Built once (not per-recompute) so the
  // "could not be calculated" hint's own expand/collapse state survives
  // repeated recomputes, mirroring stability-indicator.js's own reasoning.
  const spinDriftHelpToggle = collapsibleHint({
    toggleLabel: t('stability.unknownHintToggle'),
    hintText: t('stability.unknownHint')
  });
  const spinDriftStatusLine = el('span', { class: 'hint' });
  const spinDriftHint = el('div', {}, [
    el('div', { class: 'hint-row' }, [spinDriftStatusLine, spinDriftHelpToggle.button]),
    spinDriftHelpToggle.hint
  ]);
  spinDriftHint.style.display = 'none';

  // Evaluated fresh against whatever readState() currently reports —
  // independent of the trajectory computation's own success/failure,
  // since spin-drift availability is purely a function of the shot
  // config, not of the integration itself.
  function refreshSpinDriftHint() {
    if (getSpinDriftMode() === 'off') {
      spinDriftHint.style.display = 'none';
      return;
    }
    spinDriftHint.style.display = '';
    const computable = canComputeStability(readState());
    spinDriftStatusLine.textContent = t(computable ? 'trajectory.spinDriftIncluded' : 'trajectory.spinDriftUnavailable');
    spinDriftHelpToggle.button.style.display = computable ? 'none' : '';
    if (computable) spinDriftHelpToggle.collapse();
  }

  const headerRow = el('tr');
  const tableBody = el('tbody');
  const pool = getPool();
  let latestRequestId = 0;
  let lastPoints = [];

  let rafScheduled = false;
  function scheduleRecompute() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      recompute();
    });
  }

  let chartRafScheduled = false;
  function scheduleRecomputeChart() {
    if (chartRafScheduled) return;
    chartRafScheduled = true;
    requestAnimationFrame(() => {
      chartRafScheduled = false;
      recomputeChart();
    });
  }

  // Every ballistic input needs both the table and the chart recomputed;
  // rangeStepField is the one exception (see its own onInput below) —
  // it's a table-display-only knob the chart's own resolution logic never
  // reads.
  function handleShotInputChange() {
    scheduleRecompute();
    scheduleRecomputeChart();
  }

  // Restored once at mount — maxRange/rangeStep/losAngle are view-local
  // (not part of the shared cartridge/rifle/atmosphere shot config, see
  // shot-state.js), so without their own persistence they'd silently
  // reset to their hardcoded defaults on every navigation away and back.
  const savedInputs = loadTrajectoryInputsState() || {};

  // A user on yards gets a round 1000 yd / 100 yd default rather than
  // whatever a straight 1000 m / 100 m conversion happens to land on
  // (1093.6 yd / 109.4 yd) — only used when there's no persisted value yet.
  function roundDistanceDefault(fieldId, metricValue, yardValue) {
    return getUnit('distance') === 'yd' ? displayToEngine(fieldId, yardValue, 'yd') : metricValue;
  }

  function persistInputs() {
    saveTrajectoryInputsState({
      maxRange: maxRangeField.getEngineValue(),
      rangeStep: rangeStepField.getEngineValue(),
      losAngleDeg: losAngleField.getEngineValue()
    });
  }

  // maxRange/rangeStep control how far and how finely the table is
  // computed — they aren't rifle/cartridge/atmosphere properties, so they
  // stay outside those reusable sections.
  const maxRangeField = unitField({
    id: 'maxRange', ...FIELD_BOUNDS.maxRange, step: 10, value: savedInputs.maxRange ?? roundDistanceDefault('maxRange', 1000, 1000),
    onInput: () => {
      zoomSlider.setBounds(maxRangeField.getEngineValue());
      // Re-check rangeStep's own step ≤ maxRange cross-check now that
      // maxRange itself just changed — it may have just become invalid
      // (or valid again) with no edit of its own.
      rangeStepField.validate();
      handleShotInputChange();
      persistInputs();
    }
  });
  // The chart uses its own fixed dense resolution (CHART_DENSE_RANGE_STEP_M),
  // ignoring this — it only ever affects the table's own rows.
  const rangeStepField = unitField({
    id: 'rangeStep', ...FIELD_BOUNDS.rangeStep, step: 1, value: savedInputs.rangeStep ?? roundDistanceDefault('rangeStep', 100, 100),
    // A step bigger than the whole table range would produce at most one
    // row — not a physically-invalid number on its own, but not a useful
    // table either, so it's checked the same way an out-of-range value is.
    extraCheck: (engineValue) => {
      const maxRangeM = maxRangeField.getEngineValue();
      if (engineValue > maxRangeM) {
        return t('fields.errorRangeStepExceedsMax', { maxRange: formatFieldValue('maxRange', maxRangeM, getUnit('distance')) });
      }
      return null;
    },
    onInput: () => { scheduleRecompute(); persistInputs(); }
  });
  // The shot's incline relative to horizontal (+up) — not a distance/angle
  // group like windAngle's dispersion units, always degrees, same "no
  // FIELD_UNITS entry means pass-through unconverted" convention windAngle
  // itself already relies on (see units.js). View-local like maxRange/
  // rangeStep above, not shared via shot-state.js — but still persisted
  // via trajectory-state.js, same as them.
  const losAngleField = unitField({
    id: 'losAngle', ...FIELD_BOUNDS.losAngle, step: 1, value: savedInputs.losAngleDeg ?? 0,
    onInput: () => { handleShotInputChange(); persistInputs(); }
  });
  // rifle/cartridge are never rendered here — they exist only to read
  // the active gun configuration's engine values (readState() below),
  // exactly as when they were visible, just no longer appended to the
  // page. The actual picker UI now lives on Guns (see guns-view.js);
  // gunsSummary() is the compact stand-in shown here instead, reading the
  // same shared shot-state.js these two restore from at construction.
  const cartridge = cartridgeSection({ onInput: handleShotInputChange });
  const rifle = rifleSection({ onInput: handleShotInputChange, onLibraryCartridgeChange: cartridge.setLibraryCartridge });
  const guns = gunsSummary();
  const atmosphere = atmosphereSection({ combinedWind: true, onInput: handleShotInputChange });

  const controls = el('div', { class: 'card' }, [
    el('h2', { i18n: 'trajectory.inputsHeading' }),
    maxRangeField.node,
    rangeStepField.node,
    losAngleField.node,
    guns.node,
    el('div', { class: 'trajectory-atmosphere' }, [atmosphere.node]),
    status,
    spinDriftHint
  ]);

  // The Range column must be shown in the same distance unit maxRange and
  // rangeStep are entered in — otherwise a step typed as "100" (in
  // whatever unit is selected) doesn't visibly line up with the rows the
  // table actually prints.
  const distanceUnit = getUnit('distance');
  const distanceChoice = unitChoice('range', distanceUnit);
  // The Range column itself is always rounded to whole numbers in this
  // table — deliberately not distanceChoice.decimals (which still governs
  // the unit label and every other distance-shaped field on this page).
  const RANGE_DECIMALS = 0;
  // Read fresh at mount (not live-updated) — same convention as
  // distanceChoice above; a unit-preference change is picked up on the
  // next navigation to this view, like every other unit-aware field here.
  const energyChoice = unitChoice('energy', getUnit('energy'));
  const velocityChoice = unitChoice('velocity', getUnit('velocity'));
  const smallLengthChoice = unitChoice('dropCm', getUnit('smallLength'));

  // Column visibility only needs the header rebuilt plus the existing
  // points re-rendered — no worker round-trip, since toggling a column
  // doesn't change the physics. renderHeader/renderRows are defined
  // further down but already bound by the time a change can fire.
  const toggles = columnToggles(COLUMNS, loadColumnVisibility(COLUMNS), {
    onChange: (visibility) => {
      saveColumnVisibility(visibility);
      renderHeader();
      renderRows(lastPoints);
    }
  });

  // === Chart: any column vs. distance, with its own zoom/pan ===
  //
  // Deliberately a *separate* engine call from the table's own, not a
  // reuse of the table's points — the table's maxRange/rangeStep are the
  // user's own table-display settings (e.g. a coarse 100 m step over
  // 1000 m), which would look chunky/linear-interpolated-looking zoomed
  // into a 50 m window. The chart instead computes one dense trajectory
  // over the full 0..maxRange span (see CHART_DENSE_RANGE_STEP_M) whenever
  // a shot input changes, caches it in denseChartPoints, and resamples
  // that cache to exactly CHART_POINTS_TARGET points spanning the current
  // zoom window on every pan/zoom tick — see applyZoom() below. Zooming
  // narrower still buys back real resolution (more of the dense cache
  // packed into the same CHART_POINTS_TARGET samples), but without a
  // worker round-trip on every slider drag tick, and without the "forced
  // to land exactly on maxRange, but not on the window's own start"
  // irregular tail gap the old per-window engine call produced.
  const chartContainer = el('div', { class: 'chart-container' });
  const chartColumnSelect = buildChartColumnSelect(COLUMNS, {
    id: 'trajectoryChartColumn', energyChoice, velocityChoice, smallLengthChoice, defaultColumnId: 'dropCm'
  });
  // Empty and hidden until renderChart() finds the selected column is a
  // drop-family one (see COLUMNS' showLineOfSight) — this is the only
  // series the Trajectory chart ever has a legend for, since it plots one
  // real column at a time and that column's identity is already given by
  // chartColumnSelect itself.
  const chartLegend = el('div', { class: 'chart-legend' });

  let chart = null;
  let denseChartPoints = [];
  let lastChartPoints = [];

  function applyZoom() {
    const { startM, endM } = zoomSlider.getWindow();
    lastChartPoints = resampleChartPoints(denseChartPoints, startM, endM, CHART_POINTS_TARGET);
    renderChart(lastChartPoints, chartColumnSelect.value);
  }

  let zoomRafScheduled = false;
  function scheduleApplyZoom() {
    if (zoomRafScheduled) return;
    zoomRafScheduled = true;
    requestAnimationFrame(() => {
      zoomRafScheduled = false;
      applyZoom();
    });
  }

  const zoomSlider = zoomRangeSlider({
    minWindowM: MIN_ZOOM_WINDOW_M,
    onInput: scheduleApplyZoom
  });
  // The slider constructs with its own internal default bounds (just
  // [0, minWindowM]) — sync it to the table's actual Max Range immediately
  // so it starts fully zoomed out over the real range, not a 50 m sliver.
  zoomSlider.setBounds(maxRangeField.getEngineValue());

  function renderChart(points, columnId) {
    const col = COLUMNS.find((c) => c.id === columnId);
    const clickSettings = rifle.getClickSettings();
    const massKg = cartridge.getValues().massKg;
    const labels = points.map((p) => Math.round(engineToDisplay('range', p.range, distanceUnit)));
    // Full precision, not rounded to col.decimals (that's a table-text
    // concern) — rounding a smooth curve to the table's display precision
    // collapses multiple distinct nearby values to the same number at
    // narrow zoom (e.g. right around a trajectory's peak, where the value
    // changes very little from one sample to the next), producing a
    // visibly "stepped" flat-then-jump line instead of a smooth curve.
    const series = [points.map((p) => {
      try {
        return col.value(p, { clickSettings, massKg });
      } catch {
        return null; // Chartist treats a null series value as a data hole
      }
    })];
    if (col.showLineOfSight) series.push(lineOfSightSeries(points.length));

    clear(chartLegend);
    if (col.showLineOfSight) chartLegend.appendChild(lineOfSightLegendItem());
    chartLegend.style.display = col.showLineOfSight ? '' : 'none';

    const options = {
      fullWidth: true,
      chartPadding: { right: 24 },
      axisY: { onlyInteger: false },
      axisX: { labelInterpolationFnc: thinChartLabels(chartContainer, labels) },
      showPoint: false, // line only, no data-point markers
      lineSmooth: true // default cubic (monotoneCubic) smoothing
    };
    if (chart) {
      chart.update({ labels, series }, options);
    } else {
      chart = new LineChart(chartContainer, { labels, series }, options);
    }
  }

  chartColumnSelect.addEventListener('change', () => {
    renderChart(lastChartPoints, chartColumnSelect.value);
  });

  let latestChartRequestId = 0;
  async function recomputeChart() {
    const id = ++latestChartRequestId;
    try {
      const { points } = await pool.run('trajectory', { ...readState(), rangeStep: CHART_DENSE_RANGE_STEP_M });
      if (id !== latestChartRequestId) return; // superseded by a newer input
      denseChartPoints = points;
      applyZoom();
    } catch {
      if (id !== latestChartRequestId) return;
      // Leave the chart showing its last good state — the table's own
      // status line already reports computation failures.
    }
  }

  const chartCard = el('div', { class: 'card' }, [
    el('div', { class: 'card-header-row' }, [
      el('h2', { i18n: 'trajectory.chartHeading' }),
      downloadButton({
        label: t('trajectory.downloadChartSvg'),
        onClick: () => exportChartSvg(chartContainer, 'trajectory-chart.svg')
      })
    ]),
    el('div', { class: 'field' }, [el('label', { i18n: 'trajectory.chartColumnLabel' }), chartColumnSelect]),
    chartLegend,
    chartContainer,
    zoomSlider.node
  ]);

  const results = el('div', { class: 'tool-results' }, [
    chartCard,
    el('div', { class: 'card' }, [
      el('div', { class: 'card-header-row' }, [
        el('h2', { i18n: 'trajectory.columnsHeading' }),
        el('div', { class: 'card-header-actions' }, [
          copyButton({
            label: t('trajectory.copyTableCsv'),
            copiedLabel: t('trajectory.copyTableCsvCopied'),
            getText: () => buildTableCsvText()
          }),
          downloadButton({ label: t('trajectory.downloadTableCsv'), onClick: () => exportTableCsv() })
        ])
      ]),
      toggles.node,
      el('div', { class: 'scroll-x' }, [
        el('table', {}, [el('thead', {}, [headerRow]), tableBody])
      ])
    ])
  ]);

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'trajectory.title' }),
    el('div', { class: 'tool-layout' }, [controls, results])
  ]));

  function readState() {
    return {
      maxRange: maxRangeField.getEngineValue(),
      rangeStep: rangeStepField.getEngineValue(),
      losAngleDeg: losAngleField.getEngineValue(),
      ...cartridge.getValues(),
      ...rifle.getValues(),
      ...atmosphere.getValues(),
      ...cartridge.getStabilityValues(),
      ...rifle.getStabilityValues(),
      spinDriftMode: getSpinDriftMode(),
      zeroForSpinDrift: isZeroForSpinDriftEnabled()
    };
  }

  function renderHeader() {
    clear(headerRow);
    headerRow.appendChild(el('th', {}, [
      i18nSpan('trajectory.colRange'),
      document.createTextNode(` (${distanceChoice.label})`)
    ]));
    const unitChoiceById = { energy: energyChoice, velocity: velocityChoice, dropCm: smallLengthChoice, windageCm: smallLengthChoice };
    for (const col of COLUMNS) {
      if (!toggles.isVisible(col.id)) continue;
      const choice = unitChoiceById[col.id];
      if (choice) {
        headerRow.appendChild(el('th', {}, [
          i18nSpan(col.headerKey),
          document.createTextNode(` (${choice.label})`)
        ]));
      } else {
        headerRow.appendChild(el('th', { i18n: col.headerKey }));
      }
    }
  }

  function renderRows(points) {
    const visibleColumns = COLUMNS.filter((col) => toggles.isVisible(col.id));
    const formatCtx = { clickSettings: rifle.getClickSettings(), massKg: cartridge.getValues().massKg };

    clear(tableBody);
    points.forEach((p) => {
      const displayRange = engineToDisplay('range', p.range, distanceUnit);
      const cells = [el('td', { text: displayRange.toFixed(RANGE_DECIMALS) })];
      for (const col of visibleColumns) {
        // One column's value() throwing (e.g. a field missing from a
        // stale cached point) must not blank every already-computed row —
        // fall back to a placeholder for just that cell.
        let text;
        try {
          text = col.value(p, formatCtx).toFixed(col.decimals);
        } catch {
          text = '—';
        }
        cells.push(el('td', { text }));
      }
      tableBody.appendChild(el('tr', {}, cells));
    });
  }

  function render(points) {
    lastPoints = points;
    renderRows(points);
  }

  // Builds exactly what the table currently shows — same visible-column
  // set and the same last-computed points renderRows() just drew — as
  // CSV text, formatted per the user's Settings choice of field/decimal
  // separator (see csv-prefs.js) rather than hardcoding the US/UK
  // convention every other part of this app doesn't otherwise assume.
  // Shared by the download button and the copy-to-clipboard button below
  // so the two can never drift into showing different data.
  function buildTableCsvText() {
    const visibleColumns = COLUMNS.filter((col) => toggles.isVisible(col.id));
    const formatCtx = { clickSettings: rifle.getClickSettings(), massKg: cartridge.getValues().massKg };
    const fieldSeparator = getFieldSeparator();
    const decimalSeparator = getDecimalSeparator();

    const unitChoiceById = { energy: energyChoice, velocity: velocityChoice, dropCm: smallLengthChoice, windageCm: smallLengthChoice };
    const header = [
      `${t('trajectory.colRange')} (${distanceChoice.label})`,
      ...visibleColumns.map((col) => unitChoiceById[col.id]
        ? `${t(col.headerKey)} (${unitChoiceById[col.id].label})`
        : t(col.headerKey))
    ];
    const rows = lastPoints.map((p) => {
      const displayRange = engineToDisplay('range', p.range, distanceUnit);
      const cells = [formatCsvNumber(displayRange, RANGE_DECIMALS, decimalSeparator)];
      for (const col of visibleColumns) {
        let text;
        try {
          text = formatCsvNumber(col.value(p, formatCtx), col.decimals, decimalSeparator);
        } catch {
          text = '';
        }
        cells.push(text);
      }
      return cells;
    });

    return buildCsv([header, ...rows], fieldSeparator);
  }

  function exportTableCsv() {
    downloadFile('trajectory.csv', buildTableCsvText(), 'text/csv;charset=utf-8');
  }

  renderHeader(); // shown immediately, before the first computation resolves

  async function recompute() {
    const id = ++latestRequestId;
    applyI18nText(status, 'common.computing');
    status.className = 'status';
    try {
      const { points, launchAngleDeg } = await pool.run('trajectory', readState());
      if (id !== latestRequestId) return; // superseded by a newer input
      const launchAngleMrad = convertAngularValue(launchAngleDeg, 'deg', 'mrad');
      applyI18nText(status, 'trajectory.statusOk', {
        count: points.length, angle: launchAngleDeg.toFixed(3), angleMrad: launchAngleMrad.toFixed(2)
      });
      status.className = 'status ok';
      render(points);
      refreshSpinDriftHint();
    } catch (err) {
      if (id !== latestRequestId) return;
      applyI18nText(status, 'common.error', { message: err.message });
      status.className = 'status error';
    }
  }

  recompute();
  recomputeChart();

  return () => {
    latestRequestId++; // invalidate any in-flight response after unmount
    latestChartRequestId++;
  };
}
