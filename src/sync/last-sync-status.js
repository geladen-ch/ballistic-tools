// Shared "when did a sync last actually happen, and with whom" tracker —
// used by both auto-sync.js's folder-based runSyncCycle() (Phase 5) and
// manual-sync.js's one-off file flow (Phase 8a/8b), so Phase 6's Settings
// status line reads one consistent answer regardless of which mechanism
// this device actually uses.
const LAST_SYNCED_AT_KEY = 'ballistics_last_synced_at_v1';

let lastSyncedDevices = [];

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
