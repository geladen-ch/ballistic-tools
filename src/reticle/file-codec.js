// Reticle files as the Reticle Designer saved them before the reticle
// library (4.3.x): a reticle document as JSON. Only read now — to bring
// such a file into the library (see legacy-file.js) — never written.
// Pure; reading runs in the import worker (svg-import/client.js), so even
// a hostile or broken file can't freeze the app. What a file stores of the
// reticle, and how reading it is checked, is stored-reticle.js's; this
// file adds the file envelope and the scope as the file had it. A file
// from a newer version is refused with its own error.
//
// Version 1 (4.3.0) stored every field, and a repeat with an explicit
// `enabled` flag; version 2 stores a repeat only when it is on. Both store
// the scope as optics (`scope`: its fields of view and zoom range), which
// reading turns into a reference scope (scope.js's
// referenceScopeFromOptics) and also returns as read (`legacyScope`).
import { SCOPE_TYPES, defaultScope, validateScope, referenceScopeFromOptics } from './scope.js';
import { RETICLE_LIMITS, MAX_NAME, pick, fail, finite, parseIllumination, parseElements } from './stored-reticle.js';

export const FILE_FORMAT = 'ebalka2-reticle';
export const FILE_VERSION = 2;
export const FILE_EXTENSION = '.reticle.json';

// Reading limits: the stored reticle's own, and the size of the file.
export const FILE_LIMITS = { maxChars: 20000000, ...RETICLE_LIMITS };

const SCOPE_KEYS = ['type', 'fovMaxRad', 'fovMinRad', 'fovDistanceM', 'zoomMin', 'zoomMax', 'calibrationZoom'];
// The optics fields each type of scope uses.
const SCOPE_KEYS_BY_TYPE = {
  fixed: ['type', 'fovMaxRad', 'fovDistanceM'],
  ffp: ['type', 'fovMaxRad', 'fovMinRad', 'fovDistanceM', 'zoomMin', 'zoomMax'],
  sfp: SCOPE_KEYS
};

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

// Text of a reticle file → { name, referenceScope, legacyScope,
// illumination, elements, groups, nextId }: the file's reticle name (its
// only identity), the reference scope derived from its optics, the optics
// as the file gave them (only the fields its type uses), and the reticle.
// Throws an Error whose `code` is 'invalid-json', 'invalid-format',
// 'unsupported-version' or 'too-large'.
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

  const scope = parseScope(raw.scope);
  const illumination = parseIllumination(raw.illumination);
  const { elements, groups, nextId } = parseElements(raw.elements, raw.version);
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, MAX_NAME) : '',
    referenceScope: referenceScopeFromOptics(scope),
    legacyScope: pick(scope, SCOPE_KEYS_BY_TYPE[scope.type]),
    illumination,
    elements,
    groups,
    nextId
  };
}
