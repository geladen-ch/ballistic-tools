// The Fire! pane's inline target picker: the active location's photo
// with a pin per placed target (and a chip per unplaced one) — tap one to
// select that target. An always-visible sibling of location-placement-
// view.js's full-screen select mode, sharing its pin glyphs and classes
// (target-pin-glyphs.js) and the same photoViewport() pan/zoom engine.
//
// The pane only shows this for a location with targets and a photo, so
// there is no empty state here.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { photoViewport } from '../locations/photo-viewport.js';
import { createTargetLabelVisibility } from '../locations/target-label-visibility.js';
import { crosshairGlyph, placedDot } from '../locations/target-pin-glyphs.js';
import { formatTargetSummary } from '../locations/target-summary.js';
import { zoomInIcon, zoomOutIcon } from '../nav-icons.js';

function positionAt(node, coords) {
  node.style.left = `${(coords.x * 100).toFixed(3)}%`;
  node.style.top = `${(coords.y * 100).toFixed(3)}%`;
}

// Same label shape as location-placement-view.js's select-mode pins —
// range (and angle unless omitted), name first when the target has one.
function pinLabelParts(target, omitAngle) {
  const summary = formatTargetSummary(target.rangeM, target.losAngleRad, { roundRange: true, omitAngle });
  return target.name ? [el('strong', { text: target.name }), ` ${summary}`] : [summary];
}

// Zoom buttons for a mouse or trackpad, which have no pinch — unlike the
// full-screen picker, this inline one has no nav bar to hold them.
function pickerZoomControls(viewport) {
  const inBtn = el('button', {
    type: 'button', class: 'icon-button range-card-zoom-btn', 'aria-label': t('rangeSolverLocations.zoomInButton')
  }, [zoomInIcon(18)]);
  const outBtn = el('button', {
    type: 'button', class: 'icon-button range-card-zoom-btn', 'aria-label': t('rangeSolverLocations.zoomOutButton')
  }, [zoomOutIcon(18)]);
  inBtn.addEventListener('click', () => viewport.zoomIn());
  outBtn.addEventListener('click', () => viewport.zoomOut());
  return el('div', { class: 'range-card-zoom-controls' }, [inBtn, outBtn]);
}

export function targetImagePicker({ onSelectTarget }) {
  let latestActiveId = null;
  let hasRenderedOnce = false;
  // The viewport (a fresh <img>, fresh pan/zoom) is rebuilt only when the
  // location or its photo changes — not on every refresh(), which runs on
  // every wind or atmosphere change and would reset the user's pan/zoom.
  // The cache restores a location's last pan/zoom when it comes back.
  let lastLocationKey;
  let viewportInstance = null;
  let viewportLocationId = null;
  const viewportCache = new Map();
  const labelVisibility = createTargetLabelVisibility();
  const node = el('div', { class: 'range-card-picker-host fire-target-picker' });

  function renderPins(location, omitAngle) {
    if (!viewportInstance) return;
    clear(viewportInstance.markersLayer);
    labelVisibility.beginRender();
    for (const target of location.targets) {
      if (!target.coords) continue;
      const active = target.id === latestActiveId;
      const glyph = active
        ? el('span', { class: 'target-photo-overlay-pin-crosshair' }, [crosshairGlyph(22)])
        : placedDot();
      const label = el('span', { class: 'target-photo-overlay-pin-label' }, pinLabelParts(target, omitAngle));
      const pin = el('button', {
        type: 'button',
        class: 'target-photo-overlay-pin' + (active ? ' range-card-pin--active' : '')
      }, [glyph, label]);
      positionAt(pin, target.coords);
      pin.addEventListener('click', labelVisibility.bindPin(target.id, label, () => onSelectTarget(target.id)));
      viewportInstance.markersLayer.appendChild(pin);
    }
    const unplaced = location.targets.filter((target) => !target.coords);
    if (unplaced.length) {
      const stack = el('div', { class: 'target-photo-overlay-stack' });
      for (const target of unplaced) {
        const chip = el('button', {
          type: 'button',
          class: 'target-photo-overlay-chip' + (target.id === latestActiveId ? ' range-card-pin--active' : '')
        }, pinLabelParts(target, omitAngle));
        chip.addEventListener('click', () => onSelectTarget(target.id));
        stack.appendChild(chip);
      }
      viewportInstance.markersLayer.appendChild(stack);
    }
  }

  function renderViewport(location) {
    const key = location && location.photo ? `${location.id}:photo` : '';
    if (key === lastLocationKey) return;
    lastLocationKey = key;
    if (viewportInstance) {
      viewportCache.set(viewportLocationId, viewportInstance.getViewport());
      viewportInstance = null;
      viewportLocationId = null;
    }
    clear(node);
    if (!key) return;
    viewportInstance = photoViewport({
      photo: location.photo,
      initialViewport: viewportCache.get(location.id),
      onMarkerMove: () => labelVisibility.clearRevealed()
    });
    labelVisibility.wire(viewportInstance.node);
    viewportLocationId = location.id;
    node.appendChild(viewportInstance.node);
    node.appendChild(pickerZoomControls(viewportInstance));
  }

  // `location`: the active location (with a photo); `activeTargetId`: the
  // selected target or null; `omitAngle`: pin labels without the angle.
  function refresh({ location, activeTargetId, omitAngle = false }) {
    const activeChanged = hasRenderedOnce && activeTargetId !== null && activeTargetId !== latestActiveId;
    latestActiveId = activeTargetId;
    renderViewport(location);
    if (location) renderPins(location, omitAngle);
    if (activeChanged && viewportInstance) {
      const target = location.targets.find((tg) => tg.id === activeTargetId);
      if (target && target.coords) viewportInstance.centerOn(target.coords);
    }
    hasRenderedOnce = true;
  }

  function dispose() {
    lastLocationKey = undefined;
  }

  return { node, refresh, dispose };
}
