// Reticle file format: a reticle document as JSON, for Save to file /
// Load from file. Pure — the view does the actual download, and loading
// runs in the import worker (svg-import/client.js), so even a hostile or
// broken file can't freeze the app.
//
// Version 1: every angle (positions, dimensions, the field of view, the
// horseshoe cutout) in radians, the field-of-view distance in metres —
// exactly as held in memory; a number element's digits, anchor and font
// as strings; an SVG shape's drawing as the app's own path data; a BDC
// mark as its position alone (x always 0), without mirror or repeat;
// the reticle's illumination (on/off and colour) and each visible
// element's `illuminated` flag. A file without illumination loads as a
// reticle that isn't illuminated. A file
// from a newer version is refused with its own error, so a later format
// change can be reported as such rather than as a damaged file.
//
// Saving and loading are symmetric: an element is written as exactly the
// fields its type has (storedElement) and read back by reading only those
// fields. Loading is treated as untrusted input, like an SVG import:
// size, count and range limits; every value re-validated, an SVG shape
// with the importer's own limits (svg-import/shape.js); fresh ids, so a
// hand-edited file can't smuggle in a duplicate id or a dangling group
// reference; no field kept that the type doesn't have.
import { SCOPE_TYPES, defaultScope, validateScope } from './scope.js';
import { ILLUMINATION_COLOURS, DEFAULT_ILLUMINATION } from './model.js';
import {
  ELEMENT_TYPES, REPEAT_DIRECTIONS, NO_REPEAT, MAX_ANGLE, isElementType, validateElement, canMirror, canRepeat, canIlluminate
} from './element-types.js';
import { normalizeShape } from './svg-import/shape.js';
import { expandInstances } from './geometry.js';

export const FILE_FORMAT = 'ebalka2-reticle';
export const FILE_VERSION = 1;
export const FILE_EXTENSION = '.reticle.json';

// Load limits. A reticle file is far smaller than this in practice; the
// limits only bound the work a crafted file can cause.
export const FILE_LIMITS = {
  maxChars: 20000000,
  maxElements: 5000,
  // Copies drawn after mirror and repeat, across the whole reticle.
  maxInstances: 50000,
  // Path commands across every SVG shape in the reticle.
  maxSvgSegments: 500000
};
const MAX_NAME = 80;

const SCOPE_KEYS = ['type', 'fovMaxRad', 'fovMinRad', 'fovDistanceM', 'zoomMin', 'zoomMax', 'calibrationZoom'];
const NUMBER_KEYS = ['text', 'anchor', 'font'];
const SVG_PATH_KEYS = ['d', 'fill', 'fillRule', 'stroke', 'cap', 'join', 'miter'];

function pick(source, keys) {
  const out = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

// The numeric fields of an element type, in file order.
function numericKeysOf(def) {
  const keys = ['x', 'y', ...def.params.map((p) => p.key)];
  if (def.axis) keys.push(def.axis === 'x' ? 'endX' : 'endY');
  return keys;
}

// An element as written to a file: its type's fields only.
export function storedElement(element) {
  const def = ELEMENT_TYPES[element.type];
  const out = { id: element.id, type: element.type, ...pick(element, numericKeysOf(def)) };
  if (element.type === 'number') Object.assign(out, pick(element, NUMBER_KEYS));
  if (element.type === 'svg') {
    out.scale = element.scale;
    out.name = element.name;
    out.reflect = element.reflect;
    out.shape = { paths: element.shape.paths.map((p) => pick(p, SVG_PATH_KEYS)) };
  }
  if (canIlluminate(element.type)) out.illuminated = element.illuminated === true;
  if (canMirror(element.type)) out.mirror = element.mirror;
  if (canRepeat(element.type)) out.repeat = pick(element.repeat, ['enabled', 'direction', 'count', 'step']);
  out.groupId = element.groupId;
  return out;
}

export function serializeReticle(doc) {
  const payload = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    name: doc.name,
    scope: pick(doc.scope, SCOPE_KEYS),
    illumination: { enabled: doc.illumination?.enabled === true, colour: doc.illumination?.colour ?? DEFAULT_ILLUMINATION.colour },
    elements: doc.elements.map(storedElement),
    groups: doc.groups.map((g) => ({ id: g.id }))
  };
  return JSON.stringify(payload, null, 2);
}

function fail(code, detail) {
  const err = new Error(detail ? `${code}: ${detail}` : code);
  err.code = code;
  return err;
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function parseScope(raw) {
  if (!raw || typeof raw !== 'object') throw fail('invalid-format', 'scope');
  const scope = { ...defaultScope() };
  if (!SCOPE_TYPES.includes(raw.type)) throw fail('invalid-format', 'scope.type');
  scope.type = raw.type;
  for (const key of SCOPE_KEYS.slice(1)) {
    if (raw[key] === undefined || raw[key] === null) continue;
    if (!finite(raw[key])) throw fail('invalid-format', `scope.${key}`);
    scope[key] = raw[key];
  }
  const errors = Object.keys(validateScope(scope));
  if (errors.length) throw fail('invalid-format', `scope.${errors[0]}`);
  return scope;
}

function parseIllumination(raw) {
  if (raw === undefined || raw === null) return { ...DEFAULT_ILLUMINATION };
  if (typeof raw !== 'object') throw fail('invalid-format', 'illumination');
  const colour = raw.colour ?? DEFAULT_ILLUMINATION.colour;
  if (!ILLUMINATION_COLOURS.includes(colour)) throw fail('invalid-format', 'illumination.colour');
  return { enabled: raw.enabled === true, colour };
}

function parseElement(raw, index, budget) {
  const where = (key) => `elements[${index}].${key}`;
  if (!raw || typeof raw !== 'object' || !isElementType(raw.type)) throw fail('invalid-format', where('type'));
  const def = ELEMENT_TYPES[raw.type];
  const element = { type: raw.type };
  for (const key of numericKeysOf(def)) {
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
      element.shape = normalizeShape(raw.shape);
    } catch {
      throw fail('invalid-format', where('shape'));
    }
    budget.svgSegments -= element.shape.segments;
    if (budget.svgSegments < 0) throw fail('too-large', 'svg segments');
    element.name = typeof raw.name === 'string' ? raw.name.slice(0, MAX_NAME) : '';
    element.reflect = raw.reflect !== false;
  }
  // A BDC mark has neither mirror nor repeat: whatever the file says, it
  // gets the settings a new one has.
  if (canIlluminate(raw.type)) element.illuminated = raw.illuminated === true;
  element.mirror = canMirror(raw.type) && raw.mirror === true;
  if (canRepeat(raw.type)) {
    const repeat = raw.repeat && typeof raw.repeat === 'object' ? raw.repeat : {};
    element.repeat = {
      enabled: repeat.enabled === true,
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

// Text of a reticle file → a reticle document. Throws an Error whose
// `code` is 'invalid-json', 'invalid-format', 'unsupported-version' or
// 'too-large'.
export function parseReticle(text) {
  if (typeof text !== 'string') throw fail('invalid-format', 'text');
  if (text.length > FILE_LIMITS.maxChars) throw fail('too-large', 'file');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw fail('invalid-json');
  }
  if (!raw || typeof raw !== 'object' || raw.format !== FILE_FORMAT) throw fail('invalid-format', 'format');
  if (!Number.isInteger(raw.version)) throw fail('invalid-format', 'version');
  if (raw.version > FILE_VERSION) throw fail('unsupported-version');
  if (!Array.isArray(raw.elements)) throw fail('invalid-format', 'elements');
  if (raw.elements.length > FILE_LIMITS.maxElements) throw fail('too-large', 'elements');

  const scope = parseScope(raw.scope);
  const illumination = parseIllumination(raw.illumination);
  const budget = { instances: FILE_LIMITS.maxInstances, svgSegments: FILE_LIMITS.maxSvgSegments };
  const parsed = raw.elements.map((e, i) => parseElement(e, i, budget));

  // Fresh ids; groups survive only with two or more members.
  let nextId = 1;
  const elements = parsed.map((e) => ({ ...e, id: `e${nextId++}` }));
  const memberCounts = new Map();
  for (const e of elements) if (e.groupId) memberCounts.set(e.groupId, (memberCounts.get(e.groupId) || 0) + 1);
  const groupIds = new Map();
  for (const [oldId, count] of memberCounts) if (count >= 2) groupIds.set(oldId, `g${nextId++}`);
  for (const e of elements) e.groupId = e.groupId ? groupIds.get(e.groupId) ?? null : null;

  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, MAX_NAME) : '',
    scope,
    illumination,
    elements,
    groups: [...groupIds.values()].map((id) => ({ id })),
    nextId
  };
}

// A safe download filename for a reticle's name.
export function reticleFilename(name) {
  const base = String(name || '').trim().replace(/[^\p{L}\p{N} _.-]+/gu, '').replace(/\s+/g, '-').slice(0, MAX_NAME);
  return `${base || 'reticle'}${FILE_EXTENSION}`;
}
