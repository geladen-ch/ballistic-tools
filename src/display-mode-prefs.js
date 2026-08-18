// Manual override for the desktop-vs-mobile chrome (nav rail vs. tab bar,
// see layout.css) — "auto" (the default) leaves the choice entirely to
// layout.css's own media queries (viewport width, or a short landscape
// viewport); "desktop"/"mobile" force one regardless of viewport, via the
// force-desktop/force-mobile class app.js puts on <html>. An escape hatch
// for the odd device the automatic check gets wrong. Cookie-backed like
// nav-prefs.js, so the choice survives reloads; a listener set like
// guns-nav.js's so the header switch and app.js's own class-toggling stay
// in sync without a page reload.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_display_mode_v1';

export const DISPLAY_MODE_CHOICES = [
  { value: 'auto', labelKey: 'nav.displayModeAuto' },
  { value: 'desktop', labelKey: 'nav.displayModeDesktop' },
  { value: 'mobile', labelKey: 'nav.displayModeMobile' }
];

function load() {
  const raw = getCookie(COOKIE_NAME);
  return DISPLAY_MODE_CHOICES.some((c) => c.value === raw) ? raw : 'auto';
}

let mode = load();
const listeners = new Set();

export function getDisplayMode() {
  return mode;
}

export function setDisplayMode(next) {
  if (!DISPLAY_MODE_CHOICES.some((c) => c.value === next) || next === mode) return;
  mode = next;
  try {
    setCookie(COOKIE_NAME, mode);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
  listeners.forEach((fn) => fn(mode));
}

export function onDisplayModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetDisplayModePrefsForTests() {
  mode = 'auto';
}
