// The parts of a drawn reticle shared by every picture of one — reticle
// thumbnails (reticle-thumbnail.js) and the Range Solver's scope view
// (range-solver/scope-view.js): the element layer, drawn with the
// Reticle Designer's own element drawing (reticle-designer/
// element-nodes.js), and the illumination class the stylesheet colours
// lit elements by.
//
// `reticle` = { illumination, elements } with elements as the app holds
// them (reticle/model.js); `toScreen`/`k` as in reticle/render.js.
import { svgEl } from '../svg.js';
import { isLit, ILLUMINATION_COLOURS } from '../reticle/model.js';
import { elementNodes } from './reticle-designer/element-nodes.js';

export function reticleElementLayer(reticle, { toScreen, k, minStroke = 0 }) {
  const layer = svgEl('g', { class: 'reticle-elements' });
  for (const element of reticle.elements || []) {
    // One element failing to draw must not take the picture with it.
    try {
      const lit = isLit(reticle, element);
      for (const node of elementNodes(element, {
        toScreen, k, minStroke,
        classFor: () => (lit ? 'reticle-shape lit' : 'reticle-shape')
      })) layer.appendChild(node);
    } catch {
      // skip it
    }
  }
  return layer;
}

// 'illum-<colour>' when the reticle's illumination is on, else null.
export function illuminationClass(reticle) {
  const { enabled, colour } = reticle.illumination || {};
  return enabled && ILLUMINATION_COLOURS.includes(colour) ? `illum-${colour}` : null;
}
