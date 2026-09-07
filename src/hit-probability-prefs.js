// Cookie-backed preference for the app's impact-dot color (Settings ->
// "Impact color", see ui/impact-color-picker.js) — same shape as range-
// solver-prefs.js's THEME_CHOICES/getTheme/setTheme/onThemeChange.
//
// Named for Hit Probability because that's the tool it was introduced
// for, but the choice is app-wide: the Rifle Precision Calculator draws
// its own impacts (the live photo overlay, the group-overview PNG, the
// precision-report diagram and its SVG export) in the same color, with
// the same edge treatment defined below. The cookie name is likewise
// kept as-is so an existing pick survives — it's persisted state, not a
// description of scope.
import { getCookie, setCookie } from './cookies.js';

const IMPACT_COLOR_COOKIE_NAME = 'ballistics_hit_probability_impact_color_v1';
const DEFAULT_IMPACT_COLOR = 'berry';

// Order here is also the Settings impact-color-picker's own display order
// (see ui/impact-color-picker.js) — default first, matching every other
// CHOICES array in this codebase. Each hex was picked for contrast against
// the target catalog's own artwork (IPSC's tan, Killer Tubby's yellow/
// skin/brown, the solid-black poppers), not the app's theme, so a color
// choice never needs to react to a theme change — hit-probability-view.js
// always renders every one of them with the same dual white/dark edge,
// which is what actually carries the contrast on the hardest targets.
export const IMPACT_COLOR_CHOICES = [
  { value: 'berry', hex: '#8a0059' },
  { value: 'amber', hex: '#e8a33d' },
  { value: 'magenta', hex: '#ff2f92' },
  { value: 'red', hex: '#ff3b30' },
  { value: 'blue', hex: '#2979ff' }
];

function loadInitialImpactColor() {
  const raw = getCookie(IMPACT_COLOR_COOKIE_NAME);
  return IMPACT_COLOR_CHOICES.some((c) => c.value === raw) ? raw : DEFAULT_IMPACT_COLOR;
}

let impactColor = loadInitialImpactColor();
const impactColorListeners = new Set();

export function getImpactColor() {
  return impactColor;
}

export function getImpactColorHex(value = impactColor) {
  const choice = IMPACT_COLOR_CHOICES.find((c) => c.value === value);
  return choice ? choice.hex : IMPACT_COLOR_CHOICES[0].hex;
}

export function setImpactColor(next) {
  if (!IMPACT_COLOR_CHOICES.some((c) => c.value === next) || next === impactColor) return;
  impactColor = next;
  try {
    setCookie(IMPACT_COLOR_COOKIE_NAME, impactColor);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
  impactColorListeners.forEach((fn) => fn(impactColor));
}

export function onImpactColorChange(fn) {
  impactColorListeners.add(fn);
  return () => impactColorListeners.delete(fn);
}

// The dual white/dark edge every impact dot is drawn with, wherever one
// is drawn: a white ring immediately around the fill with a darker
// hairline outside it, so a dot's boundary stays visible however it
// lands — against a target's own artwork (Hit Probability), or against
// an arbitrary photo of a paper target (Rifle Precision). Both radii are
// ratios of the dot's own fill radius rather than fixed sizes, so the
// edge scales with the dot itself at any zoom, and neither reacts to the
// impact color or the theme: the edge is what carries the contrast, so
// it has to stay the same two colors regardless of both.
export const IMPACT_EDGE_WHITE_RATIO = 1.22;
export const IMPACT_EDGE_DARK_RATIO = 1.42;
export const IMPACT_EDGE_WHITE_COLOR = '#ffffff';
export const IMPACT_EDGE_DARK_COLOR = '#14171a';

export function resetImpactColorForTests() {
  impactColor = DEFAULT_IMPACT_COLOR;
}
