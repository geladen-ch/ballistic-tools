// A small, unobtrusive icon-only button that opens the Locations manager
// — same quiet `.icon-button` treatment as download-button.js/
// copy-button.js, next to Range Solver's Target tab fields. A map pin,
// reading as "place/location" rather than anything settings-like.
import { el } from '../../dom.js';
import { svgEl } from '../../svg.js';

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

function pinIcon(size = 16) {
  return svgEl('svg', { viewBox: '0 0 20 20', width: size, height: size, ...LINE }, [
    svgEl('path', { d: 'M10 18s6-6.2 6-10.5A6 6 0 0 0 4 7.5C4 11.8 10 18 10 18Z' }),
    svgEl('circle', { cx: '10', cy: '7.5', r: '2' })
  ]);
}

export function locationPickerButton({ label, onClick }) {
  const button = el('button', { type: 'button', class: 'icon-button', title: label, 'aria-label': label }, [pinIcon()]);
  button.addEventListener('click', onClick);
  return button;
}
