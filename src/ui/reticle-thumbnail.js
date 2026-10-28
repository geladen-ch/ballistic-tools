// A small, static picture of a reticle — black on a light field inside
// the field circle, everything beyond it blacked out, lit elements in the
// illumination colour — for lists and pickers. Drawn the way the Reticle
// Designer's view shows it at its reference scope's highest magnification
// (where a first-focal-plane reticle fills the most of the field, so its
// detail survives being shrunk), with the same element drawing
// (reticle-designer/element-nodes.js).
//
// `reticle` = { referenceScope, illumination, elements } with elements as
// the app holds them (reticle/model.js).
import { svgEl } from '../svg.js';
import { fmt } from '../reticle/render.js';
import { fieldRadiusAtZoom, referenceOptics } from '../reticle/scope.js';
import { isLit, ILLUMINATION_COLOURS } from '../reticle/model.js';
import { mradToRad } from '../quantity.js';
import { elementNodes } from './reticle-designer/element-nodes.js';

// Drawing units: the canvas, and the field circle's radius within it.
const SIZE = 1000;
const HALF = SIZE / 2;
const FIT_RADIUS = 480;
// Imported strokes thinner than this many drawing units are drawn at it —
// thicker than in the view, so hairlines survive being shrunk.
const MIN_STROKE = 6;
// Drawn when the reference scope gives no usable field.
const FALLBACK_FIELD_RADIUS = mradToRad(50);

let clipCounter = 0;

export function reticleThumbnail(reticle, { size = 96, label = '' } = {}) {
  clipCounter += 1;
  const clipId = `reticle-thumbnail-clip-${clipCounter}`;
  let radius = NaN;
  try {
    const optics = referenceOptics(reticle.referenceScope);
    radius = fieldRadiusAtZoom(optics, optics.zoomMax);
  } catch {
    // an unusable reference scope — drawn with the fallback field
  }
  if (!(radius > 0) || !Number.isFinite(radius)) radius = FALLBACK_FIELD_RADIUS;
  const k = FIT_RADIUS / radius;
  const toScreen = (x, y) => [HALF + x * k, HALF + y * k];

  const elementLayer = svgEl('g', { class: 'reticle-elements' });
  for (const element of reticle.elements || []) {
    // One element failing to draw must not take the picture with it.
    try {
      const lit = isLit(reticle, element);
      for (const node of elementNodes(element, {
        toScreen, k, minStroke: MIN_STROKE,
        classFor: () => (lit ? 'reticle-shape lit' : 'reticle-shape')
      })) elementLayer.appendChild(node);
    } catch {
      // skip it
    }
  }

  const circle = (cls) => svgEl('circle', { class: cls, cx: fmt(HALF), cy: fmt(HALF), r: fmt(FIT_RADIUS) });
  const { enabled, colour } = reticle.illumination || {};
  const classes = ['reticle-thumbnail'];
  if (enabled && ILLUMINATION_COLOURS.includes(colour)) classes.push(`illum-${colour}`);
  const attrs = {
    viewBox: `0 0 ${SIZE} ${SIZE}`, width: String(size), height: String(size), class: classes.join(' '), role: 'img'
  };
  if (label) attrs['aria-label'] = label;
  return svgEl('svg', attrs, [
    svgEl('defs', {}, [svgEl('clipPath', { id: clipId }, [circle('')])]),
    svgEl('rect', { class: 'reticle-outside', x: '0', y: '0', width: String(SIZE), height: String(SIZE) }),
    circle('reticle-glass'),
    svgEl('g', { 'clip-path': `url(#${clipId})` }, [elementLayer]),
    circle('reticle-rim')
  ]);
}
