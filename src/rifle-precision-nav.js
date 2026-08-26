// Cross-cutting state for the Rifle Precision Calculator, mirroring
// location-placement-nav.js's shape (not importing from it — a different
// domain, see rifle-precision-marking-view.js's own module comment for
// why its state machine differs from location-placement-view.js's):
//   - the "focused mode" flag nav-rail.js/nav-tabbar.js swap chrome on
//     while the full-screen marking route is open,
//   - a one-shot handoff into the marking view (exact shape of
//     location-placement-nav.js's setPendingPlacement/takePendingPlacement),
//     since the hash router has no query params,
//   - a registered-handler slot the nav bar's Zoom/Done buttons use to
//     reach into whichever marking view instance is currently mounted,
//   - and the "currently open project" id — a pointer, not a snapshot, so
//     the list view, the marking view, and the analysis view (built
//     separately) can all agree on which project is open without a URL
//     param of their own. Cookie-backed (same one-cookie-per-slice idiom
//     as range-solver-state.js's own saveRangeSolverLocationState) so it
//     survives navigation *and* an app restart — unlike the rest of the
//     state in this module, which is deliberately session-only.
import { getCookie, setCookie, removeCookie } from './cookies.js';

const ACTIVE_PROJECT_COOKIE = 'ballistics_rifle_precision_active_project_v1';

let inMarkingMode = false;
const listeners = new Set();

export function isInMarkingMode() {
  return inMarkingMode;
}

export function setMarkingMode(on) {
  if (inMarkingMode === on) return;
  inMarkingMode = on;
  listeners.forEach((fn) => fn(inMarkingMode));
}

export function onMarkingModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// projectId/targetId: which target, within which project, the marking
// view should open on next mount.
let pending = null;

export function setPendingMarking(data) {
  pending = data;
}

// "Take" rather than "read" — same reasoning as location-placement-nav.js's
// own takePendingPlacement(): a later direct/refresh visit to the route
// (no fresh handoff in between) must not replay a stale target from three
// navigations ago.
export function takePendingMarking() {
  const data = pending;
  pending = null;
  return data;
}

let activeHandlers = null;

// Called from rifle-precision-marking-view.js's mount() — returns an
// unregister function for its own cleanup. Only one marking view is ever
// mounted at a time, so this is a single slot, not a Set of subscribers
// like onMarkingModeChange above.
export function registerMarkingHandlers(handlers) {
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

// Unlike location-placement-nav.js's own requestDone(), Done here always
// returns to the same fixed route (the marking view has no separate
// "return path" concept — it's only ever reached from the project list)
// and everything is already persisted incrementally on every mutation
// (see the marking view's own module comment), so there's nothing left to
// commit on the way out; onDone is still offered for symmetry and in case
// a future step needs one (e.g. flushing a saved-viewport map entry).
export function requestDone() {
  activeHandlers?.onDone?.();
  location.hash = '#/rifle-precision';
}

// Read once at module load, same as range-solver-state.js's own `state` —
// a stale/deleted project id is simply not found by whichever view
// resolves it (findRiflePrecisionProjectById), same as a stale
// Range Solver location pointer.
function loadPersistedActiveProjectId() {
  try {
    return getCookie(ACTIVE_PROJECT_COOKIE) || null;
  } catch {
    return null; // cookies unavailable — fall back to session-only
  }
}

let activeProjectId = loadPersistedActiveProjectId();

export function getActiveProjectId() {
  return activeProjectId;
}

export function setActiveProjectId(id) {
  activeProjectId = id;
  try {
    if (id) setCookie(ACTIVE_PROJECT_COOKIE, id);
    else removeCookie(ACTIVE_PROJECT_COOKIE);
  } catch {
    // best-effort — losing persistence isn't fatal
  }
}

export function resetRiflePrecisionNavForTests() {
  inMarkingMode = false;
  pending = null;
  activeHandlers = null;
  activeProjectId = null;
}
