import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

// Import order matters here exactly like app.js: change-history.js's
// onLibraryWrite subscription must exist before any library write, and
// initChangeHistory() must be awaited before relying on `mirror` for
// reads — see that module's own comments.
const {
  initChangeHistory, listHistoryFor, listRecentHistory, listRecentlyDeleted, revertToSnapshot,
  resetChangeHistoryForTests, reloadChangeHistoryForTests, flushChangeHistoryWritesForTests
} = await import('../src/sync/change-history.js');
const {
  saveUserBullet, deleteUserBullet, importUserBullet, loadUserBullets, generateUserId
} = await import('../src/user-library.js');
const { resetLocationLibraryForTests } = await import('../src/location-library.js');
const { resetRiflePrecisionLibraryForTests } = await import('../src/rifle-precision-library.js');

test.beforeEach(async () => {
  localStorage.clear();
  await resetLocationLibraryForTests();
  await resetRiflePrecisionLibraryForTests();
  await resetChangeHistoryForTests();
});

function bullet(overrides) {
  return {
    name: 'My Bullet', manufacturer: 'M', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }, ...overrides
  };
}

test('creating a record captures nothing — there is no earlier version to go back to', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id }));
  assert.deepEqual(listHistoryFor('bullet', id), []);
});

test('an edit captures the version it superseded, not the one just written', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'V1' }));
  saveUserBullet(bullet({ id, name: 'V2' }));

  const history = listHistoryFor('bullet', id);
  assert.equal(history.length, 1);
  assert.equal(history[0].recordType, 'bullet');
  assert.equal(history[0].recordId, id);
  assert.equal(history[0].snapshot.name, 'V1', 'the snapshot is the superseded version');
  assert.equal(history[0].supersededByDelete, false);
  assert.ok(typeof history[0].capturedAt === 'string');
  assert.ok(typeof history[0].bytes === 'number' && history[0].bytes > 0);
});

test('multiple edits to the same record accumulate history entries, newest first', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'V1' }));
  saveUserBullet(bullet({ id, name: 'V2' }));
  saveUserBullet(bullet({ id, name: 'V3' }));

  const history = listHistoryFor('bullet', id);
  assert.equal(history.length, 2);
  assert.equal(history[0].snapshot.name, 'V2');
  assert.equal(history[1].snapshot.name, 'V1');
});

test('a deletion captures the live record it replaced, flagged as superseded by a delete', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'Gone' }));
  deleteUserBullet(id);

  const history = listHistoryFor('bullet', id);
  assert.equal(history.length, 1);
  assert.equal(history[0].snapshot.name, 'Gone');
  assert.ok(!history[0].snapshot.deletedAt, 'the stored version is the live one, not the tombstone');
  assert.equal(history[0].supersededByDelete, true);
});

// This is the upgrade case, and the whole reason capture has to happen on
// the superseded value: on the day this ships, every record in every
// existing library has never been written by this build. Capturing the
// post-write value instead would leave such a record with only a tombstone
// in history the moment it is deleted — nothing to restore.
test('a record never edited on this build is still recoverable the first time it is deleted', async () => {
  const id = generateUserId('user-bullet');
  // importUserBullet writes without going through saveUserBullet, standing
  // in for a record that was already in storage before capture existed.
  importUserBullet(bullet({ id, name: 'Pre-existing', modifiedAt: '2021-01-01T00:00:00.000Z' }));
  await resetChangeHistoryForTests(); // ...and no history for it at all
  assert.deepEqual(listHistoryFor('bullet', id), []);

  deleteUserBullet(id);

  const deleted = listRecentlyDeleted();
  const row = deleted.find((e) => e.recordId === id);
  assert.ok(row, 'the deletion shows up in the trash bin');
  assert.ok(row.previousSnapshot, 'and it has a recoverable pre-deletion snapshot');
  assert.equal(row.previousSnapshot.name, 'Pre-existing');

  revertToSnapshot('bullet', row.previousSnapshot);
  assert.equal(loadUserBullets().length, 1);
  assert.equal(loadUserBullets()[0].name, 'Pre-existing');
});

test('history capture is unconditional — it does not check the master backup/sync toggle', async () => {
  const { isBackupSyncEnabled } = await import('../src/backup-sync-prefs.js');
  assert.equal(isBackupSyncEnabled(), false); // default off
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'V1' }));
  saveUserBullet(bullet({ id, name: 'V2' }));
  assert.equal(listHistoryFor('bullet', id).length, 1, 'history is captured even with backup/sync disabled');
});

test('revertToSnapshot restores a deleted record by writing it through the normal save path', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'My Bullet' }));
  deleteUserBullet(id);
  assert.equal(loadUserBullets().length, 0);

  const [preDeletion] = listHistoryFor('bullet', id);
  revertToSnapshot('bullet', preDeletion.snapshot);

  const revived = loadUserBullets();
  assert.equal(revived.length, 1);
  assert.equal(revived[0].name, 'My Bullet');
  // Reverting is itself a write, so it supersedes the tombstone and
  // captures it — a revert of a revert works with no special-casing.
  const history = listHistoryFor('bullet', id);
  assert.equal(history.length, 2);
  assert.ok(history[0].snapshot.deletedAt, 'the newest entry is now the tombstone the revert replaced');
});

test('revertToSnapshot restores a bad edit back to an earlier version', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'Good Name' }));
  saveUserBullet(bullet({ id, name: 'Oops Typo' }));

  const goodVersion = listHistoryFor('bullet', id).find((e) => e.snapshot.name === 'Good Name');
  revertToSnapshot('bullet', goodVersion.snapshot);

  assert.equal(loadUserBullets()[0].name, 'Good Name');
});

test('listRecentHistory returns entries across record types, newest first, capped at the given limit', () => {
  const id1 = generateUserId('user-bullet');
  const id2 = generateUserId('user-bullet');
  saveUserBullet(bullet({ id: id1, name: 'A1' }));
  saveUserBullet(bullet({ id: id1, name: 'A2' }));
  saveUserBullet(bullet({ id: id2, name: 'B1' }));
  saveUserBullet(bullet({ id: id2, name: 'B2' }));

  const recent = listRecentHistory(1);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].snapshot.name, 'B1');
});

test('listRecentlyDeleted is driven by the library\'s own tombstones, with the pre-deletion snapshot to restore to', () => {
  const liveId = generateUserId('user-bullet');
  saveUserBullet(bullet({ id: liveId, name: 'Still Here' }));

  const deletedId = generateUserId('user-bullet');
  saveUserBullet(bullet({ id: deletedId, name: 'Gone' }));
  deleteUserBullet(deletedId);

  const deleted = listRecentlyDeleted();
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].recordId, deletedId);
  assert.equal(deleted[0].recordType, 'bullet');
  assert.ok(deleted[0].tombstone.deletedAt);
  assert.ok(deleted[0].deletedAt);
  assert.ok(deleted[0].previousSnapshot, 'expected the last live snapshot to be recoverable');
  assert.equal(deleted[0].previousSnapshot.name, 'Gone');
});

test('listRecentlyDeleted omits a record entirely once it has been restored', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'Round Trip' }));
  deleteUserBullet(id);
  assert.equal(listRecentlyDeleted().length, 1);

  const [preDeletion] = listHistoryFor('bullet', id);
  revertToSnapshot('bullet', preDeletion.snapshot);
  assert.equal(listRecentlyDeleted().length, 0);
});

test('listRecentlyDeleted still lists a deletion whose snapshot has aged out, just without a restore target', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'Aged Out' }));
  deleteUserBullet(id);

  // Push this record's single pre-deletion snapshot out of the global
  // 500-entry cap. Each filler bullet needs two writes to produce one
  // history entry (a create captures nothing), so 500 edits are enough to
  // evict the one entry that predates them all.
  for (let i = 0; i < 500; i++) {
    const fillerId = generateUserId('user-bullet');
    saveUserBullet(bullet({ id: fillerId, name: `filler ${i}` }));
    saveUserBullet(bullet({ id: fillerId, name: `filler ${i} edited` }));
  }

  assert.deepEqual(listHistoryFor('bullet', id), [], 'the pre-deletion snapshot has been pruned');

  const entry = listRecentlyDeleted(1000).find((e) => e.recordId === id);
  assert.ok(entry, 'the deletion is still listed — it comes from the tombstone, not from history');
  assert.equal(entry.previousSnapshot, null);
});

test('the byte cap prunes a photo-heavy history even well under the entry cap', async () => {
  const { saveUserLocation, resetLocationLibraryForTests: resetLocations } =
    await import('../src/location-library.js');
  await resetLocations();
  await resetChangeHistoryForTests();

  // ~1.5 MB of base64 per snapshot: six of these blow past MAX_BYTES (8 MB)
  // while sitting nowhere near the 500-entry cap, which is exactly the
  // shape an entry count alone would miss.
  const photo = `data:image/jpeg;base64,${'A'.repeat(1_500_000)}`;
  const id = generateUserId('location');
  for (let i = 0; i < 8; i++) {
    saveUserLocation({ id, name: `v${i}`, altitudeM: null, photo, targets: [] });
  }

  const history = listHistoryFor('location', id);
  assert.ok(history.length < 7, `expected byte-capped pruning, kept ${history.length} entries`);
  assert.ok(history.length >= 1, 'at least the newest entry always survives');
  const totalBytes = history.reduce((sum, e) => sum + e.bytes, 0);
  assert.ok(totalBytes <= 8 * 1024 * 1024, `kept ${totalBytes} bytes`);
});

test('history survives a reload (IndexedDB round-trip)', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'V1' }));
  saveUserBullet(bullet({ id, name: 'V2' }));
  await flushChangeHistoryWritesForTests();
  await reloadChangeHistoryForTests();
  const history = listHistoryFor('bullet', id);
  assert.equal(history.length, 1);
  assert.equal(history[0].snapshot.name, 'V1');
});

test('initChangeHistory is safe to call repeatedly', async () => {
  await initChangeHistory();
  await initChangeHistory();
  assert.ok(Array.isArray(listRecentHistory()));
});
