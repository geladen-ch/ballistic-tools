// Sync cycle orchestration — see docs/plans/backup-sync.md Phase 5.
// Manual is the default on every platform; automatic mode (Chromium-only)
// is an explicit opt-in that registers a periodic timer plus a
// tab-focus/visibilitychange trigger.
import {
  isFileSystemAccessSupported, getPersistedFolderHandle, verifyPermission,
  listBackupFiles, readFile, writeOwnBackupFile, readAssetFile
} from './fs-folder.js';
import { buildBackupBundle, serializeBackupBundle, parseBackupBundle, backupFileName } from './backup-bundle.js';
import { getDeviceId } from './device-id.js';
import { recordPeerDevice, getPeerExportedAt, recordPeerExportedAtSeen } from './device-registry.js';
import { mergeRecords, detectFutureExport, detectBackwardExport } from './merge.js';
import { addPendingReview, clearPendingReview, expireStaleReviewsForPeer } from './pending-review.js';
import { onLibraryWrite } from './write-hooks.js';
import { logSyncEvent } from './sync-log.js';
import { logDiagnostic } from '../debug-log.js';
import { SYNCED_LIBRARIES } from './synced-libraries.js';
import { recordSyncCompleted, recordPendingPhotoDevices, recordClockSkewedDevices } from './last-sync-status.js';
import { isBackupSyncEnabled } from '../backup-sync-prefs.js';
import { applyReferencedPhotoStorage, resolveBundlePhotoRefs } from './photo-assets.js';
import { isIphoneSyncSupportEnabled } from './photo-storage-prefs.js';

// "Has anything changed since the bundle we last published?" — see "Write
// only when something changed": a rewrite with nothing to say gets
// re-uploaded and re-merged by every peer for no reason, which matters a
// lot under automatic mode and a little even for a habitual manual "Sync
// Now" click.
//
// A counter rather than a boolean, because clearing a boolean after the
// write loses any edit the user made *during* it. Publishing is several
// awaits long (the photo-asset split, then the file write itself), and a
// save landing in that window would set the flag and then have it cleared
// by a publish whose bundle predates it — leaving that edit unpublished
// until some unrelated later write happened to set the flag again.
// Recording which revision the published bundle was built from instead
// makes that window harmless: the counter has moved on, so the device is
// still dirty and the next cycle republishes.
let writeSeq = 0;
let publishedSeq = 0;
onLibraryWrite(() => { writeSeq++; });

function isDirty() {
  return writeSeq !== publishedSeq;
}

export { getLastSyncedAt, getLastSyncedDevices } from './last-sync-status.js';

const SYNC_MODE_KEY = 'ballistics_sync_mode_v1';

export function getSyncMode() {
  try {
    return localStorage.getItem(SYNC_MODE_KEY) === 'automatic' ? 'automatic' : 'manual';
  } catch {
    return 'manual';
  }
}

// Registers/tears down the automatic triggers as the mode actually
// changes, and runs one immediate cycle on switching into automatic so
// opting in doesn't leave the device sitting on stale data until the first
// timer tick. Switching back to manual tears the listeners down but
// leaves any in-flight cycle to finish on its own.
export function setSyncMode(mode) {
  const normalized = mode === 'automatic' ? 'automatic' : 'manual';
  const previous = getSyncMode();
  try {
    localStorage.setItem(SYNC_MODE_KEY, normalized);
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
  if (normalized === 'automatic' && previous !== 'automatic') {
    registerAutomaticTriggers();
    runSyncCycle({ trigger: 'mode-switch' }).catch(() => {});
  } else if (normalized !== 'automatic' && previous === 'automatic') {
    unregisterAutomaticTriggers();
  }
}

// Called once at app boot (see app.js), and again right after the master
// toggle (backup-sync-prefs.js) is switched on, to resume automatic mode
// across a reload if the user had it on. Checks the master toggle itself,
// not just the sync mode preference — if backup/sync was ever turned back
// off, this must stay a no-op even though `ballistics_sync_mode_v1` still
// says "automatic" from before, since the master toggle being off means
// nothing about this feature runs, permanently, until re-enabled (see
// docs/plans/backup-sync.md Phase 6).
export function initSyncTriggers() {
  if (isBackupSyncEnabled() && getSyncMode() === 'automatic') registerAutomaticTriggers();
}

const TRIGGER_INTERVAL_MS = 5 * 60 * 1000; // "every few minutes"

let intervalHandle = null;
let visibilityListenerAttached = false;

function onVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    runSyncCycle({ trigger: 'focus' }).catch(() => {});
  }
}

// In manual mode these are never registered at all, not registered-then-
// short-circuited — no reason to wake up every few minutes just to decide
// to do nothing.
export function registerAutomaticTriggers() {
  if (intervalHandle) return; // already registered
  intervalHandle = setInterval(() => { runSyncCycle({ trigger: 'timer' }).catch(() => {}); }, TRIGGER_INTERVAL_MS);
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', onVisibilityChange);
    visibilityListenerAttached = true;
  }
  logSyncEvent('debug', 'automatic sync triggers registered (timer + focus)');
}

export function unregisterAutomaticTriggers() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (visibilityListenerAttached && typeof document !== 'undefined' && document.removeEventListener) {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    visibilityListenerAttached = false;
  }
  logSyncEvent('debug', 'automatic sync triggers unregistered');
}

// Same-tab-only fallback for browsers without navigator.locks (Web Locks
// is Chromium 69+/Firefox 96+/Safari 15.4+, which covers everywhere this
// feature realistically runs, but Phase 8 targets exactly the browsers
// that might lack it).
let fallbackLockHeld = false;

// navigator.locks.request with `ifAvailable: true` means a second
// concurrent call — same tab or another one — skips immediately rather
// than queuing, since a cycle already running makes a second one
// redundant; the next natural trigger will pick up whatever changed in
// the meantime. Released automatically if the tab closes mid-cycle.
async function withSyncLock(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    let ran = false;
    await navigator.locks.request('ballistics-sync', { ifAvailable: true }, async (lock) => {
      if (!lock) {
        logSyncEvent('debug', 'sync skipped: another cycle already in progress');
        return;
      }
      ran = true;
      await fn();
    });
    return ran;
  }
  if (fallbackLockHeld) {
    logSyncEvent('debug', 'sync skipped: another cycle already in progress (same-tab fallback)');
    return false;
  }
  fallbackLockHeld = true;
  try {
    await fn();
    return true;
  } finally {
    fallbackLockHeld = false;
  }
}

// Verify permission → read every other device's backup-*.json in the
// folder → merge each into local libraries → write a fresh own bundle
// only if anything actually changed. `allowPrompt` must only be true when
// this call is directly inside a user gesture (the "Sync Now" click) —
// never from the background timer/focus triggers, since requestPermission
// requires one.
//
// Interrupted merges are safe to resume, by construction (see merge.js) —
// there's deliberately no transaction wrapping this whole cycle.
export async function runSyncCycle({ allowPrompt = false, trigger = 'manual' } = {}) {
  return withSyncLock(async () => {
    logSyncEvent('debug', 'sync cycle starting —', trigger);
    if (!isBackupSyncEnabled()) {
      // Defense in depth: the master toggle being off should already mean
      // no trigger is registered to call this in the first place, but a
      // stray leftover timer must still no-op rather than touch anything.
      logSyncEvent('debug', 'sync skipped: backup & sync is disabled');
      return;
    }
    if (!isFileSystemAccessSupported()) {
      logSyncEvent('debug', 'sync skipped: File System Access API not supported on this browser');
      return;
    }

    const handle = await getPersistedFolderHandle();
    if (!handle) {
      logSyncEvent('debug', 'sync skipped: no folder chosen yet');
      return;
    }

    const granted = await verifyPermission(handle, { allowPrompt });
    if (!granted) {
      logSyncEvent('debug', 'sync skipped: folder permission not granted');
      logDiagnostic('warn', '[sync] folder permission not granted — sync cycle aborted');
      return;
    }

    const deviceId = getDeviceId();
    const ownFileName = backupFileName(deviceId);
    let fileNames;
    try {
      fileNames = await listBackupFiles(handle);
    } catch (err) {
      logSyncEvent('warn', 'sync failed: could not list folder contents —', err && err.message);
      logDiagnostic('error', '[sync] could not list folder contents —', err && err.message);
      return;
    }

    let anyChange = false;
    const syncedDeviceNames = [];
    const photoPendingDeviceNames = [];
    const clockSkewedDevices = [];

    for (const fileName of fileNames) {
      if (fileName === ownFileName) continue;

      let bundle;
      try {
        const text = await readFile(handle, fileName);
        bundle = parseBackupBundle(text);
      } catch (err) {
        // A parse failure here is routine and expected — a cloud sync
        // client can briefly present a partially-downloaded or mid-write
        // file. Skip it and let the next cycle retry.
        logSyncEvent('debug', 'sync: skipping unreadable file', fileName, '—', (err && err.code) || 'unknown error');
        continue;
      }

      const peerLabel = bundle.device.name || bundle.device.id;
      syncedDeviceNames.push(peerLabel);
      // See merge.js's own comment on why this is two checks against the
      // peer's own history/bundle, not one check against this device's
      // clock: a peer that simply hasn't synced in weeks (expected — this
      // app's tombstone retention window is sized in months for exactly
      // that reason) must not be indistinguishable from one whose clock is
      // actually wrong.
      const previousExportedAt = getPeerExportedAt(bundle.device.id);
      const futureMs = detectFutureExport(bundle.exportedAt);
      const backwardMs = detectBackwardExport(bundle.exportedAt, previousExportedAt);
      recordPeerExportedAtSeen(bundle.device.id, bundle.exportedAt);
      if (futureMs !== null || backwardMs !== null) {
        const detail = futureMs !== null ? `future by ${futureMs}ms` : `jumped backward by ${backwardMs}ms`;
        logSyncEvent('debug', 'sync: clock anomaly detected for', peerLabel, `(${detail})`);
        logDiagnostic('warn', '[sync] clock anomaly detected for', peerLabel, `(${detail})`);
        clockSkewedDevices.push(peerLabel);
      }
      recordPeerDevice(bundle.device);
      // A no-op unless this peer wrote a referenced-mode bundle (Phase 7).
      // 'skip': a record whose asset hasn't finished syncing yet is left
      // out of *this* cycle's merge entirely, not merged in with a null
      // photo — see photo-assets.js's own comment on why that matters.
      const { anySkipped } = await resolveBundlePhotoRefs(bundle, { readAsset: (filename) => readAssetFile(handle, filename), onUnresolvable: 'skip' });
      if (anySkipped) photoPendingDeviceNames.push(bundle.device.name || bundle.device.id);

      for (const lib of SYNCED_LIBRARIES) {
        const remoteList = lib.remoteList(bundle);
        const { counts, reviewItems, resolvedIds } = mergeRecords(lib.loadLocalWithTombstones(), remoteList, {
          importRaw: lib.write,
          tombstone: lib.write,
          recordType: lib.recordType,
          peerLabel
        });
        if (counts.imported || counts.overwritten || counts.tombstoned) anyChange = true;
        // Any record this merge reached a definite answer on retires an
        // outstanding conflict against it (Phase 4). The write path already
        // covers the ones that wrote something; this also catches the
        // 'skip'/'noop' answers, which are just as definite but touch
        // nothing. Cheap: a no-op unless something is actually outstanding.
        for (const id of resolvedIds) clearPendingReview(lib.recordType, id);
        // A conflict attributed to this peer whose id it no longer even
        // offers has nothing left to review — see pending-review.js's own
        // comment for why this is a distinct case from resolvedIds above
        // (that covers ids still present but now resolved; this covers
        // ids the peer has stopped mentioning at all).
        expireStaleReviewsForPeer(lib.recordType, bundle.device.id, remoteList.map((r) => r.id));
        for (const item of reviewItems) {
          addPendingReview({
            recordType: lib.recordType,
            recordId: item.remote.id,
            reason: item.reason,
            peerDeviceId: bundle.device.id,
            remoteVersion: item.remote
          });
        }
        logSyncEvent('debug', 'sync: merged', lib.recordType, 'from', peerLabel, JSON.stringify(counts));
      }
    }

    recordSyncCompleted(syncedDeviceNames);
    recordClockSkewedDevices(clockSkewedDevices);
    // Deduplicated: a peer with multiple referenced-mode records still
    // pending should only be named once in the Settings warning.
    recordPendingPhotoDevices([...new Set(photoPendingDeviceNames)]);

    // This device's own file never existing in the folder yet is not "no
    // change to publish" — it's the very first sync into this folder, and
    // skipping it would leave the device permanently invisible to every
    // peer no matter how many times "Sync Now" is pressed: `dirty`/`anyChange`
    // both stay false on a freshly loaded page with nothing edited this
    // session and nothing to merge in, so without this check the cycle
    // updates "last synced" (a real read did happen) and then quietly
    // never writes a bundle at all. `fileNames` is already the folder
    // listing this cycle just took, so this costs nothing extra to check.
    const ownFileExists = fileNames.includes(ownFileName);
    if (!isDirty() && !anyChange && ownFileExists) {
      logSyncEvent('debug', 'sync: nothing changed, not publishing a new bundle');
      logSyncEvent('debug', 'sync cycle ended —', trigger);
      return;
    }

    // Captured before the bundle is built, so anything written during the
    // publish below leaves the device dirty rather than being swallowed.
    const seqAtSnapshot = writeSeq;
    try {
      const ownBundle = buildBackupBundle();
      // Off (default): use the efficient photoRef/assets/ split among
      // folder-access peers. On: keep every photo inline so any device,
      // folder access or not, can always import this bundle completely —
      // see docs/plans/backup-sync.md Phase 7's "iPhone manual sync
      // support" toggle.
      if (!isIphoneSyncSupportEnabled()) {
        await applyReferencedPhotoStorage(ownBundle, handle);
      } else {
        logSyncEvent('debug', 'sync: publishing with inline photo storage (iPhone sync support is on)');
      }
      await writeOwnBackupFile(handle, deviceId, serializeBackupBundle(ownBundle));
      publishedSeq = seqAtSnapshot;
      logSyncEvent('debug', 'sync: published own bundle');
    } catch (err) {
      logSyncEvent('warn', 'sync failed: could not write own bundle —', err && err.message);
      logDiagnostic('error', '[sync] could not write own bundle —', err && err.message);
    }
    logSyncEvent('debug', 'sync cycle ended —', trigger);
  });
}

// ---- test-only exports ----
export function markDirtyForTests() { writeSeq++; }
export function isDirtyForTests() { return isDirty(); }
