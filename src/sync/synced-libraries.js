// One entry per user-authored library this app syncs — shared between
// auto-sync.js's runSyncCycle() (Phase 5, folder-based) and
// manual-sync.js's importPeerBundleText() (Phase 8a/8b, one-off file
// based): both merge the exact same lists the exact same way, they
// just get the remote bundle from a different place. `write` serves both
// mergeRecords callbacks (importRaw and tombstone) — see merge.js's own
// note on why that's one function, not two.
import {
  loadUserBulletsWithTombstones, loadUserRiflesWithTombstones, importUserBullet, importUserRifle,
  saveUserBullet, saveUserRifle, loadUserScopesWithTombstones, importUserScope, saveUserScope
} from '../user-library.js';
import { loadUserReticlesWithTombstones, importUserReticle, saveUserReticle } from '../reticle-library.js';
import { decodeReticleRecord } from '../reticle/reticle-record.js';
import { checkReticleRecords } from '../reticle/svg-import/client.js';
import { logSyncEvent } from './sync-log.js';
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
//
// `screenRemote(list, peerLabel)`, where a library has one, runs on a
// peer's list before it is merged, and gives back what may be merged.
// Reticles are untrusted input, however they arrive: each one is checked
// in the import worker, exactly as an import file's are, and one that
// fails (or a list the worker couldn't finish in time) is left out of
// this merge — so nothing unchecked is ever stored; the next cycle tries
// again.
async function screenReticles(list, peerLabel) {
  if (list.length === 0) return list;
  const outcome = await checkReticleRecords(list);
  const valid = outcome.ok ? outcome.valid : list.map(() => false);
  const kept = list.filter((_, i) => valid[i]);
  if (kept.length < list.length) {
    logSyncEvent('warn', 'merge: reticle — skipping', list.length - kept.length, 'unreadable record(s) from', peerLabel || 'peer',
      outcome.ok ? '' : `(check failed: ${outcome.code})`);
  }
  return kept;
}

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
    recordType: 'scope',
    loadLocalWithTombstones: loadUserScopesWithTombstones,
    remoteList: (bundle) => bundle.arsenal.scopes || [],
    write: importUserScope,
    save: saveUserScope
  },
  {
    recordType: 'reticle',
    loadLocalWithTombstones: loadUserReticlesWithTombstones,
    remoteList: (bundle) => bundle.arsenal.reticles || [],
    screenRemote: screenReticles,
    write: importUserReticle,
    save: saveUserReticle,
    // Merged in its stored form (record-codec.js), held decoded.
    saveDecode: decodeReticleRecord
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
  const toSave = lib.saveDecode || decode;
  return {
    ...lib,
    decode,
    screenRemote: lib.screenRemote || (async (list) => list),
    save: (stored) => lib.save(toSave(stored))
  };
});
