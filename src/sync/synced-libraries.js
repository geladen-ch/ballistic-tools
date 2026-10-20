// One entry per user-authored library this app syncs — shared between
// auto-sync.js's runSyncCycle() (Phase 5, folder-based) and
// manual-sync.js's importPeerBundleText() (Phase 8a/8b, one-off file
// based): both merge the exact same four lists the exact same way, they
// just get the remote bundle from a different place. `write` serves both
// mergeRecords callbacks (importRaw and tombstone) — see merge.js's own
// note on why that's one function, not two.
import {
  loadUserBulletsWithTombstones, loadUserRiflesWithTombstones, importUserBullet, importUserRifle,
  saveUserBullet, saveUserRifle
} from '../user-library.js';
import { loadUserLocationsWithTombstones, importUserLocation, saveUserLocation } from '../location-library.js';
import {
  loadRiflePrecisionProjectsWithTombstones, importRiflePrecisionProject, saveRiflePrecisionProject
} from '../rifle-precision-library.js';
import { RECORD_CODECS } from '../record-codec.js';

// Everything sync handles — `loadLocalWithTombstones`, `remoteList`,
// `write` — is in the stored form (record-codec.js), which merge,
// pending review and change history pass along untouched. `save` takes a
// stored-form record too (a remote version or a history snapshot being
// adopted as a local edit) and decodes it for the library's own save,
// which encodes it afresh; `decode` is what the merge compares by.
const LIBRARIES = [
  {
    recordType: 'bullet',
    loadLocalWithTombstones: loadUserBulletsWithTombstones,
    remoteList: (bundle) => bundle.arsenal.bullets,
    write: importUserBullet,
    // Used only to resolve a pending-review conflict (Phase 6) — an
    // ordinary edit through the normal save path (stamps a fresh
    // modifiedAt/modifiedBy for *this* device), unlike `write` above,
    // which preserves whatever authorship a synced record already carries.
    save: saveUserBullet
  },
  {
    recordType: 'rifle',
    loadLocalWithTombstones: loadUserRiflesWithTombstones,
    remoteList: (bundle) => bundle.arsenal.rifles,
    write: importUserRifle,
    save: saveUserRifle
  },
  {
    recordType: 'location',
    loadLocalWithTombstones: loadUserLocationsWithTombstones,
    remoteList: (bundle) => bundle.locations.locations,
    write: importUserLocation,
    save: saveUserLocation
  },
  {
    recordType: 'rifle-precision-project',
    loadLocalWithTombstones: loadRiflePrecisionProjectsWithTombstones,
    remoteList: (bundle) => bundle.riflePrecision.projects,
    write: importRiflePrecisionProject,
    save: saveRiflePrecisionProject
  }
];

export const SYNCED_LIBRARIES = LIBRARIES.map((lib) => {
  const { decode } = RECORD_CODECS[lib.recordType];
  return { ...lib, decode, save: (stored) => lib.save(decode(stored)) };
});
