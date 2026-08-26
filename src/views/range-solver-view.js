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
import { clicksForOffset, engineToDisplay, displayToEngine, displaySpanToEngine, roundForDisplay, unitChoice, UNIT_GROUPS, FIELD_BOUNDS } from '../units.js';
import { getUnit } from '../prefs.js';
import { setRangeSolverMode, getRangeSolverTab, onRangeSolverTabChange } from '../range-solver-nav.js';
import { getIndicatorStyle } from '../range-solver-prefs.js';
import { directionArrow } from '../ui/direction-arrow.js';
import { isSpinDriftEnabled } from '../spin-drift-prefs.js';
import { isZeroForSpinDriftEnabled } from '../zero-spin-drift-prefs.js';
import {
  loadRangeSolverTargetState, saveRangeSolverTargetState,
  loadRangeSolverWindState, saveRangeSolverWindState,
  loadRangeSolverAtmosphereState, saveRangeSolverAtmosphereState,
  loadRangeSolverLocationState, saveRangeSolverLocationState,
  markAtmosphereTouched
} from '../range-solver-state.js';
import { loadUserLocations, saveUserLocation } from '../location-library.js';
import { locationPickerButton } from '../ui/locations/location-picker-button.js';
import { targetSyncButton } from '../ui/target-sync-button.js';
import { photoPickerButton } from '../ui/photo-picker-button.js';
import { setPendingPlacement } from '../location-placement-nav.js';
import { showDialog } from '../ui/app-dialog.js';

const DEFAULT_LOS_ANGLE_DEG = 0;
const DEFAULT_WIND_ANGLE_DEG = 90;
const DEFAULT_WIND_SPEED_MS = 0;

// One independently-chosen round number per unit — not a conversion of a
// single metric default/step into the others (1500 ft isn't "500 m in
// feet", it's its own sensible round number for someone thinking in feet)
// — so both tables are keyed straight off the unit symbol.
const TARGET_RANGE_DEFAULTS = { m: 500, yd: 500, ft: 1500 };
const TARGET_RANGE_STEPS = { m: 50, yd: 50, ft: 100 };
// km/h has no user-specified round step; falls back to converting the
// same fixed 0.5 m/s step every unit used before this table existed.
const WIND_SPEED_STEPS = { 'm/s': 0.5, mph: 1, 'ft/s': 1 };
const FALLBACK_WIND_SPEED_STEP_MS = 0.5;

// Same stale/unknown-preference fallback largeStepperField() itself
// applies internally — needed here too since these tables are looked up
// before that component ever sees the field.
function currentUnit(group) {
  const unit = getUnit(group);
  return UNIT_GROUPS[group].choices.some((c) => c.unit === unit) ? unit : UNIT_GROUPS[group].defaultUnit;
}

// Matches range-solver-prefs.js's own INDICATOR_STYLE_CHOICES values.
const INDICATOR_GLYPHS = {
  arrows: { elevationPositive: '↑', elevationNegative: '↓', windagePositive: '→', windageNegative: '←' },
  signs: { elevationPositive: '+', elevationNegative: '−', windagePositive: '+', windageNegative: '−' },
  udlr: { elevationPositive: 'U', elevationNegative: 'D', windagePositive: 'R', windageNegative: 'L' }
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
  const distanceUnit = currentUnit('distance');
  const targetRangeField = largeStepperField({
    id: 'targetRange', ...FIELD_BOUNDS.targetRange,
    step: displaySpanToEngine('targetRange', TARGET_RANGE_STEPS[distanceUnit], distanceUnit),
    value: targetSaved.rangeM ?? displayToEngine('targetRange', TARGET_RANGE_DEFAULTS[distanceUnit], distanceUnit),
    decimals: 1,
    onInput: () => { saveTarget(); recompute(); }
  });
  const losAngleField = unitField({
    id: 'losAngle', ...FIELD_BOUNDS.losAngle, step: 1,
    value: targetSaved.losAngleDeg ?? DEFAULT_LOS_ANGLE_DEG,
    onInput: () => { saveTarget(); recompute(); }
  });

  // ---- Locations & Targets library — active location/target picker ----
  // The range/LoS fields above stay the single source of truth for what's
  // actually dialed (still cookie-backed via saveTarget(), exactly as
  // before) — picking a target here just copies its values in as a free
  // edit (see the target select's own listener below); it never becomes
  // a live two-way link, so this widget's whole job is (a) offering that
  // one-time copy and (b) noticing afterward if the fields have since
  // diverged from what's saved.
  const locationSaved = loadRangeSolverLocationState() || {};
  let activeLocation = locationSaved.locationId
    ? loadUserLocations().find((l) => l.id === locationSaved.locationId) || null
    : null;
  // A locationId that no longer resolves (deleted in the Locations
  // manager since) falls back to "no location" here rather than needing
  // any cleanup on the delete side itself.
  if (locationSaved.locationId && !activeLocation) saveRangeSolverLocationState({ locationId: null, targetId: null });
  let activeTargetId = activeLocation ? locationSaved.targetId : null;
  // Same lazy fallback for a targetId that no longer exists within its
  // (still-resolving) location.
  if (activeLocation && activeTargetId != null && !activeLocation.targets.some((tg) => tg.id === activeTargetId)) {
    activeTargetId = null;
    saveRangeSolverLocationState({ targetId: null });
  }

  function resolvedActiveTarget() {
    if (!activeLocation || activeTargetId == null) return null;
    return activeLocation.targets.find((tg) => tg.id === activeTargetId) || null;
  }

  const locationNameEl = el('span', { class: 'range-solver-location-name' });
  const targetSelect = el('select', { id: 'rangeSolverTargetSelect', class: 'range-solver-target-select' });
  const syncButton = targetSyncButton({
    label: t('rangeSolverLocations.syncButtonLabel'),
    onClick: () => {
      const target = resolvedActiveTarget();
      if (!target) return;
      showDialog({
        message: t('rangeSolverLocations.confirmSyncTarget'),
        buttons: [
          {
            label: t('rangeSolverLocations.syncConfirmButton'),
            onClick: () => {
              const updatedTargets = activeLocation.targets.map((tg) => (tg.id === target.id
                ? { ...tg, rangeM: targetRangeField.getEngineValue(), losAngleDeg: losAngleField.getEngineValue() }
                : tg));
              activeLocation = saveUserLocation({ ...activeLocation, targets: updatedTargets });
              updateSyncIndicator();
            }
          },
          { label: t('rangeSolverLocations.cancelButton') }
        ]
      });
    }
  });
  const openLocationsButton = locationPickerButton({
    label: t('rangeSolverLocations.manageButtonLabel'),
    onClick: () => { location.hash = '#/locations'; }
  });
  const openPhotoOverlayButton = photoPickerButton({
    label: t('rangeSolverLocations.photoPickerButtonLabel'),
    onClick: () => {
      if (!activeLocation || !activeLocation.photo) return;
      setPendingPlacement({ locationId: activeLocation.id, targetId: null, returnPath: '/range-solver', selectMode: true });
      location.hash = '#/locations/place';
    }
  });
  const locationRow = el('div', { class: 'range-solver-location-row' }, [
    locationNameEl, openLocationsButton, targetSelect, openPhotoOverlayButton, syncButton
  ]);

  function refreshLocationWidget() {
    const hasLocation = !!activeLocation;
    locationNameEl.style.display = hasLocation ? '' : 'none';
    locationNameEl.textContent = hasLocation ? activeLocation.name : '';
    const hasTargets = hasLocation && activeLocation.targets.length > 0;
    clear(targetSelect);
    targetSelect.style.display = hasTargets ? '' : 'none';
    if (hasTargets) {
      activeLocation.targets.forEach((tg, i) => {
        targetSelect.appendChild(el('option', {
          value: tg.id, text: tg.name || t('rangeSolverLocations.defaultTargetName', { n: i + 1 })
        }));
      });
      targetSelect.value = activeTargetId ?? activeLocation.targets[0].id;
    }
    openPhotoOverlayButton.style.display = hasLocation && activeLocation.photo ? '' : 'none';
  }

  // Shared by the <select> below and the photo overlay's tap-to-select —
  // both drive the exact same selection path, including discarding any
  // hand-edited fields with no confirmation; switching targets is always
  // a fresh copy-in, never a merge.
  function selectTarget(targetId) {
    activeTargetId = targetId;
    saveRangeSolverLocationState({ targetId: activeTargetId });
    targetSelect.value = targetId; // keep the dropdown in sync when picked via the photo instead
    const target = resolvedActiveTarget();
    if (target) {
      targetRangeField.setEngineValue(target.rangeM);
      losAngleField.setEngineValue(target.losAngleDeg);
      saveTarget();
    }
    recompute();
  }
  targetSelect.addEventListener('change', () => selectTarget(targetSelect.value));

  refreshLocationWidget();

  // A saved target's own rangeM run through the exact same
  // engine<->display round-trip targetRangeField itself applies (see
  // unit-field.js/large-stepper-field.js) before comparing — otherwise a
  // target whose stored value has more precision than the display unit
  // shows (e.g. distance in yards) would read as "diverged" the instant
  // it's loaded, from display rounding alone, never having been touched.
  // losAngleDeg has no FIELD_UNITS entry (plain pass-through degrees, see
  // units.js), so it round-trips exactly with no rounding step at all —
  // a raw comparison is already exact.
  function roundTripEngineValue(fieldId, groupName, engineValue) {
    const group = UNIT_GROUPS[groupName];
    const unit = getUnit(groupName);
    const choice = unitChoice(fieldId, unit) || group.choices.find((c) => c.unit === group.defaultUnit);
    const displayValue = roundForDisplay(fieldId, choice.unit, engineToDisplay(fieldId, engineValue, choice.unit));
    return displayToEngine(fieldId, displayValue, choice.unit);
  }

  function updateSyncIndicator() {
    const target = resolvedActiveTarget();
    const diverged = !!target && (
      targetRangeField.getEngineValue() !== roundTripEngineValue('targetRange', 'distance', target.rangeM) ||
      losAngleField.getEngineValue() !== target.losAngleDeg
    );
    syncButton.style.display = diverged ? '' : 'none';
  }

  const targetTab = el('div', { class: 'input-section range-solver-tab-panel' }, [
    locationRow,
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
  const windUnit = currentUnit('windSpeed');
  const windSpeedStepMs = windUnit in WIND_SPEED_STEPS
    ? displaySpanToEngine('windSpeed', WIND_SPEED_STEPS[windUnit], windUnit)
    : FALLBACK_WIND_SPEED_STEP_MS;
  const windSpeedField = largeStepperField({
    id: 'windSpeed', ...FIELD_BOUNDS.windSpeed, step: windSpeedStepMs,
    value: windSaved.speed ?? DEFAULT_WIND_SPEED_MS,
    decimals: 1,
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
    includeWind: false, onInput: () => { markAtmosphereTouched(); recompute(); },
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
    if (Number.isFinite(windSpeedMs)) windParts.push(...formatWithUnit('windSpeed', 'windSpeed', windSpeedMs));
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
    updateSyncIndicator();
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
