// Trajectory's Printable card tab: what the card will show of the
// Trajectory setup (the card's three info boxes, read-only), the card's
// own inputs, and Download PDF.
//
// The card is solved for the Data tab's rifle, cartridge and atmosphere at
// the rifle's own zero (Trajectory's zero override is not the card's) and
// for a level shot. Every input here is remembered (printable-card-
// state.js). The targets and the photo come from the Range Solver's active
// location; the reticle from the rifle's scope, drawn by a scope view of
// the card's own (its zoom and overlays remembered apart from the Range
// Solver's), with the elevation for the zero dialed and the reference
// crosswind from the right.
//
// `getSetup()` → { base, cartridge, rifle, clicks, atmosphere,
// selectedRifle }: the engine state at the rifle's zero and the sections'
// own values (see trajectory-view.js).
import { el, clear } from '../../dom.js';
import { t, getLanguage, i18nSpan, applyI18nText } from '../../i18n.js';
import { sectionGroup } from '../section.js';
import { unitField } from '../unit-field.js';
import { FIELD_BOUNDS, siToDisplay, displayToSI } from '../../units.js';
import { displayChoice, fromDisplayUnit } from '../../display-units.js';
import { getUnit } from '../../prefs.js';
import { getPool } from '../../pool.js';
import { downloadFile } from '../../download.js';
import { getIndicatorStyle, getOutputUnit } from '../../range-solver-prefs.js';
import { getSpinDriftMode } from '../../spin-drift-prefs.js';
import { isZeroForSpinDriftEnabled } from '../../zero-spin-drift-prefs.js';
import { referenceWindSpeed } from '../../reticle/bdc-overlay.js';
import { zoomLabel } from '../../reticle/sight-picture.js';
import { resolveRifleOptic, rifleOpticKey } from '../../rifle-optic.js';
import { loadUserLocations } from '../../location-library.js';
import { loadRangeSolverLocationState } from '../../range-solver-state.js';
import { goToLocations } from '../../locations-nav.js';
import { resolveGunNames } from '../../gun-names.js';
import { RELEASE_ID } from '../../version.js';
import { scopeView as createScopeView } from '../range-solver/scope-view.js';
import { bdcTrajectories } from '../range-solver/bdc-trajectories.js';
import {
  loadPrintableCardState, savePrintableCardState, savePrintableCardScopeState,
  PAPER_CHOICES, MAX_MODES, MACH_OF_MODE, TITLE_MAX_LENGTH
} from '../../printable-card-state.js';
import { STEP_LEVELS, MAX_ROWS } from '../../printable-card/rows.js';
import {
  computeCardData, spinDriftOffered, angleInOutputUnit, outputUnitToRad, signedDegreesText, temperatureColumns
} from '../../printable-card/card-data.js';
import { cardValues, cardInfoBoxes, outputUnitLabel } from '../../printable-card/card-values.js';
import { buildCardPdf } from '../../printable-card/card-pdf.js';

const APP_LINK = 'bc.geladen.ch';
const PRINT_RETICLE_INK = '#111111';
const PRINT_OVERLAY_INK = '#8c8c8c';
const PREVIEW_DELAY_MS = 250;

// Today as YYYY-MM-DD, local time.
export function todayIso(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function formatCardDate(iso, lang) {
  const [y, m, d] = iso.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(lang || undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(y, m - 1, d));
  } catch {
    return iso;
  }
}

export function defaultCardTitle(names) {
  return `${names.rifleName} · ${names.loadName}`.slice(0, TITLE_MAX_LENGTH);
}

// A file name from what the file is (the card's heading), its title and
// date: a middle dot becomes a dash, characters file systems refuse '_'.
export function cardFileName(kind, title, iso) {
  const stem = [kind, title, iso].filter((part) => part && String(part).trim()).join(' - ').replace(/\s*·\s*/g, ' - ').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim();
  return `${stem || 'card'}.pdf`;
}

// The active location's targets, nearest first, labelled T1, T2…
export function cardTargets(location, defaultName) {
  if (!location) return [];
  return [...location.targets]
    .sort((a, b) => a.rangeM - b.rangeM)
    .map((target, i) => ({
      label: `T${i + 1}`,
      name: target.name || defaultName(location.targets.indexOf(target) + 1),
      rangeM: target.rangeM,
      losAngleRad: target.losAngleRad ?? 0,
      coords: target.coords || null
    }));
}

function loadImageSize(href) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('photo could not be read'));
    img.src = href;
  });
}

export function printableCardPanel({ getSetup }) {
  let state = loadPrintableCardState();
  let disposed = false;
  let names = null;
  const pool = getPool();
  const save = (partial) => { state = savePrintableCardState(partial); };

  // ---- Summary: the card's info boxes ----
  const summary = el('div', { class: 'printable-card-summary' });

  // ---- Card: paper, title, date ----
  const paperSelect = el('select', { id: 'printableCardPaper' }, PAPER_CHOICES.map((p) => el('option', { value: p, i18n: `printableCard.paper.${p}` })));
  paperSelect.value = state.paper;
  paperSelect.addEventListener('change', () => save({ paper: paperSelect.value }));
  const titleInput = el('input', { type: 'text', id: 'printableCardTitle', maxlength: String(TITLE_MAX_LENGTH), autocomplete: 'off' });
  titleInput.value = state.title ?? '';
  titleInput.addEventListener('input', () => save({ title: titleInput.value.trim() ? titleInput.value.slice(0, TITLE_MAX_LENGTH) : null }));
  const dateInput = el('input', { type: 'date', id: 'printableCardDate' });
  dateInput.value = state.date ?? todayIso();
  dateInput.addEventListener('change', () => save({ date: /^\d{4}-\d{2}-\d{2}$/.test(dateInput.value) ? dateInput.value : null }));
  const titleHint = el('p', { class: 'hint' });
  applyI18nText(titleHint, 'printableCard.titleHint', { count: TITLE_MAX_LENGTH });
  const cardSection = sectionGroup('printableCard.cardHeading', [
    el('div', { class: 'field' }, [el('label', { for: 'printableCardPaper', i18n: 'printableCard.paper.label' }), paperSelect]),
    el('div', { class: 'field' }, [el('label', { for: 'printableCardTitle', i18n: 'printableCard.title' }), titleInput]),
    titleHint,
    el('div', { class: 'field' }, [el('label', { for: 'printableCardDate', i18n: 'printableCard.date' }), dateInput])
  ]);

  // ---- Distances ----
  const distanceUnit = getUnit('distance');
  const maxModeSelect = el('select', { id: 'printableCardMaxMode' }, MAX_MODES.map((m) => el('option', { value: m, i18n: `printableCard.maxMode.${m.replace('.', '')}` })));
  maxModeSelect.value = state.maxMode;
  const defaultMaxM = distanceUnit === 'yd' ? fromDisplayUnit('distance', 1000, 'm') : 1000;
  const maxDistanceField = unitField({
    id: 'cardMaxDistance', ...FIELD_BOUNDS.cardMaxDistance, step: fromDisplayUnit('distance', 25, 'm'),
    value: state.maxDistanceM ?? defaultMaxM,
    onInput: () => {
      const v = maxDistanceField.getEngineValue();
      if (Number.isFinite(v)) save({ maxDistanceM: v });
      schedulePreview();
    }
  });
  const machHint = el('p', { class: 'hint' });
  maxModeSelect.addEventListener('change', () => { save({ maxMode: maxModeSelect.value }); renderMaxMode(); schedulePreview(); });
  function renderMaxMode() {
    maxDistanceField.node.style.display = state.maxMode === 'distance' ? '' : 'none';
  }
  const unitLabel = displayChoice('distance').label;
  const stepSelect = el('select', { id: 'printableCardStep' }, STEP_LEVELS.map((s) => el('option', { value: String(s), text: `${s} ${unitLabel}` })));
  stepSelect.value = String(state.initialStep);
  stepSelect.addEventListener('change', () => { save({ initialStep: Number(stepSelect.value) }); schedulePreview(); });
  const refineLabel = el('label', { for: 'printableCardRefine' });
  const refineInput = el('input', { type: 'number', id: 'printableCardRefine', min: '0', step: 'any' });
  refineInput.addEventListener('input', () => {
    const value = parseFloat(refineInput.value);
    const output = outputSettings();
    save({ refineThresholdRad: Number.isFinite(value) && value > 0 && output ? outputUnitToRad(value, 'elevation', output) : 0 });
    schedulePreview();
  });
  const distancesSection = sectionGroup('printableCard.distancesHeading', [
    el('div', { class: 'field' }, [el('label', { for: 'printableCardMaxMode', i18n: 'printableCard.maxMode.label' }), maxModeSelect]),
    maxDistanceField.node,
    machHint,
    el('div', { class: 'field' }, [el('label', { for: 'printableCardStep', i18n: 'printableCard.step' }), stepSelect]),
    el('div', { class: 'field' }, [refineLabel, refineInput]),
    el('p', { class: 'hint', i18n: 'printableCard.refineHint' })
  ]);

  // ---- Wind ----
  const referenceWindMs = () => fromDisplayUnit('windSpeed', referenceWindSpeed(displayChoice('windSpeed').unit));
  const crosswindField = unitField({
    id: 'cardCrosswind', ...FIELD_BOUNDS.cardCrosswind, step: fromDisplayUnit('windSpeed', displayChoice('windSpeed').unit === 'm/s' ? 0.5 : 1),
    value: state.crosswindMs ?? referenceWindMs(),
    onInput: () => {
      const v = crosswindField.getEngineValue();
      if (Number.isFinite(v)) save({ crosswindMs: v });
      refreshSummary();
      updateBdc();
    }
  });
  const crosswindMs = () => {
    const v = crosswindField.getEngineValue();
    return Number.isFinite(v) ? v : referenceWindMs();
  };
  const windSection = sectionGroup('printableCard.windHeading', [crosswindField.node, el('p', { class: 'hint', i18n: 'printableCard.crosswindHint' })]);

  // ---- Include ----
  const checkbox = (id, key, labelKey, onChange) => {
    const input = el('input', { type: 'checkbox', id });
    input.checked = state[key];
    input.addEventListener('change', () => { save({ [key]: input.checked }); onChange(); });
    const label = el('label', { class: 'checkbox-field', for: id }, [input, i18nSpan(labelKey)]);
    return { input, label };
  };
  const spinBox = checkbox('printableCardSpin', 'spinDrift', 'printableCard.spinDrift', () => schedulePreview());
  const slopeBox = checkbox('printableCardSlope', 'slope', 'printableCard.slope', () => schedulePreview());

  // ---- Temperature corrections: five columns from a first temperature up
  // in steps; both follow their defaults until edited ----
  const temperatureBox = checkbox('printableCardTemperature', 'temperature', 'printableCard.temperature', () => { renderTemperature(); schedulePreview(); });
  const temperatureStartField = unitField({
    id: 'cardTemperature', ...FIELD_BOUNDS.cardTemperature, step: displayToSI('cardTemperatureStep', 1, getUnit('temperature')),
    value: temperatureStartC(),
    onInput: () => {
      const v = temperatureStartField.getEngineValue();
      if (Number.isFinite(v)) save({ temperatureStartC: v });
      renderTemperature();
      schedulePreview();
    }
  });
  const temperatureStepField = unitField({
    id: 'cardTemperatureStep', ...FIELD_BOUNDS.cardTemperatureStep, step: displayToSI('cardTemperatureStep', 0.5, getUnit('temperature')),
    value: temperatureStepC(),
    onInput: () => {
      const v = temperatureStepField.getEngineValue();
      if (Number.isFinite(v) && v > 0) save({ temperatureStepC: v });
      renderTemperature();
      schedulePreview();
    }
  });
  const temperatureHint = el('p', { class: 'hint' });
  const temperatureReset = el('button', { type: 'button', class: 'secondary', i18n: 'printableCard.temperatureReset' });
  temperatureReset.addEventListener('click', () => {
    save({ temperatureStartC: null, temperatureStepC: null });
    renderTemperature(true);
    schedulePreview();
  });
  const temperatureBlock = el('div', { class: 'printable-card-temperature' }, [
    el('p', { class: 'hint', i18n: 'printableCard.temperatureHint' }),
    temperatureStartField.node, temperatureStepField.node, temperatureHint, temperatureReset
  ]);
  const targetsBox = checkbox('printableCardTargets', 'targets', 'printableCard.targets', () => schedulePreview());
  const photoBox = checkbox('printableCardPhoto', 'photo', 'printableCard.photo', () => renderLocation());
  const locationName = el('p', { class: 'hint' });
  const photoHint = el('p', { class: 'hint warning', i18n: 'printableCard.noPhoto' });
  const locationLink = el('button', { type: 'button', class: 'secondary', i18n: 'printableCard.openLocations' });
  locationLink.addEventListener('click', goToLocations);
  const noLocation = el('div', {}, [el('p', { class: 'hint', i18n: 'printableCard.noLocation' }), locationLink]);
  const locationBlock = el('div', {}, [locationName, targetsBox.label, photoBox.label, photoHint]);

  const reticleBox = checkbox('printableCardReticle', 'reticle', 'printableCard.reticle', () => applyScopeView());
  const reticleHint = el('p', { class: 'hint', i18n: 'printableCard.noReticle' });
  const scopeSettings = {
    bdcOn: () => state.scope.bdcOn,
    setBdcOn: (v) => { state = savePrintableCardScopeState({ bdcOn: v }); },
    holdoverOn: () => false,
    setHoldoverOn: () => {},
    windOn: () => state.scope.windOn,
    setWindOn: (v) => { state = savePrintableCardScopeState({ windOn: v }); },
    aimMode: () => 'hold',
    setAimMode: () => {},
    zoomFor: (id) => state.scope.zoomByScope[id],
    setZoomFor: (id, z) => { state = savePrintableCardScopeState({ zoomByScope: { ...state.scope.zoomByScope, [id]: z } }); },
    reticleZoomFor: (id) => state.scope.reticleZoomByScope[id],
    setReticleZoomFor: (id, v) => { state = savePrintableCardScopeState({ reticleZoomByScope: { ...state.scope.reticleZoomByScope, [id]: v } }); }
  };
  const scope = createScopeView({ onBdcChange: () => updateBdc(), settings: scopeSettings, aimMode: 'hold', holdover: false });
  const bdc = bdcTrajectories((tables) => { if (!disposed) scope.setBdcTables(tables); });
  const scopeBox = el('div', { class: 'printable-card-scope' }, [scope.node]);

  const temperatureSection = sectionGroup('printableCard.temperatureHeading', [temperatureBox.label, temperatureBlock]);

  const includeSection = sectionGroup('printableCard.includeHeading', [
    spinBox.label, slopeBox.label,
    el('h4', { i18n: 'printableCard.locationHeading' }), locationBlock, noLocation,
    el('h4', { i18n: 'printableCard.reticleHeading' }), reticleBox.label, reticleHint, scopeBox
  ]);

  // ---- Status and download ----
  const rowsStatus = el('p', { class: 'hint' });
  const rowsWarning = el('p', { class: 'hint warning' });
  const downloadButton = el('button', { type: 'button', class: 'primary', i18n: 'printableCard.download' });
  const downloadStatus = el('p', { class: 'status' });
  downloadButton.addEventListener('click', () => { download(); });

  const node = el('div', { class: 'printable-card' }, [
    el('div', { class: 'card' }, [el('h2', { i18n: 'printableCard.summaryHeading' }), summary]),
    el('div', { class: 'card' }, [
      el('h2', { i18n: 'printableCard.inputsHeading' }),
      el('div', { class: 'printable-card-settings' }, [cardSection, distancesSection, windSection, temperatureSection, includeSection]),
      rowsStatus, rowsWarning, downloadButton, downloadStatus
    ])
  ]);

  // The reference temperature: the setup's air (the card's reference
  // conditions).
  function referenceTempC() {
    const setup = getSetup();
    return setup && Number.isFinite(setup.base.tempC) ? setup.base.tempC : 15;
  }
  function temperatureStepC() {
    if (state.temperatureStepC !== null) return state.temperatureStepC;
    return getUnit('temperature') === 'tempF' ? displayToSI('cardTemperatureStep', 10, 'tempF') : 5;
  }
  function temperatureStartC() {
    return state.temperatureStartC ?? referenceTempC() - 2 * temperatureStepC();
  }
  function currentTemperatureColumns() {
    return temperatureColumns({ startC: temperatureStartC(), stepC: temperatureStepC() });
  }
  // A temperature as the card writes it: the user's unit, at most one
  // decimal, a true minus sign.
  function temperatureNumber(tempC) {
    const v = Number(siToDisplay('tempC', tempC, getUnit('temperature')).toFixed(1));
    return (Object.is(v, -0) ? 0 : v).toString().replace('-', '−');
  }
  function renderTemperature(force = false) {
    temperatureBlock.style.display = state.temperature ? '' : 'none';
    const keep = (field) => !force && field.node.contains(document.activeElement);
    if (!keep(temperatureStartField)) temperatureStartField.setEngineValue(temperatureStartC());
    if (!keep(temperatureStepField)) temperatureStepField.setEngineValue(temperatureStepC());
    temperatureReset.style.display = state.temperatureStartC !== null || state.temperatureStepC !== null ? '' : 'none';
    const list = currentTemperatureColumns().map(temperatureNumber).join(', ');
    temperatureHint.textContent = t('printableCard.temperatureScale', { list, unit: displayChoice('temperature').label });
  }

  function spinOffered() {
    const setup = getSetup();
    return !!setup && spinDriftOffered(setup.base, getSpinDriftMode());
  }

  // ---- Output unit (the Range Solver's) ----
  function outputSettings() {
    const setup = getSetup();
    if (!setup) return null;
    return {
      unit: getOutputUnit(), style: getIndicatorStyle(),
      clickVerticalRad: setup.clicks.verticalRad, clickHorizontalRad: setup.clicks.horizontalRad,
      clicksLabel: t('printableCard.pdf.clicks')
    };
  }
  function renderRefine() {
    const output = outputSettings();
    clear(refineLabel);
    refineLabel.appendChild(document.createTextNode(`${t('printableCard.refine')} (${outputUnitLabel(getOutputUnit(), t)})`));
    if (!output) return;
    const value = state.refineThresholdRad > 0 ? angleInOutputUnit(state.refineThresholdRad, 'elevation', output) : 0;
    refineInput.step = output.unit === 'clicks' ? '1' : '0.1';
    if (document.activeElement !== refineInput) refineInput.value = String(Number(value.toFixed(output.unit === 'clicks' ? 0 : 1)));
  }

  // ---- Location ----
  function activeLocation() {
    const pointer = loadRangeSolverLocationState();
    const id = pointer && pointer.locationId;
    return id ? loadUserLocations().find((l) => l.id === id) || null : null;
  }
  function renderLocation() {
    const location = activeLocation();
    noLocation.style.display = location ? 'none' : '';
    locationBlock.style.display = location ? '' : 'none';
    if (location) locationName.textContent = t('printableCard.locationName', { name: location.name });
    photoHint.style.display = location && state.photo && !location.photo ? '' : 'none';
    return location;
  }

  // ---- Reticle ----
  let optic = null;
  let opticKey = null;
  let opticRequest = 0;
  function refreshOptic() {
    const setup = getSetup();
    const selected = setup ? setup.selectedRifle : null;
    const key = rifleOpticKey(selected);
    if (key === opticKey) { applyScopeView(); return; }
    opticKey = key;
    const request = ++opticRequest;
    optic = null;
    applyScopeView();
    if (!key) return;
    resolveRifleOptic(selected).then((resolved) => {
      if (disposed || request !== opticRequest) return;
      optic = resolved;
      applyScopeView();
    });
  }
  function bdcState() {
    const setup = getSetup();
    if (!setup) return null;
    return { ...setup.base, losAngleRad: 0, windSpeed: 0, windAngleRad: Math.PI / 2, spinDriftMode: getSpinDriftMode(), zeroForSpinDrift: isZeroForSpinDriftEnabled() };
  }
  function updateBdc() {
    if (!optic || !state.reticle) return;
    scope.setShot({ elevationRad: 0, windageRad: 0, crosswindMs: crosswindMs(), rangeM: FIELD_BOUNDS.cardMaxDistance.min });
    const s = bdcState();
    if (s && scope.wantsBdcTables()) bdc.update(s, crosswindMs());
  }
  function applyScopeView() {
    const available = !!optic;
    reticleBox.label.style.display = available ? '' : 'none';
    reticleHint.style.display = available ? 'none' : '';
    const active = available && state.reticle;
    scopeBox.style.display = active ? '' : 'none';
    scope.setOptic(active ? optic : null);
    updateBdc();
  }

  // ---- Summary ----
  function currentValues() {
    const setup = getSetup();
    if (!setup || !names) return null;
    return cardValues({
      names, cartridge: setup.cartridge, rifle: setup.rifle, clicks: setup.clicks,
      atmosphere: setup.atmosphere, outputUnit: getOutputUnit(), crosswindMs: crosswindMs(), t
    });
  }
  function refreshSummary() {
    clear(summary);
    const values = currentValues();
    if (!values) return;
    for (const box of cardInfoBoxes(values)) {
      summary.appendChild(el('div', { class: 'input-section printable-card-summary-box' }, [
        el('h3', { i18n: box.headingKey }),
        ...box.rows.map((row) => el('div', { class: 'info-pane-row' }, [el('span', row.labelKey ? { i18n: row.labelKey } : { text: row.label }), el('span', { class: 'info-pane-value', text: row.value })]))
      ]));
    }
    titleInput.placeholder = defaultCardTitle(names);
  }

  // ---- Rows preview: the row count and the Mach distance, live ----
  function cardSettings(full) {
    return {
      maxMode: state.maxMode,
      maxDistanceM: state.maxDistanceM ?? maxDistanceField.getEngineValue() ?? defaultMaxM,
      initialStep: state.initialStep,
      refineThresholdRad: state.refineThresholdRad,
      spinDrift: full && state.spinDrift && spinOffered(),
      slope: full && state.slope,
      temperaturesC: full && state.temperature ? currentTemperatureColumns() : null,
      mach: MACH_OF_MODE[state.maxMode]
    };
  }
  function cardInputs(full) {
    const setup = getSetup();
    const output = outputSettings();
    if (!setup || !output) return null;
    const location = state.targets ? activeLocation() : null;
    return {
      pool, base: setup.base, settings: cardSettings(full), crosswindMs: crosswindMs(),
      targets: cardTargets(location, (n) => t('rangeSolverLocations.defaultTargetName', { n })),
      output, distanceUnit, spinDriftMode: getSpinDriftMode()
    };
  }
  let previewTimer = null;
  let previewRequest = 0;
  function schedulePreview() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { previewTimer = null; preview(); }, PREVIEW_DELAY_MS);
  }
  async function preview() {
    const inputs = cardInputs(false);
    if (!inputs) return;
    const id = ++previewRequest;
    try {
      const data = await computeCardData(inputs);
      if (disposed || id !== previewRequest) return;
      renderPreview(data);
    } catch (err) {
      if (disposed || id !== previewRequest) return;
      rowsStatus.textContent = t('common.error', { message: err.message });
      rowsWarning.style.display = 'none';
    }
  }
  function distanceText(d) {
    return `${Math.round(d)} ${unitLabel}`;
  }
  function renderPreview(data) {
    rowsStatus.textContent = t('printableCard.rowCount', { count: data.rowCount, max: MAX_ROWS });
    if (data.mach) {
      machHint.style.display = '';
      machHint.textContent = data.mach.reached
        ? t('printableCard.machHint', { mach: String(data.mach.mach.toFixed(1)), distance: distanceText(siToDisplay('range', data.mach.distanceM, distanceUnit)) })
        : t('printableCard.machNotReached', { mach: String(data.mach.mach.toFixed(1)), distance: distanceText(data.maxDistance) });
    } else {
      machHint.style.display = 'none';
    }
    if (data.omitted > 0) {
      rowsWarning.style.display = '';
      rowsWarning.textContent = t('printableCard.rowsWarning', { distance: distanceText(data.lastDistance), count: data.omitted });
    } else {
      rowsWarning.style.display = 'none';
    }
  }

  // ---- Download ----
  let busy = false;
  async function download() {
    if (busy) return;
    const inputs = cardInputs(true);
    const values = currentValues();
    if (!inputs || !values) return;
    busy = true;
    downloadButton.disabled = true;
    applyI18nText(downloadStatus, 'printableCard.generating');
    downloadStatus.className = 'status';
    try {
      const lang = getLanguage();
      const data = await computeCardData(inputs);
      renderPreview(data);
      const iso = state.date ?? todayIso();
      const title = state.title ?? defaultCardTitle(names);
      const location = activeLocation();
      let photo = null;
      if (state.photo && location && location.photo) {
        const size = await loadImageSize(location.photo);
        const targets = cardTargets(location, (n) => t('rangeSolverLocations.defaultTargetName', { n }));
        photo = {
          heading: `${t('printableCard.pdf.targets')} · ${location.name}`,
          photo: { href: location.photo, ...size },
          targets: targets.map((tg) => ({
            id: tg.label, coords: tg.coords,
            title: `${distanceText(siToDisplay('range', tg.rangeM, distanceUnit))} · ${signedDegreesText(tg.losAngleRad)}`,
            subtitle: tg.name
          }))
        };
      }
      let reticle = null;
      if (state.reticle && optic) {
        const exported = scope.exportPrintSvg({ reticleInk: PRINT_RETICLE_INK, overlayInk: PRINT_OVERLAY_INK, fontFamily: 'Overpass', idPrefix: 'card-reticle' });
        if (exported) {
          reticle = { heading: [t('printableCard.pdf.reticle'), zoomLabel(scope.getZoom()), optic.reticle.name].filter(Boolean).join(' · '), ...exported };
        }
      }
      const bytes = await buildCardPdf({
        paper: state.paper, lang, t,
        values: {
          ...values,
          cardTitle: title,
          date: formatCardDate(iso, lang),
          appLink: APP_LINK,
          version: RELEASE_ID
        },
        table: {
          rows: data.rows, spin: data.spin, slope: data.slope, temperature: data.temperature,
          labels: {
            target: t('printableCard.pdf.colTarget'), angle: t('printableCard.pdf.colAngle'),
            shorter: t('printableCard.pdf.colShorter'), longer: t('printableCard.pdf.colLonger'),
            distance: t('printableCard.pdf.colDistance'), distanceUnit: unitLabel,
            wind: t('printableCard.pdf.colWind'), windUnit: values.crosswindSpeed,
            spin: t('printableCard.pdf.colSpin'), slope: t('printableCard.pdf.colSlope'),
            temperature: t('printableCard.pdf.colTemperature', { unit: displayChoice('temperature').label }),
            temperatureColumns: (inputs.settings.temperaturesC || []).map(temperatureNumber)
          }
        },
        reticle,
        photo,
        notesHeading: t('printableCard.pdf.notes')
      });
      if (disposed) return;
      downloadFile(cardFileName(t('printableCard.pdf.rangeCard'), title, iso), bytes, 'application/pdf');
      downloadStatus.textContent = '';
    } catch (err) {
      if (disposed) return;
      applyI18nText(downloadStatus, 'printableCard.error', { message: err.message });
      downloadStatus.className = 'status error';
    } finally {
      busy = false;
      downloadButton.disabled = false;
    }
  }

  // ---- Refresh: the setup may have changed (the tab shown, a remount) ----
  let namesRequest = 0;
  async function refresh() {
    const setup = getSetup();
    // Not offered at all while Settings has spin drift off, or while the
    // rifle and bullet lack what it needs; the choice stays remembered.
    spinBox.label.style.display = spinOffered() ? '' : 'none';
    renderMaxMode();
    renderRefine();
    renderLocation();
    renderTemperature();
    refreshOptic();
    const id = ++namesRequest;
    const resolved = await resolveGunNames();
    if (disposed || id !== namesRequest) return;
    names = resolved;
    refreshSummary();
    schedulePreview();
  }

  return {
    node,
    refresh,
    dispose() {
      disposed = true;
      if (previewTimer) clearTimeout(previewTimer);
      bdc.dispose();
      scope.dispose();
    }
  };
}
