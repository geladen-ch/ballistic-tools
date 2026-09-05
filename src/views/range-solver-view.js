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
import { clicksForOffset, engineToDisplay, displayToEngine, unitChoice, UNIT_GROUPS, FIELD_BOUNDS } from '../units.js';
import { getUnit } from '../prefs.js';
import { setRangeSolverMode, getRangeSolverTab, onRangeSolverTabChange } from '../range-solver-nav.js';
import { getIndicatorStyle, getOutputUnit } from '../range-solver-prefs.js';
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
import { rangeCardPanel } from '../ui/range-solver/range-card-panel.js';

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

// Matches range-solver-prefs.js's own OUTPUT_UNIT_CHOICES values other than
// 'clicks' (which dials through the active rifle's own scope click value
// instead of a fixed angular unit) — same unit strings clicksForOffset()/
// angularUnitToCmAtRange() (units.js) already expect, same pairing
// trajectory-columns.js's own elevMrad/elevMOA columns use.
const OUTPUT_ANGULAR_UNIT = { mrad: 'mrad', moa: 'arcmin' };
const OUTPUT_UNIT_LABEL = { mrad: 'mrad', moa: 'MOA' };

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
  const outputUnit = getOutputUnit();

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

  // There's no live "push these edits back up to the library" path
  // anymore — hand-editing a loaded target's range/LoS just detaches from
  // it (dropdown falls back to "Manual entry", see deselectTarget()
  // above), the fields' own values untouched. Checked on every recompute()
  // regardless of what actually changed (wind/atmosphere edits included)
  // — cheap, and correct either way: once activeTargetId is null there's
  // no target left to diverge from, so this becomes a no-op.
  //
  // Each field's own peekRoundTrip() (inline-number-field.js) — not a
  // hand-rolled copy of its rounding — is what a saved target's raw
  // rangeM/losAngleDeg has to go through before comparing: otherwise a
  // target whose stored value has more precision than the field actually
  // displays (e.g. a LOS angle of 5.5° against losAngleField's whole-
  // degree `decimals: 0`) reads as "hand-edited" the instant it's loaded,
  // from the field's own display rounding alone — immediately deselecting
  // the very target selectTarget() just finished copying in, never having
  // been touched by hand at all. (This is exactly what a stale, duplicated
  // round-trip helper here used to get wrong for both fields — silently,
  // for any target whose LOS angle wasn't a whole number.)
  function detachIfHandEdited() {
    const target = resolvedActiveTarget();
    if (!target) return;
    const diverged = (
      targetRangeField.getEngineValue() !== targetRangeField.peekRoundTrip(target.rangeM) ||
      losAngleField.getEngineValue() !== losAngleField.peekRoundTrip(target.losAngleDeg)
    );
    if (diverged) deselectTarget();
  }

  // ---- Wind — a single combined dial (src/ui/wind-control.js), the dial
  // + large-stepper pairing's replacement here and in Trajectory's
  // atmosphere section (atmosphere-section.js's own `combinedWind`); Hit
  // Probability/BC Estimator/Arsenal keep the plain pairing. Wind speed's
  // step/decimals are unit-aware by default now (that component's own
  // WIND_SPEED_STEPS table) — no longer computed here. Lives on the
  // Target tab itself (below the range/LoS row) rather than its own tab;
  // no label — the dial's own hub (speed digits, degree readout) already
  // reads as "wind" at a glance, same reasoning as the Target tab's own
  // label-free range/LoS row just above it.
  const windSaved = loadRangeSolverWindState() || {};
  function saveWind() {
    saveRangeSolverWindState({ speed: wind.getEngineSpeed(), angle: wind.getAngle() });
  }
  const wind = windControl({
    angle: windSaved.angle ?? DEFAULT_WIND_ANGLE_DEG,
    speed: windSaved.speed ?? DEFAULT_WIND_SPEED_MS,
    ...FIELD_BOUNDS.windSpeed,
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

  // ---- Range Card tab — every target at the active location solved at
  // once (src/ui/range-solver/range-card-panel.js). No unit/ballistics
  // knowledge of its own; buildRangeCardRows()/solveClicks() below feed it
  // fully-formed rows on every recompute(). Shares the exact same
  // windControl() instance as the Target tab above (re-parented between
  // the two tabs' own slots in applyActiveTab(), see windSlotTarget/
  // rangeCard.windSlot below) rather than a second dial reflecting the
  // same cookie-backed value — one instance, one place it can go stale. ----
  const rangeCard = rangeCardPanel({
    onSelectTarget: (targetId) => selectTarget(targetId),
    indicatorGlyphs,
    onManageLocations: () => { location.hash = '#/locations'; }
  });
  const rangeCardTab = el('div', { class: 'range-solver-tab-panel range-card-tab-panel' }, [rangeCard.node]);
  // wind.node's other possible parent — see applyActiveTab()'s reparenting
  // step; kept as its own named slot (rather than targetTab directly)
  // purely so both call sites read the same way.
  const windSlotTarget = targetTab;

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
  // tabbar.js's own Target/Range Card/Atmosphere items call
  // setRangeSolverTab(). app.js's own onRangeSolverTabChange subscription
  // toggles html.range-solver-card-active (layout.css keys off it to give
  // this tab the whole screen, output pane hidden) — kept there rather
  // than here to match every other cross-cutting mode class in this app.
  const tabPanels = { target: targetTab, rangeCard: rangeCardTab, atmosphere: atmosphereTab };
  function applyActiveTab() {
    const active = getRangeSolverTab();
    for (const key of Object.keys(tabPanels)) tabPanels[key].style.display = key === active ? '' : 'none';
    // appendChild() on an already-attached node moves it — no explicit
    // remove-then-insert dance needed either direction.
    (active === 'rangeCard' ? rangeCard.windSlot : windSlotTarget).appendChild(wind.node);
    // Row heights measured while this tab's own display:none (every
    // recompute() runs regardless of which tab is active — see
    // refreshRangeCard() below) all come back zero, baking in an empty-
    // looking table until re-measured for real — see rangeCard's own
    // remeasure() for why this can't just be skipped while hidden instead.
    if (active === 'rangeCard') rangeCard.remeasure();
  }
  applyActiveTab();
  const unsubscribeTab = onRangeSolverTabChange(applyActiveTab);

  const inputPane = el('div', { class: 'range-solver-input-pane' }, [targetTab, rangeCardTab, atmosphereTab]);

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
  // The unit suffix goes on the small label rather than the huge readout
  // number itself, since the reading's own font size (up to 210px, see
  // layout.css) would make an inline " mrad"/" MOA"/" clicks" suffix
  // dominate the screen. 'clicks' gets the literal word "clicks", not the
  // rifle's own click angular unit (mrad/MOA) — a click's *size* is
  // arbitrary (0.1 mrad by default, but any value, and possibly different
  // between elevation and windage — see scope-clicks-field.js), so
  // labeling a "12 clicks" reading as "12 mrad" would misstate it by
  // whatever factor the click value differs from 1 (10x too large at the
  // 0.1 mrad default). "clicks" is the only label that's actually always
  // true regardless of the rifle's click size/unit.
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

  // Elevation and windage are meant to read as a matched pair, so if a
  // narrow container and/or a long value (see .range-solver-click-value's
  // cqw-scaled font size in layout.css, floored at 54px) forces one of
  // them to wrap its sign onto its own line while the other still fits on
  // one, syncReadoutWrap() below force-breaks the other the same way
  // rather than leaving the pair visually lopsided. A ResizeObserver
  // re-runs that check on any width change to either stat panel, not just
  // when recompute() itself re-runs on an input edit — resizing the
  // window alone can flip which side wraps. Feature-detected since this
  // app's test harness's fake DOM has no ResizeObserver (see multi-bc-
  // segments.js's own use of the same guard).
  //
  // The re-sync itself is deferred to the next animation frame rather
  // than run straight from the observer callback: .range-solver-readout
  // has no explicit align-items, so its default `stretch` means forcing
  // one stat to two lines grows *both* stats' own observed height (the
  // shorter one gets stretched to match) — mutating synchronously inside
  // the very callback that's observing that mutation is exactly what
  // trips the browser's (harmless but noisy) "ResizeObserver loop
  // completed with undelivered notifications" warning. One rAF tick
  // breaks that same-frame feedback loop; the coalescing guard collapses
  // a burst of resize notifications into a single re-sync.
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

  const outputPane = el('div', { class: 'range-solver-output-pane' }, [guns.node, conditionsBar, readout, footer]);

  container.appendChild(el('div', { class: 'range-solver-layout' }, [outputPane, inputPane]));

  // The dialed correction, sign shown as a direction glyph (leading, not
  // trailing — read the direction first) rather than +/- — a value that
  // rounds to zero at the display precision shows plain, no glyph.
  // Elevation matches trajectory-columns.js's own elevClicks/elevMrad/
  // elevMOA sign (dropped below the sight line reads as a positive "dial
  // up" correction). Windage keeps trajectory-columns.js's own windClicks/
  // windMrad/windMOA sign as-is (not inverted) — there's no established
  // real-world left/right mapping for it anywhere else in the app to defer
  // to, so positive is defined here as "dial right," negative as "dial
  // left," consistent with itself and with the Trajectory table's own raw
  // sign for the same shot. Which glyphs (arrows vs +/-) is a Settings
  // preference — see indicatorGlyphs above. `decimals` is 0 for clicks
  // (whole clicks, as always), 1 for mrad/MOA (outputUnit above).
  //
  // `forceBreak` inserts an explicit <br> between the glyph and the
  // number (or, for a zero value with no glyph at all, before the lone
  // number) to match a sibling stat that wrapped on its own — see
  // isWrapped()/syncReadoutWrap() below.
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

  // True once the glyph and the number have actually landed on two
  // different lines — compared by the value box's own rendered height
  // against its single-line height (line-height:1, so exactly one
  // font-size — see .range-solver-click-value in layout.css), rather than
  // by comparing the glyph's and number's own top positions. Those two
  // spans sit at different baseline-aligned heights even on a single
  // line — `.range-solver-click-glyph`'s display:inline-block gives it
  // its own baseline-aligned box, a few px off from the plain inline
  // number span's — so comparing tops directly false-flagged every
  // single-line reading as "wrapped". The 1.5x threshold cleanly falls
  // between one line's height (~1x) and two lines' (~2x) regardless of
  // the cqw-scaled font size actually in effect. Feature-detected — this
  // app's test harness's fake DOM has no getBoundingClientRect at all
  // (real layout never runs there), so it always reports "not wrapped".
  function isWrapped(node) {
    if (typeof node.getBoundingClientRect !== 'function') return false;
    const fontSizePx = parseFloat(getComputedStyle(node).fontSize);
    return node.getBoundingClientRect().height > fontSizePx * 1.5;
  }

  // The last successfully computed reading, kept around so
  // syncReadoutWrap() can re-render on a pure resize (no recompute()) —
  // null while showPlaceholder() is showing "—", so a resize during a
  // mid-edit input never tries to re-render stale numbers over it.
  let lastElevValue = null;
  let lastWindValue = null;
  let lastDecimals = 0;

  // Elevation and windage read as a matched pair — if a narrow container
  // and/or a long value forces one to wrap its sign onto its own line
  // while the other still fits on one, force the other to break the same
  // way rather than leaving the pair visually lopsided. Always starts
  // from an unforced render of both (not an incremental patch) so a
  // widening resize un-forces a break exactly as readily as a narrowing
  // one imposes it.
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
  // empty while retyping it) or otherwise produces a non-finite result —
  // "—" everywhere rather than a stray "NaN" reaching the screen.
  function showPlaceholder() {
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

  // Everything computeImpact() needs except losAngleDeg/targetRangeM —
  // those two vary per target (the dialed one below, and every other
  // target's own stored values for the Range Card tab, see
  // buildRangeCardRows()), everything else is shared "current conditions."
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
      windAngle: wind.getAngle()
    };
  }

  // The one shot solve, factored out so both the Target tab's own single
  // readout and the Range Card tab's per-target rows (each with their own
  // rangeM/losAngleDeg, same shared conditions otherwise) go through the
  // exact same math — returns null on anything unsolvable (same cases
  // showPlaceholder() used to catch inline) rather than throwing, so a
  // Range Card loop over several targets can skip just the bad one.
  function solveClicks(nominalStateBase, targetRangeM, losAngleDeg) {
    const nominalState = { ...nominalStateBase, losAngleDeg };
    let result;
    try {
      result = computeImpact(nominalState, targetRangeM);
    } catch {
      return null;
    }
    if (![result.dropCm, result.windageCm, result.velocity, result.tof].every(Number.isFinite)) return null;

    let elevValue;
    let windValue;
    let decimals;
    if (outputUnit === 'clicks') {
      const clickSettings = rifle.getClickSettings();
      elevValue = Math.round(-clicksForOffset(result.dropCm, clickSettings.vertical, clickSettings.unit, targetRangeM));
      windValue = Math.round(clicksForOffset(result.windageCm, clickSettings.horizontal, clickSettings.unit, targetRangeM));
      decimals = 0;
    } else {
      // Click value of 1 in the fixed angular unit — same trick
      // trajectory-columns.js's own elevMrad/elevMOA columns use, sidestepping
      // the rifle's own scope click value entirely.
      const angularUnit = OUTPUT_ANGULAR_UNIT[outputUnit];
      elevValue = -clicksForOffset(result.dropCm, 1, angularUnit, targetRangeM);
      windValue = clicksForOffset(result.windageCm, 1, angularUnit, targetRangeM);
      decimals = 1;
    }
    if (![elevValue, windValue].every(Number.isFinite)) return null;
    return { elevValue, windValue, decimals, result };
  }

  // range/LoS display string for one target's row — same targetRange
  // field/unit convention every other distance value in this app uses,
  // but always rounded to a whole number: the row-count budget/font sizes
  // in the Range Card table are tuned for a compact value column, and
  // this table is a glance-at overview rather than a precision field.
  function formatRangeDisplay(rangeM) {
    const distanceUnit = currentUnit('distance');
    const choice = unitChoice('targetRange', distanceUnit) || UNIT_GROUPS.distance.choices.find((c) => c.unit === UNIT_GROUPS.distance.defaultUnit);
    return `${Math.round(engineToDisplay('targetRange', rangeM, choice.unit))} ${choice.label}`;
  }

  function buildRangeCardRows(nominalStateBase) {
    if (!activeLocation) return [];
    return activeLocation.targets
      .map((target, index) => {
        const solved = solveClicks(nominalStateBase, target.rangeM, target.losAngleDeg);
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

  function refreshRangeCard(nominalStateBase) {
    rangeCard.refresh({ location: activeLocation, rows: buildRangeCardRows(nominalStateBase), activeTargetId });
  }

  function recompute() {
    updateConditions();
    detachIfHandEdited();
    const nominalStateBase = buildNominalStateBase();
    const targetRangeM = targetRangeField.getEngineValue();
    const solved = solveClicks(nominalStateBase, targetRangeM, losAngleField.getEngineValue());
    if (!solved) {
      showPlaceholder();
      refreshRangeCard(nominalStateBase);
      return;
    }

    const velocityUnit = getUnit('velocity');
    const velocityChoice = unitChoice('muzzleVelocity', velocityUnit);
    const displayVelocity = engineToDisplay('muzzleVelocity', solved.result.velocity, velocityUnit);

    const massKg = cartridge.getValues().massKg;
    const energyJ = 0.5 * massKg * solved.result.velocity * solved.result.velocity;
    const energyUnit = getUnit('energy');
    const energyChoice = unitChoice('energy', energyUnit);
    const displayEnergy = engineToDisplay('energy', energyJ, energyUnit);

    if (![displayVelocity, displayEnergy].every(Number.isFinite)) {
      showPlaceholder();
      refreshRangeCard(nominalStateBase);
      return;
    }

    renderReadout(solved.elevValue, solved.windValue, solved.decimals);
    tofValue.textContent = `${solved.result.tof.toFixed(2)} ${t('rangeSolver.secondsUnit')}`;
    velocityValue.textContent = `${displayVelocity.toFixed(0)} ${velocityChoice.label}`;
    energyValue.textContent = `${displayEnergy.toFixed(0)} ${energyChoice.label}`;
    refreshRangeCard(nominalStateBase);
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
    wrapResizeObserver?.disconnect();
    if (wrapSyncFrame !== null) cancelAnimationFrame(wrapSyncFrame);
    rangeCard.dispose();
  };
}
