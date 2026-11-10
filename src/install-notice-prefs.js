// Whether the iOS "add to Home Screen" notice (storage-notices.js) may show:
// "Not now" hides it for INSTALL_NOTICE_SNOOZE_MS, "Don't show again" for
// good. localStorage, so a wipe of the app's storage brings the notice back,
// which is exactly when it is worth seeing again.
const DAY_MS = 24 * 60 * 60 * 1000;
export const INSTALL_NOTICE_SNOOZE_MS = 30 * DAY_MS;
// After "Save backup" in the notice: long enough not to reappear while the
// user is adding the app to the Home Screen, short enough to return if they
// did not.
export const INSTALL_NOTICE_AFTER_BACKUP_MS = DAY_MS;

const SNOOZED_UNTIL_KEY = 'ballistics_install_notice_snoozed_until_v1';
const DISMISSED_KEY = 'ballistics_install_notice_dismissed_v1';

export function isInstallNoticeAllowed(now = Date.now()) {
  try {
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return false;
    const until = Date.parse(localStorage.getItem(SNOOZED_UNTIL_KEY) || '');
    return !(Number.isFinite(until) && now < until);
  } catch {
    return true;
  }
}

export function snoozeInstallNotice(durationMs, now = Date.now()) {
  try {
    localStorage.setItem(SNOOZED_UNTIL_KEY, new Date(now + durationMs).toISOString());
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}

export function dismissInstallNotice() {
  try {
    localStorage.setItem(DISMISSED_KEY, 'true');
  } catch {
    // storage full/disabled — best-effort, same posture as prefs.js
  }
}
