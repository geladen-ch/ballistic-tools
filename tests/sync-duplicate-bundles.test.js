// Several backup files for one device — the "backup-<id> (1).json" a browser
// without folder access saves beside the original. Only the newest by the
// `exportedAt` inside the file may count, the older copies go, and none of
// it may show up as a second device.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { pickFolder, removeBackupFile } = await import('../src/sync/fs-folder.js');
const { buildBackupBundle, serializeBackupBundle } = await import('../src/sync/backup-bundle.js');
const { selectLatestPerDevice } = await import('../src/sync/duplicate-bundles.js');
const { runSyncCycle } = await import('../src/sync/auto-sync.js');
const { importPickedFiles } = await import('../src/sync/manual-sync.js');
const { getPersistedSyncLog, clearPersistedSyncLog, clearSyncLog } = await import('../src/sync/sync-log.js');
const { listSyncDevices, deleteSyncDevice, identifyBackupFiles } = await import('../src/sync/device-deletion.js');
const {
  deleteDevice, recordPeerDevice, recordPeerExportedAtSeen, getDeviceTombstones, isDeviceDeleted, mergeDeviceTombstones
} = await import('../src/sync/device-registry.js');
const { getFileDevices, recordFileDevices } = await import('../src/sync/last-sync-status.js');
const { saveUserBullet, loadUserBullets } = await import('../src/user-library.js');
const { resetLocationLibraryForTests } = await import('../src/location-library.js');
const { resetRiflePrecisionLibraryForTests } = await import('../src/rifle-precision-library.js');
const { resetPendingReviewForTests } = await import('../src/sync/pending-review.js');
const { setBackupSyncEnabled } = await import('../src/backup-sync-prefs.js');

// A fake folder that can also delete, and can be told to refuse — which is
// what a folder opened read-only, or a cloud client holding the file, look
// like from here.
function makeDir(entries = {}, { refuseRemove = false } = {}) {
  return {
    kind: 'directory',
    async *entries() {
      for (const [name, entry] of Object.entries(entries)) yield [name, entry];
    },
    async getFileHandle(name, { create } = {}) {
      if (!(name in entries) && !create) throw new Error(`not found: ${name}`);
      if (!(name in entries)) entries[name] = { kind: 'file', content: '' };
      return {
        kind: 'file',
        async getFile() {
          const content = entries[name].content;
          return { text: async () => content, arrayBuffer: async () => new TextEncoder().encode(content).buffer, type: '' };
        },
        async createWritable() {
          return { async write(value) { entries[name].content = value; }, async close() {} };
        }
      };
    },
    async getDirectoryHandle(name) {
      throw new Error(`not found: ${name}`);
    },
    async removeEntry(name) {
      if (refuseRemove) {
        const err = new Error('The request is not allowed by the user agent or the platform');
        err.name = 'NotAllowedError';
        throw err;
      }
      if (!(name in entries)) {
        const err = new Error(`not found: ${name}`);
        err.name = 'NotFoundError';
        throw err;
      }
      delete entries[name];
    },
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    _entries: entries
  };
}

// A serialized bundle from `deviceId` whose only bullet is `bulletName`,
// stamped with the given export time. Built by impersonating that device on
// an empty slate — so the bundle carries nothing of this device's own state,
// its tombstones included — and then putting this device's state back exactly
// as it was.
function peerFile(deviceId, deviceName, bulletName, exportedAt) {
  const saved = Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((key) => [key, localStorage.getItem(key)]));
  localStorage.clear();
  localStorage.setItem('ballistics_device_id_v1', deviceId);
  localStorage.setItem('ballistics_device_name_v1', JSON.stringify({ name: deviceName, modifiedAt: '2021-01-01T00:00:00.000Z' }));
  saveUserBullet({
    id: `bullet-${bulletName}`, name: bulletName, manufacturer: 'M', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }, modifiedAt: '2021-06-01T00:00:00.000Z', modifiedBy: deviceId
  });
  const bundle = buildBackupBundle();
  bundle.exportedAt = exportedAt;
  const text = serializeBackupBundle(bundle);
  localStorage.clear();
  for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value);
  return text;
}


// A peer this device has merged up to `mergedAt` and then deleted, which is
// what a real deletion records.
function deletedPeer(id, name, mergedAt) {
  recordPeerDevice({ id, name, modifiedAt: '2021-01-01T00:00:00.000Z' });
  recordPeerExportedAtSeen(id, mergedAt);
  deleteDevice(id, { by: 'my-device' });
}

// Like peerFile(), for a bundle that also carries device tombstones.
function peerFileWithTombstones(deviceId, deviceName, bulletName, exportedAt, tombstones) {
  const text = peerFile(deviceId, deviceName, bulletName, exportedAt);
  const bundle = JSON.parse(text);
  bundle.devicesDeleted = tombstones;
  return JSON.stringify(bundle);
}

const OLD = '2026-03-01T10:00:00.000Z';
const NEW = '2026-04-01T10:00:00.000Z';

async function useFolder(dir) {
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();
}

test.beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true);
  await resetLocationLibraryForTests();
  await resetRiflePrecisionLibraryForTests();
  await resetPendingReviewForTests();
  clearSyncLog();
  await clearPersistedSyncLog();
  delete global.navigator.locks;
});

// ---- selectLatestPerDevice ----

const entry = (fileName, deviceId, exportedAt) => ({ fileName, bundle: { device: { id: deviceId }, exportedAt } });

test('selectLatestPerDevice keeps the newest export per device, whatever the file names say', () => {
  const { latest, superseded } = selectLatestPerDevice([
    entry('backup-a.json', 'a', NEW),
    entry('backup-a (1).json', 'a', OLD),
    entry('backup-b.json', 'b', OLD),
    entry('backup-b (1).json', 'b', NEW)
  ]);
  assert.deepEqual(latest.map((e) => e.fileName), ['backup-a.json', 'backup-b (1).json']);
  assert.deepEqual(superseded.map((e) => [e.fileName, e.supersededBy]), [
    ['backup-a (1).json', 'backup-a.json'],
    ['backup-b.json', 'backup-b (1).json']
  ]);
});

test('selectLatestPerDevice groups by the id inside the bundle, not by the file name', () => {
  const { latest, superseded } = selectLatestPerDevice([
    entry('backup-a.json', 'a', OLD),
    entry('backup-something-else.json', 'a', NEW)
  ]);
  assert.deepEqual(latest.map((e) => e.fileName), ['backup-something-else.json']);
  assert.equal(superseded.length, 1);
});

test('selectLatestPerDevice leaves distinct devices alone', () => {
  const { latest, superseded } = selectLatestPerDevice([entry('backup-a.json', 'a', OLD), entry('backup-b.json', 'b', OLD)]);
  assert.equal(latest.length, 2);
  assert.equal(superseded.length, 0);
});

test('an exact tie is settled the same way whatever order the files arrive in, so two devices never each delete the copy the other kept', () => {
  const a = entry('backup-a (1).json', 'a', NEW);
  const b = entry('backup-a.json', 'a', NEW);
  const forward = selectLatestPerDevice([a, b]).latest[0].fileName;
  const backward = selectLatestPerDevice([b, a]).latest[0].fileName;
  assert.equal(forward, backward);
});

test('an unparseable exportedAt ranks below a real one instead of throwing', () => {
  const { latest } = selectLatestPerDevice([
    entry('backup-a.json', 'a', 'not a date'),
    entry('backup-a (1).json', 'a', OLD)
  ]);
  assert.equal(latest[0].fileName, 'backup-a (1).json');
});

// ---- removeBackupFile ----

test('removeBackupFile removes a backup file by its exact name', async () => {
  const dir = makeDir({ 'backup-a (1).json': { kind: 'file', content: '' }, 'backup-a.json': { kind: 'file', content: '' } });
  await removeBackupFile(dir, 'backup-a (1).json');
  assert.deepEqual(Object.keys(dir._entries), ['backup-a.json']);
});

test('removeBackupFile treats an already-gone file as removed', async () => {
  assert.equal(await removeBackupFile(makeDir({}), 'backup-a (1).json'), true);
});

test('removeBackupFile refuses anything that is not a backup file name', async () => {
  const dir = makeDir({ 'photo.jpg': { kind: 'file', content: '' } });
  await assert.rejects(() => removeBackupFile(dir, 'photo.jpg'), /not a backup/);
  assert.ok('photo.jpg' in dir._entries);
});

// ---- the sync cycle ----

test('a sync cycle merges only the newest of two files for one device, and removes the older, logging a warning', async () => {
  const dir = makeDir({
    'backup-peer-1.json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'Old Bullet', OLD) },
    'backup-peer-1 (1).json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'New Bullet', NEW) }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.deepEqual(loadUserBullets().map((b) => b.name), ['New Bullet']);
  assert.ok(!('backup-peer-1.json' in dir._entries), 'the older file is removed');
  assert.ok('backup-peer-1 (1).json' in dir._entries, 'the newer file stays');

  const warnings = (await getPersistedSyncLog()).filter((line) => /WARN/.test(line) && /removed backup-peer-1\.json/.test(line));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /superseded by backup-peer-1 \(1\)\.json/);
  assert.match(warnings[0], /2026-03-01/);
});

test('the older file goes even when it carries the canonical name, and the newer is left under its own', async () => {
  // The Firefox case: the first download is backup-<id>.json, every later
  // one is "(1)", "(2)" — so the newest is the one with the suffix.
  const dir = makeDir({
    'backup-peer-1.json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'First', '2026-01-01T00:00:00.000Z') },
    'backup-peer-1(1).json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'Second', '2026-02-01T00:00:00.000Z') },
    'backup-peer-1(2).json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'Third', '2026-03-01T00:00:00.000Z') }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.deepEqual(loadUserBullets().map((b) => b.name), ['Third']);
  assert.ok(!('backup-peer-1.json' in dir._entries) && !('backup-peer-1(1).json' in dir._entries));
  assert.ok('backup-peer-1(2).json' in dir._entries);
  const warnings = (await getPersistedSyncLog()).filter((line) => /WARN.*removed/.test(line));
  assert.equal(warnings.length, 2);
});

test('when the folder will not let the older file go, the newest is still the one merged, and a warning says so', async () => {
  const dir = makeDir({
    'backup-peer-1.json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'Old Bullet', OLD) },
    'backup-peer-1 (1).json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'New Bullet', NEW) }
  }, { refuseRemove: true });
  await useFolder(dir);

  await runSyncCycle();

  assert.deepEqual(loadUserBullets().map((b) => b.name), ['New Bullet']);
  assert.ok('backup-peer-1.json' in dir._entries, 'nothing was removed');
  const warnings = (await getPersistedSyncLog()).filter((line) => /WARN.*could not remove superseded backup-peer-1\.json/.test(line));
  assert.equal(warnings.length, 1);
});

test('an unreadable file is neither merged nor mistaken for a duplicate, so it is never removed', async () => {
  const dir = makeDir({
    'backup-peer-1.json': { kind: 'file', content: peerFile('peer-1', 'Peer', 'Good Bullet', NEW) },
    'backup-peer-1 (1).json': { kind: 'file', content: '{"format": "ebalka2-back' } // still downloading
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.deepEqual(loadUserBullets().map((b) => b.name), ['Good Bullet']);
  assert.ok('backup-peer-1 (1).json' in dir._entries);
});

test('two different devices are both merged and neither is removed', async () => {
  const dir = makeDir({
    'backup-peer-1.json': { kind: 'file', content: peerFile('peer-1', 'One', 'Bullet One', OLD) },
    'backup-peer-2.json': { kind: 'file', content: peerFile('peer-2', 'Two', 'Bullet Two', NEW) }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.deepEqual(loadUserBullets().map((b) => b.name).sort(), ['Bullet One', 'Bullet Two']);
  assert.ok('backup-peer-1.json' in dir._entries && 'backup-peer-2.json' in dir._entries);
});

test('a lone copy of this device\'s own bundle under another name is never merged, and has nothing older to be removed against', async () => {
  const dir = makeDir({
    'backup-my-device (1).json': { kind: 'file', content: peerFile('my-device', 'Me', 'Own Old Bullet', OLD) }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.ok(!loadUserBullets().some((b) => b.name === 'Own Old Bullet'));
  assert.ok('backup-my-device (1).json' in dir._entries);
});

test('an older own-id copy is removed and this device\'s own file is left in place', async () => {
  const dir = makeDir({
    'backup-my-device.json': { kind: 'file', content: peerFile('my-device', 'Me', 'Current', NEW) },
    'backup-my-device (1).json': { kind: 'file', content: peerFile('my-device', 'Me', 'Stale', OLD) }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.ok(!('backup-my-device (1).json' in dir._entries), 'the older copy goes');
  assert.ok('backup-my-device.json' in dir._entries, 'this device\'s own file stays');
  assert.ok(!loadUserBullets().some((b) => b.name === 'Stale'), 'and it is never merged back in');
  const warnings = (await getPersistedSyncLog()).filter((line) => /WARN.*removed backup-my-device \(1\)\.json/.test(line));
  assert.equal(warnings.length, 1);
});

test('of several own-id copies only the newest survives', async () => {
  const dir = makeDir({
    'backup-my-device (1).json': { kind: 'file', content: peerFile('my-device', 'Me', 'A', '2026-01-01T00:00:00.000Z') },
    'backup-my-device (2).json': { kind: 'file', content: peerFile('my-device', 'Me', 'B', '2026-02-01T00:00:00.000Z') },
    'backup-my-device (3).json': { kind: 'file', content: peerFile('my-device', 'Me', 'C', '2026-03-01T00:00:00.000Z') }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.ok(!('backup-my-device (1).json' in dir._entries) && !('backup-my-device (2).json' in dir._entries));
  assert.ok('backup-my-device (3).json' in dir._entries);
});

test('an own-id copy newer than this device\'s own file supersedes it, and this device republishes its own file', async () => {
  // Judged like any other device by what is inside: the newest file with
  // this device's id stays, the rest go — including the one under this
  // device's own name if it is the older. It is then simply rewritten,
  // since there is nothing at the place this device publishes to.
  const dir = makeDir({
    'backup-my-device.json': { kind: 'file', content: peerFile('my-device', 'Me', 'Current', OLD) },
    'backup-my-device (1).json': { kind: 'file', content: peerFile('my-device', 'Me', 'Fresh', NEW) }
  });
  await useFolder(dir);

  await runSyncCycle();

  const removals = (await getPersistedSyncLog()).filter((line) => /WARN.*removed backup-my-device\.json/.test(line));
  assert.equal(removals.length, 1, 'the older file goes even though it has this device\'s own name');
  assert.ok('backup-my-device.json' in dir._entries, 'and this device republished its own file');
  assert.ok(Date.parse(JSON.parse(dir._entries['backup-my-device.json'].content).exportedAt) > Date.parse(NEW));
  assert.ok('backup-my-device (1).json' in dir._entries, 'the newer copy stays until the fresh file is the newer');
});

test('with this device\'s own file the newest again, the copy is removed on the next cycle', async () => {
  const dir = makeDir({
    'backup-my-device (1).json': { kind: 'file', content: peerFile('my-device', 'Me', 'Copy', NEW) }
  });
  await useFolder(dir);

  await runSyncCycle(); // publishes backup-my-device.json, newer than the copy
  await runSyncCycle();

  assert.ok(!('backup-my-device (1).json' in dir._entries));
  assert.ok('backup-my-device.json' in dir._entries);
});

test('an unreadable own file does not stop the older copies being judged among themselves', async () => {
  const dir = makeDir({
    'backup-my-device.json': { kind: 'file', content: '{"format": "ebalka2-back' },
    'backup-my-device (1).json': { kind: 'file', content: peerFile('my-device', 'Me', 'A', OLD) },
    'backup-my-device (2).json': { kind: 'file', content: peerFile('my-device', 'Me', 'B', NEW) }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.ok(!('backup-my-device (1).json' in dir._entries));
  assert.ok('backup-my-device (2).json' in dir._entries);
});

test('the resurfaced file of a deleted device is removed under whatever name it has, along with its older copies', async () => {
  const dir = makeDir({
    'backup-peer-1.json': { kind: 'file', content: peerFile('peer-1', 'Retired', 'Old Bullet', OLD) },
    'backup-peer-1 (1).json': { kind: 'file', content: peerFile('peer-1', 'Retired', 'New Bullet', NEW) }
  });
  deletedPeer('peer-1', 'Retired', NEW);
  await useFolder(dir);

  await runSyncCycle();

  assert.ok(!Object.keys(dir._entries).some((name) => name.startsWith('backup-peer-1')));
  assert.equal(loadUserBullets().length, 0);
});

// ---- manual import from picked files ----

const pickedFile = (name, content) => ({ name, text: async () => content });

test('importing picked files uses only the newest of several copies for a device', async () => {
  const result = await importPickedFiles([
    pickedFile('backup-peer-1.json', peerFile('peer-1', 'Firefox laptop', 'Old Bullet', OLD)),
    pickedFile('backup-peer-1 (1).json', peerFile('peer-1', 'Firefox laptop', 'New Bullet', NEW))
  ]);

  assert.deepEqual(loadUserBullets().map((b) => b.name), ['New Bullet']);
  assert.deepEqual(result.devices, ['Firefox laptop'], 'the device is listed once');
});

// ---- the Devices list ----

test('two files for one device the registry has never heard of are one row, whatever they are called', () => {
  recordFileDevices({
    'backup-first.json': { id: 'device-k3x-ab12', name: 'Firefox laptop', exportedAt: OLD },
    'backup-second-copy.json': { id: 'device-k3x-ab12', name: 'Firefox laptop', exportedAt: NEW }
  });
  const rows = listSyncDevices({ fileNames: ['backup-first.json', 'backup-second-copy.json'] }).filter((d) => !d.isSelf);
  assert.deepEqual(rows.map((r) => [r.id, r.name, r.lastExportedAt]), [['device-k3x-ab12', 'Firefox laptop', NEW]]);
});

test('a known device whose only file has an unrelated name still has its backup file', () => {
  recordPeerDevice({ id: 'peer-1', name: 'Firefox laptop', nameModifiedAt: '2021-01-01T00:00:00.000Z' });
  recordFileDevices({ 'backup-peer-1 (1).json': { id: 'peer-1' }, 'backup-something-else.json': { id: 'peer-2' } });
  const devices = listSyncDevices({ fileNames: ['backup-something-else.json'] });
  assert.equal(devices.find((d) => d.id === 'peer-1').hasBundle, false, 'that file holds peer-2, whatever peer-1 might be guessed from it');
});

test('a file that looks like it belongs to a device but holds another is attributed by what it holds', () => {
  recordPeerDevice({ id: 'peer-1', name: 'One', nameModifiedAt: '2021-01-01T00:00:00.000Z' });
  recordFileDevices({ 'backup-peer-1.json': { id: 'peer-2', name: 'Two', exportedAt: NEW } });
  const rows = listSyncDevices({ fileNames: ['backup-peer-1.json'] });
  assert.equal(rows.find((d) => d.id === 'peer-1').hasBundle, false);
  assert.equal(rows.find((d) => d.id === 'peer-2').hasBundle, true);
});

test('a copy of a deleted device\'s file is not listed, under any name', () => {
  deletedPeer('peer-1', 'Retired', NEW);
  recordFileDevices({ 'my copy.json': { id: 'peer-1' } });
  const devices = listSyncDevices({ fileNames: ['my copy.json'] });
  assert.equal(devices.filter((d) => !d.isSelf).length, 0);
});

test('a deleted device that publishes again is back in the loop, and its older stale copy is tidied away', async () => {
  deletedPeer('peer-1', 'Retired', NEW);
  const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const dir = makeDir({
    'backup-peer-1.json': { kind: 'file', content: peerFile('peer-1', 'Retired', 'Stale Bullet', OLD) },
    'backup-peer-1 (1).json': { kind: 'file', content: peerFile('peer-1', 'Retired', 'Back Bullet', soon) }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.deepEqual(loadUserBullets().map((b) => b.name), ['Back Bullet'], 'the returning device is merged again');
  assert.ok('backup-peer-1 (1).json' in dir._entries, 'its current file stays');
  assert.ok(!('backup-peer-1.json' in dir._entries));
  assert.equal(listSyncDevices({ fileNames: Object.keys(dir._entries) }).some((d) => d.id === 'peer-1'), true, 'and it is listed again');
  assert.equal(isDeviceDeleted('peer-1'), false);
  assert.deepEqual(getDeviceTombstones(), [], 'its tombstone is dropped, so this device stops publishing it');
});

// ---- a deletion made where files cannot be removed, reaching where they can ----

test('a tombstone in one file applies to the deleted device\'s file even when that file is read first', async () => {
  // Read order is the folder's, and the deleted device's file can come before
  // the bundle that carries its tombstone. Tombstones are taken in from every
  // file before any is judged, so the order cannot matter.
  const dir = makeDir({
    'backup-a-deleted-device.json': { kind: 'file', content: peerFile('deleted-1', 'Retired', 'Stale', OLD) },
    'backup-b-firefox.json': {
      kind: 'file',
      content: peerFileWithTombstones('firefox-1', 'Firefox laptop', 'Kept', NEW, [{ id: 'deleted-1', upTo: OLD, deletedOn: NEW, by: 'firefox-1' }])
    }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.deepEqual(loadUserBullets().map((b) => b.name), ['Kept'], 'the deleted device\'s bundle was never merged');
  assert.ok(!('backup-a-deleted-device.json' in dir._entries), 'a device that can remove files removes it');
  assert.ok('backup-b-firefox.json' in dir._entries);
  const removals = (await getPersistedSyncLog()).filter((line) => /WARN.*removed backup-a-deleted-device\.json/.test(line));
  assert.equal(removals.length, 1, 'and says so in the persistent log');
});

test('learning a tombstone makes this device publish, so it is passed on', async () => {
  // The peer's bullet is merged in the first cycle, so the second brings
  // nothing but the tombstone: any publish that follows is because of it.
  const dir = makeDir({
    'backup-firefox.json': { kind: 'file', content: peerFileWithTombstones('firefox-1', 'Firefox laptop', 'X', OLD, []) }
  });
  await useFolder(dir);
  await runSyncCycle();
  const before = dir._entries['backup-my-device.json'].content;
  await runSyncCycle();
  assert.equal(dir._entries['backup-my-device.json'].content, before, 'with nothing new, nothing is republished');

  // The same bundle again, later, with one tombstone added and nothing else.
  const later = JSON.parse(dir._entries['backup-firefox.json'].content);
  later.exportedAt = NEW;
  later.devicesDeleted = [{ id: 'deleted-1', upTo: OLD, deletedOn: NEW, by: 'firefox-1' }];
  dir._entries['backup-firefox.json'].content = JSON.stringify(later);
  await runSyncCycle();

  const own = JSON.parse(dir._entries['backup-my-device.json'].content);
  assert.notEqual(dir._entries['backup-my-device.json'].content, before, 'republished, although only the tombstone was new');
  assert.deepEqual(own.devicesDeleted.map((t) => t.id), ['deleted-1']);
});

test('the manual import ignores a file of a deleted device, so it does not come back at the next Sync', async () => {
  // The defect this whole change is about: a browser that cannot remove the
  // file re-read it on the next Sync and the device reappeared.
  recordPeerDevice({ id: 'peer-1', name: 'Retired', modifiedAt: '2021-01-01T00:00:00.000Z' });
  recordPeerExportedAtSeen('peer-1', NEW);
  await deleteSyncDevice(null, 'peer-1');

  const result = await importPickedFiles([pickedFile('backup-peer-1.json', peerFile('peer-1', 'Retired', 'Stale Bullet', NEW))]);

  assert.deepEqual(result.devices, []);
  assert.equal(loadUserBullets().length, 0, 'nothing of it is merged');
  assert.equal(isDeviceDeleted('peer-1'), true, 'and reading the file did not undo the deletion');
  assert.equal(listSyncDevices().some((d) => d.id === 'peer-1'), false);
});

test('the tombstone survives an import and is still there for the export that follows it', async () => {
  // Sync imports first and exports second; the import used to clear the
  // tombstone, so it never reached anyone.
  recordPeerDevice({ id: 'peer-1', name: 'Retired', modifiedAt: '2021-01-01T00:00:00.000Z' });
  recordPeerExportedAtSeen('peer-1', NEW);
  await deleteSyncDevice(null, 'peer-1');

  await importPickedFiles([pickedFile('backup-peer-1.json', peerFile('peer-1', 'Retired', 'Stale', NEW))]);

  const exported = buildBackupBundle();
  assert.deepEqual(exported.devicesDeleted.map((t) => [t.id, t.upTo]), [['peer-1', NEW]]);
});

test('the manual import takes a tombstone from one picked file and applies it to another picked before it', async () => {
  const result = await importPickedFiles([
    pickedFile('backup-deleted-1.json', peerFile('deleted-1', 'Retired', 'Stale', OLD)),
    pickedFile('backup-firefox-1.json', peerFileWithTombstones('firefox-1', 'Firefox laptop', 'Kept', NEW,
      [{ id: 'deleted-1', upTo: OLD, deletedOn: NEW, by: 'firefox-1' }]))
  ]);

  assert.deepEqual(result.devices, ['Firefox laptop']);
  assert.deepEqual(loadUserBullets().map((b) => b.name), ['Kept']);
});

test('the manual import merges a deleted device that has published something later', async () => {
  deletedPeer('peer-1', 'Retired', OLD);

  const result = await importPickedFiles([pickedFile('backup-peer-1.json', peerFile('peer-1', 'Retired', 'Back Bullet', NEW))]);

  assert.deepEqual(result.devices, ['Retired']);
  assert.deepEqual(loadUserBullets().map((b) => b.name), ['Back Bullet']);
  assert.equal(isDeviceDeleted('peer-1'), false);
  assert.deepEqual(getDeviceTombstones(), [], 'and its tombstone is cleared here, to be cleared on every peer the same way');
});

test('a returning device ignores a tombstone naming itself, and republishes normally', async () => {
  // Device X comes back from the dead and reads a peer's bundle that still
  // lists X as deleted.
  const dir = makeDir({
    'backup-firefox.json': {
      kind: 'file',
      content: peerFileWithTombstones('firefox-1', 'Firefox laptop', 'Y', NEW, [{ id: 'my-device', upTo: OLD, deletedOn: NEW, by: 'firefox-1' }])
    }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.deepEqual(getDeviceTombstones(), [], 'no tombstone for itself is recorded');
  const own = JSON.parse(dir._entries['backup-my-device.json'].content);
  assert.deepEqual(own.devicesDeleted, [], 'and none is republished');
});

test('a peer still publishing the old tombstone does not undo a device that has since come back', async () => {
  // Two Chromium devices: this one has read X's new file; the other has not
  // yet, and still publishes the tombstone that this device already
  // superseded.
  deletedPeer('peer-1', 'Retired', OLD);
  const dir = makeDir({
    'backup-peer-1.json': { kind: 'file', content: peerFile('peer-1', 'Retired', 'Back', NEW) },
    'backup-slow.json': {
      kind: 'file',
      content: peerFileWithTombstones('slow-1', 'Slow', 'Z', NEW, [{ id: 'peer-1', upTo: OLD, deletedOn: OLD, by: 'slow-1' }])
    }
  });
  await useFolder(dir);

  await runSyncCycle();
  await runSyncCycle();

  assert.ok('backup-peer-1.json' in dir._entries, 'X\'s current file is not removed');
  assert.equal(isDeviceDeleted('peer-1'), false);
  assert.deepEqual(getDeviceTombstones(), []);
});

// ---- deleting a device from the list ----

test('deleting a device removes every file that holds its id, whatever the files are called', async () => {
  recordPeerDevice({ id: 'peer-1', name: 'Firefox laptop', nameModifiedAt: '2021-01-01T00:00:00.000Z' });
  recordPeerExportedAtSeen('peer-1', NEW);
  const dir = makeDir({
    'backup-first.json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'A', OLD) },
    'backup-peer-2.json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'B', NEW) },
    'backup-peer-1.json': { kind: 'file', content: peerFile('peer-2', 'Other', 'C', NEW) },
    'backup-half-downloaded.json': { kind: 'file', content: '{"format": "ebalka2-back' }
  });

  const result = await deleteSyncDevice(dir, 'peer-1');

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(Object.keys(dir._entries).sort(), ['backup-half-downloaded.json', 'backup-peer-1.json'],
    'the name backup-peer-1.json proves nothing: it holds peer-2, so it stays; an unreadable file cannot be told to be anyone\'s');
});

// ---- what each file holds is read from the file ----

test('a cycle records, for every file it read, the id, name and export time inside it', async () => {
  const dir = makeDir({
    'backup-something-arbitrary.json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'New', NEW) },
    'backup-peer-2.json': { kind: 'file', content: peerFile('peer-2', 'Two', 'Other', OLD) },
    'backup-half.json': { kind: 'file', content: '{"format": "ebalka2-back' }
  });
  await useFolder(dir);

  await runSyncCycle();

  const recorded = getFileDevices();
  assert.deepEqual(recorded['backup-something-arbitrary.json'], { id: 'peer-1', name: 'Firefox laptop', exportedAt: NEW });
  assert.equal(recorded['backup-peer-2.json'].id, 'peer-2');
  assert.ok(!('backup-half.json' in recorded), 'an unreadable file is not attributed to anyone');
});

test('this device\'s own file is read like any other, and identified by its id', async () => {
  const dir = makeDir({
    'backup-my-device.json': { kind: 'file', content: peerFile('my-device', 'Me', 'Mine', OLD) }
  });
  await useFolder(dir);

  await runSyncCycle();

  assert.equal(getFileDevices()['backup-my-device.json'].id, 'my-device');
  assert.deepEqual(loadUserBullets().map((b) => b.name), [], 'and it is never merged back into itself');
});

test('a surviving file with an unguessable name does not appear as a second device, and the real one still has its file', async () => {
  // The bug: the newest file kept its odd name, a guess from that name
  // mapped it to a device id of its own, and the list showed a nameless
  // extra device while the real one read "no backup file in the folder".
  const dir = makeDir({
    'backup-peer-1.json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'Old', OLD) },
    'backup-peer-1-firefox.json': { kind: 'file', content: peerFile('peer-1', 'Firefox laptop', 'New', NEW) }
  });
  await useFolder(dir);

  await runSyncCycle();

  const rows = listSyncDevices({ fileNames: Object.keys(dir._entries) }).filter((d) => !d.isSelf);
  assert.deepEqual(rows.map((r) => [r.id, r.name, r.hasBundle]), [['peer-1', 'Firefox laptop', true]]);
});

test('identifyBackupFiles reads a file no cycle has seen, records what is inside, and does not reopen it', async () => {
  const dir = makeDir({ 'export from friday.json': { kind: 'file', content: peerFile('peer-9', 'Friday PC', 'X', NEW) } });
  let reads = 0;
  const realGetFileHandle = dir.getFileHandle;
  dir.getFileHandle = async (...args) => { reads += 1; return realGetFileHandle(...args); };
  recordFileDevices({});

  await identifyBackupFiles(dir, ['export from friday.json']);
  assert.deepEqual(getFileDevices()['export from friday.json'], { id: 'peer-9', name: 'Friday PC', exportedAt: NEW });
  assert.equal(reads, 1);

  await identifyBackupFiles(dir, ['export from friday.json']);
  assert.equal(reads, 1, 'a file already recorded is not opened again on every repaint');
});

test('identifyBackupFiles leaves an unreadable file unlisted and does not keep retrying it', async () => {
  const dir = makeDir({ 'backup-broken-file-xyz.json': { kind: 'file', content: 'not json' } });
  let reads = 0;
  const realGetFileHandle = dir.getFileHandle;
  dir.getFileHandle = async (...args) => { reads += 1; return realGetFileHandle(...args); };
  recordFileDevices({});

  await identifyBackupFiles(dir, ['backup-broken-file-xyz.json']);
  await identifyBackupFiles(dir, ['backup-broken-file-xyz.json']);

  assert.deepEqual(getFileDevices(), {});
  assert.equal(reads, 1);
});

test('identifyBackupFiles forgets files that have left the folder', async () => {
  recordFileDevices({ 'backup-gone.json': { id: 'peer-1' } });
  const dir = makeDir({ 'backup-new.json': { kind: 'file', content: peerFile('peer-2', 'New', 'Y', NEW) } });

  await identifyBackupFiles(dir, ['backup-new.json']);

  assert.deepEqual(Object.keys(getFileDevices()), ['backup-new.json']);
});

test('a record written by the previous build, a bare id per file, is still understood', () => {
  localStorage.setItem('ballistics_backup_file_devices_v1', JSON.stringify({ 'backup-x.json': 'peer-1' }));
  assert.deepEqual(getFileDevices(), { 'backup-x.json': { id: 'peer-1', name: null, exportedAt: null } });
});
