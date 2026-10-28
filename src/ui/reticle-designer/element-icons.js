// Icons for the Reticle Designer — one per element type, plus the
// selection arrow, and undo and redo for the view's bar. Small filled/stroked SVGs in `currentColor`, so the
// active/hover state is a CSS colour change.
import { svgEl } from '../../svg.js';
import { digitFont } from '../../reticle/digit-text.js';

const STROKE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const FILL = { fill: 'currentColor', stroke: 'none' };

function icon(children, size) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' }, children);
}

const DRAWINGS = {
  select: () => [svgEl('path', { ...STROKE, d: 'M6 3.5v15l4.2-4 2.8 6.2 2.6-1.2-2.8-6.1 5.7-.4Z' })],
  hline: () => [svgEl('line', { ...STROKE, x1: '3', y1: '12', x2: '21', y2: '12' })],
  vline: () => [svgEl('line', { ...STROKE, x1: '12', y1: '3', x2: '12', y2: '21' })],
  dot: () => [svgEl('circle', { ...FILL, cx: '12', cy: '12', r: '3.2' })],
  vbar: () => [svgEl('path', { ...FILL, d: 'M11 4h2l2 7v9H9v-9Z' })],
  hbar: () => [svgEl('path', { ...FILL, d: 'M4 11v2l7 2h9V9h-9Z' })],
  circle: () => [svgEl('circle', { ...STROKE, cx: '12', cy: '12', r: '7.5' })],
  horseshoe: () => [svgEl('path', { ...STROKE, d: 'M8.25 18.5A7.5 7.5 0 1 1 15.75 18.5' })],
  chevron: () => [svgEl('path', { ...STROKE, 'stroke-width': '2.4', d: 'M5 17 12 7l7 10' })],
  // A dot on the vertical axis, below the zero cross.
  bdc: () => [
    svgEl('path', { ...STROKE, d: 'M8 7h8M12 3v8' }),
    svgEl('circle', { ...FILL, cx: '12', cy: '17.5', r: '3' })
  ],
  // A pen-tool curve with its two nodes: "a drawing of your own".
  svg: () => [
    svgEl('path', { ...STROKE, d: 'M4 18C7 6 17 18 20 6' }),
    svgEl('rect', { ...FILL, x: '2.5', y: '16.5', width: '3', height: '3' }),
    svgEl('rect', { ...FILL, x: '18.5', y: '4.5', width: '3', height: '3' })
  ],
  // A hooked arrow back to the left, and its mirror image forward.
  undo: () => [svgEl('path', { ...STROKE, d: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11' })],
  redo: () => [svgEl('path', { ...STROKE, d: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13' })],
  // "12" in the default digit font, from the same outlines the reticle uses.
  number: () => {
    const font = digitFont();
    const height = 11;
    const width = (font.glyphs['1'].advance + font.glyphs['2'].advance) * height;
    let x = 12 - width / 2;
    return ['1', '2'].map((c) => {
      const glyph = font.glyphs[c];
      const node = svgEl('path', { ...FILL, d: glyph.d, transform: `translate(${x.toFixed(2)} 17.5) scale(${height})` });
      x += glyph.advance * height;
      return node;
    });
  }
};

export function elementIcon(type, size = 22) {
  return icon((DRAWINGS[type] || DRAWINGS.select)(), size);
}
