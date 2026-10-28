// The synced records — Arsenal rifles (with their cartridges), locations
// (with their targets) and rifle-precision projects — as the app holds
// them (SI, see quantity.js) and as they are stored and travel between
// devices: localStorage, IndexedDB, sync bundles, export files, change
// history and pending review.
//
// Earlier builds store some quantities in other units under other names
// (a target's incline in degrees as `losAngleDeg`, a click size in the
// turret's own unit, ...), and peers still running such a build keep
// reading and writing those names. So while both kinds of build share a
// sync folder, a record is stored with both fields — the SI one and its
// legacy twin, the twin computed from the SI value — and a record that
// arrives with only the legacy field still reads correctly:
//
//  - encode*(record) writes the SI field and its legacy twin.
//  - decode*(stored) takes the SI field when its legacy twin still says
//    the same thing (within MATCH_TOLERANCE), and otherwise converts the
//    legacy field: a twin that no longer matches means a previous build
//    edited it after the last write from this one, so it is the newer
//    value. A record with only one of the two uses that one. The legacy
//    field is dropped from the decoded record, so nothing in the app can
//    read a stale copy of it.
//
// A stored record is never rewritten just to change its shape: the
// libraries keep each record as it was stored (or received), decode on
// every read the app makes, and encode only when the app saves an edit.
// Rewriting untouched records would make every peer see "same revision,
// different content" and send each one to review.
//
// Unknown fields pass through both ways, so a field added by a later
// build survives a round trip through this one.
//
// Re-encoding a record is not neutral for earlier builds. legacy → SI →
// legacy is not always bit-exact (degrees ↔ radians and mm ↔ m come back
// one ulp off for a few percent of values), and earlier builds compare
// stored records as they are, extra SI fields included. So a record this
// build re-encoded without an edit would reach an earlier-build peer as
// "same revision, different content" and go to its review queue. This
// build is not affected — a legacy-only copy and its re-encoded copy
// decode to the same SI value, and merge compares decoded records — but
// the peers are. Nothing produces such a record today: a record is only
// encoded when the app saves an edit, which bumps its revision. Keep it
// that way: never re-encode (migrate, normalise, "tidy") a record that was
// not edited.
import { clickValueInUnit } from './units.js';
import { decodeScope, encodeScope } from './scope-record.js';
import { converter, degToRad, radToDeg, mradToRad, radToMrad, hpaToPa, paToHpa, percentToFraction, fractionToPercent, mmToM, mToMm } from './quantity.js';

const MATCH_TOLERANCE = 1e-9;

function matches(legacy, expected) {
  if (legacy === expected) return true;
  if (typeof legacy !== 'number' || typeof expected !== 'number') return false;
  return Math.abs(legacy - expected) <= MATCH_TOLERANCE * Math.max(Math.abs(legacy), Math.abs(expected));
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const convertOrKeep = (v, fn) => (typeof v === 'number' ? fn(v) : v);

// One field pair on one object: [legacy name, SI name, legacy → SI, SI → legacy].
function decodePairs(obj, pairs) {
  if (!isObject(obj)) return obj;
  const out = { ...obj };
  for (const [legacy, si, toSI, fromSI] of pairs) {
    const hasLegacy = legacy in obj;
    const hasSI = si in obj;
    if (hasLegacy && !(hasSI && typeof obj[si] === 'number' && matches(obj[legacy], fromSI(obj[si])))) {
      out[si] = convertOrKeep(obj[legacy], toSI);
    }
    delete out[legacy];
  }
  return out;
}

function encodePairs(obj, pairs) {
  if (!isObject(obj)) return obj;
  const out = { ...obj };
  for (const [legacy, si, , fromSI] of pairs) {
    if (si in obj) out[legacy] = convertOrKeep(obj[si], fromSI);
  }
  return out;
}

const mapArray = (arr, fn) => (Array.isArray(arr) ? arr.map(fn) : arr);

// ---- rifle ----
// Click sizes: stored in the turret's engraved unit (defaultClickUnit),
// rounded the way the Arsenal form shows them; held in radians.
function clickPairs(unit) {
  if (unit !== 'mrad' && unit !== 'arcmin') return [];
  const toRad = converter(unit, 'rad');
  const fromRad = (rad) => clickValueInUnit(rad, unit);
  return [
    ['defaultClickHorizontal', 'defaultClickHorizontalRad', toRad, fromRad],
    ['defaultClickVertical', 'defaultClickVerticalRad', toRad, fromRad]
  ];
}

const PRECISION_PAIRS = [['r50Mrad', 'r50Rad', mradToRad, radToMrad]];
const ATMOSPHERE_PAIRS = [
  ['pressureHpa', 'pressurePa', hpaToPa, paToHpa],
  ['humidityPct', 'humidity', percentToFraction, fractionToPercent]
];

function decodeCartridge(c) {
  if (!isObject(c)) return c;
  const out = { ...c };
  if ('precision' in c) out.precision = decodePairs(c.precision, PRECISION_PAIRS);
  if ('zeroAtmosphere' in c) out.zeroAtmosphere = decodePairs(c.zeroAtmosphere, ATMOSPHERE_PAIRS);
  return out;
}

function encodeCartridge(c) {
  if (!isObject(c)) return c;
  const out = { ...c };
  if ('precision' in c) out.precision = encodePairs(c.precision, PRECISION_PAIRS);
  if ('zeroAtmosphere' in c) out.zeroAtmosphere = encodePairs(c.zeroAtmosphere, ATMOSPHERE_PAIRS);
  return out;
}

export function decodeRifle(stored) {
  if (!isObject(stored)) return stored;
  const out = decodePairs(stored, clickPairs(stored.defaultClickUnit));
  if ('cartridges' in stored) out.cartridges = mapArray(stored.cartridges, decodeCartridge);
  return out;
}

export function encodeRifle(rifle) {
  if (!isObject(rifle)) return rifle;
  const out = encodePairs(rifle, clickPairs(rifle.defaultClickUnit));
  if ('cartridges' in rifle) out.cartridges = mapArray(rifle.cartridges, encodeCartridge);
  return out;
}

// ---- location ----
const TARGET_PAIRS = [['losAngleDeg', 'losAngleRad', degToRad, radToDeg]];

export function decodeLocation(stored) {
  if (!isObject(stored) || !('targets' in stored)) return stored;
  return { ...stored, targets: mapArray(stored.targets, (t) => decodePairs(t, TARGET_PAIRS)) };
}

export function encodeLocation(location) {
  if (!isObject(location) || !('targets' in location)) return location;
  return { ...location, targets: mapArray(location.targets, (t) => encodePairs(t, TARGET_PAIRS)) };
}

// ---- rifle-precision project ----
const PROJECT_PAIRS = [['caliberMm', 'caliberM', mmToM, mToMm]];
const CALIBRATION_PAIRS = [['realLengthMm', 'realLengthM', mmToM, mToMm]];

function mapCalibration(target, fn) {
  if (!isObject(target) || !('calibration' in target)) return target;
  return { ...target, calibration: fn(target.calibration, CALIBRATION_PAIRS) };
}

export function decodeRiflePrecisionProject(stored) {
  if (!isObject(stored)) return stored;
  const out = decodePairs(stored, PROJECT_PAIRS);
  if ('targets' in stored) out.targets = mapArray(stored.targets, (t) => mapCalibration(t, decodePairs));
  return out;
}

export function encodeRiflePrecisionProject(project) {
  if (!isObject(project)) return project;
  const out = encodePairs(project, PROJECT_PAIRS);
  if ('targets' in project) out.targets = mapArray(project.targets, (t) => mapCalibration(t, encodePairs));
  return out;
}

// ---- by record type (the sync layer's names) ----
const identity = (r) => r;

// A scope's codec only sets its name (scope-record.js). A reticle is
// compared, and passed around, in its stored form: decoding one validates
// the whole reticle and gives it fresh element ids, and the stored form is
// already canonical — it is only ever encoded when the reticle is saved —
// so the sync layer turns it into the form the app holds only to save it
// (synced-libraries.js).
export const RECORD_CODECS = {
  bullet: { decode: identity, encode: identity },
  rifle: { decode: decodeRifle, encode: encodeRifle },
  scope: { decode: decodeScope, encode: encodeScope },
  reticle: { decode: identity, encode: identity },
  location: { decode: decodeLocation, encode: encodeLocation },
  'rifle-precision-project': { decode: decodeRiflePrecisionProject, encode: encodeRiflePrecisionProject }
};

export function decodeRecord(recordType, stored) {
  const codec = RECORD_CODECS[recordType];
  return codec ? codec.decode(stored) : stored;
}
