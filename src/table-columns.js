// Cookie-backed persistence for which trajectory-table columns are
// visible. Mirrors prefs.js's load/save shape but simpler — no
// cross-view subscribers, since only the Trajectory Table view reads
// this.
import { getCookie, setCookie } from './cookies.js';

const COOKIE_NAME = 'ballistics_trajectory_columns_v1';

function defaultsFrom(columns) {
  const d = {};
  for (const col of columns) d[col.id] = col.default;
  return d;
}

// `columns` is the view's column definition list ({id, default, ...}) —
// passed in rather than imported so this module has no knowledge of what
// a "column" actually is, just how to persist a visibility map for one.
export function loadColumnVisibility(columns) {
  const defaults = defaultsFrom(columns);
  try {
    const raw = getCookie(COOKIE_NAME);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // malformed cookie — fall through to defaults
  }
  return defaults;
}

export function saveColumnVisibility(visibility) {
  try {
    setCookie(COOKIE_NAME, JSON.stringify(visibility));
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}
