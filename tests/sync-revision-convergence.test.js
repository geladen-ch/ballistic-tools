// Integration-level regression test for the revision counter (Phase 4's
// optional Lamport-style ordering, docs/plans/backup-sync.md) — the one
// property no unit test of a single function can catch: does the whole
// system actually CONVERGE, or does it climb forever?
//
// The plan's own literal wording for a merge-applied write was "set to
// max(local.revision, remote.revision) + 1" — the textbook Lamport
// receive-rule. Implemented literally, it breaks under this app's actual
// topology: every device publishes its *complete* state every cycle and
// reads every peer's complete state every cycle (a full gossip exchange,
// not a one-way message hop), so an unchanged record keeps getting
// re-offered back and forth between every pair of devices forever. Each
// side "receiving" what it already effectively knows still bumps by the
// rule as written, so the revision on both sides climbs by one every
// single round-trip, without either side ever having made a new edit —
// which also defeats the dirty-flag gate (Phase 5), since the record
// keeps looking "overwritten" every cycle.
//
// The fix implemented instead (revision.js/user-library.js's own
// comments) is: a merge-applied write adopts the incoming revision
// verbatim (no bump), exactly like modifiedAt/modifiedBy already are;
// only a genuine LOCAL write (a real edit, made by a person, on this
// device) bumps. This test simulates the actual multi-cycle exchange the
// bug above depends on, and would fail on the literal "always +1" rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const userLib = await import('../src/user-library.js');
const bundleMod = await import('../src/sync/backup-bundle.js');
const manualSync = await import('../src/sync/manual-sync.js');

// Simulates two independently-persisted browser profiles by snapshotting/
// restoring the (localStorage-backed) bullet list and device id between
// "device" contexts.
const KEYS = ['ballistics_user_bullets_v1', 'ballistics_device_id_v1'];
function snapshotDevice() {
  const o = {};
  for (const k of KEYS) o[k] = localStorage.getItem(k);
  return o;
}
function restoreDevice(o) {
  localStorage.clear();
  for (const k of KEYS) if (o[k] != null) localStorage.setItem(k, o[k]);
}

function bulletRevision(bulletId) {
  const found = userLib.loadUserBullets().find((b) => b.id === bulletId);
  return found ? found.revision : undefined;
}

test('revision converges rather than climbing on repeated round trips of an unchanged record, then again after a real edit propagates', async () => {
  // ---- Device A: create a bullet (revision 1) ----
  localStorage.clear();
  localStorage.setItem('ballistics_device_id_v1', 'device-a');
  const bulletId = userLib.generateUserId('user-bullet');
  userLib.saveUserBullet({ id: bulletId, name: 'B', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  assert.equal(bulletRevision(bulletId), 1, 'a brand-new local edit is revision 1');
  let aBundleText = bundleMod.serializeBackupBundle(bundleMod.buildBackupBundle());
  let aState = snapshotDevice();

  // ---- Device B: fresh profile, imports A's bundle for the first time ----
  localStorage.clear();
  localStorage.setItem('ballistics_device_id_v1', 'device-b');
  await manualSync.importPeerBundleText(aBundleText);
  assert.equal(bulletRevision(bulletId), 1, 'first import adopts the remote revision verbatim — no bump for merely receiving it');
  let bBundleText = bundleMod.serializeBackupBundle(bundleMod.buildBackupBundle());
  let bState = snapshotDevice();

  // ---- Several full round trips with nothing ever actually edited ----
  // Each iteration: A imports B's (unchanged) bundle, then B imports A's
  // (unchanged) bundle. Under the buggy "always +1 on merge" rule this
  // climbs by one every iteration; under the fix, both sides stay at 1.
  for (let round = 0; round < 4; round++) {
    restoreDevice(aState);
    await manualSync.importPeerBundleText(bBundleText);
    assert.equal(bulletRevision(bulletId), 1, `A stays at revision 1 after round-trip ${round + 1} with nothing changed`);
    aBundleText = bundleMod.serializeBackupBundle(bundleMod.buildBackupBundle());
    aState = snapshotDevice();

    restoreDevice(bState);
    await manualSync.importPeerBundleText(aBundleText);
    assert.equal(bulletRevision(bulletId), 1, `B stays at revision 1 after round-trip ${round + 1} with nothing changed`);
    bBundleText = bundleMod.serializeBackupBundle(bundleMod.buildBackupBundle());
    bState = snapshotDevice();
  }

  // ---- Now B makes a real, local edit ----
  restoreDevice(bState);
  userLib.saveUserBullet({ id: bulletId, name: 'B renamed', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  assert.equal(bulletRevision(bulletId), 2, 'a real local edit bumps from whatever was already stored (1 -> 2)');
  bBundleText = bundleMod.serializeBackupBundle(bundleMod.buildBackupBundle());
  bState = snapshotDevice();

  // ---- A picks up B's edit: provably descends from A's own copy, wins outright ----
  restoreDevice(aState);
  await manualSync.importPeerBundleText(bBundleText);
  assert.equal(bulletRevision(bulletId), 2, 'A adopts B\'s edit verbatim (revision 2), not re-bumped to 3');
  assert.equal(userLib.loadUserBullets().find((b) => b.id === bulletId).name, 'B renamed');
  aBundleText = bundleMod.serializeBackupBundle(bundleMod.buildBackupBundle());
  aState = snapshotDevice();

  // ---- More round trips after the edit has propagated: still no further climb ----
  for (let round = 0; round < 4; round++) {
    restoreDevice(bState);
    await manualSync.importPeerBundleText(aBundleText);
    assert.equal(bulletRevision(bulletId), 2, `B stays at revision 2 after post-edit round-trip ${round + 1}`);
    bBundleText = bundleMod.serializeBackupBundle(bundleMod.buildBackupBundle());
    bState = snapshotDevice();

    restoreDevice(aState);
    await manualSync.importPeerBundleText(bBundleText);
    assert.equal(bulletRevision(bulletId), 2, `A stays at revision 2 after post-edit round-trip ${round + 1}`);
    aBundleText = bundleMod.serializeBackupBundle(bundleMod.buildBackupBundle());
    aState = snapshotDevice();
  }
});
