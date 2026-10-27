// Reticle file format: a reticle document as JSON, for Save to file /
// Load from file. Pure — the view does the actual download, and loading
// runs in the import worker (svg-import/client.js), so even a hostile or
// broken file can't freeze the app.
//
// Every angle (positions, dimensions, the field of view, the horseshoe
// cutout) is in radians, the field-of-view distance in metres — exactly
// as held in memory; a number element's digits, anchor and font as
// strings; an SVG shape's drawing as the app's own path data. A file from
// a newer version is refused with its own error, so a later format change
// can be reported as such rather than as a damaged file.
//
// A file holds only what shapes the reticle. Left out, and restored on
// loading to what a new element or reticle has: a repeat that is off
// (switching it on takes the last-entered settings anyway), a mirror that
// is off, an element's lit flag when it isn't lit, a group membership
// that isn't there, an SVG shape's `reflect` when it isn't mirrored, a BDC
// mark's x (always 0), the scope fields its type doesn't use (a fixed
// scope has no zoom range, only an SFP a calibration zoom), the
// illumination when it is the default (off, red), an empty name. Element
// ids and the group list aren't stored either: loading assigns fresh ids
// and rebuilds the groups from the elements' group ids.
//
// Version 1 (4.3.0) stored all of that, and a repeat with an explicit
// `enabled` flag; version 2 stores a repeat only when it is on. Both load.
//
// Loading is treated as untrusted input, like an SVG import: size, count
// and range limits; every value re-validated, an SVG shape with the
// importer's own limits (svg-import/shape.js); fresh ids, so a
// hand-edited file can't smuggle in a duplicate id or a dangling group
// reference; no field kept that the type doesn't have.
import { SCOPE_TYPES, defaultScope, validateScope } from './scope.js';
import { ILLUMINATION_COLOURS, DEFAULT_ILLUMINATION } from './model.js';
import {
  ELEMENT_TYPES, REPEAT_DIRECTIONS, NO_REPEAT, MAX_ANGLE, isElementType, validateElement, canMirror, canRepeat, canIlluminate,
  staysOnVerticalAxis
} from './element-types.js';
import { normalizeShape } from './svg-import/shape.js';
import { expandInstances } from './geometry.js';

export const FILE_FORMAT = 'ebalka2-reticle';
export const FILE_VERSION = 2;
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
// The scope fields each type uses: a fixed scope has one field of view,
// a variable one a zoom range, and only an SFP a calibration zoom.
const SCOPE_KEYS_BY_TYPE = {
  fixed: ['type', 'fovMaxRad', 'fovDistanceM'],
  ffp: ['type', 'fovMaxRad', 'fovMinRad', 'fovDistanceM', 'zoomMin', 'zoomMax'],
  sfp: SCOPE_KEYS
};
const REPEAT_KEYS = ['direction', 'count', 'step'];
const NUMBER_KEYS = ['text', 'anchor', 'font'];
const SVG_PATH_KEYS = ['d', 'fill', 'fillRule', 'stroke', 'cap', 'join', 'miter'];

function pick(source, keys) {
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

// An element as written to a file: its type's fields only, and of those
// only what shapes the reticle (see the top of this file).
export function storedElement(element) {
  const def = ELEMENT_TYPES[element.type];
  const out = { type: element.type, ...pick(element, numericKeysOf(def, { stored: true })) };
  if (element.type === 'number') Object.assign(out, pick(element, NUMBER_KEYS));
  if (element.type === 'svg') {
    out.scale = element.scale;
    if (element.name) out.name = element.name;
    if (element.mirror) out.reflect = element.reflect;
    out.shape = { paths: element.shape.paths.map((p) => pick(p, SVG_PATH_KEYS)) };
  }
  if (canIlluminate(element.type) && element.illuminated === true) out.illuminated = true;
  if (canMirror(element.type) && element.mirror === true) out.mirror = true;
  if (canRepeat(element.type) && element.repeat?.enabled) out.repeat = pick(element.repeat, REPEAT_KEYS);
  if (element.groupId) out.groupId = element.groupId;
  return out;
}

export function serializeReticle(doc) {
  const payload = { format: FILE_FORMAT, version: FILE_VERSION };
  if (doc.name) payload.name = doc.name;
  payload.scope = pick(doc.scope, SCOPE_KEYS_BY_TYPE[doc.scope.type] ?? SCOPE_KEYS);
  const illumination = { enabled: doc.illumination?.enabled === true, colour: doc.illumination?.colour ?? DEFAULT_ILLUMINATION.colour };
  if (illumination.enabled !== DEFAULT_ILLUMINATION.enabled || illumination.colour !== DEFAULT_ILLUMINATION.colour) {
    payload.illumination = illumination;
  }
  payload.elements = doc.elements.map(storedElement);
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
  const parsed = raw.elements.map((e, i) => parseElement(e, i, budget, raw.version));

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
