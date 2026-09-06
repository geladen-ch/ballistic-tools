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

// One-shot handoff from the Rifle Precision project list's own "Set as
// cartridge precision…" picker (rifle-cartridge-picker.js) to Arsenal's
// cartridge edit form: `{ rifleId, cartridgeId, precisionR50Mrad }` names
// an *existing* rifle+cartridge to jump straight into editing, with its
// precision field pre-filled from the chosen project — unlike
// pendingBullet/pendingRifle above, which prefill a brand-new-or-matching
// entry's whole form, this only ever overrides one field of one already-
// existing cartridge.
let pendingCartridgeActivation = null;

export function setPendingCartridgeActivation(data) {
  pendingCartridgeActivation = data;
}

export function takePendingCartridgeActivation() {
  const data = pendingCartridgeActivation;
  pendingCartridgeActivation = null;
  return data;
}
