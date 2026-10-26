// The Reticle Designer's element types: which settings each one has, its
// defaults in each unit system, and its validation. Pure — no DOM.
//
// Every element record holds its position and every dimension in radians
// (the cutout angle included); `kind` on a parameter only says how the
// settings pane shows it: 'angle' in the tool's mrad/MOA switch, 'degrees'
// in degrees. Defaults are specified per unit system so a new element gets
// round figures in whichever unit the user is drawing in.
//
// Position: x positive right, y positive down, measured from the reticle's
// zero. Dots, circles and horseshoes are positioned by their centre, a
// chevron by its apex, a number by its anchor point (its left end, centre
// or right end, at the vertical middle of the digits), a BDC mark by its
// point on the vertical axis. Lines and thinning bars are segments with a start
// (x, y) and an end along their own axis (endX for horizontal ones, endY
// for vertical ones); see model.js for the rule that keeps a thinning
// bar's end no closer to zero than its start.
import { mradToRad, moaToRad, degToRad } from '../quantity.js';
import { DIGIT_FONTS } from '../vendor/reticle-digits/digit-glyphs.js';

function perUnits(mrad, moa) {
  return { mrad: mradToRad(mrad), moa: moaToRad(moa) };
}

const angle = (key) => ({ key, kind: 'angle' });

export const ELEMENT_TYPES = {
  hline: {
    axis: 'x',
    principal: 'width',
    params: [angle('width')],
    defaults: { width: perUnits(0.05, 0.15) }
  },
  vline: {
    axis: 'y',
    principal: 'width',
    params: [angle('width')],
    defaults: { width: perUnits(0.05, 0.15) }
  },
  dot: {
    principal: 'diameter',
    params: [angle('diameter')],
    defaults: { diameter: perUnits(0.05, 0.15) }
  },
  vbar: {
    axis: 'y',
    endPointRule: true,
    params: [angle('nominalWidth'), angle('endWidth'), angle('thinningLength')],
    defaults: { nominalWidth: perUnits(0.5, 1.5), endWidth: perUnits(0.25, 0.75), thinningLength: perUnits(2, 7) }
  },
  hbar: {
    axis: 'x',
    endPointRule: true,
    params: [angle('nominalWidth'), angle('endWidth'), angle('thinningLength')],
    defaults: { nominalWidth: perUnits(0.5, 1.5), endWidth: perUnits(0.25, 0.75), thinningLength: perUnits(2, 7) }
  },
  circle: {
    params: [angle('outerDiameter'), angle('innerDiameter')],
    defaults: { outerDiameter: perUnits(2, 6), innerDiameter: perUnits(1.8, 5.4) }
  },
  horseshoe: {
    params: [angle('outerDiameter'), angle('innerDiameter'), { key: 'cutoutAngle', kind: 'degrees' }],
    defaults: {
      outerDiameter: perUnits(2, 6),
      innerDiameter: perUnits(1.8, 5.4),
      cutoutAngle: { mrad: degToRad(60), moa: degToRad(60) }
    }
  },
  chevron: {
    params: [angle('lineWidth'), angle('overallWidth'), angle('height')],
    defaults: { lineWidth: perUnits(0.5, 1.5), overallWidth: perUnits(1, 3.5), height: perUnits(1, 3.5) }
  },
  // Digits only, drawn from the outlines in vendor/reticle-digits. Besides
  // its height it has three non-numeric settings: `text`, `anchor` and
  // `font` (see NUMBER_ANCHORS / DIGIT_FONT_IDS).
  number: {
    params: [angle('digitHeight')],
    defaults: { digitHeight: perUnits(0.5, 1.5) }
  },
  // A user-provided drawing, imported through reticle/svg-import into the
  // app's own path data (`shape`, in the SVG's user units). Its own
  // settings: `scale` (rad per SVG unit — shown both as such and as the
  // drawing's absolute width and height), `reflect` (whether a mirrored
  // copy is reflected or only moved) and `name` (the file it came from).
  // x, y is where the SVG's own origin goes.
  svg: {
    params: []
  },
  // A BDC (bullet drop compensation) mark: not drawn in the reticle, an aim
  // point for a distance other than the zero distance, without changing the
  // scope's elevation. Tools that work out trajectories pair each mark with
  // the distance it holds for. It lives on the vertical axis (x is always
  // 0, only y is set) and is never mirrored or repeated.
  bdc: {
    params: [],
    onVerticalAxis: true,
    mirrorable: false,
    repeatable: false,
    illuminable: false
  }
};

// Palette order.
export const ELEMENT_TYPE_IDS = ['hline', 'vline', 'dot', 'vbar', 'hbar', 'circle', 'horseshoe', 'chevron', 'number', 'svg', 'bdc'];

// A newly imported drawing is scaled so its larger side is this long; the
// user sets the real scale or size afterwards.
export const DEFAULT_SVG_SIZE = perUnits(5, 15);

export const NUMBER_ANCHORS = ['left', 'centre', 'right'];
export const DIGIT_FONT_IDS = Object.keys(DIGIT_FONTS);
export const DEFAULT_DIGIT_FONT = 'b612-regular';
export const DEFAULT_NUMBER_TEXT = '1';
const DIGITS_ONLY = /^[0-9]+$/;

export const REPEAT_DIRECTIONS = ['up', 'down', 'left', 'right'];

// Sanity limits, applied to typed settings and to loaded files alike: a
// repeat count high enough to draw millions of copies would freeze the
// app, and no reticle dimension or position is anywhere near half a turn.
export const MAX_REPEAT_COUNT = 500;
export const MAX_DIGITS = 12;
export const MAX_ANGLE = Math.PI;

// A plain click with a line tool (rather than a press-and-drag) makes a
// segment this long.
export const CLICK_LINE_LENGTH = perUnits(1, 4);

export const DEFAULT_REPEAT = {
  direction: 'down',
  count: 5,
  step: perUnits(1, 2)
};

// The repeat settings of a type that can't repeat (a BDC mark): always
// the same, whether the element is new or loaded from a file.
export const NO_REPEAT = Object.freeze({ enabled: false, direction: 'down', count: 1, step: 0 });

export function isElementType(type) {
  return Object.prototype.hasOwnProperty.call(ELEMENT_TYPES, type);
}

// 'x' / 'y' for the segment types (lines and thinning bars), null for the
// rest.
export function axisOf(element) {
  return ELEMENT_TYPES[element.type]?.axis ?? null;
}

export function endKeyOf(element) {
  const axis = axisOf(element);
  return axis === 'x' ? 'endX' : axis === 'y' ? 'endY' : null;
}

// Whether the type keeps its start nearer zero than its end (thinning
// bars, whose taper starts at the start; see model.js). A plain line looks
// the same from either end, so its two ends are free.
export function followsEndPointRule(element) {
  return ELEMENT_TYPES[element.type]?.endPointRule === true;
}

// Whether the type can be mirrored / repeated (every type but a BDC mark).
export function canMirror(type) {
  return ELEMENT_TYPES[type]?.mirrorable !== false;
}

export function canRepeat(type) {
  return ELEMENT_TYPES[type]?.repeatable !== false;
}

// Whether the type can be illuminated (every visible type: all but a BDC
// mark). An element's `illuminated` flag only shows on an illuminated
// reticle; on one that isn't, it is kept but has no effect.
export function canIlluminate(type) {
  return ELEMENT_TYPES[type]?.illuminable !== false;
}

// Whether the type always sits on the vertical axis (x = 0): moving it
// sideways leaves it there.
export function staysOnVerticalAxis(type) {
  return ELEMENT_TYPES[type]?.onVerticalAxis === true;
}

export function startOnAxis(element) {
  return axisOf(element) === 'x' ? element.x : element.y;
}

export function endOnAxis(element) {
  return element[endKeyOf(element)];
}

// A fresh element record (no id — model.js assigns one). `principal` is
// the width/diameter last entered for a line or dot, shared across the
// three types that have one; `repeat` the direction/count/step last
// entered for a repeat. Both null on the first element of a session.
// `number`: the font, digit height and anchor last chosen for a number
// ({ font, digitHeight, anchor }, any of them missing), for a new one.
// `svg`: { shape, name } for a new SVG shape. `illuminated`: whether a
// type that can be illuminated starts so.
export function createElement(type, { x, y, end, units, principal = null, repeat = null, number = null, svg = null, illuminated = false }) {
  const def = ELEMENT_TYPES[type];
  const element = { type, x: staysOnVerticalAxis(type) ? 0 : x, y };
  for (const param of def.params) element[param.key] = def.defaults[param.key][units];
  if (def.principal && principal > 0) element[def.principal] = principal;
  if (def.axis) element[def.axis === 'x' ? 'endX' : 'endY'] = end ?? (def.axis === 'x' ? x : y);
  if (type === 'number') {
    element.text = DEFAULT_NUMBER_TEXT;
    element.anchor = NUMBER_ANCHORS.includes(number?.anchor) ? number.anchor : 'centre';
    element.font = DIGIT_FONT_IDS.includes(number?.font) ? number.font : DEFAULT_DIGIT_FONT;
    if (number?.digitHeight > 0) element.digitHeight = number.digitHeight;
  }
  if (type === 'svg') {
    const [bx0, by0, bx1, by1] = svg.shape.bounds;
    const side = Math.max(bx1 - bx0, by1 - by0);
    element.scale = side > 0 ? DEFAULT_SVG_SIZE[units] / side : DEFAULT_SVG_SIZE[units];
    element.shape = svg.shape;
    element.name = String(svg.name || '').slice(0, 80);
    element.reflect = true;
  }
  if (canIlluminate(type)) element.illuminated = illuminated === true;
  element.mirror = false;
  element.repeat = canRepeat(type) ? {
    enabled: false,
    direction: repeat?.direction ?? DEFAULT_REPEAT.direction,
    count: repeat?.count ?? DEFAULT_REPEAT.count,
    step: repeat?.step ?? DEFAULT_REPEAT.step[units]
  } : { ...NO_REPEAT };
  element.groupId = null;
  return element;
}

const positive = (v) => Number.isFinite(v) && v > 0;
const nonNegative = (v) => Number.isFinite(v) && v >= 0;

// Error keys (reticleDesigner.errors.*) per invalid setting, empty when the
// element is drawable. Positions are not checked here (any finite value is
// valid); a thinning bar's end-point rule is enforced by clamping in
// model.js instead.
export function validateElement(element) {
  const errors = {};
  const check = (key, ok, code) => { if (!errors[key] && !ok) errors[key] = code; };
  for (const param of ELEMENT_TYPES[element.type]?.params || []) {
    check(param.key, !(Math.abs(element[param.key]) > MAX_ANGLE), 'outOfRange');
  }
  switch (element.type) {
    case 'hline':
    case 'vline':
      check('width', positive(element.width), 'positive');
      break;
    case 'dot':
      check('diameter', positive(element.diameter), 'positive');
      break;
    case 'vbar':
    case 'hbar':
      check('nominalWidth', positive(element.nominalWidth), 'positive');
      check('endWidth', nonNegative(element.endWidth), 'nonNegative');
      check('endWidth', !(element.endWidth > element.nominalWidth), 'endWidthAboveNominal');
      check('thinningLength', nonNegative(element.thinningLength), 'nonNegative');
      break;
    case 'circle':
    case 'horseshoe':
      check('outerDiameter', positive(element.outerDiameter), 'positive');
      check('innerDiameter', nonNegative(element.innerDiameter), 'nonNegative');
      check('innerDiameter', !(element.innerDiameter >= element.outerDiameter), 'innerBelowOuter');
      if (element.type === 'horseshoe') {
        check('cutoutAngle', nonNegative(element.cutoutAngle), 'nonNegative');
        check('cutoutAngle', element.cutoutAngle < 2 * Math.PI, 'cutoutBelowFullTurn');
      }
      break;
    case 'chevron':
      check('lineWidth', positive(element.lineWidth), 'positive');
      check('overallWidth', positive(element.overallWidth), 'positive');
      check('height', positive(element.height), 'positive');
      break;
    case 'svg':
      check('scale', positive(element.scale), 'positive');
      if (element.shape?.bounds) {
        const [bx0, by0, bx1, by1] = element.shape.bounds;
        check('scale', Math.max(bx1 - bx0, by1 - by0, Math.abs(bx0), Math.abs(by0), Math.abs(bx1), Math.abs(by1)) * element.scale <= MAX_ANGLE, 'outOfRange');
      }
      check('shape', Array.isArray(element.shape?.paths) && Array.isArray(element.shape?.bounds), 'badShape');
      check('reflect', typeof element.reflect === 'boolean', 'badShape');
      break;
    case 'number':
      check('text', typeof element.text === 'string' && DIGITS_ONLY.test(element.text), 'digitsOnly');
      check('text', element.text.length <= MAX_DIGITS, 'tooManyDigits');
      check('digitHeight', positive(element.digitHeight), 'positive');
      check('anchor', NUMBER_ANCHORS.includes(element.anchor), 'unknownAnchor');
      check('font', DIGIT_FONT_IDS.includes(element.font), 'unknownFont');
      break;
    case 'bdc':
      check('x', element.x === 0, 'onVerticalAxis');
      break;
    default:
      errors.type = 'unknownType';
  }
  check('illuminated', canIlluminate(element.type) ? typeof element.illuminated === 'boolean' : !element.illuminated, 'notIlluminable');
  check('mirror', !element.mirror || canMirror(element.type), 'notMirrorable');
  check('repeat', !element.repeat?.enabled || canRepeat(element.type), 'notRepeatable');
  const repeat = element.repeat;
  if (repeat?.enabled) {
    check('repeatCount', Number.isInteger(repeat.count) && repeat.count >= 1, 'positiveInteger');
    check('repeatCount', repeat.count <= MAX_REPEAT_COUNT, 'repeatCountMax');
    check('repeatStep', positive(repeat.step), 'positive');
    check('repeatStep', !(repeat.step > MAX_ANGLE), 'outOfRange');
  }
  return errors;
}
