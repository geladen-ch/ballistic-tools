// SVG nodes for one reticle element — every primitive it draws as
// (reticle/geometry.js), mapped to drawing units by `toScreen` and `k`
// (see reticle/render.js). Shared by the Reticle Designer's view and
// reticle thumbnails.
import { svgEl } from '../../svg.js';
import { elementPrimitives } from '../../reticle/geometry.js';
import { fmt, primitivePath } from '../../reticle/render.js';
import { shapePathNodes } from './shape-paths.js';

// `classFor(primitive)`: the class attribute for each primitive's nodes;
// `minStroke`: the thinnest imported stroke drawn, in drawing units;
// `data`: extra attributes put on every node.
export function elementNodes(element, { toScreen, k, classFor, minStroke = 0, data = {} }) {
  const nodes = [];
  for (const primitive of elementPrimitives(element)) {
    const className = classFor(primitive);
    if (primitive.kind === 'svg') {
      const [sx, sy] = toScreen(primitive.x, primitive.y);
      nodes.push(...shapePathNodes(primitive.paths, {
        x: sx, y: sy, size: primitive.scale * k, flip: primitive.flip, className, minStroke, data
      }));
      continue;
    }
    if (primitive.kind === 'text') {
      // Digit outlines are in figure-height units: placed and scaled
      // with a transform, one path per digit.
      const size = primitive.scale * k;
      for (const glyph of primitive.glyphs) {
        const [gx, gy] = toScreen(glyph.x, glyph.y);
        nodes.push(svgEl('path', {
          class: className,
          d: glyph.d,
          transform: `translate(${fmt(gx)} ${fmt(gy)}) scale(${size.toPrecision(6)})`,
          ...data
        }));
      }
      continue;
    }
    nodes.push(svgEl('path', { class: className, d: primitivePath(primitive, toScreen, k), 'fill-rule': 'evenodd', ...data }));
  }
  return nodes;
}
