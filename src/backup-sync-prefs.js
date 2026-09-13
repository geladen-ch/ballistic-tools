// The permanent master "Enable backup & sync" toggle — see
// docs/plans/backup-sync.md Phase 6. Off by default; gates the sync
// machinery and Settings UI only — see that phase's "What the master
// toggle does not gate" for the handful of things (tombstones,
// modifiedBy, the DB_VERSION bump, Prerequisite fixes) that apply to every
// user regardless of this switch.
const ENABLED_KEY = 'ballistics_backup_sync_enabled_v1';

export function isBackupSyncEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBackupSyncEnabled(enabled) {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}
