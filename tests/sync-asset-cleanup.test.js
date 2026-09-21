// Reclaiming unused photo assets — docs/plans/orphaned-storage-cleanup.md
// phase 5. The invariant running through every test here: a file is only
// ever removed when nothing references it *and* this device has watched it
// sit unreferenced for the full grace period, and nothing in the pass ever
// opens an asset file to decide anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const {
  runAssetCleanup, GRACE_MS,
  shouldRunAssetCleanupNow, recordAssetCleanupRun, getAssetCleanupStatus
} = await import('../src/sync/asset-cleanup.js');
const {
  resetAssetStateForTests, recordAssetsSeen, listAssetState
} = await import('../src/sync/asset-state.js');
const { resetLocationLibraryForTests, saveUserLocation } = await import('../src/location-library.js');
const { resetRiflePrecisionLibraryForTests } = await import('../src/rifle-precision-library.js');
const { generateUserId } = await import('../src/user-library.js');

// Tracks every getFile() call so a test can assert that the pass never
// opens an asset — the whole design rests on not doing that.
let assetFileOpens = [];

function makeFakeDirHandle(entries = {}) {
  return {
    kind: 'directory',
    async *entries() {
      for (const [name, entry] of Object.entries(entries)) yield [name, entry];
    },
    async getFileHandle(name, { create } = {}) {
      if (!(name in entries) && !create) {
        const err = new Error(`not found: ${name}`);
        err.name = 'NotFoundError';
        throw err;
      }
      if (!(name in entries)) entries[name] = { kind: 'file', content: '' };
      return {
        kind: 'file',
        async getFile() {
          if (/^sha256-/.test(name)) assetFileOpens.push(name);
          const content = entries[name].content;
          return {
            text: async () => content,
            arrayBuffer: async () => new TextEncoder().encode(content).buffer,
            type: ''
          };
        },
        async createWritable() {
          return { async write(value) { entries[name].content = value; }, async close() {} };
        }
      };
    },
    async getDirectoryHandle(name, { create } = {}) {
      if (!(name in entries)) {
        if (!create) {
          const err = new Error(`not found: ${name}`);
          err.name = 'NotFoundError';
          throw err;
        }
        entries[name] = { kind: 'directory', children: {} };
      }
      return makeFakeDirHandle(entries[name].children);
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

const REF_A = `sha256-${'a'.repeat(64)}`;
const REF_B = `sha256-${'b'.repeat(64)}`;
const REF_C = `sha256-${'c'.repeat(64)}`;

function bundleFile(deviceId, refs, { photoStorage = 'referenced', name } = {}) {
  return {
    kind: 'file',
    content: JSON.stringify({
      format: 'ebalka2-backup', version: 1, photoStorage,
      device: { id: deviceId, name: name || deviceId, modifiedAt: '2026-01-01T00:00:00.000Z' },
      exportedAt: new Date().toISOString(),
      arsenal: { bullets: [], rifles: [] },
      locations: { locations: refs.map((ref, i) => ({ id: `loc${i}`, name: `L${i}`, photoRef: ref, targets: [] })) },
      riflePrecision: { projects: [] }
    })
  };
}

function folderWith({ bundles = {}, assets = [] } = {}) {
  const assetEntries = {};
  for (const ref of assets) assetEntries[`${ref}.jpg`] = { kind: 'file', content: 'bytes' };
  return makeFakeDirHandle({ ...bundles, assets: { kind: 'directory', children: assetEntries } });
}

// Ages a ref so it is past the grace period, by rewriting its firstSeenAt.
async function ageRefs(refs) {
  const { getAssetState } = await import('../src/sync/asset-state.js');
  const old = new Date(Date.now() - GRACE_MS - 60_000).toISOString();
  const { openDatabase, put } = await import('../src/db.js');
  const { DB_NAME, DB_VERSION, STORES } = await import('../src/db-schema.js');
  const db = await openDatabase({ name: DB_NAME, version: DB_VERSION, stores: STORES });
  for (const ref of refs) {
    const state = getAssetState(ref) || { id: ref };
    await put(db, 'asset-state', { ...state, firstSeenAt: old });
  }
  const { reloadAssetStateForTests } = await import('../src/sync/asset-state.js');
  await reloadAssetStateForTests();
}

test.beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  assetFileOpens = [];
  await resetAssetStateForTests();
  await resetLocationLibraryForTests();
  await resetRiflePrecisionLibraryForTests();
});

test('a folder with no assets/ directory is a clean no-op', async () => {
  const dir = makeFakeDirHandle({ 'backup-peer.json': bundleFile('peer', []) });
  const report = await runAssetCleanup(dir);
  assert.equal(report.outcome, 'no-assets');
  assert.deepEqual(report.removed, []);
});

test('an asset first seen on this pass is recorded but never removed on it', async () => {
  const dir = folderWith({ bundles: { 'backup-peer.json': bundleFile('peer', []) }, assets: [REF_A] });
  const report = await runAssetCleanup(dir);

  assert.equal(report.outcome, 'completed');
  assert.deepEqual(report.removed, [], 'the grace period starts now, so nothing is eligible yet');
  assert.deepEqual(listAssetState().map((s) => s.id), [REF_A]);
});

test('an unreferenced asset past its grace period is removed', async () => {
  const dir = folderWith({ bundles: { 'backup-peer.json': bundleFile('peer', []) }, assets: [REF_A] });
  await recordAssetsSeen([REF_A]);
  await ageRefs([REF_A]);

  const report = await runAssetCleanup(dir);
  assert.equal(report.outcome, 'completed');
  assert.deepEqual(report.removed, [`${REF_A}.jpg`]);
  assert.equal(Object.keys(dir._entries.assets.children).length, 0);
});

test('an asset a peer bundle still references is never a candidate', async () => {
  const dir = folderWith({ bundles: { 'backup-peer.json': bundleFile('peer', [REF_A]) }, assets: [REF_A] });
  await recordAssetsSeen([REF_A]);
  await ageRefs([REF_A]);

  const report = await runAssetCleanup(dir);
  assert.deepEqual(report.removed, []);
  assert.equal(report.candidates, 0);
});

test('an asset only this device\'s own published bundle references is never a candidate', async () => {
  // The sync loop skips its own file, but peers still read it: a photo
  // deleted locally is still referenced by what we last published.
  const dir = folderWith({ bundles: { 'backup-my-device.json': bundleFile('my-device', [REF_A]) }, assets: [REF_A] });
  await recordAssetsSeen([REF_A]);
  await ageRefs([REF_A]);

  const report = await runAssetCleanup(dir);
  assert.deepEqual(report.removed, []);
});

test('an unpublished local photo protects its asset', async () => {
  // A photo edited locally but not yet published appears in no bundle at
  // all; source (b) is the only thing standing between it and deletion.
  const photo = 'data:image/jpeg;base64,aGVsbG8gd29ybGQ=';
  const { photoRefFor } = await import('../src/sync/photo-assets.js');
  const ref = await photoRefFor(photo);

  saveUserLocation({ id: generateUserId('location'), name: 'Range', photo, targets: [] });
  const dir = folderWith({ bundles: { 'backup-peer.json': bundleFile('peer', []) }, assets: [ref] });
  await recordAssetsSeen([ref]);
  await ageRefs([ref]);

  const report = await runAssetCleanup(dir);
  assert.deepEqual(report.removed, [], 'a photo this device holds must never be treated as an orphan');
});

test('the pass never opens an asset file', async () => {
  const dir = folderWith({ bundles: { 'backup-peer.json': bundleFile('peer', [REF_B]) }, assets: [REF_A, REF_B] });
  await recordAssetsSeen([REF_A, REF_B]);
  await ageRefs([REF_A, REF_B]);

  await runAssetCleanup(dir);
  assert.deepEqual(assetFileOpens, [],
    'deciding anything from a file\'s own metadata is what this design exists to avoid');
});

test('a file whose name is not ours is counted but never touched', async () => {
  const dir = folderWith({ bundles: { 'backup-peer.json': bundleFile('peer', []) }, assets: [REF_A] });
  dir._entries.assets.children['holiday.jpg'] = { kind: 'file', content: 'not ours' };
  await recordAssetsSeen([REF_A]);
  await ageRefs([REF_A]);

  const report = await runAssetCleanup(dir);
  assert.deepEqual(report.malformed, ['holiday.jpg']);
  assert.ok(dir._entries.assets.children['holiday.jpg'], 'a user\'s own file in that folder is not ours to delete');
});

test('an unreadable backup file stops the run without deleting anything', async () => {
  const dir = folderWith({
    bundles: { 'backup-peer.json': { kind: 'file', content: '{ truncated' } },
    assets: [REF_A]
  });
  await recordAssetsSeen([REF_A]);
  await ageRefs([REF_A]);

  const report = await runAssetCleanup(dir);
  assert.equal(report.outcome, 'parse-failure');
  assert.deepEqual(report.removed, [], 'a partial view of the references is the one way this can lose a photo');
});

test('a parse failure does not advance the throttle, so the next cycle retries', async () => {
  recordAssetCleanupRun({ outcome: 'parse-failure', removed: [], removedBytes: 0, bytesKnown: true, failedCheck: null, affectedDevices: [] });
  assert.equal(getAssetCleanupStatus(), null);
  assert.equal(shouldRunAssetCleanupNow(), true);
});

test('a completed run advances the throttle, a hard stop does too', async () => {
  recordAssetCleanupRun({ outcome: 'completed', removed: [], removedBytes: 0, bytesKnown: true, failedCheck: null, affectedDevices: [] });
  assert.equal(shouldRunAssetCleanupNow(), false, 'a run with nothing to remove still counts as a run');

  localStorage.removeItem('ballistics_asset_cleanup_last_run_v1');
  recordAssetCleanupRun({ outcome: 'hard-stop', removed: [], removedBytes: 0, bytesKnown: true, failedCheck: 'attribution', affectedDevices: [] });
  assert.equal(shouldRunAssetCleanupNow(), false,
    'a failed invariant will not fix itself; rescanning every five minutes changes nothing');
});

test('a record that kept photoMime but lost photoRef is a hard stop naming the device', async () => {
  // The two fields are written together and only together, so one without
  // the other means a reference this pass needs has gone missing — and
  // acting on a reference set with a known hole is how a photo somebody is
  // still using would get deleted.
  const broken = bundleFile('peer-1', [], { name: 'Kitchen PC' });
  const parsed = JSON.parse(broken.content);
  parsed.locations.locations = [{ id: 'loc-x', name: 'X', photoMime: 'image/jpeg', targets: [] }];
  broken.content = JSON.stringify(parsed);

  const dir = folderWith({ bundles: { 'backup-peer.json': broken }, assets: [REF_A] });
  await recordAssetsSeen([REF_A]);
  await ageRefs([REF_A]);

  const report = await runAssetCleanup(dir);
  assert.equal(report.outcome, 'hard-stop');
  assert.equal(report.failedCheck, 'bundle-lists-no-photos');
  assert.deepEqual(report.removed, []);
  assert.equal(report.affectedDevices[0].name, 'Kitchen PC');
});

test('a peer that simply owns no photos is not an anomaly', async () => {
  // applyReferencedPhotoStorage() sets photoStorage: 'referenced'
  // unconditionally, so a device with an empty library publishes exactly
  // that shape. Treating it as a broken parse would hard-stop cleanup on a
  // completely healthy folder whose assets all belong to other peers.
  const dir = folderWith({
    bundles: {
      'backup-empty.json': bundleFile('empty-peer', []),
      'backup-owner.json': bundleFile('owner', [REF_B])
    },
    assets: [REF_A, REF_B]
  });
  await recordAssetsSeen([REF_A, REF_B]);
  await ageRefs([REF_A, REF_B]);

  const report = await runAssetCleanup(dir);
  assert.equal(report.outcome, 'completed');
  assert.deepEqual(report.removed, [`${REF_A}.jpg`]);
});

test('an all-inline folder is an explanation, not an anomaly, and cleanup proceeds', async () => {
  const dir = folderWith({
    bundles: { 'backup-peer.json': bundleFile('peer', [], { photoStorage: 'inline' }) },
    assets: [REF_A]
  });
  await recordAssetsSeen([REF_A]);
  await ageRefs([REF_A]);

  const report = await runAssetCleanup(dir);
  assert.equal(report.outcome, 'completed');
  assert.deepEqual(report.removed, [`${REF_A}.jpg`]);
});

test('a dormant peer does not block a run', async () => {
  const stale = bundleFile('sleepy', [REF_B]);
  stale.content = stale.content.replace(/"exportedAt":"[^"]+"/, '"exportedAt":"2020-01-01T00:00:00.000Z"');
  const dir = folderWith({ bundles: { 'backup-sleepy.json': stale }, assets: [REF_A, REF_B] });
  await recordAssetsSeen([REF_A, REF_B]);
  await ageRefs([REF_A, REF_B]);

  const report = await runAssetCleanup(dir);
  assert.equal(report.outcome, 'completed');
  assert.deepEqual(report.removed, [`${REF_A}.jpg`], 'the dormant peer\'s own asset is still protected');
});

test('referenced-but-missing assets are reported without blocking', async () => {
  const dir = folderWith({ bundles: { 'backup-peer.json': bundleFile('peer', [REF_C]) }, assets: [REF_A] });
  await recordAssetsSeen([REF_A]);
  await ageRefs([REF_A]);

  const report = await runAssetCleanup(dir);
  assert.equal(report.outcome, 'completed');
  assert.deepEqual(report.referencedMissing, [REF_C]);
  assert.deepEqual(report.removed, [`${REF_A}.jpg`]);
});

test('two bundles claiming the same device id are reported', async () => {
  const dir = folderWith({
    bundles: {
      'backup-twin.json': bundleFile('twin', []),
      'backup-twin-copy.json': bundleFile('twin', [])
    },
    assets: []
  });
  dir._entries.assets.children[`${REF_A}.jpg`] = { kind: 'file', content: 'x' };
  await recordAssetsSeen([REF_A]);
  await ageRefs([REF_A]);

  const report = await runAssetCleanup(dir);
  assert.deepEqual(report.duplicateDeviceIds, ['twin']);
});

test('removing a file another device already removed is not an error', async () => {
  // This is what makes two devices cleaning the same folder concurrently
  // harmless: removeEntry() throws NotFoundError rather than no-opping.
  const { removeAsset } = await import('../src/sync/fs-folder.js');
  const dir = folderWith({ bundles: {}, assets: [REF_A] });

  assert.equal(await removeAsset(dir, `${REF_A}.jpg`), true);
  assert.equal(await removeAsset(dir, `${REF_A}.jpg`), true, 'a second pass over the same file must succeed');
});

test('asset-state is pruned for refs that have left the folder', async () => {
  const dir = folderWith({ bundles: { 'backup-peer.json': bundleFile('peer', []) }, assets: [REF_A] });
  await recordAssetsSeen([REF_A, REF_C]); // REF_C is not in the folder at all
  await ageRefs([REF_A, REF_C]);

  await runAssetCleanup(dir);
  assert.deepEqual(listAssetState().map((s) => s.id), [], 'state for a file that is gone should go with it');
});
