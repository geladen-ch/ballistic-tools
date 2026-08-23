// Cookie-backed on/off switch for the built-in rifle library picker (see
// Settings, and the matching checkbox duplicated inline in
// rifle-section.js itself). Its own tiny module rather than folded into
// prefs.js since this isn't a unit preference — a boolean toggle needs
// none of that module's per-group defaulting machinery. Defaults to on:
// the library is meant to be discoverable, not opt-in.
//
// The bullet-library equivalent used to live here too, but multiple
// built-in bullet libraries need a per-library visibility set rather than
// one shared flag — see bullet-library-prefs.js.
import { getCookie, setCookie } from './cookies.js';

const RIFLE_COOKIE_NAME = 'ballistics_rifle_library_enabled_v1';

function isEnabled(cookieName) {
  const raw = getCookie(cookieName);
  if (raw === null) return true;
  return raw === 'true';
}

function setEnabled(cookieName, enabled) {
  try {
    setCookie(cookieName, String(!!enabled));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

export function isRifleLibraryEnabled() {
  return isEnabled(RIFLE_COOKIE_NAME);
}

export function setRifleLibraryEnabled(enabled) {
  setEnabled(RIFLE_COOKIE_NAME, enabled);
}
