// Minimal cookie read/write helpers — the only place in the app that
// touches document.cookie directly, so callers (prefs.js) don't need to
// know about encoding, attributes, or the semicolon-separated format.
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function setCookie(name, value, { maxAge = DEFAULT_MAX_AGE_SECONDS } = {}) {
  // Secure is only valid (and only wanted) over https — setting it on a
  // plain http origin makes browsers silently refuse the cookie entirely.
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

export function getCookie(name) {
  const prefix = encodeURIComponent(name) + '=';
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const entry of cookies) {
    if (entry.startsWith(prefix)) return decodeURIComponent(entry.slice(prefix.length));
  }
  return null;
}

export function removeCookie(name) {
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;
}
