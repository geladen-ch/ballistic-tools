// The boundary between how values are held in memory (each quantity
// kind's internal unit — see quantity.js) and how earlier builds stored
// them: cookies, localStorage, IndexedDB records and export files all
// still use the old field names and units. Every field that changed unit
// also changed name, so a stored object is read and written through this
// one table rather than by hand at each call site.
//
// The table is append-only and frozen in meaning: a row describes what a
// field meant in data that already exists, which never changes, so a row
// is never edited once released.
import { converter, hpaToPa, paToHpa, percentToFraction, fractionToPercent, mmToM, mToMm, cmToM, mToCm } from './quantity.js';

// [stored name, in-memory name, stored → in-memory, in-memory → stored]
const RENAMED_FIELDS = [
  ['pressureHpa', 'pressurePa', hpaToPa, paToHpa],
  ['humidityPct', 'humidity', percentToFraction, fractionToPercent],
  ['pressureMedianErrorHpa', 'pressureMedianErrorPa', hpaToPa, paToHpa],
  // the active rifle in the gun cookie
  ['sightHeight', 'sightHeightM', mmToM, mToMm],
  ['riflingTwist', 'riflingTwistM', mmToM, mToMm],
  // the Trajectory tool's own inputs
  ['targetHeightCm', 'targetHeightM', cmToM, mToCm]
];

const BY_STORED = new Map(RENAMED_FIELDS.map(([stored, current, decode]) => [stored, { name: current, convert: decode }]));
const BY_CURRENT = new Map(RENAMED_FIELDS.map(([stored, current, , encode]) => [current, { name: stored, convert: encode }]));

function rename(obj, table) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const hit = table.get(key);
    if (!hit) out[key] = value;
    else out[hit.name] = typeof value === 'number' ? hit.convert(value) : value;
  }
  return out;
}

// A stored object's own top-level fields → in-memory names and units.
// Fields already in memory form, and fields this table doesn't know, pass
// through unchanged; null/undefined values keep their (renamed) key.
export function decodeLegacy(obj) {
  return rename(obj, BY_STORED);
}

// The inverse, for writing an in-memory object back in the stored form.
export function encodeLegacy(obj) {
  return rename(obj, BY_CURRENT);
}

// Stored values keyed by a form field's id rather than by a quantity name
// (a tool's own persisted panel of field values): the key stays the field
// id, only the unit its value is stored in differs from memory.
// [field id, stored unit, in-memory unit]
const FIELD_KEYED_UNITS = [
  ['pressureMedianError', 'hPa', 'Pa'],
  ['aimOffsetX', 'cm', 'm'],
  ['aimOffsetY', 'cm', 'm'],
  ['circleGongDiameter', 'cm', 'm'],
  ['rectPlateWidth', 'cm', 'm'],
  ['rectPlateHeight', 'cm', 'm']
];
const FIELD_KEYED = new Map(FIELD_KEYED_UNITS.map(([id, stored, current]) => [id, { decode: converter(stored, current), encode: converter(current, stored) }]));

function convertFieldValues(obj, direction) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = { ...obj };
  for (const [id, conv] of FIELD_KEYED) {
    if (typeof out[id] === 'number') out[id] = conv[direction](out[id]);
  }
  return out;
}

export function decodeFieldValues(obj) {
  return convertFieldValues(obj, 'decode');
}

export function encodeFieldValues(obj) {
  return convertFieldValues(obj, 'encode');
}
