// Cookie-backed preference for the wind-direction dial's visual skin (see
// Settings, and src/ui/wind-direction-dial.js) — "clock" labels 12/3/6/9
// and weights the full/half-value ticks the way shooters already call
// wind; "clean" keeps the same 15deg grid with every label stripped. Its
// own tiny module rather than folded into prefs.js since this isn't a
// unit preference and doesn't need that module's per-group defaulting
// machinery — same shape as csv-prefs.js.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_wind_dial_appearance_v1';
const DEFAULT_APPEARANCE = 'clock';

export const WIND_DIAL_APPEARANCE_CHOICES = [
  { value: 'clock', labelKey: 'settings.windDialAppearanceClock' },
  { value: 'clean', labelKey: 'settings.windDialAppearanceClean' }
];

export function getWindDialAppearance() {
  const raw = getCookie(COOKIE_NAME);
  if (raw !== null && WIND_DIAL_APPEARANCE_CHOICES.some((c) => c.value === raw)) return raw;
  return DEFAULT_APPEARANCE;
}

export function setWindDialAppearance(value) {
  try {
    setCookie(COOKIE_NAME, value);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}
