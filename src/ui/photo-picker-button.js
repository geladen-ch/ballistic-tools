// A small, unobtrusive icon-only button that opens the full-screen photo
// target picker (location-placement-view.js, select mode) — same quiet
// `.icon-button` treatment as location-picker-button.js/target-sync-
// button.js, shown next to Range Solver's Target tab fields only when the
// active location has a photo. A photo-frame glyph, distinct from
// location-picker-button.js's own map pin.
import { el } from '../dom.js';
import { svgEl } from '../svg.js';

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

function photoIcon(size = 16) {
  return svgEl('svg', { viewBox: '0 0 20 20', width: size, height: size, ...LINE }, [
    svgEl('rect', { x: '2.5', y: '4', width: '15', height: '12', rx: '1.5' }),
    svgEl('circle', { cx: '7.5', cy: '9', r: '1.6' }),
    svgEl('path', { d: 'M4 15l4.5-4.5L11 13l3-3.5L17 13' })
  ]);
}

export function photoPickerButton({ label, onClick }) {
  const button = el('button', { type: 'button', class: 'icon-button', title: label, 'aria-label': label }, [photoIcon()]);
  button.addEventListener('click', onClick);
  return button;
}
