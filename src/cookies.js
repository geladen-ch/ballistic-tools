// The small-preference store behind every "remember this setting" in the
// app (prefs.js and the *-prefs/*-state modules). Kept under its original
// name and API so its callers need not change, but it no longer relies on
// cookies alone.
//
// Why: Safari (and every browser on iOS, all being WebKit) caps the
// lifetime of a cookie written from script at seven days, whatever
// max-age asks for. A preference that the user set once and never touched
// again therefore expired after a week even for someone opening the app
// every day. localStorage has no such per-item expiry, so it is the
// primary store now.
//
// The cookie is still written alongside, for two reasons: a rollback to a
// build that only reads cookies finds the user's current choices, and a
// browser that refuses localStorage (some locked-down private modes) still
// keeps the setting for the session. A value that exists only as a cookie
// (written by an earlier build) is copied into localStorage on first read.
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
// Namespaces these entries apart from the app's other localStorage keys,
// some of which share the `ballistics_` prefix the cookie names use.
const STORAGE_PREFIX = 'pref:';

function storageKey(name) {
  return STORAGE_PREFIX + name;
}

function readStorage(name) {
  try {
    return localStorage.getItem(storageKey(name));
  } catch {
    return null; // storage disabled — the cookie is all there is
  }
}

function writeStorage(name, value) {
  try {
    localStorage.setItem(storageKey(name), value);
  } catch {
    // storage full/disabled — the cookie still carries the value
  }
}

function removeStorage(name) {
  try {
    localStorage.removeItem(storageKey(name));
  } catch {
    // storage disabled — nothing stored there to remove
  }
}

function readCookie(name) {
  const prefix = encodeURIComponent(name) + '=';
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const entry of cookies) {
    if (entry.startsWith(prefix)) return decodeURIComponent(entry.slice(prefix.length));
  }
  return null;
}

function writeCookie(name, value, maxAge) {
  // Secure is only valid (and only wanted) over https — setting it on a
  // plain http origin makes browsers silently refuse the cookie entirely.
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

export function setCookie(name, value, { maxAge = DEFAULT_MAX_AGE_SECONDS } = {}) {
  const text = String(value);
  writeStorage(name, text);
  writeCookie(name, text, maxAge);
}

export function getCookie(name) {
  const stored = readStorage(name);
  if (stored !== null) return stored;
  const fromCookie = readCookie(name);
  if (fromCookie !== null) writeStorage(name, fromCookie);
  return fromCookie;
}

export function removeCookie(name) {
  removeStorage(name);
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;
}
