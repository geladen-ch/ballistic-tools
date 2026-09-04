// Shared pin glyphs for photo-based target pickers — the plain dot every
// placed-but-not-active target uses, and the crosshair reserved for
// whichever target is currently active/selected. Factored out of
// location-placement-view.js (placement mode's own draggable marker) so
// range-card-panel.js's inline select-mode picker can reuse the exact
// same marks instead of redrawing them a second time.
import { el } from '../../dom.js';
import { svgEl } from '../../svg.js';

export function placedDot() {
  return el('span', { class: 'target-photo-overlay-pin-dot' });
}

// The active/being-placed target gets a precise reticle, not a pin — its
// own center (not a tip, unlike a map pin) is the exact point meant.
export function crosshairGlyph(size = 30) {
  return svgEl('svg', { viewBox: '0 0 30 30', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
    svgEl('circle', { cx: '15', cy: '15', r: '10' }),
    svgEl('line', { x1: '15', y1: '2', x2: '15', y2: '28' }),
    svgEl('line', { x1: '2', y1: '15', x2: '28', y2: '15' })
  ]);
}
