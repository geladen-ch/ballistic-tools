import { el, clear } from '../dom.js';
import { getPool } from '../pool.js';
import { unitField } from '../ui/unit-field.js';
import { cartridgeSection } from '../ui/sections/cartridge-section.js';
import { rifleSection } from '../ui/sections/rifle-section.js';
import { gunsSummary } from '../ui/sections/guns-summary.js';
import { atmosphereSection } from '../ui/sections/atmosphere-section.js';
import { columnToggles } from '../ui/column-toggles.js';
import { zoomRangeSlider } from '../ui/zoom-range-slider.js';
import { engineToDisplay, displayToEngine, unitChoice, convertAngularValue, clicksForOffset, angularUnitToCmAtRange, UNIT_GROUPS, FIELD_BOUNDS, formatFieldValue } from '../units.js';
import { getUnit } from '../prefs.js';
import { sectionGroup } from '../ui/section.js';
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
  // Map<range, formatted string> — the "Danger zone" column's own data,
  // computed separately from every other column (see recomputeDangerZone()
  // below) since it needs a per-row solve, not a plain synchronous
  // function of the point. Empty (column renders '—' everywhere) until
  // that resolves, and whenever the column itself isn't visible at all.
  let dangerZoneText = new Map();
  // Map<range, {enterM, leaveM}> — the same recomputeDangerZone() results
  // in raw engine units, kept alongside dangerZoneText for the envelope
  // chart below (see renderDangerZoneChart()), which needs plottable
  // numbers rather than the table's own pre-formatted display string.
  let dangerZoneRaw = new Map();

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

  let directHitRafScheduled = false;
  function scheduleRecomputeDirectHit() {
    if (directHitRafScheduled) return;
    directHitRafScheduled = true;
    requestAnimationFrame(() => {
      directHitRafScheduled = false;
      recomputeDirectHit();
    });
  }

  let dangerZoneRafScheduled = false;
  function scheduleRecomputeDangerZone() {
    if (dangerZoneRafScheduled) return;
    dangerZoneRafScheduled = true;
    requestAnimationFrame(() => {
      dangerZoneRafScheduled = false;
      recomputeDangerZone();
    });
  }

  // Every ballistic input needs the table, the chart, and the direct-hit
  // solve recomputed; rangeStepField is the one exception (see its own
  // onInput below) — it's a table-display-only knob neither the chart's
  // dense resolution nor the direct-hit solve (which walks computeImpact()
  // continuously, not through the table's stepped rows) ever reads.
  // Danger zone is deliberately *not* scheduled here — it depends on the
  // table's own just-recomputed rows (each row supplies its own
  // hypothetical zero range), so recompute() below kicks it off itself
  // once new points actually land, rather than racing it here against
  // stale ones.
  function handleShotInputChange() {
    scheduleRecompute();
    scheduleRecomputeChart();
    scheduleRecomputeDirectHit();
    updateZeroOverrideVisibility();
  }

  // Restored once at mount — maxRange/rangeStep/losAngle/target* are
  // view-local (not part of the shared cartridge/rifle/atmosphere shot
  // config, see shot-state.js), so without their own persistence they'd
  // silently reset to their hardcoded defaults on every navigation away
  // and back.
  const savedInputs = loadTrajectoryInputsState() || {};

  // A user on yards gets a round 1000 yd / 100 yd default rather than
  // whatever a straight 1000 m / 100 m conversion happens to land on
  // (1093.6 yd / 109.4 yd) — only used when there's no persisted value yet.
  function roundDistanceDefault(fieldId, metricValue, yardValue) {
    return getUnit('distance') === 'yd' ? displayToEngine(fieldId, yardValue, 'yd') : metricValue;
  }

  // Same idea as roundDistanceDefault() above, for the smallLength group
  // (mm/cm/in) instead of distance — used by targetHeightField below.
  function roundSmallLengthDefault(fieldId, metricValueCm, imperialValueIn) {
    return getUnit('smallLength') === 'in' ? displayToEngine(fieldId, imperialValueIn, 'in') : metricValueCm;
  }

  function persistInputs() {
    saveTrajectoryInputsState({
      maxRange: maxRangeField.getEngineValue(),
      rangeStep: rangeStepField.getEngineValue(),
      losAngleDeg: losAngleField.getEngineValue(),
      targetHeightCm: targetHeightField.getEngineValue(),
      aimingPoint: aimingPointSelect.value,
      zeroRangeOverrideM: zeroRangeOverrideField.getEngineValue(),
      useOwnZero: useOwnZeroCheckbox.checked
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
  // The target this shot is being sized against for the direct-hit solve
  // below (see engine/trajectory.js's solveDirectHit()) — its own inputs,
  // not part of the shared cartridge/rifle/atmosphere shot config, so they
  // live and persist alongside maxRange/rangeStep/losAngle above rather
  // than in shot-state.js.
  const targetHeightField = unitField({
    id: 'targetHeight', ...FIELD_BOUNDS.targetHeight, step: 0.5,
    value: savedInputs.targetHeightCm ?? roundSmallLengthDefault('targetHeight', 50, 20),
    onInput: () => { scheduleRecomputeDirectHit(); scheduleRecomputeDangerZone(); persistInputs(); }
  });
  // A plain enum, not a unit-bearing quantity — same "always has a real
  // value" shape as rifle-section.js's own twistDirectionSelect.
  const aimingPointSelect = el('select', { id: 'aimingPoint' }, [
    el('option', { value: 'center', i18n: 'fields.aimingPointCenter' }),
    el('option', { value: 'bottomEdge', i18n: 'fields.aimingPointBottomEdge' })
  ]);
  aimingPointSelect.value = savedInputs.aimingPoint ?? 'center';
  aimingPointSelect.addEventListener('change', () => { scheduleRecomputeDirectHit(); scheduleRecomputeDangerZone(); persistInputs(); });
  const target = sectionGroup('sections.targetHeading', [
    targetHeightField.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.aimingPoint' }), aimingPointSelect])
  ]);
  // rifle/cartridge are never rendered here — they exist only to read
  // the active gun configuration's engine values (readState() below),
  // exactly as when they were visible, just no longer appended to the
  // page. The actual picker UI now lives on Guns (see guns-view.js);
  // gunsSummary() is the compact stand-in shown here instead, reading the
  // same shared shot-state.js these two restore from at construction.
  const cartridge = cartridgeSection({ onInput: handleShotInputChange });
  const rifle = rifleSection({ onInput: handleShotInputChange, onLibraryCartridgeChange: cartridge.setLibraryCartridge });
  const guns = gunsSummary({ bare: true });
  const atmosphere = atmosphereSection({ combinedWind: true, onInput: handleShotInputChange });

  // Optional "for this tool only" stand-in for the rifle's own configured
  // zero range (see rifle-section.js's zeroRangeField) — blank (the
  // default) leaves every computation exactly as it already was; a value
  // here is applied in readState() below, after the rifle's own getValues()
  // spread, so it never touches — or even reads back into — Guns' own
  // stored zero range.
  const zeroRangeOverrideField = unitField({
    id: 'zeroRangeOverride', ...FIELD_BOUNDS.zeroRange, step: 5, optional: true,
    value: savedInputs.zeroRangeOverrideM ?? null,
    onInput: () => { updateZeroOverrideVisibility(); handleShotInputChange(); persistInputs(); }
  });
  const zeroRangeOverrideHint = el('p', { class: 'hint', i18n: 'trajectory.zeroRangeOverrideHint' });
  // Only meaningful — and only shown — while both hold: an override is
  // actually set above, and the active cartridge is itself a zero
  // *recipient* (rifle.getZeroDonorBallistics() below), i.e. its real zero
  // is solved from a donor cartridge's ballistics rather than its own (see
  // zero-donor.js). Unchecked (the default) carries that same donor
  // borrowing over to the override — "what if my donor had been zeroed at
  // this other distance instead"; checked solves the override using this
  // cartridge's own ballistics instead, ignoring the donor.
  const useOwnZeroCheckbox = el('input', { type: 'checkbox', id: 'useOwnZero' });
  const useOwnZeroRow = el('label', { class: 'checkbox-field' }, [useOwnZeroCheckbox, i18nSpan('trajectory.useOwnZeroLabel')]);
  const useOwnZeroHint = el('p', { class: 'hint', i18n: 'trajectory.useOwnZeroHint' });
  useOwnZeroCheckbox.checked = !!savedInputs.useOwnZero;
  useOwnZeroCheckbox.addEventListener('change', () => { handleShotInputChange(); persistInputs(); });

  function updateZeroOverrideVisibility() {
    const showUseOwnZero = zeroRangeOverrideField.getEngineValue() != null && !!rifle.getZeroDonorBallistics();
    useOwnZeroRow.style.display = showUseOwnZero ? '' : 'none';
    useOwnZeroHint.style.display = showUseOwnZero ? '' : 'none';
    if (!showUseOwnZero) useOwnZeroCheckbox.checked = false; // don't let a hidden control silently stay checked
  }
  updateZeroOverrideVisibility();

  const controls = el('div', { class: 'card' }, [
    el('h2', { i18n: 'trajectory.inputsHeading' }),
    guns.node,
    zeroRangeOverrideField.node,
    zeroRangeOverrideHint,
    useOwnZeroRow,
    useOwnZeroHint,
    maxRangeField.node,
    rangeStepField.node,
    losAngleField.node,
    target,
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
      // Danger zone is the one column with real compute cost behind it
      // (see recomputeDangerZone()) — only worth running when it's
      // actually being turned on; recomputeDangerZone() itself clears the
      // cache and no-ops if it's just been turned off.
      scheduleRecomputeDangerZone();
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

  // === Info pane: zero angle, trajectory peak, and direct-hit readouts ===
  //
  // Fed from the chart's own dense (1 m step) points/launchAngleDeg —
  // not the table's coarser rangeStep rows — since the peak's height and
  // distance are derived client-side by scanning for the point with the
  // largest dropCm (positive = above the line of sight, see toLOS() in
  // the engine), and the table's own step could easily skip straight over
  // the true peak. zeroAngleValue is refreshed from this same call rather
  // than recompute()'s (physically identical, since both solve the same
  // shot config — see recomputeChart()'s own comment on why the chart
  // uses a separate engine call in the first place) so both readouts in
  // this pane always update together.
  const angleUnit = getUnit('angleDispersion');
  const angleChoice = UNIT_GROUPS.angleDispersion.choices.find((c) => c.unit === angleUnit);

  function infoRow(labelKey, valueNode) {
    return el('div', { class: 'info-pane-row' }, [el('span', { i18n: labelKey }), valueNode]);
  }

  const zeroAngleValue = el('span', { class: 'info-pane-value', text: '—' });
  const peakHeightValue = el('span', { class: 'info-pane-value', text: '—' });
  const peakDistanceValue = el('span', { class: 'info-pane-value', text: '—' });
  // Filled in by updateDirectHitPane() below; start at the placeholder
  // dash until the first solve resolves (or whenever it can't — see
  // solveDirectHit()'s own NO_SOLUTION case).
  const directHitMaxDistanceValue = el('span', { class: 'info-pane-value', text: '—' });
  const directHitZeroDistanceValue = el('span', { class: 'info-pane-value', text: '—' });
  const directHitElevationClicksValue = el('span', { class: 'info-pane-value', text: '—' });
  const directHitElevationAbsoluteValue = el('span', { class: 'info-pane-value', text: '—' });
  // The rifle's *current* zero angle (whatever zeroRange it's actually
  // configured for) — set alongside zeroAngleValue below and reused by
  // updateDirectHitPane() to report how far the direct-hit solve's own
  // (generally different) zero angle sits from it.
  let lastLaunchAngleDeg = null;

  const infoCard = el('div', { class: 'card' }, [
    el('h2', { i18n: 'trajectory.infoHeading' }),
    infoRow('trajectory.zeroAngleLabel', zeroAngleValue),
    infoRow('trajectory.peakHeightLabel', peakHeightValue),
    infoRow('trajectory.peakDistanceLabel', peakDistanceValue),
    sectionGroup('trajectory.directHitHeading', [
      infoRow('trajectory.directHitMaxDistanceLabel', directHitMaxDistanceValue),
      infoRow('trajectory.directHitZeroDistanceLabel', directHitZeroDistanceValue),
      infoRow('trajectory.directHitElevationClicksLabel', directHitElevationClicksValue),
      infoRow('trajectory.directHitElevationAbsoluteLabel', directHitElevationAbsoluteValue)
    ], { nested: true })
  ]);

  function updateInfoPane(points, launchAngleDeg) {
    lastLaunchAngleDeg = launchAngleDeg;
    const angleDisplay = convertAngularValue(launchAngleDeg, 'deg', angleUnit);
    zeroAngleValue.textContent = `${launchAngleDeg.toFixed(3)}° (${angleDisplay.toFixed(2)} ${angleChoice.label})`;

    if (!points.length) return;
    const peak = points.reduce((best, p) => (p.dropCm > best.dropCm ? p : best), points[0]);
    const peakHeightDisplay = engineToDisplay('dropCm', peak.dropCm, getUnit('smallLength'));
    const peakAngular = clicksForOffset(peak.dropCm, 1, angleUnit, peak.range);
    peakHeightValue.textContent = `${peakHeightDisplay.toFixed(1)} ${smallLengthChoice.label} (${peakAngular.toFixed(2)} ${angleChoice.label})`;
    const peakDistanceDisplay = engineToDisplay('range', peak.range, distanceUnit);
    peakDistanceValue.textContent = `${peakDistanceDisplay.toFixed(RANGE_DECIMALS)} ${distanceChoice.label}`;
  }

  // The four "reserved" Direct hit rows above, now wired up.
  // solveDirectHit() (engine/trajectory.js) itself just returns the three
  // raw numbers (an optimal launch angle plus the two ranges it implies);
  // turning the angle *difference* from the rifle's current zero
  // (lastLaunchAngleDeg, set by updateInfoPane() above — both are
  // refreshed by the same input change, so they're always compared at the
  // same shot config) into clicks and into a linear offset at the new
  // zero distance is display-side work, same as every other unit
  // conversion on this page.
  function updateDirectHitPane(result) {
    if (!result || result.maxDirectHitDistanceM == null) {
      directHitMaxDistanceValue.textContent = '—';
      directHitZeroDistanceValue.textContent = '—';
      directHitElevationClicksValue.textContent = '—';
      directHitElevationAbsoluteValue.textContent = '—';
      return;
    }

    const maxDistDisplay = engineToDisplay('range', result.maxDirectHitDistanceM, distanceUnit);
    directHitMaxDistanceValue.textContent = `${maxDistDisplay.toFixed(RANGE_DECIMALS)} ${distanceChoice.label}`;
    const zeroDistDisplay = engineToDisplay('range', result.zeroDistanceM, distanceUnit);
    directHitZeroDistanceValue.textContent = `${zeroDistDisplay.toFixed(RANGE_DECIMALS)} ${distanceChoice.label}`;

    if (lastLaunchAngleDeg == null) {
      directHitElevationClicksValue.textContent = '—';
      directHitElevationAbsoluteValue.textContent = '—';
      return;
    }
    const angleDiffDeg = result.launchAngleDeg - lastLaunchAngleDeg;
    const clickSettings = rifle.getClickSettings();
    const clicks = convertAngularValue(angleDiffDeg, 'deg', clickSettings.unit) / clickSettings.vertical;
    directHitElevationClicksValue.textContent = `${clicks >= 0 ? '+' : ''}${clicks.toFixed(1)}`;
    const absoluteCm = convertAngularValue(angleDiffDeg, 'deg', 'mrad') * angularUnitToCmAtRange('mrad', result.zeroDistanceM);
    const absoluteDisplay = engineToDisplay('dropCm', absoluteCm, getUnit('smallLength'));
    directHitElevationAbsoluteValue.textContent = `${absoluteDisplay >= 0 ? '+' : ''}${absoluteDisplay.toFixed(1)} ${smallLengthChoice.label}`;
  }

  let latestDirectHitRequestId = 0;
  async function recomputeDirectHit() {
    const id = ++latestDirectHitRequestId;
    try {
      const result = await pool.run('directHit', {
        ...readState(),
        targetHeightCm: targetHeightField.getEngineValue(),
        aimingPoint: aimingPointSelect.value
      });
      if (id !== latestDirectHitRequestId) return; // superseded by a newer input
      updateDirectHitPane(result);
    } catch {
      if (id !== latestDirectHitRequestId) return;
      updateDirectHitPane(null);
    }
  }

  // "Danger zone" column (see trajectory-columns.js) — for every row
  // currently shown in the table, re-solves the zero angle as if the
  // rifle were zeroed exactly at *that row's own range* (see
  // solveDangerZone()'s own doc comment in engine/trajectory.js), then
  // reports where the trajectory enters and leaves the target's allowed
  // band. Runs once per visible row via pool.runAll() — the same
  // "spread N independent solves across every worker" API Hit
  // Probability's Monte Carlo batches already use — rather than one
  // sequential loop, since a few hundred rows' worth of per-row zero/peak/
  // crossing solves is the one part of this view actually worth
  // parallelizing across cores. Deliberately keyed off lastPoints (the
  // table's own just-rendered rows), not a fresh 'trajectory' call of its
  // own — it has nothing to add to that call, only to react to its result.
  let latestDangerZoneRequestId = 0;
  async function recomputeDangerZone() {
    const id = ++latestDangerZoneRequestId;
    if (!toggles.isVisible('dangerZone') || lastPoints.length === 0) {
      dangerZoneText = new Map();
      dangerZoneRaw = new Map();
      renderRows(lastPoints);
      renderDangerZoneChart();
      return;
    }
    const targetHeightCm = targetHeightField.getEngineValue();
    const aimingPoint = aimingPointSelect.value;
    const baseState = readBaseState();
    const payloads = lastPoints.map((p) => ({ ...baseState, zeroRange: p.range, targetHeightCm, aimingPoint }));
    try {
      const results = await pool.runAll('dangerZone', payloads);
      if (id !== latestDangerZoneRequestId) return; // superseded by a newer input
      const text = new Map();
      const raw = new Map();
      lastPoints.forEach((p, i) => {
        const r = results[i];
        if (!r || r.enterM == null) return; // no solution for this row — its cell falls back to '—'
        const enter = engineToDisplay('range', r.enterM, distanceUnit).toFixed(RANGE_DECIMALS);
        const leave = engineToDisplay('range', r.leaveM, distanceUnit).toFixed(RANGE_DECIMALS);
        const length = engineToDisplay('range', r.lengthM, distanceUnit).toFixed(RANGE_DECIMALS);
        text.set(p.range, `${enter}–${leave} ${distanceChoice.label} (${length} ${distanceChoice.label})`);
        raw.set(p.range, { enterM: r.enterM, leaveM: r.leaveM });
      });
      dangerZoneText = text;
      dangerZoneRaw = raw;
      renderRows(lastPoints);
      renderDangerZoneChart();
    } catch {
      if (id !== latestDangerZoneRequestId) return;
      dangerZoneText = new Map();
      dangerZoneRaw = new Map();
      renderRows(lastPoints);
      renderDangerZoneChart();
    }
  }

  let latestChartRequestId = 0;
  async function recomputeChart() {
    const id = ++latestChartRequestId;
    try {
      const { points, launchAngleDeg } = await pool.run('trajectory', { ...readState(), rangeStep: CHART_DENSE_RANGE_STEP_M });
      if (id !== latestChartRequestId) return; // superseded by a newer input
      denseChartPoints = points;
      applyZoom();
      updateInfoPane(points, launchAngleDeg);
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

  // === Danger zone envelope chart ===
  //
  // Hidden for now (see DANGER_ZONE_CHART_ENABLED below) — deliberately
  // kept intact rather than removed, so it's a one-line flip to bring
  // back.
  //
  // A different x-axis than every other chart on this page: each point
  // here is one table row's own *zero distance* (not a range along one
  // fixed trajectory), plotted against how far before/after it the
  // trajectory stays within the target — dangerZoneRaw's own
  // {enterM, leaveM}, expressed as offsets from that row's range. Both
  // series share a 0 baseline (Chartist's own showArea/areaBase, see
  // .ct-series-danger-upper/-lower in base.css) so the two area fills —
  // one above 0, one below — read as a single continuous shaded band
  // with no custom fill-between-curves code needed. Only ever built (and
  // kept in sync with, via recomputeDangerZone() above) while the table's
  // own Danger zone column is switched on — same opt-in gate, since this
  // reuses that column's own (comparatively expensive) per-row solve
  // rather than a cheap synchronous one.
  const dangerZoneChartContainer = el('div', { class: 'chart-container' });
  const dangerZoneChartLegend = el('div', { class: 'chart-legend' }, [
    el('span', { class: 'chart-legend-item chart-legend-danger' }, [
      el('span', { class: 'chart-legend-swatch' }),
      document.createTextNode(t('trajectory.colDangerZone'))
    ])
  ]);
  const dangerZoneChartHint = el('p', { class: 'hint', i18n: 'trajectory.dangerZoneChartHint' });
  let dangerZoneChart = null;
  // Hides the chart card unconditionally, independent of the Danger zone
  // column's own toggle state (see the "hidden for now" comment above) —
  // flip to true to bring it back; nothing else about this feature needs
  // to change.
  const DANGER_ZONE_CHART_ENABLED = false;

  function renderDangerZoneChart() {
    const visible = DANGER_ZONE_CHART_ENABLED
      && toggles.isVisible('dangerZone') && lastPoints.some((p) => dangerZoneRaw.has(p.range));
    dangerZoneChartCard.style.display = visible ? '' : 'none';
    if (!visible) return;

    const labels = lastPoints.map((p) => Math.round(engineToDisplay('range', p.range, distanceUnit)));
    const upper = lastPoints.map((p) => {
      const r = dangerZoneRaw.get(p.range);
      return r ? engineToDisplay('range', r.leaveM - p.range, distanceUnit) : null;
    });
    const lower = lastPoints.map((p) => {
      const r = dangerZoneRaw.get(p.range);
      return r ? engineToDisplay('range', r.enterM - p.range, distanceUnit) : null;
    });
    const series = [
      { data: upper, className: 'ct-series-danger-upper' },
      { data: lower, className: 'ct-series-danger-lower' }
    ];
    const options = {
      fullWidth: true,
      chartPadding: { right: 24 },
      axisY: { onlyInteger: false },
      axisX: { labelInterpolationFnc: thinChartLabels(dangerZoneChartContainer, labels) },
      showPoint: false,
      showArea: true,
      areaBase: 0,
      // Straight segments, not the chart's usual cardinal smoothing — the
      // entry/exit-vs-zero curves have a real kink exactly where a row's
      // zero range crosses this target's own point-blank distance (see
      // solveDangerZone()'s doc comment), and smoothing would round that
      // corner off misleadingly.
      lineSmooth: false
    };
    if (dangerZoneChart) {
      dangerZoneChart.update({ labels, series }, options);
    } else {
      dangerZoneChart = new LineChart(dangerZoneChartContainer, { labels, series }, options);
    }
  }

  const dangerZoneChartCard = el('div', { class: 'card' }, [
    el('h2', { i18n: 'trajectory.colDangerZone' }),
    dangerZoneChartLegend,
    dangerZoneChartContainer,
    dangerZoneChartHint
  ]);
  dangerZoneChartCard.style.display = 'none'; // recomputeDangerZone()'s own first pass decides the real state

  const results = el('div', { class: 'tool-results' }, [
    infoCard,
    chartCard,
    dangerZoneChartCard,
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

  // Everything the engine needs *except* the zero-range-override
  // decision below — its own function since recomputeDangerZone() needs
  // this same base (rifle's real zeroRange, real zeroDonorBallistics)
  // with each row's own range substituted in as the hypothetical zero,
  // never the override (an override is a single "for the whole tool"
  // stand-in; Danger zone is inherently already "what if zeroed at range
  // X" per row, so there's no override value for it to apply here).
  function readBaseState() {
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
      zeroForSpinDrift: isZeroForSpinDriftEnabled(),
      // "Zeroed with a different cartridge" — see zero-donor.js and
      // rifle-section.js's own getZeroDonorBallistics(). null whenever the
      // selected cartridge doesn't borrow a sibling's zero.
      zeroDonorBallistics: rifle.getZeroDonorBallistics()
    };
  }

  function readState() {
    const state = readBaseState();
    // zeroRangeOverrideField — applied last, after every spread, so it
    // always wins over the rifle's own zeroRange without ever writing
    // back into it. Leaving "use own zero" unchecked (or not applicable —
    // see updateZeroOverrideVisibility()) carries the donor borrowing over
    // to the override unchanged; checking it drops zeroDonorBallistics so
    // resolveLaunchAngle() solves from this cartridge's own ballistics.
    const zeroRangeOverrideM = zeroRangeOverrideField.getEngineValue();
    if (zeroRangeOverrideM != null) {
      state.zeroRange = zeroRangeOverrideM;
      if (state.zeroDonorBallistics && useOwnZeroCheckbox.checked) state.zeroDonorBallistics = null;
    }
    return state;
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
    const formatCtx = { clickSettings: rifle.getClickSettings(), massKg: cartridge.getValues().massKg, dangerZoneText };

    clear(tableBody);
    points.forEach((p) => {
      const displayRange = engineToDisplay('range', p.range, distanceUnit);
      const cells = [el('td', { text: displayRange.toFixed(RANGE_DECIMALS) })];
      for (const col of visibleColumns) {
        // One column's value() throwing (e.g. a field missing from a
        // stale cached point, or dangerZoneText not having this row's
        // entry yet — see trajectory-columns.js's own dangerZone column)
        // must not blank every already-computed row — fall back to a
        // placeholder for just that cell.
        let text;
        try {
          const value = col.value(p, formatCtx);
          text = col.formatText ? value : value.toFixed(col.decimals);
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
    const formatCtx = { clickSettings: rifle.getClickSettings(), massKg: cartridge.getValues().massKg, dangerZoneText };
    const fieldSeparator = getFieldSeparator();
    const decimalSeparator = getDecimalSeparator();

    const unitChoiceById = { energy: energyChoice, velocity: velocityChoice, dropCm: smallLengthChoice, windageCm: smallLengthChoice };
    // The Danger zone column shows one combined "84–412 m (328 m)" cell
    // on screen, but a CSV consumer wants the three figures as their own
    // numeric columns rather than having to parse that string back apart
    // — sourced from dangerZoneRaw (raw engine units, kept alongside
    // dangerZoneText precisely for cases like this one and the envelope
    // chart, which also can't use a pre-formatted display string).
    const dangerZoneUnitSuffix = ` (${distanceChoice.label})`;
    const header = [
      `${t('trajectory.colRange')} (${distanceChoice.label})`,
      ...visibleColumns.flatMap((col) => col.id === 'dangerZone'
        ? [
            `${t('trajectory.colDangerZoneEntry')}${dangerZoneUnitSuffix}`,
            `${t('trajectory.colDangerZoneExit')}${dangerZoneUnitSuffix}`,
            `${t('trajectory.colDangerZoneSpan')}${dangerZoneUnitSuffix}`
          ]
        : [unitChoiceById[col.id] ? `${t(col.headerKey)} (${unitChoiceById[col.id].label})` : t(col.headerKey)])
    ];
    const rows = lastPoints.map((p) => {
      const displayRange = engineToDisplay('range', p.range, distanceUnit);
      const cells = [formatCsvNumber(displayRange, RANGE_DECIMALS, decimalSeparator)];
      for (const col of visibleColumns) {
        if (col.id === 'dangerZone') {
          const r = dangerZoneRaw.get(p.range);
          if (r) {
            cells.push(
              formatCsvNumber(engineToDisplay('range', r.enterM, distanceUnit), RANGE_DECIMALS, decimalSeparator),
              formatCsvNumber(engineToDisplay('range', r.leaveM, distanceUnit), RANGE_DECIMALS, decimalSeparator),
              formatCsvNumber(engineToDisplay('range', r.leaveM - r.enterM, distanceUnit), RANGE_DECIMALS, decimalSeparator)
            );
          } else {
            cells.push('', '', ''); // no solution for this row — see solveDangerZone()'s own NO_SOLUTION case
          }
          continue;
        }
        let text;
        try {
          const value = col.value(p, formatCtx);
          text = col.formatText ? value : formatCsvNumber(value, col.decimals, decimalSeparator);
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
      scheduleRecomputeDangerZone();
    } catch (err) {
      if (id !== latestRequestId) return;
      applyI18nText(status, 'common.error', { message: err.message });
      status.className = 'status error';
    }
  }

  recompute();
  recomputeChart();
  recomputeDirectHit();

  return () => {
    latestRequestId++; // invalidate any in-flight response after unmount
    latestChartRequestId++;
    latestDirectHitRequestId++;
    latestDangerZoneRequestId++;
  };
}
