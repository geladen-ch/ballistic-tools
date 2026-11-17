// Which Settings tab was last open — cookie-backed like nav-prefs.js, so a
// plain visit to Settings lands on the tab the user left it on. The tab keys
// themselves live with the view (see SETTINGS_TABS in views/settings-view.js);
// this module only stores one opaque string, and the view falls back to its
// first tab when the stored key is not (or is no longer) one of its tabs.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_settings_tab_v1';

function load() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (typeof raw === 'string' && raw) return raw;
  } catch {
    // cookies disabled — fall through to "nothing remembered"
  }
  return null;
}

let lastTab = load();

export function getLastSettingsTab() {
  return lastTab;
}

export function setLastSettingsTab(key) {
  lastTab = key;
  try {
    setCookie(COOKIE_NAME, key);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

// Test seam: re-reads the store, as a fresh page load would.
export function resetSettingsTabPrefsForTests() {
  lastTab = load();
}
