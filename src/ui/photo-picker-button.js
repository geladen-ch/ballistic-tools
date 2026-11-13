// An icon-only button that opens the full-screen photo target picker
// (location-placement-view.js, select mode). A photo-frame glyph, distinct
// from the location map pin. `prominent`: the Range Solver's Fire! pane
// shows it beside the range field, in the accent colour and at full touch
// size, when the pane shows neither the targets list nor the inline photo
// picker but the active location has a photo.
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

export function photoPickerButton({ label, onClick, prominent = false }) {
  const button = el('button', {
    type: 'button', class: 'icon-button photo-picker-button' + (prominent ? ' prominent' : ''), title: label, 'aria-label': label
  }, [photoIcon(prominent ? 22 : 16)]);
  button.addEventListener('click', onClick);
  return button;
}
