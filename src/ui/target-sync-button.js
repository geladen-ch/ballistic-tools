// A small, unobtrusive icon-only button shown next to Range Solver's
// target picker only when the range/LoS fields have diverged from the
// selected target's own saved values — same quiet `.icon-button`
// treatment as download-button.js/copy-button.js. An upload/sync glyph
// (arrow into a tray), reading as "push these values back up," distinct
// from download-button.js's own plain downward arrow.
import { el } from '../dom.js';
import { svgEl } from '../svg.js';

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

function syncIcon(size = 16) {
  return svgEl('svg', { viewBox: '0 0 20 20', width: size, height: size, ...LINE }, [
    svgEl('path', { d: 'M10 14V5' }),
    svgEl('path', { d: 'M6.5 8.5 10 5l3.5 3.5' }),
    svgEl('path', { d: 'M4 14.5v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2' })
  ]);
}

export function targetSyncButton({ label, onClick }) {
  const button = el('button', { type: 'button', class: 'icon-button', title: label, 'aria-label': label }, [syncIcon()]);
  button.addEventListener('click', onClick);
  return button;
}
