// Persisted per-group unit preferences, saved to a cookie so they survive
// across sessions. Each tool view is re-mounted fresh on every route
// change, so views just read the current preference at mount time — no
// live-reactivity plumbing needed for the common case of "change a unit
// in Settings, then navigate to a tool."
import { UNIT_GROUPS } from './units.js';
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_unit_prefs_v1';
// Prior to cookie-based persistence, prefs lived under this localStorage
// key — read once as a fallback so upgrading doesn't silently reset
// anyone's existing choices back to metric.
const LEGACY_STORAGE_KEY = 'ballistics-tools:unit-prefs:v1';

function defaults() {
  const d = {};
  for (const [key, group] of Object.entries(UNIT_GROUPS)) d[key] = group.defaultUnit;
  return d;
}

function save(prefs) {
  try {
    setCookie(COOKIE_NAME, JSON.stringify(prefs));
  } catch {
    // best-effort — losing persistence isn't fatal, the app still works
  }
}

function load() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    // malformed cookie value — fall through to the legacy source/defaults
  }
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const migrated = { ...defaults(), ...JSON.parse(legacy) };
      save(migrated); // carry the existing choice forward into the cookie
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migrated;
    }
  } catch {
    // cookies/storage disabled entirely (e.g. locked-down private
    // browsing) — fall through to defaults
  }
  return defaults();
}

let prefs = load();
const listeners = new Set();

export function getUnit(group) {
  return prefs[group];
}

export function getAllUnits() {
  return { ...prefs };
}

export function setUnit(group, unit) {
  prefs = { ...prefs, [group]: unit };
  save(prefs);
  listeners.forEach((fn) => fn(prefs));
}

export function resetUnits() {
  prefs = defaults();
  save(prefs);
  listeners.forEach((fn) => fn(prefs));
}

export function onUnitsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
