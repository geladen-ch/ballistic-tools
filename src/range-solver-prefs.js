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

const OUTPUT_UNIT_COOKIE_NAME = 'ballistics_range_solver_output_unit_v1';
const DEFAULT_OUTPUT_UNIT = 'clicks';

// Which unit the Range Solver's own elevation/windage readout (see
// range-solver-view.js) is dialed in — "clicks" (the default, using the
// active rifle's own scope click value, same as Trajectory's elevClicks/
// windClicks columns) or a fixed angular unit ("mrad"/"moa", independent of
// any scope's click value, same math as Trajectory's elevMrad/elevMOA
// columns — see clicksForOffset() in units.js).
export const OUTPUT_UNIT_CHOICES = [
  { value: 'clicks', labelKey: 'settings.rangeSolverOutputClicks' },
  { value: 'mrad', labelKey: 'settings.rangeSolverOutputMrad' },
  { value: 'moa', labelKey: 'settings.rangeSolverOutputMoa' }
];

export function getOutputUnit() {
  const raw = getCookie(OUTPUT_UNIT_COOKIE_NAME);
  return OUTPUT_UNIT_CHOICES.some((c) => c.value === raw) ? raw : DEFAULT_OUTPUT_UNIT;
}

export function setOutputUnit(value) {
  if (!OUTPUT_UNIT_CHOICES.some((c) => c.value === value)) return;
  try {
    setCookie(OUTPUT_UNIT_COOKIE_NAME, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

const LABEL_VISIBILITY_COOKIE_NAME = 'ballistics_range_solver_label_visibility_v1';
const DEFAULT_LABEL_VISIBILITY = 'always';

// How target labels behave on Range Solver's own "pick target on image"
// photo (both location-placement-view.js's select mode and range-card-
// panel.js) — see target-label-visibility.js for what each mode actually
// does. "always" (the default) is today's original unconditional-label
// behavior; "declutter" and "tap" both exist to reduce label clutter once
// several targets are placed close together on the same photo.
export const TARGET_LABEL_VISIBILITY_CHOICES = [
  { value: 'always', labelKey: 'settings.rangeSolverLabelVisibilityAlways' },
  { value: 'declutter', labelKey: 'settings.rangeSolverLabelVisibilityDeclutter' },
  { value: 'tap', labelKey: 'settings.rangeSolverLabelVisibilityTap' }
];

export function getTargetLabelVisibility() {
  const raw = getCookie(LABEL_VISIBILITY_COOKIE_NAME);
  return TARGET_LABEL_VISIBILITY_CHOICES.some((c) => c.value === raw) ? raw : DEFAULT_LABEL_VISIBILITY;
}

export function setTargetLabelVisibility(value) {
  if (!TARGET_LABEL_VISIBILITY_CHOICES.some((c) => c.value === value)) return;
  try {
    setCookie(LABEL_VISIBILITY_COOKIE_NAME, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

const SCOPE_VIEW_COOKIE_NAME = 'ballistics_range_solver_scope_view_v1';
const SCOPE_AIM_MODE_COOKIE_NAME = 'ballistics_range_solver_scope_aim_mode_v1';

// Whether the Range Solver shows the scope view (range-solver/
// scope-view.js) above a compact readout — only ever in effect for a
// rifle with a scope; global, not per rifle.
export function isScopeViewOn() {
  return getCookie(SCOPE_VIEW_COOKIE_NAME) === 'true';
}

export function setScopeViewOn(on) {
  try {
    setCookie(SCOPE_VIEW_COOKIE_NAME, on ? 'true' : 'false');
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

const SCOPE_BDC_OVERLAY_COOKIE_NAME = 'ballistics_range_solver_scope_bdc_overlay_v1';
const SCOPE_HOLDOVER_COOKIE_NAME = 'ballistics_range_solver_scope_holdover_v1';
const SCOPE_WIND_HOLDS_COOKIE_NAME = 'ballistics_range_solver_scope_wind_holds_v1';

function setFlagCookie(name, on) {
  try {
    setCookie(name, on ? 'true' : 'false');
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

// Whether the scope view labels the reticle's BDC marks with their ranges
// (reticle/bdc-overlay.js) — only ever in effect for a reticle that has
// BDC marks; global, not per reticle. Off by default.
export function isScopeBdcOverlayOn() {
  return getCookie(SCOPE_BDC_OVERLAY_COOKIE_NAME) === 'true';
}

export function setScopeBdcOverlayOn(on) {
  setFlagCookie(SCOPE_BDC_OVERLAY_COOKIE_NAME, on);
}

// Whether the scope view draws the aiming mark (and the off-field arrow
// standing in for it). On by default.
export function isScopeHoldoverOn() {
  return getCookie(SCOPE_HOLDOVER_COOKIE_NAME) !== 'false';
}

export function setScopeHoldoverOn(on) {
  setFlagCookie(SCOPE_HOLDOVER_COOKIE_NAME, on);
}

// Whether the scope view draws crosswind holds — on the BDC marks' levels
// with the BDC overlay on, otherwise on the aiming mark's. Until first
// set it follows the BDC overlay, which drew them before they had a
// switch of their own.
export function isScopeWindHoldsOn() {
  const raw = getCookie(SCOPE_WIND_HOLDS_COOKIE_NAME);
  return raw === null ? isScopeBdcOverlayOn() : raw === 'true';
}

export function setScopeWindHoldsOn(on) {
  setFlagCookie(SCOPE_WIND_HOLDS_COOKIE_NAME, on);
}

// What the scope view's aiming mark shows: 'hold' (nothing dialed) or
// 'dialElevation' (elevation dialed, windage held) — reticle/
// sight-picture.js's AIM_MODES.
export const SCOPE_AIM_MODE_CHOICES = ['hold', 'dialElevation'];

export function getScopeAimMode() {
  const raw = getCookie(SCOPE_AIM_MODE_COOKIE_NAME);
  return SCOPE_AIM_MODE_CHOICES.includes(raw) ? raw : 'hold';
}

export function setScopeAimMode(value) {
  if (!SCOPE_AIM_MODE_CHOICES.includes(value)) return;
  try {
    setCookie(SCOPE_AIM_MODE_COOKIE_NAME, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

const SCOPE_RING_POSITION_COOKIE_NAME = 'ballistics_range_solver_scope_ring_position_v1';
const DEFAULT_SCOPE_RING_POSITION = 'auto';

// Where the scope view's zoom ring sits: 'auto' (the default — below the
// reticle in the mobile chrome in portrait, so the reticle gets the full
// width, beside it everywhere else), 'beside' (always the vertical ring
// on the right), or 'below' (the horizontal ring under the reticle, in
// any orientation).
export const SCOPE_RING_POSITION_CHOICES = [
  { value: 'auto', labelKey: 'settings.rangeSolverScopeRingAuto' },
  { value: 'beside', labelKey: 'settings.rangeSolverScopeRingBeside' },
  { value: 'below', labelKey: 'settings.rangeSolverScopeRingBelow' }
];

export function getScopeRingPosition() {
  const raw = getCookie(SCOPE_RING_POSITION_COOKIE_NAME);
  return SCOPE_RING_POSITION_CHOICES.some((c) => c.value === raw) ? raw : DEFAULT_SCOPE_RING_POSITION;
}

export function setScopeRingPosition(value) {
  if (!SCOPE_RING_POSITION_CHOICES.some((c) => c.value === value)) return;
  try {
    setCookie(SCOPE_RING_POSITION_COOKIE_NAME, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

const RETICLE_OVERLAY_COLOR_COOKIE_NAME = 'ballistics_range_solver_reticle_overlay_color_v1';
const DEFAULT_RETICLE_OVERLAY_COLOR = 'auto';

// The colour of everything the scope view lays over the reticle (the
// aiming mark, its leads, the off-field arrow, the BDC overlay), from the
// Okabe-Ito colour-blind-safe palette: 'vermillion', 'blue', or 'auto'
// (the default) — vermillion, but blue on a reticle lit red or amber,
// which vermillion would be lost against.
export const RETICLE_OVERLAY_COLORS = Object.freeze({ vermillion: '#D55E00', blue: '#0072B2' });
export const RETICLE_OVERLAY_COLOR_CHOICES = [
  { value: 'auto', labelKey: 'settings.reticleOverlayColorAuto' },
  { value: 'vermillion', labelKey: 'settings.reticleOverlayColorVermillion' },
  { value: 'blue', labelKey: 'settings.reticleOverlayColorBlue' }
];
const ILLUMINATIONS_NEAR_VERMILLION = ['red', 'amber'];

export function getReticleOverlayColor() {
  const raw = getCookie(RETICLE_OVERLAY_COLOR_COOKIE_NAME);
  return RETICLE_OVERLAY_COLOR_CHOICES.some((c) => c.value === raw) ? raw : DEFAULT_RETICLE_OVERLAY_COLOR;
}

export function setReticleOverlayColor(value) {
  if (!RETICLE_OVERLAY_COLOR_CHOICES.some((c) => c.value === value)) return;
  try {
    setCookie(RETICLE_OVERLAY_COLOR_COOKIE_NAME, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

// The hex colour a choice comes to for a reticle (its `illumination`,
// reticle/model.js's { enabled, colour }).
export function reticleOverlayHex(choice, illumination) {
  if (choice === 'vermillion' || choice === 'blue') return RETICLE_OVERLAY_COLORS[choice];
  const lit = illumination?.enabled && ILLUMINATIONS_NEAR_VERMILLION.includes(illumination.colour);
  return RETICLE_OVERLAY_COLORS[lit ? 'blue' : 'vermillion'];
}

const RETICLE_OVERLAY_SHAPE_COOKIE_NAME = 'ballistics_range_solver_reticle_overlay_shape_v1';
const DEFAULT_RETICLE_OVERLAY_SHAPE = 'dots';

// How the scope view marks holds: 'dots' (the default) or 'hashes' —
// upright ticks for the BDC overlay's crosswind holds (the reference's
// longer and thicker) and a small upright cross for a hold point (the
// aiming mark's centre, each BDC mark's own).
export const RETICLE_OVERLAY_SHAPE_CHOICES = [
  { value: 'dots', labelKey: 'settings.reticleOverlayShapeDots' },
  { value: 'hashes', labelKey: 'settings.reticleOverlayShapeHashes' }
];

export function getReticleOverlayShape() {
  const raw = getCookie(RETICLE_OVERLAY_SHAPE_COOKIE_NAME);
  return RETICLE_OVERLAY_SHAPE_CHOICES.some((c) => c.value === raw) ? raw : DEFAULT_RETICLE_OVERLAY_SHAPE;
}

export function setReticleOverlayShape(value) {
  if (!RETICLE_OVERLAY_SHAPE_CHOICES.some((c) => c.value === value)) return;
  try {
    setCookie(RETICLE_OVERLAY_SHAPE_COOKIE_NAME, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

const BDC_RANGE_DISPLAY_COOKIE_NAME = 'ballistics_range_solver_bdc_range_display_v1';
const DEFAULT_BDC_RANGE_DISPLAY = 'callout';

// Where the scope view's BDC overlay prints each mark's range: 'callout'
// (the default — in a lane by the square's right edge, level with the
// mark, a leader joining the two), 'below' (under the mark's hold) or
// 'upwind' (beside the mark's hold, on the side the wind comes from — the
// right with no crosswind — the wind holds on that side hidden).
export const BDC_RANGE_DISPLAY_CHOICES = [
  { value: 'callout', labelKey: 'settings.bdcRangeDisplayCallout' },
  { value: 'below', labelKey: 'settings.bdcRangeDisplayBelow' },
  { value: 'upwind', labelKey: 'settings.bdcRangeDisplayUpwind' }
];

export function getBdcRangeDisplay() {
  const raw = getCookie(BDC_RANGE_DISPLAY_COOKIE_NAME);
  return BDC_RANGE_DISPLAY_CHOICES.some((c) => c.value === raw) ? raw : DEFAULT_BDC_RANGE_DISPLAY;
}

export function setBdcRangeDisplay(value) {
  if (!BDC_RANGE_DISPLAY_CHOICES.some((c) => c.value === value)) return;
  try {
    setCookie(BDC_RANGE_DISPLAY_COOKIE_NAME, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}
