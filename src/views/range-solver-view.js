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
import { inlineNumberField } from '../ui/inline-number-field.js';
import { windControl } from '../ui/wind-control.js';
import { losAngleIcon } from '../ui/nav-icons.js';
import { rifleSection } from '../ui/sections/rifle-section.js';
import { cartridgeSection } from '../ui/sections/cartridge-section.js';
import { gunsSummary } from '../ui/sections/guns-summary.js';
import { atmosphereSection } from '../ui/sections/atmosphere-section.js';
import { t, i18nSpan } from '../i18n.js';
import { computeImpact } from '../engine/trajectory.js';
import { clicksForOffset, engineToDisplay, displayToEngine, roundForDisplay, unitChoice, UNIT_GROUPS, FIELD_BOUNDS } from '../units.js';
import { getUnit } from '../prefs.js';
import { setRangeSolverMode, getRangeSolverTab, onRangeSolverTabChange } from '../range-solver-nav.js';
import { getIndicatorStyle } from '../range-solver-prefs.js';
import { getSpinDriftMode } from '../spin-drift-prefs.js';
import { isZeroForSpinDriftEnabled } from '../zero-spin-drift-prefs.js';
import {
  loadRangeSolverTargetState, saveRangeSolverTargetState,
  loadRangeSolverWindState, saveRangeSolverWindState,
  loadRangeSolverAtmosphereState, saveRangeSolverAtmosphereState,
  loadRangeSolverLocationState, saveRangeSolverLocationState,
  markAtmosphereTouched
} from '../range-solver-state.js';
import { loadUserLocations } from '../location-library.js';
import { locationPickerButton } from '../ui/locations/location-picker-button.js';
import { photoPickerButton } from '../ui/photo-picker-button.js';
import { setPendingPlacement } from '../location-placement-nav.js';

const DEFAULT_LOS_ANGLE_DEG = 0;
const DEFAULT_WIND_ANGLE_DEG = 90;
const DEFAULT_WIND_SPEED_MS = 0;
// <select>'s own sentinel for "not tracking any library target" — real
// target ids (location-library.js) are never empty strings, so this can
// never collide with one.
const MANUAL_ENTRY_VALUE = '';

// One independently-chosen round number per unit — not a conversion of a
// single metric default into the others (1500 ft isn't "500 m in feet",
// it's its own sensible round number for someone thinking in feet) — so
// the table is keyed straight off the unit symbol.
const TARGET_RANGE_DEFAULTS = { m: 500, yd: 500, ft: 1500 };
// Wind speed's own unit-aware step/decimals are wind-control.js's own
// concern now (its WIND_SPEED_STEPS table there) — every windControl()
// caller gets the same stepping, not just this one.

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
  const guns = gunsSummary({ bare: true });

  // ---- Target tab ----
  const targetSaved = loadRangeSolverTargetState() || {};
  function saveTarget() {
    saveRangeSolverTargetState({ rangeM: targetRangeField.getEngineValue(), losAngleDeg: losAngleField.getEngineValue() });
  }
  const distanceUnit = currentUnit('distance');
  const targetRangeField = inlineNumberField({
    id: 'targetRange', ...FIELD_BOUNDS.targetRange,
    value: targetSaved.rangeM ?? displayToEngine('targetRange', TARGET_RANGE_DEFAULTS[distanceUnit], distanceUnit),
    decimals: 1,
    adornment: unitChoice('targetRange', distanceUnit).label,
    ariaLabel: t('fields.targetRange'),
    onInput: () => { saveTarget(); recompute(); }
  });
  const losAngleField = inlineNumberField({
    id: 'losAngle', ...FIELD_BOUNDS.losAngle, decimals: 0,
    value: targetSaved.losAngleDeg ?? DEFAULT_LOS_ANGLE_DEG,
    adornment: losAngleIcon(),
    ariaLabel: t('fields.losAngle'),
    onInput: () => { saveTarget(); recompute(); }
  });

  // ---- Locations & Targets library — active location/target picker ----
  // The range/LoS fields above stay the single source of truth for what's
  // actually dialed (still cookie-backed via saveTarget(), exactly as
  // before) — picking a target here just copies its values in as a free
  // edit (see the target select's own listener below); it never becomes a
  // live two-way link, and there's no path back up to the library either
  // — so this widget's whole job is (a) offering that one-time copy and
  // (b) detaching back to "Manual entry" the moment a hand-edit makes the
  // fields diverge from what's saved (detachIfHandEdited() below), rather
  // than leaving a stale target selected next to values it no longer
  // describes.
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
    locationNameEl, openLocationsButton, targetSelect, openPhotoOverlayButton
  ]);

  function refreshLocationWidget() {
    const hasLocation = !!activeLocation;
    locationNameEl.style.display = hasLocation ? '' : 'none';
    locationNameEl.textContent = hasLocation ? activeLocation.name : '';
    const hasTargets = hasLocation && activeLocation.targets.length > 0;
    clear(targetSelect);
    targetSelect.style.display = hasTargets ? '' : 'none';
    if (hasTargets) {
      // Always first — the one option not backed by a library target, so
      // it reads as "nothing tracked" rather than one choice among equals.
      targetSelect.appendChild(el('option', { value: MANUAL_ENTRY_VALUE, text: t('rangeSolverLocations.manualEntryOption') }));
      activeLocation.targets.forEach((tg, i) => {
        targetSelect.appendChild(el('option', {
          value: tg.id, text: tg.name || t('rangeSolverLocations.defaultTargetName', { n: i + 1 })
        }));
      });
      targetSelect.value = activeTargetId ?? MANUAL_ENTRY_VALUE;
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
  // Detaches from whichever target is active, keeping the range/LoS
  // fields exactly as they currently read — the reverse of selectTarget()
  // above, which copies a target's values in. Never fires recompute()
  // itself: the auto-detach path below is already mid-recompute() when it
  // calls this, and the <select>'s own change listener triggers its own
  // recompute() right after.
  function deselectTarget() {
    activeTargetId = null;
    saveRangeSolverLocationState({ targetId: null });
    targetSelect.value = MANUAL_ENTRY_VALUE;
  }
  targetSelect.addEventListener('change', () => {
    if (targetSelect.value === MANUAL_ENTRY_VALUE) { deselectTarget(); recompute(); }
    else selectTarget(targetSelect.value);
  });

  refreshLocationWidget();

  // A saved target's own rangeM run through the exact same
  // engine<->display round-trip inlineNumberField() itself applies (see
  // ui/inline-number-field.js) before comparing — otherwise a target
  // whose stored value has more precision than the display unit shows
  // (e.g. distance in yards) would read as "hand-edited" the instant
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

  // There's no live "push these edits back up to the library" path
  // anymore — hand-editing a loaded target's range/LoS just detaches from
  // it (dropdown falls back to "Manual entry", see deselectTarget()
  // above), the fields' own values untouched. Checked on every recompute()
  // regardless of what actually changed (wind/atmosphere edits included)
  // — cheap, and correct either way: once activeTargetId is null there's
  // no target left to diverge from, so this becomes a no-op.
  function detachIfHandEdited() {
    const target = resolvedActiveTarget();
    if (!target) return;
    const diverged = (
      targetRangeField.getEngineValue() !== roundTripEngineValue('targetRange', 'distance', target.rangeM) ||
      losAngleField.getEngineValue() !== target.losAngleDeg
    );
    if (diverged) deselectTarget();
  }

  // ---- Wind — a single combined dial (src/ui/wind-control.js), the dial
  // + large-stepper pairing's replacement here and in Trajectory's
  // atmosphere section (atmosphere-section.js's own `combinedWind`); Hit
  // Probability/BC Estimator/Arsenal keep the plain pairing. Wind speed's
  // step/decimals are unit-aware by default now (that component's own
  // WIND_SPEED_STEPS table) — no longer computed here. Lives on the
  // Target tab itself (below the range/LoS row) rather than its own tab
  // — `label: true` (unlike Trajectory/Arsenal's bare Range Solver usage
  // this used to be) since there's no longer a "Wind" tab heading to
  // supply that context.
  const windSaved = loadRangeSolverWindState() || {};
  function saveWind() {
    saveRangeSolverWindState({ speed: wind.getEngineSpeed(), angle: wind.getAngle() });
  }
  const wind = windControl({
    angle: windSaved.angle ?? DEFAULT_WIND_ANGLE_DEG,
    speed: windSaved.speed ?? DEFAULT_WIND_SPEED_MS,
    ...FIELD_BOUNDS.windSpeed,
    label: true,
    onInput: () => { saveWind(); recompute(); }
  });

  const targetParamsRow = el('div', { class: 'target-params-row' }, [
    targetRangeField.node,
    losAngleField.node
  ]);
  const targetTab = el('div', { class: 'input-section range-solver-tab-panel' }, [
    locationRow,
    targetParamsRow,
    wind.node
  ]);

  // ---- Atmosphere tab — own cookie-backed state (range-solver-state.js),
  // deliberately not shot-state.js's shared session-only one (see
  // atmosphere-section.js's own load/save override). ----
  const atmosphere = atmosphereSection({
    includeWind: false, onInput: () => { markAtmosphereTouched(); recompute(); },
    load: loadRangeSolverAtmosphereState, save: saveRangeSolverAtmosphereState
  });
  const atmosphereTab = el('div', { class: 'range-solver-tab-panel' }, [atmosphere.node]);

  // Which of the two shows is driven by the section nav bar (see
  // range-solver-nav.js), not local tab buttons — nav-rail.js/nav-
  // tabbar.js's own Target/Atmosphere items call setRangeSolverTab().
  const tabPanels = { target: targetTab, atmosphere: atmosphereTab };
  function applyActiveTab() {
    const active = getRangeSolverTab();
    for (const key of Object.keys(tabPanels)) tabPanels[key].style.display = key === active ? '' : 'none';
  }
  applyActiveTab();
  const unsubscribeTab = onRangeSolverTabChange(applyActiveTab);

  const inputPane = el('div', { class: 'range-solver-input-pane' }, [targetTab, atmosphereTab]);

  // ---- Output pane ----
  // A quiet, label-free readout of the current atmospheric conditions —
  // station pressure, temperature and humidity — each value carrying its
  // own unit symbol as its only identification. Same "small and
  // non-intrusive" visual weight as the ToF/velocity/energy footer below,
  // but even quieter (no labels), since this is context for the dialed
  // numbers, not a result in its own right. Target range/LoS angle and
  // wind speed/direction used to show here too — dropped as redundant
  // once both are visible right above, on the Target tab itself (range/
  // LoS row plus the embedded wind widget — see targetTab above).
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
    const { pressureHpa, tempC, humidityPct } = atmosphere.getValues();

    const parts = [];
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
    detachIfHandEdited();
    const nominalState = {
      ...cartridge.getValues(),
      ...rifle.getValues(),
      ...atmosphere.getValues(),
      ...cartridge.getStabilityValues(),
      ...rifle.getStabilityValues(),
      // The user's own choice of method (Settings) — resolveSpinDriftMode()
      // (spin-drift.js) automatically falls back mccoy4dof -> litz -> off
      // only when the chosen method genuinely isn't computable from the
      // current bullet/rifle data, never as a way to silently prefer one
      // method over the user's actual selection.
      spinDriftMode: getSpinDriftMode(),
      zeroForSpinDrift: isZeroForSpinDriftEnabled(),
      windSpeed: wind.getEngineSpeed(),
      windAngle: wind.getAngle(),
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
