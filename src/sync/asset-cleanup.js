// Reclaims `assets/<ref>.jpg` files in the sync folder that nothing
// references any more — see docs/plans/orphaned-storage-cleanup.md phase
// 5. Every photo edit and every record deletion leaves the previous
// content-addressed file behind, and until this existed nothing in the app
// ever called removeEntry(), so a folder only ever grew.
//
// Three properties shape the whole module:
//
//  1. **It opens no asset file.** Candidates are decided from the
//     directory listing, the referenced set and asset-state.js, never from
//     a file's own metadata — see that module's header for why a probe on
//     an on-demand placeholder is not something this app can rely on.
//  2. **Over-collecting references is safe; under-collecting is not.**
//     One missed reference deletes a photo somebody is using. So refs are
//     gathered by a generic deep scan rather than by walking the known
//     bundle shape, which would silently miss a record type added later.
//  3. **An asset is derived data.** Its real home is the `photo` field of
//     a record in some device's IndexedDB, so a file deleted wrongly comes
//     back on the next publish from any device still holding that record.
//     That is what makes an automatic, unprompted deletion defensible at
//     all — and why the one unrecoverable case (a wiped device whose
//     bundle is the only remaining copy) is what the hard stops below
//     exist to protect.
import { listAssetFiles, removeAsset, listBackupFiles, readFile } from './fs-folder.js';
import { parseBackupBundle, backupFileName } from './backup-bundle.js';
import { photoRefFor } from './photo-assets.js';
import { SYNCED_LIBRARIES } from './synced-libraries.js';
import { getDeviceId } from './device-id.js';
import {
  recordAssetsSeen, getFirstSeenAt, pruneAssetState, getAssetState, listAssetState
} from './asset-state.js';
import { logSyncEvent } from './sync-log.js';
import { logDiagnostic } from '../debug-log.js';

// Only ever a file this app wrote: `<photoRef>.jpg` with a full SHA-256
// hex ref. Anything else in assets/ is somebody else's and is counted but
// never touched.
const ASSET_NAME_PATTERN = /^sha256-[0-9a-f]{64}\.jpg$/;

// How long an unreferenced asset must have been sitting in the listing
// before it can be removed. Protects an asset written just ahead of the
// bundle that will reference it, and one whose bundle is still in flight
// through the cloud client.
export const GRACE_MS = 30 * 24 * 60 * 60 * 1000;

// Throttle and last-run status. Both live in localStorage beside the other
// sync prefs: one tiny record, read synchronously while rendering the
// settings line, exactly the class of storage device-registry.js uses.
const LAST_RUN_KEY = 'ballistics_asset_cleanup_last_run_v1';
const THROTTLE_MS = 24 * 60 * 60 * 1000;

export function getAssetCleanupStatus() {
  try {
    const raw = localStorage.getItem(LAST_RUN_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// The timestamp advances in two of the three outcomes. A hard stop
// advances it because a failed invariant means a bug, which will not
// resolve on its own — re-scanning every five minutes and on every tab
// focus would repeat a full listing, bundle read and local-photo hash
// forever and change nothing, and keeping the condition recorded is the
// log's job. A parse failure is the one genuinely transient outcome
// (usually a cloud client mid-download) and is cheap to retry.
export function recordAssetCleanupRun(report) {
  if (report.outcome === 'parse-failure' || report.outcome === 'aborted') return;
  try {
    localStorage.setItem(LAST_RUN_KEY, JSON.stringify({
      at: new Date().toISOString(),
      outcome: report.outcome,
      removedCount: report.removed.length,
      removedBytes: report.removedBytes,
      bytesKnown: report.bytesKnown,
      failedCheck: report.failedCheck,
      affectedDevices: report.affectedDevices
    }));
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}

// Suppression for the one user-facing warning this feature produces.
// Keyed by (deviceId, exportedAt), which is exactly "something changed"
// for that warning and falls out of the remedy it prints: opening the app
// on that machine and syncing is what makes it publish a bundle with a new
// exportedAt. So a changed exportedAt *is* the user having done what was
// asked, or the machine coming back on its own. A machine that is gone for
// good never republishes, so its warning stays collapsed indefinitely with
// nobody having to declare it dead. Same shape pending-review.js already
// uses to suppress a conflict against one specific peer version.
const SUPPRESSION_KEY = 'ballistics_asset_warning_suppression_v1';

function readSuppressions() {
  try {
    const raw = localStorage.getItem(SUPPRESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeSuppressions(map) {
  try {
    localStorage.setItem(SUPPRESSION_KEY, JSON.stringify(map));
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}

// `condition` is stored for diagnostics but is deliberately not part of the
// key: both conditions that raise this warning print identical text, so
// re-raising when one replaces the other would show the user a message they
// have already collapsed.
export function suppressAssetWarning(deviceId, exportedAt, condition) {
  const map = readSuppressions();
  map[deviceId] = { exportedAt: exportedAt || null, condition: condition || null, suppressedAt: new Date().toISOString() };
  writeSuppressions(map);
}

export function isAssetWarningSuppressed(deviceId, exportedAt) {
  const entry = readSuppressions()[deviceId];
  if (!entry) return false;
  // Any change counts, forward or backward: a peer with a skewed clock can
  // move exportedAt backward, and deciding which direction is legitimate is
  // both harder and less safe than treating any change as "something
  // happened".
  return (entry.exportedAt || null) === (exportedAt || null);
}

export function getAssetWarningSuppression(deviceId) {
  return readSuppressions()[deviceId] || null;
}

// Dropped when that peer's bundle leaves the folder, or when the device is
// deleted outright (phase 6).
export function clearAssetWarningSuppression(deviceId) {
  const map = readSuppressions();
  if (!(deviceId in map)) return;
  delete map[deviceId];
  writeSuppressions(map);
}

export function shouldRunAssetCleanupNow() {
  const status = getAssetCleanupStatus();
  if (!status || !status.at) return true;
  const last = Date.parse(status.at);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= THROTTLE_MS;
}

function refOf(filename) {
  return filename.slice(0, filename.lastIndexOf('.'));
}

// Generic, not schema-driven, and deliberately so. A structured walk over
// bundle.locations.locations and bundle.riflePrecision.projects[].targets[]
// would go stale the moment a record type with photos is added and one
// loop is forgotten — and its failure mode is silent under-collection,
// which deletes live photos. A deep scan for the key errs the other way.
function collectRefsDeep(value, out = new Set()) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const item of value) collectRefsDeep(item, out);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'photoRef' && typeof child === 'string') out.add(child);
    else collectRefsDeep(child, out);
  }
  return out;
}

// The shape-aware walk, kept only as a cross-check against the generic one
// above. Any divergence means one of the two is wrong — but the union is
// used either way, so the run stays safe while the discrepancy is logged.
function collectRefsStructured(bundle, out = new Set()) {
  const add = (holder) => { if (holder && typeof holder.photoRef === 'string') out.add(holder.photoRef); };
  for (const location of (bundle.locations && bundle.locations.locations) || []) add(location);
  for (const project of (bundle.riflePrecision && bundle.riflePrecision.projects) || []) {
    for (const target of project.targets || []) add(target);
  }
  return out;
}

// A holder that carries `photoMime` but no `photoRef` is the precise
// signature of a reference that went missing between being written and
// being read: the two fields are written together by refFor(), and only
// ever together, so one without the other means the ref was stripped,
// renamed or lost by whatever produced or parsed this bundle.
//
// This replaces a cruder "a referenced-mode bundle that yields zero refs"
// check, which was wrong: applyReferencedPhotoStorage() sets
// photoStorage: 'referenced' unconditionally, so a peer that simply owns
// no photos publishes exactly that shape, and a folder whose assets all
// belong to other peers would have hard-stopped on a completely healthy
// device. Pairing the two fields gives the same protection with no false
// positive.
function findStrippedRefHolders(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const item of value) findStrippedRefHolders(item, out);
    return out;
  }
  if (typeof value.photoMime === 'string' && typeof value.photoRef !== 'string') out.push(value.id || '(unnamed)');
  for (const child of Object.values(value)) findStrippedRefHolders(child, out);
  return out;
}

// Source (b): every photo this device holds locally, hashed the same way
// refFor() hashes one before writing it. Scanned generically for the same
// reason the bundle scan is — and it covers a photo edited locally but not
// yet published, which no bundle in the folder mentions yet.
function collectLocalPhotoDataUrls(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const item of value) collectLocalPhotoDataUrls(item, out);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'photo' && typeof child === 'string' && child.startsWith('data:')) out.push(child);
    else collectLocalPhotoDataUrls(child, out);
  }
  return out;
}

async function collectLocalRefs() {
  const dataUrls = [];
  for (const lib of SYNCED_LIBRARIES) {
    for (const record of lib.loadLocalWithTombstones()) {
      if (record.deletedAt) continue; // a tombstone carries no photo
      collectLocalPhotoDataUrls(record, dataUrls);
    }
  }
  const refs = new Set();
  for (const dataUrl of dataUrls) {
    try {
      refs.add(await photoRefFor(dataUrl));
    } catch {
      // a malformed data-URL can't name an asset file either — skipping it
      // only ever means one fewer thing protected, and toStorable() would
      // have dropped it long before this
    }
  }
  return refs;
}

// Reads and parses every backup-*.json in the folder — its own included,
// since peers may still be reading what this device last published and a
// photo it has since deleted locally is still referenced by that file.
//
// This deliberately does NOT reuse the bundles a sync cycle already
// parsed. resolveOne() deletes `photoRef` from a holder as it resolves it,
// and the cycle calls resolveBundlePhotoRefs() immediately after parsing
// each file, so by the time a cycle is done its in-memory bundles have had
// exactly the fields this pass depends on stripped out. Reusing them would
// produce an empty reference set and mark every asset a candidate.
async function readAllBundles(dirHandle) {
  const fileNames = await listBackupFiles(dirHandle);
  const bundles = [];
  const unreadable = [];
  for (const fileName of fileNames) {
    try {
      bundles.push({ fileName, bundle: parseBackupBundle(await readFile(dirHandle, fileName)) });
    } catch (err) {
      unreadable.push({ fileName, error: (err && err.code) || 'unknown' });
    }
  }
  return { bundles, unreadable, fileNames };
}

/**
 * One cleanup pass. Never throws: every outcome is reported in the return
 * value, so a caller inside a sync cycle can ignore it entirely and a
 * caller in the UI can describe it.
 *
 * `outcome` is one of:
 *   'completed'     — ran, possibly removing nothing
 *   'no-assets'     — the folder has no assets/ directory
 *   'parse-failure' — a backup file could not be read; transient, retry
 *   'hard-stop'     — a consistency check failed; a suspected bug
 *   'aborted'       — a bundle changed mid-pass; retry next time
 *   'error'         — something unexpected
 */
export async function runAssetCleanup(dirHandle) {
  const report = {
    outcome: 'completed',
    removed: [], removedBytes: 0, bytesKnown: true,
    candidates: 0, totalAssets: 0,
    failedCheck: null, detail: null,
    referencedMissing: [], malformed: [], unresolvedMarks: [],
    duplicateDeviceIds: [], divergentRefs: [], affectedDevices: []
  };

  try {
    // Scan order is load-bearing: list the assets FIRST, then read the
    // bundles. Candidates are assets_at_T1 minus refs_from_bundles_at_T2
    // with T2 > T1, so a peer publishing during the window can only *add*
    // references to our view (we keep more), while any asset it writes is
    // absent from our listing (we never consider it). Reversing the order
    // inverts both properties.
    const assetNames = await listAssetFiles(dirHandle);
    report.totalAssets = assetNames.length;
    if (assetNames.length === 0) {
      report.outcome = 'no-assets';
      return report;
    }

    const wellNamed = assetNames.filter((name) => ASSET_NAME_PATTERN.test(name));
    report.malformed = assetNames.filter((name) => !ASSET_NAME_PATTERN.test(name));
    const presentRefs = wellNamed.map(refOf);
    // Starts the age clock for anything seen here for the first time, so a
    // ref first observed on this pass can never be deleted on this pass.
    await recordAssetsSeen(presentRefs);

    const { bundles, unreadable } = await readAllBundles(dirHandle);
    if (unreadable.length > 0) {
      report.outcome = 'parse-failure';
      report.detail = unreadable;
      logSyncEvent('warn', 'asset cleanup: skipped, could not read',
        unreadable.map((u) => u.fileName).join(', '));
      return report;
    }

    const referenced = new Set();
    const seenDeviceIds = new Map();
    for (const { fileName, bundle } of bundles) {
      const deep = collectRefsDeep(bundle);
      const structured = collectRefsStructured(bundle);
      for (const ref of deep) referenced.add(ref);
      for (const ref of structured) {
        if (!deep.has(ref)) report.divergentRefs.push({ fileName, ref, missingFrom: 'deep' });
        referenced.add(ref);
      }
      for (const ref of deep) if (!structured.has(ref)) report.divergentRefs.push({ fileName, ref, missingFrom: 'structured' });

      const deviceId = bundle.device && bundle.device.id;
      if (deviceId) {
        if (seenDeviceIds.has(deviceId)) report.duplicateDeviceIds.push(deviceId);
        seenDeviceIds.set(deviceId, fileName);
      }

      // Check 3, per bundle so it surfaces for one peer rather than only
      // once it breaks for all of them: a record that kept its photoMime
      // but lost its photoRef. Those two are written together and only
      // together, so one without the other means a reference this pass
      // needs has gone missing — and acting on a reference set with a
      // known hole in it is how this feature would delete a photo somebody
      // is still using.
      const stripped = findStrippedRefHolders(bundle);
      if (stripped.length > 0) {
        report.outcome = 'hard-stop';
        report.failedCheck = 'bundle-lists-no-photos';
        report.detail = { fileName, records: stripped, deviceId: deviceId || null, deviceName: (bundle.device && bundle.device.name) || null };
        report.affectedDevices = [{
          id: deviceId || null,
          name: (bundle.device && bundle.device.name) || null,
          exportedAt: bundle.exportedAt || null
        }];
        logSyncEvent('error', 'asset cleanup: hard stop — bundle', fileName, 'has', stripped.length, 'record(s) whose photo reference is missing');
        logDiagnostic('error', '[sync] asset cleanup hard stop: photo reference missing in —', fileName);
        return report;
      }
    }

    const localRefs = await collectLocalRefs();
    for (const ref of localRefs) referenced.add(ref);

    // Check 2: the referenced set must contain every hash this device's own
    // photos produce, because source (b) puts them there by construction. A
    // violation cannot be caused by anything outside this code.
    for (const ref of localRefs) {
      if (!referenced.has(ref)) {
        report.outcome = 'hard-stop';
        report.failedCheck = 'local-hash-invariant';
        report.detail = { expectedAtLeast: localRefs.size, found: referenced.size };
        logSyncEvent('error', 'asset cleanup: hard stop — local photo hashes missing from the referenced set');
        logDiagnostic('error', '[sync] asset cleanup hard stop: local-hash invariant violated');
        return report;
      }
    }

    const now = Date.now();
    const candidates = [];
    const tooYoung = [];
    const referencedPresent = [];
    for (const name of wellNamed) {
      const ref = refOf(name);
      if (referenced.has(ref)) { referencedPresent.push(name); continue; }
      const firstSeenAt = getFirstSeenAt(ref);
      if (!firstSeenAt || now - Date.parse(firstSeenAt) < GRACE_MS) { tooYoung.push(name); continue; }
      candidates.push(name);
    }
    report.candidates = candidates.length;

    // Check 4: every file must be attributed to exactly one bucket. A
    // mismatch means the attribution has a hole. One plausible benign
    // cause is a cloud client adding or removing files while the pass runs
    // — the listing is only a snapshot — so this is reported as a soft,
    // retryable outcome rather than a suspected bug on first occurrence.
    const attributed = referencedPresent.length + candidates.length + tooYoung.length + report.malformed.length;
    if (attributed !== assetNames.length) {
      report.outcome = 'hard-stop';
      report.failedCheck = 'attribution';
      report.detail = { attributed, listed: assetNames.length };
      logSyncEvent('error', 'asset cleanup: hard stop — attribution does not add up',
        `(${attributed} of ${assetNames.length})`);
      return report;
    }

    // Observational only, never a gate.
    report.referencedMissing = [...referenced].filter((ref) => !presentRefs.includes(ref));
    report.missingFromDevices = devicesReferencing(bundles, report.referencedMissing);
    report.unresolvedMarks = listAssetState()
      .filter((state) => state.writeIntentAt || state.badSeenAt)
      .map((state) => state.id);
    if (report.divergentRefs.length > 0) {
      logSyncEvent('warn', 'asset cleanup: reference collection diverged on', report.divergentRefs.length, 'ref(s)');
    }
    logSyncEvent('info', 'asset cleanup:', candidates.length, 'candidate(s) of', assetNames.length,
      `(${report.referencedMissing.length} referenced but missing)`);

    if (candidates.length === 0) return report;

    // Optimistic re-check: if any backup file appeared or changed while we
    // were deciding, a publish landed mid-pass and our reference set may
    // already be stale. Cheap compare-and-swap; the next run retries.
    const after = await listBackupFiles(dirHandle);
    const before = bundles.map((b) => b.fileName);
    if (after.length !== before.length || after.some((name) => !before.includes(name))) {
      report.outcome = 'aborted';
      report.detail = 'the folder\'s backup files changed while the pass was running';
      logSyncEvent('info', 'asset cleanup: aborted, a bundle changed mid-pass — retrying next time');
      return report;
    }

    for (const name of candidates) {
      try {
        await removeAsset(dirHandle, name);
        const state = getAssetState(refOf(name));
        if (state && typeof state.bytes === 'number') report.removedBytes += state.bytes;
        else report.bytesKnown = false; // a peer wrote it; its size was never ours to know
        report.removed.push(name);
      } catch (err) {
        logSyncEvent('warn', 'asset cleanup: could not remove', name, '—', err && err.message);
      }
    }

    // Check 11: every file attributed as referenced-and-present must still
    // be there. Deliberately not "the listing equals what it was minus what
    // we removed": that stricter form fires on a second device cleaning the
    // same folder concurrently, which this design treats as harmless, since
    // its candidate set may legitimately be slightly wider. A *referenced*
    // file vanishing is the real signal, and the only post-delete condition
    // that reaches the user.
    const postNames = new Set(await listAssetFiles(dirHandle));
    const vanished = referencedPresent.filter((name) => !postNames.has(name));
    if (vanished.length > 0) {
      report.outcome = 'hard-stop';
      report.failedCheck = 'referenced-file-vanished';
      report.detail = { vanished };
      report.affectedDevices = devicesReferencing(bundles, vanished.map(refOf));
      logSyncEvent('error', 'asset cleanup:', vanished.length, 'referenced asset(s) disappeared during the pass');
      logDiagnostic('error', '[sync] asset cleanup: referenced assets disappeared during the pass');
    }

    await pruneAssetState([...postNames].filter((n) => ASSET_NAME_PATTERN.test(n)).map(refOf));
    logSyncEvent('info', 'asset cleanup: removed', report.removed.length, 'unused photo file(s)');
    return report;
  } catch (err) {
    report.outcome = 'error';
    report.detail = (err && err.message) || String(err);
    logSyncEvent('warn', 'asset cleanup failed —', report.detail);
    logDiagnostic('error', '[sync] asset cleanup failed —', report.detail);
    return report;
  }
}

// Which peers still point at a given set of refs — used to name the
// devices whose images are affected, since that is the only actionable
// thing a user can be told.
function devicesReferencing(bundles, refs) {
  const wanted = new Set(refs);
  const devices = [];
  const ownId = safeDeviceId();
  for (const { bundle } of bundles) {
    const id = bundle.device && bundle.device.id;
    if (!id || id === ownId) continue;
    const refsHere = collectRefsDeep(bundle);
    if ([...refsHere].some((ref) => wanted.has(ref))) {
      devices.push({ id, name: (bundle.device && bundle.device.name) || id, exportedAt: bundle.exportedAt || null });
    }
  }
  return devices;
}

function safeDeviceId() {
  try {
    return getDeviceId();
  } catch {
    return null;
  }
}

export { backupFileName };
