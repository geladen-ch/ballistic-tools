// Persisted rail state — whether it's collapsed to icons-only, and which
// of its two groups are expanded — cookie-backed like prefs.js/library-
// prefs.js, so "the choice sticks" across reloads. Read once at module
// load and kept in memory after that, the same pattern those modules use.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_nav_prefs_v1';

function load() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (raw) return JSON.parse(raw);
  } catch {
    // malformed cookie — fall through to defaults
  }
  return {};
}

function save() {
  try {
    setCookie(COOKIE_NAME, JSON.stringify(prefs));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

let prefs = load();

export function isRailCollapsed() {
  return !!prefs.collapsed;
}

export function setRailCollapsed(collapsed) {
  prefs = { ...prefs, collapsed };
  save();
}

// Both groups default to expanded — collapsing one is a choice a user
// makes, not a starting assumption.
export function isGroupOpen(groupId) {
  return !(prefs.groups && prefs.groups[groupId] === false);
}

export function setGroupOpen(groupId, open) {
  prefs = { ...prefs, groups: { ...prefs.groups, [groupId]: open } };
  save();
}

export function resetNavPrefsForTests() {
  prefs = {};
}
