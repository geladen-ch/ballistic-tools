// Cookie-backed switch for the two update-notification dialogs (see
// update-notifications.js) — same tiny get/set shape as library-prefs.js,
// but default **on**: unlike the built-in libraries (discoverable, opt-in
// posture doesn't apply) a shooter generally wants to know the app they're
// relying on just changed under them.
//
// getLastSeenVersion()/setLastSeenVersion() live here too, even though
// they're not a user-facing setting (no Settings row) — internal
// bookkeeping of which CACHE_VERSION this browser was last shown, so
// checkBootVersionChange() can tell "updated since last visit" from
// "nothing changed." Same cookie-backed storage, just a different key,
// not worth its own module.
import { getCookie, setCookie } from './cookies.js';

const ENABLED_COOKIE_NAME = 'ballistics_update_notifications_enabled_v1';
const LAST_SEEN_VERSION_COOKIE_NAME = 'ballistics_last_seen_version_v1';

export function isUpdateNotificationsEnabled() {
  const raw = getCookie(ENABLED_COOKIE_NAME);
  if (raw === null) return true;
  return raw === 'true';
}

export function setUpdateNotificationsEnabled(enabled) {
  try {
    setCookie(ENABLED_COOKIE_NAME, String(!!enabled));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

// null means "never recorded" — either a first-ever visit, or the first
// visit since this feature shipped. Either way, checkBootVersionChange()
// must not claim the app was "updated from" anything.
export function getLastSeenVersion() {
  return getCookie(LAST_SEEN_VERSION_COOKIE_NAME);
}

export function setLastSeenVersion(version) {
  try {
    setCookie(LAST_SEEN_VERSION_COOKIE_NAME, version);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}
