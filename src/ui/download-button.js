// A small, unobtrusive icon-only button for a file export/download action
// (chart SVG export, table CSV export) — deliberately not a full labeled
// button like the surrounding controls, since these are secondary actions
// that shouldn't compete visually with the primary ones next to them. The
// label is only ever shown as a tooltip/aria-label, never as text.
import { el } from '../dom.js';
import { svgEl } from '../svg.js';

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

function downloadIcon(size = 16) {
  return svgEl('svg', { viewBox: '0 0 20 20', width: size, height: size, ...LINE }, [
    svgEl('path', { d: 'M10 3v9' }),
    svgEl('path', { d: 'M6.5 8.5 10 12l3.5-3.5' }),
    svgEl('path', { d: 'M4 14.5v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2' })
  ]);
}

export function downloadButton({ label, onClick }) {
  const button = el('button', { type: 'button', class: 'icon-button', title: label, 'aria-label': label }, [downloadIcon()]);
  button.addEventListener('click', onClick);
  return button;
}
