// Reading a cookie-backed state slice whose stored shape has changed.
//
// The current cookie holds the slice exactly as it is in memory (SI, see
// quantity.js). A device that has not written it yet may still hold the
// slice under its previous cookie, in that build's names and units: it is
// converted once (by `fromLegacy`, built on legacy-units.js's frozen
// tables), written under the current name, and the old cookie is left
// where it is, so a rollback to the previous build still finds its own
// state. Nothing writes the old cookie any more; it lapses with its
// max-age.
import { getCookie, setCookie } from './cookies.js';

function parseCookie(name) {
  try {
    const raw = getCookie(name);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // malformed -- treated as absent
  }
}

export function loadVersionedCookie({ name, legacyName, fromLegacy }) {
  const current = parseCookie(name);
  if (current) return current;
  const legacy = parseCookie(legacyName);
  if (!legacy) return null;
  let migrated;
  try {
    migrated = fromLegacy(legacy);
  } catch {
    return null; // unreadable old shape -- start afresh
  }
  try {
    setCookie(name, JSON.stringify(migrated));
  } catch {
    // best-effort -- the conversion simply runs again next load
  }
  return migrated;
}

export function saveCookieState(name, state) {
  try {
    setCookie(name, JSON.stringify(state));
  } catch {
    // best-effort -- losing persistence isn't fatal
  }
}
