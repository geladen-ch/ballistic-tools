// Full-screen photo view behind two related flows, both handed off via
// location-placement-nav.js's one-shot setPendingPlacement():
//   - placement mode (selectMode:false, targetId set) — reachable from
//     locations-view.js's "Place it" buttons: drag/tap to move that one
//     target's own pin, other placed targets shown as static reference
//     dots, nothing persisted until the nav bar's Done is pressed.
//   - select mode (selectMode:true, targetId:null) — reachable from
//     Range Solver's own photo-picker icon: every placed target is a
//     tap-to-select pin (immediate — no Done needed), unplaced ones
//     stack as chips top-left; Done alone just returns, unchanged.
// The nav bar itself (Zoom In/Zoom Out/Done — see nav-rail.js's/
// nav-tabbar.js's own buildPlacementMode()) lives outside this view, so
// it reaches in via registerPlacementHandlers() rather than local clicks.
import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import { loadUserLocations, saveUserLocation } from '../location-library.js';
import { saveRangeSolverLocationState, saveRangeSolverTargetState } from '../range-solver-state.js';
import { photoViewport } from '../ui/locations/photo-viewport.js';
import { formatTargetSummary } from '../ui/locations/target-summary.js';
import { crosshairGlyph, placedDot } from '../ui/locations/target-pin-glyphs.js';
import {
  setPlacementMode, takePendingPlacement, registerPlacementHandlers
} from '../location-placement-nav.js';

// Select mode's own tap-to-select pins/chips — range/angle only, same as
// the retired target-photo-overlay.js's original label, except a target's
// own name is now prepended when it has one: a default (unnamed) target's
// auto-numbered "Target N" is uninformative here (it's not calling out
// anything a shooter picked), so it's left off entirely rather than
// shown like a real name would be — unlike placement mode's own
// referenceLabel() below, which always shows *a* name, default or not,
// since there every dot needs some caption to distinguish it from its
// neighbors.
function pickerLabelParts(target) {
  const summary = formatTargetSummary(target.rangeM, target.losAngleDeg, { roundRange: true });
  return target.name ? [el('strong', { text: target.name }), ` ${summary}`] : [summary];
}
function targetLabel(target) {
  return el('span', { class: 'target-photo-overlay-pin-label' }, pickerLabelParts(target));
}

// Placement mode's own "other already-placed target" reference dots —
// includes the target's name (or its default numbered one), matching the
// retired target-pin-field.js's own otherTargets label exactly.
function referenceLabel(target, displayName) {
  return el('span', { class: 'target-photo-overlay-pin-label', text: `${displayName} — ${formatTargetSummary(target.rangeM, target.losAngleDeg, { roundRange: true })}` });
}

function positionAt(node, coords) {
  node.style.left = `${(coords.x * 100).toFixed(3)}%`;
  node.style.top = `${(coords.y * 100).toFixed(3)}%`;
}

// Zoom/pan is otherwise reset on every mount (a fresh photoViewport()
// instance each time) — this module-level Map, keyed by locationId, is
// what makes it stick across a Done-and-come-back-in round trip instead,
// same "outlives any single mount's own closure" reasoning as every
// other piece of nav state in this app. Shared by both modes (placement
// and select) since either can reasonably reopen the same location's
// photo mid-session and expect to find it the way they left it; plain
// in-memory rather than persisted is deliberate too — same as
// location-placement-nav.js's own state, none of this needs to survive
// a reload.
const savedViewports = new Map();

export function mount(container) {
  clear(container);

  const pending = takePendingPlacement();
  const loc = pending ? loadUserLocations().find((l) => l.id === pending.locationId) : null;
  // No handoff staged (a direct refresh/back-navigation) or the location/
  // photo it names no longer resolves — same defensive fallback
  // range-solver-view.js already applies to a stale locationId.
  if (!pending || !loc || !loc.photo) {
    location.hash = '#' + (pending ? pending.returnPath : '/locations');
    return () => {};
  }

  setPlacementMode(true, pending.returnPath);

  function goBack() {
    location.hash = '#' + pending.returnPath;
  }

  function selectTarget(target) {
    saveRangeSolverLocationState({ locationId: loc.id, targetId: target.id });
    saveRangeSolverTargetState({ rangeM: target.rangeM, losAngleDeg: target.losAngleDeg });
    goBack();
  }

  let coords = null; // local, uncommitted — only meaningful in placement mode
  let clearButton = null;
  let marker = null;
  let targetInfo = null; // placement mode only — see below

  const viewport = photoViewport({
    photo: loc.photo,
    initialViewport: savedViewports.get(loc.id),
    onMarkerMove: pending.selectMode ? undefined : (point) => { coords = point; renderMarker(); }
  });

  function renderMarker() {
    if (!marker) return;
    if (coords) {
      marker.style.display = '';
      positionAt(marker, coords);
    } else {
      marker.style.display = 'none';
    }
    if (clearButton) clearButton.disabled = !coords;
  }

  const contentExtras = [];
  const hint = el('p', {
    class: 'hint',
    i18n: pending.selectMode ? 'rangeSolverLocations.photoOverlayHint' : 'rangeSolverLocations.pinFieldHint'
  });

  if (pending.selectMode) {
    for (const target of loc.targets) {
      if (!target.coords) continue;
      const pin = el('button', { type: 'button', class: 'target-photo-overlay-pin' }, [placedDot(), targetLabel(target)]);
      positionAt(pin, target.coords);
      pin.addEventListener('click', () => selectTarget(target));
      viewport.markersLayer.appendChild(pin);
    }
    const unplaced = loc.targets.filter((target) => !target.coords);
    if (unplaced.length) {
      const stack = el('div', { class: 'target-photo-overlay-stack' });
      for (const target of unplaced) {
        const chip = el('button', { type: 'button', class: 'target-photo-overlay-chip' }, pickerLabelParts(target));
        chip.addEventListener('click', () => selectTarget(target));
        stack.appendChild(chip);
      }
      viewport.markersLayer.appendChild(stack);
    }
  } else {
    const targetIndex = loc.targets.findIndex((target) => target.id === pending.targetId);
    const placingTarget = targetIndex >= 0 ? loc.targets[targetIndex] : null;
    coords = placingTarget ? (placingTarget.coords ?? null) : null;

    if (placingTarget) {
      const displayName = placingTarget.name || t('rangeSolverLocations.defaultTargetName', { n: targetIndex + 1 });
      targetInfo = el('p', { class: 'location-placement-target-info' }, [
        el('strong', { text: displayName }), ` — ${formatTargetSummary(placingTarget.rangeM, placingTarget.losAngleDeg)}`
      ]);
      // Re-placing an already-placed target — open already centered on
      // its current pin (as close as the viewport's own current zoom
      // allows), same reasoning/mechanism as range-card-panel.js's own
      // centerOn() call when a target is picked from its table: onReady()
      // defers this past the photo's own decode, since centerOn() is a
      // no-op before that (see photo-viewport.js's own comment on it).
      if (placingTarget.coords) viewport.onReady(() => viewport.centerOn(placingTarget.coords));
    }

    loc.targets.forEach((target, index) => {
      if (target.id === pending.targetId || !target.coords) return;
      const displayName = target.name || t('rangeSolverLocations.defaultTargetName', { n: index + 1 });
      const dot = el('div', { class: 'target-pin-other-marker' }, [placedDot(), referenceLabel(target, displayName)]);
      positionAt(dot, target.coords);
      viewport.markersLayer.appendChild(dot);
    });

    marker = el('div', { class: 'photo-viewport-marker' }, [crosshairGlyph()]);
    viewport.markersLayer.appendChild(marker);

    clearButton = el('button', { type: 'button', class: 'secondary', i18n: 'rangeSolverLocations.removePinButton' });
    clearButton.addEventListener('click', () => { coords = null; renderMarker(); });
    contentExtras.push(clearButton);

    renderMarker();
  }

  container.appendChild(el('div', { class: 'location-placement-page' }, [hint, targetInfo, viewport.node, ...contentExtras]));

  const unregister = registerPlacementHandlers({
    onZoomIn: viewport.zoomIn,
    onZoomOut: viewport.zoomOut,
    onDone: pending.selectMode ? undefined : () => {
      const fresh = loadUserLocations().find((l) => l.id === pending.locationId);
      if (!fresh) return;
      const targets = fresh.targets.map((target) => (target.id === pending.targetId ? { ...target, coords } : target));
      saveUserLocation({ ...fresh, targets });
    }
  });

  return () => {
    savedViewports.set(loc.id, viewport.getViewport());
    unregister();
    setPlacementMode(false);
  };
}
