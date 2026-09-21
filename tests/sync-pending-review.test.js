import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const {
  addPendingReview, listPendingReviews, getPendingReviewCount, clearPendingReview,
  markPendingReviewResolved, reopenPendingReview, expireStaleReviewsForPeer,
  resetPendingReviewForTests, reloadPendingReviewForTests, flushPendingReviewWritesForTests,
  markPendingReviewResolvedAtForTests, setPendingReviewSeenAtForTests, getPendingReviewEntryForTests
} = await import('../src/sync/pending-review.js');
const { notifyLibraryWrite } = await import('../src/sync/write-hooks.js');

test.beforeEach(async () => { await resetPendingReviewForTests(); });

test('starts empty', () => {
  assert.deepEqual(listPendingReviews(), []);
  assert.equal(getPendingReviewCount(), 0);
});

test('addPendingReview adds an entry keyed by recordType:recordId', () => {
  const entry = addPendingReview({
    recordType: 'bullet', recordId: 'b1', reason: 'same-timestamp-diverged-content',
    peerDeviceId: 'dev-2', remoteVersion: { id: 'b1', name: 'Remote Name' }
  });
  assert.equal(entry.id, 'bullet:b1');
  assert.ok(typeof entry.seenAt === 'string');

  const listed = listPendingReviews();
  assert.equal(listed.length, 1);
  assert.equal(getPendingReviewCount(), 1);
  assert.deepEqual(listed[0].remoteVersion, { id: 'b1', name: 'Remote Name' });
});

test('addPendingReview for the same record replaces the previous entry rather than duplicating', () => {
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: {} });
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'same-timestamp-diverged-content', peerDeviceId: 'dev-3', remoteVersion: {} });

  assert.equal(getPendingReviewCount(), 1);
  assert.equal(listPendingReviews()[0].reason, 'same-timestamp-diverged-content');
  assert.equal(listPendingReviews()[0].peerDeviceId, 'dev-3');
});

test('two different record types with the same recordId do not collide', () => {
  addPendingReview({ recordType: 'bullet', recordId: 'x1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: {} });
  addPendingReview({ recordType: 'location', recordId: 'x1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: {} });
  assert.equal(getPendingReviewCount(), 2);
});

test('clearPendingReview removes exactly the matching entry', () => {
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: {} });
  addPendingReview({ recordType: 'bullet', recordId: 'b2', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: {} });
  clearPendingReview('bullet', 'b1');

  assert.equal(getPendingReviewCount(), 1);
  assert.equal(listPendingReviews()[0].recordId, 'b2');
});

test('clearing a non-existent entry is a no-op', () => {
  clearPendingReview('bullet', 'nope');
  assert.equal(getPendingReviewCount(), 0);
});

test('entries survive a reload (IndexedDB round-trip)', async () => {
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: { id: 'b1' } });
  await flushPendingReviewWritesForTests();
  await reloadPendingReviewForTests();
  assert.equal(getPendingReviewCount(), 1);
  assert.equal(listPendingReviews()[0].recordId, 'b1');
});

test('a library write for that record retires its outstanding conflict', () => {
  // Any write settles the conflict: the record has moved on, and a stale
  // competing version from before that move is no longer worth asking
  // about. Covers a local edit, a local delete, and a merge-applied
  // overwrite alike — they all go through the same hook.
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: { id: 'b1', name: 'R' } });
  addPendingReview({ recordType: 'bullet', recordId: 'b2', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: { id: 'b2', name: 'R' } });

  notifyLibraryWrite({ recordType: 'bullet', record: { id: 'b1', name: 'edited' }, previous: null });

  assert.equal(getPendingReviewCount(), 1);
  assert.equal(listPendingReviews()[0].recordId, 'b2');
});

test('a resolved conflict is not re-raised by the same unchanged remote version', () => {
  // The failure this prevents: with reason 'unresolvable-timestamp',
  // resolving restamps only the *local* side, while compareTimestamps()
  // reports 'unknown' whenever *either* side is unparseable. The peer's
  // record never changes, so without a suppression marker the identical
  // conflict comes back on every single cycle, forever, with nothing the
  // user could ever do about it.
  const remoteVersion = { id: 'b1', name: 'Theirs' };
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion });

  // The resolving write clears the entry via the hook; the UI then records
  // what was decided, in that order.
  notifyLibraryWrite({ recordType: 'bullet', record: { id: 'b1', name: 'Mine' }, previous: null });
  markPendingReviewResolved('bullet', 'b1', remoteVersion);
  assert.equal(getPendingReviewCount(), 0);

  // Next cycle re-offers the identical conflict.
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: { id: 'b1', name: 'Theirs' } });
  assert.equal(getPendingReviewCount(), 0, 'stays suppressed');
});

test('reopenPendingReview brings back a resolved conflict as outstanding, unlike addPendingReview', () => {
  // This is exactly the scenario addPendingReview's own suppression marker
  // exists to prevent for a real peer — the identical remoteVersion coming
  // straight back — which is exactly what a "Cancel" of that resolution
  // (backup-sync-settings.js) needs to happen anyway: it isn't a peer
  // re-offering anything, it's the same device undoing its own decision.
  const remoteVersion = { id: 'b1', name: 'Theirs' };
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion });
  notifyLibraryWrite({ recordType: 'bullet', record: { id: 'b1', name: 'Mine' }, previous: null });
  markPendingReviewResolved('bullet', 'b1', remoteVersion);
  assert.equal(getPendingReviewCount(), 0);

  // addPendingReview alone stays suppressed (covered by the test above) —
  // reopenPendingReview must not.
  reopenPendingReview('bullet', 'b1', { reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion });
  assert.equal(getPendingReviewCount(), 1);
  assert.equal(listPendingReviews()[0].remoteVersion.name, 'Theirs');
  assert.equal(listPendingReviews()[0].peerDeviceId, 'dev-2');
});

test('reopenPendingReview survives a reload, like any other outstanding entry', async () => {
  const remoteVersion = { id: 'b1', name: 'Theirs' };
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion });
  markPendingReviewResolved('bullet', 'b1', remoteVersion);
  reopenPendingReview('bullet', 'b1', { reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion });

  await flushPendingReviewWritesForTests();
  await reloadPendingReviewForTests();
  assert.equal(getPendingReviewCount(), 1);
});

test('a genuinely new version from the peer does re-raise a previously resolved conflict', () => {
  const remoteVersion = { id: 'b1', name: 'Theirs' };
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion });
  notifyLibraryWrite({ recordType: 'bullet', record: { id: 'b1', name: 'Mine' }, previous: null });
  markPendingReviewResolved('bullet', 'b1', remoteVersion);

  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: { id: 'b1', name: 'Theirs, revised' } });
  assert.equal(getPendingReviewCount(), 1);
  assert.equal(listPendingReviews()[0].remoteVersion.name, 'Theirs, revised');
});

test('the suppression marker ignores the local-only `unsaved` flag, like every other comparison here', () => {
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: { id: 'b1', name: 'Theirs' } });
  markPendingReviewResolved('bullet', 'b1', { id: 'b1', name: 'Theirs' });
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: { id: 'b1', name: 'Theirs', unsaved: true } });
  assert.equal(getPendingReviewCount(), 0);
});

test('a resolved marker survives a reload without reappearing as an outstanding item', async () => {
  const remoteVersion = { id: 'b1', name: 'Theirs' };
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion });
  notifyLibraryWrite({ recordType: 'bullet', record: { id: 'b1', name: 'Mine' }, previous: null });
  markPendingReviewResolved('bullet', 'b1', remoteVersion);

  await flushPendingReviewWritesForTests();
  await reloadPendingReviewForTests();

  assert.equal(getPendingReviewCount(), 0);
  addPendingReview({ recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp', peerDeviceId: 'dev-2', remoteVersion: { id: 'b1', name: 'Theirs' } });
  assert.equal(getPendingReviewCount(), 0, 'suppression survived the reload too');
});

test('regression: expireStaleReviewsForPeer clears a conflict once its peer stops offering that record at all', () => {
  // The gap this closes: a conflict's recordId can stop appearing in the
  // attributed peer's bundle entirely (that peer deleted it and its
  // tombstone later aged out before this device ever saw it, or — the
  // real-world case that surfaced this — the entry is simply stale from
  // an earlier point in testing and nothing has offered that id since).
  // Neither clearPendingReview's write-trigger nor mergeRecords'
  // resolvedIds ever fire for an id that never appears in a remote list
  // again, so without this the entry sits there forever.
  addPendingReview({ recordType: 'rifle-precision-project', recordId: 'p1', reason: 'same-timestamp-diverged-content', peerDeviceId: 'peer-1', remoteVersion: { id: 'p1', name: 'Ghost Project' } });
  addPendingReview({ recordType: 'rifle-precision-project', recordId: 'p2', reason: 'same-timestamp-diverged-content', peerDeviceId: 'peer-1', remoteVersion: { id: 'p2', name: 'Still There' } });

  // peer-1's current bundle only mentions p2 now — p1 has aged out of it entirely.
  expireStaleReviewsForPeer('rifle-precision-project', 'peer-1', ['p2']);

  assert.equal(getPendingReviewCount(), 1);
  assert.equal(listPendingReviews()[0].recordId, 'p2');
});

test('expireStaleReviewsForPeer only touches entries attributed to the given peer', () => {
  addPendingReview({ recordType: 'rifle-precision-project', recordId: 'p1', reason: 'same-timestamp-diverged-content', peerDeviceId: 'peer-1', remoteVersion: { id: 'p1', name: 'A' } });
  addPendingReview({ recordType: 'rifle-precision-project', recordId: 'p2', reason: 'same-timestamp-diverged-content', peerDeviceId: 'peer-2', remoteVersion: { id: 'p2', name: 'B' } });

  // A cycle that only reads peer-2's file, which no longer mentions p2,
  // must not touch peer-1's still-outstanding conflict.
  expireStaleReviewsForPeer('rifle-precision-project', 'peer-2', []);

  assert.equal(getPendingReviewCount(), 1);
  assert.equal(listPendingReviews()[0].recordId, 'p1');
});

test('expireStaleReviewsForPeer only touches entries of the given record type', () => {
  addPendingReview({ recordType: 'rifle-precision-project', recordId: 'shared-id', reason: 'same-timestamp-diverged-content', peerDeviceId: 'peer-1', remoteVersion: { id: 'shared-id', name: 'A' } });
  addPendingReview({ recordType: 'rifle', recordId: 'shared-id', reason: 'same-timestamp-diverged-content', peerDeviceId: 'peer-1', remoteVersion: { id: 'shared-id', name: 'B' } });

  // peer-1's rifle-precision-project bundle no longer mentions shared-id,
  // but this call is scoped to that record type only — the rifle entry
  // (a different type, same id) must survive.
  expireStaleReviewsForPeer('rifle-precision-project', 'peer-1', []);

  assert.equal(getPendingReviewCount(), 1);
  assert.equal(listPendingReviews()[0].recordType, 'rifle');
});

test('expireStaleReviewsForPeer leaves a resolved suppression marker alone', () => {
  const remoteVersion = { id: 'p1', name: 'A' };
  addPendingReview({ recordType: 'rifle-precision-project', recordId: 'p1', reason: 'same-timestamp-diverged-content', peerDeviceId: 'peer-1', remoteVersion });
  markPendingReviewResolved('rifle-precision-project', 'p1', remoteVersion);
  assert.equal(getPendingReviewCount(), 0);

  // Nothing outstanding to expire — this must not throw or misbehave on
  // a resolved (not outstanding) entry.
  expireStaleReviewsForPeer('rifle-precision-project', 'peer-1', []);
  assert.equal(getPendingReviewCount(), 0);
});

// ---- docs/plans/orphaned-storage-cleanup.md phase 3 ----

test('a resolved marker older than the retention window is swept at init', async () => {
  markPendingReviewResolved('bullet', 'old', { id: 'old', name: 'Theirs' });
  await flushPendingReviewWritesForTests();

  // Age it past the window by rewriting the marker directly, then reload:
  // the sweep runs at init, which is the whole point — it must catch
  // entries written by earlier sessions, not just this one.
  const aged = new Date(Date.now() - 401 * 24 * 60 * 60 * 1000).toISOString();
  markPendingReviewResolvedAtForTests('bullet', 'old', { id: 'old', name: 'Theirs' }, aged);
  await flushPendingReviewWritesForTests();
  await reloadPendingReviewForTests();

  assert.equal(getPendingReviewEntryForTests('bullet', 'old'), null,
    'a decision nobody can act on any more should not keep a full record, photos included, forever');
});

test('a recent resolved marker survives the sweep', async () => {
  markPendingReviewResolved('bullet', 'recent', { id: 'recent', name: 'Theirs' });
  await flushPendingReviewWritesForTests();
  await reloadPendingReviewForTests();

  const entry = getPendingReviewEntryForTests('bullet', 'recent');
  assert.ok(entry, 'suppression has to outlive a reload or the conflict re-raises every session');
  assert.ok(entry.resolvedAt);
});

test('an outstanding entry is never swept, however old', async () => {
  addPendingReview({
    recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'dev-2', remoteVersion: { id: 'b1', name: 'Remote' }
  });
  setPendingReviewSeenAtForTests('bullet', 'b1', new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString());
  await flushPendingReviewWritesForTests();
  await reloadPendingReviewForTests();

  assert.equal(getPendingReviewCount(), 1, 'an undecided conflict is still the user\'s to decide, however old');
});

test('the sweep removes the record from the store, not just the mirror', async () => {
  const aged = new Date(Date.now() - 401 * 24 * 60 * 60 * 1000).toISOString();
  markPendingReviewResolvedAtForTests('bullet', 'gone', { id: 'gone', name: 'Theirs' }, aged);
  await flushPendingReviewWritesForTests();
  await reloadPendingReviewForTests();   // sweeps
  await flushPendingReviewWritesForTests();
  await reloadPendingReviewForTests();   // proves the delete was durable

  assert.equal(getPendingReviewEntryForTests('bullet', 'gone'), null);
});
