// Cross-cutting state for the full-screen target-placement/picker route
// (see location-placement-view.js): the "focused mode" flag nav-rail.js/
// nav-tabbar.js swap chrome on (same shape as guns-nav.js/range-solver-
// nav.js), a one-shot handoff into the view (exact shape of arsenal-
// prefill.js's setPendingXPrefill/takePendingXPrefill), and a registered-
// handler slot the nav bar's Zoom/Done buttons use to reach into whichever
// view instance is currently mounted — needed because, unlike Guns/Range
// Solver's own tabs (persistent state the view just reads), Zoom and Done
// here are one-off imperative actions the nav chrome can't drive by
// itself.
let inPlacementMode = false;
const listeners = new Set();
let returnPath = '/locations';

export function isInPlacementMode() {
  return inPlacementMode;
}

// `returnPath` is captured alongside the mode flag itself (not a separate
// setter) — there's never a moment where one is meaningful without the
// other.
export function setPlacementMode(on, path) {
  if (on) returnPath = path;
  if (inPlacementMode === on) return;
  inPlacementMode = on;
  listeners.forEach((fn) => fn(inPlacementMode));
}

export function onPlacementModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPlacementReturnPath() {
  return returnPath;
}

// locationId: the location being placed on/browsed. targetId: the one
// target being placed (placement mode) or null (select mode — any placed
// target can be tapped). selectMode distinguishes the two interaction
// styles location-placement-view.js offers over the same photo chrome.
let pending = null;

export function setPendingPlacement(data) {
  pending = data;
}

// "Take" rather than "read" — same reasoning as arsenal-prefill.js's own
// take*(): a later direct/refresh visit to the route (no fresh handoff in
// between) must not replay a stale placement from three navigations ago.
export function takePendingPlacement() {
  const data = pending;
  pending = null;
  return data;
}

let activeHandlers = null;

// Called from location-placement-view.js's mount() — returns an
// unregister function for its own cleanup. Only one placement view is
// ever mounted at a time, so this is a single slot, not a Set of
// subscribers like onPlacementModeChange above.
export function registerPlacementHandlers(handlers) {
  activeHandlers = handlers;
  return () => {
    if (activeHandlers === handlers) activeHandlers = null;
  };
}

export function requestZoomIn() {
  activeHandlers?.onZoomIn?.();
}

export function requestZoomOut() {
  activeHandlers?.onZoomOut?.();
}

// Lets a placement-mode view commit (see its own onDone) before the nav
// bar navigates away — select mode's onDone is a no-op, so this is a
// plain "go back" there.
export function requestDone() {
  activeHandlers?.onDone?.();
  location.hash = '#' + returnPath;
}

export function resetLocationPlacementNavForTests() {
  inPlacementMode = false;
  returnPath = '/locations';
  pending = null;
  activeHandlers = null;
}
