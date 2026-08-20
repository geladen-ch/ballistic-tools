// Range Solver — a field/mobile-first tool: given the active rifle+bullet
// (shared with Trajectory/Hit Probability via shot-state.js, changed only
// through Guns), a target range/angle, wind, and atmosphere, solves the
// elevation/windage click correction for that one shot. No table, no
// uncertainty analysis — just the dial numbers, big enough to read in
// direct sunlight. Deliberately no <h1>/intro header here (unlike every
// other tool view): every pixel of a small, outdoor screen counts, and
// the section's own nav bar (see range-solver-nav.js/nav-rail.js/
// nav-tabbar.js) already signals context.
//
// Auto-recomputes on every input change, same posture as Trajectory/Hit
// Probability — there's no Calculate button.
import { el, clear } from '../dom.js';
import { unitField } from '../ui/unit-field.js';
import { windDirectionDial } from '../ui/wind-direction-dial.js';
import { largeStepperField } from '../ui/large-stepper-field.js';
import { rifleSection } from '../ui/sections/rifle-section.js';
import { cartridgeSection } from '../ui/sections/cartridge-section.js';
import { gunsSummary } from '../ui/sections/guns-summary.js';
import { atmosphereSection } from '../ui/sections/atmosphere-section.js';
import { t, i18nSpan } from '../i18n.js';
import { computeImpact } from '../engine/trajectory.js';
import { clicksForOffset, engineToDisplay, unitChoice, UNIT_GROUPS } from '../units.js';
import { getUnit } from '../prefs.js';
import { setRangeSolverMode, getRangeSolverTab, onRangeSolverTabChange } from '../range-solver-nav.js';
import { getIndicatorStyle } from '../range-solver-prefs.js';
import { directionArrow } from '../ui/direction-arrow.js';
import { isSpinDriftEnabled } from '../spin-drift-prefs.js';
import { isZeroForSpinDriftEnabled } from '../zero-spin-drift-prefs.js';
import {
  loadRangeSolverTargetState, saveRangeSolverTargetState,
  loadRangeSolverWindState, saveRangeSolverWindState,
  loadRangeSolverAtmosphereState, saveRangeSolverAtmosphereState
} from '../range-solver-state.js';

const DEFAULT_TARGET_RANGE_M = 400;
const DEFAULT_LOS_ANGLE_DEG = 0;
const DEFAULT_WIND_ANGLE_DEG = 90;
const DEFAULT_WIND_SPEED_MS = 0;

// Matches range-solver-prefs.js's own INDICATOR_STYLE_CHOICES values.
const INDICATOR_GLYPHS = {
  arrows: { elevationPositive: '↑', elevationNegative: '↓', windagePositive: '→', windageNegative: '←' },
  signs: { elevationPositive: '+', elevationNegative: '−', windagePositive: '+', windageNegative: '−' }
};

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return null;
  try {
    return await navigator.wakeLock.request('screen');
  } catch {
    // best-effort — low battery, backgrounded, or unsupported; not fatal
    return null;
  }
}

export function mount(container) {
  clear(container);
  let disposed = false;
  setRangeSolverMode(true);
  // Read once at mount (same "cookie read at mount time" convention every
  // other view-scoped preference in this app uses — e.g. wind-direction-
  // dial.js's own skin) — Settings lives on a different route, so this
  // can't change out from under an already-mounted Range Solver.
  const indicatorGlyphs = INDICATOR_GLYPHS[getIndicatorStyle()];

  // ---- Rifle & Bullet (shared active gun configuration — never rendered
  // here, just read for their engine values; see guns-summary.js for the
  // visible stand-in and guns-view.js for where it's actually edited) ----
  const rifle = rifleSection({ onInput: () => recompute(), onLibraryCartridgeChange: (c) => cartridge.setLibraryCartridge(c) });
  const cartridge = cartridgeSection({ onInput: () => recompute() });
  const guns = gunsSummary();

  // ---- Target tab ----
  const targetSaved = loadRangeSolverTargetState() || {};
  function saveTarget() {
    saveRangeSolverTargetState({ rangeM: targetRangeField.getEngineValue(), losAngleDeg: losAngleField.getEngineValue() });
  }
  const targetRangeField = largeStepperField({
    id: 'targetRange', min: 10, max: 3000, step: 10,
    value: targetSaved.rangeM ?? DEFAULT_TARGET_RANGE_M,
    onInput: () => { saveTarget(); recompute(); }
  });
  const losAngleField = unitField({
    id: 'losAngle', min: -90, max: 90, step: 1,
    value: targetSaved.losAngleDeg ?? DEFAULT_LOS_ANGLE_DEG,
    onInput: () => { saveTarget(); recompute(); }
  });
  const targetTab = el('div', { class: 'input-section range-solver-tab-panel' }, [
    targetRangeField.node,
    losAngleField.node
  ]);

  // ---- Wind tab ----
  const windSaved = loadRangeSolverWindState() || {};
  function saveWind() {
    saveRangeSolverWindState({ speed: windSpeedField.getEngineValue(), angle: windAngleDial.getValue() });
  }
  const windAngleDial = windDirectionDial({
    id: 'windAngle', value: windSaved.angle ?? DEFAULT_WIND_ANGLE_DEG,
    onInput: () => { saveWind(); recompute(); }
  });
  const windSpeedField = largeStepperField({
    id: 'windSpeed', min: 0, max: 30, step: 0.5,
    value: windSaved.speed ?? DEFAULT_WIND_SPEED_MS,
    onInput: () => { saveWind(); recompute(); }
  });
  // range-solver-wind-tab (in addition to the two classes every tab panel
  // shares) is what layout.css's mobile-only wind-dial-fit-to-screen rules
  // key off, so they can size just this panel without also touching the
  // Target/Atmosphere ones.
  const windTab = el('div', { class: 'input-section range-solver-tab-panel range-solver-wind-tab' }, [
    windAngleDial.node,
    windSpeedField.node
  ]);

  // ---- Atmosphere tab — own cookie-backed state (range-solver-state.js),
  // deliberately not shot-state.js's shared session-only one (see
  // atmosphere-section.js's own load/save override). ----
  const atmosphere = atmosphereSection({
    includeWind: false, onInput: () => recompute(),
    load: loadRangeSolverAtmosphereState, save: saveRangeSolverAtmosphereState
  });
  const atmosphereTab = el('div', { class: 'range-solver-tab-panel' }, [atmosphere.node]);

  // Which of the three shows is driven by the section nav bar (see
  // range-solver-nav.js), not local tab buttons — nav-rail.js/nav-
  // tabbar.js's own Target/Wind/Atmosphere items call setRangeSolverTab().
  const tabPanels = { target: targetTab, wind: windTab, atmosphere: atmosphereTab };
  function applyActiveTab() {
    const active = getRangeSolverTab();
    for (const key of Object.keys(tabPanels)) tabPanels[key].style.display = key === active ? '' : 'none';
  }
  applyActiveTab();
  const unsubscribeTab = onRangeSolverTabChange(applyActiveTab);

  const inputPane = el('div', { class: 'range-solver-input-pane' }, [targetTab, windTab, atmosphereTab]);

  // ---- Output pane ----
  // A quiet, label-free readout of the current shot conditions — target
  // range, LoS angle (only when non-zero — a flat shot omits it entirely
  // rather than showing a redundant "0°"), wind speed and direction,
  // station pressure, temperature and humidity — each value carrying its
  // own unit symbol as its only identification. Same "small and
  // non-intrusive" visual weight as the ToF/velocity/energy footer below,
  // but even quieter (no labels), since this is context for the dialed
  // numbers, not a result in its own right.
  const conditionsBar = el('div', { class: 'range-solver-conditions' });
  const elevationValue = el('div', { class: 'range-solver-click-value' }, ['—']);
  const windageValue = el('div', { class: 'range-solver-click-value' }, ['—']);
  const readout = el('div', { class: 'range-solver-readout' }, [
    el('div', { class: 'range-solver-stat range-solver-elevation' }, [
      elevationValue,
      el('div', { class: 'range-solver-click-label' }, [i18nSpan('rangeSolver.elevationLabel')])
    ]),
    el('div', { class: 'range-solver-stat range-solver-windage' }, [
      windageValue,
      el('div', { class: 'range-solver-click-label' }, [i18nSpan('rangeSolver.windageLabel')])
    ])
  ]);

  const tofValue = el('span', { class: 'range-solver-footer-value' }, ['—']);
  const velocityValue = el('span', { class: 'range-solver-footer-value' }, ['—']);
  const energyValue = el('span', { class: 'range-solver-footer-value' }, ['—']);
  const footer = el('div', { class: 'range-solver-footer' }, [
    el('div', { class: 'range-solver-footer-stat' }, [i18nSpan('rangeSolver.tofLabel'), tofValue]),
    el('div', { class: 'range-solver-footer-stat' }, [i18nSpan('rangeSolver.velocityLabel'), velocityValue]),
    el('div', { class: 'range-solver-footer-stat' }, [i18nSpan('rangeSolver.energyLabel'), energyValue])
  ]);

  const outputPane = el('div', { class: 'range-solver-output-pane' }, [guns.node, conditionsBar, readout, footer]);

  container.appendChild(el('div', { class: 'range-solver-layout' }, [outputPane, inputPane]));

  // Whole clicks (what's actually dialed), sign shown as a direction glyph
  // (leading, not trailing — read the direction first) rather than +/- —
  // 0 clicks shows plain, no glyph. Elevation matches trajectory-
  // columns.js's own elevClicks sign (dropped below the sight line reads
  // as a positive "dial up" correction). Windage keeps trajectory-
  // columns.js's own windClicks sign as-is (not inverted) — there's no
  // established real-world left/right mapping for it anywhere else in the
  // app to defer to, so positive is defined here as "dial right," negative
  // as "dial left," consistent with itself and with the Trajectory
  // table's own raw sign for the same shot. Which glyphs (arrows vs +/-)
  // is a Settings preference — see indicatorGlyphs above.
  function renderClicks(node, clicks, positiveGlyph, negativeGlyph) {
    clear(node);
    if (clicks === 0) {
      node.appendChild(document.createTextNode('0'));
      return;
    }
    const glyph = clicks > 0 ? positiveGlyph : negativeGlyph;
    node.appendChild(el('span', { class: 'range-solver-click-glyph' }, [glyph]));
    node.appendChild(document.createTextNode(String(Math.abs(clicks))));
  }

  // Shown whenever an input is mid-edit (e.g. the range field momentarily
  // empty while retyping it) or otherwise produces a non-finite result —
  // "—" everywhere rather than a stray "NaN" reaching the screen.
  function showPlaceholder() {
    clear(elevationValue);
    elevationValue.appendChild(document.createTextNode('—'));
    clear(windageValue);
    windageValue.appendChild(document.createTextNode('—'));
    tofValue.textContent = '—';
    velocityValue.textContent = '—';
    energyValue.textContent = '—';
  }

  // The number itself is the reading; the unit is just how to read it — so
  // it gets its own brighter span, same "value stands out, its context
  // doesn't" split the footer below already uses for ToF/velocity/energy.
  function numberWithUnit(numberStr, unitText) {
    return [el('span', { class: 'range-solver-conditions-num' }, [numberStr]), document.createTextNode(unitText)];
  }

  // `fieldId`/`groupName` follow the same FIELD_UNITS/getUnit() convention
  // every other display value in this app uses — including the same
  // stale-preference fallback unitField()/largeStepperField() apply.
  function formatWithUnit(fieldId, groupName, engineValue) {
    const group = UNIT_GROUPS[groupName];
    const displayUnit = getUnit(groupName);
    const choice = unitChoice(fieldId, displayUnit) || group.choices.find((c) => c.unit === group.defaultUnit);
    const numberStr = engineToDisplay(fieldId, engineValue, choice.unit).toFixed(choice.decimals);
    return numberWithUnit(numberStr, ` ${choice.label}`);
  }

  function updateConditions() {
    clear(conditionsBar);
    const rangeM = targetRangeField.getEngineValue();
    const losDeg = losAngleField.getEngineValue();
    const windSpeedMs = windSpeedField.getEngineValue();
    const windDeg = windAngleDial.getValue();
    const { pressureHpa, tempC, humidityPct } = atmosphere.getValues();

    const parts = [];
    if (Number.isFinite(rangeM)) parts.push(formatWithUnit('targetRange', 'distance', rangeM));
    if (Number.isFinite(losDeg) && losDeg !== 0) parts.push(numberWithUnit(losDeg.toFixed(0), '°'));
    // Speed and direction share one ungapped group (an arrow, not a
    // degree number — see direction-arrow.js) rather than being two
    // separately-spaced items, so they read as one wind reading.
    const windParts = [];
    if (Number.isFinite(windSpeedMs)) windParts.push(...formatWithUnit('windSpeed', 'velocity', windSpeedMs));
    if (Number.isFinite(windDeg)) windParts.push(directionArrow(windDeg));
    if (windParts.length) parts.push(el('span', { class: 'range-solver-conditions-wind' }, windParts));
    if (Number.isFinite(pressureHpa)) parts.push(formatWithUnit('pressureHpa', 'pressure', pressureHpa));
    if (Number.isFinite(tempC)) parts.push(formatWithUnit('tempC', 'temperature', tempC));
    if (Number.isFinite(humidityPct)) parts.push(numberWithUnit(String(Math.round(humidityPct)), '%'));

    parts.forEach((part, i) => {
      if (i > 0) conditionsBar.appendChild(el('span', { class: 'range-solver-conditions-sep' }, ['·']));
      conditionsBar.appendChild(Array.isArray(part) ? el('span', {}, part) : part);
    });
  }

  function recompute() {
    updateConditions();
    const nominalState = {
      ...cartridge.getValues(),
      ...rifle.getValues(),
      ...atmosphere.getValues(),
      ...cartridge.getStabilityValues(),
      ...rifle.getStabilityValues(),
      calculateSpinDrift: isSpinDriftEnabled(),
      zeroForSpinDrift: isZeroForSpinDriftEnabled(),
      windSpeed: windSpeedField.getEngineValue(),
      windAngle: windAngleDial.getValue(),
      losAngleDeg: losAngleField.getEngineValue()
    };
    const targetRangeM = targetRangeField.getEngineValue();

    let result;
    try {
      result = computeImpact(nominalState, targetRangeM);
    } catch {
      showPlaceholder();
      return;
    }
    if (![result.dropCm, result.windageCm, result.velocity, result.tof].every(Number.isFinite)) {
      showPlaceholder();
      return;
    }

    const clickSettings = rifle.getClickSettings();
    const elevClicks = Math.round(-clicksForOffset(result.dropCm, clickSettings.vertical, clickSettings.unit, targetRangeM));
    const windClicks = Math.round(clicksForOffset(result.windageCm, clickSettings.horizontal, clickSettings.unit, targetRangeM));

    const velocityUnit = getUnit('velocity');
    const velocityChoice = unitChoice('muzzleVelocity', velocityUnit);
    const displayVelocity = engineToDisplay('muzzleVelocity', result.velocity, velocityUnit);

    const massKg = cartridge.getValues().massKg;
    const energyJ = 0.5 * massKg * result.velocity * result.velocity;
    const energyUnit = getUnit('energy');
    const energyChoice = unitChoice('energy', energyUnit);
    const displayEnergy = engineToDisplay('energy', energyJ, energyUnit);

    if (![elevClicks, windClicks, displayVelocity, displayEnergy].every(Number.isFinite)) {
      showPlaceholder();
      return;
    }

    renderClicks(elevationValue, elevClicks, indicatorGlyphs.elevationPositive, indicatorGlyphs.elevationNegative);
    renderClicks(windageValue, windClicks, indicatorGlyphs.windagePositive, indicatorGlyphs.windageNegative);
    tofValue.textContent = `${result.tof.toFixed(2)} ${t('rangeSolver.secondsUnit')}`;
    velocityValue.textContent = `${displayVelocity.toFixed(0)} ${velocityChoice.label}`;
    energyValue.textContent = `${displayEnergy.toFixed(0)} ${energyChoice.label}`;
  }

  recompute();

  let wakeLockSentinel = null;
  requestWakeLock().then((sentinel) => {
    if (disposed) { sentinel?.release(); return; }
    wakeLockSentinel = sentinel;
  });
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && !wakeLockSentinel) {
      requestWakeLock().then((sentinel) => {
        if (disposed) { sentinel?.release(); return; }
        wakeLockSentinel = sentinel;
      });
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    disposed = true;
    unsubscribeTab();
    setRangeSolverMode(false);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    wakeLockSentinel?.release();
    wakeLockSentinel = null;
  };
}
