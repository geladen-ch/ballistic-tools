// Cross-cutting state for the "Range Solver" section (see range-solver-
// view.js): whether the app is currently inside it, and which of its
// three in-page input tabs (Target/Wind/Atmosphere) is active. Both
// ephemeral (page-lifetime only) — same shape as guns-nav.js's own
// isInGunsMode/onGunsModeChange pair, since this is architecturally the
// same "focused mode" idea, just with its own nav bar swapped in instead
// of Guns'.
//
// Unlike Guns' Custom/Arsenal (real routes — #/guns/custom, #/guns/
// arsenal), Target/Wind/Atmosphere are all the same /range-solver route;
// which one shows in the input pane is UI state, not URL state, so it has
// to live here rather than being derived from location.hash the way
// Guns-mode's own "current" highlighting is.
let inRangeSolverMode = false;
const modeListeners = new Set();

let activeTab = 'target';
const tabListeners = new Set();

export function isInRangeSolverMode() {
  return inRangeSolverMode;
}

// Called from range-solver-view.js's mount()/cleanup — nav-rail.js and
// nav-tabbar.js each subscribe (see onRangeSolverModeChange) to swap their
// own chrome for the Target/Wind/Atmosphere/Gun/Exit-solver control while
// this is true. Always resets the active tab back to Target on the way
// in — the section never remembers which tab was last open.
export function setRangeSolverMode(on) {
  if (inRangeSolverMode === on) return;
  inRangeSolverMode = on;
  if (on) activeTab = 'target';
  modeListeners.forEach((fn) => fn(inRangeSolverMode));
}

export function onRangeSolverModeChange(fn) {
  modeListeners.add(fn);
  return () => modeListeners.delete(fn);
}

export function getRangeSolverTab() {
  return activeTab;
}

// Called from the nav bar's Target/Wind/Atmosphere buttons — the view
// itself subscribes (see onRangeSolverTabChange) to swap its input pane.
export function setRangeSolverTab(tab) {
  if (activeTab === tab) return;
  activeTab = tab;
  tabListeners.forEach((fn) => fn(activeTab));
}

export function onRangeSolverTabChange(fn) {
  tabListeners.add(fn);
  return () => tabListeners.delete(fn);
}

export function resetRangeSolverNavForTests() {
  inRangeSolverMode = false;
  activeTab = 'target';
}
