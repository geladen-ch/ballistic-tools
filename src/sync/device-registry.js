// A local, persisted cache of every peer device this installation has ever
// seen a `device` block from in a synced bundle (Phase 3) —
// `{ [deviceId]: { name, modifiedAt, deletedAt? } }`. Populated
// opportunistically as runSyncCycle() (Phase 5) reads each peer's
// backup-*.json file each cycle; survives even if that peer's bundle file
// is later removed from the folder. This registry — not the bundle — is
// what Settings' "last synced with: Guns' iPhone" status (Phase 6) and
// Phase 4b's disambiguateByName() labels actually read from.
import { logSyncEvent } from './sync-log.js';

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
  if (existing && existing.modifiedAt && device.modifiedAt
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
  return entry && !entry.deletedAt ? entry.name : null;
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
  registry[deviceId] = { ...registry[deviceId], lastExportedAt: exportedAt };
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
