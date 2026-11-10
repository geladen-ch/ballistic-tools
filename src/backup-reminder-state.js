// When this device last saved a full backup, and whether the user's saved
// data has changed since — the bookkeeping behind the iOS backup reminder
// (storage-notices.js).
//
// On iOS the browser may delete everything this app stores once it has gone
// unused for a while, so a backup file kept outside the browser is the only
// copy guaranteed to survive. The reminder appears only when there is
// something to lose: data changed since the last backup, with that backup
// (or, with none yet, the first unsaved change) at least
// BACKUP_REMINDER_AFTER_MS old — matching Safari's seven-day window.
//
// Stored in localStorage like the rest of the sync bookkeeping. If the
// browser wipes the app's storage these go with it, which is fine: an empty
// app has nothing to remind about.
import { onLibraryWrite } from './sync/write-hooks.js';
import { getCookie, setCookie } from './cookies.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER_AFTER_MS = 7 * DAY_MS;
// "Later" in the reminder.
export const BACKUP_REMINDER_SNOOZE_MS = DAY_MS;

const LAST_BACKUP_AT_KEY = 'ballistics_last_backup_at_v1';
// Time of the first library write since the last backup; absent when
// everything is backed up.
const UNSAVED_SINCE_KEY = 'ballistics_unsaved_since_v1';
const SNOOZED_UNTIL_KEY = 'ballistics_backup_reminder_snoozed_until_v1';
// The user's own switch (Settings, and the reminder's "Never show again"):
// a preference rather than bookkeeping, so it lives in the preference store
// with the app's other settings. On unless turned off.
const ENABLED_PREF_NAME = 'ballistics_backup_reminders_enabled_v1';

export function isBackupReminderEnabled() {
  return getCookie(ENABLED_PREF_NAME) !== 'false';
}

export function setBackupReminderEnabled(enabled) {
  try {
    setCookie(ENABLED_PREF_NAME, String(!!enabled));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

function readTime(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

function writeTime(key, ms) {
  try {
    localStorage.setItem(key, new Date(ms).toISOString());
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage disabled — nothing to remove
  }
}

export function getLastBackupAt() {
  return readTime(LAST_BACKUP_AT_KEY);
}

// Called wherever a full backup bundle leaves the app: the share sheet
// completing, a download starting, or a sync-folder publish.
export function recordBackupSaved(now = Date.now()) {
  writeTime(LAST_BACKUP_AT_KEY, now);
  removeKey(UNSAVED_SINCE_KEY);
  removeKey(SNOOZED_UNTIL_KEY);
}

export function recordDataChanged(now = Date.now()) {
  if (readTime(UNSAVED_SINCE_KEY) === null) writeTime(UNSAVED_SINCE_KEY, now);
}

// Data saved by a build that predates this tracking has never been backed
// up as far as this file knows; start its clock now rather than nagging at
// once on the first launch after the update.
export function seedUnsavedData(hasUserData, now = Date.now()) {
  if (!hasUserData) return;
  if (getLastBackupAt() !== null || readTime(UNSAVED_SINCE_KEY) !== null) return;
  writeTime(UNSAVED_SINCE_KEY, now);
}

export function snoozeBackupReminder(now = Date.now()) {
  writeTime(SNOOZED_UNTIL_KEY, now + BACKUP_REMINDER_SNOOZE_MS);
}

export function isBackupReminderDue(now = Date.now()) {
  if (!isBackupReminderEnabled()) return false;
  const unsavedSince = readTime(UNSAVED_SINCE_KEY);
  if (unsavedSince === null) return false;
  const snoozedUntil = readTime(SNOOZED_UNTIL_KEY);
  if (snoozedUntil !== null && now < snoozedUntil) return false;
  const since = getLastBackupAt() ?? unsavedSince;
  return now - since >= BACKUP_REMINDER_AFTER_MS;
}

// Every library write (Arsenal, locations, Rifle Precision, reticles),
// including records merged in from a backup file.
onLibraryWrite(() => recordDataChanged());
