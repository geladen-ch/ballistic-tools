// Session-only (in-memory, not persisted across a reload) — up to two
// (rifleId, cartridgeId) pairs from the user's own Arsenal, marked on the
// Arsenal page for side-by-side trajectory comparison. Module-level
// singleton, the same pattern shot-state.js uses for the shot-setup
// inputs: the selection survives re-mounting the Arsenal view (navigating
// away and back within the same session) but resets on a full reload —
// there's no reason a comparison someone set up needs to outlive the tab.
const MAX_COMPARISON_SIZE = 2;

let selection = []; // [{ rifleId, cartridgeId }, ...], length 0-2

export function getComparisonSelection() {
  return [...selection];
}

export function isSelectedForComparison(rifleId, cartridgeId) {
  return selection.some((s) => s.rifleId === rifleId && s.cartridgeId === cartridgeId);
}

export function canAddToComparison() {
  return selection.length < MAX_COMPARISON_SIZE;
}

// Same rifle + cartridge can't be added twice (checked here, not just at
// the calling UI, so this stays correct even if a caller's own disabled-
// state check is ever out of sync); the same rifle with a *different*
// cartridge is a different pair and is always fine. Returns whether the
// add actually happened, so a caller can tell a genuine add apart from a
// no-op — though the UI is expected to disable the control first via
// canAddToComparison()/isSelectedForComparison() so this is normally just
// a defensive backstop.
export function addToComparison(rifleId, cartridgeId) {
  if (isSelectedForComparison(rifleId, cartridgeId) || !canAddToComparison()) return false;
  selection = [...selection, { rifleId, cartridgeId }];
  return true;
}

export function removeFromComparison(rifleId, cartridgeId) {
  selection = selection.filter((s) => !(s.rifleId === rifleId && s.cartridgeId === cartridgeId));
}

// Deleting a rifle outright (or a specific cartridge off of one) leaves
// any comparison entry pointing at it unresolvable — called from
// arsenal-view.js's own delete handlers so the selection never quietly
// goes stale.
export function removeRifleFromComparison(rifleId) {
  selection = selection.filter((s) => s.rifleId !== rifleId);
}

export function resetComparisonForTests() {
  selection = [];
}
