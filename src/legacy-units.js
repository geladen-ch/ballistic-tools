// The boundary between how values are held in memory (each quantity
// kind's internal unit — see quantity.js) and how earlier builds stored
// them. Synced records (localStorage, IndexedDB) and export files still
// use the old field names and units and are read and written through
// these tables; the per-device cookies are stored in SI under v2 names and
// use them only to convert a v1 cookie once (versioned-cookie.js). Every
// field that changed unit also changed name, so a stored object goes
// through one table rather than being converted by hand at each call site.
//
// The table is append-only and frozen in meaning: a row describes what a
// field meant in data that already exists, which never changes, so a row
// is never edited once released.
import { clickValueInUnit } from './units.js';
import { converter, hpaToPa, paToHpa, percentToFraction, fractionToPercent, mmToM, mToMm, cmToM, mToCm, degToRad, radToDeg } from './quantity.js';

// [stored name, in-memory name, stored → in-memory, in-memory → stored]
const RENAMED_FIELDS = [
  ['pressureHpa', 'pressurePa', hpaToPa, paToHpa],
  ['humidityPct', 'humidity', percentToFraction, fractionToPercent],
  ['pressureMedianErrorHpa', 'pressureMedianErrorPa', hpaToPa, paToHpa],
  // the active rifle in the gun cookie
  ['sightHeight', 'sightHeightM', mmToM, mToMm],
  ['riflingTwist', 'riflingTwistM', mmToM, mToMm],
  // the Trajectory tool's own inputs
  ['targetHeightCm', 'targetHeightM', cmToM, mToCm],
  // line-of-sight and wind directions (Trajectory, Range Solver's target,
  // wind and atmosphere slices)
  ['losAngleDeg', 'losAngleRad', degToRad, radToDeg],
  ['windAngle', 'windAngleRad', degToRad, radToDeg],
  ['angle', 'angleRad', degToRad, radToDeg]
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
  ['rectPlateHeight', 'cm', 'm'],
  ['benchPrecision', 'mrad', 'rad'],
  ['shooterSkill', 'mrad', 'rad'],
  ['combinedPrecision', 'mrad', 'rad'],
  ['spotterMeasure', 'mrad', 'rad'],
  ['distanceMedianError', '%', '1'],
  ['movingTargetSpeedError', '%', '1']
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

// A rifle's scope click settings: in memory { unit, horizontalRad,
// verticalRad } (unit is the turret's engraved unit, kept for display); as
// stored, the click sizes in that unit — { unit, horizontal, vertical } in
// the gun cookie, defaultClickUnit/Horizontal/Vertical on an Arsenal rifle.
export function clickSettingsFromStored(stored) {
  if (!stored) return stored;
  const toRad = converter(stored.unit, 'rad');
  return { unit: stored.unit, horizontalRad: toRad(stored.horizontal), verticalRad: toRad(stored.vertical) };
}

export function clickSettingsToStored(settings) {
  if (!settings) return settings;
  return { unit: settings.unit, horizontal: clickValueInUnit(settings.horizontalRad, settings.unit), vertical: clickValueInUnit(settings.verticalRad, settings.unit) };
}

export function clickSettingsFromRifleRecord(rifle) {
  return clickSettingsFromStored({ unit: rifle.defaultClickUnit, horizontal: rifle.defaultClickHorizontal, vertical: rifle.defaultClickVertical });
}

export function clickSettingsToRifleRecord(settings) {
  const stored = clickSettingsToStored(settings);
  return { defaultClickUnit: stored.unit, defaultClickHorizontal: stored.horizontal, defaultClickVertical: stored.vertical };
}
