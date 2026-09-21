// Phase 8a/8b — platforms with no persisted folder handle at all reuse the
// exact same device-id/bundle/merge machinery as the Chromium folder-based
// flow (auto-sync.js). The two tiers differ only in I/O glue, per
// docs/plans/backup-sync.md Phase 8:
//
// - 8a (desktop non-Chromium: Firefox anywhere, Safari on macOS) can pick
//   a whole folder in one gesture (`<input type="file" webkitdirectory>`),
//   which — unlike a plain multi-file picker — also hands back any
//   assets/ subfolder files. That means a peer's referenced-mode bundle
//   (Phase 7) *is* resolvable here, not just best-effort-null, purely from
//   what the browser handed back for the selected folder — no persisted
//   handle and no File System Access API involved at all. Export is still
//   a plain download; there's no way to write files back into a picked
//   folder from a file input.
// - 8b (iOS/iPadOS) has no working directory selection in practice, so it
//   stays a plain multi-file JSON picker (photos always degrade to null
//   there) and exports via the share sheet (`navigator.share`) so "Save
//   to Files" can reach the synced folder, falling back to a plain
//   download if sharing files isn't supported.
//
// Both present this as one combined "Sync" action — import whatever's
// picked, then immediately re-publish this device's own updated state —
// deliberately not two separately-triggered buttons (see Phase 8a/8b's
// own "no persisted handle, no silent re-scan"), so a user can't pull in
// changes and forget to push their own back out.
import { SYNCED_LIBRARIES } from './synced-libraries.js';
import { buildBackupBundle, serializeBackupBundle, parseBackupBundle, backupFileName } from './backup-bundle.js';
import {
  recordPeerDevice, getPeerExportedAt, recordPeerExportedAtSeen, mergeDeviceTombstones, classifyDeletedPeerBundle
} from './device-registry.js';
import { mergeRecords, detectFutureExport, detectBackwardExport } from './merge.js';
import { addPendingReview, clearPendingReview, expireStaleReviewsForPeer } from './pending-review.js';
import { logSyncEvent } from './sync-log.js';
import { logDiagnostic } from '../debug-log.js';
import { recordSyncCompleted, recordClockSkewedDevices } from './last-sync-status.js';
import { resolveBundlePhotoRefs } from './photo-assets.js';
import { downloadFile } from '../download.js';
import { getDeviceId } from './device-id.js';
import { selectLatestPerDevice } from './duplicate-bundles.js';

const BACKUP_FILE_PATTERN = /^backup-.+\.json$/;

// iOS/iPadOS has neither the File System Access API nor working
// `<input type="file" webkitdirectory>` folder selection in practice, so
// it gets the share-sheet tier (8b) instead of the directory-picker tier
// (8a) — confirmed at implementation time, not merely assumed, per
// docs/plans/backup-sync.md's own note that this needed verifying.
// iPadOS 13+ reports as a Mac in its own User-Agent string, so touch
// support is the actual tell — a real Mac reports 0 touch points.
export function isIOS() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
}

export function isShareSupported() {
  return typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function';
}

function totalsShape() {
  return { imported: 0, overwritten: 0, tombstoned: 0, skippedOlder: 0, skippedReview: 0, noop: 0, skippedInvalid: 0 };
}

// Builds and downloads this device's own bundle — the plain-download half
// of the combined "Sync" action, and 8a's only export mechanism (no share
// sheet there — a native "Save As" dialog already reaches any folder
// directly). Named exactly like the file a Chromium device would write
// into a shared folder, so a user who drags it into that same folder
// manually produces something every other device's own merge already
// knows how to read.
export function downloadOwnBundle() {
  const bundle = buildBackupBundle();
  downloadFile(backupFileName(bundle.device.id), serializeBackupBundle(bundle), 'application/json');
  return bundle;
}

// The combined "Sync" action's export half, routed by tier: 8b (iOS) goes
// through the share sheet so "Save to Files" can reach the synced folder,
// while 8a (desktop Firefox/Safari) takes the plain download, whose native
// "Save As" dialog already reaches any folder directly.
//
// The routing is explicit rather than falling out of feature detection,
// because feature detection gets 8a wrong: Safari on macOS implements
// navigator.share/canShare, so a capability check alone would quietly put
// desktop Safari on the share sheet — a worse path than the Save As dialog
// it already has, and not what Phase 8a describes.
export async function exportOwnBundle() {
  return isIOS() ? shareOrDownloadOwnBundle() : downloadOwnBundle();
}

// 8b's export mechanism: tries the share sheet first, so "Save to Files"
// can reach the synced folder directly, falling back to a plain download
// wherever sharing files isn't supported. Always inline (Phase 7) —
// neither 8a nor 8b can write an assets/ file anywhere a peer could reach
// it, so a referenced bundle here would just ship unresolvable photoRefs;
// buildBackupBundle() already defaults to inline on its own.
export async function shareOrDownloadOwnBundle() {
  const bundle = buildBackupBundle();
  const filename = backupFileName(bundle.device.id);
  const text = serializeBackupBundle(bundle);

  if (isShareSupported()) {
    try {
      const file = new File([text], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        logSyncEvent('debug', 'manual sync: exported via the share sheet');
        return bundle;
      }
    } catch (err) {
      // The user dismissing the share sheet (AbortError) is a routine,
      // deliberate "never mind" — not a failure to fall back from. Any
      // other error, or canShare() itself saying no, falls through to the
      // plain download below instead.
      if (err && err.name === 'AbortError') {
        logSyncEvent('debug', 'manual sync: share sheet dismissed by the user');
        return bundle;
      }
      logSyncEvent('warn', 'manual sync: share failed, falling back to download —', err && err.message);
      logDiagnostic('warn', '[sync] manual sync share failed, falling back to download —', err && err.message);
    }
  }
  downloadFile(filename, text, 'application/json');
  logSyncEvent('debug', 'manual sync: exported via plain download');
  return bundle;
}

// Merges one already-parsed peer bundle into local libraries — the shared
// core both importPeerBundleText() (a single hand-picked file) and
// importPickedFiles() (a Phase 8a/8b batch) build on.
async function mergeOneBundle(bundle, { readAsset, clockSkewedDevices = [] }) {
  const peerLabel = bundle.device.name || bundle.device.id;
  // See merge.js's own comment and auto-sync.js's identical call — checked
  // against the peer's own history, not this device's clock, so a peer
  // that simply hasn't manually synced in a while (routine here) isn't
  // indistinguishable from one whose clock is actually wrong.
  const previousExportedAt = getPeerExportedAt(bundle.device.id);
  const futureMs = detectFutureExport(bundle.exportedAt);
  const backwardMs = detectBackwardExport(bundle.exportedAt, previousExportedAt);
  recordPeerExportedAtSeen(bundle.device.id, bundle.exportedAt);
  if (futureMs !== null || backwardMs !== null) {
    const detail = futureMs !== null ? `future by ${futureMs}ms` : `jumped backward by ${backwardMs}ms`;
    logSyncEvent('debug', 'manual sync: clock anomaly detected for', peerLabel, `(${detail})`);
    logDiagnostic('warn', '[sync] clock anomaly detected for', peerLabel, `(${detail})`);
    clockSkewedDevices.push(peerLabel);
  }
  recordPeerDevice(bundle.device);
  // Best-effort, not a crash, regardless of whether `readAsset` can
  // resolve anything — every manual-sync flow is one-shot, with no next
  // cycle to retry an unresolved photo on (see photo-assets.js's own
  // comment on the two failure postures this distinguishes).
  await resolveBundlePhotoRefs(bundle, { readAsset, onUnresolvable: 'null' });

  const totals = totalsShape();
  for (const lib of SYNCED_LIBRARIES) {
    const remoteList = lib.remoteList(bundle);
    const { counts, reviewItems, resolvedIds } = mergeRecords(lib.loadLocalWithTombstones(), remoteList, {
      importRaw: lib.write,
      tombstone: lib.write,
      recordType: lib.recordType,
      peerLabel
    });
    for (const key of Object.keys(totals)) totals[key] += counts[key];
    // See auto-sync.js's identical call — a definite merge answer retires
    // any conflict still outstanding against that record (Phase 4).
    for (const id of resolvedIds) clearPendingReview(lib.recordType, id);
    // See pending-review.js's own comment — a conflict attributed to this
    // peer whose id it no longer even mentions has nothing left to review.
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
    logSyncEvent('debug', 'manual sync: merged', lib.recordType, 'from', peerLabel, JSON.stringify(counts));
  }
  return totals;
}

// Merges one peer bundle's text (from a single picked file) into local
// libraries. Unlike Phase 5's "routine, skip and retry next cycle"
// posture for an unparseable file, a deliberately user-picked file that
// fails to parse has no next cycle to fall back on — this throws the
// same typed parseBackupBundle error, and the caller (the Settings UI) is
// expected to show it as an actual error.
export async function importPeerBundleText(text) {
  const bundle = parseBackupBundle(text);
  const clockSkewedDevices = [];
  const totals = await mergeOneBundle(bundle, { readAsset: null, clockSkewedDevices });
  recordSyncCompleted([bundle.device.name || bundle.device.id]);
  recordClockSkewedDevices(clockSkewedDevices);
  return { device: bundle.device, totals };
}

function relativePathOf(file) {
  return file.webkitRelativePath || file.name;
}

// True once at least one file in the picked set carries a
// `webkitRelativePath` — the tell that this came from a whole-folder
// selection (`<input type="file" webkitdirectory>`, Phase 8a) rather than
// a plain multi-file picker (Phase 8b), regardless of which platform
// actually did the picking. Only a folder selection can also include an
// assets/ subfolder.
function isDirectorySelection(files) {
  return files.some((f) => f.webkitRelativePath);
}

// A readAsset(filename) function backed by whatever assets/ subfolder
// files happen to be present in a picked file list.
function makeFileListAssetReader(files) {
  const byName = new Map();
  for (const file of files) {
    const parts = relativePathOf(file).split('/');
    if (parts.length >= 2 && parts[parts.length - 2] === 'assets') {
      byName.set(parts[parts.length - 1], file);
    }
  }
  return async (filename) => byName.get(filename) || null;
}

// Imports every backup-*.json found among `files` (a FileList or plain
// array of File objects) in one batch — the combined "Sync" action's
// import half on both 8a and 8b. A single bad file is skipped and logged
// rather than aborting the whole batch — the user picked a whole set at
// once, and one mistake shouldn't cost the rest.
export async function importPickedFiles(files) {
  const fileArray = [...files];
  // This device's own bundle has to be left out (8a's whole-folder
  // `webkitdirectory` selection hands back *everything* in the synced
  // folder, which necessarily includes the one this device published there
  // last time; merging a device's own stale snapshot back into itself
  // resolves nothing it doesn't already know, lists the device under its
  // own "Synced with", and spends a full pass re-deciding against its own
  // past) — but that is settled below by the id inside each file, not by
  // what the file is called.
  const backupFiles = fileArray.filter((f) => BACKUP_FILE_PATTERN.test(relativePathOf(f).split('/').pop()));
  const directorySelection = isDirectorySelection(fileArray);
  const readAsset = directorySelection ? makeFileListAssetReader(fileArray) : null;
  logSyncEvent('debug', 'manual sync: picked', fileArray.length, 'file(s) via',
    directorySelection ? 'webkitdirectory folder selection' : 'plain multi-file selection',
    `(${backupFiles.length} backup file(s))`);

  const totals = totalsShape();
  const devices = [];
  const clockSkewedDevices = [];
  const parsed = [];
  for (const file of backupFiles) {
    let bundle;
    try {
      bundle = parseBackupBundle(await file.text());
    } catch (err) {
      logSyncEvent('debug', 'manual sync: skipping unreadable file', file.name, '—', (err && err.code) || 'unknown error');
      continue;
    }
    // The bundle's own device block is what says it is ours, whatever the
    // file was called or renamed to.
    if (bundle.device.id === getDeviceId()) {
      logSyncEvent('debug', 'manual sync: skipping this device\'s own bundle', file.name);
      continue;
    }
    parsed.push({ fileName: file.name, bundle });
  }

  // Every tombstone in the batch is taken in before any bundle is judged, so
  // a deletion made on another device applies to that device's file even
  // when it is picked before the file carrying the tombstone. This is the
  // path a browser that cannot write into the folder takes, and it is the
  // one that could not remove a deleted device's file — so ignoring it here
  // is what makes the deletion hold at all.
  for (const { bundle } of parsed) mergeDeviceTombstones(bundle.devicesDeleted);

  // Several files for one device (a browser's "backup-<id> (1).json") count
  // once, by the newest export. Nothing is deleted here — a picked file is
  // a read-only handle — the older ones are just left unused.
  const { latest, superseded } = selectLatestPerDevice(parsed);
  for (const older of superseded) {
    logSyncEvent('warn', 'manual sync: ignoring', older.fileName, `(exported ${older.bundle.exportedAt}) — superseded by`,
      older.supersededBy, 'from the same device');
  }

  for (const { fileName, bundle } of latest) {
    // A file of a device that was deleted, at or before what the deletion
    // discarded — see auto-sync.js for both halves of this rule. Skipped
    // entirely: not merged, the device not recorded. (Nothing can be
    // removed here; the file is just left alone.)
    if (classifyDeletedPeerBundle(bundle.device.id, bundle.exportedAt) === 'stale') {
      logSyncEvent('info', 'manual sync: ignoring', fileName, '— a file of a device that was deleted');
      continue;
    }
    const fileTotals = await mergeOneBundle(bundle, { readAsset, clockSkewedDevices });
    for (const key of Object.keys(totals)) totals[key] += fileTotals[key];
    devices.push(bundle.device.name || bundle.device.id);
  }
  if (devices.length > 0) recordSyncCompleted(devices);
  recordClockSkewedDevices(clockSkewedDevices);
  return { devices, totals };
}

// The combined "Sync" action itself (Phase 8a/8b): import whatever was
// picked, then immediately re-publish this device's own updated bundle.
// Runs the export step even when nothing was imported — same "publish
// unconditionally on an explicit manual action" posture Phase 5 documents
// for the Chromium "Sync Now" button, as opposed to an automatic cycle's
// dirty-flag gating.
export async function syncViaPickedFiles(files) {
  const importResult = await importPickedFiles(files);
  const bundle = await exportOwnBundle();
  return { ...importResult, ownDevice: bundle.device };
}
