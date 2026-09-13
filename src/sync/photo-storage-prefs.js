// The "iPhone manual sync support" toggle — see
// docs/plans/backup-sync.md Phase 7's "Conflict with iOS manual sync".
// Off by default: a folder-access device (Chromium) writes the efficient
// photoRef/assets/ split among its peers. Turning this on makes this
// device always embed photos inline instead, so any bundle it writes is
// fully self-contained and importable by a device with no folder access
// at all (Phase 8a without reliable directory-selection, or 8b/iOS) —
// heavier, but compatible everywhere.
//
// A local, per-device preference in storage, but a mesh-wide *decision* in
// effect: one device anywhere in the mesh that can't resolve photoRef
// means every folder-access device writing bundles needs this turned on,
// which is exactly why Settings frames it as "makes it compatible with
// iPhones, but makes it heavy and inefficient for everybody else" rather
// than hiding the trade-off.
const IPHONE_SYNC_SUPPORT_KEY = 'ballistics_iphone_sync_support_v1';

export function isIphoneSyncSupportEnabled() {
  try {
    return localStorage.getItem(IPHONE_SYNC_SUPPORT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setIphoneSyncSupportEnabled(enabled) {
  try {
    localStorage.setItem(IPHONE_SYNC_SUPPORT_KEY, enabled ? 'true' : 'false');
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}
