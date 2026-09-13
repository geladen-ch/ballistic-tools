// The sync bundle format — one combined envelope per device per sync
// cycle, carrying all four user libraries *with* tombstones (Phase 1),
// unlike the three existing per-library export formats
// (ebalka2-arsenal/-locations/-rifle-precision), which stay tombstone-free
// on purpose — see docs/plans/backup-sync.md's "Keep tombstones out of the
// existing export files". A new format string with no installed base, so
// there's no backward/forward-compatibility hazard to manage here the way
// there would be for the existing three.
import { loadUserBulletsWithTombstones, loadUserRiflesWithTombstones } from '../user-library.js';
import { loadUserLocationsWithTombstones } from '../location-library.js';
import { loadRiflePrecisionProjectsWithTombstones } from '../rifle-precision-library.js';
import { getDeviceId } from './device-id.js';
import { ensureDeviceNameRecord } from './device-name.js';

const FILE_FORMAT = 'ebalka2-backup';
const FILE_VERSION = 1;

export function backupFileName(deviceId) {
  return `backup-${deviceId}.json`;
}

// Gathers the four libraries via their WithTombstones() readers — the
// plain load*() readers return live records only, and a bundle without
// tombstones can't propagate deletions (Phase 1). Always produces inline
// photos (photoStorage: 'inline') — Phase 7's referenced-photo split is
// applied afterward, by auto-sync.js calling
// photo-assets.js's applyReferencedPhotoStorage(), which is the only
// context with the folder access that split actually needs. This function
// itself stays synchronous and folder-agnostic on purpose, so
// manual-sync.js's downloadOwnBundle() (no folder access, ever) can use it
// completely unchanged.
//
// structuredClone()'d before returning: location-library.js's/
// rifle-precision-library.js's own WithTombstones() readers hand back
// their live in-memory `mirror` array *by reference*, not a copy (unlike
// user-library.js's own load(), which is backed by a fresh
// JSON.parse(localStorage...) every call and so is already independent).
// Without the clone, a caller that mutates its own bundle in place —
// exactly what applyReferencedPhotoStorage() does, replacing a photo with
// a photoRef — would silently corrupt this device's actual location/
// project records in memory too, with nothing to notice until reload.
// A bundle is a snapshot; nothing downstream should be able to reach back
// into live app state through it.
// `unsaved` is purely local bookkeeping — the same field
// arsenal-export.js's own stripLocalOnlyFields() removes from the three
// per-library export files, and for the same reason: it always reads
// misleadingly on another device, and it is by definition already false
// for anything being published. merge.js's equivalent() drops it from
// both sides anyway, so leaving it in would not break a merge — but it
// would put a field in the shared file that the plan's own model says
// isn't there, which is exactly the kind of drift that makes the next
// equality bug hard to see. `modifiedBy` is deliberately NOT stripped: a
// peer needs it to render "(from Guns' iPhone)" (Phase 2/4b).
function stripLocalOnlyFields(entry) {
  const { unsaved, ...rest } = entry;
  return rest;
}

export function buildBackupBundle() {
  const { name, modifiedAt } = ensureDeviceNameRecord();
  return structuredClone({
    format: FILE_FORMAT,
    version: FILE_VERSION,
    // Deliberately no separate top-level deviceId alongside device.id —
    // two fields carrying the same value invites divergence; device.id is
    // the single source of truth, and the filename is derived from it.
    device: { id: getDeviceId(), name, modifiedAt },
    exportedAt: new Date().toISOString(),
    photoStorage: 'inline',
    arsenal: {
      bullets: loadUserBulletsWithTombstones().map(stripLocalOnlyFields),
      rifles: loadUserRiflesWithTombstones().map(stripLocalOnlyFields)
    },
    locations: { locations: loadUserLocationsWithTombstones().map(stripLocalOnlyFields) },
    riflePrecision: { projects: loadRiflePrecisionProjectsWithTombstones().map(stripLocalOnlyFields) }
  });
}

export function serializeBackupBundle(bundle) {
  return JSON.stringify(bundle, null, 2);
}

// A parse failure here is a routine, expected event, not an exceptional
// one — a cloud sync client can briefly present a partially-downloaded or
// mid-write file. Callers (Phase 5's runSyncCycle) are expected to catch
// the typed `.code` error, skip that file for this cycle, log it (Phase
// 10), and retry next cycle rather than surface it to the user as an
// error.
export function parseBackupBundle(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw Object.assign(new Error('not valid JSON'), { code: 'invalid-json' });
  }
  const looksRight = payload && typeof payload === 'object'
    && payload.format === FILE_FORMAT
    && payload.device && typeof payload.device.id === 'string'
    && payload.arsenal && Array.isArray(payload.arsenal.bullets) && Array.isArray(payload.arsenal.rifles)
    && payload.locations && Array.isArray(payload.locations.locations)
    && payload.riflePrecision && Array.isArray(payload.riflePrecision.projects);
  if (!looksRight) {
    throw Object.assign(new Error('not a recognized backup bundle'), { code: 'invalid-format' });
  }
  return payload;
}
