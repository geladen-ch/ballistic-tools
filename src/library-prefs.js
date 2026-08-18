// Cookie-backed on/off switches for the two built-in library pickers (see
// Settings, and the matching checkbox duplicated inline in
// rifle-section.js/bullet-section.js themselves). Its own tiny module
// rather than folded into prefs.js since these aren't unit preferences —
// a boolean toggle needs none of that module's per-group defaulting
// machinery. Both default to on: the libraries are meant to be
// discoverable, not opt-in.
//
// Formerly rifle-library-prefs.js, covering only the rifle toggle; renamed
// now that it also owns the bullet one. The rifle cookie name is
// unchanged so existing users' saved preference isn't silently reset by
// this refactor.
import { getCookie, setCookie } from './cookies.js';

const RIFLE_COOKIE_NAME = 'ballistics_rifle_library_enabled_v1';
const BULLET_COOKIE_NAME = 'ballistics_bullet_library_enabled_v1';

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

export function isBulletLibraryEnabled() {
  return isEnabled(BULLET_COOKIE_NAME);
}

export function setBulletLibraryEnabled(enabled) {
  setEnabled(BULLET_COOKIE_NAME, enabled);
}
