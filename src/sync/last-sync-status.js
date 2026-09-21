// Shared "when did a sync last actually happen, and with whom" tracker —
// used by both auto-sync.js's folder-based runSyncCycle() (Phase 5) and
// manual-sync.js's one-off file flow (Phase 8a/8b), so Phase 6's Settings
// status line reads one consistent answer regardless of which mechanism
// this device actually uses.
const LAST_SYNCED_AT_KEY = 'ballistics_last_synced_at_v1';

const OWN_PUBLISHED_AT_KEY = 'ballistics_own_published_at_v1';

let lastSyncedDevices = [];

// When *this* device last wrote its own bundle to the folder. The device
// registry only ever holds peers — it is filled by reading other devices'
// bundles, and a device never reads its own — so without this the Devices
// list had no publish time for the one row it always shows, and rendered
// "no backup file in the folder" beside a device that had just published.
export function recordOwnPublished(exportedAt) {
  try {
    localStorage.setItem(OWN_PUBLISHED_AT_KEY, exportedAt || new Date().toISOString());
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}

export function getOwnPublishedAt() {
  try {
    return localStorage.getItem(OWN_PUBLISHED_AT_KEY);
  } catch {
    return null;
  }
}

// What each backup file in the folder holds, as read out of the file
// itself: `{ [fileName]: { id, name, exportedAt } }`. Nothing here is
// inferred from a file name — the name is only the key the folder gives us
// to look a file up by. The Devices list has to list the folder without
// opening every file each time it repaints, so it reads this instead;
// see device-deletion.js's identifyBackupFiles() for how a file no cycle
// has read yet gets into it. Replaced wholesale by each sync cycle, so it
// cannot accumulate names of files long gone.
const FILE_DEVICES_KEY = 'ballistics_backup_file_devices_v1';

export function recordFileDevices(files) {
  try {
    localStorage.setItem(FILE_DEVICES_KEY, JSON.stringify(files || {}));
  } catch {
    // best-effort, same posture as the rest of this file
  }
}

export function getFileDevices() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FILE_DEVICES_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const normalized = {};
    for (const [fileName, value] of Object.entries(parsed)) {
      // An earlier build stored just the id string.
      const entry = typeof value === 'string' ? { id: value } : value;
      if (entry && typeof entry.id === 'string' && entry.id) {
        normalized[fileName] = { id: entry.id, name: entry.name || null, exportedAt: entry.exportedAt || null };
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

export function getLastSyncedAt() {
  try {
    return localStorage.getItem(LAST_SYNCED_AT_KEY);
  } catch {
    return null;
  }
}

export function getLastSyncedDevices() {
  return lastSyncedDevices;
}

export function recordSyncCompleted(deviceNames) {
  lastSyncedDevices = deviceNames;
  try {
    localStorage.setItem(LAST_SYNCED_AT_KEY, new Date().toISOString());
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}

// Which peers, if any, had at least one record deferred *this cycle*
// because a Phase 7 referenced-mode photo hadn't finished syncing through
// the cloud client yet (auto-sync.js's runSyncCycle, `onUnresolvable:
// 'skip'` — the repeating/persisted context that actually retries; see
// photo-assets.js's own comment on why manual-sync.js's one-shot 'null'
// path doesn't need this at all, since there the record still imports
// immediately, just without its photo). Session-only, same as
// lastSyncedDevices above — overwritten wholesale on every cycle so a
// since-resolved photo silently clears the warning on its own, with no
// separate "all clear" event needed.
let pendingPhotoDevices = [];

export function getPendingPhotoDevices() {
  return pendingPhotoDevices;
}

export function recordPendingPhotoDevices(deviceNames) {
  pendingPhotoDevices = deviceNames;
}

// Peers whose bundle showed a genuine clock anomaly during the last cycle
// (merge.js's detectFutureExport/detectBackwardExport — a bundle dated
// after this device's own clock, or a peer whose exportedAt went backward
// relative to its own last-known one). Phase 4 calls surfacing this
// **required**, not optional: nothing in the merge algorithm detects skew,
// it just resolves silently in the wrong direction. Logging it through
// Phase 10's verbose trace is not surfacing it, since that trace is off by
// default, so it lands here alongside the rest of the status line.
//
// Session-only and overwritten wholesale per cycle, exactly like
// lastSyncedDevices above: a peer whose clock has since been corrected
// clears the warning on its own with no separate "all clear" event.
// Plain device-name strings — unlike the old exportedAt-vs-now heuristic
// this replaced, there's no single meaningful magnitude to show (a
// "future" anomaly and a "backward jump" aren't comparable numbers), so
// the status line just names which peer, not by how much.
let clockSkewedDevices = [];

export function getClockSkewedDevices() {
  return clockSkewedDevices;
}

export function recordClockSkewedDevices(entries) {
  clockSkewedDevices = entries;
}
