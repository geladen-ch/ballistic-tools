// Retiring a device that is out of circulation — see
// docs/plans/orphaned-storage-cleanup.md phase 6 and
// docs/plans/device-deletion-propagation.md.
//
// There is one action and it is a deletion: no local-only "forget" tier,
// no restore list. It records a tombstone that travels to every other
// device in the next published bundle, so a machine retired on the phone
// also disappears from the laptop's list, and removes that device's
// `backup-*.json` files from the shared folder where this browser is able
// to. A browser that is not (Firefox, Safari, iOS: no folder access) leaves
// the file where it is: every device ignores it once it has the tombstone,
// and a device that can remove files does so the next time it syncs.
//
// What makes a one-step, irreversible, *propagated* deletion defensible is
// the pair of gates below plus what the tombstone records: everything up
// to the newest export merged here. Between them they guarantee the device
// holds nothing this device has not already merged, which reduces the
// deletion to discarding a redundant copy. And a machine that turns out to
// be alive is not locked out: its next export is later than what was
// discarded, so it is merged again and the tombstone is dropped (see
// device-registry.js).
import { removeBackupFile, listBackupFiles, readFile } from './fs-folder.js';
import { parseBackupBundle } from './backup-bundle.js';
import { deleteDevice, getKnownDevices, getPeerExportedAt, isDeviceDeleted } from './device-registry.js';
import { getDeviceId } from './device-id.js';
import { listPendingReviews, clearPendingReview } from './pending-review.js';
import { getPendingPhotoDevices, getOwnPublishedAt, getFileDevices, recordFileDevices } from './last-sync-status.js';
import { clearAssetWarningSuppression } from './asset-cleanup.js';
import { logSyncEvent } from './sync-log.js';
import { markSyncDirty } from './auto-sync.js';

// A machine seen this recently is very probably still in use. Not a
// blocker — deleting it is legitimate and it simply rejoins — but the UI
// says so plainly, because "I deleted it and it came back" is the one
// outcome that reads as broken rather than as designed.
export const RECENT_SYNC_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Why this device may not be deleted right now, or null if it may.
 *
 * Both gates read state the app already tracks and already shows in
 * Settings, and both block rather than warn:
 *
 *  - 'not-merged'      — nothing from it has been merged on this device yet
 *                        (it is only known from a file in the folder), so
 *                        there is nothing to record as discarded. Sync first.
 *  - 'self'            — never offered for the device in use. A device
 *                        tombstoning itself would republish with a newer
 *                        exportedAt on its next cycle, immediately revive,
 *                        and achieve nothing.
 *  - 'conflicts'       — unresolved conflicts naming it. Resolving is
 *                        always possible (the review UI lets the user pick
 *                        a side), so this cannot deadlock.
 *  - 'photos-pending'  — photos from it are still arriving. This is the
 *                        case conflicts alone would miss: a record skipped
 *                        because its photo had not downloaded yet never
 *                        becomes a conflict, it is silently left out of the
 *                        merge, and deleting the bundle would lose it.
 */
export function deletionBlockedReason(deviceId) {
  if (!deviceId || deviceId === getDeviceId()) return { reason: 'self' };

  // Nothing from it has been merged here, so there is no export to record
  // as "discarded up to" — and nothing has been taken from it that
  // deleting could be said to be a redundant copy of.
  const known = getKnownDevices()[deviceId];
  if (!getPeerExportedAt(deviceId)) return { reason: 'not-merged', device: (known && known.name) || deviceId };

  const conflicts = listPendingReviews().filter((entry) => entry.peerDeviceId === deviceId);
  if (conflicts.length > 0) return { reason: 'conflicts', count: conflicts.length };

  const name = (known && known.name) || deviceId;
  if (getPendingPhotoDevices().includes(name)) return { reason: 'photos-pending', device: name };

  return null;
}

// True when this device published recently enough that it is probably
// still in use. The UI warns on this; it never blocks.
export function publishedRecently(deviceId) {
  const exportedAt = getPeerExportedAt(deviceId);
  if (!exportedAt) return false;
  const parsed = Date.parse(exportedAt);
  return Number.isFinite(parsed) && Date.now() - parsed < RECENT_SYNC_MS;
}

/**
 * Deletes one device. Returns { ok, reason } — never throws, so a caller
 * in the UI can describe the outcome either way.
 *
 * The order matters: the tombstone is recorded before the file is removed,
 * so a crash in between leaves a device that is marked deleted and will
 * have its resurfaced file removed on the next cycle, rather than a file
 * that is gone with nothing remembering why.
 */
export async function deleteSyncDevice(dirHandle, deviceId) {
  const blocked = deletionBlockedReason(deviceId);
  if (blocked) return { ok: false, ...blocked };

  if (!deleteDevice(deviceId, { by: getDeviceId() })) return { ok: false, reason: 'not-merged' };
  // The tombstone is only useful once it is published. Nothing else about
  // this device changed, so without this the cycle would see nothing to say
  // and the deletion would stay local.
  markSyncDirty();

  // Conflicts attributed to this peer can never be expired afterwards:
  // expireStaleReviewsForPeer() only runs while reading that peer's
  // bundle, and there will not be one. Clear them here or they outlive the
  // device forever.
  for (const entry of listPendingReviews()) {
    if (entry.peerDeviceId === deviceId) clearPendingReview(entry.recordType, entry.recordId);
  }
  clearAssetWarningSuppression(deviceId);

  // Its assets need no special handling: once the bundle is gone its
  // photoRefs leave the referenced set, and phase 5's cleanup removes
  // those files after the usual grace period.
  //
  // "Its bundle" can be several files: a browser without folder access
  // leaves a second copy beside the first, under whatever name its save
  // dialog produced. Which files are this device's is decided by opening
  // each and reading the id inside — never from the name — and this is an
  // explicit, rare, destructive action, so it reads the folder afresh
  // rather than trusting anything remembered. A file that will not parse
  // is left alone (it cannot be told to be this device's); should it turn
  // out to be, the sync cycle removes it once it does parse, as a file of
  // a deleted device that predates the deletion.
  try {
    if (dirHandle) {
      let removed = 0;
      for (const name of await listBackupFiles(dirHandle)) {
        let holderId = null;
        try {
          holderId = parseBackupBundle(await readFile(dirHandle, name)).device.id;
        } catch {
          continue;
        }
        if (holderId !== deviceId) continue;
        await removeBackupFile(dirHandle, name);
        removed += 1;
        logSyncEvent('warn', 'device deletion: removed', name);
      }
      return { ok: true, fileRemoved: true, filesRemoved: removed };
    }
  } catch (err) {
    logSyncEvent('warn', 'device deletion: could not remove the backup file —', err && err.message);
    return { ok: true, fileRemoved: false, detail: (err && err.message) || String(err) };
  }
  // No folder handle: this browser cannot remove files. The deletion is
  // still complete — it is recorded and will be published — but the file
  // stays until a device that can remove files sees the tombstone.
  return { ok: true, fileRemoved: false, deferred: true };
}

// Files whose contents could not be read (still downloading, not a backup)
// this page load, so the Devices list does not reopen a broken file every
// time it repaints.
const unreadableThisSession = new Set();

/**
 * Makes sure what is recorded about each backup file in the folder comes
 * from the file itself: opens the ones no sync cycle has read yet, reads
 * the id, name and export time inside, and records them. A file already
 * recorded is not reopened — the Devices list repaints after every sync and
 * on every Settings visit, and a bundle can be megabytes of photos — and
 * one that cannot be read is skipped, so it simply is not listed. Nothing
 * here looks at what a file is called.
 *
 * Call before listSyncDevices({ fileNames }). Best-effort: a failure leaves
 * the list built from what is already recorded.
 */
export async function identifyBackupFiles(dirHandle, fileNames) {
  const recorded = getFileDevices();
  const fresh = {};
  for (const name of fileNames) {
    if (recorded[name] || unreadableThisSession.has(name)) continue;
    try {
      const bundle = parseBackupBundle(await readFile(dirHandle, name));
      fresh[name] = { id: bundle.device.id, name: bundle.device.name || null, exportedAt: bundle.exportedAt || null };
    } catch {
      unreadableThisSession.add(name);
    }
  }
  if (Object.keys(fresh).length === 0) return;
  const present = new Set(fileNames);
  const kept = Object.fromEntries(Object.entries(recorded).filter(([name]) => present.has(name)));
  recordFileDevices({ ...kept, ...fresh });
}

// Every device this installation knows about, newest publish first, with
// everything the Devices list needs to render a row. A device whose file
// has left the folder stays listed rather than vanishing: nothing is
// pruned automatically, because a temporarily quiet machine disappearing
// from the list would be worse than a stale row.
//
// Built from two sources, because neither is complete on its own:
//
//  - the device registry, which is filled by *reading* a peer's bundle in
//    a sync cycle. It knows names and publish times, but only for devices
//    this browser has already been through a cycle with — so a peer whose
//    bundle sits in the folder but hasn't been read here yet (a fresh
//    browser profile, a first sync still in flight) is invisible to it;
//  - what is recorded about the files in the folder (`fileNames` is the
//    listing, when the caller has one; the record is filled by sync cycles
//    and by identifyBackupFiles()). It knows which device each file holds
//    because it was read out of the file, so a device whose file has not
//    been through a sync cycle here still appears — with the name and
//    publish time that file states.
//
// A file in the listing that has no record — unreadable, or not yet
// identified — is not listed: nothing about it is known, and its name is
// not evidence of anything. Several files for one device are one row.
//
// The one device the registry can never contain is this one: it is filled
// by reading other devices' bundles and a device never reads its own. So
// this row is always synthesized, and its publish time comes from what
// this device recorded when it last wrote its own bundle.
export function listSyncDevices({ fileNames = null } = {}) {
  const ownId = getDeviceId();
  const registry = getKnownDevices();

  // device id -> what the newest of its files in the folder says
  const held = new Map();
  if (fileNames) {
    const recorded = getFileDevices();
    for (const fileName of fileNames) {
      const info = recorded[fileName];
      if (!info) continue;
      const current = held.get(info.id);
      if (!current || Date.parse(info.exportedAt || 0) > Date.parse(current.exportedAt || 0)) held.set(info.id, info);
    }
  }
  const hasFileFor = (id) => (fileNames ? held.has(id) : null);

  const rows = Object.entries(registry)
    .filter(([id]) => !isDeviceDeleted(id) && id !== ownId)
    .map(([id, entry]) => ({
      id,
      name: entry.name || id,
      isSelf: false,
      lastExportedAt: entry.lastExportedAt || null,
      recentlyPublished: publishedRecently(id),
      hasBundle: hasFileFor(id),
      blocked: deletionBlockedReason(id)
    }));

  const listed = new Set(rows.map((row) => row.id));
  for (const [id, info] of held) {
    // A deleted device's file resurfacing is not a device to list; the
    // sync cycle removes it again.
    if (id === ownId || listed.has(id) || isDeviceDeleted(id)) continue;
    listed.add(id);
    rows.push({
      id, name: info.name || id, isSelf: false, lastExportedAt: info.exportedAt,
      recentlyPublished: false, hasBundle: true, blocked: deletionBlockedReason(id)
    });
  }

  const sorted = rows.sort((a, b) => Date.parse(b.lastExportedAt || 0) - Date.parse(a.lastExportedAt || 0));
  return [{
    id: ownId, name: null, isSelf: true, lastExportedAt: getOwnPublishedAt(),
    recentlyPublished: false, hasBundle: hasFileFor(ownId), blocked: { reason: 'self' }
  }, ...sorted];
}
