// Cross-cutting state for the Locations & Targets management section (see
// locations-view.js): whether the app is currently inside it. Same
// minimal shape as range-solver-nav.js's own mode flag — no return-path
// tracking needed, since Done always goes to a fixed destination (the
// Range Solver Target tab), same as Range Solver's own "Exit solver".
let inLocationsMode = false;
const listeners = new Set();

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
}
