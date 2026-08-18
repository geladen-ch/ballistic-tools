import { el, clear } from '../dom.js';
import { unitField } from '../ui/unit-field.js';
import { rifleSection } from '../ui/sections/rifle-section.js';
import { cartridgeSection } from '../ui/sections/cartridge-section.js';
import { gunsSummary } from '../ui/sections/guns-summary.js';
import { atmosphereSection } from '../ui/sections/atmosphere-section.js';
import { downloadButton } from '../ui/download-button.js';
import { t, i18nSpan, applyI18nText } from '../i18n.js';
import { svgEl } from '../svg.js';
import { downloadFile } from '../download.js';
import { computeSingleShot } from '../engine/single-shot.js';
import { computeSpotterCorrected } from '../engine/spotter-corrected.js';
import { loadTargetCatalog, loadTarget, loadTargetFunction, targetThumbUrl, targetDetailUrl, targetResultUrl } from '../targets.js';

// Real preset value tables — see the plan for provenance. Each preset's
// `key` is also its translation key under hitProbability.presetLabels.
const PRESETS = {
  muzzleVelocitySD: [
    { key: 'manicReload', value: 2 }, { key: 'goodReload', value: 3 }, { key: 'factoryPremium', value: 4 },
    { key: 'factoryMatch', value: 5 }, { key: 'factoryTraining', value: 7 }, { key: 'surplus', value: 9 }
  ],
  benchPrecision: [
    { key: 'benchrest', value: 0.03 }, { key: 'supermatch', value: 0.06 }, { key: 'sniper', value: 0.09 },
    { key: 'basic', value: 0.14 }, { key: 'dmr', value: 0.20 }, { key: 'm4m16', value: 0.32 },
    { key: 'ak74', value: 0.39 }, { key: 'akmAk47', value: 0.53 }
  ],
  shooterSkill: [
    { key: 'robot', value: 0 }, { key: 'elite', value: 0.06 }, { key: 'marksman', value: 0.12 },
    { key: 'proficient', value: 0.24 }, { key: 'novice', value: 0.36 }
  ],
  distanceMedianError: [
    { key: 'ideal', value: 0 }, { key: 'laser', value: 0.14 }, { key: 'expertReticle', value: 4 },
    { key: 'lowTech', value: 8 }, { key: 'nakedEyeTrained', value: 12.5 }, { key: 'nakedEyeAverage', value: 15 }
  ],
  tempMedianError: [
    { key: 'ideal', value: 0 }, { key: 'pocketThermometer', value: 0.5 }, { key: 'average', value: 5 }, { key: 'poor', value: 8 }
  ],
  pressureMedianError: [
    { key: 'ideal', value: 0 }, { key: 'pocketBarometer', value: 2 }, { key: 'byAltitude', value: 7 }, { key: 'approximate', value: 14 }
  ],
  windMedianError: [
    { key: 'ideal', value: 0 }, { key: 'excellent', value: 0.25 }, { key: 'good', value: 0.5 }, { key: 'average', value: 1 }, { key: 'poor', value: 2 }
  ],
  movingTargetSpeed: [
    { key: 'static', value: 0 }, { key: 'walking', value: 1.5 }, { key: 'running', value: 3 }, { key: 'landVehicle', value: 12 }
  ],
  movingTargetSpeedError: [
    { key: 'excellent', value: 5 }, { key: 'good', value: 10 }, { key: 'average', value: 20 }, { key: 'poor', value: 30 }
  ],
  spotterMeasure: [
    { key: 'perfect', value: 0 }, { key: 'master', value: 0.05 }, { key: 'typical', value: 0.1 }, { key: 'novice', value: 0.15 }
  ]
};

const DEFAULT_PRESET_KEY = {
  muzzleVelocitySD: 'factoryMatch', benchPrecision: 'basic', shooterSkill: 'marksman',
  distanceMedianError: 'laser', tempMedianError: 'pocketThermometer', pressureMedianError: 'pocketBarometer',
  windMedianError: 'good', movingTargetSpeed: 'static', movingTargetSpeedError: 'good',
  spotterMeasure: 'master'
};

// Vertical/horizontal dispersion multipliers applied to shooter skill —
// no stated default, so "Prone, with bipod" (the neutral 1.0/1.0 case) is
// used as this view's own starting point.
const POSITIONS = [
  { key: 'fullySupported', v: 0.5, h: 0.5 },
  { key: 'proneBipod', v: 1.0, h: 1.0 },
  { key: 'proneOffhand', v: 1.4, h: 1.6 },
  { key: 'kneeling', v: 1.5, h: 2.4 },
  { key: 'standing', v: 2.1, h: 2.5 },
  { key: 'quickHalt', v: 2.3, h: 3.4 }
];
const DEFAULT_POSITION_KEY = 'proneBipod';

const CONVENTIONS = ['r50', 'r99', 'es5', 'es10'];

const SCENARIOS = ['singleShot', 'spotterCorrected'];
const DEFAULT_SCENARIO = 'singleShot';

// Chi-square 95th percentile at 2 degrees of freedom — the standard
// scaling from per-axis SD to a 95% confidence ellipse for an independent
// (uncorrelated) 2D Gaussian: sqrt(5.991).
const ELLIPSE_95_FACTOR = 2.4477;
const SAMPLE_IMPACT_COUNT = 200;

// SVG presentation attributes (fill="...", stroke="...") can't embed
// var(--x) the way a stylesheet rule can, so the illustration's plotted
// colors are read live off the actual CSS custom properties instead of a
// hardcoded hex — otherwise they'd stay frozen at one theme's values and
// go unreadable (or just wrong) once a different theme (base.css's
// .theme-dark/.theme-high-contrast-light/.theme-high-contrast-dark) swaps
// the palette. Re-read on every renderIllustration() call, which already
// re-runs on every recompute and on mount, so it never needs its own
// change listener.
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
// A sample impact's true footprint at 1x zoom / "Impacts to scale" on —
// SVG units are millimeters (see pxPerMeter), so this is a literal 10mm
// bullet-hole diameter drawn to the target's own real-world scale.
const SAMPLE_IMPACT_DIAMETER_MM = 10;
// Fraction of the target's own native extent added as breathing room at
// 1x zoom, so its edge doesn't sit flush against the viewBox boundary.
const FIT_MARGIN_RATIO = 0.04;
// Manual zoom range around the 1x baseline — which always fits the
// target's own source SVG exactly, regardless of the simulation's
// dispersion (see computeBaseHalfExtent()). 4x in for inspecting a tight
// group against the target itself, down to 0.25x out for a wider look
// than the target's own extent.
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.05;
const ZOOM_DEFAULT = 1;

// A synthetic, non-pickable option shown whenever the paired number field's
// value no longer matches any preset — indicates "you're not looking at a
// preset value anymore" rather than offering an action of its own.
const CUSTOM_PRESET_KEY = '__custom__';

// Session-only (in-memory, not persisted across a reload — no cookie
// backing needed) state for the Uncertainty and Simulation panels, so
// navigating away to another tool and back doesn't reset them to their
// hardcoded defaults. Module-level rather than in shot-state.js because
// none of this is shared with any other view (unlike rifle/cartridge/
// atmosphere, which shot-state.js already covers for this page too — see
// rifleSection()/cartridgeSection()/atmosphereSection() below). A plain
// object that mount() reads from once and writes to on every change; the
// same pattern shot-state.js uses, just scoped to this one view.
let panelState = {};

function persistedValue(key, defaultValue) {
  return key in panelState ? panelState[key] : defaultValue;
}

function presetSelect(fieldId, initialKey, onPick) {
  const options = PRESETS[fieldId].map((p) => el('option', { value: p.key, i18n: `hitProbability.presetLabels.${p.key}` }));
  options.push(el('option', { value: CUSTOM_PRESET_KEY, disabled: true, i18n: 'hitProbability.presetLabels.custom' }));
  const select = el('select', {}, options);
  select.value = initialKey;
  select.addEventListener('change', () => {
    if (select.value === CUSTOM_PRESET_KEY) return;
    onPick(PRESETS[fieldId].find((p) => p.key === select.value).value);
  });
  return select;
}

// A unitField() paired with a presets <select> that pre-fills it (still
// freely editable afterward) — the pairing used throughout the
// Uncertainty panel. Reuses unitField's own unit-conversion logic via its
// `before` slot rather than duplicating it. Typing a value by hand (as
// opposed to picking a preset, which sets the field programmatically and
// so never fires unitField's own onInput) flips the select to "Custom" —
// both live in the same handler so there's no ordering question between
// "mark custom" and "persist" running on the same keystroke.
function presetUnitField(id, { max, step, isSpan = false, onInput }) {
  let field;
  const initialKey = persistedValue(id + 'Preset', DEFAULT_PRESET_KEY[id]);
  const select = presetSelect(id, initialKey, (value) => {
    field.setEngineValue(value);
    panelState[id] = value;
    panelState[id + 'Preset'] = select.value;
    onInput();
  });
  const defaultValue = PRESETS[id].find((p) => p.key === DEFAULT_PRESET_KEY[id]).value;
  const initialValue = persistedValue(id, defaultValue);
  field = unitField({
    id, min: 0, max, step, value: initialValue, isSpan, before: select,
    onInput: () => {
      select.value = CUSTOM_PRESET_KEY;
      panelState[id] = field.getEngineValue();
      panelState[id + 'Preset'] = CUSTOM_PRESET_KEY;
      onInput();
    }
  });
  return field;
}

// A unitField() with no preset selector, still persisted across
// navigation the same way (target range, aiming offsets, battle zero).
function persistedUnitField(id, { onInput, ...rest }) {
  let field;
  const initialValue = persistedValue(id, rest.value);
  field = unitField({
    ...rest, id, value: initialValue,
    onInput: () => {
      panelState[id] = field.getEngineValue();
      if (onInput) onInput();
    }
  });
  return field;
}

function persistedCheckbox(id, labelKey, defaultChecked, onChange) {
  const checkbox = el('input', { type: 'checkbox', id });
  checkbox.checked = persistedValue(id, defaultChecked);
  const row = el('label', { class: 'checkbox-field' }, [checkbox, i18nSpan(labelKey)]);
  checkbox.addEventListener('change', () => {
    panelState[id] = checkbox.checked;
    onChange();
  });
  return { checkbox, row };
}

function persistedSelect(id, options, defaultValue, onChange) {
  const select = el('select', { id }, options);
  select.value = persistedValue(id, defaultValue);
  select.addEventListener('change', () => {
    panelState[id] = select.value;
    onChange();
  });
  return select;
}

export function mount(container) {
  clear(container);
  let disposed = false;

  // ---- Rifle & Bullet (shared active gun configuration with Trajectory —
  // never rendered here, just read for their engine values; see
  // guns-summary.js for the visible stand-in and guns-view.js for where
  // this configuration is actually edited) ----
  const rifle = rifleSection({ onInput: () => recompute(), onLibraryCartridgeChange: (c) => cartridge.setLibraryCartridge(c) });
  const cartridge = cartridgeSection({ onInput: () => recompute() });
  const guns = gunsSummary();

  // ---- Parameters (rifle/bullet summary + uncertainty inputs) ----
  const muzzleVelocitySDField = presetUnitField('muzzleVelocitySD', { max: 20, step: 0.5, onInput: () => recompute() });

  const { checkbox: simplifiedToggle, row: simplifiedToggleRow } =
    persistedCheckbox('simplifiedPrecisionEnabled', 'hitProbability.simplifiedToggleLabel', false, () => {
      applySimplifiedVisibility();
      recompute();
    });

  const benchPrecisionField = presetUnitField('benchPrecision', { max: 3, step: 0.01, onInput: () => recompute() });
  const shooterSkillField = presetUnitField('shooterSkill', { max: 3, step: 0.01, onInput: () => recompute() });
  const positionSelect = persistedSelect(
    'position', POSITIONS.map((p) => el('option', { value: p.key, i18n: `hitProbability.presetLabels.${p.key}` })),
    DEFAULT_POSITION_KEY, () => recompute()
  );
  const detailedPrecisionBlock = el('div', {}, [
    benchPrecisionField.node,
    shooterSkillField.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.position' }), positionSelect])
  ]);

  const conventionSelect = persistedSelect(
    'precisionConvention', CONVENTIONS.map((c) => el('option', { value: c, i18n: `hitProbability.convention${c[0].toUpperCase()}${c.slice(1)}` })),
    'r50', () => recompute()
  );
  const combinedPrecisionField = persistedUnitField('combinedPrecision', { min: 0, max: 3, step: 0.01, value: 0.14, before: conventionSelect, onInput: () => recompute() });
  const simplifiedPrecisionBlock = el('div', {}, [
    combinedPrecisionField.node,
    el('p', { class: 'hint', i18n: 'hitProbability.simplifiedHint' })
  ]);

  function applySimplifiedVisibility() {
    detailedPrecisionBlock.style.display = simplifiedToggle.checked ? 'none' : '';
    simplifiedPrecisionBlock.style.display = simplifiedToggle.checked ? '' : 'none';
  }
  applySimplifiedVisibility();

  const ownErrorsSection = el('div', { class: 'input-section' }, [
    el('h3', { i18n: 'hitProbability.ownErrorsHeading' }),
    muzzleVelocitySDField.node,
    simplifiedToggleRow,
    detailedPrecisionBlock,
    simplifiedPrecisionBlock
  ]);

  const distanceMedianErrorField = presetUnitField('distanceMedianError', { max: 50, step: 0.1, onInput: () => recompute() });
  const tempMedianErrorField = presetUnitField('tempMedianError', { max: 20, step: 0.1, isSpan: true, onInput: () => recompute() });
  const pressureMedianErrorField = presetUnitField('pressureMedianError', { max: 30, step: 0.5, onInput: () => recompute() });
  const windMedianErrorField = presetUnitField('windMedianError', { max: 10, step: 0.1, onInput: () => recompute() });

  const { checkbox: movingTargetToggle, row: movingTargetToggleRow } =
    persistedCheckbox('movingTargetEnabled', 'hitProbability.movingTargetToggleLabel', false, () => {
      applyMovingTargetVisibility();
      recompute();
    });
  const movingTargetSpeedErrorField = presetUnitField('movingTargetSpeedError', { max: 100, step: 1, onInput: () => recompute() });
  const movingTargetSpeedErrorRow = el('div', {}, [movingTargetSpeedErrorField.node]);

  const conditionErrorsSection = el('div', { class: 'input-section' }, [
    el('h3', { i18n: 'hitProbability.conditionErrorsHeading' }),
    distanceMedianErrorField.node,
    tempMedianErrorField.node,
    pressureMedianErrorField.node,
    windMedianErrorField.node,
    movingTargetToggleRow,
    movingTargetSpeedErrorRow
  ]);

  const parametersPanel = el('div', { class: 'card input-panel' }, [guns.node, ownErrorsSection, conditionErrorsSection]);

  // ---- Simulation ----
  const initialScenario = persistedValue('scenario', DEFAULT_SCENARIO);
  let currentScenario = initialScenario;
  const scenarioSelect = persistedSelect(
    'scenario',
    SCENARIOS.map((s) => el('option', { value: s, i18n: `hitProbability.scenario${s[0].toUpperCase()}${s.slice(1)}` })),
    initialScenario,
    () => {
      currentScenario = scenarioSelect.value;
      applyScenarioVisibility();
      recompute();
    }
  );

  // Both scenario-specific inputs live together with the scenario picker
  // itself — the "Scenario" heading doubles as the select's own label, so
  // it isn't repeated as a separate <label> right underneath.
  const sightingShotCountField = persistedUnitField('sightingShotCount', { min: 1, max: 5, step: 1, value: 1, onInput: () => recompute() });
  const spotterMeasureField = presetUnitField('spotterMeasure', { max: 5, step: 0.05, onInput: () => recompute() });
  sightingShotCountField.node.style.display = 'none';
  spotterMeasureField.node.style.display = 'none';
  const scenarioSection = el('div', { class: 'input-section' }, [
    el('h3', { i18n: 'hitProbability.scenarioLabel' }),
    el('div', { class: 'field' }, [scenarioSelect]),
    sightingShotCountField.node,
    spotterMeasureField.node
  ]);

  const targetRangeField = persistedUnitField('targetRange', { min: 10, max: 2000, step: 10, value: 400, onInput: () => recompute() });
  const atmosphere = atmosphereSection({ includeWind: false, onInput: () => recompute() });

  const movingTargetSpeedField = presetUnitField('movingTargetSpeed', { max: 30, step: 0.5, onInput: () => recompute() });

  function applyMovingTargetVisibility() {
    movingTargetSpeedErrorRow.style.display = movingTargetToggle.checked ? '' : 'none';
    movingTargetSpeedField.node.style.display = movingTargetToggle.checked ? '' : 'none';
  }
  applyMovingTargetVisibility();

  const { checkbox: battleZeroToggle, row: battleZeroToggleRow } =
    persistedCheckbox('battleZeroEnabled', 'hitProbability.battleZeroToggleLabel', false, () => {
      battleZeroField.node.style.display = battleZeroToggle.checked ? '' : 'none';
      recompute();
    });
  const battleZeroField = persistedUnitField('battleZeroRange', { min: 0, max: 1000, step: 10, value: 100, onInput: () => recompute() });
  battleZeroField.node.style.display = battleZeroToggle.checked ? '' : 'none';

  const aimOffsetXField = persistedUnitField('aimOffsetX', { min: -100, max: 100, step: 0.5, value: 0, onInput: () => recompute() });
  const aimOffsetYField = persistedUnitField('aimOffsetY', { min: -100, max: 100, step: 0.5, value: 0, onInput: () => recompute() });

  const initialTargetId = persistedValue('targetId', loadTargetCatalog()[0]);
  let currentTargetId = initialTargetId;
  const targetButtons = new Map(); // target id -> its picker button, for toggling .active
  const targetPickerGrid = el('div', { class: 'target-picker-grid' });
  const targetDetailImg = el('img', { src: targetDetailUrl(initialTargetId).href, alt: '', style: 'width:100%;max-width:260px;display:block;margin-bottom:10px;' });
  const targetNameLabel = el('p', { class: 'hint' });

  function selectTarget(id) {
    currentTargetId = id;
    panelState.targetId = id;
    for (const [btnId, btn] of targetButtons) btn.className = 'target-picker-item' + (btnId === id ? ' active' : '');
    loadCurrentTarget();
  }

  const simulationPanel = el('div', { class: 'card input-panel' }, [
    scenarioSection,
    targetRangeField.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'hitProbability.targetLabel' }), targetPickerGrid, targetDetailImg, targetNameLabel]),
    atmosphere.node,
    movingTargetSpeedField.node,
    battleZeroToggleRow,
    battleZeroField.node,
    aimOffsetXField.node,
    aimOffsetYField.node
  ]);
  simulationPanel.style.display = 'none';

  // ---- Tab switcher ----
  const panels = { parameters: parametersPanel, simulation: simulationPanel };
  const tabs = [
    { key: 'parameters', labelKey: 'hitProbability.tabParameters' },
    { key: 'simulation', labelKey: 'hitProbability.tabSimulation' }
  ];
  const tabButtons = tabs.map((tab) => {
    const btn = el('button', { type: 'button', class: 'tab-btn' + (tab.key === 'parameters' ? ' active' : ''), i18n: tab.labelKey });
    btn.addEventListener('click', () => {
      for (const b of tabButtons) b.className = 'tab-btn';
      btn.className = 'tab-btn active';
      for (const key of Object.keys(panels)) panels[key].style.display = key === tab.key ? '' : 'none';
    });
    return btn;
  });
  const tabBar = el('div', { class: 'section-tabs' }, tabButtons);

  // ---- Output ----
  const totalProbabilityValue = el('div', { class: 'result-number' }, ['—']);
  const totalProbabilityCard = el('div', { class: 'card', style: 'text-align:center;' }, [
    el('div', { class: 'status', i18n: 'hitProbability.totalProbabilityLabel' }),
    totalProbabilityValue
  ]);

  // A per-zone-breakdown + contribution-table pair. Single shot only ever
  // shows one of these ("primary", with the generic headings); Spotter-
  // corrected relabels "primary" to the sighting shot's own heading and
  // reveals a second instance ("secondary") for the corrected shot —
  // rather than building three separate DOM trees, applyScenarioVisibility()
  // just swaps which headings/visibility apply to these same two.
  function buildResultSection() {
    const perZoneHeading = el('h2', {});
    const zoneBars = el('div', { class: 'zone-bars' });
    const scoreOfMaxValue = el('div', { class: 'result-stat' }, [
      el('div', { class: 'value', text: '—' }),
      el('div', { class: 'label', i18n: 'hitProbability.scoreOfMaxLabel' })
    ]);
    const perZoneCard = el('div', { class: 'card' }, [
      perZoneHeading,
      zoneBars,
      el('div', { class: 'result-row', style: 'margin-top:16px;' }, [scoreOfMaxValue])
    ]);

    const contributionHeading = el('h2', {});
    const contributionBody = el('tbody');
    const contributionCard = el('div', { class: 'card' }, [
      contributionHeading,
      el('div', { class: 'scroll-x' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { i18n: 'hitProbability.contribSource' }),
            el('th', { i18n: 'hitProbability.contribHorizontal' }),
            el('th', { i18n: 'hitProbability.contribVertical' }),
            el('th', { i18n: 'hitProbability.contribTotal' })
          ])]),
          contributionBody
        ])
      ])
    ]);

    return { perZoneCard, perZoneHeading, zoneBars, scoreOfMaxValue, contributionCard, contributionHeading, contributionBody };
  }

  const primaryResult = buildResultSection();
  const secondaryResult = buildResultSection();
  secondaryResult.perZoneCard.style.display = 'none';
  secondaryResult.contributionCard.style.display = 'none';

  const illustrationSvgContainer = el('div', { class: 'illustration-svg' });
  const legendConditionsItem = el('div', { class: 'legend-item' }, [el('span', { class: 'legend-swatch legend-swatch-conditions' }), i18nSpan('hitProbability.legendConditionsError')]);
  const legendOwnPrecisionItem = el('div', { class: 'legend-item' }, [el('span', { class: 'legend-swatch legend-swatch-own-precision' }), i18nSpan('hitProbability.legendOwnPrecisionError')]);
  legendConditionsItem.style.display = 'none';
  legendOwnPrecisionItem.style.display = 'none';
  const legend = el('div', { class: 'legend' }, [
    el('div', { class: 'legend-item' }, [el('span', { class: 'legend-swatch legend-swatch-poa' }), i18nSpan('hitProbability.legendPOA')]),
    el('div', { class: 'legend-item' }, [el('span', { class: 'legend-swatch legend-swatch-poi' }), i18nSpan('hitProbability.legendMeanPOI')]),
    el('div', { class: 'legend-item' }, [el('span', { class: 'legend-swatch legend-swatch-ellipse' }), i18nSpan('hitProbability.legendEllipse')]),
    el('div', { class: 'legend-item' }, [el('span', { class: 'legend-swatch legend-swatch-impacts' }), i18nSpan('hitProbability.legendImpacts')]),
    legendConditionsItem,
    legendOwnPrecisionItem
  ]);
  const zoomValueLabel = el('span', { class: 'range-slider-value', text: `${ZOOM_DEFAULT.toFixed(2)}×` });
  const zoomSlider = el('input', {
    type: 'range', id: 'illustrationZoom', min: String(ZOOM_MIN), max: String(ZOOM_MAX), step: String(ZOOM_STEP), value: String(ZOOM_DEFAULT)
  });
  zoomSlider.addEventListener('input', () => {
    manualZoom = parseFloat(zoomSlider.value);
    zoomValueLabel.textContent = `${manualZoom.toFixed(2)}×`;
    applyZoom();
  });
  const zoomRow = el('div', { class: 'field' }, [
    el('label', {}, [i18nSpan('hitProbability.zoomLabel'), zoomValueLabel]),
    zoomSlider
  ]);
  const impactsToScaleCheckbox = el('input', { type: 'checkbox', id: 'impactsToScale' });
  impactsToScaleCheckbox.checked = true;
  impactsToScaleCheckbox.addEventListener('change', () => {
    impactsToScale = impactsToScaleCheckbox.checked;
    applyZoom();
  });
  const impactsToScaleRow = el('label', { class: 'checkbox-field' }, [impactsToScaleCheckbox, i18nSpan('hitProbability.impactsToScaleLabel')]);
  const illustrationCard = el('div', { class: 'card' }, [
    el('div', { class: 'card-header-row' }, [
      el('h2', { i18n: 'hitProbability.illustrationHeading' }),
      downloadButton({ label: t('hitProbability.downloadIllustrationSvg'), onClick: () => exportTargetIllustration() })
    ]),
    zoomRow,
    impactsToScaleRow,
    el('div', { class: 'illustration-wrap' }, [illustrationSvgContainer, legend])
  ]);

  const results = el('div', { class: 'tool-results' }, [
    totalProbabilityCard,
    primaryResult.perZoneCard, secondaryResult.perZoneCard,
    illustrationCard,
    primaryResult.contributionCard, secondaryResult.contributionCard
  ]);

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'hitProbability.title' }),
    el('p', { i18n: 'hitProbability.intro' }),
    el('div', { class: 'tool-layout' }, [
      el('div', {}, [tabBar, parametersPanel, simulationPanel]),
      results
    ])
  ]));

  // ---- Target data / SVG (reloaded whenever the picker changes) ----
  let targetData = null;
  let targetHitProbability = null;
  let overlayGroup = null;
  let illustrationSvgRoot = null;
  let targetLoadGeneration = 0;
  // The 1x-zoom half-extent (in SVG units, square, symmetric around the
  // target's own point of aim) — fits the target's own source SVG exactly
  // and is fixed once per target load; never touched by recompute()/the
  // simulation's dispersion. The manual zoom slider scales this.
  let baseHalfExtent = 0;
  let manualZoom = ZOOM_DEFAULT;
  // Whether sample-impact dots are drawn at their true real-world size
  // (scaling with zoom like everything else) or held at a constant
  // on-screen size as the picture behind them zooms — see applyZoom().
  let impactsToScale = true;
  // The sample-impact <circle> elements from the last renderIllustration()
  // call, so applyZoom() can resize them in place (toggling "Impacts to
  // scale" or moving the slider must never regenerate the random scatter).
  let sampleCircles = [];

  // 1x zoom fits the target's own source SVG exactly, regardless of the
  // simulation's results — half-extent from the point of aim out to
  // whichever native edge is farthest (so an off-center POA, should one
  // ever exist, would still show the whole target), squared off so both
  // axes use the larger of the two, plus a small margin.
  function computeBaseHalfExtent() {
    const { pointOfAim, pxPerMeter } = targetData.resultSvg;
    const nativeW = targetData.widthM * pxPerMeter;
    const nativeH = targetData.heightM * pxPerMeter;
    const halfWidthNeeded = Math.max(pointOfAim.x, nativeW - pointOfAim.x);
    const halfHeightNeeded = Math.max(pointOfAim.y, nativeH - pointOfAim.y);
    return Math.max(halfWidthNeeded, halfHeightNeeded) * (1 + FIT_MARGIN_RATIO);
  }

  function loadCurrentTarget() {
    const id = currentTargetId;
    const generation = ++targetLoadGeneration;
    targetData = null;
    targetHitProbability = null;
    overlayGroup = null;
    illustrationSvgRoot = null;
    baseHalfExtent = 0;
    manualZoom = ZOOM_DEFAULT;
    zoomSlider.value = String(ZOOM_DEFAULT);
    zoomValueLabel.textContent = `${ZOOM_DEFAULT.toFixed(2)}×`;
    impactsToScale = true;
    impactsToScaleCheckbox.checked = true;
    clear(illustrationSvgContainer);
    targetDetailImg.src = targetDetailUrl(id).href;
    clear(targetNameLabel);

    Promise.all([
      loadTarget(id),
      loadTargetFunction(id),
      fetch(targetResultUrl(id)).then((res) => res.text())
    ]).then(([target, hitProbabilityFn, svgText]) => {
      if (disposed || generation !== targetLoadGeneration) return;
      targetData = target;
      targetHitProbability = hitProbabilityFn;
      baseHalfExtent = computeBaseHalfExtent();

      illustrationSvgRoot = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
      illustrationSvgContainer.appendChild(illustrationSvgRoot);
      overlayGroup = svgEl('g', { id: 'overlay' });
      illustrationSvgRoot.appendChild(overlayGroup);

      recompute();
    }).catch(() => {
      if (disposed || generation !== targetLoadGeneration) return;
      // The target library failed to load (offline on first visit, a
      // missing/corrupt asset, ...) — leave the results column showing its
      // placeholder "—" state rather than a silently-stuck loading state.
      applyI18nText(targetNameLabel, 'hitProbability.targetLoadError');
    });
  }

  // Every target's own JSON supplies its translated name (nameKey) and its
  // thumbnail for the picker grid's buttons — fetched once per id up
  // front, same pattern rifleSection() uses for its built-in library
  // options (targets.js caches each fetch per id, so loadCurrentTarget()'s
  // own loadTarget(id) call never re-fetches).
  Promise.all(loadTargetCatalog().map((id) => loadTarget(id)))
    .then((targets) => {
      if (disposed) return;
      clear(targetPickerGrid);
      targetButtons.clear();
      for (const target of targets) {
        const thumb = el('img', { src: targetThumbUrl(target.id).href, alt: '', class: 'target-picker-thumb' });
        const label = i18nSpan(target.nameKey);
        label.className = 'target-picker-label';
        const btn = el('button', { type: 'button', class: 'target-picker-item' }, [thumb, label]);
        btn.addEventListener('click', () => selectTarget(target.id));
        targetButtons.set(target.id, btn);
        targetPickerGrid.appendChild(btn);
      }
      selectTarget(currentTargetId);
    })
    .catch(() => {
      if (disposed) return;
      applyI18nText(targetNameLabel, 'hitProbability.targetLoadError');
    });

  // Sample scatter for the illustration only — not used by the actual
  // probability computation, which is analytical. Genuinely random across
  // renders (the seed just keeps advancing across calls): recomputing
  // with the same inputs redraws a different scatter each time, not a
  // repeated pattern.
  let sampleSeed = 12345;
  function sampleRand() {
    sampleSeed = (sampleSeed * 1103515245 + 12345) & 0x7fffffff;
    return sampleSeed / 0x7fffffff;
  }
  function sampleGaussian() {
    return Math.sqrt(-2 * Math.log(sampleRand() || 1e-9)) * Math.cos(2 * Math.PI * sampleRand());
  }

  // Draws one 95% ellipse (sdX/sdY at offsetX/offsetY from point of aim)
  // in the given color; returns the ellipse's own center in SVG units, for
  // drawImpactsAndMarker() to reuse.
  function drawEllipse(pointOfAim, pxPerCm, sdX, sdY, offsetX, offsetY, color) {
    const cx = pointOfAim.x + offsetX * pxPerCm;
    const cy = pointOfAim.y - offsetY * pxPerCm; // SVG y grows downward, drop is stored as "up positive"
    overlayGroup.appendChild(svgEl('ellipse', {
      cx: cx.toFixed(1), cy: cy.toFixed(1),
      rx: (sdX * ELLIPSE_95_FACTOR * pxPerCm).toFixed(1), ry: (sdY * ELLIPSE_95_FACTOR * pxPerCm).toFixed(1),
      fill: 'none', stroke: color, 'stroke-width': '1.6', 'stroke-dasharray': '5 4'
    }));
    return { cx, cy };
  }

  // The sample-dot scatter plus the mean-POI marker, both always drawn at
  // the same true sampleImpactColor regardless of scenario.
  function drawImpactsAndMarker(pxPerCm, sdX, sdY, cx, cy, sampleImpactColor, analysisColor) {
    for (let i = 0; i < SAMPLE_IMPACT_COUNT; i++) {
      const x = cx + sampleGaussian() * sdX * pxPerCm;
      const y = cy + sampleGaussian() * sdY * pxPerCm;
      const circle = svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), fill: sampleImpactColor, opacity: '0.75' });
      overlayGroup.appendChild(circle);
      sampleCircles.push(circle);
    }
    overlayGroup.appendChild(svgEl('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: '4', fill: 'none', stroke: analysisColor, 'stroke-width': '2' }));
  }

  function renderIllustration(scenarioResult) {
    if (!targetData || !overlayGroup || !illustrationSvgRoot) return;
    clear(overlayGroup);
    sampleCircles = [];
    const { pointOfAim, pxPerMeter } = targetData.resultSvg;
    const pxPerCm = pxPerMeter / 100;

    // Read fresh every render rather than once at module load — see
    // cssVar()'s own comment above.
    const textColor = cssVar('--text');
    const analysisColor = cssVar('--analysis');
    const sampleImpactColor = cssVar('--accent');
    const conditionsErrorColor = cssVar('--conditions-error');
    const ownPrecisionErrorColor = cssVar('--own-precision-error');

    overlayGroup.appendChild(svgEl('line', { x1: pointOfAim.x - 14, y1: pointOfAim.y, x2: pointOfAim.x + 14, y2: pointOfAim.y, stroke: textColor, 'stroke-width': '2' }));
    overlayGroup.appendChild(svgEl('line', { x1: pointOfAim.x, y1: pointOfAim.y - 14, x2: pointOfAim.x, y2: pointOfAim.y + 14, stroke: textColor, 'stroke-width': '2' }));

    if (currentScenario === 'spotterCorrected') {
      const { sighting, corrected } = scenarioResult;
      // Conditions-error and own-precision-error ellipses isolate the two
      // halves of the sighting shot's combined dispersion — both centered
      // on point of aim (their own contribution to the systematic offset
      // is, by construction, unknown-direction noise, so its expectation
      // is zero), outline only, no sample dots.
      drawEllipse(pointOfAim, pxPerCm, sighting.conditionSdX, sighting.conditionSdY, 0, 0, conditionsErrorColor);
      drawEllipse(pointOfAim, pxPerCm, sighting.ownSdX, sighting.ownSdY, 0, 0, ownPrecisionErrorColor);
      // The corrected shot's own ellipse + sample impacts — same
      // presentation as Single Shot's.
      const { cx, cy } = drawEllipse(pointOfAim, pxPerCm, corrected.sdX, corrected.sdY, corrected.offsetX, corrected.offsetY, sampleImpactColor);
      drawImpactsAndMarker(pxPerCm, corrected.sdX, corrected.sdY, cx, cy, sampleImpactColor, analysisColor);
    } else {
      const { cx, cy } = drawEllipse(pointOfAim, pxPerCm, scenarioResult.sdX, scenarioResult.sdY, scenarioResult.offsetX, scenarioResult.offsetY, sampleImpactColor);
      drawImpactsAndMarker(pxPerCm, scenarioResult.sdX, scenarioResult.sdY, cx, cy, sampleImpactColor, analysisColor);
    }

    applyZoom();
  }

  // Applies the current manual zoom to the fixed 1x-fit extent and writes
  // the resulting (always square) viewBox — centered on the target's own
  // point of aim (its "zero"), regardless of zoom level, so zooming in/out
  // never shifts what the image is centered on. Also resizes the sample
  // dots in place: with "Impacts to scale" on, they're drawn at their true
  // real-world diameter and so naturally grow/shrink with the viewBox like
  // everything else; with it off, their SVG-unit size is divided by the
  // current zoom so their *on-screen* size stays constant, matching
  // whatever it was at 1x. Called after every renderIllustration() and
  // directly from the zoom slider / "Impacts to scale" checkbox, neither
  // of which should ever redraw the random sample scatter itself.
  function applyZoom() {
    if (!targetData || !illustrationSvgRoot) return;
    const { pointOfAim } = targetData.resultSvg;
    const halfExtent = baseHalfExtent / manualZoom;
    illustrationSvgRoot.setAttribute(
      'viewBox',
      `${(pointOfAim.x - halfExtent).toFixed(1)} ${(pointOfAim.y - halfExtent).toFixed(1)} ${(halfExtent * 2).toFixed(1)} ${(halfExtent * 2).toFixed(1)}`
    );

    const dotDiameter = impactsToScale ? SAMPLE_IMPACT_DIAMETER_MM : SAMPLE_IMPACT_DIAMETER_MM / manualZoom;
    const dotRadius = (dotDiameter / 2).toFixed(2);
    for (const circle of sampleCircles) circle.setAttribute('r', dotRadius);
  }

  // Exports the currently-shown illustration standalone, preserving the
  // target's real-world scale: the live <svg>'s own viewBox and sample
  // dots already show exactly the current zoom/"Impacts to scale" state
  // (applyZoom() keeps both current — see there), so cloning it as-is
  // carries that over unchanged, dot-size ratio included when "Impacts to
  // scale" is off. The only thing this adds is explicit width/height in
  // millimeters (derived from the target's pxPerMeter, its only
  // real-world scale reference), so the target itself always renders at
  // the same physical size in any two exports of it, whatever zoom level
  // each was taken at.
  function exportTargetIllustration() {
    const original = illustrationSvgContainer.querySelector('svg');
    if (!original || !targetData) return;
    const viewBox = original.getAttribute('viewBox');
    if (!viewBox) return;
    const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number);
    const mmPerUnit = 1000 / targetData.resultSvg.pxPerMeter;

    const svg = original.cloneNode(true);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', `${(vbWidth * mmPerUnit).toFixed(2)}mm`);
    svg.setAttribute('height', `${(vbHeight * mmPerUnit).toFixed(2)}mm`);

    const xml = new XMLSerializer().serializeToString(svg);
    downloadFile('hit-probability.svg', `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${xml}`, 'image/svg+xml;charset=utf-8');
  }

  const CONTRIB_KEY_MAP = {
    muzzleVelocity: 'hitProbability.contribMuzzleVelocity', benchPrecision: 'hitProbability.contribBenchPrecision',
    shooterSkill: 'hitProbability.contribShooterSkill', combinedPrecision: 'hitProbability.contribCombinedPrecision',
    distanceEstimation: 'hitProbability.contribDistanceEstimation', temperatureEstimation: 'hitProbability.contribTemperatureEstimation',
    pressureEstimation: 'hitProbability.contribPressureEstimation', windEstimation: 'hitProbability.contribWindEstimation',
    movingTarget: 'hitProbability.contribMovingTarget', spotterEye: 'hitProbability.contribSpotterEye'
  };

  // Fills one result section (primaryResult or secondaryResult — see
  // buildResultSection()) with a given shot's own zones/contributions.
  function renderZones(section, zones, contributions) {
    clear(section.zoneBars);
    const total = zones.reduce((sum, z) => sum + z.probability, 0);
    const rows = [...zones, { zoneId: '__miss', probability: Math.max(0, 1 - total) }];
    for (const zone of rows) {
      const pct = zone.probability * 100;
      const zoneDef = targetData ? targetData.zones.find((zd) => zd.id === zone.zoneId) : null;
      const nameKey = zone.zoneId === '__miss' ? 'hitProbability.zoneMiss' : (zoneDef ? zoneDef.nameKey : zone.zoneId);
      section.zoneBars.appendChild(el('div', { class: 'zone-bar-row' }, [
        el('span', { i18n: nameKey }),
        el('div', { class: 'zone-bar-track' }, [el('div', { class: 'zone-bar-fill' + (zone.zoneId === '__miss' ? ' miss' : ''), style: `width:${pct.toFixed(1)}%` })]),
        el('span', { text: `${pct.toFixed(1)}%` })
      ]));
    }

    const bestScore = targetData ? Math.max(...targetData.zones.map((z) => z.score)) : 0;
    const expectedScore = zones.reduce((sum, z) => {
      const zoneDef = targetData.zones.find((zd) => zd.id === z.zoneId);
      return sum + (zoneDef ? zoneDef.score * z.probability : 0);
    }, 0);
    const scoreOfMax = bestScore > 0 ? (expectedScore / bestScore) * 100 : 0;
    section.scoreOfMaxValue.querySelector('.value').textContent = `${scoreOfMax.toFixed(1)}%`;

    clear(section.contributionBody);
    const varX = contributions.reduce((s, c) => s + c.x * c.x, 0) || 1;
    const varY = contributions.reduce((s, c) => s + c.y * c.y, 0) || 1;
    const aspect = targetData ? targetData.aspectRatio : 1;
    for (const c of contributions) {
      const hPct = (c.x * c.x / varX) * 100;
      const vPct = (c.y * c.y / varY) * 100;
      // The spec calls for a "total" contribution "estimated from total
      // (simply by factoring in the target's aspect ratio)" without a
      // precise formula. This is a first-pass interpretation (an
      // aspect-weighted blend of the two per-axis percentages) — not yet
      // confirmed, flag for review.
      const totalPct = (hPct + vPct * aspect) / (1 + aspect);
      section.contributionBody.appendChild(el('tr', {}, [
        el('td', { i18n: CONTRIB_KEY_MAP[c.id] || c.id }),
        el('td', { text: c.x > 0 ? `${hPct.toFixed(0)}%` : '—' }),
        el('td', { text: c.y > 0 ? `${vPct.toFixed(0)}%` : '—' }),
        el('td', { text: `${totalPct.toFixed(0)}%` })
      ]));
    }
  }

  function recompute() {
    if (!targetHitProbability || !targetData) return;

    const nominalState = {
      ...cartridge.getValues(),
      ...rifle.getValues(),
      ...atmosphere.getValues(),
      // Spin drift deliberately excluded here (calculateSpinDrift left
      // unset, so resolveSpinDrift() in spin-drift.js always resolves to
      // null) — Hit Probability's own dispersion model doesn't factor it
      // in, regardless of the Settings toggle.
      windSpeed: 0, windAngle: 90
    };

    const ownErrors = {
      muzzleVelocitySD: muzzleVelocitySDField.getEngineValue(),
      precisionMode: simplifiedToggle.checked ? 'simplified' : 'detailed',
      detailed: {
        benchR50: benchPrecisionField.getEngineValue(),
        shooterR50: shooterSkillField.getEngineValue(),
        positionH: POSITIONS.find((p) => p.key === positionSelect.value).h,
        positionV: POSITIONS.find((p) => p.key === positionSelect.value).v
      },
      simplified: {
        value: combinedPrecisionField.getEngineValue(),
        convention: conventionSelect.value
      }
    };

    const conditionErrors = {
      distanceMedianErrorPct: distanceMedianErrorField.getEngineValue(),
      tempMedianErrorC: tempMedianErrorField.getEngineValue(),
      pressureMedianErrorHpa: pressureMedianErrorField.getEngineValue(),
      windMedianErrorMs: windMedianErrorField.getEngineValue(),
      movingTarget: movingTargetToggle.checked
        ? { speedMs: movingTargetSpeedField.getEngineValue(), speedMedianErrorPct: movingTargetSpeedErrorField.getEngineValue() }
        : { speedMs: 0, speedMedianErrorPct: 0 }
    };

    const targetRange = targetRangeField.getEngineValue();
    const battleZeroRange = battleZeroToggle.checked ? battleZeroField.getEngineValue() : null;
    const aimOffsetXCm = aimOffsetXField.getEngineValue();
    const aimOffsetYCm = aimOffsetYField.getEngineValue();

    if (currentScenario === 'spotterCorrected') {
      let result;
      try {
        result = computeSpotterCorrected({
          nominalState, targetRange, battleZeroRange, aimOffsetXCm, aimOffsetYCm,
          ownErrors, conditionErrors,
          sightingShotCount: sightingShotCountField.getEngineValue(),
          spotterMeasureMrad: spotterMeasureField.getEngineValue()
        });
      } catch {
        return; // leave the last good state showing, same posture as trajectory-view.js
      }

      const sightingZones = targetHitProbability(result.sighting.sdX, result.sighting.sdY, result.sighting.offsetX, result.sighting.offsetY);
      const correctedZones = targetHitProbability(result.corrected.sdX, result.corrected.sdY, result.corrected.offsetX, result.corrected.offsetY);
      const sightingTotal = sightingZones.reduce((sum, z) => sum + z.probability, 0);
      const correctedTotal = correctedZones.reduce((sum, z) => sum + z.probability, 0);
      // At least one hit across all N sighting shots + the corrected shot,
      // treating each sighting shot as an independent draw from the same
      // distribution.
      const combinedTotal = 1 - (1 - sightingTotal) ** result.sightingShotCount * (1 - correctedTotal);

      setTotalProbability(combinedTotal);
      renderZones(primaryResult, sightingZones, result.sighting.contributions);
      renderZones(secondaryResult, correctedZones, result.corrected.contributions);
      renderIllustration(result);
    } else {
      let result;
      try {
        result = computeSingleShot({
          nominalState, targetRange, battleZeroRange, aimOffsetXCm, aimOffsetYCm,
          ownErrors, conditionErrors
        });
      } catch {
        return; // leave the last good state showing, same posture as trajectory-view.js
      }

      const zones = targetHitProbability(result.sdX, result.sdY, result.offsetX, result.offsetY);
      const total = zones.reduce((sum, z) => sum + z.probability, 0);

      setTotalProbability(total);
      renderZones(primaryResult, zones, result.contributions);
      renderIllustration(result);
    }
  }

  function setTotalProbability(total) {
    clear(totalProbabilityValue);
    totalProbabilityValue.appendChild(document.createTextNode(`${(total * 100).toFixed(1)}%`));
  }

  // Toggles every scenario-specific input and output between what Single
  // Shot and Spotter-corrected each need — called once at mount and again
  // on every scenario change.
  function applyScenarioVisibility() {
    const isSpotter = currentScenario === 'spotterCorrected';
    sightingShotCountField.node.style.display = isSpotter ? '' : 'none';
    spotterMeasureField.node.style.display = isSpotter ? '' : 'none';
    applyI18nText(primaryResult.perZoneHeading, isSpotter ? 'hitProbability.perZoneHeadingSighting' : 'hitProbability.perZoneHeading');
    applyI18nText(primaryResult.contributionHeading, isSpotter ? 'hitProbability.contributionHeadingSighting' : 'hitProbability.contributionHeading');
    secondaryResult.perZoneCard.style.display = isSpotter ? '' : 'none';
    secondaryResult.contributionCard.style.display = isSpotter ? '' : 'none';
    if (isSpotter) {
      applyI18nText(secondaryResult.perZoneHeading, 'hitProbability.perZoneHeadingCorrected');
      applyI18nText(secondaryResult.contributionHeading, 'hitProbability.contributionHeadingCorrected');
    }
    legendConditionsItem.style.display = isSpotter ? '' : 'none';
    legendOwnPrecisionItem.style.display = isSpotter ? '' : 'none';
  }
  applyScenarioVisibility();

  return () => {
    disposed = true;
  };
}

// Test-only: resets the Uncertainty/Simulation panel state back to
// "nothing saved yet", the same purpose resetShotStateForTests() serves
// for shot-state.js — tests that mount() this view multiple times in one
// process need a clean slate between cases.
export function resetHitProbabilityStateForTests() {
  panelState = {};
}
