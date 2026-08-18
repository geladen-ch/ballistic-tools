// One-shot handoff from a tool view's "Add to arsenal" button to the
// Arsenal view's "Add" form: the button stashes whatever's currently in
// the Trajectory Table's bullet/rifle inputs here and navigates to
// #/arsenal, whose mount() takes (reads-and-clears) it. "Take" rather
// than "load" deliberately, so a later plain visit to Arsenal (not via a
// button) doesn't re-apply a stale prefill from three navigations ago.
let pendingBullet = null;
let pendingRifle = null;

export function setPendingBulletPrefill(data) {
  pendingBullet = data;
}

export function takePendingBulletPrefill() {
  const data = pendingBullet;
  pendingBullet = null;
  return data;
}

export function setPendingRiflePrefill(data) {
  pendingRifle = data;
}

export function takePendingRiflePrefill() {
  const data = pendingRifle;
  pendingRifle = null;
  return data;
}
