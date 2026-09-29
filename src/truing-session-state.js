// Persisted in-progress state for the Truing Session tool: the wizard's
// phase, the persisted plan, the homework/equipment answers, the location
// intake (session-only target overrides, natural targets, the flat-range
// declaration, the re-check flag, the natural-target-gap answers), and the
// Shoot session itself (groups, chronograph readings, missed impacts,
// range re-checks, measured angles, an accepted muzzle-velocity-SD
// override).
//
// Deliberately NOT here: the engine's own computed results (always
// recomputed live rather than cached), and the active location/rifle/
// cartridge, which stay owned by range-solver-state.js and the existing
// rifle/cartridge state.
//
// Storage: localStorage, not a cookie -- a deliberate departure from the
// hit-probability-state.js pattern this module otherwise mirrors. This
// slice grows with every recorded group and chronograph reading; a
// realistic session (12 targets, 12 groups, 48 readings) measured ~4 KB
// URL-encoded, right at the per-cookie browser limit, past which a cookie
// write is silently dropped and a reload restores stale state. It also has
// no reason to travel to the server with every request. A state cookie
// left by an earlier version is migrated once and removed.
import { getCookie, removeCookie } from './cookies.js';

const STORAGE_KEY = 'ballistics_truing_session_state_v1';
const LEGACY_COOKIE_NAME = 'ballistics_truing_session_state_v1';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // unreadable or malformed -- fall through
  }
  try {
    const legacy = getCookie(LEGACY_COOKIE_NAME);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      removeCookie(LEGACY_COOKIE_NAME);
      try { localStorage.setItem(STORAGE_KEY, legacy); } catch { /* best-effort */ }
      return parsed;
    }
  } catch {
    // malformed legacy cookie -- ignore it
  }
  return null;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort -- storage full or unavailable isn't fatal
  }
}

let state = load();

export function loadTruingSessionState() {
  return state;
}

export function saveTruingSessionState(partial) {
  state = { ...state, ...partial };
  persist();
}

// Drops every listed key from the persisted slice -- "start a new
// session" clears the session-scoped state while keeping preferences such
// as the precision/SD preset picks and the backdrop height.
export function clearTruingSessionKeys(keys) {
  if (!state) return;
  const next = { ...state };
  for (const k of keys) delete next[k];
  state = next;
  persist();
}

export function resetTruingSessionStateForTests() {
  state = null;
}
