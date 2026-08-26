// Analysis view for the Rifle Precision Calculator (route
// /rifle-precision/analysis) — read-only: pooled scatterplot ("Aggregate
// results") with a legend table beside it, a results-display-units
// selector governing every value on the page, image-export options, a
// "Numbers" table whose own "show on image" checkboxes double as the
// diagram/legend overlay toggles, confidence-o-meter, and CSV/SVG export
// actions. Takes no route param — by the time this mounts,
// rifle-precision-view.js's own "View analysis" button has already called
// setActiveProjectId(), so getActiveProjectId() (see rifle-precision-nav.js)
// is read directly, same as rifle-precision-marking-view.js's own
// defensive-redirect posture for a stale/direct-nav visit with nothing
// staged.
import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import { findRiflePrecisionProjectById } from '../rifle-precision-library.js';
import { getActiveProjectId } from '../rifle-precision-nav.js';
import { computeCombinedStats, mmToAngularUnit, oneMoaWidthMm, oneMradWidthMm } from '../engine/rifle-precision-stats.js';
import { UNIT_GROUPS, SMALL_LENGTH_PRECISION_DECIMALS, unitChoice, engineToDisplay } from '../units.js';
import { getUnit } from '../prefs.js';
import { analysisDiagram, buildStandaloneDiagramSvg, buildExportSvgWithLegend } from '../ui/rifle-precision/analysis-diagram.js';
import { confidenceOMeter } from '../ui/rifle-precision/confidence-o-meter.js';
import { hitProbabilitySlider } from '../ui/rifle-precision/hit-probability-slider.js';
import { diagramLegend, computeLegendRows } from '../ui/rifle-precision/diagram-legend.js';
import { numbersTable } from '../ui/rifle-precision/numbers-table.js';
import { loadRiflePrecisionAnalysisState, saveRiflePrecisionAnalysisState } from '../rifle-precision-analysis-state.js';
import { buildCsv, formatCsvNumber } from '../csv-export.js';
import { getFieldSeparator, getDecimalSeparator } from '../csv-prefs.js';
import { downloadFile } from '../download.js';
import { downloadButton } from '../ui/download-button.js';

// Same formatDistance()/formatLengthMm() display-unit conversion pattern
// as rifle-precision-view.js's own pair (not imported — that module
// doesn't export them, and they're small enough pure functions that a
// second copy here matches this app's existing per-view convention rather
// than introducing a new shared module for two four-line functions). See
// that module's own comment for why `targetRange`/`bulletLength` are
// reused purely for their unit-math. These two stay tied to the user's
// global preferences regardless of the page-local "Results display units"
// selector below — that selector only governs the legend/Numbers-table
// values, not the page identity or the scale bar.
function formatDistance(distanceM) {
  const displayUnit = getUnit('distance');
  const choice = unitChoice('targetRange', displayUnit) || UNIT_GROUPS.distance.choices.find((c) => c.unit === UNIT_GROUPS.distance.defaultUnit);
  return `${engineToDisplay('targetRange', distanceM, choice.unit).toFixed(choice.decimals)} ${choice.label}`;
}
function formatLengthMm(valueMm) {
  const displayUnit = getUnit('smallLength');
  const choice = unitChoice('bulletLength', displayUnit) || UNIT_GROUPS.smallLength.choices.find((c) => c.unit === UNIT_GROUPS.smallLength.defaultUnit);
  const decimals = SMALL_LENGTH_PRECISION_DECIMALS[choice.unit] ?? choice.decimals;
  return `${engineToDisplay('bulletLength', valueMm, choice.unit).toFixed(decimals)} ${choice.label}`;
}

// The diagram's optional reference grid — each option's real-world
// spacing (mm) depends on the project's own distanceM (mrad/MOA are
// angular units), so spacingMm() is computed at selection time, not
// baked into a fixed table here.
const GRID_OPTIONS = [
  { value: 'none', labelKey: 'riflePrecision.gridOffLabel', spacingMm: () => 0 },
  { value: 'mrad-0.1', labelKey: 'riflePrecision.gridOption01MradLabel', spacingMm: (rangeM) => oneMradWidthMm(rangeM) * 0.1 },
  { value: 'mrad-0.05', labelKey: 'riflePrecision.gridOption005MradLabel', spacingMm: (rangeM) => oneMradWidthMm(rangeM) * 0.05 },
  { value: 'moa-0.25', labelKey: 'riflePrecision.gridOptionQuarterMoaLabel', spacingMm: (rangeM) => oneMoaWidthMm(rangeM) * 0.25 },
  { value: 'moa-0.125', labelKey: 'riflePrecision.gridOptionEighthMoaLabel', spacingMm: (rangeM) => oneMoaWidthMm(rangeM) * 0.125 }
];

// Lowercase-and-underscore project name for a download filename, falling
// back to a generic name for an empty/all-punctuation title.
function sanitizeFilename(name, ext) {
  const cleaned = (name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${cleaned || 'rifle-precision'}.${ext}`;
}

export function mount(container) {
  clear(container);

  const project = findRiflePrecisionProjectById(getActiveProjectId());
  if (!project) {
    location.hash = '#/rifle-precision';
    return () => {};
  }

  const backButton = el('button', { class: 'secondary', i18n: 'riflePrecision.backButton' });
  backButton.addEventListener('click', () => { location.hash = '#/rifle-precision'; });
  const heading = el('div', { class: 'card-header-row' }, [
    el('h1', { text: t('riflePrecision.precisionReportHeading', { name: project.name }) }),
    backButton
  ]);

  const stats = computeCombinedStats(project);

  if (stats.status !== 'ok') {
    container.appendChild(el('div', {}, [
      heading,
      el('div', { class: 'card' }, [el('p', { class: 'hint', i18n: 'riflePrecision.noShotsToAnalyzeHint' })])
    ]));
    return () => {};
  }

  function shotCountText() {
    return t('riflePrecision.shotCount', { count: stats.shotCount });
  }
  const subheading = el('p', {
    class: 'hint',
    text: `${formatDistance(project.distanceM)}, ${formatLengthMm(project.caliberMm)}, ${shotCountText()}`
  });

  // Restored once at mount — every report input setting below is
  // view-local (not part of the project itself), so without its own
  // persistence it would silently reset to its hardcoded default on every
  // navigation away and back, or after an app restart. See
  // rifle-precision-analysis-state.js.
  const saved = loadRiflePrecisionAnalysisState() || {};

  // ---- results display units ----
  let resultsUnitMode = saved.resultsUnitMode ?? 'absolute';
  const absoluteChoice = unitChoice('bulletLength', getUnit('smallLength'))
    || UNIT_GROUPS.smallLength.choices.find((c) => c.unit === UNIT_GROUPS.smallLength.defaultUnit);

  function formatResultValue(valueMm) {
    if (resultsUnitMode === 'mrad') return `${mmToAngularUnit(valueMm, 'mrad', project.distanceM).toFixed(3)} mrad`;
    if (resultsUnitMode === 'moa') return `${mmToAngularUnit(valueMm, 'arcmin', project.distanceM).toFixed(2)} MOA`;
    return formatLengthMm(valueMm);
  }

  function confidenceIntervalText() {
    const lowerPct = (stats.confidenceLower - 1) * 100;
    const upperPct = (stats.confidenceUpper - 1) * 100;
    return `-${Math.abs(lowerPct).toFixed(0)}%/+${upperPct.toFixed(0)}%`;
  }


  const resultsUnitSelect = el('select', { id: 'riflePrecisionResultsUnit' }, [
    el('option', { value: 'absolute', text: absoluteChoice.label }),
    el('option', { value: 'mrad', text: 'mrad' }),
    el('option', { value: 'moa', text: 'MOA' })
  ]);
  resultsUnitSelect.value = resultsUnitMode;
  const resultsUnitField = el('div', { class: 'field rp-grid-field' }, [
    el('label', { for: 'riflePrecisionResultsUnit', i18n: 'riflePrecision.resultsUnitsLabel' }),
    resultsUnitSelect
  ]);

  // ---- overlay toggle state + diagram/legend/numbers-table wiring ----
  let showSigma = saved.showSigma ?? false;
  let showR50 = saved.showR50 ?? false;
  let showR95 = saved.showR95 ?? true;
  let showR95Ci = saved.showR95Ci ?? true;
  let showR99 = saved.showR99 ?? false;
  let showPoiCi = saved.showPoiCi ?? false;
  let showEs5x = saved.showEs5x ?? false;
  let showEs10x = saved.showEs10x ?? false;
  let impactsToScale = saved.impactsToScale ?? true;
  let showOneMoa = saved.showOneMoa ?? true;
  let showScale = saved.showScale ?? false;
  let includeLegendInExport = saved.includeLegendInExport ?? true;
  let hitProbabilityPercent = saved.hitProbabilityPercent ?? 0;
  let hitProbabilityRadiusMm = 0;
  let gridValue = saved.gridValue ?? 'none';
  let gridSpacingMm = (GRID_OPTIONS.find((o) => o.value === gridValue) || GRID_OPTIONS[0]).spacingMm(project.distanceM);

  const diagram = analysisDiagram();
  const legend = diagramLegend();
  const numbers = numbersTable();

  function persistAnalysisState() {
    saveRiflePrecisionAnalysisState({
      resultsUnitMode, showSigma, showR50, showR95, showR95Ci, showR99, showPoiCi, showEs5x, showEs10x,
      impactsToScale, showOneMoa, showScale, includeLegendInExport, gridValue, hitProbabilityPercent
    });
  }

  function currentOptions() {
    return {
      showSigma, showR50, showR99, showR95, showR95Ci, showPoiCi, showEs5x, showEs10x,
      hitProbabilityRadiusMm, hitProbabilityPercent, oneMoaRadiusMm: showOneMoa ? oneMoaWidthMm(project.distanceM) / 2 : 0,
      impactsToScale, caliberMm: project.caliberMm, gridSpacingMm, showScale,
      d5xMm: stats.d5x, d10xMm: stats.d10x
    };
  }

  function refreshOneMoaCaption() {
    oneMoaCaption.textContent = showOneMoa
      ? t('riflePrecision.oneMoaLabel', { value: formatResultValue(oneMoaWidthMm(project.distanceM)) })
      : '';
  }

  function redrawDiagram() {
    const options = currentOptions();
    diagram.update(stats, options);
    legend.update(stats, options, formatResultValue);
    refreshOneMoaCaption();
    persistAnalysisState();
  }

  function buildNumbersRows() {
    const r95CiLowerDelta = formatResultValue(stats.r95 - stats.r95LowerBound);
    const r95CiUpperDelta = formatResultValue(stats.r95UpperBound - stats.r95);
    return [
      { descriptionKey: 'riflePrecision.shotCountLabel', value: String(stats.shotCount) },
      { descriptionKey: 'riflePrecision.confidenceIntervalLabel', value: confidenceIntervalText() },
      {
        descriptionKey: 'riflePrecision.averagePoiLabel',
        value: `H ${formatResultValue(stats.poiMm.x)}, V ${formatResultValue(stats.poiMm.y)}`
      },
      {
        descriptionKey: 'riflePrecision.legendPoiCi',
        value: `H ±${formatResultValue(stats.poiCiMm.x)}, V ±${formatResultValue(stats.poiCiMm.y)}`,
        show: { checked: showPoiCi, onChange: (v) => { showPoiCi = v; redrawDiagram(); } }
      },
      {
        descriptionKey: 'riflePrecision.stdDeviationDescription', designation: t('riflePrecision.sigmaLabel'),
        value: formatResultValue(stats.sigma),
        show: { checked: showSigma, onChange: (v) => { showSigma = v; redrawDiagram(); } }
      },
      {
        descriptionKey: 'riflePrecision.r50Description', designation: t('riflePrecision.r50Label'),
        value: formatResultValue(stats.r50),
        show: { checked: showR50, onChange: (v) => { showR50 = v; redrawDiagram(); } }
      },
      {
        descriptionKey: 'riflePrecision.r95Description', designation: t('riflePrecision.r95Label'),
        value: formatResultValue(stats.r95),
        show: { checked: showR95, onChange: (v) => { showR95 = v; redrawDiagram(); } }
      },
      {
        descriptionKey: 'riflePrecision.r95ConfidenceMarginLabel',
        value: `-${r95CiLowerDelta}/+${r95CiUpperDelta}`,
        show: { checked: showR95Ci, onChange: (v) => { showR95Ci = v; redrawDiagram(); } }
      },
      {
        descriptionKey: 'riflePrecision.r99Description', designation: t('riflePrecision.r99Label'),
        value: formatResultValue(stats.r99),
        show: { checked: showR99, onChange: (v) => { showR99 = v; redrawDiagram(); } }
      },
      {
        descriptionKey: 'riflePrecision.es5xDescription', designation: t('riflePrecision.es5xShortLabel'),
        value: formatResultValue(stats.d5x),
        show: { checked: showEs5x, onChange: (v) => { showEs5x = v; redrawDiagram(); } }
      },
      {
        descriptionKey: 'riflePrecision.es10xDescription', designation: t('riflePrecision.es10xShortLabel'),
        value: formatResultValue(stats.d10x),
        show: { checked: showEs10x, onChange: (v) => { showEs10x = v; redrawDiagram(); } }
      }
    ];
  }

  resultsUnitSelect.addEventListener('change', () => {
    resultsUnitMode = resultsUnitSelect.value;
    numbers.update(buildNumbersRows());
    redrawDiagram();
  });

  // Declared before the slider below — its own construction synchronously
  // fires onChange() once (see hitProbabilitySlider()'s own refresh()-at-
  // construction-time), which reaches redrawDiagram() -> refreshOneMoaCaption()
  // before the code that would otherwise declare this via a later `const`.
  const oneMoaCaption = el('p', { class: 'hint' });

  const slider = hitProbabilitySlider({
    sigma: stats.sigma,
    distanceM: project.distanceM,
    formatLengthMm,
    initialPercent: hitProbabilityPercent,
    onChange: (percent, radiusMm) => {
      hitProbabilityRadiusMm = radiusMm;
      hitProbabilityPercent = percent;
      redrawDiagram();
    }
  });

  function overlayToggle(labelKey, initialChecked, onToggle) {
    const checkbox = el('input', { type: 'checkbox' });
    checkbox.checked = initialChecked;
    checkbox.addEventListener('change', () => {
      onToggle(checkbox.checked);
      redrawDiagram();
    });
    return el('label', { class: 'checkbox-field' }, [checkbox, el('span', { i18n: labelKey })]);
  }

  const gridSelect = el('select', { id: 'riflePrecisionGridSelect' },
    GRID_OPTIONS.map((opt) => el('option', { value: opt.value, i18n: opt.labelKey })));
  gridSelect.value = gridValue;
  gridSelect.addEventListener('change', () => {
    const opt = GRID_OPTIONS.find((o) => o.value === gridSelect.value) || GRID_OPTIONS[0];
    gridValue = opt.value;
    gridSpacingMm = opt.spacingMm(project.distanceM);
    redrawDiagram();
  });
  const gridField = el('div', { class: 'field rp-grid-field' }, [
    el('label', { i18n: 'riflePrecision.gridLabel' }),
    gridSelect
  ]);

  const includeLegendCheckbox = el('input', { type: 'checkbox' });
  includeLegendCheckbox.checked = includeLegendInExport;
  includeLegendCheckbox.addEventListener('change', () => {
    includeLegendInExport = includeLegendCheckbox.checked;
    persistAnalysisState();
  });
  const includeLegendField = el('label', { class: 'checkbox-field' }, [
    includeLegendCheckbox, el('span', { i18n: 'riflePrecision.includeLegendCheckboxLabel' })
  ]);

  // "Impacts to scale"'s own hint sits directly under its checkbox, not
  // shared at the bottom of the whole Image options section, so it stays
  // visually scoped to just this one control.
  const impactsToScaleHint = el('p', { class: 'hint rp-impacts-to-scale-hint', i18n: 'riflePrecision.impactsToScaleHint' });
  const impactsToScaleField = el('div', {}, [
    overlayToggle('riflePrecision.impactsToScaleLabel', impactsToScale, (v) => { impactsToScale = v; }),
    impactsToScaleHint
  ]);

  const oneMoaField = overlayToggle('riflePrecision.legendOneMoa', showOneMoa, (v) => { showOneMoa = v; });

  const scaleField = overlayToggle('riflePrecision.scaleLabel', showScale, (v) => { showScale = v; });

  redrawDiagram();
  numbers.update(buildNumbersRows());

  // ---- confidence-o-meter ----
  const confMeter = confidenceOMeter();
  confMeter.update(stats.confidenceLower, stats.confidenceUpper);

  // ---- exports ----
  function exportCsv() {
    const fieldSeparator = getFieldSeparator();
    const decimalSeparator = getDecimalSeparator();
    const groupIndexByTarget = new Map();
    for (const target of project.targets) {
      const byGroup = new Map();
      target.groups.forEach((g, i) => byGroup.set(g.id, i + 1));
      groupIndexByTarget.set(target.id, byGroup);
    }
    const header = ['ShotX', 'ShotY', 'Target', 'Group', 'Distance', 'Description'];
    const rows = stats.pooledShots.map((shot) => {
      const groupIndex = groupIndexByTarget.get(shot.targetId)?.get(shot.groupId) ?? shot.groupId;
      return [
        formatCsvNumber(shot.xMm, 2, decimalSeparator),
        formatCsvNumber(shot.yMm, 2, decimalSeparator),
        shot.targetName || '',
        String(groupIndex),
        formatCsvNumber(project.distanceM, 0, decimalSeparator),
        project.name
      ];
    });
    downloadFile(sanitizeFilename(project.name, 'csv'), buildCsv([header, ...rows], fieldSeparator), 'text/csv;charset=utf-8');
  }

  function exportSvg() {
    const options = currentOptions();
    // A fresh, standalone copy (not the live diagram.node) so the export
    // can carry its own white background — see buildStandaloneDiagramSvg()'s
    // own comment — without touching the on-page diagram, which keeps its
    // current CSS-driven background exactly as-is.
    let svgNode = buildStandaloneDiagramSvg(stats, options);
    if (includeLegendInExport) {
      const legendRows = computeLegendRows(stats, options, formatResultValue);
      // Wrapped to the confidence gauge's own width (not the full panel)
      // by buildExportSvgWithLegend() — the gauge itself now carries the
      // confidence-interval/rating information visually, so no text lines
      // for those are built here any more.
      const headerLines = [
        { text: `${project.name} — ${formatDistance(project.distanceM)}, ${formatLengthMm(project.caliberMm)}`, weight: 'bold', size: 24 },
        { text: shotCountText(), weight: 'normal', size: 15 }
      ];
      svgNode = buildExportSvgWithLegend(stats, options, legendRows, headerLines, stats.confidenceLower, stats.confidenceUpper);
    }
    const svgText = new XMLSerializer().serializeToString(svgNode);
    downloadFile(sanitizeFilename(project.name, 'svg'), svgText, 'image/svg+xml');
  }

  const exportCsvButton = el('button', { class: 'secondary', i18n: 'riflePrecision.exportCsvButton' });
  exportCsvButton.addEventListener('click', exportCsv);
  // SVG export sits next to the diagram itself, in a .card-header-row
  // alongside its own heading — same placement trajectory-view.js's own
  // chart-SVG export and hit-probability-view.js's own illustration-SVG
  // export both use, rather than grouped down with CSV export below.
  const exportSvgButton = downloadButton({ label: t('riflePrecision.exportSvgButton'), onClick: exportSvg });

  const aggregateLegendRow = el('div', { class: 'rp-aggregate-legend-row' }, [
    el('div', { class: 'card rp-diagram-card' }, [
      el('div', { class: 'card-header-row' }, [
        el('h2', { i18n: 'riflePrecision.aggregateResultsHeading' }),
        exportSvgButton
      ]),
      el('div', { class: 'rp-diagram-wrap' }, [diagram.node])
    ]),
    el('div', { class: 'card' }, [
      el('h2', { i18n: 'riflePrecision.legendHeading' }),
      legend.node
    ])
  ]);

  const imageOptionsCard = el('div', { class: 'card' }, [
    el('h2', { i18n: 'riflePrecision.imageOptionsHeading' }),
    includeLegendField,
    gridField,
    impactsToScaleField,
    oneMoaField,
    oneMoaCaption,
    slider.node,
    scaleField
  ]);

  const numbersCard = el('div', { class: 'card' }, [
    el('h2', { i18n: 'riflePrecision.numbersHeading' }),
    numbers.node
  ]);

  container.appendChild(el('div', {}, [
    heading,
    subheading,
    resultsUnitField,
    aggregateLegendRow,
    imageOptionsCard,
    numbersCard,
    el('div', { class: 'card' }, [confMeter.node]),
    el('div', { class: 'card' }, [
      el('div', { class: 'arsenal-form-actions' }, [exportCsvButton])
    ])
  ]));

  return () => {};
}
