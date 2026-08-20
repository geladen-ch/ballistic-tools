import { el, clear } from '../dom.js';
import { getPool } from '../pool.js';
import { unitField } from '../ui/unit-field.js';
import { atmosphereSection } from '../ui/sections/atmosphere-section.js';
import { setDragModelSelectValue } from '../ui/drag-model-select.js';
import { applyI18nText, i18nSpan, t } from '../i18n.js';
import { DRAG_MODELS } from '../engine/drag-tables.js';
import { convertBallisticCoefficient } from '../engine/bc-convert.js';
import { getUnit } from '../prefs.js';
import Qty from '../vendor/js-quantities/quantities.mjs';
import { openTrackBatch } from '../labradar/zip-batch.js';
import { parseLabradarTrack } from '../labradar/track-parse.js';
import { aggregateTracks } from '../engine/labradar-bc.js';
import { trackListTable } from '../ui/labradar/track-list.js';
import { trackChart } from '../ui/labradar/track-chart.js';
import { resultsSummary } from '../ui/labradar/results-summary.js';

// Session-only (in-memory, not persisted across a reload — no cookie
// backing needed) state for the Calculation panel's own fields, so
// navigating away to another tool and back doesn't reset them to their
// hardcoded defaults. Same pattern hit-probability-view.js uses for its
// own panel fields (module-level, read once at mount, written on every
// change), scoped to this view. The outer Calculation/Conversion/Labradar
// tab is persisted too (`panelState.outerTab`, see mount()'s outerTabs),
// so navigating away and back returns to the same section. The inner
// Velocity/ToF mode switch is deliberately left unpersisted — narrower
// in scope, not something the user asked for.
let panelState = {};

function persistedValue(key, defaultValue) {
  return key in panelState ? panelState[key] : defaultValue;
}

// Same session-only convention, its own separate object so the
// Calculation panel's and the Labradar panel's persisted fields can
// never collide — the Labradar tab's drag model/atmosphere/filter
// choices survive navigating away and back, but reset on an actual page
// reload, same as everything else above. No cookie backing: the user
// only wants this to outlive a tab switch, not a browser restart.
let labradarPanelState = {};

// Matches the legacy Labrabaco tool's own atmosphere defaults exactly
// (15°C, 1013.25 hPa, 0% humidity) — unlike atmosphere-section.js's own
// generic DEFAULTS (50% humidity, a typical-outdoor-conditions guess),
// this tool's default was always meant to be a neutral starting point,
// not a guess at real weather.
const LABRADAR_DEFAULT_ATMOSPHERE = { tempC: 15, pressureHpa: 1013.25, humidityPct: 0 };

function loadLabradarAtmosphere() {
  return { ...LABRADAR_DEFAULT_ATMOSPHERE, ...labradarPanelState.atmosphere };
}

function saveLabradarAtmosphere(partial) {
  labradarPanelState.atmosphere = { ...labradarPanelState.atmosphere, ...partial };
}

// A unitField() that reads its initial value from panelState and writes
// back to it on every change.
function persistedUnitField(id, { onInput, ...rest }) {
  const initialValue = persistedValue(id, rest.value);
  let field;
  field = unitField({
    ...rest, id, value: initialValue,
    onInput: () => {
      panelState[id] = field.getEngineValue();
      if (onInput) onInput();
    }
  });
  return field;
}

// A tiny reusable tab-switcher: `tabs` is [{ key, labelKey }], `onSwitch`
// is called with the newly active key after the button classes and
// visibility are already updated. `initialKey` (defaults to the first
// tab) picks which tab/panel starts active — also applied to `panels`'
// initial display, so callers no longer need to hide their non-default
// panels by hand. Same hand-rolled pattern already shipping in
// hit-probability-view.js (own buttons/panels, no route change, no
// shared component) — used twice here, once for the outer
// Calculation/Conversion/Labradar tabs and once for the inner Velocity/ToF
// mode switch.
function tabSwitcher(tabs, panels, onSwitch, initialKey) {
  const activeKey = tabs.some((tabDef) => tabDef.key === initialKey) ? initialKey : tabs[0].key;
  const buttons = tabs.map((tabDef) => {
    const btn = el('button', { type: 'button', class: 'tab-btn' + (tabDef.key === activeKey ? ' active' : ''), i18n: tabDef.labelKey });
    btn.addEventListener('click', () => {
      for (const b of buttons) b.className = 'tab-btn';
      btn.className = 'tab-btn active';
      for (const key of Object.keys(panels)) panels[key].style.display = key === tabDef.key ? '' : 'none';
      if (onSwitch) onSwitch(tabDef.key);
    });
    return btn;
  });
  for (const key of Object.keys(panels)) panels[key].style.display = key === activeKey ? '' : 'none';
  return { node: el('div', { class: 'section-tabs' }, buttons) };
}

// Legacy's own two selectable "odd tracks filter" thresholds (see
// data/legacy.code/labrabaco/labrabaco.html) — replicated as-is per the
// user's choice to keep both dropdowns rather than hardcode fixed
// thresholds. `null` is the "None" option (gate/clip skipped entirely —
// see aggregateTracks()).
const R2_GATE_THRESHOLDS = { none: null, normal: 0.95, highNoise: 0.90 };
const SIGMA_CLIP_THRESHOLDS = { none: null, conservative: 2.0, aggressive: 1.644854 };

// Per-option hints, condensed from the legacy tool's own explanatory
// text for these two filters (data/legacy.code/labrabaco/labrabaco.html,
// the "Odd tracks filters" block) rather than invented fresh.
const R2_GATE_HINT_KEYS = {
  none: 'bcToolsLabradar.filterR2HintNone',
  normal: 'bcToolsLabradar.filterR2HintNormal',
  highNoise: 'bcToolsLabradar.filterR2HintHighNoise'
};
const SIGMA_CLIP_HINT_KEYS = {
  none: 'bcToolsLabradar.filterSigmaHintNone',
  conservative: 'bcToolsLabradar.filterSigmaHintConservative',
  aggressive: 'bcToolsLabradar.filterSigmaHintAggressive'
};

// chopShop's own point-cleaning restore gate (src/engine/labradar-clean.js's
// r2Threshold — a different knob from the two aggregate whole-track
// filters above) exposed as a friendlier 1 ("Loose") to 3 ("Normal")
// slider rather than the raw 0.97-0.99 ratio, per
// docs/reports/labradar-cleaning-experiment.md's validated finding that
// raising it from legacy's 0.97 toward 0.99 meaningfully improves
// accuracy paired with the whole-window curve fit. Default is Normal
// (0.99, the validated value); Loose (0.97) recovers today's older,
// gentler cleaning behavior for anyone who wants it.
const DENOISE_SLIDER_MIN = 1;
const DENOISE_SLIDER_MAX = 3;
const DENOISE_SLIDER_STEP = 0.5;
const DENOISE_SLIDER_DEFAULT = 3;
function denoiseSliderToThreshold(sliderValue) {
  return 0.97 + (sliderValue - 1) * 0.01;
}

// Builds the whole Labradar tab in one function, kept separate from
// mount()'s own top-level flow purely for readability — this closure's
// state (tracks/overrides) lives only as long as the panel does, rebuilt
// fresh on every mount() the same way the rest of this view's panels are.
function buildLabradarPanel() {
  const dragModelSelect = el('select', { id: 'labradarDragModel' });
  setDragModelSelectValue(dragModelSelect, labradarPanelState.dragModel || 'G7');
  dragModelSelect.addEventListener('change', () => {
    labradarPanelState.dragModel = dragModelSelect.value;
  });

  // No presets here — the tool this replaces never had any, and unlike
  // it (which always assumed altitude 0), this still back-derives a real
  // one from station pressure — see atmosphere-section.js's own
  // `presets: false` mode.
  const atmosphere = atmosphereSection({
    includeWind: false, presets: false,
    load: loadLabradarAtmosphere, save: saveLabradarAtmosphere
  });

  const r2GateSelect = el('select', { id: 'labradarR2Gate' }, [
    el('option', { value: 'none', i18n: 'bcToolsLabradar.filterR2None' }),
    el('option', { value: 'normal', i18n: 'bcToolsLabradar.filterR2Normal' }),
    el('option', { value: 'highNoise', i18n: 'bcToolsLabradar.filterR2HighNoise' })
  ]);
  r2GateSelect.value = labradarPanelState.r2GateChoice || 'normal';
  const r2GateHint = el('p', { class: 'hint' });
  applyI18nText(r2GateHint, R2_GATE_HINT_KEYS[r2GateSelect.value]);
  r2GateSelect.addEventListener('change', () => {
    labradarPanelState.r2GateChoice = r2GateSelect.value;
    applyI18nText(r2GateHint, R2_GATE_HINT_KEYS[r2GateSelect.value]);
    recomputeAggregate();
  });

  const sigmaClipSelect = el('select', { id: 'labradarSigmaClip' }, [
    el('option', { value: 'none', i18n: 'bcToolsLabradar.filterSigmaNone' }),
    el('option', { value: 'conservative', i18n: 'bcToolsLabradar.filterSigmaConservative' }),
    el('option', { value: 'aggressive', i18n: 'bcToolsLabradar.filterSigmaAggressive' })
  ]);
  sigmaClipSelect.value = labradarPanelState.sigmaClipChoice || 'conservative';
  const sigmaClipHint = el('p', { class: 'hint' });
  applyI18nText(sigmaClipHint, SIGMA_CLIP_HINT_KEYS[sigmaClipSelect.value]);
  sigmaClipSelect.addEventListener('change', () => {
    labradarPanelState.sigmaClipChoice = sigmaClipSelect.value;
    applyI18nText(sigmaClipHint, SIGMA_CLIP_HINT_KEYS[sigmaClipSelect.value]);
    recomputeAggregate();
  });

  const denoiseValueLabel = el('span', { class: 'range-slider-value' });
  const denoiseSlider = el('input', {
    type: 'range', id: 'labradarDenoiseThreshold',
    min: String(DENOISE_SLIDER_MIN), max: String(DENOISE_SLIDER_MAX), step: String(DENOISE_SLIDER_STEP)
  });
  denoiseSlider.value = String(labradarPanelState.denoiseSlider ?? DENOISE_SLIDER_DEFAULT);
  function updateDenoiseValueLabel() {
    denoiseValueLabel.textContent = denoiseSliderToThreshold(parseFloat(denoiseSlider.value)).toFixed(3);
  }
  updateDenoiseValueLabel();
  denoiseSlider.addEventListener('input', () => {
    labradarPanelState.denoiseSlider = parseFloat(denoiseSlider.value);
    updateDenoiseValueLabel();
  });
  const denoiseLooseCaption = i18nSpan('bcToolsLabradar.denoiseLoose');
  denoiseLooseCaption.className = 'range-slider-caption';
  const denoiseTightCaption = i18nSpan('bcToolsLabradar.denoiseTight');
  denoiseTightCaption.className = 'range-slider-caption';
  const denoiseHint = el('p', { class: 'hint', i18n: 'bcToolsLabradar.denoiseHint' });
  const denoiseRow = el('div', { class: 'field' }, [
    el('label', {}, [i18nSpan('bcToolsLabradar.denoiseThresholdLabel'), denoiseValueLabel]),
    el('div', { class: 'range-slider-row' }, [denoiseLooseCaption, denoiseSlider, denoiseTightCaption]),
    denoiseHint
  ]);

  const selectedFileNameLabel = el('span', { class: 'hint' });
  if (labradarPanelState.zipFileName) selectedFileNameLabel.textContent = labradarPanelState.zipFileName;

  const fileInput = el('input', { type: 'file', accept: 'application/zip' });
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = ''; // clear so picking the same filename again still fires 'change'
    if (!file) return;
    selectedFileNameLabel.textContent = file.name;
    labradarPanelState.zipFileName = file.name;
    await loadZip(file);
  });
  const pickFileButton = el('button', { class: 'section-button', i18n: 'bcToolsLabradar.pickFileButton' });
  pickFileButton.addEventListener('click', () => fileInput.click());

  // Deliberately a separate step from picking the file — parsing/listing
  // entries happens immediately on upload, but the actual per-track BC
  // solve (which bakes in the current drag model/atmosphere) only runs
  // once this is clicked, so the drag model and atmosphere can be set or
  // adjusted first. Clicking it again after changing either recomputes
  // every parsed track from scratch with the new values.
  const computeButton = el('button', { class: 'section-button', i18n: 'bcToolsLabradar.computeButton' });
  computeButton.disabled = true;
  computeButton.addEventListener('click', compute);

  const zipStatus = el('div', { class: 'status', i18n: 'common.idle' });

  const trackListHeading = el('h2', { i18n: 'bcToolsLabradar.trackListHeading' });
  const list = trackListTable({
    onSelect: (track) => chart.render(track),
    onOverrideChange: (filename, checked) => {
      overrides[filename] = checked;
      recomputeAggregate();
    }
  });
  const chart = trackChart();
  const summary = resultsSummary();

  // Persisted the same session-only way as the panel's other fields (see
  // labradarPanelState's own header comment) — `tracks`/`overrides` stay
  // ordinary local bindings for every *read* below; only the handful of
  // places that *reassign* them (in loadZip()) also write through to
  // labradarPanelState, so a tab navigation away and back doesn't lose
  // an already-loaded/computed batch.
  let tracks = labradarPanelState.tracks || []; // { filename, status, points?, bc?, r2Linear?, keptPoints?, discardedPoints?, errorMessage? }
  let overrides = labradarPanelState.overrides || {}; // filename -> boolean, only set once the user actually toggles a checkbox

  function recomputeAggregate() {
    const resolved = tracks.filter((tr) => tr.bc !== undefined).map((tr) => ({ id: tr.filename, bc: tr.bc, r2Linear: tr.r2Linear }));
    const agg = aggregateTracks(resolved, {
      r2GateThreshold: R2_GATE_THRESHOLDS[r2GateSelect.value],
      sigmaClip: SIGMA_CLIP_THRESHOLDS[sigmaClipSelect.value],
      overrides
    });
    const verdictByFilename = Object.fromEntries(agg.verdicts.map((v) => [v.id, v.verdict]));
    for (const tr of tracks) {
      if (tr.bc !== undefined) tr.status = verdictByFilename[tr.filename];
    }
    list.render(tracks);
    summary.render(agg);
  }

  async function loadZip(file) {
    overrides = {};
    labradarPanelState.overrides = overrides;
    chart.render(null);
    summary.render(null);
    computeButton.disabled = true;
    applyI18nText(zipStatus, 'common.computing');
    zipStatus.className = 'status';

    let entries;
    try {
      entries = await openTrackBatch(file);
    } catch (err) {
      applyI18nText(zipStatus, 'bcToolsLabradar.zipOpenError', { message: err.message });
      zipStatus.className = 'status error';
      tracks = [];
      labradarPanelState.tracks = tracks;
      list.render(tracks);
      return;
    }
    if (entries.length === 0) {
      applyI18nText(zipStatus, 'bcToolsLabradar.emptyBatchError');
      zipStatus.className = 'status error';
      tracks = [];
      labradarPanelState.tracks = tracks;
      list.render(tracks);
      return;
    }

    applyI18nText(zipStatus, 'common.idle');
    zipStatus.className = 'status';
    // Parsing (cheap, synchronous, client-side) happens right away so the
    // list and the not-a-track verdicts show up immediately — only the
    // actual BC solve waits for Compute.
    tracks = entries.map((e) => {
      const points = parseLabradarTrack(e.text);
      return points ? { filename: e.filename, status: 'pending', points } : { filename: e.filename, status: 'not-a-track' };
    });
    labradarPanelState.tracks = tracks;
    list.render(tracks);
    computeButton.disabled = !tracks.some((tr) => tr.points);
  }

  async function compute() {
    const targets = tracks.filter((tr) => tr.points);
    if (targets.length === 0) return;

    const pool = getPool();
    const atmo = atmosphere.getValues();
    const dragModel = dragModelSelect.value;

    for (const track of targets) {
      track.status = 'computing';
      delete track.bc;
      delete track.v1;
      delete track.r2Linear;
      delete track.keptPoints;
      delete track.discardedPoints;
      delete track.dragModel;
      delete track.atmo;
      delete track.errorMessage;
    }
    chart.render(null);
    summary.render(null);
    list.render(tracks);
    computeButton.disabled = true;

    // Dispatched individually (not via pool.runAll()'s Promise.all) so
    // each row updates as soon as its own job resolves, matching the
    // legacy tool's own live-updating list — runAll() would wait for
    // every track before showing any result. Still spreads across the
    // whole pool: run() round-robins workers by default.
    const r2CleanThreshold = denoiseSliderToThreshold(parseFloat(denoiseSlider.value));
    const settled = targets.map((track) =>
      pool.run('labradarTrackBc', { points: track.points, dragModel, atmo, minLeft: 10, r2CleanThreshold })
        .then((result) => {
          // dragModel/atmo stashed alongside the result itself (not read
          // live from the UI at chart-render time) so the fitted-curve
          // overlay always reflects what this specific track's BC was
          // actually computed with, even if the user later adjusts the
          // panel's atmosphere/drag model without recomputing.
          Object.assign(track, result, { dragModel, atmo });
          recomputeAggregate();
        })
        .catch((err) => {
          track.status = 'error';
          track.errorMessage = err.message;
          recomputeAggregate();
        })
    );
    await Promise.allSettled(settled);
    computeButton.disabled = false;
  }

  // Restore whatever was already loaded/computed before the user
  // navigated away — mirrors what a successful loadZip() already does
  // at its own end, so the list/summary/Compute-button state matches
  // the persisted tracks/overrides immediately, without waiting for any
  // further user action. Deliberately does not try to restore which
  // track was last selected/charted — the chart just starts empty,
  // same as right after a fresh zip load.
  if (tracks.length > 0) {
    list.render(tracks);
    recomputeAggregate();
    computeButton.disabled = !tracks.some((tr) => tr.points);
  }

  return el('div', {}, [
    el('p', { i18n: 'bcToolsLabradar.intro' }),
    el('div', { class: 'tool-layout' }, [
      el('div', { class: 'card' }, [
        el('h2', { i18n: 'bcToolsLabradar.setupHeading' }),
        el('div', { class: 'field' }, [el('label', { i18n: 'common.dragModel' }), dragModelSelect]),
        atmosphere.node,
        el('div', { class: 'field' }, [el('label', { i18n: 'bcToolsLabradar.filterR2Label' }), r2GateSelect, r2GateHint]),
        el('div', { class: 'field' }, [el('label', { i18n: 'bcToolsLabradar.filterSigmaLabel' }), sigmaClipSelect, sigmaClipHint]),
        denoiseRow,
        pickFileButton,
        selectedFileNameLabel,
        fileInput,
        zipStatus,
        computeButton
      ]),
      el('div', { class: 'tool-results' }, [
        summary.node,
        chart.node,
        el('div', { class: 'card' }, [trackListHeading, el('div', { class: 'scroll-x' }, [list.node])])
      ])
    ])
  ]);
}

export function mount(container) {
  clear(container);

  const dragModelSelect = el('select', { id: 'dragModel' });
  setDragModelSelectValue(dragModelSelect, persistedValue('dragModel', 'G1'));
  dragModelSelect.addEventListener('change', () => {
    panelState.dragModel = dragModelSelect.value;
  });
  const atmosphere = atmosphereSection({ includeWind: false });

  // ---- Shared fields (both Velocity and ToF mode) ----
  const v1Field = persistedUnitField('v1', { value: 800, step: 0.1 });
  const r1Field = persistedUnitField('r1', { value: 0, step: 1 });
  const r2Field = persistedUnitField('r2', { value: 300, step: 1 });

  // ---- Mode-specific field: far velocity (v2) vs. time of flight (tof) ----
  const v2Field = persistedUnitField('v2', { value: 629.1, step: 0.1 });
  const tofInput = el('input', { type: 'number', id: 'tof', step: '0.001', value: persistedValue('tof', '0.423') });
  tofInput.addEventListener('input', () => {
    panelState.tof = tofInput.value;
  });
  const tofField = el('div', { class: 'field' }, [
    el('label', { i18n: 'fields.tof' }),
    tofInput
  ]);
  tofField.style.display = 'none';

  let mode = 'velocity'; // 'velocity' | 'tof'
  const modeSwitcher = tabSwitcher(
    [
      { key: 'velocity', labelKey: 'bcEstimate.modeVelocity' },
      { key: 'tof', labelKey: 'bcEstimate.modeTof' }
    ],
    { velocity: v2Field.node, tof: tofField },
    (key) => {
      mode = key;
      invalidateResult();
    }
  );

  const status = el('div', { class: 'status', i18n: 'common.idle' });
  const result = el('div', { id: 'bc-result', class: 'card', style: 'font-size:28px;font-weight:700;color:var(--accent);' }, ['—']);
  const runButton = el('button', { class: 'section-button', i18n: 'bcEstimate.estimateButton' });

  const controls = el('div', { class: 'card' }, [
    el('h2', { i18n: 'bcEstimate.measuredVelocitiesHeading' }),
    modeSwitcher.node,
    v1Field.node, r1Field.node, v2Field.node, tofField, r2Field.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'common.dragModel' }), dragModelSelect]),
    atmosphere.node,
    runButton,
    status
  ]);

  const results = el('div', { class: 'tool-results' }, [
    el('div', {}, [el('h2', { i18n: 'bcEstimate.resultHeading' }), result])
  ]);

  const calculationPanel = el('div', {}, [
    el('p', { i18n: 'bcEstimate.intro' }),
    el('div', { class: 'tool-layout' }, [controls, results])
  ]);
  // ---- BC Conversion: converts a BC from one standard drag model to
  // another at a single reference velocity (see engine/bc-convert.js's own
  // header for the math). Both model pickers deliberately list every
  // standard model unfiltered — unlike dragModelSelect above, Settings'
  // show/hide preference is about decluttering everyday pickers, not about
  // limiting which models a one-off conversion can name on either side.
  const convSourceSelect = el('select', { id: 'convSourceModel' });
  const convTargetSelect = el('select', { id: 'convTargetModel' });
  for (const select of [convSourceSelect, convTargetSelect]) {
    for (const m of DRAG_MODELS) select.appendChild(el('option', { value: m.id, i18n: m.labelKey }));
  }
  convSourceSelect.value = persistedValue('convSourceModel', 'G1');
  convTargetSelect.value = persistedValue('convTargetModel', 'G7');

  const convBcInput = el('input', {
    type: 'number', id: 'convBc', step: '0.001', min: '0', value: persistedValue('convBc', '0.5')
  });

  // Velocity gets its own small unit toggle (m/s / ft/s only, not the full
  // 4-choice velocity group unitField() reads from Settings) — defaults to
  // ft/s only when that's already the user's global preference, since mph/
  // km/h have no place in a Mach-referenced conversion.
  let convVelocityUnit = persistedValue('convVelocityUnit', getUnit('velocity') === 'ft/s' ? 'ft/s' : 'm/s');
  const convVelocityInput = el('input', {
    type: 'number', id: 'convVelocity', step: '0.1', min: '0',
    value: persistedValue('convVelocity', convVelocityUnit === 'ft/s' ? '2625' : '800')
  });
  const convVelocityUnitSelect = el('select', { id: 'convVelocityUnit' }, [
    el('option', { value: 'm/s', text: 'm/s' }),
    el('option', { value: 'ft/s', text: 'ft/s' })
  ]);
  convVelocityUnitSelect.value = convVelocityUnit;

  const convResult = el('div', {
    id: 'conv-result', class: 'card', style: 'font-size:28px;font-weight:700;color:var(--accent);'
  }, ['—']);

  function recomputeConversion() {
    const bcValue = parseFloat(convBcInput.value);
    const velocityValue = parseFloat(convVelocityInput.value);
    clear(convResult);
    if (!(bcValue > 0) || !(velocityValue > 0)) {
      convResult.appendChild(document.createTextNode('—'));
      return;
    }
    const velocityMs = Qty(velocityValue, convVelocityUnit).to('m/s').scalar;
    const converted = convertBallisticCoefficient({
      bc: bcValue,
      sourceModel: convSourceSelect.value,
      targetModel: convTargetSelect.value,
      velocityMs
    });
    convResult.appendChild(document.createTextNode(converted.toFixed(4)));
  }

  convSourceSelect.addEventListener('change', () => {
    panelState.convSourceModel = convSourceSelect.value;
    recomputeConversion();
  });
  convTargetSelect.addEventListener('change', () => {
    panelState.convTargetModel = convTargetSelect.value;
    recomputeConversion();
  });
  convBcInput.addEventListener('input', () => {
    panelState.convBc = convBcInput.value;
    recomputeConversion();
  });
  convVelocityInput.addEventListener('input', () => {
    panelState.convVelocity = convVelocityInput.value;
    recomputeConversion();
  });
  convVelocityUnitSelect.addEventListener('change', () => {
    // Re-express whatever's already typed in the new unit, rather than
    // resetting it — a toggle should restate the same physical velocity,
    // not throw it away.
    const newUnit = convVelocityUnitSelect.value;
    const current = parseFloat(convVelocityInput.value);
    if (Number.isFinite(current) && current > 0) {
      const restated = Qty(current, convVelocityUnit).to(newUnit).scalar;
      convVelocityInput.value = restated.toFixed(newUnit === 'ft/s' ? 0 : 1);
    }
    convVelocityUnit = newUnit;
    panelState.convVelocityUnit = convVelocityUnit;
    panelState.convVelocity = convVelocityInput.value;
    recomputeConversion();
  });

  const conversionControls = el('div', { class: 'card' }, [
    el('h2', { i18n: 'bcConversion.inputsHeading' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.convSourceModel' }), convSourceSelect]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.convBc' }), convBcInput]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.convTargetModel' }), convTargetSelect]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'fields.convVelocity' }),
      el('div', { class: 'preset-row' }, [convVelocityInput, convVelocityUnitSelect])
    ])
  ]);

  const conversionResults = el('div', { class: 'tool-results' }, [
    el('div', {}, [el('h2', { i18n: 'bcConversion.resultHeading' }), convResult])
  ]);

  const conversionPanel = el('div', {}, [
    el('p', { i18n: 'bcConversion.intro' }),
    el('div', { class: 'tool-layout' }, [conversionControls, conversionResults])
  ]);
  recomputeConversion();
  const labradarPanel = buildLabradarPanel();

  const outerPanels = { calculation: calculationPanel, conversion: conversionPanel, labradar: labradarPanel };
  const outerTabs = tabSwitcher(
    [
      { key: 'calculation', labelKey: 'bcTools.tabCalculation' },
      { key: 'conversion', labelKey: 'bcTools.tabConversion' },
      { key: 'labradar', labelKey: 'bcTools.tabLabradar' }
    ],
    outerPanels,
    (key) => { panelState.outerTab = key; },
    persistedValue('outerTab', 'calculation')
  );

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'bcTools.title' }),
    el('p', { i18n: 'bcTools.intro' }),
    outerTabs.node,
    calculationPanel,
    conversionPanel,
    labradarPanel
  ]));

  // ---- Read inputs / run ----
  function readTof() {
    const raw = tofInput.value;
    const parsed = parseFloat(raw);
    if (raw.trim() === '' || Number.isNaN(parsed) || parsed <= 0) {
      throw new Error(t('bcTools.invalidTof'));
    }
    return parsed;
  }

  function readInputs() {
    const base = {
      dragModel: dragModelSelect.value,
      ...atmosphere.getValues(),
      v1: v1Field.getEngineValue(),
      r1: r1Field.getEngineValue(),
      r2: r2Field.getEngineValue()
    };
    return mode === 'velocity'
      ? { ...base, v2: v2Field.getEngineValue() }
      : { ...base, tof: readTof() };
  }

  const pool = getPool();
  let latestRequestId = 0;

  function invalidateResult() {
    latestRequestId++;
    clear(result);
    result.appendChild(document.createTextNode('—'));
    applyI18nText(status, 'common.idle');
    status.className = 'status';
  }

  async function run() {
    const id = ++latestRequestId;
    applyI18nText(status, 'common.computing');
    status.className = 'status';
    runButton.disabled = true;
    try {
      const jobType = mode === 'velocity' ? 'bcEstimate' : 'bcEstimateTof';
      const { bc } = await pool.run(jobType, readInputs());
      if (id !== latestRequestId) return;
      clear(result);
      result.appendChild(document.createTextNode(bc.toFixed(4)));
      applyI18nText(status, 'bcEstimate.statusOk');
      status.className = 'status ok';
    } catch (err) {
      if (id !== latestRequestId) return;
      applyI18nText(status, 'common.error', { message: err.message });
      status.className = 'status error';
    } finally {
      if (id === latestRequestId) runButton.disabled = false;
    }
  }

  runButton.addEventListener('click', run);
  run();

  return () => {
    latestRequestId++;
  };
}

// Test-only: resets the Calculation panel's persisted field values back to
// "nothing saved yet" — same purpose resetHitProbabilityStateForTests()
// serves for hit-probability-view.js's own panelState, needed because
// tests that mount() this view multiple times in one process would
// otherwise see values leak in from an earlier test case.
export function resetBcToolsStateForTests() {
  panelState = {};
  labradarPanelState = {};
}
