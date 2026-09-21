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
  initChangeHistory, listHistoryFor, listRecentHistory, listRecentlyDeleted, revertToSnapshot, revertToEntry,
  getHistorySnapshot, DEFAULT_CAPS,
  resetChangeHistoryForTests, reloadChangeHistoryForTests, flushChangeHistoryWritesForTests,
  setChangeHistoryCapsForTests
} = await import('../src/sync/change-history.js');
const {
  saveUserBullet, deleteUserBullet, importUserBullet, loadUserBullets, generateUserId
} = await import('../src/user-library.js');
const { openDatabase, getAll, put } = await import('../src/db.js');
const { DB_NAME, DB_VERSION, STORES } = await import('../src/db-schema.js');
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

test('an edit captures the version it superseded, not the one just written', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'V1' }));
  saveUserBullet(bullet({ id, name: 'V2' }));

  const history = listHistoryFor('bullet', id);
  assert.equal(history.length, 1);
  assert.equal(history[0].recordType, 'bullet');
  assert.equal(history[0].recordId, id);
  assert.equal(history[0].name, 'V1', 'the entry is the superseded version');
  assert.equal((await getHistorySnapshot(history[0].id)).name, 'V1', 'and its snapshot says the same');
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
  assert.equal(history[0].name, 'V2');
  assert.equal(history[1].name, 'V1');
});

test('a deletion captures the live record it replaced, flagged as superseded by a delete', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'Gone' }));
  deleteUserBullet(id);

  const history = listHistoryFor('bullet', id);
  assert.equal(history.length, 1);
  assert.equal(history[0].name, 'Gone');
  assert.equal(history[0].snapshotDeleted, false, 'the stored version is the live one, not the tombstone');
  assert.ok(!(await getHistorySnapshot(history[0].id)).deletedAt);
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
  assert.ok(row.previousEntryId, 'and it has a recoverable pre-deletion snapshot');
  assert.equal((await getHistorySnapshot(row.previousEntryId)).name, 'Pre-existing');

  assert.equal(await revertToEntry(row.previousEntryId), true);
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

test('reverting to an entry restores a deleted record by writing it through the normal save path', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'My Bullet' }));
  deleteUserBullet(id);
  assert.equal(loadUserBullets().length, 0);

  const [preDeletion] = listHistoryFor('bullet', id);
  await revertToEntry(preDeletion.id);

  const revived = loadUserBullets();
  assert.equal(revived.length, 1);
  assert.equal(revived[0].name, 'My Bullet');
  // Reverting is itself a write, so it supersedes the tombstone and
  // captures it — a revert of a revert works with no special-casing.
  const history = listHistoryFor('bullet', id);
  assert.equal(history.length, 2);
  assert.equal(history[0].snapshotDeleted, true, 'the newest entry is now the tombstone the revert replaced');
});

test('reverting to an entry restores a bad edit back to an earlier version', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'Good Name' }));
  saveUserBullet(bullet({ id, name: 'Oops Typo' }));

  const goodVersion = listHistoryFor('bullet', id).find((e) => e.name === 'Good Name');
  await revertToEntry(goodVersion.id);

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
  assert.equal(recent[0].name, 'B1');
});

test('listRecentlyDeleted is driven by the library\'s own tombstones, with the pre-deletion snapshot to restore to', async () => {
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
  assert.ok(deleted[0].previousEntryId, 'expected the last live snapshot to be recoverable');
  assert.equal((await getHistorySnapshot(deleted[0].previousEntryId)).name, 'Gone');
});

test('listRecentlyDeleted omits a record entirely once it has been restored', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'Round Trip' }));
  deleteUserBullet(id);
  assert.equal(listRecentlyDeleted().length, 1);

  const [preDeletion] = listHistoryFor('bullet', id);
  await revertToEntry(preDeletion.id);
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
  assert.equal(entry.previousEntryId, null);
});

test('the byte cap prunes a photo-heavy history even well under the entry cap', async () => {
  const { saveUserLocation, resetLocationLibraryForTests: resetLocations } =
    await import('../src/location-library.js');
  await resetLocations();
  await resetChangeHistoryForTests();
  // Shrunk to 8 MB so the mechanism can be exercised with a few snapshots;
  // the real limit is checked at its own size below.
  setChangeHistoryCapsForTests({ maxBytes: 8 * 1024 * 1024 });

  // ~1.5 MB of base64 per snapshot: six of these blow past the cap while
  // sitting nowhere near the 500-entry cap, which is exactly the shape an
  // entry count alone would miss.
  const photo = `data:image/jpeg;base64,${'A'.repeat(1_500_000)}`;
  const id = generateUserId('location');
  try {
    for (let i = 0; i < 8; i++) {
      saveUserLocation({ id, name: `v${i}`, altitudeM: null, photo, targets: [] });
    }
  } finally {
    setChangeHistoryCapsForTests();
  }

  const history = listHistoryFor('location', id);
  assert.ok(history.length < 7, `expected byte-capped pruning, kept ${history.length} entries`);
  assert.ok(history.length >= 1, 'at least the newest entry always survives');
  const totalBytes = history.reduce((sum, e) => sum + e.bytes, 0);
  assert.ok(totalBytes <= 8 * 1024 * 1024, `kept ${totalBytes} bytes`);
});

test('the default size cap is 128 MB and 500 entries', () => {
  assert.equal(DEFAULT_CAPS.maxBytes, 128 * 1024 * 1024);
  assert.equal(DEFAULT_CAPS.maxEntries, 500);
});

test('at the real 128 MB cap, over a hundred megabytes of history are kept, and it still stops at the cap', async () => {
  const { saveUserLocation, resetLocationLibraryForTests: resetLocations } =
    await import('../src/location-library.js');
  await resetLocations();
  await resetChangeHistoryForTests();
  setChangeHistoryCapsForTests(); // the real limits

  // ~4 MB per snapshot. 30 saves leave 29 superseded copies, about 116 MB:
  // sixteen times the original 8 MB limit, still under the current one.
  const photo = `data:image/jpeg;base64,${'A'.repeat(4_000_000)}`;
  const id = generateUserId('location');
  for (let i = 0; i < 30; i++) saveUserLocation({ id, name: `v${i}`, altitudeM: null, photo, targets: [] });
  assert.equal(listHistoryFor('location', id).length, 29, 'nothing is dropped below the cap');

  for (let i = 30; i < 40; i++) saveUserLocation({ id, name: `v${i}`, altitudeM: null, photo, targets: [] });
  const history = listHistoryFor('location', id);
  const totalBytes = history.reduce((sum, e) => sum + e.bytes, 0);
  assert.ok(history.length < 39, 'past 128 MB the oldest are dropped');
  assert.ok(totalBytes <= 128 * 1024 * 1024, `kept ${totalBytes} bytes`);
  assert.equal(history[0].name, 'v38', 'and the newest are what stay');
});

test('history survives a reload (IndexedDB round-trip)', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'V1' }));
  saveUserBullet(bullet({ id, name: 'V2' }));
  await flushChangeHistoryWritesForTests();
  await reloadChangeHistoryForTests();
  const history = listHistoryFor('bullet', id);
  assert.equal(history.length, 1);
  assert.equal(history[0].name, 'V1');
  assert.equal((await getHistorySnapshot(history[0].id)).name, 'V1', 'and the snapshot is still there to fetch');
});

test('initChangeHistory is safe to call repeatedly', async () => {
  await initChangeHistory();
  await initChangeHistory();
  assert.ok(Array.isArray(listRecentHistory()));
});

// ---- docs/plans/orphaned-storage-cleanup.md phase 4 ----

test('the caps are enforced at boot, not only when the next edit is captured', async () => {
  // Entries written past the caps by an earlier session (or by a second
  // tab, whose prune only knew its own mirror) used to sit there until
  // something else happened to be captured — which on a library nobody is
  // editing is never.
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'B', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  for (let i = 0; i < 12; i++) {
    saveUserBullet({ id, name: `B${i}`, manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  }
  await flushChangeHistoryWritesForTests();

  setChangeHistoryCapsForTests({ maxEntries: 3 });
  await reloadChangeHistoryForTests();
  await flushChangeHistoryWritesForTests();

  assert.ok(listRecentHistory(100).length <= 3, `expected the boot prune to bind, saw ${listRecentHistory(100).length}`);

  // And it was a real delete, not just a trimmed mirror.
  setChangeHistoryCapsForTests();
  await reloadChangeHistoryForTests();
  assert.ok(listRecentHistory(100).length <= 3, 'the boot prune must reach the store');
});

test('a boot prune keeps the newest entries', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'first', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  for (const name of ['second', 'third', 'fourth']) {
    saveUserBullet({ id, name, manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  }
  await flushChangeHistoryWritesForTests();

  setChangeHistoryCapsForTests({ maxEntries: 1 });
  await reloadChangeHistoryForTests();
  await flushChangeHistoryWritesForTests();
  setChangeHistoryCapsForTests();

  const kept = listRecentHistory(10);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].name, 'third', 'the surviving entry should be the most recently superseded value');
});

test('init merges session captures with what was already stored', async () => {
  // The capture hook is registered at module load, so anything written
  // before init resolves must not be dropped by the read that follows it.
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'A', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserBullet({ id, name: 'B', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  await flushChangeHistoryWritesForTests();
  const before = listRecentHistory(100).length;

  await initChangeHistory();
  assert.equal(listRecentHistory(100).length, before, 'a repeat init must neither drop nor duplicate entries');
});

// ---- summaries in memory, snapshots fetched on demand ----

async function rawStore(name) {
  const db = await openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  return getAll(db, name);
}

// Records every call the module makes to storage, as "<method>:<store>", by
// wrapping the one database handle the fake hands out.
async function spyOnStorage() {
  const db = await openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  const calls = [];
  db.transaction = (name) => {
    const store = Object.getPrototypeOf(db).transaction.call(db, name).objectStore();
    return {
      objectStore: () => new Proxy(store, {
        get(target, prop) {
          const value = target[prop];
          return typeof value === 'function' ? (...args) => { calls.push(`${prop}:${name}`); return value.apply(target, args); } : value;
        }
      })
    };
  };
  return { calls, stop: () => { delete db.transaction; } };
}

function photoBullet(id, name) {
  return bullet({ id, name, notes: 'x'.repeat(50_000) });
}

test('entries held in memory carry a summary, never the snapshot', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(photoBullet(id, 'V1'));
  saveUserBullet(photoBullet(id, 'V2'));

  const [entry] = listHistoryFor('bullet', id);
  assert.ok(!('snapshot' in entry), 'the snapshot is not in memory');
  assert.deepEqual(Object.keys(entry).sort(), [
    'bytes', 'capturedAt', 'id', 'name', 'recordId', 'recordType', 'seq', 'snapshotDeleted', 'supersededBy', 'supersededByDelete'
  ]);
  assert.ok(JSON.stringify(entry).length < 1000, 'a line, not a copy of the record');
  assert.ok(entry.bytes > 50_000, 'while its size is still known, for the byte cap');
});

test('starting up reads the summaries and the snapshot keys, and no snapshot', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(photoBullet(id, 'V1'));
  saveUserBullet(photoBullet(id, 'V2'));
  saveUserBullet(photoBullet(id, 'V3'));
  await flushChangeHistoryWritesForTests();

  const spy = await spyOnStorage();
  await reloadChangeHistoryForTests();
  spy.stop();

  assert.deepEqual([...new Set(spy.calls)].sort(), ['getAll:change-history-index', 'getAllKeys:change-history']);
  assert.equal(listHistoryFor('bullet', id).length, 2, 'and the history is all there');
  assert.ok(listHistoryFor('bullet', id).every((e) => !('snapshot' in e)));
});

test('a snapshot is fetched from storage, for that one entry, only when it is restored', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(photoBullet(id, 'V1'));
  saveUserBullet(photoBullet(id, 'V2'));
  saveUserBullet(photoBullet(id, 'V3'));
  await flushChangeHistoryWritesForTests();
  await reloadChangeHistoryForTests();
  const target = listHistoryFor('bullet', id).find((e) => e.name === 'V1');

  const spy = await spyOnStorage();
  const ok = await revertToEntry(target.id);
  spy.stop();

  assert.equal(ok, true);
  assert.equal(loadUserBullets().find((b) => b.id === id).name, 'V1');
  assert.deepEqual(spy.calls.filter((call) => call.endsWith(':change-history')), ['get:change-history'], 'one read of one record');
});

test('restoring right after an edit works before the entry has been written to storage', async () => {
  // The capture is queued, not awaited; a restore in that window must not
  // depend on it having landed.
  const id = generateUserId('user-bullet');
  saveUserBullet(photoBullet(id, 'V1'));
  saveUserBullet(photoBullet(id, 'V2'));

  const [entry] = listHistoryFor('bullet', id);
  assert.equal(await revertToEntry(entry.id), true);
  assert.equal(loadUserBullets().find((b) => b.id === id).name, 'V1');
});

test('restoring an entry that has been pruned since the list was drawn does nothing, and says so', async () => {
  assert.equal(await revertToEntry('hist-does-not-exist'), false);

  const id = generateUserId('user-bullet');
  saveUserBullet(photoBullet(id, 'V1'));
  saveUserBullet(photoBullet(id, 'V2'));
  const [entry] = listHistoryFor('bullet', id);
  await flushChangeHistoryWritesForTests();
  setChangeHistoryCapsForTests({ maxEntries: 0 });
  saveUserBullet(photoBullet(id, 'V3')); // pushes the older entry out
  await flushChangeHistoryWritesForTests();
  setChangeHistoryCapsForTests();

  assert.equal(await revertToEntry(entry.id), false);
  assert.equal(await getHistorySnapshot(entry.id), null);
});

test('history from an earlier build, stored before summaries existed, is adopted at boot and stays restorable', async () => {
  // The shape an earlier build wrote: the whole entry, and nothing else.
  const db = await openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  const id = generateUserId('user-bullet');
  await put(db, 'change-history', {
    id: 'hist-legacy-1', recordType: 'bullet', recordId: id,
    snapshot: { id, name: 'Legacy Version', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' }, modifiedAt: '2021-01-01T00:00:00.000Z' },
    bytes: 300, capturedAt: '2021-06-01T00:00:00.000Z', seq: 0, supersededBy: 'someone', supersededByDelete: false
  });
  assert.deepEqual(await rawStore('change-history-index'), []);

  await reloadChangeHistoryForTests();

  const [entry] = listHistoryFor('bullet', id);
  assert.equal(entry.name, 'Legacy Version');
  assert.equal(entry.supersededBy, 'someone');
  assert.ok(!('snapshot' in entry));
  assert.equal((await rawStore('change-history-index')).length, 1, 'its summary was written, so this happens once');

  const spy = await spyOnStorage();
  await reloadChangeHistoryForTests();
  spy.stop();
  assert.ok(!spy.calls.includes('get:change-history'), 'the second start reads no snapshot at all');
  assert.equal(await revertToEntry(entry.id), true);
  assert.equal(loadUserBullets().find((b) => b.id === id).name, 'Legacy Version');
});

test('a snapshot whose summary a kill never wrote is adopted at the next start', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(photoBullet(id, 'V1'));
  saveUserBullet(photoBullet(id, 'V2'));
  await flushChangeHistoryWritesForTests();
  const db = await openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  const { deleteRecord } = await import('../src/db.js');
  const [summary] = await rawStore('change-history-index');
  await deleteRecord(db, 'change-history-index', summary.id); // the crash between the two writes

  await reloadChangeHistoryForTests();

  assert.equal(listHistoryFor('bullet', id).length, 1);
  assert.equal((await rawStore('change-history-index')).length, 1);
});

test('a summary whose snapshot is gone is dropped at the next start, and from storage', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(photoBullet(id, 'V1'));
  saveUserBullet(photoBullet(id, 'V2'));
  await flushChangeHistoryWritesForTests();
  const db = await openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  const { deleteRecord } = await import('../src/db.js');
  const [entry] = listHistoryFor('bullet', id);
  await deleteRecord(db, 'change-history', entry.id); // the snapshot goes, the summary stays

  await reloadChangeHistoryForTests();

  assert.deepEqual(listHistoryFor('bullet', id), [], 'nothing to restore, so not listed');
  assert.deepEqual(await rawStore('change-history-index'), [], 'and no longer stored');
});

test('pruning removes an entry from both stores', async () => {
  const id = generateUserId('user-bullet');
  for (let i = 0; i < 8; i++) saveUserBullet(photoBullet(id, `V${i}`));
  await flushChangeHistoryWritesForTests();

  setChangeHistoryCapsForTests({ maxEntries: 3 });
  await reloadChangeHistoryForTests();
  await flushChangeHistoryWritesForTests();
  setChangeHistoryCapsForTests();

  assert.equal((await rawStore('change-history')).length, 3);
  assert.equal((await rawStore('change-history-index')).length, 3);
});

test('revertToSnapshot still restores from a snapshot in hand', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet(bullet({ id, name: 'Now' }));
  revertToSnapshot('bullet', { ...bullet({ id, name: 'Then' }), modifiedAt: '2021-01-01T00:00:00.000Z' });
  assert.equal(loadUserBullets().find((b) => b.id === id).name, 'Then');
});
