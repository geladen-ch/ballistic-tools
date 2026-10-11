import { isInRangeSolverMode, getRangeSolverTab, setNextRangeSolverTab } from './range-solver-nav.js';

// Cross-cutting state for the Locations & Targets management section (see
// locations-view.js): whether the app is currently inside it. Same
// shape as range-solver-nav.js's own mode flag, plus a one-shot return
// path like guns-nav.js's: every entry point (Range Solver, the truing
// session) records where it was opened from so Done can send the user back
// there, falling back to the Range Solver when nothing was recorded.
let inLocationsMode = false;
const listeners = new Set();
let returnPath = null;
// The Range Solver's own in-page tab (Target/Range Card/Atmosphere) when
// Locations was opened from it, so Done lands back on that tab, not just
// on the section.
let returnRangeSolverTab = null;

const DEFAULT_RETURN_PATH = '/range-solver';

// Shared click handler for every "open Locations" entry point -- captures
// the current path to return to on Done, then jumps to Locations. Never
// called from inside Locations itself (its own sub-routes, like the photo
// placement, must not overwrite the original origin).
export function goToLocations() {
  returnPath = location.hash.slice(1) || DEFAULT_RETURN_PATH;
  returnRangeSolverTab = isInRangeSolverMode() ? getRangeSolverTab() : null;
  location.hash = '#/locations';
}

// "Take" rather than "read", so a later Done without a fresh entry in
// between doesn't replay a stale origin -- same as guns-nav.js's own take.
export function takeLocationsReturnPath(fallbackPath = DEFAULT_RETURN_PATH) {
  const path = returnPath || fallbackPath;
  returnPath = null;
  return path;
}

// Shared by both Done buttons (nav-rail.js/nav-tabbar.js).
export function requestLocationsDone() {
  if (returnRangeSolverTab) setNextRangeSolverTab(returnRangeSolverTab);
  returnRangeSolverTab = null;
  location.hash = '#' + takeLocationsReturnPath();
}

export function isInLocationsMode() {
  return inLocationsMode;
}

// Called from locations-view.js's mount()/cleanup — nav-rail.js and
// nav-tabbar.js each subscribe (see onLocationsModeChange) to swap their
// own chrome for the single Done control while this is true.
export function setLocationsMode(on) {
  if (inLocationsMode === on) return;
  inLocationsMode = on;
  listeners.forEach((fn) => fn(inLocationsMode));
}

export function onLocationsModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetLocationsNavForTests() {
  inLocationsMode = false;
  returnPath = null;
  returnRangeSolverTab = null;
}
