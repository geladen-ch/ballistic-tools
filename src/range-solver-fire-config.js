// Which optional elements the Range Solver's Fire! pane shows, and the
// pane's two other options (the targets list's Optimal fit, ignoring
// line-of-sight angles). Edited only through the pane's Layout dialog
// (ui/range-solver/fire-config-dialog.js).
//
// The scope view keeps its own older cookie (range-solver-prefs.js's
// isScopeViewOn), so someone who had it on keeps it; everything else lives
// in one JSON cookie. The targets list's fixed row count keeps its own
// module and cookie too (range-card-row-count-prefs.js), but reads and
// writes go through here as `listRows`, so one listener covers every
// change the Layout dialog makes.
import { loadVersionedCookie, saveCookieState } from './versioned-cookie.js';
import { isScopeViewOn, setScopeViewOn } from './range-solver-prefs.js';
import { getRangeCardRowCount, setRangeCardRowCount } from './range-card-row-count-prefs.js';

const COOKIE_NAME = 'ballistics_range_solver_fire_config_v1';

export const FIRE_CONFIG_DEFAULTS = Object.freeze({
  readout: true, list: true, picker: true, listRowsOptimal: true, ignoreLos: false
});
const COOKIE_KEYS = Object.keys(FIRE_CONFIG_DEFAULTS);

const listeners = new Set();

function readCookie() {
  const stored = loadVersionedCookie({ name: COOKIE_NAME, legacyName: null, fromLegacy: null });
  const valid = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  const config = {};
  for (const key of COOKIE_KEYS) config[key] = typeof valid[key] === 'boolean' ? valid[key] : FIRE_CONFIG_DEFAULTS[key];
  return config;
}

// { scope, readout, list, picker, listRowsOptimal, ignoreLos } (booleans)
// and listRows (3..12).
export function getFireConfig() {
  return { scope: isScopeViewOn(), ...readCookie(), listRows: getRangeCardRowCount() };
}

// Merges `patch` (any subset of the fields above; wrongly typed values ignored)
// into the stored configuration and notifies listeners once if anything
// changed.
export function setFireConfig(patch) {
  const before = getFireConfig();
  if (typeof patch.scope === 'boolean' && patch.scope !== before.scope) setScopeViewOn(patch.scope);
  if (Number.isFinite(patch.listRows) && patch.listRows !== before.listRows) setRangeCardRowCount(patch.listRows);
  const next = readCookie();
  for (const key of COOKIE_KEYS) if (typeof patch[key] === 'boolean') next[key] = patch[key];
  saveCookieState(COOKIE_NAME, next);
  const after = getFireConfig();
  if (Object.keys(after).some((key) => after[key] !== before[key])) listeners.forEach((fn) => fn(after));
}

export function onFireConfigChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetFireConfigForTests() {
  listeners.clear();
}
