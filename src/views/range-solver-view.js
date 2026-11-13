// Range Solver — a field/mobile-first tool: given the active rifle+bullet
// (shared with Trajectory/Hit Probability via shot-state.js, changed only
// through Guns), a target range/angle, wind, and atmosphere, solves the
// elevation/windage correction for that one shot, big enough to read in
// direct sunlight. Deliberately no <h1>/intro header here (unlike every
// other tool view): every pixel of a small, outdoor screen counts, and the
// section's own nav bar (range-solver-nav.js, nav-rail.js, nav-tabbar.js)
// already signals context.
//
// Two panes, switched from that nav bar: Fire! and Atmosphere (the
// atmosphere form, full width). The Fire! pane holds, each in its own
// cell (.fire-cell-<id>):
//   gun      the active gun (guns-summary.js)
//   context  the active location's name and the current atmosphere
//   scope    the scope view (optional; needs a scope with a reticle)
//   readout  the large elevation/windage correction (optional)
//   flight   time of flight, residual velocity and energy
//   manual   picture icon, range and line-of-sight fields, angle meter
//   list     every target at the active location, solved (optional)
//   wind     the wind dial
//   picker   the active location's photo with its targets (optional)
// Which optional elements show is the Layout dialog's configuration
// (range-solver-fire-config.js, resolved by fire-elements.js); where the
// cells sit is fire-layout.js's fixed layout for the screen's orientation.
//
// Auto-recomputes on every input change, same posture as Trajectory/Hit
// Probability — there's no Calculate button.
import { el, clear } from '../dom.js';
import { inlineNumberField } from '../ui/inline-number-field.js';
import { windControl } from '../ui/wind-control.js';
import { losAngleIcon, locationIcon, atmosphereIcon } from '../ui/nav-icons.js';
import { rifleSection } from '../ui/sections/rifle-section.js';
import { cartridgeSection } from '../ui/sections/cartridge-section.js';
import { gunsSummary } from '../ui/sections/guns-summary.js';
import { openRangeSolverGunPicker } from '../ui/range-solver/gun-picker.js';
import { atmosphereSection } from '../ui/sections/atmosphere-section.js';
import { t, i18nSpan } from '../i18n.js';
import { computeImpact } from '../engine/trajectory.js';
import { clicksForOffset, convertAngularValue, siToDisplay, displayToSI, unitChoice, UNIT_GROUPS, FIELD_BOUNDS } from '../units.js';
import { getUnit } from '../prefs.js';
import { setRangeSolverMode, getRangeSolverTab, onRangeSolverTabChange } from '../range-solver-nav.js';
import { getIndicatorStyle, getOutputUnit, getScopeRingPosition } from '../range-solver-prefs.js';
import { getFireConfig, onFireConfigChange } from '../range-solver-fire-config.js';
import { scopeView as createScopeView } from '../ui/range-solver/scope-view.js';
import { bdcTrajectories } from '../ui/range-solver/bdc-trajectories.js';
import { resolveFireElements, effectiveElementIds } from '../ui/range-solver/fire-elements.js';
import { fireLayoutFor, buildFireLayout } from '../ui/range-solver/fire-layout.js';
import { targetList } from '../ui/range-solver/target-list.js';
import { targetImagePicker } from '../ui/range-solver/target-image-picker.js';
import { setFirePaneContext } from '../ui/range-solver/fire-config-dialog.js';
import { referenceWindSpeed } from '../reticle/bdc-overlay.js';
import { resolveRifleOptic, rifleOpticKey } from '../rifle-optic.js';
import { INDICATOR_GLYPHS } from '../ui/dope-format.js';
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
import { photoPickerButton } from '../ui/photo-picker-button.js';
import { setPendingPlacement } from '../location-placement-nav.js';
import { displayChoice, toDisplayUnit, fromDisplayUnit } from '../display-units.js';
import { fractionToPercent, linearToAngleAtRange } from '../quantity.js';
import { requestWakeLock } from '../wake-lock.js';
import { angleMeterButton } from '../ui/angle-meter/angle-meter-button.js';

const DEFAULT_LOS_ANGLE_RAD = 0;
const DEFAULT_WIND_ANGLE_RAD = Math.PI / 2; // full crosswind from the right
const DEFAULT_WIND_SPEED_MS = 0;

// One independently-chosen round number per unit — not a conversion of a
// single metric default into the others — so the table is keyed straight
// off the unit symbol.
const TARGET_RANGE_DEFAULTS = { m: 500, yd: 500 };

// The wind dial's diameter in its cell: as large as the cell allows (the
// control is WIND_W_PER_D times as wide as the dial, for its ± buttons),
// between the floor the control is designed down to and a cap.
const WIND_DIAL_MIN_PX = 130;
const WIND_DIAL_MAX_PX = 320;
const WIND_W_PER_D = 1.44;

// Same stale/unknown-preference fallback largeStepperField() itself
// applies internally — needed here too since these tables are looked up
// before that component ever sees the field.
function currentUnit(group) {
  const unit = getUnit(group);
  return UNIT_GROUPS[group].choices.some((c) => c.unit === unit) ? unit : UNIT_GROUPS[group].defaultUnit;
}

// Matches range-solver-prefs.js's own OUTPUT_UNIT_CHOICES values other than
// 'clicks' (which dials through the active rifle's own scope click value
// instead of a fixed angular unit) — same unit strings clicksForOffset()/
// angularUnitToCmAtRange() (units.js) already expect, same pairing
// trajectory-columns.js's own elevMrad/elevMOA columns use.
const OUTPUT_ANGULAR_UNIT = { mrad: 'mrad', moa: 'arcmin' };
const OUTPUT_UNIT_LABEL = { mrad: 'mrad', moa: 'MOA' };

const mediaQuery = (query) => (typeof matchMedia === 'function' ? matchMedia(query) : null);

export function mount(container) {
  clear(container);
  let disposed = false;
  setRangeSolverMode(true);
  // Read once at mount (same "cookie read at mount time" convention every
  // other view-scoped preference in this app uses) — Settings lives on a
  // different route, so these can't change out from under a mounted view.
  const indicatorGlyphs = INDICATOR_GLYPHS[getIndicatorStyle()];
  const outputUnit = getOutputUnit();
  let fireConfig = getFireConfig();

  // ---- Rifle & Bullet (shared active gun configuration — never rendered
  // here, just read for their engine values; see guns-summary.js for the
  // visible stand-in and guns-view.js for where it's actually edited) ----
  const rifle = rifleSection({ onInput: () => recompute(), onLibraryCartridgeChange: (c) => cartridge.setLibraryCartridge(c) });
  const cartridge = cartridgeSection({ onInput: () => recompute() });
  const guns = gunsSummary({ bare: true, onChange: openRangeSolverGunPicker });

  // ---- Manual target: range and line-of-sight angle ----
  const targetSaved = loadRangeSolverTargetState() || {};
  function saveTarget() {
    saveRangeSolverTargetState({ rangeM: targetRangeField.getEngineValue(), losAngleRad: losAngleField.getEngineValue() });
  }
  const distanceUnit = currentUnit('distance');
  const targetRangeField = inlineNumberField({
    id: 'targetRange', ...FIELD_BOUNDS.targetRange,
    value: targetSaved.rangeM ?? displayToSI('targetRange', TARGET_RANGE_DEFAULTS[distanceUnit], distanceUnit),
    decimals: 1,
    adornment: unitChoice('targetRange', distanceUnit).label,
    ariaLabel: t('fields.targetRange'),
    onInput: () => { saveTarget(); recompute(); }
  });
  const losAngleField = inlineNumberField({
    id: 'losAngle', ...FIELD_BOUNDS.losAngle, decimals: 1,
    value: targetSaved.losAngleRad ?? DEFAULT_LOS_ANGLE_RAD,
    adornment: losAngleIcon(),
    ariaLabel: t('fields.losAngle'),
    onInput: () => { saveTarget(); recompute(); }
  });
  const measureLosAngleButton = angleMeterButton({
    onMeasure: (losAngleRad) => { losAngleField.setEngineValue(losAngleRad); saveTarget(); recompute(); }
  });

  // ---- Locations & Targets library: the active location and target ----
  // The range/LoS fields stay the single source of truth for what's
  // dialed (cookie-backed via saveTarget()) — selecting a target in the
  // list or on the photo just copies its values in, once; it never
  // becomes a live link, and nothing flows back to the library. Hand-
  // editing the fields away from the selected target deselects it
  // (detachIfHandEdited() below).
  const locationSaved = loadRangeSolverLocationState() || {};
  const activeLocation = locationSaved.locationId
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

  // Shared by the targets list and the photo picker — both drive the same
  // selection path, discarding any hand-edited fields with no
  // confirmation; selecting is always a fresh copy-in. The target's LoS is
  // copied in even while LoS angles are ignored, so turning that option
  // off later shows the target's own values.
  function selectTarget(targetId) {
    activeTargetId = targetId;
    saveRangeSolverLocationState({ targetId: activeTargetId });
    const target = resolvedActiveTarget();
    if (target) {
      targetRangeField.setEngineValue(target.rangeM);
      losAngleField.setEngineValue(target.losAngleRad);
      saveTarget();
    }
    recompute();
  }
  // Detaches from the selected target, keeping the fields as they read.
  // Never recomputes itself: its one caller is already mid-recompute().
  function deselectTarget() {
    activeTargetId = null;
    saveRangeSolverLocationState({ targetId: null });
  }

  // Checked on every recompute() regardless of what changed — cheap, and a
  // no-op once nothing is selected. Each field's own peekRoundTrip()
  // (inline-number-field.js) is what a target's stored value has to go
  // through before comparing: a stored value with more precision than the
  // field shows (a LoS angle of 5.55° against the field's tenths) would
  // otherwise read as hand-edited the instant it is loaded. While LoS
  // angles are ignored only the range counts — the LoS field is hidden and
  // can't be edited.
  function detachIfHandEdited() {
    const target = resolvedActiveTarget();
    if (!target) return;
    const diverged = (
      targetRangeField.getEngineValue() !== targetRangeField.peekRoundTrip(target.rangeM) ||
      (!ignoringLos() && losAngleField.getEngineValue() !== losAngleField.peekRoundTrip(target.losAngleRad))
    );
    if (diverged) deselectTarget();
  }

  // The prominent picture icon: opens the full-screen photo picker when
  // the pane shows neither the list nor the inline picker (fire-elements.js).
  const pictureButton = photoPickerButton({
    label: t('rangeSolverLocations.photoPickerButtonLabel'),
    prominent: true,
    onClick: () => {
      if (!activeLocation || !activeLocation.photo) return;
      setPendingPlacement({ locationId: activeLocation.id, targetId: null, returnPath: '/range-solver', selectMode: true });
      location.hash = '#/locations/place';
    }
  });

  // ---- Wind — the combined dial (wind-control.js), label-free: its hub
  // (speed digits, degree readout) already reads as "wind" at a glance.
  const windSaved = loadRangeSolverWindState() || {};
  function saveWind() {
    saveRangeSolverWindState({ speed: wind.getEngineSpeed(), angleRad: wind.getAngleRad() });
  }
  const wind = windControl({
    angleRad: windSaved.angleRad ?? DEFAULT_WIND_ANGLE_RAD,
    speed: windSaved.speed ?? DEFAULT_WIND_SPEED_MS,
    ...FIELD_BOUNDS.windSpeed,
    onInput: () => { saveWind(); recompute(); }
  });

  // ---- Atmosphere pane — own cookie-backed state (range-solver-state.js),
  // deliberately not shot-state.js's shared session-only one (see
  // atmosphere-section.js's own load/save override). ----
  const atmosphere = atmosphereSection({
    includeWind: false, onInput: () => { markAtmosphereTouched(); recompute(); },
    load: loadRangeSolverAtmosphereState, save: saveRangeSolverAtmosphereState
  });

  // ---- Readout ----
  const conditionsBar = el('div', { class: 'range-solver-conditions' });
  const elevationValue = el('div', { class: 'range-solver-click-value' }, ['—']);
  const windageValue = el('div', { class: 'range-solver-click-value' }, ['—']);
  // The unit suffix goes on the small label rather than the huge readout
  // number itself, which would make an inline " mrad"/" MOA"/" clicks"
  // suffix dominate the screen. 'clicks' gets the literal word "clicks",
  // not the rifle's click angular unit: a click's size is arbitrary (0.1
  // mrad by default, possibly different between elevation and windage),
  // so "12 mrad" for 12 clicks would misstate it by that factor.
  const outputUnitSuffix = OUTPUT_UNIT_LABEL[outputUnit]
    ? ` (${OUTPUT_UNIT_LABEL[outputUnit]})`
    : outputUnit === 'clicks' ? ` (${t('settings.rangeSolverOutputClicks')})` : '';
  const readout = el('div', { class: 'range-solver-readout' }, [
    el('div', { class: 'range-solver-stat range-solver-elevation' }, [
      elevationValue,
      el('div', { class: 'range-solver-click-label' }, [i18nSpan('rangeSolver.elevationLabel'), outputUnitSuffix])
    ]),
    el('div', { class: 'range-solver-stat range-solver-windage' }, [
      windageValue,
      el('div', { class: 'range-solver-click-label' }, [i18nSpan('rangeSolver.windageLabel'), outputUnitSuffix])
    ])
  ]);

  // Elevation and windage read as a matched pair: if a narrow stat and/or
  // a long value forces one to wrap its sign onto its own line while the
  // other still fits, syncReadoutWrap() below breaks the other the same
  // way. A ResizeObserver re-runs that on any size change of either stat;
  // the re-sync is deferred one frame so forcing a break (which grows both
  // stretched stats) never happens inside the callback observing it.
  // Feature-detected: the test harness's fake DOM has no ResizeObserver.
  let wrapResizeObserver = null;
  let wrapSyncFrame = null;
  if (typeof ResizeObserver !== 'undefined') {
    wrapResizeObserver = new ResizeObserver(() => {
      if (wrapSyncFrame !== null) return;
      wrapSyncFrame = requestAnimationFrame(() => {
        wrapSyncFrame = null;
        syncReadoutWrap();
      });
    });
    wrapResizeObserver.observe(elevationValue.parentElement);
    wrapResizeObserver.observe(windageValue.parentElement);
  }

  const tofValue = el('span', { class: 'range-solver-footer-value' }, ['—']);
  const velocityValue = el('span', { class: 'range-solver-footer-value' }, ['—']);
  const energyValue = el('span', { class: 'range-solver-footer-value' }, ['—']);
  const footer = el('div', { class: 'range-solver-footer' }, [
    el('div', { class: 'range-solver-footer-stat' }, [i18nSpan('rangeSolver.tofLabel'), tofValue]),
    el('div', { class: 'range-solver-footer-stat' }, [i18nSpan('rangeSolver.velocityLabel'), velocityValue]),
    el('div', { class: 'range-solver-footer-stat' }, [i18nSpan('rangeSolver.energyLabel'), energyValue])
  ]);

  // ---- Scope view — the rifle's reticle with the shot's aiming point.
  // Shown when the configuration asks for it and the active rifle has a
  // scope with a reticle (rifle-optic.js); sized from its cell.
  const scopeView = createScopeView({ onBdcChange: updateBdc, fitBox: true, ringPosition: getScopeRingPosition() });
  // The trajectory the BDC range labels and the wind holds read: flown for
  // the dialed target's conditions (its line-of-sight angle and the wind's
  // head- or tailwind part included) whenever either needs it and they
  // change.
  const bdc = bdcTrajectories((tables) => { if (!disposed) scopeView.setBdcTables(tables); });
  let bdcState = null;
  function updateBdc() {
    if (!bdcState || !scopeView.wantsBdcTables()) return;
    const reference = fromDisplayUnit('windSpeed', referenceWindSpeed(displayChoice('windSpeed').unit));
    bdc.update(bdcState, reference);
  }

  let rifleOptic = null;
  let rifleOpticKeyValue = null;
  let rifleOpticRequest = 0;
  function refreshRifleOptic() {
    const selected = rifle.getSelectedRifle();
    const key = rifleOpticKey(selected);
    if (key === rifleOpticKeyValue) return;
    rifleOpticKeyValue = key;
    const request = ++rifleOpticRequest;
    rifleOptic = null;
    applyFireConfig();
    if (!key) return;
    resolveRifleOptic(selected).then((optic) => {
      if (disposed || request !== rifleOpticRequest) return;
      rifleOptic = optic;
      applyFireConfig();
    });
  }

  // ---- Targets list and photo picker ----
  const list = targetList({ onSelectTarget: (targetId) => selectTarget(targetId), indicatorGlyphs });
  const picker = targetImagePicker({ onSelectTarget: (targetId) => selectTarget(targetId) });

  // ---- The Fire! pane's cells ----
  const dimIcon = (iconNode) => el('span', { class: 'fire-context-icon', 'aria-hidden': 'true' }, [iconNode]);
  const locationPart = el('span', { class: 'fire-context-location' }, [
    dimIcon(locationIcon(14)), el('strong', { class: 'fire-context-name', text: activeLocation ? activeLocation.name : '' })
  ]);
  const atmospherePart = el('span', { class: 'fire-context-atmosphere' }, [dimIcon(atmosphereIcon(14)), conditionsBar]);
  // The picture icon, when shown, comes first (layout.css relies on this
  // order: picture icon, range, LoS, angle meter).
  const manualRow = el('div', { class: 'target-params-row' }, [
    pictureButton, targetRangeField.node, losAngleField.node, measureLosAngleButton
  ]);
  const cells = {
    gun: el('div', { class: 'fire-cell fire-cell-gun' }, [guns.node]),
    context: el('div', { class: 'fire-cell fire-cell-context' }, [locationPart, atmospherePart]),
    scope: el('div', { class: 'fire-cell fire-cell-scope' }, [scopeView.node]),
    readout: el('div', { class: 'fire-cell fire-cell-readout' }, [readout]),
    flight: el('div', { class: 'fire-cell fire-cell-flight' }, [footer]),
    manual: el('div', { class: 'fire-cell fire-cell-manual' }, [manualRow]),
    list: el('div', { class: 'fire-cell fire-cell-list' }, [list.node]),
    wind: el('div', { class: 'fire-cell fire-cell-wind' }, [wind.node]),
    picker: el('div', { class: 'fire-cell fire-cell-picker' }, [picker.node])
  };
  const firePane = el('div', { class: 'fire-pane' });
  const atmospherePane = el('div', { class: 'range-solver-atmosphere-pane' }, [atmosphere.node]);
  container.appendChild(firePane);
  container.appendChild(atmospherePane);

  // The wind dial fills its cell, measured into px (the control's own
  // container-unit sizing misbehaves when its cell, not the viewport,
  // decides its size).
  let windObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    windObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || !box.width || !box.height) return;
      const d = Math.round(Math.max(WIND_DIAL_MIN_PX, Math.min(WIND_DIAL_MAX_PX, box.height, box.width / WIND_W_PER_D)));
      wind.node.style.setProperty('--fire-dial-d', `${d}px`);
      wind.node.style.setProperty('--fire-btn', `${Math.round(Math.max(40, Math.min(64, d * 0.3056)))}px`);
    });
    windObserver.observe(cells.wind);
  }

  // ---- Configuration → what shows, and the layout ----
  let resolved = null;
  const ignoringLos = () => !!resolved && resolved.ignoreLos.effective;
  // Every solve's line-of-sight angle: 0 while LoS angles are ignored, so
  // what is shown is what is computed (the dialed target, every list row,
  // the BDC trajectories, the scope view).
  const effectiveLosRad = (losAngleRad) => (ignoringLos() ? 0 : losAngleRad);

  const landscapeQuery = mediaQuery('(orientation: landscape)');
  const viewportBox = () => ({
    width: typeof innerWidth === 'number' ? innerWidth : 390,
    height: typeof innerHeight === 'number' ? innerHeight : 844
  });
  function paneBox() {
    if (typeof firePane.getBoundingClientRect === 'function') {
      const r = firePane.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { width: r.width, height: r.height };
    }
    const v = viewportBox();
    return { width: Math.max(1, v.width - 24), height: Math.max(1, v.height - 24) };
  }

  let layoutKey = null;
  function applyLayout(force = false) {
    if (!resolved) return;
    const pane = paneBox();
    const v = viewportBox();
    const orientation = landscapeQuery && landscapeQuery.matches ? 'landscape' : 'portrait';
    const ids = effectiveElementIds(resolved);
    const ctx = {
      paneWidth: pane.width, paneHeight: pane.height, vmin: Math.min(v.width, v.height),
      pictureIcon: resolved.pictureIcon, ignoreLos: resolved.ignoreLos.effective
    };
    const layout = fireLayoutFor(orientation, ids, ctx);
    const key = JSON.stringify([orientation, ids, Math.round(pane.width), Math.round(pane.height), ctx.vmin, ctx.pictureIcon, ctx.ignoreLos]);
    if (!force && key === layoutKey) return;
    layoutKey = key;
    const root = buildFireLayout(layout.tree, cells, layout.floorCtx);
    clear(firePane);
    firePane.appendChild(root);
    firePane.classList.toggle('fire-landscape', orientation === 'landscape');
    firePane.classList.toggle('fire-scrolls', layout.minHeight > pane.height);
    for (const id of Object.keys(cells)) firePane.classList.toggle(`fire-has-${id}`, ids.includes(id));
    list.remeasure();
  }

  function applyFireConfig() {
    resolved = resolveFireElements({ config: fireConfig, location: activeLocation, hasOptic: !!rifleOptic });
    setFirePaneContext({ hasOptic: !!rifleOptic, paneNode: firePane });
    locationPart.style.display = resolved.showLocationName ? '' : 'none';
    pictureButton.style.display = resolved.pictureIcon ? '' : 'none';
    losAngleField.node.style.display = resolved.ignoreLos.effective ? 'none' : '';
    measureLosAngleButton.style.display = resolved.ignoreLos.effective ? 'none' : '';
    manualRow.classList.toggle('ignore-los', resolved.ignoreLos.effective);
    manualRow.classList.toggle('with-picture', resolved.pictureIcon);
    readout.classList.toggle('compact', resolved.scope.effective);
    scopeView.setOptic(resolved.scope.effective ? rifleOptic : null);
    list.setRowBudget({ optimal: fireConfig.listRowsOptimal, count: fireConfig.listRows });
    applyLayout(true);
    updateBdc();
  }

  function applyActiveTab() {
    const fire = getRangeSolverTab() === 'fire';
    firePane.style.display = fire ? '' : 'none';
    atmospherePane.style.display = fire ? 'none' : '';
    // A pane measured while hidden measures zero: lay out again now.
    if (fire) applyLayout(true);
  }

  // The dialed correction, sign shown as a direction glyph (leading, not
  // trailing — read the direction first) rather than +/- — a value that
  // rounds to zero at the display precision shows plain, no glyph.
  // Elevation matches trajectory-columns.js's own elevClicks/elevMrad/
  // elevMOA sign (dropped below the sight line reads as a positive "dial
  // up" correction). Windage keeps trajectory-columns.js's own sign as-is:
  // positive is "dial right," negative "dial left," consistent with the
  // Trajectory table's raw sign for the same shot. Which glyphs (arrows vs
  // +/-) is a Settings preference. `decimals` is 0 for clicks, 1 for
  // mrad/MOA. `forceBreak` inserts a <br> between glyph and number (or
  // before a lone zero) to match a sibling stat that wrapped on its own.
  function renderAdjustment(node, value, positiveGlyph, negativeGlyph, decimals, forceBreak) {
    clear(node);
    const rounded = Number(value.toFixed(decimals));
    if (rounded === 0) {
      if (forceBreak) node.appendChild(document.createElement('br'));
      node.appendChild(document.createTextNode(rounded.toFixed(decimals)));
      return;
    }
    const glyph = rounded > 0 ? positiveGlyph : negativeGlyph;
    node.appendChild(el('span', { class: 'range-solver-click-glyph' }, [glyph]));
    if (forceBreak) node.appendChild(document.createElement('br'));
    node.appendChild(document.createTextNode(Math.abs(rounded).toFixed(decimals)));
  }

  // True once the glyph and the number sit on two lines — the value box's
  // rendered height against one line's (line-height 1, so one font-size).
  // The 1.5x threshold falls cleanly between one line (~1x) and two
  // (~2x). The fake DOM has no layout, so it always reports "not wrapped".
  function isWrapped(node) {
    if (typeof node.getBoundingClientRect !== 'function') return false;
    const fontSizePx = parseFloat(getComputedStyle(node).fontSize);
    return node.getBoundingClientRect().height > fontSizePx * 1.5;
  }

  // The last computed reading, so syncReadoutWrap() can re-render on a
  // pure resize — null while showPlaceholder() shows "—".
  let lastElevValue = null;
  let lastWindValue = null;
  let lastDecimals = 0;

  // Always starts from an unforced render of both, so a widening resize
  // un-forces a break as readily as a narrowing one imposes it.
  function syncReadoutWrap() {
    if (lastElevValue === null || lastWindValue === null) return;
    renderAdjustment(elevationValue, lastElevValue, indicatorGlyphs.elevationPositive, indicatorGlyphs.elevationNegative, lastDecimals, false);
    renderAdjustment(windageValue, lastWindValue, indicatorGlyphs.windagePositive, indicatorGlyphs.windageNegative, lastDecimals, false);
    const elevWrapped = isWrapped(elevationValue);
    const windWrapped = isWrapped(windageValue);
    if (elevWrapped && !windWrapped) {
      renderAdjustment(windageValue, lastWindValue, indicatorGlyphs.windagePositive, indicatorGlyphs.windageNegative, lastDecimals, true);
    } else if (windWrapped && !elevWrapped) {
      renderAdjustment(elevationValue, lastElevValue, indicatorGlyphs.elevationPositive, indicatorGlyphs.elevationNegative, lastDecimals, true);
    }
  }

  function renderReadout(elevValue, windValue, decimals) {
    lastElevValue = elevValue;
    lastWindValue = windValue;
    lastDecimals = decimals;
    syncReadoutWrap();
  }

  // Shown whenever an input is mid-edit (e.g. the range field momentarily
  // empty) or otherwise produces a non-finite result — "—" everywhere
  // rather than a stray "NaN" reaching the screen.
  function showPlaceholder() {
    scopeView.setShot(null);
    lastElevValue = null;
    lastWindValue = null;
    clear(elevationValue);
    elevationValue.appendChild(document.createTextNode('—'));
    clear(windageValue);
    windageValue.appendChild(document.createTextNode('—'));
    tofValue.textContent = '—';
    velocityValue.textContent = '—';
    energyValue.textContent = '—';
  }

  // The number itself is the reading; the unit is just how to read it.
  function numberWithUnit(numberStr, unitText) {
    return [el('span', { class: 'range-solver-conditions-num' }, [numberStr]), document.createTextNode(unitText)];
  }

  // A value in its kind's internal unit, in the user's display unit for
  // `groupName` (display-units.js).
  function formatWithUnit(groupName, value) {
    const choice = displayChoice(groupName);
    return numberWithUnit(toDisplayUnit(groupName, value).toFixed(choice.decimals), ` ${choice.label}`);
  }

  // Station pressure, temperature and humidity, each identified only by
  // its unit symbol — context for the dialed numbers, not a result.
  function updateConditions() {
    clear(conditionsBar);
    const { pressurePa, tempC, humidity } = atmosphere.getValues();
    const parts = [];
    if (Number.isFinite(pressurePa)) parts.push(formatWithUnit('pressure', pressurePa));
    if (Number.isFinite(tempC)) parts.push(formatWithUnit('temperature', tempC));
    if (Number.isFinite(humidity)) parts.push(numberWithUnit(String(Math.round(fractionToPercent(humidity))), '%'));
    parts.forEach((part, i) => {
      if (i > 0) conditionsBar.appendChild(el('span', { class: 'range-solver-conditions-sep' }, ['·']));
      conditionsBar.appendChild(Array.isArray(part) ? el('span', {}, part) : part);
    });
  }

  // Everything computeImpact() needs except losAngleRad/targetRangeM —
  // those vary per target (the dialed one, and every list row's own),
  // everything else is shared "current conditions."
  function buildNominalStateBase() {
    return {
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
      windAngleRad: wind.getAngleRad(),
      // "Zeroed with a different cartridge" — see zero-donor.js and
      // rifle-section.js's own getZeroDonorBallistics(). null whenever the
      // selected cartridge doesn't borrow a sibling's zero.
      zeroDonorBallistics: rifle.getZeroDonorBallistics()
    };
  }

  // The one shot solve, shared by the dialed target and every list row
  // (each with its own range/LoS, the same conditions otherwise). Returns
  // null on anything unsolvable rather than throwing, so the list can
  // skip just the bad row.
  function solveClicks(nominalStateBase, targetRangeM, losAngleRad) {
    const nominalState = { ...nominalStateBase, losAngleRad };
    let result;
    try {
      result = computeImpact(nominalState, targetRangeM);
    } catch {
      return null;
    }
    if (![result.dropM, result.windageM, result.velocity, result.tof].every(Number.isFinite)) return null;

    // The correction as angles, signed as the readout shows it (positive:
    // dial up, dial right) — also what the scope view draws its aiming
    // point from.
    const elevationRad = -linearToAngleAtRange(result.dropM, targetRangeM);
    const windageRad = linearToAngleAtRange(result.windageM, targetRangeM);
    let elevValue;
    let windValue;
    let decimals;
    if (outputUnit === 'clicks') {
      const clickSettings = rifle.getClickSettings();
      elevValue = Math.round(-clicksForOffset(result.dropM, clickSettings.verticalRad, targetRangeM));
      windValue = Math.round(clicksForOffset(result.windageM, clickSettings.horizontalRad, targetRangeM));
      decimals = 0;
    } else {
      // Click value of 1 in the fixed angular unit — same trick
      // trajectory-columns.js's own elevMrad/elevMOA columns use.
      const angularUnit = OUTPUT_ANGULAR_UNIT[outputUnit];
      elevValue = convertAngularValue(elevationRad, 'rad', angularUnit);
      windValue = convertAngularValue(windageRad, 'rad', angularUnit);
      decimals = 1;
    }
    if (![elevValue, windValue, elevationRad, windageRad].every(Number.isFinite)) return null;
    return { elevValue, windValue, decimals, elevationRad, windageRad, result };
  }

  // A target's range for its list row — always a whole number: the list is
  // a glance-at overview with a compact value column, not a precision field.
  function formatRangeDisplay(rangeM) {
    const choice = unitChoice('targetRange', currentUnit('distance')) || UNIT_GROUPS.distance.choices.find((c) => c.unit === UNIT_GROUPS.distance.defaultUnit);
    return `${Math.round(siToDisplay('targetRange', rangeM, choice.unit))} ${choice.label}`;
  }

  function buildTargetListRows(nominalStateBase) {
    if (!activeLocation || !resolved || !resolved.list.effective) return [];
    return activeLocation.targets
      .map((target, index) => {
        const solved = solveClicks(nominalStateBase, target.rangeM, effectiveLosRad(target.losAngleRad));
        return {
          id: target.id,
          name: target.name || t('rangeSolverLocations.defaultTargetName', { n: index + 1 }),
          rangeM: target.rangeM,
          rangeDisplay: formatRangeDisplay(target.rangeM),
          elevValue: solved ? solved.elevValue : 0,
          windValue: solved ? solved.windValue : 0,
          decimals: solved ? solved.decimals : 0,
          valid: !!solved
        };
      })
      .sort((a, b) => a.rangeM - b.rangeM);
  }

  function refreshTargets(nominalStateBase) {
    list.refresh({ rows: buildTargetListRows(nominalStateBase), activeTargetId });
    picker.refresh({
      location: resolved && resolved.picker.effective ? activeLocation : null,
      activeTargetId,
      omitAngle: ignoringLos()
    });
  }

  function recompute() {
    refreshRifleOptic();
    updateConditions();
    detachIfHandEdited();
    const nominalStateBase = buildNominalStateBase();
    const losAngleRad = effectiveLosRad(losAngleField.getEngineValue());
    bdcState = { ...nominalStateBase, losAngleRad };
    updateBdc();
    const targetRangeM = targetRangeField.getEngineValue();
    const solved = solveClicks(nominalStateBase, targetRangeM, losAngleRad);
    if (!solved) {
      showPlaceholder();
      refreshTargets(nominalStateBase);
      return;
    }

    const velocityUnit = getUnit('velocity');
    const velocityChoice = unitChoice('muzzleVelocity', velocityUnit);
    const displayVelocity = siToDisplay('muzzleVelocity', solved.result.velocity, velocityUnit);

    const massKg = cartridge.getValues().massKg;
    const energyJ = 0.5 * massKg * solved.result.velocity * solved.result.velocity;
    const energyUnit = getUnit('energy');
    const energyChoice = unitChoice('energy', energyUnit);
    const displayEnergy = siToDisplay('energy', energyJ, energyUnit);

    if (![displayVelocity, displayEnergy].every(Number.isFinite)) {
      showPlaceholder();
      refreshTargets(nominalStateBase);
      return;
    }

    renderReadout(solved.elevValue, solved.windValue, solved.decimals);
    scopeView.setShot({
      elevationRad: solved.elevationRad, windageRad: solved.windageRad,
      // The wind's crosswind part (positive from the right), for the
      // Upwind BDC range display's side.
      crosswindMs: wind.getEngineSpeed() * Math.sin(wind.getAngleRad()),
      // For the wind holds on the aiming mark's level.
      rangeM: targetRangeM
    });
    tofValue.textContent = `${solved.result.tof.toFixed(2)} ${t('rangeSolver.secondsUnit')}`;
    velocityValue.textContent = `${displayVelocity.toFixed(0)} ${velocityChoice.label}`;
    energyValue.textContent = `${displayEnergy.toFixed(0)} ${energyChoice.label}`;
    refreshTargets(nominalStateBase);
  }

  applyFireConfig();
  applyActiveTab();
  recompute();

  const unsubscribeTab = onRangeSolverTabChange(applyActiveTab);
  const unsubscribeConfig = onFireConfigChange((next) => {
    fireConfig = next;
    applyFireConfig();
    recompute();
  });
  // Orientation decides the layout; a pane resize can change which floors
  // fit (and with them whether the pane scrolls).
  const onOrientation = () => applyLayout(true);
  landscapeQuery?.addEventListener?.('change', onOrientation);
  let paneObserver = null;
  let paneFrame = null;
  if (typeof ResizeObserver !== 'undefined') {
    paneObserver = new ResizeObserver(() => {
      if (paneFrame !== null) return;
      paneFrame = requestAnimationFrame(() => {
        paneFrame = null;
        if (!disposed && firePane.style.display !== 'none') applyLayout();
      });
    });
    paneObserver.observe(firePane);
  }

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
    unsubscribeConfig();
    landscapeQuery?.removeEventListener?.('change', onOrientation);
    paneObserver?.disconnect();
    if (paneFrame !== null) cancelAnimationFrame(paneFrame);
    windObserver?.disconnect();
    setFirePaneContext({ paneNode: null });
    setRangeSolverMode(false);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    wakeLockSentinel?.release();
    wakeLockSentinel = null;
    wrapResizeObserver?.disconnect();
    if (wrapSyncFrame !== null) cancelAnimationFrame(wrapSyncFrame);
    list.dispose();
    picker.dispose();
    bdc.dispose();
    scopeView.dispose();
  };
}
