// Cross-cutting state for the "Range Solver" section (see range-solver-
// view.js): whether the app is currently inside it, and which of its two
// panes (Fire!, Atmosphere) shows. Both ephemeral (page-lifetime only) —
// same shape as guns-nav.js's own isInGunsMode/onGunsModeChange pair,
// since this is architecturally the same "focused mode" idea, just with
// its own nav bar swapped in instead of Guns'.
//
// Unlike Guns' Custom/Arsenal (real routes — #/guns/custom, #/guns/
// arsenal), the two panes are the same /range-solver route; which one
// shows is UI state, not URL state, so it has to live here rather than
// being derived from location.hash.
export const RANGE_SOLVER_TABS = Object.freeze(['fire', 'atmosphere']);
const DEFAULT_TAB = 'fire';

let inRangeSolverMode = false;
const modeListeners = new Set();

let activeTab = DEFAULT_TAB;
const tabListeners = new Set();
// A one-shot tab for the next entry into the section, so a round trip to
// another screen (Locations' Done) can land back on the tab it left from.
let nextEntryTab = null;

// Anything unknown (including the Target/Range Card tabs of earlier
// builds) means the Fire! pane.
const knownTab = (tab) => (RANGE_SOLVER_TABS.includes(tab) ? tab : DEFAULT_TAB);

export function isInRangeSolverMode() {
  return inRangeSolverMode;
}

// Called from range-solver-view.js's mount()/cleanup — nav-rail.js and
// nav-tabbar.js each subscribe (see onRangeSolverModeChange) to swap their
// own chrome for the solver's nav while this is true. Resets the active
// pane back to Fire! on the way in — the section never remembers which
// pane was last open — unless setNextRangeSolverTab() asked for a
// specific one for this entry. Mode listeners run after the reset, so
// they can read the entry tab through getRangeSolverTab(); tab listeners
// are not notified of it.
export function setRangeSolverMode(on) {
  if (inRangeSolverMode === on) return;
  inRangeSolverMode = on;
  if (on) {
    activeTab = knownTab(nextEntryTab);
    nextEntryTab = null;
  }
  modeListeners.forEach((fn) => fn(inRangeSolverMode));
}

// Consumed by the very next entry into the section (see
// setRangeSolverMode), then forgotten.
export function setNextRangeSolverTab(tab) {
  nextEntryTab = knownTab(tab);
}

export function onRangeSolverModeChange(fn) {
  modeListeners.add(fn);
  return () => modeListeners.delete(fn);
}

export function getRangeSolverTab() {
  return activeTab;
}

// Called from the nav bar's Fire!/Atmosphere buttons (and the Layout
// dialog's OK) — the view itself subscribes (see onRangeSolverTabChange)
// to swap its pane.
export function setRangeSolverTab(tab) {
  const next = knownTab(tab);
  if (activeTab === next) return;
  activeTab = next;
  tabListeners.forEach((fn) => fn(activeTab));
}

export function onRangeSolverTabChange(fn) {
  tabListeners.add(fn);
  return () => tabListeners.delete(fn);
}

export function resetRangeSolverNavForTests() {
  inRangeSolverMode = false;
  activeTab = DEFAULT_TAB;
  nextEntryTab = null;
}
