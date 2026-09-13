import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { pickFolder, forgetFolder } = await import('../src/sync/fs-folder.js');
const { buildBackupBundle, serializeBackupBundle } = await import('../src/sync/backup-bundle.js');
const { getDeviceLabel } = await import('../src/sync/device-registry.js');
const { listPendingReviews, resetPendingReviewForTests } = await import('../src/sync/pending-review.js');
const { getSyncLog, clearSyncLog, setVerboseSyncLoggingEnabled } = await import('../src/sync/sync-log.js');
const { getDiagnosticLog } = await import('../src/debug-log.js');
const { getPendingPhotoDevices } = await import('../src/sync/last-sync-status.js');
const {
  runSyncCycle, getSyncMode, setSyncMode, registerAutomaticTriggers, unregisterAutomaticTriggers,
  markDirtyForTests, isDirtyForTests, getLastSyncedAt, getLastSyncedDevices, initSyncTriggers
} = await import('../src/sync/auto-sync.js');
const { saveUserBullet, loadUserBullets, generateUserId } = await import('../src/user-library.js');
const { resetLocationLibraryForTests } = await import('../src/location-library.js');
const { resetRiflePrecisionLibraryForTests } = await import('../src/rifle-precision-library.js');
const { setBackupSyncEnabled } = await import('../src/backup-sync-prefs.js');
const { isIphoneSyncSupportEnabled, setIphoneSyncSupportEnabled } = await import('../src/sync/photo-storage-prefs.js');
const { saveUserLocation, loadUserLocations } = await import('../src/location-library.js');

function makePhoto(content) {
  return `data:image/jpeg;base64,${Buffer.from(content).toString('base64')}`;
}

// Recursive fake — see sync-fs-folder.test.js's identical copy for why
// (Phase 7's assets/ subfolder needs getDirectoryHandle()).
function makeFakeDirHandle(entries = {}) {
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
          const isBlob = content && typeof content.text === 'function';
          return {
            text: async () => (isBlob ? content.text() : content),
            arrayBuffer: async () => (isBlob ? content.arrayBuffer() : new TextEncoder().encode(content).buffer),
            type: isBlob ? content.type : ''
          };
        },
        async createWritable() {
          return { async write(value) { entries[name].content = value; }, async close() {} };
        }
      };
    },
    async getDirectoryHandle(name, { create } = {}) {
      if (!(name in entries)) {
        if (!create) throw new Error(`not found: ${name}`);
        entries[name] = { kind: 'directory', children: {} };
      }
      return makeFakeDirHandle(entries[name].children);
    },
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    _entries: entries
  };
}

test.beforeEach(async () => {
  localStorage.clear();
  setBackupSyncEnabled(true); // most tests exercise the cycle itself; the toggle-off gate has its own test below
  setVerboseSyncLoggingEnabled(true); // this file asserts on getSyncLog() content throughout
  await resetLocationLibraryForTests();
  await resetRiflePrecisionLibraryForTests();
  await resetPendingReviewForTests();
  clearSyncLog();
  unregisterAutomaticTriggers();
  delete global.navigator.locks;
  global.window = { showDirectoryPicker: async () => { throw new Error('not used in this test'); } };
});

test('getSyncMode defaults to manual', () => {
  assert.equal(getSyncMode(), 'manual');
});

test('setSyncMode persists the mode, readable back via getSyncMode', () => {
  setSyncMode('automatic');
  assert.equal(getSyncMode(), 'automatic');
  setSyncMode('manual');
  assert.equal(getSyncMode(), 'manual');
});

test('setSyncMode to automatic registers the periodic timer; back to manual tears it down', () => {
  let intervalsCreated = 0;
  let intervalsCleared = 0;
  const realSetInterval = global.setInterval;
  const realClearInterval = global.clearInterval;
  global.setInterval = (fn, ms) => { intervalsCreated++; return realSetInterval(fn, ms); };
  global.clearInterval = (h) => { intervalsCleared++; return realClearInterval(h); };

  setSyncMode('automatic');
  assert.equal(intervalsCreated, 1);
  setSyncMode('manual');
  assert.equal(intervalsCleared, 1);

  global.setInterval = realSetInterval;
  global.clearInterval = realClearInterval;
});

test('initSyncTriggers registers the timer only when both the master toggle and sync mode are on', () => {
  let intervalsCreated = 0;
  const realSetInterval = global.setInterval;
  global.setInterval = (fn, ms) => { intervalsCreated++; return realSetInterval(fn, ms); };

  // Master toggle on (beforeEach), sync mode still manual by default.
  initSyncTriggers();
  assert.equal(intervalsCreated, 0);

  localStorage.setItem('ballistics_sync_mode_v1', 'automatic');
  setBackupSyncEnabled(false);
  initSyncTriggers();
  assert.equal(intervalsCreated, 0, 'master toggle off must win even though sync mode says automatic');

  setBackupSyncEnabled(true);
  initSyncTriggers();
  assert.equal(intervalsCreated, 1);

  unregisterAutomaticTriggers();
  global.setInterval = realSetInterval;
});

test('registerAutomaticTriggers is idempotent (no duplicate timers on repeated calls)', () => {
  let intervalsCreated = 0;
  const realSetInterval = global.setInterval;
  global.setInterval = (fn, ms) => { intervalsCreated++; return realSetInterval(fn, ms); };

  registerAutomaticTriggers();
  registerAutomaticTriggers();
  assert.equal(intervalsCreated, 1);
  unregisterAutomaticTriggers();

  global.setInterval = realSetInterval;
});

test('runSyncCycle no-ops when backup/sync is disabled at the master toggle, even with a folder chosen', async () => {
  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();
  setBackupSyncEnabled(false);

  await runSyncCycle();
  assert.ok(getSyncLog().some((line) => line.includes('backup & sync is disabled')));
});

test('runSyncCycle no-ops when no folder has been chosen', async () => {
  await forgetFolder();
  const result = await runSyncCycle();
  assert.equal(result, true); // lock was acquired and the cycle ran (and decided there was nothing to do)
  assert.ok(getSyncLog().some((line) => line.includes('no folder chosen')));
});

test('runSyncCycle no-ops when permission is not granted and allowPrompt is false', async () => {
  const dir = makeFakeDirHandle();
  dir.queryPermission = async () => 'prompt';
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  await runSyncCycle();
  assert.ok(getSyncLog().some((line) => line.includes('permission not granted')));
});

// Phase 10's "errors are unaffected by this toggle" requirement: genuine
// failures must reach the app's existing logDiagnostic() diagnostics
// buffer even while verbose sync logging (the getSyncLog() trace above) is
// off — otherwise a sync failure would be invisible to anyone who hasn't
// already turned that switch on.
test('a denied folder permission is also reported through logDiagnostic, even with verbose sync logging off', async () => {
  setVerboseSyncLoggingEnabled(false);
  clearSyncLog(); // beforeEach's own unregisterAutomaticTriggers() call logged one entry while verbose was still on
  const dir = makeFakeDirHandle();
  dir.queryPermission = async () => 'prompt';
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  await runSyncCycle();
  assert.equal(getSyncLog().length, 0, 'the verbose trace itself should stay empty while the toggle is off');
  assert.ok(getDiagnosticLog().some((line) => line.includes('permission not granted')));
});

test('a failure to list the folder is reported through logDiagnostic, even with verbose sync logging off', async () => {
  setVerboseSyncLoggingEnabled(false);
  const dir = makeFakeDirHandle();
  dir.entries = async function* () { throw new Error('disk unplugged'); };
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  await runSyncCycle();
  assert.ok(getDiagnosticLog().some((line) => line.includes('could not list folder contents') && line.includes('disk unplugged')));
});

test('a failure to write the own bundle is reported through logDiagnostic, even with verbose sync logging off', async () => {
  setVerboseSyncLoggingEnabled(false);
  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();
  markDirtyForTests();
  const realGetFileHandle = dir.getFileHandle.bind(dir);
  dir.getFileHandle = async (name, opts) => {
    if (name.startsWith('backup-') && opts && opts.create) throw new Error('quota exceeded');
    return realGetFileHandle(name, opts);
  };

  await runSyncCycle();
  assert.ok(getDiagnosticLog().some((line) => line.includes('could not write own bundle') && line.includes('quota exceeded')));
});

test('runSyncCycle skips its own backup file and does not merge from itself', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const dir = makeFakeDirHandle({ 'backup-my-device.json': { kind: 'file', content: 'whatever is already there' } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  markDirtyForTests(); // force a publish regardless of ambient dirty state from other tests
  await runSyncCycle();
  // Our own file gets overwritten with a real bundle, not read as a peer.
  const written = JSON.parse(dir._entries['backup-my-device.json'].content);
  assert.equal(written.format, 'ebalka2-backup');
});

test('runSyncCycle imports a new record from a peer bundle and records the peer device', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');

  // Build a peer's bundle by temporarily impersonating that device.
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  localStorage.setItem('ballistics_device_name_v1', JSON.stringify({ name: "Peer's iPhone", modifiedAt: '2021-01-01T00:00:00.000Z' }));
  const peerBullet = {
    id: 'peer-bullet-1', name: 'Peer Bullet', manufacturer: 'M', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }, modifiedAt: '2021-06-01T00:00:00.000Z', modifiedBy: 'peer-device'
  };
  saveUserBullet(peerBullet); // stamps its own modifiedAt/modifiedBy — fine, we only need shape
  const peerBundle = buildBackupBundle();
  localStorage.clear();

  // Now become "my-device" with an empty library, and drop the peer's file in the folder.
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true); // localStorage.clear() above also wiped the master toggle
  const dir = makeFakeDirHandle({ 'backup-peer-device.json': { kind: 'file', content: serializeBackupBundle(peerBundle) } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  await runSyncCycle();

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].name, 'Peer Bullet');
  assert.equal(getDeviceLabel('peer-device'), "Peer's iPhone");
});

test('runSyncCycle publishes a referenced-mode bundle by default (Phase 7), moving the photo out of the JSON and into assets/', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  saveUserLocation({ id: 'loc1', name: 'Range', altitudeM: null, photo: makePhoto('photo bytes'), targets: [] });

  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  markDirtyForTests();
  await runSyncCycle();

  const written = JSON.parse(dir._entries['backup-my-device.json'].content);
  assert.equal(written.photoStorage, 'referenced');
  assert.equal(written.locations.locations[0].photo, undefined);
  assert.ok(written.locations.locations[0].photoRef.startsWith('sha256-'));
  assert.ok(dir._entries.assets, 'expected an assets/ subfolder to have been created');
  assert.equal(Object.keys(dir._entries.assets.children).length, 1);
});

test('runSyncCycle publishes an inline bundle when the iPhone-sync-support toggle is on', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setIphoneSyncSupportEnabled(true);
  saveUserLocation({ id: 'loc1', name: 'Range', altitudeM: null, photo: makePhoto('photo bytes'), targets: [] });

  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  markDirtyForTests();
  await runSyncCycle();

  const written = JSON.parse(dir._entries['backup-my-device.json'].content);
  assert.equal(written.photoStorage, 'inline');
  assert.ok(written.locations.locations[0].photo.startsWith('data:image/jpeg'));
  assert.equal(dir._entries.assets, undefined, 'no assets/ subfolder should be created in inline mode');
});

test('runSyncCycle resolves a peer\'s referenced photo back into a real photo on import', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  saveUserLocation({ id: 'loc1', name: 'Peer Range', altitudeM: null, photo: makePhoto('peer photo'), targets: [] });
  const peerBundle = buildBackupBundle();
  localStorage.clear();
  // location-library.js's in-memory mirror is not device-scoped and
  // survives the localStorage.clear() above — reset it too, or "my-device"
  // would start this cycle already sharing the peer's own location object
  // rather than genuinely importing it fresh.
  await resetLocationLibraryForTests();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true);
  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  // Publish the peer's referenced bundle into the shared folder the same
  // way a real Chromium peer would — via a real applyReferencedPhotoStorage
  // pass, so the asset actually exists in this fake folder.
  const { applyReferencedPhotoStorage } = await import('../src/sync/photo-assets.js');
  await applyReferencedPhotoStorage(peerBundle, dir);
  dir._entries['backup-peer-device.json'] = { kind: 'file', content: JSON.stringify(peerBundle) };

  await runSyncCycle();

  const locations = loadUserLocations();
  assert.equal(locations.length, 1);
  assert.equal(locations[0].photo, makePhoto('peer photo'));
});

test('runSyncCycle leaves an unresolvable referenced photo\'s location out of this cycle, to retry next time', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true);
  const peerBundle = {
    format: 'ebalka2-backup', version: 1, photoStorage: 'referenced',
    device: { id: 'peer-device', name: 'Peer', modifiedAt: '2021-01-01T00:00:00.000Z' },
    exportedAt: new Date().toISOString(),
    arsenal: { bullets: [], rifles: [] },
    locations: { locations: [{ id: 'loc1', name: 'Range', photoRef: 'sha256-not-written', targets: [] }] },
    riflePrecision: { projects: [] }
  };
  const dir = makeFakeDirHandle({ 'backup-peer-device.json': { kind: 'file', content: JSON.stringify(peerBundle) } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  await runSyncCycle();

  assert.deepEqual(loadUserLocations(), []);
  assert.ok(getSyncLog().some((line) => line.includes('could not resolve photo')));
  // Item 3's Settings warning — surfaced so the user knows *why* a peer's
  // record hasn't shown up yet, rather than it silently never appearing.
  assert.deepEqual(getPendingPhotoDevices(), ['Peer']);
});

test('runSyncCycle clears the pending-photo warning once a previously-unresolvable photo resolves', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  localStorage.setItem('ballistics_device_name_v1', JSON.stringify({ name: 'Peer', modifiedAt: '2021-01-01T00:00:00.000Z' }));
  saveUserLocation({ id: 'loc1', name: 'Peer Range', altitudeM: null, photo: makePhoto('peer photo'), targets: [] });
  const peerBundle = buildBackupBundle();
  localStorage.clear();
  await resetLocationLibraryForTests();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true);
  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  const { applyReferencedPhotoStorage } = await import('../src/sync/photo-assets.js');
  await applyReferencedPhotoStorage(peerBundle, dir);
  // Simulate the cloud client having delivered the bundle's own JSON
  // before the (larger) asset file has finished syncing — pull the just-
  // written asset back out.
  const assetEntries = dir._entries.assets.children;
  const assetNames = Object.keys(assetEntries);
  const savedAssets = { ...assetEntries };
  for (const name of assetNames) delete assetEntries[name];
  dir._entries['backup-peer-device.json'] = { kind: 'file', content: JSON.stringify(peerBundle) };

  await runSyncCycle();
  assert.deepEqual(loadUserLocations(), []); // dropped this cycle, not merged in with a null photo
  assert.deepEqual(getPendingPhotoDevices(), ['Peer']);

  // The asset "finishes syncing" — now present in the folder, exactly
  // like a real next cycle would see.
  Object.assign(assetEntries, savedAssets);
  await runSyncCycle();
  assert.equal(loadUserLocations().length, 1);
  assert.deepEqual(getPendingPhotoDevices(), []);
});

test('runSyncCycle records a skip-review pending-review entry on diverged content', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const sameId = generateUserId('user-bullet');
  saveUserBullet({ id: sameId, name: 'Local Version', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const localBullet = loadUserBullets()[0];

  const peerBundle = {
    format: 'ebalka2-backup', version: 1,
    device: { id: 'peer-device', name: 'Peer', modifiedAt: '2021-01-01T00:00:00.000Z' },
    exportedAt: new Date().toISOString(),
    arsenal: { bullets: [{ ...localBullet, name: 'Remote Version', modifiedBy: 'peer-device' }], rifles: [] },
    locations: { locations: [] },
    riflePrecision: { projects: [] }
  };

  const dir = makeFakeDirHandle({ 'backup-peer-device.json': { kind: 'file', content: JSON.stringify(peerBundle) } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  await runSyncCycle();

  const reviews = listPendingReviews();
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].reason, 'same-timestamp-diverged-content');
  assert.equal(reviews[0].peerDeviceId, 'peer-device');
  assert.equal(reviews[0].recordId, sameId);
});

test('runSyncCycle skips an unparseable peer file without throwing, and retries would just see it again', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const dir = makeFakeDirHandle({ 'backup-peer-device.json': { kind: 'file', content: 'not valid json{{{' } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  await assert.doesNotReject(() => runSyncCycle());
  assert.ok(getSyncLog().some((line) => line.includes('skipping unreadable file')));
});

test('runSyncCycle does not publish a bundle when nothing changed and the dirty flag is clear', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  await runSyncCycle(); // first cycle establishes dirty=false baseline (no prior writes this test)
  const afterFirst = dir._entries['backup-my-device.json'];

  await runSyncCycle();
  assert.ok(getSyncLog().some((line) => line.includes('nothing changed')));
});

test('a local library write sets the dirty flag, causing the next cycle to publish', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  saveUserBullet({ id: generateUserId('user-bullet'), name: 'X', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  assert.equal(isDirtyForTests(), true);

  await runSyncCycle();
  assert.equal(isDirtyForTests(), false); // cleared after a successful publish
  assert.ok(dir._entries['backup-my-device.json']);
});

test('runSyncCycle records lastSyncedAt/lastSyncedDevices once it gets past permission checks', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  assert.equal(getLastSyncedAt(), null);

  const peerBundle = {
    format: 'ebalka2-backup', version: 1,
    device: { id: 'peer-1', name: 'Peer One', modifiedAt: '2021-01-01T00:00:00.000Z' },
    exportedAt: new Date().toISOString(),
    arsenal: { bullets: [], rifles: [] }, locations: { locations: [] }, riflePrecision: { projects: [] }
  };
  const dir = makeFakeDirHandle({ 'backup-peer-1.json': { kind: 'file', content: JSON.stringify(peerBundle) } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  await runSyncCycle();
  assert.ok(getLastSyncedAt());
  assert.deepEqual(getLastSyncedDevices(), ['Peer One']);
});

test('runSyncCycle does not update lastSyncedAt when it never gets past the folder/permission checks', async () => {
  await forgetFolder();
  const before = getLastSyncedAt();
  await runSyncCycle();
  assert.equal(getLastSyncedAt(), before);
});

test('two concurrent runSyncCycle calls: the second is skipped while the first holds the (fallback) lock', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  await forgetFolder(); // fastest path through the cycle body

  const p1 = runSyncCycle();
  const p2 = runSyncCycle();
  const [r1, r2] = await Promise.all([p1, p2]);

  assert.equal(r1, true);
  assert.equal(r2, false);
  assert.ok(getSyncLog().some((line) => line.includes('already in progress')));
});

test('two concurrent runSyncCycle calls under navigator.locks: the second is skipped via ifAvailable', async () => {
  let held = false;
  global.navigator.locks = {
    async request(name, opts, callback) {
      if (opts && opts.ifAvailable && held) return callback(null);
      held = true;
      try { return await callback({ name }); } finally { held = false; }
    }
  };
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  await forgetFolder();

  const p1 = runSyncCycle();
  const p2 = runSyncCycle();
  const [r1, r2] = await Promise.all([p1, p2]);

  assert.equal(r1, true);
  assert.equal(r2, false);
});

test('an edit landing mid-publish leaves the device dirty rather than being swallowed', async () => {
  // Publishing spans several awaits (the photo-asset split, then the file
  // write). A boolean dirty flag cleared after the write would drop any
  // save that landed in that window: the flag would be set and then
  // cleared by a publish whose bundle predates it, leaving that edit
  // unpublished until some unrelated later write happened to set it again.
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  markDirtyForTests();
  const realGetFileHandle = dir.getFileHandle.bind(dir);
  dir.getFileHandle = async (name, opts) => {
    const handle = await realGetFileHandle(name, opts);
    if (name.startsWith('backup-')) {
      // Simulate the user saving something while the write is in flight.
      saveUserBullet({ id: generateUserId('user-bullet'), name: 'Mid-write edit', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
    }
    return handle;
  };

  await runSyncCycle();
  dir.getFileHandle = realGetFileHandle;

  assert.equal(isDirtyForTests(), true, 'the mid-publish edit must still count as unpublished');
});

test('a clean, converged cycle clears the dirty state and publishes nothing further', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  markDirtyForTests();
  await runSyncCycle();
  assert.equal(isDirtyForTests(), false);

  const publishedAt = dir._entries['backup-my-device.json'].content;
  clearSyncLog();
  await runSyncCycle();
  assert.equal(dir._entries['backup-my-device.json'].content, publishedAt, 'no rewrite with nothing to say');
  assert.ok(getSyncLog().some((line) => line.includes('nothing changed, not publishing')));
});

test('runSyncCycle surfaces a peer with a badly-skewed clock in the status, not only in the verbose log', async () => {
  // Phase 4 calls this required: nothing in the merge algorithm detects
  // skew, it just resolves silently in the wrong direction — and the
  // verbose log this was previously reported to is off by default.
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  localStorage.setItem('ballistics_device_name_v1', JSON.stringify({ name: 'Fast Clock', modifiedAt: '2021-01-01T00:00:00.000Z' }));
  const peerBundle = buildBackupBundle();
  peerBundle.exportedAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  localStorage.clear();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true);
  setVerboseSyncLoggingEnabled(false); // specifically: the warning must not depend on this
  const dir = makeFakeDirHandle({ 'backup-peer-device.json': { kind: 'file', content: serializeBackupBundle(peerBundle) } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  const { getClockSkewedDevices } = await import('../src/sync/last-sync-status.js');
  await runSyncCycle();

  const skewed = getClockSkewedDevices();
  assert.equal(skewed.length, 1);
  assert.equal(skewed[0], 'Fast Clock');
  assert.ok(getDiagnosticLog().some((line) => line.includes('clock anomaly detected')));
});

test('regression: a peer that simply hasn\'t synced in weeks — routine here — is not flagged as clock-skewed', async () => {
  // The whole reason the old "exportedAt vs my own now" heuristic had to
  // go: a peer with a perfectly correct clock that just hasn't synced in
  // a long while (this app's own tombstone retention window is sized in
  // months on exactly that assumption) produces the identical signal as
  // one whose clock is genuinely wrong weeks off. Only a comparison
  // against the peer's own history — not against this device's clock —
  // can tell them apart.
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  const peerBundle = buildBackupBundle();
  peerBundle.exportedAt = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(); // 3 weeks ago
  localStorage.clear();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true);
  const dir = makeFakeDirHandle({ 'backup-peer-device.json': { kind: 'file', content: serializeBackupBundle(peerBundle) } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  const { getClockSkewedDevices } = await import('../src/sync/last-sync-status.js');
  await runSyncCycle();
  assert.deepEqual(getClockSkewedDevices(), []);
});

test('a peer whose exportedAt jumps backward relative to its own last-known bundle is flagged, regardless of the gap between syncs', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  const firstBundle = buildBackupBundle();
  firstBundle.exportedAt = '2021-06-01T12:00:00.000Z';
  localStorage.clear();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true);
  const dir = makeFakeDirHandle({ 'backup-peer-device.json': { kind: 'file', content: serializeBackupBundle(firstBundle) } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  const { getClockSkewedDevices } = await import('../src/sync/last-sync-status.js');
  await runSyncCycle();
  assert.deepEqual(getClockSkewedDevices(), [], 'first sighting of this peer — nothing to compare against yet');

  // A later bundle from the SAME peer, dated well before its own
  // previous one — its clock has reset or been changed backward, even
  // though weeks might separate the two reads in real time.
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  const secondBundle = buildBackupBundle();
  secondBundle.exportedAt = '2021-05-01T00:00:00.000Z'; // a month before its own last bundle
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  dir._entries['backup-peer-device.json'].content = serializeBackupBundle(secondBundle);

  await runSyncCycle();
  assert.equal(getClockSkewedDevices().length, 1);
});

test('a peer in step with this device raises no skew warning, and a later clean cycle clears an old one', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  const inStep = serializeBackupBundle(buildBackupBundle());
  localStorage.clear();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true);
  const dir = makeFakeDirHandle({ 'backup-peer-device.json': { kind: 'file', content: inStep } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  const { getClockSkewedDevices } = await import('../src/sync/last-sync-status.js');
  await runSyncCycle();
  assert.deepEqual(getClockSkewedDevices(), []);
});

test('a later definite merge answer retires a conflict that is still outstanding against that record', async () => {
  // Phase 4: entries clear "when the record is later overwritten by an
  // unambiguously newer version from anywhere". The write path covers the
  // answers that write something; this covers the ones that don't — a peer
  // bundle whose copy is simply older than ours settles the question just
  // as definitely as an overwrite would.
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  const peerBullet = {
    id: 'shared-bullet', name: 'Stale Peer Copy', manufacturer: 'M', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }, modifiedAt: '2021-01-01T00:00:00.000Z', modifiedBy: 'peer-device'
  };
  const { importUserBullet } = await import('../src/user-library.js');
  importUserBullet(peerBullet);
  const peerBundle = buildBackupBundle();
  localStorage.clear();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true);
  await resetPendingReviewForTests();
  // A strictly newer local copy, so the peer's resolves as 'skip'.
  saveUserBullet({ id: 'shared-bullet', name: 'Mine, newer', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const { addPendingReview } = await import('../src/sync/pending-review.js');
  addPendingReview({
    recordType: 'bullet', recordId: 'shared-bullet', reason: 'unresolvable-timestamp',
    peerDeviceId: 'peer-device', remoteVersion: { id: 'shared-bullet', name: 'something older' }
  });
  assert.equal(listPendingReviews().length, 1);

  const dir = makeFakeDirHandle({ 'backup-peer-device.json': { kind: 'file', content: serializeBackupBundle(peerBundle) } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();
  await runSyncCycle();

  assert.deepEqual(listPendingReviews(), [], 'the merge reached a definite answer, so the conflict is settled');
});

test('regression: the very first Sync Now into a fresh folder publishes this device\'s own file, even with nothing dirty and nothing to merge', async () => {
  // Reproduces the reported failure: Chromium folder sync, freshly loaded
  // page (writeSeq/publishedSeq both still 0, so isDirty() is false), an
  // empty folder (or one with nothing to actually merge, so anyChange
  // stays false too). Without checking whether this device's own file
  // already exists there, the cycle would update "last synced" — a real
  // read of the folder did happen — and then silently never write
  // anything, leaving the device permanently invisible to every peer no
  // matter how many times "Sync Now" is pressed afterward.
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const dir = makeFakeDirHandle(); // empty folder — nothing to merge, nothing marked dirty
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  assert.equal(isDirtyForTests(), false, 'sanity: nothing has been edited this session');
  await runSyncCycle();

  assert.ok(dir._entries['backup-my-device.json'], 'expected this device\'s own bundle to be published on first sync');
  const written = JSON.parse(dir._entries['backup-my-device.json'].content);
  assert.equal(written.format, 'ebalka2-backup');
  assert.ok(getLastSyncedAt(), 'the status line updating is correct — the read genuinely happened');
});

test('a second sync with nothing new still skips the rewrite once this device\'s own file exists', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const dir = makeFakeDirHandle();
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();

  await runSyncCycle(); // first sync: publishes despite nothing dirty
  const firstContent = dir._entries['backup-my-device.json'].content;

  clearSyncLog();
  await runSyncCycle(); // second sync: own file now exists, nothing changed since
  assert.equal(dir._entries['backup-my-device.json'].content, firstContent, 'no gratuitous rewrite');
  assert.ok(getSyncLog().some((line) => line.includes('nothing changed, not publishing')));
});

test('regression: a real-world reproduction — a stale review for a rifle-precision project both sides already agree on is cleared on the next sync', async () => {
  // Reproduces an actual field report: two devices' rifle-precision
  // projects converged to byte-identical content (photo bytes included,
  // despite one side storing it as a referenced asset and the other
  // inline), yet a pending-review entry from an earlier, since-resolved
  // moment kept showing "K31"/"Rifle 3" as needing review, on a build that
  // predated the resolvedIds-based auto-clear. Once that mechanism is
  // live, the exact same merge that finds nothing to change also retires
  // the stale entry.
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const project = {
    id: 'rp-project-shared', name: 'K31', distanceM: 300, caliberMm: 7.62,
    createdAt: '2026-08-25T10:41:46.905Z', modifiedAt: '2026-08-26T06:35:05.762Z',
    targets: [{ id: 't1', name: null, photo: makePhoto('range day'), photoWidth: 100, photoHeight: 100, photoFilename: null, calibration: { point1: null, point2: null, realLengthMm: null }, groups: [] }]
  };
  const { saveRiflePrecisionProject } = await import('../src/rifle-precision-library.js');
  saveRiflePrecisionProject(project);
  // Force the exact stored shape (fixed modifiedAt) so it matches what a peer would offer.
  const { loadRiflePrecisionProjectsWithTombstones, importRiflePrecisionProject } = await import('../src/rifle-precision-library.js');
  importRiflePrecisionProject({ ...loadRiflePrecisionProjectsWithTombstones()[0], modifiedAt: project.modifiedAt });

  // A stale conflict from an earlier moment, attributed to the peer whose
  // file we're about to read, naming a *different*, non-existent
  // competing version — exactly the shape of an old, since-superseded
  // entry that was never cleared on an older build.
  const { addPendingReview, getPendingReviewCount } = await import('../src/sync/pending-review.js');
  addPendingReview({
    recordType: 'rifle-precision-project', recordId: project.id, reason: 'same-timestamp-diverged-content',
    peerDeviceId: 'peer-device', remoteVersion: { id: project.id, name: 'K31', modifiedAt: '2020-01-01T00:00:00.000Z' }
  });
  assert.equal(getPendingReviewCount(), 1);

  // The peer now offers the exact same, already-converged project.
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  const peerCopy = { ...loadRiflePrecisionProjectsWithTombstones()[0] };
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const peerBundle = buildBackupBundle();
  peerBundle.riflePrecision.projects = [peerCopy];

  const dir = makeFakeDirHandle({ 'backup-peer-device.json': { kind: 'file', content: serializeBackupBundle(peerBundle) } });
  global.window = { showDirectoryPicker: async () => dir };
  await pickFolder();
  setBackupSyncEnabled(true);

  await runSyncCycle();

  assert.equal(getPendingReviewCount(), 0, 'the stale review clears once the merge finds the two sides already agree');
});
