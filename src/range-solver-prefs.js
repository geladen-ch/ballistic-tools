// Cookie-backed display preferences — originally Range-Solver-only (hence
// the filename/cookie names kept for continuity), but THEME_CHOICES below
// now applies app-wide (see app.js/base.css's .theme-* classes) while
// INDICATOR_STYLE_CHOICES further down stays specific to Range Solver's
// own elevation/windage readout. Same shape as library-prefs.js/wind-dial-
// prefs.js otherwise.
import { getCookie, setCookie } from './cookies.js';

const THEME_COOKIE_NAME = 'ballistics_theme_v1';
// Pre-theme-picker cookie (a plain on/off high-contrast toggle, no theme
// choice) — read once below to migrate anyone who'd already turned it on,
// never written to again.
const LEGACY_HIGH_CONTRAST_COOKIE_NAME = 'ballistics_range_solver_high_contrast_v1';
const DEFAULT_THEME = 'dark';

// Order here is also the Settings theme-picker's own display order (see
// theme-picker.js) — default first, matching every other CHOICES array in
// this codebase (see INDICATOR_STYLE_CHOICES below, WIND_DIAL_APPEARANCE_
// CHOICES, DISPLAY_MODE_CHOICES).
export const THEME_CHOICES = [
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'high-contrast-light', labelKey: 'settings.themeHighContrastLight' },
  { value: 'high-contrast-dark', labelKey: 'settings.themeHighContrastDark' }
];

function loadInitialTheme() {
  const raw = getCookie(THEME_COOKIE_NAME);
  if (THEME_CHOICES.some((c) => c.value === raw)) return raw;
  // One-time migration: someone who'd already turned the old boolean
  // high-contrast toggle on keeps landing on a high-contrast theme after
  // the upgrade, just the light variant — the only one that existed
  // before "high contrast dark" was added.
  if (getCookie(LEGACY_HIGH_CONTRAST_COOKIE_NAME) === 'true') return 'high-contrast-light';
  return DEFAULT_THEME;
}

// Cached in memory (read once at module load, not on every call) and
// broadcast via onThemeChange so the Settings picker re-themes the page
// immediately — same pattern as display-mode-prefs.js's own
// getDisplayMode/onDisplayModeChange.
let theme = loadInitialTheme();
const themeListeners = new Set();

export function getTheme() {
  return theme;
}

export function setTheme(next) {
  if (!THEME_CHOICES.some((c) => c.value === next) || next === theme) return;
  theme = next;
  try {
    setCookie(THEME_COOKIE_NAME, theme);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
  themeListeners.forEach((fn) => fn(theme));
}

export function onThemeChange(fn) {
  themeListeners.add(fn);
  return () => themeListeners.delete(fn);
}

export function resetThemeForTests() {
  theme = DEFAULT_THEME;
}

const INDICATOR_STYLE_COOKIE_NAME = 'ballistics_range_solver_indicator_style_v1';
const DEFAULT_INDICATOR_STYLE = 'signs';

// Which glyphs the elevation/windage readout's direction indicator uses
// (see range-solver-view.js's own INDICATOR_GLYPHS) — "signs" (+/−, the
// default, with + meaning up for elevation and right for windage),
// "arrows" (↑↓←→), or "udlr" (U/D/L/R letters, same +=up/+=right
// convention as signs).
export const INDICATOR_STYLE_CHOICES = [
  { value: 'signs', labelKey: 'settings.rangeSolverIndicatorSigns' },
  { value: 'arrows', labelKey: 'settings.rangeSolverIndicatorArrows' },
  { value: 'udlr', labelKey: 'settings.rangeSolverIndicatorUdlr' }
];

export function getIndicatorStyle() {
  const raw = getCookie(INDICATOR_STYLE_COOKIE_NAME);
  return INDICATOR_STYLE_CHOICES.some((c) => c.value === raw) ? raw : DEFAULT_INDICATOR_STYLE;
}

export function setIndicatorStyle(value) {
  if (!INDICATOR_STYLE_CHOICES.some((c) => c.value === value)) return;
  try {
    setCookie(INDICATOR_STYLE_COOKIE_NAME, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}
