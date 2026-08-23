import { el, clear } from '../dom.js';
import { atmosphereSection } from '../ui/sections/atmosphere-section.js';
import { massDualField } from '../ui/arsenal/mass-field.js';
import { caliberField } from '../ui/arsenal/caliber-field.js';
import { parseVelocityTable } from '../ui/velocity-table-parse.js';
import { computeCdMachCurve, scaledReferenceCurve } from '../engine/cd-mach-curve.js';
import { DRAG_TABLES } from '../engine/drag-tables.js';
import {
  loadCdMachCurveAtmosphereState, saveCdMachCurveAtmosphereState,
  loadCdMachCurveInputsState, saveCdMachCurveInputsState
} from '../cd-mach-curve-state.js';
import { setPendingBulletPrefill } from '../arsenal-prefill.js';
import { getUnit } from '../prefs.js';
import { applyI18nText, i18nSpan, t } from '../i18n.js';
import { LineChart, AutoScaleAxis } from '../vendor/chartist/index.js';
import { downloadButton } from '../ui/download-button.js';
import { copyButton } from '../ui/copy-button.js';
import { exportChartSvg } from '../chart-svg-export.js';
import { buildCsv, formatCsvNumber } from '../csv-export.js';
import { downloadFile } from '../download.js';
import { getFieldSeparator, getDecimalSeparator } from '../csv-prefs.js';

// Distance and velocity in a pasted table always come from the same
// source (a chronograph/radar report, or a hand-copied legacy table),
// which is either fully metric or fully archaic — never a mix — so this
// is one paired choice, not two independent unit selects (matching the
// legacy tool's own modern/archaic radio).
const TABLE_UNIT_SYSTEMS = {
  modern: { distanceUnit: 'm', velocityUnit: 'm/s' },
  archaic: { distanceUnit: 'yd', velocityUnit: 'ft/s' }
};

export function mount(container) {
  clear(container);

  // Restored once at mount — everything the tool shows (not just
  // atmosphere) so navigating away and back doesn't lose what was typed
  // in. null on a first-ever visit; every field below falls back to its
  // own hardcoded default in that case.
  const savedInputs = loadCdMachCurveInputsState() || {};

  // --- Distance/velocity table -------------------------------------
  const tableUnitSystemSelect = el('select', { id: 'cdMachTableUnitSystem' }, [
    el('option', { value: 'modern', i18n: 'cdMachCurve.tableUnitSystemModern' }),
    el('option', { value: 'archaic', i18n: 'cdMachCurve.tableUnitSystemArchaic' })
  ]);
  // Defaults to whichever system matches the user's own global distance
  // preference, least-surprise on first open — freely switchable from
  // there without touching that global preference itself.
  tableUnitSystemSelect.value = savedInputs.tableUnitSystem || (getUnit('distance') === 'm' ? 'modern' : 'archaic');

  const textarea = el('textarea', { id: 'cdMachVelTable', class: 'cd-table-input', rows: 10 });
  textarea.value = savedInputs.velocityTableText || '';

  const tableSection = el('div', {}, [
    el('h2', { i18n: 'cdMachCurve.velocityTableHeading' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'cdMachCurve.tableUnitSystemLabel' }), tableUnitSystemSelect]),
    el('div', { class: 'field' }, [textarea]),
    el('p', { class: 'hint cd-table-instructions', i18n: 'cdMachCurve.tableInstructions' })
  ]);

  // --- Bullet mass/caliber ------------------------------------------
  const mass = massDualField({ value: savedInputs.massKg ?? 0.01, onInput: () => onFieldChange() });
  const caliber = caliberField({ value: savedInputs.caliberM ?? null, required: true, onInput: () => onFieldChange() });

  // --- Atmosphere (own cookie-backed state, default standard sea level)
  const atmosphere = atmosphereSection({
    includeWind: false,
    load: loadCdMachCurveAtmosphereState,
    save: saveCdMachCurveAtmosphereState,
    onInput: invalidateResult
  });

  // --- Output options -------------------------------------------------
  const showCalculatedCheckbox = el('input', { type: 'checkbox', id: 'cdMachShowCalculated' });
  showCalculatedCheckbox.checked = savedInputs.showCalculated ?? false;
  const showCalculatedRow = el('label', { class: 'checkbox-field' }, [
    showCalculatedCheckbox, i18nSpan('cdMachCurve.showCalculatedLabel')
  ]);

  const saveSourceSelect = el('select', { id: 'cdMachSaveSource' }, [
    el('option', { value: 'interpolated', i18n: 'cdMachCurve.saveSourceInterpolated' }),
    el('option', { value: 'calculated', i18n: 'cdMachCurve.saveSourceCalculated' })
  ]);
  saveSourceSelect.value = savedInputs.saveSource || 'interpolated';

  const status = el('div', { class: 'status', i18n: 'common.idle' });
  const runButton = el('button', { class: 'section-button', i18n: 'cdMachCurve.computeButton' });

  const controls = el('div', { class: 'card' }, [
    tableSection,
    mass.node,
    caliber.node,
    atmosphere.node,
    showCalculatedRow,
    el('div', { class: 'field' }, [el('label', { i18n: 'cdMachCurve.saveSourceLabel' }), saveSourceSelect]),
    runButton,
    status
  ]);

  // --- Chart ----------------------------------------------------------
  const chartContainer = el('div', { class: 'chart-container' });
  const chartLegend = el('div', { class: 'chart-legend' });
  let chart = null;

  // --- Result tables ----------------------------------------------------
  const interpolatedBody = el('tbody', {});
  const interpolatedTable = el('table', {}, [
    el('thead', {}, [el('tr', {}, [el('th', { i18n: 'cdMachCurve.machColumn' }), el('th', { i18n: 'cdMachCurve.cdColumn' })])]),
    interpolatedBody
  ]);

  const calculatedBody = el('tbody', {});
  const calculatedTable = el('table', {}, [
    el('thead', {}, [el('tr', {}, [el('th', { i18n: 'cdMachCurve.machColumn' }), el('th', { i18n: 'cdMachCurve.cdColumn' })])]),
    calculatedBody
  ]);

  // Copy/download CSV — same pattern (and the same shared csv-export.js/
  // csv-prefs.js formatting) as the Trajectory table's own buttons, one
  // pair per output table since Interpolated and Calculated are two
  // independent tables here rather than one with toggleable columns.
  // `lastInterpolatedRows`/`lastCalculatedRows` (declared further down)
  // are only ever updated on a successful run() — like Trajectory's own
  // `lastPoints`, they're left stale (not cleared) on invalidateResult(),
  // matching the tables' own "stale but not blanked" display policy.
  function buildCdMachCsvText(rows) {
    const fieldSeparator = getFieldSeparator();
    const decimalSeparator = getDecimalSeparator();
    const header = [t('cdMachCurve.machColumn'), t('cdMachCurve.cdColumn')];
    const csvRows = rows.map((p) => [
      formatCsvNumber(p.mach, 3, decimalSeparator),
      formatCsvNumber(p.cd, 4, decimalSeparator)
    ]);
    return buildCsv([header, ...csvRows], fieldSeparator);
  }

  function csvActions(getRows, filename) {
    return el('div', { class: 'card-header-actions' }, [
      copyButton({
        label: t('cdMachCurve.copyTableCsv'),
        copiedLabel: t('cdMachCurve.copyTableCsvCopied'),
        getText: () => buildCdMachCsvText(getRows())
      }),
      downloadButton({
        label: t('cdMachCurve.downloadTableCsv'),
        onClick: () => downloadFile(filename, buildCdMachCsvText(getRows()), 'text/csv;charset=utf-8')
      })
    ]);
  }

  const interpolatedCard = el('div', { class: 'card' }, [
    el('div', { class: 'card-header-row' }, [
      el('h2', { i18n: 'cdMachCurve.interpolatedHeading' }),
      csvActions(() => lastInterpolatedRows, 'cd-mach-curve-interpolated.csv')
    ]),
    interpolatedTable
  ]);

  const calculatedCard = el('div', { class: 'card' }, [
    el('div', { class: 'card-header-row' }, [
      el('h2', { i18n: 'cdMachCurve.calculatedHeading' }),
      csvActions(() => lastCalculatedRows, 'cd-mach-curve-calculated.csv')
    ]),
    calculatedTable
  ]);
  calculatedCard.style.display = showCalculatedCheckbox.checked ? '' : 'none';

  const skippedHint = el('p', { class: 'hint warning' });
  skippedHint.style.display = 'none';

  const saveButton = el('button', { class: 'section-button', i18n: 'cdMachCurve.saveToArsenalButton' });
  saveButton.disabled = true;

  const results = el('div', { class: 'tool-results' }, [
    el('div', {}, [
      el('div', { class: 'card-header-row' }, [
        el('h2', { i18n: 'cdMachCurve.chartHeading' }),
        downloadButton({
          label: t('cdMachCurve.downloadChartSvg'),
          onClick: () => exportChartSvg(chartContainer, 'cd-mach-curve-chart.svg')
        })
      ]),
      chartLegend,
      chartContainer
    ]),
    interpolatedCard,
    calculatedCard,
    skippedHint,
    saveButton
  ]);

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'cdMachCurve.title' }),
    el('p', { i18n: 'cdMachCurve.intro' }),
    el('p', { class: 'hint', i18n: 'cdMachCurve.tableRecommendationHint' }),
    el('div', { class: 'tool-layout' }, [controls, results])
  ]));

  showCalculatedCheckbox.addEventListener('change', () => {
    calculatedCard.style.display = showCalculatedCheckbox.checked ? '' : 'none';
    persistInputs();
  });
  saveSourceSelect.addEventListener('change', () => {
    refreshSaveButtonState();
    persistInputs();
  });

  // --- State ------------------------------------------------------------
  let lastResult = null; // { calculated, interpolated, massKg, caliberM } snapshot, cleared by any input change
  let lastInterpolatedRows = []; // never cleared on invalidate — see csvActions() above
  let lastCalculatedRows = [];

  function persistInputs() {
    saveCdMachCurveInputsState({
      velocityTableText: textarea.value,
      massKg: mass.getMassKg(),
      caliberM: caliber.getCaliberM(),
      tableUnitSystem: tableUnitSystemSelect.value,
      showCalculated: showCalculatedCheckbox.checked,
      saveSource: saveSourceSelect.value
    });
  }

  function invalidateResult() {
    lastResult = null;
    refreshSaveButtonState();
    applyI18nText(status, 'common.idle');
    status.className = 'status';
  }

  // Every field that affects the computed result goes through this on
  // change — invalidates the (now stale) result and persists the new
  // input state in the same step, so the two never drift out of sync.
  function onFieldChange() {
    invalidateResult();
    persistInputs();
  }

  function refreshSaveButtonState() {
    const source = saveSourceSelect.value;
    saveButton.disabled = !lastResult || lastResult[source].length === 0;
  }

  function showError(message) {
    clear(status);
    status.appendChild(document.createTextNode(message));
    status.className = 'status error';
  }

  function renderTable(tbody, rows) {
    clear(tbody);
    for (const p of rows) {
      tbody.appendChild(el('tr', {}, [
        el('td', { text: p.mach.toFixed(3) }),
        el('td', { text: p.cd.toFixed(4) })
      ]));
    }
  }

  function renderSkipped(skipped) {
    if (skipped.length === 0) {
      skippedHint.style.display = 'none';
      return;
    }
    skippedHint.style.display = '';
    const lines = skipped.map((s) => `#${s.index + 1}: ${t('cdMachCurve.skipReason' + s.reason[0].toUpperCase() + s.reason.slice(1))}`);
    clear(skippedHint);
    skippedHint.appendChild(document.createTextNode(t('cdMachCurve.skippedSegmentsWarning', { count: skipped.length }) + ' ' + lines.join('; ')));
  }

  function legendItem(letter, key) {
    return el('span', { class: `chart-legend-item chart-legend-${letter}` }, [
      el('span', { class: 'chart-legend-swatch' }),
      document.createTextNode(t(key))
    ]);
  }

  function renderChart({ calculated, interpolated }) {
    const series = [
      { name: 'calculated', data: calculated.map((p) => ({ x: p.mach, y: p.cd })) },
      { name: 'interpolated', data: interpolated.map((p) => ({ x: p.mach, y: p.cd })) }
    ];
    const legendItems = [legendItem('a', 'cdMachCurve.legendCalculated'), legendItem('b', 'cdMachCurve.legendInterpolated')];

    const g1 = scaledReferenceCurve(DRAG_TABLES.G1, calculated);
    if (g1) {
      series.push({ name: 'g1', data: g1.points.map((p) => ({ x: p.mach, y: p.cd })) });
      legendItems.push(legendItem('c', 'cdMachCurve.legendG1Scaled'));
    }
    const g7 = scaledReferenceCurve(DRAG_TABLES.G7, calculated);
    if (g7) {
      series.push({ name: 'g7', data: g7.points.map((p) => ({ x: p.mach, y: p.cd })) });
      legendItems.push(legendItem('d', 'cdMachCurve.legendG7Scaled'));
    }

    clear(chartLegend);
    for (const item of legendItems) chartLegend.appendChild(item);

    const options = {
      fullWidth: true,
      chartPadding: { right: 24 },
      axisX: { type: AutoScaleAxis, onlyInteger: false },
      axisY: { onlyInteger: false },
      lineSmooth: false,
      showPoint: false,
      showLine: true,
      series: {
        calculated: { showPoint: true, showLine: false },
        interpolated: { showLine: true, lineSmooth: true },
        g1: { showLine: true },
        g7: { showLine: true }
      }
    };
    if (chart) chart.update({ series }, options);
    else chart = new LineChart(chartContainer, { series }, options);
  }

  function run() {
    const parsed = parseVelocityTable(textarea.value, TABLE_UNIT_SYSTEMS[tableUnitSystemSelect.value]);
    if (parsed.error) {
      showError(t(parsed.error.key, parsed.error.params));
      lastResult = null;
      refreshSaveButtonState();
      return;
    }
    const massKg = mass.getMassKg();
    const caliberM = caliber.getCaliberM();
    if (!(massKg > 0) || caliberM == null) {
      showError(t('cdMachCurve.errorMassCaliberRequired'));
      lastResult = null;
      refreshSaveButtonState();
      return;
    }
    try {
      const { calculated, interpolated, skipped } = computeCdMachCurve({
        points: parsed.points, massKg, caliberM, ...atmosphere.getValues()
      });
      lastResult = { calculated, interpolated, massKg, caliberM };
      lastInterpolatedRows = interpolated;
      lastCalculatedRows = calculated;
      renderTable(interpolatedBody, interpolated);
      renderTable(calculatedBody, calculated);
      renderSkipped(skipped);
      renderChart({ calculated, interpolated });
      applyI18nText(status, 'cdMachCurve.statusOk');
      status.className = 'status ok';
    } catch (err) {
      showError(t('common.error', { message: err.message }));
      lastResult = null;
    }
    refreshSaveButtonState();
  }

  runButton.addEventListener('click', run);
  textarea.addEventListener('input', onFieldChange);
  tableUnitSystemSelect.addEventListener('change', onFieldChange);

  saveButton.addEventListener('click', () => {
    if (!lastResult) return;
    const source = saveSourceSelect.value;
    setPendingBulletPrefill({
      massKg: lastResult.massKg,
      caliberM: lastResult.caliberM,
      cdTable: lastResult[source].map((p) => [p.mach, p.cd])
    });
    location.hash = '#/guns/arsenal';
  });

  run();
}
