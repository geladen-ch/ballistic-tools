// Interface scale (100-200%, in 25% steps) — applied as CSS `zoom` on
// <html> by app.js, not `transform: scale()`: zoom reflows layout (text
// wraps, containers stay centered) and reaches #app-dialog for free since
// it's a sibling of #app-shell (see index.html) under the same <html>
// root a transform scoped to #app-shell would miss. Cookie-backed and
// listener-set-driven exactly like display-mode-prefs.js, so Settings and
// app.js's own zoom-applying code stay in sync without a page reload.
//
// Settings shows this as a slider (min/max/step read straight off this
// array, see settings-view.js), not a discrete choice list, so unlike
// display-mode-prefs.js's own CHOICES there's no labelKey per value —
// just the plain numeric-string values a <input type="range"> needs.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_ui_scale_v1';

export const UI_SCALE_CHOICES = ['100', '125', '150', '175', '200'];

function load() {
  const raw = getCookie(COOKIE_NAME);
  return UI_SCALE_CHOICES.includes(raw) ? raw : '100';
}

let scale = load();
const listeners = new Set();

export function getUiScale() {
  return scale;
}

export function setUiScale(next) {
  if (!UI_SCALE_CHOICES.includes(next) || next === scale) return;
  scale = next;
  try {
    setCookie(COOKIE_NAME, scale);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
  listeners.forEach((fn) => fn(scale));
}

export function onUiScaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetUiScalePrefsForTests() {
  scale = '100';
}
