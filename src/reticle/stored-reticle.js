// A reticle as stored — in a reticle record (reticle-record.js), and as
// the reticle files of 4.3.x stored it (file-codec.js) — and its
// validation on reading. Pure.
//
// Every angle (positions, dimensions, the horseshoe cutout) is in
// radians, exactly as held in memory; a number element's digits, anchor
// and font as strings; an SVG shape's drawing as path data, in runs of
// paths drawn alike (see storedShape()).
//
// Only what shapes the reticle is stored. Left out, and restored on
// reading to what a new element or reticle has: a repeat that is off
// (switching it on takes the last-entered settings anyway), a mirror that
// is off, an element's lit flag when it isn't lit, a group membership
// that isn't there, an SVG shape's `reflect` when it isn't mirrored, a BDC
// mark's x (always 0), the reference-scope fields its type doesn't use (a
// fixed scope has one magnification, only an SFP a calibration zoom), the
// illumination when it is the default (off, red). Element ids and the
// group list aren't stored either: reading assigns fresh ids and rebuilds
// the groups from the elements' group ids.
//
// Reading is treated as untrusted input, like an SVG import: count and
// range limits; every value re-validated, an SVG shape with the
// importer's own limits (svg-import/shape.js); fresh ids, so a crafted
// reticle can't smuggle in a duplicate id or a dangling group reference;
// no field kept that the type doesn't have. Failures throw an Error whose
// `code` is 'invalid-format' or 'too-large'.
import { SCOPE_TYPES, defaultReferenceScope, validateReferenceScope } from './scope.js';
import { ILLUMINATION_COLOURS, DEFAULT_ILLUMINATION } from './model.js';
import {
  ELEMENT_TYPES, REPEAT_DIRECTIONS, NO_REPEAT, MAX_ANGLE, isElementType, validateElement, canMirror, canRepeat, canIlluminate,
  staysOnVerticalAxis
} from './element-types.js';
import { normalizeShape } from './svg-import/shape.js';
import { LIMITS as SVG_LIMITS } from './svg-import/extract.js';
import { parsePathData, formatCompactCommands } from './svg-import/path-data.js';
import { expandInstances } from './geometry.js';

// Reading limits. A real reticle is far smaller than this; the limits only
// bound the work a crafted one can cause.
export const RETICLE_LIMITS = {
  maxElements: 5000,
  // Copies drawn after mirror and repeat, across the whole reticle.
  maxInstances: 50000,
  // Path commands across every SVG shape in the reticle.
  maxSvgSegments: 500000
};
export const MAX_NAME = 80;

const REFERENCE_KEYS = ['type', 'zoomMin', 'zoomMax', 'calibrationZoom'];
// The reference-scope fields each type uses: a fixed scope has one
// magnification (zoomMin), a variable one a zoom range, and only an SFP a
// calibration zoom.
const REFERENCE_KEYS_BY_TYPE = {
  fixed: ['type', 'zoomMin'],
  ffp: ['type', 'zoomMin', 'zoomMax'],
  sfp: REFERENCE_KEYS
};
const REPEAT_KEYS = ['direction', 'count', 'step'];
const NUMBER_KEYS = ['text', 'anchor', 'font'];
const SVG_PATH_KEYS = ['d', 'fill', 'fillRule', 'stroke', 'cap', 'join', 'miter'];
const SVG_STYLE_KEYS = SVG_PATH_KEYS.slice(1);

// An imported drawing is stored with its points on a grid of a power of
// ten (in the drawing's own units) no coarser than this angle at the
// reticle — far finer than any line a scope shows — and written relative
// to one another, which with the grid takes about half the text of the
// absolute form held in memory.
const SVG_GRID_RAD = 1e-6;
// Kept fine enough that a point's grid count stays an exact integer up to
// the largest coordinate the path parser accepts.
const SVG_GRID_MIN_EXPONENT = -8;

function gridExponent(scale) {
  const exponent = scale > 0 ? Math.floor(Math.log10(SVG_GRID_RAD / scale)) : SVG_GRID_MIN_EXPONENT;
  return Math.max(SVG_GRID_MIN_EXPONENT, exponent);
}

// An imported drawing as stored: consecutive paths drawn alike form one
// run, which holds their style once and their path data in order — a
// drawing typically has thousands of paths in a handful of styles.
function storedShape(shape, scale) {
  const exponent = gridExponent(scale);
  const runs = [];
  let styleKey = null;
  for (const path of shape.paths) {
    const style = pick(path, SVG_STYLE_KEYS);
    const key = JSON.stringify(style);
    if (key !== styleKey) {
      runs.push({ ...style, d: [] });
      styleKey = key;
    }
    runs[runs.length - 1].d.push(formatCompactCommands(parsePathData(path.d), exponent));
  }
  return { runs };
}

// A stored drawing back to the path list svg-import/shape.js validates —
// runs (records), or the plain list the reticle files of 4.3.x hold.
function shapePaths(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  if (!Array.isArray(raw.runs)) return raw;
  const paths = [];
  for (const run of raw.runs) {
    if (!run || typeof run !== 'object' || !Array.isArray(run.d)) throw fail('invalid-format', 'shape');
    if (paths.length + run.d.length > SVG_LIMITS.maxElements) throw fail('too-large', 'shape');
    const style = pick(run, SVG_STYLE_KEYS);
    for (const d of run.d) paths.push({ ...style, d });
  }
  return { paths };
}

export function pick(source, keys) {
  const out = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

// The numeric fields of an element type, in file order. A BDC mark's x
// is always 0, so it isn't stored.
function numericKeysOf(def, { stored = false } = {}) {
  const keys = [...(stored && def.onVerticalAxis ? [] : ['x']), 'y', ...def.params.map((p) => p.key)];
  if (def.axis) keys.push(def.axis === 'x' ? 'endX' : 'endY');
  return keys;
}

// An element as stored: its type's fields only, and of those only what
// shapes the reticle (see the top of this file).
export function storedElement(element) {
  const def = ELEMENT_TYPES[element.type];
  const out = { type: element.type, ...pick(element, numericKeysOf(def, { stored: true })) };
  if (element.type === 'number') Object.assign(out, pick(element, NUMBER_KEYS));
  if (element.type === 'svg') {
    out.scale = element.scale;
    if (element.name) out.name = element.name;
    if (element.mirror) out.reflect = element.reflect;
    out.shape = storedShape(element.shape, element.scale);
  }
  if (canIlluminate(element.type) && element.illuminated === true) out.illuminated = true;
  if (canMirror(element.type) && element.mirror === true) out.mirror = true;
  if (canRepeat(element.type) && element.repeat?.enabled) out.repeat = pick(element.repeat, REPEAT_KEYS);
  if (element.groupId) out.groupId = element.groupId;
  return out;
}

export function storedReferenceScope(ref) {
  return pick(ref, REFERENCE_KEYS_BY_TYPE[ref.type] ?? REFERENCE_KEYS);
}

// The illumination as stored, or undefined when it is the default.
export function storedIllumination(illumination) {
  const out = { enabled: illumination?.enabled === true, colour: illumination?.colour ?? DEFAULT_ILLUMINATION.colour };
  return out.enabled !== DEFAULT_ILLUMINATION.enabled || out.colour !== DEFAULT_ILLUMINATION.colour ? out : undefined;
}

export function fail(code, detail) {
  const err = new Error(detail ? `${code}: ${detail}` : code);
  err.code = code;
  return err;
}

export const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export function parseReferenceScope(raw) {
  if (!raw || typeof raw !== 'object') throw fail('invalid-format', 'referenceScope');
  if (!SCOPE_TYPES.includes(raw.type)) throw fail('invalid-format', 'referenceScope.type');
  const ref = { ...defaultReferenceScope(), type: raw.type };
  for (const key of REFERENCE_KEYS_BY_TYPE[raw.type].slice(1)) {
    if (!finite(raw[key])) throw fail('invalid-format', `referenceScope.${key}`);
    ref[key] = raw[key];
  }
  if (ref.type === 'fixed') ref.zoomMax = ref.zoomMin;
  if (ref.type !== 'sfp') ref.calibrationZoom = ref.zoomMax;
  const errors = Object.keys(validateReferenceScope(ref));
  if (errors.length) throw fail('invalid-format', `referenceScope.${errors[0]}`);
  return ref;
}

export function parseIllumination(raw) {
  if (raw === undefined || raw === null) return { ...DEFAULT_ILLUMINATION };
  if (typeof raw !== 'object') throw fail('invalid-format', 'illumination');
  const colour = raw.colour ?? DEFAULT_ILLUMINATION.colour;
  if (!ILLUMINATION_COLOURS.includes(colour)) throw fail('invalid-format', 'illumination.colour');
  return { enabled: raw.enabled === true, colour };
}

function parseElement(raw, index, budget, version) {
  const where = (key) => `elements[${index}].${key}`;
  if (!raw || typeof raw !== 'object' || !isElementType(raw.type)) throw fail('invalid-format', where('type'));
  const def = ELEMENT_TYPES[raw.type];
  const element = { type: raw.type };
  for (const key of numericKeysOf(def)) {
    if (key === 'x' && raw.x === undefined && staysOnVerticalAxis(raw.type)) {
      element.x = 0;
      continue;
    }
    if (!finite(raw[key]) || Math.abs(raw[key]) > MAX_ANGLE) throw fail('invalid-format', where(key));
    element[key] = raw[key];
  }
  if (raw.type === 'number') {
    for (const key of NUMBER_KEYS) {
      if (typeof raw[key] !== 'string') throw fail('invalid-format', where(key));
      element[key] = raw[key];
    }
  }
  if (raw.type === 'svg') {
    if (!finite(raw.scale)) throw fail('invalid-format', where('scale'));
    element.scale = raw.scale;
    try {
      element.shape = normalizeShape(shapePaths(raw.shape));
    } catch (err) {
      if (err.code === 'too-large') throw err;
      throw fail('invalid-format', where('shape'));
    }
    budget.svgSegments -= element.shape.segments;
    if (budget.svgSegments < 0) throw fail('too-large', 'svg segments');
    element.name = typeof raw.name === 'string' ? raw.name.slice(0, MAX_NAME) : '';
    element.reflect = raw.reflect !== false;
  }
  // A BDC mark has neither mirror nor repeat: whatever the file says, it
  // gets the settings a new one has. A repeat not in the file is off.
  if (canIlluminate(raw.type)) element.illuminated = raw.illuminated === true;
  element.mirror = canMirror(raw.type) && raw.mirror === true;
  if (canRepeat(raw.type)) {
    const stored = raw.repeat && typeof raw.repeat === 'object';
    const repeat = stored ? raw.repeat : {};
    element.repeat = {
      enabled: version >= 2 ? stored : repeat.enabled === true,
      direction: REPEAT_DIRECTIONS.includes(repeat.direction) ? repeat.direction : 'down',
      count: Number.isInteger(repeat.count) && repeat.count >= 1 ? repeat.count : 1,
      step: finite(repeat.step) && repeat.step > 0 ? repeat.step : 0
    };
    if (element.repeat.step === 0) element.repeat.enabled = false;
  } else {
    element.repeat = { ...NO_REPEAT };
  }
  const errors = validateElement(element);
  const firstError = Object.keys(errors)[0];
  if (firstError) throw fail('invalid-format', where(firstError));
  budget.instances -= expandInstances(element).length;
  if (budget.instances < 0) throw fail('too-large', 'drawn copies');
  element.groupId = typeof raw.groupId === 'string' ? raw.groupId : null;
  return element;
}

// Stored elements → the elements and groups of a reticle document, with
// fresh ids; groups survive only with two or more members. `version` is
// the reticle-file version the elements follow (records follow version
// 2): before version 2 a repeat carried its own `enabled` flag.
export function parseElements(rawElements, version) {
  if (!Array.isArray(rawElements)) throw fail('invalid-format', 'elements');
  if (rawElements.length > RETICLE_LIMITS.maxElements) throw fail('too-large', 'elements');
  const budget = { instances: RETICLE_LIMITS.maxInstances, svgSegments: RETICLE_LIMITS.maxSvgSegments };
  const parsed = rawElements.map((e, i) => parseElement(e, i, budget, version));

  let nextId = 1;
  const elements = parsed.map((e) => ({ ...e, id: `e${nextId++}` }));
  const memberCounts = new Map();
  for (const e of elements) if (e.groupId) memberCounts.set(e.groupId, (memberCounts.get(e.groupId) || 0) + 1);
  const groupIds = new Map();
  for (const [oldId, count] of memberCounts) if (count >= 2) groupIds.set(oldId, `g${nextId++}`);
  for (const e of elements) e.groupId = e.groupId ? groupIds.get(e.groupId) ?? null : null;
  return { elements, groups: [...groupIds.values()].map((id) => ({ id })), nextId };
}
