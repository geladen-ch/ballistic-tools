// Cross-cutting state for the "Guns" section (see guns-view.js): whether
// the app is currently inside it, and where "Done" should send the user
// back to. Both ephemeral (page-lifetime only, not persisted) — the
// return path specifically mirrors arsenal-prefill.js's one-shot handoff
// pattern, and is deliberately separate from that module since it's not a
// form prefill. Also home to the source-aware routing
// (resolveGunsDestination/goToGuns) shared by every plain "go to Guns"
// entry point and guns-summary.js's "Change" button, so they all land on
// the same sub-tab for the same rifle.
import { loadRifleState } from './shot-state.js';
import { loadUserRifles } from './user-library.js';

let inGunsMode = false;
const listeners = new Set();
let returnPath = null;

// Which Guns sub-tab a plain "go to Guns" entry point (the rail/tab bar's
// own Guns link) should land on — the exact same rule guns-summary.js's
// "Change" button uses: Arsenal if the currently active rifle is one of
// the user's own saved rifles, Custom otherwise (built-in library or a
// fully manual entry). Kept here rather than duplicated in nav-rail.js/
// nav-tabbar.js/guns-summary.js so all three navigate identically.
export function resolveGunsDestination() {
  const rifleState = loadRifleState();
  if (rifleState && rifleState.library) {
    const { rifleId } = rifleState.library;
    if (loadUserRifles().some((r) => r.id === rifleId)) return '/guns/arsenal';
  }
  return '/guns/custom';
}

// Shared click handler for every plain "go to Guns" entry point (nav-
// rail.js's and nav-tabbar.js's own Guns link, and home-view.js's pinned
// row) — captures the current path to return to on Done, then jumps
// straight to whichever sub-tab resolveGunsDestination() picks. Computed
// fresh at click time (not baked into a render-time href) so it's always
// accurate even if the active rifle changed since this nav item last
// re-rendered.
export function goToGuns() {
  setGunsReturnPath(location.hash.slice(1) || '/');
  location.hash = '#' + resolveGunsDestination();
}

export function isInGunsMode() {
  return inGunsMode;
}

// Called from guns-view.js's mount()/cleanup — nav-rail.js and
// nav-tabbar.js each subscribe (see onGunsModeChange) to swap their own
// chrome for the Done/Custom/Arsenal control while this is true.
export function setGunsMode(on) {
  if (inGunsMode === on) return;
  inGunsMode = on;
  listeners.forEach((fn) => fn(inGunsMode));
}

export function onGunsModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Captured by every "Change"/"Guns" entry point right before navigating
// into Guns — wherever the user currently is, so Done (or Arsenal's "Set
// active") can send them back there. Never called from *inside* Guns
// itself (switching between its own Custom/Arsenal tabs must not
// overwrite the original origin).
export function setGunsReturnPath(path) {
  returnPath = path;
}

// "Take" rather than "read", so a later Done click (without a fresh
// Change in between) doesn't replay a stale origin from three
// navigations ago — same reasoning as arsenal-prefill.js's own take*().
export function takeGunsReturnPath(fallbackPath) {
  const path = returnPath || fallbackPath;
  returnPath = null;
  return path;
}

// Lets the Arsenal tab stage an activation locally (see arsenal-view.js)
// and only commit it to shot-state.js's shared cookie once Done is
// actually pressed — same "registered handler the nav bar reaches into"
// shape as location-placement-nav.js's registerPlacementHandlers(), just
// for one handler instead of three. Registered from arsenal-view.js's
// mount() and unregistered on its own cleanup, so it's only ever set
// while the Arsenal sub-tab is the one currently mounted — Done on the
// Custom tab has nothing registered here and stays plain navigation,
// since Custom's own fields already save to shot-state.js live on every
// edit.
let arsenalDoneHandler = null;

export function registerArsenalDoneHandler(fn) {
  arsenalDoneHandler = fn;
  return () => { if (arsenalDoneHandler === fn) arsenalDoneHandler = null; };
}

// Shared by both Done buttons (nav-rail.js/nav-tabbar.js) — runs whatever
// Arsenal has staged (a no-op when nothing's registered) before handing
// off to takeGunsReturnPath() exactly as a plain Done click always has.
export function requestGunsDone(fallbackPath) {
  if (arsenalDoneHandler) arsenalDoneHandler();
  location.hash = '#' + takeGunsReturnPath(fallbackPath);
}

export function resetGunsNavForTests() {
  inGunsMode = false;
  returnPath = null;
  arsenalDoneHandler = null;
}
