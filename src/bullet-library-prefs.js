// Cookie-backed show/hide preference for each built-in bullet library
// (see bullets/bullet-libraries.js's BULLET_LIBRARIES) — same shape as
// drag-model-prefs.js, a hidden-id Set in one comma-joined cookie rather
// than one cookie per library. Everything defaults to visible (unlike
// drag models' G1/G7-only default): the libraries are meant to be
// discoverable, not opt-in, matching library-prefs.js's own convention
// for the (still single, untouched) rifle-library toggle.
import { getCookie, setCookie } from './cookies.js';
import { BULLET_LIBRARIES } from './bullets/bullet-libraries.js';

const COOKIE_NAME = 'ballistics_hidden_bullet_libraries_v1';
// Pre-multi-library boolean toggle ("Show built-in bullets library") —
// consulted only as a one-time migration for a user who saved a
// preference under the old scheme before COOKIE_NAME existed. Never
// written to again.
const LEGACY_COOKIE_NAME = 'ballistics_bullet_library_enabled_v1';

function defaultHidden() {
  // An explicit old "off" hides every library now; no old cookie at all,
  // or an old explicit "on", leaves everything visible.
  return getCookie(LEGACY_COOKIE_NAME) === 'false'
    ? new Set(BULLET_LIBRARIES.map((lib) => lib.id))
    : new Set();
}

function loadHidden() {
  const raw = getCookie(COOKIE_NAME);
  // No cookie at all (never saved under the new scheme) falls back to
  // the migration above; an explicitly saved empty string (every library
  // shown, on purpose) must NOT be re-defaulted every load — only null
  // means "never touched this".
  if (raw === null) return defaultHidden();
  const knownIds = new Set(BULLET_LIBRARIES.map((lib) => lib.id));
  return new Set(raw.split(',').filter((id) => knownIds.has(id)));
}

let hidden = loadHidden();

export function isBulletLibraryVisible(libraryId) {
  return !hidden.has(libraryId);
}

export function setBulletLibraryVisible(libraryId, visible) {
  if (visible) hidden.delete(libraryId); else hidden.add(libraryId);
  try {
    setCookie(COOKIE_NAME, [...hidden].join(','));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

export function resetBulletLibraryPrefsForTests() {
  hidden = defaultHidden();
}
