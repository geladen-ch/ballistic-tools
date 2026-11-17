// Settings of the online weather services (Settings → Online weather services): whether the feature is on, how far
// to look for stations, how old a report may be, the two estimation switches and one mode per service. Cookie-backed
// like the other prefs modules, held in SI (metres, seconds) like everything else. The feature is off until the user
// turns it on: with it off the app contacts no weather service.
import { getCookie, setCookie } from './cookies.js';
import { FIELD_BOUNDS } from './units.js';
import { kmToM, minToS } from './quantity.js';

const COOKIE_NAME = 'ballistics_online_weather_v1';

/** Defaults of the settings (the proof of concept's: 150 km, 90 min, both estimation switches on). */
export const ONLINE_WEATHER_DEFAULTS = Object.freeze({
  enabled: false,
  searchRadiusM: kmToM(150),
  maxAgeS: minToS(90),
  combine: true,
  timeCorrect: true,
  sources: Object.freeze({})
});

const clamp = (v, { min, max }, fallback) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

// One stored value → a valid setting; anything unreadable falls back to its default.
function sanitise(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const sources = {};
  for (const [id, mode] of Object.entries(r.sources && typeof r.sources === 'object' ? r.sources : {})) {
    if (mode === 'auto' || mode === 'off') sources[id] = mode;
  }
  return {
    enabled: r.enabled === true,
    searchRadiusM: clamp(r.searchRadiusM, FIELD_BOUNDS.weatherSearchRadius, ONLINE_WEATHER_DEFAULTS.searchRadiusM),
    maxAgeS: clamp(r.maxAgeS, FIELD_BOUNDS.weatherMaxAge, ONLINE_WEATHER_DEFAULTS.maxAgeS),
    combine: typeof r.combine === 'boolean' ? r.combine : ONLINE_WEATHER_DEFAULTS.combine,
    timeCorrect: typeof r.timeCorrect === 'boolean' ? r.timeCorrect : ONLINE_WEATHER_DEFAULTS.timeCorrect,
    sources
  };
}

function load() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (raw) return sanitise(JSON.parse(raw));
  } catch {
    // malformed cookie value, or cookies disabled — defaults
  }
  return sanitise(null);
}

let settings = load();
const listeners = new Set();

function commit(next) {
  settings = next;
  try {
    setCookie(COOKIE_NAME, JSON.stringify(settings));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
  listeners.forEach((fn) => fn(getOnlineWeatherSettings()));
}

/** A copy of the current settings. */
export function getOnlineWeatherSettings() {
  return { ...settings, sources: { ...settings.sources } };
}

export function isOnlineWeatherEnabled() {
  return settings.enabled;
}

/** Change any of enabled, searchRadiusM, maxAgeS, combine, timeCorrect (values are validated and clamped). */
export function updateOnlineWeatherSettings(patch) {
  const { sources, ...rest } = patch;
  commit(sanitise({ ...settings, ...rest, sources: sources ?? settings.sources }));
}

/**
 * Set one service's mode. A mode equal to the service's default is not stored, so a later change of default reaches
 * users who never touched it.
 * @param {'auto'|'off'} defaultMode  the mode the service has without a choice
 */
export function setServiceMode(id, mode, defaultMode) {
  const sources = { ...settings.sources };
  if (mode === defaultMode || (mode !== 'auto' && mode !== 'off')) delete sources[id];
  else sources[id] = mode;
  commit({ ...settings, sources });
}

/** Subscribe to every change; returns the unsubscribe function. */
export function onOnlineWeatherChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- test-only ----
/** Re-read the stored value (after a test changed the cookie). */
export function reloadOnlineWeatherPrefsForTests() {
  settings = load();
}
