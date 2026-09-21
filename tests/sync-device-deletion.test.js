// Deleting a device that is out of circulation — docs/plans/orphaned-storage-cleanup.md
// phase 6. The two properties under test: a deletion propagates to every
// device, and a machine that turns out to be alive is never locked out of
// rejoining.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const {
  recordPeerDevice, getKnownDevices, getDeviceLabel, recordPeerExportedAtSeen,
  deleteDevice, isDeviceDeleted, getDeviceTombstones,
  mergeDeviceTombstones, classifyDeletedPeerBundle
} = await import('../src/sync/device-registry.js');
const {
  deletionBlockedReason, publishedRecently, deleteSyncDevice, listSyncDevices, RECENT_SYNC_MS
} = await import('../src/sync/device-deletion.js');
const {
  addPendingReview, listPendingReviews, resetPendingReviewForTests
} = await import('../src/sync/pending-review.js');
const { buildBackupBundle } = await import('../src/sync/backup-bundle.js');

function makeFakeDirHandle(entries = {}) {
  return {
    kind: 'directory',
    async *entries() {
      for (const [name, entry] of Object.entries(entries)) yield [name, entry];
    },
    async getFileHandle(name) {
      if (!(name in entries)) throw new Error(`not found: ${name}`);
      return { kind: 'file', async getFile() { return { text: async () => entries[name].content }; } };
    },
    async removeEntry(name) {
      if (!(name in entries)) {
        const err = new Error(`not found: ${name}`);
        err.name = 'NotFoundError';
        throw err;
      }
      delete entries[name];
    },
    _entries: entries
  };
}

const { recordPendingPhotoDevices, recordFileDevices } = await import('../src/sync/last-sync-status.js');
const { serializeBackupBundle } = await import('../src/sync/backup-bundle.js');

// A real bundle claiming to come from `deviceId` — files are identified by
// the id inside them, so a placeholder like '{}' no longer says whose it is.
function bundleText(deviceId, exportedAt = '2026-04-01T10:00:00.000Z') {
  const real = localStorage.getItem('ballistics_device_id_v1');
  localStorage.setItem('ballistics_device_id_v1', deviceId);
  const bundle = buildBackupBundle();
  localStorage.setItem('ballistics_device_id_v1', real);
  bundle.exportedAt = exportedAt;
  return serializeBackupBundle(bundle);
}

// A peer this device has read a bundle from: known by name, and with the
// newest export merged. Deleting needs the latter — it is what the tombstone
// records as discarded.
const MERGED = '2026-04-01T10:00:00.000Z';
function mergedPeer(id, name, exportedAt = MERGED) {
  recordPeerDevice({ id, name, modifiedAt: '2026-01-01T00:00:00.000Z' });
  recordPeerExportedAtSeen(id, exportedAt);
}

test.beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  // Module-level, not localStorage — clearing storage does not reset it.
  recordPendingPhotoDevices([]);
  recordFileDevices({});
  await resetPendingReviewForTests();
});

// ---- the tombstone records what was discarded, in the deleted device's own clock ----

test('deleting records the newest export merged from the device, not a time on this device\'s clock', () => {
  mergedPeer('kitchen', 'Kitchen PC', '2026-03-15T08:00:00.000Z');
  const tombstone = deleteDevice('kitchen', { by: 'my-device' });
  assert.equal(tombstone.upTo, '2026-03-15T08:00:00.000Z');
  assert.equal(isDeviceDeleted('kitchen'), true);
});

test('a device nothing was ever merged from cannot be deleted: there is nothing to record as discarded', () => {
  recordPeerDevice({ id: 'kitchen', name: 'Kitchen PC', modifiedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(deleteDevice('kitchen'), null);
  assert.equal(isDeviceDeleted('kitchen'), false);
  assert.equal(deletionBlockedReason('kitchen').reason, 'not-merged');
});

test('deleting again after a device came back never lowers what is already discarded', () => {
  mergedPeer('kitchen', 'Kitchen PC', '2026-05-01T00:00:00.000Z');
  deleteDevice('kitchen');
  mergeDeviceTombstones([{ id: 'kitchen', upTo: '2026-09-01T00:00:00.000Z', by: 'peer' }]);
  const again = deleteDevice('kitchen');
  assert.equal(again.upTo, '2026-09-01T00:00:00.000Z');
});

// ---- propagation ----

test('a deletion is published as a tombstone in this device\'s own bundle', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  deleteDevice('kitchen', { by: 'my-device' });

  const bundle = buildBackupBundle();
  assert.equal(bundle.devicesDeleted.length, 1);
  assert.equal(bundle.devicesDeleted[0].id, 'kitchen');
  assert.equal(bundle.devicesDeleted[0].upTo, MERGED);
});

test('a peer\'s tombstone is merged, and merging is idempotent and order-independent', () => {
  const small = { id: 'kitchen', upTo: '2026-05-01T00:00:00.000Z', by: 'peer-a' };
  const large = { id: 'kitchen', upTo: '2026-06-01T00:00:00.000Z', by: 'peer-b' };

  mergeDeviceTombstones([large]);
  mergeDeviceTombstones([small]);   // out of order
  mergeDeviceTombstones([large]);   // repeated

  const tombs = getDeviceTombstones();
  assert.equal(tombs.length, 1);
  assert.equal(tombs[0].upTo, large.upTo, 'the larger upTo wins whatever the arrival order');
});

test('merging the same tombstones in any order gives the same result', () => {
  const tombs = [
    { id: 'a', upTo: '2026-01-01T00:00:00.000Z', by: 'x' },
    { id: 'a', upTo: '2026-03-01T00:00:00.000Z', by: 'y' },
    { id: 'b', upTo: '2026-02-01T00:00:00.000Z', by: 'x' }
  ];
  const summary = () => getDeviceTombstones().map((t) => `${t.id}:${t.upTo}`).sort().join('|');
  mergeDeviceTombstones(tombs);
  const forward = summary();
  localStorage.clear();
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  mergeDeviceTombstones([...tombs].reverse());
  assert.equal(summary(), forward);
});

test('a tombstone naming this device itself is ignored', () => {
  assert.equal(mergeDeviceTombstones([{ id: 'my-device', upTo: '2026-06-01T00:00:00.000Z', by: 'peer' }]), 0);
  assert.deepEqual(getDeviceTombstones(), [], 'so it is never republished either');
});

test('a malformed tombstone is ignored', () => {
  assert.equal(mergeDeviceTombstones([null, {}, { id: 'x' }, { id: 'x', upTo: 'not a date' }]), 0);
});

test('tombstones are not expired by time, so a stale file in a folder nothing can clean never brings the device back', () => {
  mergeDeviceTombstones([{ id: 'ancient', upTo: '2020-01-01T00:00:00.000Z', by: 'x', deletedOn: '2020-01-02T00:00:00.000Z' }]);
  assert.equal(getDeviceTombstones().length, 1);
});

test('the published list is capped, newest first', () => {
  const tombs = Array.from({ length: 520 }, (_, i) => ({
    id: `dev-${i}`, upTo: '2026-01-01T00:00:00.000Z', by: 'x', deletedOn: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()
  }));
  mergeDeviceTombstones(tombs);
  const published = getDeviceTombstones();
  assert.equal(published.length, 500);
  assert.equal(published[0].id, 'dev-519');
});

// ---- staleness: comparing the device's own export times ----

test('a bundle later than what the deletion discarded is not stale', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  deleteDevice('kitchen');
  assert.equal(classifyDeletedPeerBundle('kitchen', '2026-04-01T10:00:01.000Z'), 'active');
});

test('a bundle at or before what the deletion discarded is the file already removed', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  deleteDevice('kitchen');
  assert.equal(classifyDeletedPeerBundle('kitchen', MERGED), 'stale');
  assert.equal(classifyDeletedPeerBundle('kitchen', '2026-01-01T00:00:00.000Z'), 'stale',
    'without this, a file still in the folder is indistinguishable from the machine returning');
});

test('a bundle with no usable export time cannot be shown to be newer, so it is stale', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  deleteDevice('kitchen');
  assert.equal(classifyDeletedPeerBundle('kitchen', undefined), 'stale');
});

test('the decision does not depend on this device\'s clock', () => {
  mergedPeer('kitchen', 'Kitchen PC', '2099-01-01T00:00:00.000Z'); // the peer\'s clock is far ahead of ours
  deleteDevice('kitchen');
  assert.equal(classifyDeletedPeerBundle('kitchen', '2099-01-01T00:00:01.000Z'), 'active');
  assert.equal(classifyDeletedPeerBundle('kitchen', '2099-01-01T00:00:00.000Z'), 'stale');
});

test('a device nobody deleted is simply active', () => {
  assert.equal(classifyDeletedPeerBundle('kitchen', new Date().toISOString()), 'active');
});

// ---- a returning device clears the tombstone; no revive step ----

test('a later export from a deleted device clears its tombstone, so it stops being published', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  deleteDevice('kitchen');
  assert.equal(getDeviceTombstones().length, 1);

  recordPeerExportedAtSeen('kitchen', '2026-05-01T00:00:00.000Z'); // it published again, and the bundle was admitted
  assert.equal(isDeviceDeleted('kitchen'), false);
  assert.deepEqual(getDeviceTombstones(), []);
  assert.equal(getDeviceLabel('kitchen'), 'Kitchen PC');
});

test('a re-read of the same old export does not clear the tombstone', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  deleteDevice('kitchen');
  recordPeerExportedAtSeen('kitchen', MERGED);
  assert.equal(isDeviceDeleted('kitchen'), true);
});

test('an old copy of a cleared tombstone, still circulating, is not taken back in', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  deleteDevice('kitchen');
  const old = getDeviceTombstones();
  recordPeerExportedAtSeen('kitchen', '2026-05-01T00:00:00.000Z'); // it came back; tombstone cleared

  assert.equal(mergeDeviceTombstones(old), 0, 'a peer that has not yet seen the new file is still publishing it');
  assert.equal(isDeviceDeleted('kitchen'), false);
  assert.deepEqual(getDeviceTombstones(), []);
});

test('a tombstone for a device this device has already merged something later from is not taken in', () => {
  mergedPeer('kitchen', 'Kitchen PC', '2026-06-01T00:00:00.000Z');
  assert.equal(mergeDeviceTombstones([{ id: 'kitchen', upTo: '2026-05-01T00:00:00.000Z', by: 'peer' }]), 0);
  assert.equal(isDeviceDeleted('kitchen'), false);
});

// ---- the two gates ----

test('this device is never deletable', () => {
  assert.deepEqual(deletionBlockedReason('my-device'), { reason: 'self' });
});

test('unresolved conflicts naming the device block deletion', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  addPendingReview({
    recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'kitchen', remoteVersion: { id: 'b1', name: 'Theirs' }
  });

  const blocked = deletionBlockedReason('kitchen');
  assert.equal(blocked.reason, 'conflicts');
  assert.equal(blocked.count, 1);
});

test('a conflict naming a different peer does not block', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  addPendingReview({
    recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'laptop', remoteVersion: { id: 'b1', name: 'Theirs' }
  });
  assert.equal(deletionBlockedReason('kitchen'), null);
});

test('photos still arriving from the device block deletion', async () => {
  mergedPeer('kitchen', 'Kitchen PC');
  recordPendingPhotoDevices(['Kitchen PC']);

  const blocked = deletionBlockedReason('kitchen');
  assert.equal(blocked.reason, 'photos-pending',
    'a record skipped for a still-downloading photo never becomes a conflict, so conflicts alone would miss it');
});

test('a blocked device is not deleted even if the call is made directly', async () => {
  mergedPeer('kitchen', 'Kitchen PC');
  addPendingReview({
    recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'kitchen', remoteVersion: { id: 'b1', name: 'Theirs' }
  });
  const dir = makeFakeDirHandle({ 'backup-kitchen.json': { kind: 'file', content: '{}' } });

  const result = await deleteSyncDevice(dir, 'kitchen');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'conflicts');
  assert.ok(dir._entries['backup-kitchen.json'], 'the file must survive a blocked deletion');
  assert.equal(isDeviceDeleted('kitchen'), false);
});

// ---- the deletion itself ----

test('deleting removes the backup file, tombstones the device and clears its conflicts', async () => {
  mergedPeer('kitchen', 'Kitchen PC');
  addPendingReview({
    recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'laptop', remoteVersion: { id: 'b1', name: 'Other peer' }
  });
  const dir = makeFakeDirHandle({
    'backup-kitchen.json': { kind: 'file', content: bundleText('kitchen') },
    'backup-laptop.json': { kind: 'file', content: bundleText('laptop') }
  });

  const result = await deleteSyncDevice(dir, 'kitchen');
  assert.equal(result.ok, true);
  assert.equal(result.fileRemoved, true);
  assert.equal(isDeviceDeleted('kitchen'), true);
  assert.equal(dir._entries['backup-kitchen.json'], undefined);
  assert.ok(dir._entries['backup-laptop.json'], 'only the named device\'s file goes');
  assert.equal(listPendingReviews().length, 1, 'the other peer\'s conflict is untouched');
});

test('deleting clears conflicts attributed to that device', async () => {
  mergedPeer('kitchen', 'Kitchen PC');
  addPendingReview({
    recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'kitchen', remoteVersion: { id: 'b1', name: 'Theirs' }
  });
  // Resolve the gate by clearing it the way the review UI would, then
  // delete: expireStaleReviewsForPeer() only runs while reading that
  // peer's bundle, and after this there will not be one.
  const { clearPendingReview } = await import('../src/sync/pending-review.js');
  clearPendingReview('bullet', 'b1');
  addPendingReview({
    recordType: 'rifle', recordId: 'r1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'kitchen', remoteVersion: { id: 'r1', name: 'Theirs' }
  });

  const dir = makeFakeDirHandle({ 'backup-kitchen.json': { kind: 'file', content: bundleText('kitchen') } });
  // The gate blocks while that conflict is outstanding — which is the
  // point — so clear it first, exactly as the UI requires the user to.
  clearPendingReview('rifle', 'r1');
  const result = await deleteSyncDevice(dir, 'kitchen');
  assert.equal(result.ok, true);
  assert.deepEqual(listPendingReviews(), []);
});

test('deleting a device whose file is already gone still succeeds', async () => {
  mergedPeer('kitchen', 'Kitchen PC');
  const dir = makeFakeDirHandle({});

  const result = await deleteSyncDevice(dir, 'kitchen');
  assert.equal(result.ok, true, 'two devices retiring the same machine is not a collision worth reporting');
  assert.equal(isDeviceDeleted('kitchen'), true);
});

// ---- the list ----

test('a recently published device is flagged, but not blocked', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  recordPeerExportedAtSeen('kitchen', new Date().toISOString());

  assert.equal(publishedRecently('kitchen'), true);
  assert.equal(deletionBlockedReason('kitchen'), null, 'deleting a live machine is legitimate — it simply rejoins');
});

test('a long-dormant device is not flagged as recent', () => {
  mergedPeer('sleepy', 'Sleepy');
  recordPeerExportedAtSeen('sleepy', new Date(Date.now() - RECENT_SYNC_MS - 60_000).toISOString());
  assert.equal(publishedRecently('sleepy'), false);
});

test('the device list puts this device first and excludes deleted ones', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  mergedPeer('laptop', 'Laptop');
  deleteDevice('laptop');

  const rows = listSyncDevices();
  assert.equal(rows[0].isSelf, true);
  assert.deepEqual(rows.map((r) => r.id).filter((id) => id !== 'my-device'), ['kitchen']);
  assert.deepEqual(rows[0].blocked, { reason: 'self' }, 'the action is never offered for the device in use');
});

test('a device whose file has left the folder stays listed', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  const rows = listSyncDevices({ fileNames: [] });
  const kitchen = rows.find((r) => r.id === 'kitchen');
  assert.equal(kitchen.hasBundle, false,
    'a temporarily quiet machine vanishing from the list would be worse than a stale row');
});

test('a browser that cannot remove files still completes the deletion, and says the file is left for later', async () => {
  mergedPeer('kitchen', 'Kitchen PC');

  const result = await deleteSyncDevice(null, 'kitchen'); // no folder handle: Firefox, Safari, iOS

  assert.deepEqual(result, { ok: true, fileRemoved: false, deferred: true });
  assert.equal(isDeviceDeleted('kitchen'), true);
  assert.equal(getDeviceTombstones().length, 1, 'and the tombstone is there to be published');
});

test('deleting makes this device publish, so the tombstone actually leaves it', async () => {
  const { isDirtyForTests } = await import('../src/sync/auto-sync.js');
  mergedPeer('kitchen', 'Kitchen PC');
  await deleteSyncDevice(null, 'kitchen');
  assert.equal(isDirtyForTests(), true, 'nothing else about this device changed, so without this the cycle sees nothing to say');
});

test('a device nothing was merged from is refused by the deletion itself, not only by the picker', async () => {
  recordPeerDevice({ id: 'kitchen', name: 'Kitchen PC', modifiedAt: '2026-01-01T00:00:00.000Z' });
  const result = await deleteSyncDevice(makeFakeDirHandle({}), 'kitchen');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-merged');
  assert.equal(isDeviceDeleted('kitchen'), false);
});

// ---- the list is built from the registry AND the folder ----

test('a backup file in the folder that no cycle has read here is listed once it has been identified, under the name it states', () => {
  // The registry is filled by reading a peer's bundle in a sync cycle, so
  // a device whose file is in the folder but hasn't been through one in
  // this browser was invisible.
  mergedPeer('kitchen', 'Kitchen PC');
  recordFileDevices({
    'backup-kitchen.json': { id: 'kitchen' },
    'whatever-it-was-saved-as.json': { id: 'stranger', name: 'Stranger PC', exportedAt: '2026-09-01T00:00:00.000Z' }
  });
  const rows = listSyncDevices({ fileNames: ['backup-kitchen.json', 'whatever-it-was-saved-as.json'] });

  const stranger = rows.find((r) => r.id === 'stranger');
  assert.ok(stranger, 'a device present only in the folder must appear');
  assert.equal(stranger.hasBundle, true);
  assert.equal(stranger.name, 'Stranger PC');
  assert.equal(stranger.lastExportedAt, '2026-09-01T00:00:00.000Z');
  assert.equal(stranger.isSelf, false);
});

test('a file with no record is not listed, whatever it is called', () => {
  // Nothing is known about it — unreadable, or not identified yet — and
  // its name is not evidence of anything.
  const rows = listSyncDevices({ fileNames: ['backup-device-k3x-ab12.json', 'backup-device-k3x-ab12 (1).json'] });
  assert.deepEqual(rows.map((r) => r.id), ['my-device']);
});

test('this device\'s own file is never listed as a peer', () => {
  recordFileDevices({ 'backup-my-device.json': { id: 'my-device' }, 'backup-kitchen.json': { id: 'kitchen' } });
  const rows = listSyncDevices({ fileNames: ['backup-my-device.json', 'backup-kitchen.json'] });
  assert.equal(rows.filter((r) => r.id === 'my-device').length, 1, 'exactly one row for this device');
  assert.equal(rows.find((r) => r.id === 'my-device').isSelf, true);
});

test('a deleted device whose file resurfaces is not listed', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  deleteDevice('kitchen');
  recordFileDevices({ 'backup-kitchen.json': { id: 'kitchen' } });
  const rows = listSyncDevices({ fileNames: ['backup-kitchen.json'] });
  assert.equal(rows.some((r) => r.id === 'kitchen'), false, 'the sync cycle removes it again; it is not a device to offer');
});

test('non-backup files in the folder are not mistaken for devices', () => {
  const rows = listSyncDevices({ fileNames: ['notes.txt', 'backup-.json', 'backup-real.json.tmp'] });
  assert.deepEqual(rows.map((r) => r.id), ['my-device']);
});

test('the same device found in both the registry and the folder is listed once', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  recordFileDevices({ 'backup-kitchen.json': { id: 'kitchen', name: 'Old Name' } });
  const rows = listSyncDevices({ fileNames: ['backup-kitchen.json'] });
  assert.equal(rows.filter((r) => r.id === 'kitchen').length, 1);
  assert.equal(rows.find((r) => r.id === 'kitchen').name, 'Kitchen PC', 'the registry\'s name wins');
});

test('without a folder listing, hasBundle is unknown rather than false', () => {
  mergedPeer('kitchen', 'Kitchen PC');
  const kitchen = listSyncDevices().find((r) => r.id === 'kitchen');
  assert.equal(kitchen.hasBundle, null, '"no backup file" is a claim about the folder and must not be made without looking');
});

test('this device\'s row carries the time it last published', async () => {
  const { recordOwnPublished } = await import('../src/sync/last-sync-status.js');
  const at = '2026-09-15T12:00:00.000Z';
  recordOwnPublished(at);
  assert.equal(listSyncDevices().find((r) => r.isSelf).lastExportedAt, at);
});

test('this device\'s row has no publish time until it has published', () => {
  assert.equal(listSyncDevices().find((r) => r.isSelf).lastExportedAt, null);
});
