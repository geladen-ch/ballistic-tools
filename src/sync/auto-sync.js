// Sync cycle orchestration — see docs/plans/backup-sync.md Phase 5.
// Manual is the default on every platform; automatic mode (Chromium-only)
// is an explicit opt-in that registers a periodic timer plus a
// tab-focus/visibilitychange trigger.
import {
  isFileSystemAccessSupported, getPersistedFolderHandle, verifyPermission, removeBackupFile,
  listBackupFiles, readFile, writeOwnBackupFile, readAssetFile
} from './fs-folder.js';
import { buildBackupBundle, serializeBackupBundle, parseBackupBundle, backupFileName } from './backup-bundle.js';
import { getDeviceId } from './device-id.js';
import { selectLatestPerDevice } from './duplicate-bundles.js';
import {
  recordPeerDevice, getPeerExportedAt, recordPeerExportedAtSeen,
  mergeDeviceTombstones, classifyDeletedPeerBundle
} from './device-registry.js';
import { mergeRecords, detectFutureExport, detectBackwardExport } from './merge.js';
import { addPendingReview, clearPendingReview, expireStaleReviewsForPeer } from './pending-review.js';
import { onLibraryWrite } from './write-hooks.js';
import { logSyncEvent, setSyncLogCycle, flushSyncLog } from './sync-log.js';
import { runAssetCleanup, shouldRunAssetCleanupNow, recordAssetCleanupRun } from './asset-cleanup.js';
import { logDiagnostic } from '../debug-log.js';
import { SYNCED_LIBRARIES } from './synced-libraries.js';
import {
  recordSyncCompleted, recordPendingPhotoDevices, recordClockSkewedDevices, recordOwnPublished, recordFileDevices
} from './last-sync-status.js';
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

// For state that is published but is not a library record — a device
// tombstone, today — so changing it counts as something to publish. The
// library writes reach this through onLibraryWrite() above; this is the same
// counter for everything else.
export function markSyncDirty() {
  writeSeq++;
}

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
  // Tags every line this cycle produces with one id, so a month of them
  // can still be read one cycle at a time. Overlapping calls can't confuse
  // the tag: withSyncLock rejects a second cycle outright rather than
  // queueing it. The trailing finally() also flushes — the end of a cycle
  // is a natural checkpoint, and a crash just after one should not cost
  // the record of what it did.
  setSyncLogCycle(`c${Date.now().toString(36)}`);
  return withSyncLock(async () => {
    logSyncEvent('info', 'sync cycle starting —', trigger);
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

    // Every backup file is opened and judged by what is inside it — this
    // device's own included. Neither which device a file belongs to nor
    // which copy is newest is read off a file name: a browser's save
    // dialog lets the user call the file anything, and a cloud client
    // renames on conflict.
    const readBundles = [];
    for (const fileName of fileNames) {
      try {
        const text = await readFile(handle, fileName);
        readBundles.push({ fileName, bundle: parseBackupBundle(text) });
      } catch (err) {
        // A parse failure here is routine and expected — a cloud sync
        // client can briefly present a partially-downloaded or mid-write
        // file. Skip it and let the next cycle retry.
        logSyncEvent('debug', 'sync: skipping unreadable file', fileName, '—', (err && err.code) || 'unknown error');
      }
    }

    // Every tombstone in every file is taken in before any bundle is judged,
    // so a deletion is applied to the deleted device's file even when that
    // file happens to be read before the file carrying the tombstone. A
    // tombstone that is new here also makes this device publish, so it is
    // passed on rather than known only until this device next has other news.
    for (const { bundle } of readBundles) {
      if (mergeDeviceTombstones(bundle.devicesDeleted) > 0) anyChange = true;
    }

    // One bundle per device: a browser that cannot write into the folder
    // (Firefox) saves its manual export under a new name beside the old
    // one, and a cloud client can leave a "conflicted copy". Only the
    // newest by its own `exportedAt` counts; the older copies are
    // redundant and are removed, so they neither show up as extra devices
    // nor get re-read every cycle. Only files that parsed take part, so a
    // half-downloaded file is never mistaken for a duplicate. This device
    // is judged like any other: of the files carrying its own id, the
    // newest stays and the rest go. What it stays is never merged, since
    // this device's own state is authoritative and never comes back in
    // through a file.
    const { latest: latestPerDevice, superseded } = selectLatestPerDevice(readBundles);
    const removedFiles = new Set();
    for (const older of superseded) {
      const label = older.bundle.device.name || older.bundle.device.id;
      try {
        await removeBackupFile(handle, older.fileName);
        removedFiles.add(older.fileName);
        logSyncEvent('warn', 'sync: removed', older.fileName, `(exported ${older.bundle.exportedAt}) — superseded by`,
          older.supersededBy, 'from the same device,', label);
      } catch (err) {
        logSyncEvent('warn', 'sync: could not remove superseded', older.fileName, '— ignoring it; the newer', older.supersededBy,
          'is used instead —', err && err.message);
      }
    }
    const latest = latestPerDevice.filter(({ bundle }) => bundle.device.id !== deviceId);

    // Remembered for the Devices list, which cannot open files each time it
    // repaints: what each file still in the folder holds.
    recordFileDevices(Object.fromEntries(
      readBundles
        .filter(({ fileName }) => !removedFiles.has(fileName))
        .map(({ fileName, bundle }) => [fileName, {
          id: bundle.device.id, name: bundle.device.name || null, exportedAt: bundle.exportedAt || null
        }])
    ));

    for (const { fileName, bundle } of latest) {
      // A bundle from a device this mesh has deleted is one of two things,
      // and the export times tell them apart: later than what the deletion
      // discarded means the machine is genuinely back and is merged like any
      // other; at or before it means this is the file that was already
      // discarded, still in the folder — because a browser that cannot
      // remove files did the deleting, or because some peer's cloud client
      // held a copy. It is skipped, and removed where this device can. (The
      // tombstone itself is dropped later, when the returning device's
      // export is recorded below.)
      if (classifyDeletedPeerBundle(bundle.device.id, bundle.exportedAt) === 'stale') {
        logSyncEvent('info', 'sync: ignoring a bundle of a deleted device —', fileName);
        try {
          await removeBackupFile(handle, fileName);
          removedFiles.add(fileName);
          logSyncEvent('warn', 'sync: removed', fileName, '— a file of a device that was deleted');
        } catch (err) {
          logSyncEvent('warn', 'sync: could not remove', fileName, '— a file of a deleted device; it is ignored —', err && err.message);
        }
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

    // Reclaim unused photo assets (docs/plans/orphaned-storage-cleanup.md
    // phase 5). Placed *before* the "nothing changed" early return below
    // rather than after the publish: that return fires on exactly the
    // cycles that dominate — a device where nothing changed — which is
    // also precisely when orphans are sitting around, so a hook after the
    // publish would almost never run. Safe here because the referenced set
    // includes every photo this device holds locally, including ones this
    // cycle is about to publish. Its own try/catch, so a cleanup failure
    // can never change the outcome of the sync cycle itself.
    if (shouldRunAssetCleanupNow()) {
      try {
        recordAssetCleanupRun(await runAssetCleanup(handle));
      } catch (err) {
        logSyncEvent('warn', 'asset cleanup threw —', err && err.message);
      }
    }

    // This device's own file never existing in the folder yet is not "no
    // change to publish" — it's the very first sync into this folder, and
    // skipping it would leave the device permanently invisible to every
    // peer no matter how many times "Sync Now" is pressed: `dirty`/`anyChange`
    // both stay false on a freshly loaded page with nothing edited this
    // session and nothing to merge in, so without this check the cycle
    // updates "last synced" (a real read did happen) and then quietly
    // never writes a bundle at all. `fileNames` is already the folder
    // listing this cycle just took, so this costs nothing extra to check.
    // The one place a name is used: the file this device *writes*, whose
    // name is its own to choose. (Checking it holds this device's data is
    // done above, by id; this only asks whether there is anything at all
    // where the next publish will go.)
    const ownFileExists = fileNames.includes(ownFileName) && !removedFiles.has(ownFileName);
    if (!isDirty() && !anyChange && ownFileExists) {
      logSyncEvent('debug', 'sync: nothing changed, not publishing a new bundle');
      logSyncEvent('info', 'sync cycle ended —', trigger);
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
      recordOwnPublished(ownBundle.exportedAt);
      logSyncEvent('debug', 'sync: published own bundle');
    } catch (err) {
      logSyncEvent('warn', 'sync failed: could not write own bundle —', err && err.message);
      logDiagnostic('error', '[sync] could not write own bundle —', err && err.message);
    }
    logSyncEvent('info', 'sync cycle ended —', trigger);
  }).finally(() => {
    setSyncLogCycle(null);
    flushSyncLog();
  });
}

// ---- test-only exports ----
export function markDirtyForTests() { writeSeq++; }
export function isDirtyForTests() { return isDirty(); }
