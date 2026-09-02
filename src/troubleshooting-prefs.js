// Cookie-backed on/off switch for whether Home's About section shows the
// Troubleshooting card (see home-view.js's troubleshootingCard()) — its
// own tiny module, same shape as zero-spin-drift-prefs.js. Defaults
// **off**: most users never need it, and it's one more card in a section
// that's already fairly dense; Settings is where a user reporting a
// problem would be told to go turn it on.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_show_troubleshooting_enabled_v1';

export function isTroubleshootingPaneEnabled() {
  return getCookie(COOKIE_NAME) === 'true';
}

export function setTroubleshootingPaneEnabled(enabled) {
  try {
    setCookie(COOKIE_NAME, String(!!enabled));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}
