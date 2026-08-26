// Full-screen photo-marking workspace behind the "Continue marking"/"Add
// target" entry points in rifle-precision-view.js, handed off via
// rifle-precision-nav.js's one-shot setPendingMarking()/takePendingMarking()
// (same reasoning as location-placement-view.js's own handoff — the hash
// router has no query params).
//
// Interaction model: every already-placed point (both calibration points,
// the active group's own point of aim, the active group's own shots) is a
// draggable `.photo-viewport-marker` for as long as it's relevant — there
// is no "confirm to place" step anywhere any more, and (per the plan's
// resolved drag-scope decision) only the *active* group's own points are
// ever draggable; every other group's point of aim renders as the
// existing static reference dot. Every mutation (a new point, a drag
// update, a delete) calls saveRiflePrecisionProject() immediately
// (autosave, same as the rest of this tool). The one exception is
// leaving the calibration step itself: once both points and a real
// length are set, an explicit "Done calibrating" button (not an
// auto-advance) moves on to point-of-aim/idle, so re-touching a point or
// the length while double-checking a calibration never silently ends
// the step.
//
// Local per-target state is just `mode` (which step's UI/controls are
// showing: 'calibration' | 'poa' | 'shot' | 'deleteImpact' | 'idle') and
// `activeGroupId` — there's no local "uncommitted point" the way the
// previous confirm-button-driven version needed, since placing IS the
// action now. photoViewport() is only ever constructed once per mount, so
// its one onMarkerMove callback (handleTap below) has to dispatch off the
// *current* `mode`/`activeGroupId` (read live via closure) rather than
// being swapped out per state.
//
// Multiple `.photo-viewport-marker` elements coexist here (both
// calibration points, the active group's own point of aim, and every one
// of the active group's own shots) — photo-viewport.js's own pointer
// hit-test naturally finds whichever one is literally under the pointer
// for a given drag, and passes it back as onMarkerMove's second argument
// so this file can tell them apart; each marker carries a
// `data-point-role` (and, for shots, a `data-shot-index`) for that
// routing — see handleTap().
import { el, clear } from '../dom.js';
import { svgEl } from '../svg.js';
import { t } from '../i18n.js';
import { findRiflePrecisionProjectById, saveRiflePrecisionProject } from '../rifle-precision-library.js';
import { generateUserId } from '../user-library.js';
import { photoViewport } from '../ui/locations/photo-viewport.js';
import { groupSelector } from '../ui/rifle-precision/group-selector.js';
import {
  setMarkingMode, takePendingMarking, registerMarkingHandlers, setActiveProjectId
} from '../rifle-precision-nav.js';
import { computeGroupStats, computeScale } from '../engine/rifle-precision-stats.js';
import { UNIT_GROUPS, SMALL_LENGTH_PRECISION_DECIMALS, unitChoice, engineToDisplay } from '../units.js';
import { getUnit } from '../prefs.js';
import { COLOR_POOLED_SHOT, COLOR_POA, COLOR_POI, COLOR_CALIBRATION } from '../ui/rifle-precision/marker-style.js';
import { exportGroupOverviewImage } from '../rifle-precision-photo-export.js';

// Same formatLengthMm() display-unit conversion pattern as
// rifle-precision-view.js's/rifle-precision-analysis-view.js's own copies
// (not imported — small enough pure functions that a third copy here
// matches this app's existing per-view convention). Used for the extreme-
// spread line's own legend — the calibration line's legend, by contrast,
// is always a literal millimetre value (see setCalibrationLabelValue()),
// since that's exactly what the user typed into the calibration step.
function formatLengthMm(valueMm) {
  const displayUnit = getUnit('smallLength');
  const choice = unitChoice('bulletLength', displayUnit) || UNIT_GROUPS.smallLength.choices.find((c) => c.unit === UNIT_GROUPS.smallLength.defaultUnit);
  const decimals = SMALL_LENGTH_PRECISION_DECIMALS[choice.unit] ?? choice.decimals;
  return `${engineToDisplay('bulletLength', valueMm, choice.unit).toFixed(decimals)} ${choice.label}`;
}

// Same per-photo pan/zoom persistence idea as location-placement-view.js's
// own savedViewports Map, keyed by target id here instead of location id —
// plain in-memory, not persisted, doesn't need to survive a reload.
const savedViewports = new Map();

function crosshairGlyph(size = 30) {
  return svgEl('svg', { viewBox: '0 0 30 30', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
    svgEl('circle', { cx: '15', cy: '15', r: '10' }),
    svgEl('line', { x1: '15', y1: '2', x2: '15', y2: '28' }),
    svgEl('line', { x1: '2', y1: '15', x2: '28', y2: '15' })
  ]);
}

function placedDot() {
  return el('span', { class: 'target-photo-overlay-pin-dot' });
}

function positionAt(node, point) {
  node.style.left = `${(point.x * 100).toFixed(3)}%`;
  node.style.top = `${(point.y * 100).toFixed(3)}%`;
}

// A target has calibrated once both ruler points and a positive real
// length are all set — same three-condition gate rifle-precision-stats.js's
// own computeScale() uses.
function isCalibrated(target) {
  const cal = target.calibration;
  return !!(cal && cal.point1 && cal.point2 && cal.realLengthMm);
}

// Where a freshly-mounted (or freshly-resumed-after-a-mutation) view
// should start: resume mid-calibration if it isn't finished yet (both
// points and a real length all set — a page reload mid-calibration,
// say), otherwise go straight to placing a first group once calibrated,
// or idle (group switcher) once there's at least one group already.
function initialMode(target) {
  if (!isCalibrated(target)) return 'calibration';
  return target.groups.length === 0 ? 'poa' : 'idle';
}

export function mount(container) {
  clear(container);

  const pending = takePendingMarking();
  const project = pending ? findRiflePrecisionProjectById(pending.projectId) : null;
  const target = project ? project.targets.find((tg) => tg.id === pending.targetId) : null;
  // No handoff staged (a direct refresh/back-navigation) or the project/
  // target it names no longer resolves — same defensive fallback
  // location-placement-view.js applies to a stale locationId.
  if (!pending || !project || !target || !target.photo) {
    location.hash = '#/rifle-precision';
    return () => {};
  }

  setActiveProjectId(project.id);
  setMarkingMode(true);

  function currentTarget() {
    const fresh = findRiflePrecisionProjectById(project.id);
    return fresh ? fresh.targets.find((tg) => tg.id === target.id) : null;
  }

  // Every mutation goes through here — re-reads the project fresh (so a
  // rapid sequence of taps/drags never clobbers a previous one under a
  // stale closure) and writes the one updated target back into it.
  function persistTarget(updatedTarget) {
    const fresh = findRiflePrecisionProjectById(project.id);
    const targets = fresh.targets.map((tg) => (tg.id === updatedTarget.id ? updatedTarget : tg));
    saveRiflePrecisionProject({ ...fresh, targets });
  }

  let mode = initialMode(target);
  let activeGroupId = target.groups.length ? target.groups[target.groups.length - 1].id : null;
  // The calibration length legend <div> currently in markersLayer, if
  // any — reachable both from render()'s own full rebuild (renderCalibration/
  // renderCalibrationLine, which (re)create it) and from the length
  // input's own 'input' handler (which only ever updates this same node
  // in place — see the module comment on why that handler doesn't call
  // render()). Reset to null at the top of every render().
  let calibrationLabelEl = null;

  // The one callback photoViewport() is ever given — dispatches on the
  // *current* `mode` (tap-on-empty-background calls) or on the dragged
  // marker's own role (drag-step calls, identified via markerEl's second
  // argument) rather than being swapped out per state, since photoViewport
  // is only constructed once below.
  function handleTap(point, markerEl) {
    const t2 = currentTarget();
    if (!t2) return;

    if (markerEl) {
      const role = markerEl.getAttribute('data-point-role');
      if (role === 'cal1') {
        persistTarget({ ...t2, calibration: { ...t2.calibration, point1: point } });
        render();
      } else if (role === 'cal2') {
        persistTarget({ ...t2, calibration: { ...t2.calibration, point2: point } });
        render();
      } else if (role === 'poa') {
        const groups = t2.groups.map((g) => (g.id === activeGroupId ? { ...g, poa: point } : g));
        persistTarget({ ...t2, groups });
        render();
      } else if (role === 'shot') {
        const shotIndex = parseInt(markerEl.getAttribute('data-shot-index'), 10);
        const groups = t2.groups.map((g) => (g.id === activeGroupId
          ? { ...g, shots: g.shots.map((s, i) => (i === shotIndex ? point : s)) }
          : g));
        persistTarget({ ...t2, groups });
        render();
      }
      return;
    }

    // A plain tap on empty photo background — what it does depends on
    // the current step. 'idle' and 'deleteImpact' intentionally have no
    // branch here: per the plan's resolved delete-impact ambiguity, a tap
    // anywhere that isn't an actual impact button must do nothing and
    // leave delete-mode active; idle mode has no active marker either.
    if (mode === 'calibration') {
      if (!t2.calibration.point1) {
        persistTarget({ ...t2, calibration: { ...t2.calibration, point1: point } });
        render();
      } else if (!t2.calibration.point2) {
        persistTarget({ ...t2, calibration: { ...t2.calibration, point2: point } });
        render();
      }
      // Both points already placed — nothing left to tap-place; the
      // remaining calibration step is typing the real-world length.
    } else if (mode === 'poa') {
      const newGroup = { id: generateUserId('rp-group'), poa: point, shots: [] };
      persistTarget({ ...t2, groups: [...t2.groups, newGroup] });
      activeGroupId = newGroup.id;
      mode = 'shot';
      render();
    } else if (mode === 'shot') {
      const group = t2.groups.find((g) => g.id === activeGroupId);
      if (!group) return;
      const groups = t2.groups.map((g) => (g.id === group.id ? { ...g, shots: [...g.shots, point] } : g));
      persistTarget({ ...t2, groups });
      render();
    }
  }

  const viewport = photoViewport({
    photo: target.photo,
    initialViewport: savedViewports.get(target.id),
    onMarkerMove: handleTap
  });

  const stepHeading = el('h4', { class: 'rp-step-heading' });
  const hint = el('p', { class: 'hint' });
  const controls = el('div', { class: 'rifle-precision-marking-controls' });

  function stepHeadingKeyFor(currentMode) {
    if (currentMode === 'calibration') return 'riflePrecision.stepCalibration';
    if (currentMode === 'poa') return 'riflePrecision.stepPointOfAim';
    if (currentMode === 'shot') return 'riflePrecision.stepImpacts';
    if (currentMode === 'deleteImpact') return 'riflePrecision.stepDeleteImpact';
    return 'riflePrecision.stepGroups'; // idle
  }

  function hintFor(currentMode, t2) {
    if (currentMode === 'calibration') {
      return t(t2.calibration.point1 ? 'riflePrecision.calibrationHint2' : 'riflePrecision.calibrationHint1');
    }
    if (currentMode === 'poa') return t('riflePrecision.poaHint');
    if (currentMode === 'shot') return t('riflePrecision.shotHint');
    if (currentMode === 'deleteImpact') return t('riflePrecision.deleteImpactHint');
    return t('riflePrecision.idleHint');
  }

  // `color` matches the precision-report diagram's own palette per role
  // (see marker-style.js) — set inline (the crosshair glyph's own SVG
  // strokes are `currentColor`) rather than via a CSS class, since the
  // same crosshair shape is shared by three different roles/colors.
  function renderDraggableMarker(point, role, color) {
    const marker = el('div', { class: 'photo-viewport-marker', 'data-point-role': role }, [crosshairGlyph()]);
    marker.style.color = color;
    positionAt(marker, point);
    viewport.markersLayer.appendChild(marker);
  }

  function renderStaticDot(point, label) {
    const wrapper = el('div', { class: 'target-pin-other-marker' }, label ? [placedDot(), label] : [placedDot()]);
    positionAt(wrapper, point);
    viewport.markersLayer.appendChild(wrapper);
  }

  function groupLabelFor(index) {
    return el('span', { class: 'target-photo-overlay-pin-label', text: t('riflePrecision.groupLabel', { n: index + 1 }) });
  }

  // A plain circle sized to the rifle's own caliber, not a fixed on-screen
  // size — see .rp-impact-marker's own CSS comment for the full reasoning.
  // `scale` (px/mm, computeScale(t2)) and `caliberMm` are both guaranteed
  // by the time shots are ever placed: calibration always completes
  // before 'shot' mode is reachable (see initialMode()), and caliberMm is
  // a required field on every saved project (project-form.js's own
  // standard caliber field). The width/height % are computed separately
  // (not a single "diameter %" reused for both) because the marker's
  // percentage box resolves against the *container's* width and height
  // independently, which only coincide in pixels when the photo itself is
  // square — using the same % for both would render an ellipse whenever
  // it isn't.
  function renderImpactMarker(point, index, t2) {
    const marker = el('div', {
      class: 'photo-viewport-marker rp-impact-marker',
      'data-point-role': 'shot',
      'data-shot-index': String(index)
    });
    marker.style.background = COLOR_POOLED_SHOT;
    const scale = computeScale(t2);
    const caliberMm = project.caliberMm;
    if (scale && caliberMm > 0) {
      const diameterPx = caliberMm * scale;
      marker.style.width = `${(diameterPx / t2.photoWidth) * 100}%`;
      marker.style.height = `${(diameterPx / t2.photoHeight) * 100}%`;
    } else {
      // Defensive fallback (shouldn't happen — see above) — a small fixed
      // dot rather than a marker with no visible size at all.
      marker.style.width = '1.5%';
      marker.style.height = '1.5%';
    }
    positionAt(marker, point);
    viewport.markersLayer.appendChild(marker);
  }

  // The active group's own extreme-spread line (between the two most
  // distant impacts) and average point-of-impact marker — live, real-time
  // (recomputed on every render(), so a new/dragged shot updates them
  // immediately), shown whenever the active group's shots are (shot/idle/
  // deleteImpact modes — see renderActiveAndReferenceGroups() below), not
  // just while actively placing more of them. Both need at least 2 shots
  // (computeGroupStats() returns null otherwise — nothing to measure an
  // extreme spread from), matching the target-row summary line's own
  // (rifle-precision-view.js's groupSummaryLine()) use of the same
  // function.
  function renderGroupOverlay(group, t2) {
    const stats = computeGroupStats(group, t2);
    if (!stats || stats.extremePairIndices[0] == null || stats.extremePairIndices[1] == null) return;

    const [i1, i2] = stats.extremePairIndices;
    const a = group.shots[i1];
    const b = group.shots[i2];
    const svg = svgEl('svg', { class: 'rp-extreme-spread-line-svg', viewBox: '0 0 100 100', preserveAspectRatio: 'none' }, [
      svgEl('line', {
        x1: (a.x * 100).toFixed(3), y1: (a.y * 100).toFixed(3),
        x2: (b.x * 100).toFixed(3), y2: (b.y * 100).toFixed(3),
        stroke: COLOR_POOLED_SHOT
      })
    ]);
    viewport.markersLayer.appendChild(svg);

    // Same commuting-with-averaging reasoning as computeGroupStats()'s own
    // poiMm (a per-axis linear scale from relative coords to mm) — the
    // relative-space centroid places at the exact same point, without
    // needing to convert through mm and back for on-screen positioning.
    const poiRel = {
      x: group.shots.reduce((sum, s) => sum + s.x, 0) / group.shots.length,
      y: group.shots.reduce((sum, s) => sum + s.y, 0) / group.shots.length
    };
    const poiMarker = el('div', { class: 'rp-poi-marker' });
    poiMarker.style.background = COLOR_POI;
    positionAt(poiMarker, poiRel);
    viewport.markersLayer.appendChild(poiMarker);

    // The label is always appended last (on top of the line and, since
    // they can land close together or overlap outright, the POI marker
    // too) — everything else in this overlay group, plus every other
    // marker rendered before renderGroupOverlay() is ever called (see
    // renderActiveAndReferenceGroups() below), so it reads clearly
    // regardless of what else is under it.
    const label = el('div', { class: 'rp-extreme-spread-length-label', text: `${t('riflePrecision.esLabel')} ${formatLengthMm(stats.extremeSpreadMm)}` });
    positionAt(label, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    viewport.markersLayer.appendChild(label);
  }

  // Delete-impact mode's own shot rendering — a real <button>, not a
  // draggable div: photoViewport.js's own gesture handling automatically
  // excludes real buttons from pan/drag capture, so this button's own
  // click fires natively without going through handleTap()/onMarkerMove
  // at all, which is exactly what keeps "tap anything that isn't a shot
  // button = no-op, stay in delete mode" true for free elsewhere.
  function renderDeleteShotButton(point, index) {
    const number = el('span', { class: 'rp-shot-number', text: String(index + 1) });
    const button = el('button', { class: 'rp-shot-marker-delete' }, [number]);
    positionAt(button, point);
    button.addEventListener('click', () => {
      const t2 = currentTarget();
      if (!t2) return;
      const groups = t2.groups.map((g) => (g.id === activeGroupId
        ? { ...g, shots: g.shots.filter((_, i) => i !== index) }
        : g));
      persistTarget({ ...t2, groups });
      mode = 'shot';
      render();
    });
    viewport.markersLayer.appendChild(button);
  }

  // Every existing group's point of aim, statically (used by 'poa' mode,
  // where there's no "active" group yet in the meaningful sense — the new
  // one doesn't exist until the placing tap creates it).
  function renderReferenceGroups(t2) {
    t2.groups.forEach((group, index) => {
      if (!group.poa) return;
      renderStaticDot(group.poa, groupLabelFor(index));
    });
  }

  // 'shot'/'idle'/'deleteImpact' modes: every group's point of aim, plus
  // the active group's own shots. Per the plan's resolved drag-scope
  // decision, only the active group's own points are ever draggable — the
  // active group's point of aim renders as a draggable marker (unless
  // shotsAsButtons/delete-mode is active, in which case *nothing* is
  // draggable, matching "anything that isn't a delete-target button does
  // nothing" for the point of aim too), every other group's stays a
  // static reference dot; the active group's shots render either as
  // draggable markers or as delete-mode buttons, one or the other never
  // both; other groups' shots were never shown here (unchanged from
  // before this rework).
  function renderActiveAndReferenceGroups(t2, { shotsAsButtons }) {
    t2.groups.forEach((group, index) => {
      if (!group.poa) return;
      if (group.id === activeGroupId && !shotsAsButtons) {
        renderDraggableMarker(group.poa, 'poa', COLOR_POA);
      } else {
        renderStaticDot(group.poa, groupLabelFor(index));
      }
    });

    const activeGroup = t2.groups.find((g) => g.id === activeGroupId);
    if (!activeGroup) return;
    activeGroup.shots.forEach((shot, index) => {
      if (shotsAsButtons) renderDeleteShotButton(shot, index);
      else renderImpactMarker(shot, index, t2);
    });
    renderGroupOverlay(activeGroup, t2);
  }

  function positionCalibrationLabel(node, cal) {
    positionAt(node, { x: (cal.point1.x + cal.point2.x) / 2, y: (cal.point1.y + cal.point2.y) / 2 });
  }

  // Shared by renderCalibrationLine() (full render, e.g. after a drag or
  // after committing a typed length) and the length input's own live
  // 'input' handler (a lightweight in-place update — see renderCalibration()'s
  // own comment on why that path doesn't call the full render()).
  function setCalibrationLabelValue(lengthMm) {
    if (!calibrationLabelEl) return;
    if (lengthMm) {
      calibrationLabelEl.style.display = '';
      calibrationLabelEl.textContent = `${lengthMm} mm`;
    } else {
      calibrationLabelEl.style.display = 'none';
    }
  }

  // The live-updating line between the two calibration points (an
  // absolutely-positioned SVG overlay, viewBox stretched non-uniformly
  // onto the same box every percentage-positioned marker in this file
  // already uses — see the .rp-calibration-line-svg CSS comment for why
  // that lands at identical pixels to two independently
  // percentage-positioned dots) plus its plain-HTML length legend
  // (deliberately not SVG text, which would skew under that same
  // non-uniform scaling).
  function renderCalibrationLine(cal) {
    const svg = svgEl('svg', { class: 'rp-calibration-line-svg', viewBox: '0 0 100 100', preserveAspectRatio: 'none' }, [
      svgEl('line', {
        x1: (cal.point1.x * 100).toFixed(3), y1: (cal.point1.y * 100).toFixed(3),
        x2: (cal.point2.x * 100).toFixed(3), y2: (cal.point2.y * 100).toFixed(3),
        stroke: COLOR_CALIBRATION
      })
    ]);
    viewport.markersLayer.appendChild(svg);

    calibrationLabelEl = el('div', { class: 'rp-calibration-length-label' });
    positionCalibrationLabel(calibrationLabelEl, cal);
    viewport.markersLayer.appendChild(calibrationLabelEl);
    setCalibrationLabelValue(cal.realLengthMm || null);
  }

  function renderCalibration(t2) {
    const cal = t2.calibration;
    if (cal.point1) renderDraggableMarker(cal.point1, 'cal1', COLOR_CALIBRATION);
    if (cal.point2) renderDraggableMarker(cal.point2, 'cal2', COLOR_CALIBRATION);
    if (!cal.point1 || !cal.point2) return;

    renderCalibrationLine(cal);

    // The real-length input is always visible once both points exist —
    // no separate "confirm point 2" gate any more. Its value is persisted
    // on 'change' (blur/Enter) rather than on every keystroke: render()
    // rebuilds this entire controls block (including this very <input>)
    // on every call, so persisting — and therefore re-rendering — on
    // every 'input' keystroke would tear down and recreate the focused
    // field mid-type (losing focus/cursor position in a real browser).
    // The length *legend* still updates live as the plan asks: its own
    // 'input' handler below updates the already-in-DOM label element
    // directly in place, without going through the full render().
    //
    // Advancing past calibration is deliberately NOT automatic (no more
    // "first valid length typed = auto-advance") — the user must press
    // the explicit Done button below once both points and a length are
    // set, so a typo or a not-yet-final length never silently ends the
    // step out from under them.
    const lengthInput = el('input', { type: 'number', id: 'riflePrecisionCalibrationLength', min: '0.1', step: '0.1' });
    if (cal.realLengthMm) lengthInput.value = String(cal.realLengthMm);

    // Always created (both points already exist by this point in the
    // function), its display toggled live rather than gated by a full
    // render() — same in-place-update reasoning as the length legend
    // above: appearing/disappearing on every keystroke needs to happen
    // without tearing down the still-focused lengthInput.
    const doneButton = el('button', { i18n: 'riflePrecision.calibrationDoneButton' });
    doneButton.style.display = isCalibrated(t2) ? '' : 'none';
    doneButton.addEventListener('click', () => {
      const fresh = currentTarget();
      if (!fresh) return;
      activeGroupId = fresh.groups.length ? fresh.groups[fresh.groups.length - 1].id : null;
      mode = fresh.groups.length === 0 ? 'poa' : 'idle';
      render();
    });

    lengthInput.addEventListener('input', () => {
      const len = parseFloat(lengthInput.value);
      const valid = Number.isFinite(len) && len > 0;
      setCalibrationLabelValue(valid ? len : null);
      doneButton.style.display = valid ? '' : 'none';
    });
    lengthInput.addEventListener('change', () => {
      const len = parseFloat(lengthInput.value);
      if (!(len > 0)) return;
      const fresh = currentTarget();
      if (!fresh) return;
      persistTarget({ ...fresh, calibration: { ...fresh.calibration, realLengthMm: len } });
      render();
    });

    controls.appendChild(el('div', { class: 'field' }, [
      el('label', { i18n: 'riflePrecision.calibrationLengthLabel' }),
      lengthInput
    ]));
    controls.appendChild(doneButton);
  }

  function renderPoaMode(t2) {
    renderReferenceGroups(t2);
    if (t2.groups.length > 0) {
      const cancelButton = el('button', { class: 'secondary', i18n: 'riflePrecision.cancelAddGroup' });
      cancelButton.addEventListener('click', () => { mode = 'idle'; render(); });
      controls.appendChild(cancelButton);
    }
  }

  function renderShotMode(t2) {
    renderActiveAndReferenceGroups(t2, { shotsAsButtons: false });
    const group = t2.groups.find((g) => g.id === activeGroupId);

    const deleteImpactButton = el('button', { class: 'secondary', i18n: 'riflePrecision.deleteImpactButton' });
    deleteImpactButton.disabled = !group || group.shots.length === 0;
    deleteImpactButton.addEventListener('click', () => { mode = 'deleteImpact'; render(); });

    const doneButton = el('button', { i18n: 'riflePrecision.doneAddingShots' });
    doneButton.addEventListener('click', () => { mode = 'idle'; render(); });

    controls.appendChild(deleteImpactButton);
    controls.appendChild(doneButton);
  }

  function renderDeleteImpactMode(t2) {
    renderActiveAndReferenceGroups(t2, { shotsAsButtons: true });
    const cancelButton = el('button', { class: 'secondary', i18n: 'riflePrecision.cancelDeleteImpactButton' });
    cancelButton.addEventListener('click', () => { mode = 'shot'; render(); });
    controls.appendChild(cancelButton);
  }

  function sanitizeForFilename(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Exports the *active* group's own overview PNG — calibration line/
  // label, PoA, its shots, extreme-spread line/label, and average POI —
  // cropped to whatever the user currently has zoomed/panned to (see
  // exportGroupOverviewImage()'s own comment). The extreme-spread label
  // text is computed here (not inside the export module, which has no
  // opinion on display units) using the exact same formatLengthMm() the
  // live renderGroupOverlay() overlay itself uses, so the exported file's
  // own label always matches what's on screen.
  function saveGroupOverviewImage(t2) {
    const activeGroup = t2.groups.find((g) => g.id === activeGroupId);
    if (!activeGroup) return;
    const groupIndex = t2.groups.findIndex((g) => g.id === activeGroupId);
    const stats = computeGroupStats(activeGroup, t2);
    const extremeSpreadLabelText = stats ? `${t('riflePrecision.esLabel')} ${formatLengthMm(stats.extremeSpreadMm)}` : null;

    const rect = viewport.node.getBoundingClientRect();
    const vp = viewport.getViewport();
    const nameParts = [project.name, t2.name, `group-${groupIndex + 1}`].map(sanitizeForFilename).filter(Boolean);
    const filename = `${nameParts.join('-') || 'rifle-precision-group'}.png`;

    exportGroupOverviewImage({
      target: t2, group: activeGroup, project,
      viewport: { scale: vp.scale, tx: vp.tx, ty: vp.ty, containerWidth: rect.width, containerHeight: rect.height },
      extremeSpreadLabelText, filename
    }).catch(() => {
      // Best-effort — an image-decode failure here shouldn't break the rest of the marking view.
    });
  }

  function renderIdle(t2) {
    renderActiveAndReferenceGroups(t2, { shotsAsButtons: false });

    const selector = groupSelector({
      groups: t2.groups,
      activeGroupId,
      onSelect: (id) => { activeGroupId = id; mode = 'shot'; render(); }
    });
    controls.appendChild(selector.node);

    const saveOverviewButton = el('button', { class: 'secondary', i18n: 'riflePrecision.saveGroupOverviewButton' });
    saveOverviewButton.addEventListener('click', () => saveGroupOverviewImage(t2));
    controls.appendChild(saveOverviewButton);

    const addGroupButton = el('button', { i18n: 'riflePrecision.addGroupButton' });
    addGroupButton.addEventListener('click', () => { mode = 'poa'; render(); });
    controls.appendChild(addGroupButton);
  }

  // Re-entering the calibration step no longer wipes the existing points/
  // length — renderCalibration() already renders whatever's currently on
  // the target (same code path the initial "resume mid-calibration" mount
  // case uses), so the two ruler points and the length input all come up
  // pre-filled at their current values, ready to drag/edit in place. That
  // also means nothing destructive happens here any more, so there's no
  // confirm() gate — Done calibrating (which requires no changes) is
  // always available as a safe no-op way back out.
  function renderRecalibrateButton() {
    const button = el('button', { class: 'secondary', i18n: 'riflePrecision.recalibrateButton' });
    button.addEventListener('click', () => { mode = 'calibration'; render(); });
    controls.appendChild(button);
  }

  function render() {
    const t2 = currentTarget();
    if (!t2) return; // target/project deleted from under us — nothing left to show
    clear(viewport.markersLayer);
    clear(controls);
    calibrationLabelEl = null;
    stepHeading.textContent = t(stepHeadingKeyFor(mode));
    hint.textContent = hintFor(mode, t2);

    if (mode === 'calibration') renderCalibration(t2);
    else if (mode === 'poa') renderPoaMode(t2);
    else if (mode === 'shot') renderShotMode(t2);
    else if (mode === 'deleteImpact') renderDeleteImpactMode(t2);
    else renderIdle(t2);

    // Available whenever there's an actual calibration to revisit — not
    // mid-calibration itself.
    if (mode !== 'calibration') renderRecalibrateButton();
  }

  container.appendChild(el('div', { class: 'rifle-precision-marking-page' }, [stepHeading, hint, viewport.node, controls]));
  render();

  const unregister = registerMarkingHandlers({
    onZoomIn: viewport.zoomIn,
    onZoomOut: viewport.zoomOut
  });

  return () => {
    savedViewports.set(target.id, viewport.getViewport());
    unregister();
    setMarkingMode(false);
  };
}
