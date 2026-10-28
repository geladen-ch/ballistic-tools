// SVG nodes for an imported shape (reticle/svg-import) — shared by the
// reticle view and the import preview. Only the app's own validated path
// data and numbers go into the attributes; nothing from the original file
// is ever put into the page.
import { svgEl } from '../../svg.js';

const fmt = (v) => String(Math.round(v * 100) / 100);

// `x, y`: where the shape's origin goes; `size`: drawing units per shape
// unit; `flip`: reflected about its own vertical axis. `minStroke`: the
// thinnest stroke drawn, in drawing units, so a hairline stays visible.
export function shapePathNodes(paths, { x = 0, y = 0, size = 1, flip = false, className = '', minStroke = 0, data = {} }) {
  const transform = `translate(${fmt(x)} ${fmt(y)}) scale(${(flip ? -size : size).toPrecision(6)} ${size.toPrecision(6)})`;
  const nodes = [];
  for (const path of paths) {
    if (path.fill) {
      nodes.push(svgEl('path', { class: className, d: path.d, transform, 'fill-rule': path.fillRule, ...data }));
    }
    if (path.stroke > 0) {
      const width = Math.max(path.stroke, size > 0 ? minStroke / size : 0);
      // The width goes in as an inline style: a presentation attribute
      // would lose to the `.reticle-shape` class's hairline stroke-width.
      nodes.push(svgEl('path', {
        class: `${className} stroked`,
        d: path.d,
        transform,
        style: `stroke-width: ${width}`,
        'stroke-linecap': path.cap,
        'stroke-linejoin': path.join,
        'stroke-miterlimit': String(path.miter),
        ...data
      }));
    }
  }
  return nodes;
}
