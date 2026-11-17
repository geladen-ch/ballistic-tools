// Which country hints the user dismissed (by hint id): remembered on this device, cookie-backed like the other prefs.
// A dismissed hint no longer shows under the weather block; the station-details dialog still lists every applicable hint.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_weather_hints_v1';

function load() {
  try {
    const raw = getCookie(COOKIE_NAME);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed?.dismissed)) return parsed.dismissed.filter((id) => typeof id === 'string');
  } catch {
    // malformed value or cookies disabled — nothing dismissed
  }
  return [];
}

let dismissed = load();

export function getDismissedHints() {
  return [...dismissed];
}

export function dismissHint(id) {
  if (dismissed.includes(id)) return;
  dismissed = [...dismissed, id];
  try {
    setCookie(COOKIE_NAME, JSON.stringify({ dismissed }));
  } catch {
    // best-effort
  }
}

/** Show every hint again. */
export function resetDismissedHints() {
  dismissed = [];
  try {
    setCookie(COOKIE_NAME, JSON.stringify({ dismissed }));
  } catch {
    // best-effort
  }
}

export function reloadHintPrefsForTests() {
  dismissed = load();
}
