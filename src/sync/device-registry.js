// A local, persisted cache of every peer device this installation has ever
// seen a `device` block from in a synced bundle (Phase 3) —
// `{ [deviceId]: { name, modifiedAt, lastExportedAt?, deletedUpTo? } }`. Populated
// opportunistically as runSyncCycle() (Phase 5) reads each peer's
// backup-*.json file each cycle; survives even if that peer's bundle file
// is later removed from the folder. This registry — not the bundle — is
// what Settings' "last synced with: Guns' iPhone" status (Phase 6) and
// Phase 4b's disambiguateByName() labels actually read from.
import { logSyncEvent } from './sync-log.js';
import { getDeviceId } from './device-id.js';

const REGISTRY_KEY = 'ballistics_device_registry_v1';

function load() {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function save(registry) {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}

// Merges in one peer's `device` block from a bundle just read off disk —
// newer `modifiedAt` wins, the same rule as every other record in this
// plan (see merge.js). Safe to call redundantly on every sync cycle.
export function recordPeerDevice(device) {
  if (!device || !device.id) return;
  const registry = load();
  const existing = registry[device.id];
  // A locally forgotten device (see forgetDevice() below) always falls
  // through, however stale its name record is: `device.modifiedAt` is the
  // *name* record's timestamp, which only moves when the machine is
  // renamed, so without this a forgotten device that came back under the
  // same name would stay forgotten. (This has nothing to do with device
  // deletion, which is a tombstone and is never undone by reading a
  // bundle — see classifyDeletedPeerBundle() below.)
  const isDeleted = !!(existing && existing.deletedAt);
  if (!isDeleted && existing && existing.modifiedAt && device.modifiedAt
      && Date.parse(existing.modifiedAt) >= Date.parse(device.modifiedAt)) {
    return; // local cache is already at least as current
  }
  logSyncEvent('debug', existing ? 'device name updated:' : 'device name learned:', device.id, '—', device.name);
  // Preserves lastExportedAt (a separate concern below, updated on its own
  // cadence by recordPeerExportedAtSeen) but still drops deletedAt — a
  // real read of this device's own current data is exactly what "un-
  // forgets" a retired device, per forgetDevice()'s own comment below.
  const { deletedAt: _forgotten, ...rest } = existing || {};
  registry[device.id] = { ...rest, name: device.name, modifiedAt: device.modifiedAt };
  save(registry);
}

export function getKnownDevices() {
  return load();
}

// Resolves a deviceId (modifiedBy/deletedBy on a record) to a display
// name, or null if unknown/forgotten — callers fall back to their own
// date/id-fragment scheme per Phase 4b.
export function getDeviceLabel(deviceId) {
  const entry = load()[deviceId];
  return entry && !entry.deletedAt && !tombstoneCovers(entry, entry.lastExportedAt) ? entry.name : null;
}

// A device's name even when it has since been deleted — which
// getDeviceLabel() above deliberately does not give. For the few places that
// must still say who something came from after that device has gone, such as
// a conflict that was raised before it was deleted. Null if it was never
// seen by name.
export function getDeviceNameEvenIfDeleted(deviceId) {
  const entry = load()[deviceId];
  return (entry && entry.name) || null;
}

// The most recent bundle `exportedAt` this device has observed from a
// given peer — merge.js's detectBackwardExport uses this (not this
// device's own clock) to tell a peer whose clock jumped backward apart
// from one that simply hasn't synced in a while, which "exportedAt vs my
// own now" alone cannot do (see that function's own comment). Purely
// local bookkeeping, never merged via a "newer wins" rule the way
// name/modifiedAt above are — always overwritten with whatever was
// actually just read, regardless of value.
export function getPeerExportedAt(deviceId) {
  const entry = load()[deviceId];
  return (entry && entry.lastExportedAt) || null;
}

export function recordPeerExportedAtSeen(deviceId, exportedAt) {
  if (!deviceId || !exportedAt) return;
  const registry = load();
  let entry = { ...registry[deviceId], lastExportedAt: exportedAt };
  // A bundle only gets here if it was admitted, and a bundle from a
  // tombstoned device is only admitted when it is later than the
  // tombstone's `upTo` — so this is the device coming back with new data.
  // The tombstone has done its job and is dropped, which also stops it
  // being published: every peer clears its copy the same way as soon as it
  // reads that device's next file, and mergeDeviceTombstones() below
  // refuses to take an old copy back in once it has.
  if (entry.deletedUpTo && !tombstoneCovers(entry, exportedAt)) {
    const { deletedUpTo: _upTo, deletedOn: _on, deletedBy: _by, ...rest } = entry;
    entry = rest;
    logSyncEvent('info', 'device tombstone cleared, it published again:', deviceId);
  }
  registry[deviceId] = entry;
  save(registry);
}

// Local-only "forget this retired device" — see
// docs/plans/backup-sync.md's "Optional: forgetting a retired device".
// Never propagated; undoes itself automatically the next time this device
// actually reads a fresh `device` block from that peer's own bundle file.
export function forgetDevice(deviceId) {
  const registry = load();
  if (!registry[deviceId]) return;
  registry[deviceId] = { ...registry[deviceId], deletedAt: new Date().toISOString() };
  save(registry);
}

// ---- device deletion, docs/plans/orphaned-storage-cleanup.md phase 6 and
// docs/plans/device-deletion-propagation.md ----

// A device tombstone says "everything from this device up to its export
// `upTo` has been discarded". `upTo` is that device's *own* `exportedAt`
// — the newest one this device had merged when it was deleted, which is
// the registry's `lastExportedAt` — never a time on the deleting device's
// clock. So every comparison below is between two values stamped by the
// same machine, and skew between machines cannot matter.
//
// "Deleted" is computed from that, not stored as a flag: a bundle is stale
// if its `exportedAt` is at or before `upTo`. A device that comes back
// with a later export is simply not stale, so there is no revive step to
// coordinate: each peer drops the tombstone on its own when it reads that
// export, and a peer that keeps republishing an old copy cannot flip a
// returning device back and forth.
//
// Merging two tombstones for one id keeps the larger `upTo`, so the order
// peers are read in, and how often the same tombstone arrives, cannot change
// the result. A tombstone is dropped once its device publishes something
// later (see recordPeerExportedAtSeen()), and one that is already superseded
// is not taken in. They travel in every device's own bundle, which
// is how a deletion made in a browser that cannot remove files still
// reaches one that can.
//
// A tombstone costs about a hundred bytes and devices are deleted rarely,
// so there is no time expiry: expiring one would bring a device back from
// a folder whose stale file nothing is able to remove. The published list
// is only capped, newest first.
const MAX_PUBLISHED_TOMBSTONES = 500;

// True when `entry`'s tombstone covers a bundle exported at `exportedAt`.
// A bundle with no usable export time is treated as covered: it cannot be
// shown to be newer than what was discarded.
function tombstoneCovers(entry, exportedAt) {
  if (!entry || !entry.deletedUpTo) return false;
  const upTo = Date.parse(entry.deletedUpTo);
  const at = Date.parse(exportedAt);
  if (!Number.isFinite(upTo)) return false;
  return !Number.isFinite(at) || at <= upTo;
}

/**
 * Records that this device deleted `deviceId`, discarding everything up to
 * the newest export of it that was merged here. Returns the tombstone, or
 * null when nothing from that device was ever merged: there is then no
 * `upTo` to record, and nothing was taken from it that a deletion could be
 * said to discard.
 */
export function deleteDevice(deviceId, { by = null } = {}) {
  const registry = load();
  const existing = registry[deviceId] || {};
  const merged = existing.lastExportedAt;
  if (!merged || !Number.isFinite(Date.parse(merged))) return null;
  // Deleting again after a device came back and was merged raises the bar;
  // it never lowers one that is already there.
  const previous = existing.deletedUpTo;
  const upTo = previous && Date.parse(previous) > Date.parse(merged) ? previous : merged;
  const deletedOn = new Date().toISOString();
  registry[deviceId] = { ...existing, deletedUpTo: upTo, deletedOn, deletedBy: by };
  logSyncEvent('info', 'device deleted:', deviceId, `(everything up to ${upTo})`);
  save(registry);
  return { id: deviceId, upTo, deletedOn, by };
}

// True while the tombstone still covers the newest export merged from this
// device — that is, it has not published anything later since.
export function isDeviceDeleted(deviceId) {
  const entry = load()[deviceId];
  return tombstoneCovers(entry, entry && entry.lastExportedAt);
}

// What this device publishes, so peers learn about deletions it made.
export function getDeviceTombstones() {
  return Object.entries(load())
    .filter(([, entry]) => entry.deletedUpTo && Number.isFinite(Date.parse(entry.deletedUpTo)))
    .map(([id, entry]) => ({ id, upTo: entry.deletedUpTo, deletedOn: entry.deletedOn || null, by: entry.deletedBy || null }))
    .sort((a, b) => Date.parse(b.deletedOn || 0) - Date.parse(a.deletedOn || 0))
    .slice(0, MAX_PUBLISHED_TOMBSTONES);
}

// Union by device id, keeping the larger `upTo`: additive, commutative and
// idempotent. Returns how many were new or raised. A tombstone naming this
// device itself is ignored — a device is never deleted from its own point
// of view, and republishing such a tombstone would only be noise.
export function mergeDeviceTombstones(incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) return 0;
  const registry = load();
  const ownId = getDeviceId();
  let changed = 0;
  for (const tomb of incoming) {
    if (!tomb || !tomb.id || tomb.id === ownId) continue;
    if (!Number.isFinite(Date.parse(tomb.upTo))) continue;
    const existing = registry[tomb.id] || {};
    // Already superseded here: this device has merged a later export from
    // that machine than the one the tombstone discards, so the machine is
    // back and an old copy of its tombstone still circulating must not be
    // taken in again.
    if (existing.lastExportedAt && Date.parse(existing.lastExportedAt) > Date.parse(tomb.upTo)) continue;
    if (existing.deletedUpTo && Date.parse(existing.deletedUpTo) >= Date.parse(tomb.upTo)) continue;
    registry[tomb.id] = { ...existing, deletedUpTo: tomb.upTo, deletedOn: tomb.deletedOn || null, deletedBy: tomb.by || null };
    changed++;
  }
  if (changed > 0) {
    logSyncEvent('info', 'device tombstones merged:', changed);
    save(registry);
  }
  return changed;
}

// The one rule both sync paths apply to a bundle from a possibly-deleted
// device:
//   exportedAt after the tombstone's `upTo`  -> 'active': it published
//                                               something new, it is back
//   exportedAt at or before it               -> 'stale': the file that was
//                                               already deleted, resurfacing
// The second case is what makes a deletion stick when a peer's cloud client
// still holds the file, or when the browser that deleted the device could
// not remove the file at all. Without the tombstone the two are
// indistinguishable.
export function classifyDeletedPeerBundle(deviceId, exportedAt) {
  return tombstoneCovers(load()[deviceId], exportedAt) ? 'stale' : 'active';
}
