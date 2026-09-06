// Cookie-backed preference for the Hit Probability tool's own impact-dot
// color (src/views/hit-probability-view.js) — same shape as range-solver-
// prefs.js's THEME_CHOICES/getTheme/setTheme/onThemeChange.
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

export function resetImpactColorForTests() {
  impactColor = DEFAULT_IMPACT_COLOR;
}
