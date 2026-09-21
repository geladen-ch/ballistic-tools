import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const {
  downloadOwnBundle, importPeerBundleText, isIOS, isShareSupported, shareOrDownloadOwnBundle,
  exportOwnBundle, importPickedFiles, syncViaPickedFiles
} = await import('../src/sync/manual-sync.js');
const { buildBackupBundle, serializeBackupBundle } = await import('../src/sync/backup-bundle.js');
const { getDeviceLabel } = await import('../src/sync/device-registry.js');
const { listPendingReviews, resetPendingReviewForTests } = await import('../src/sync/pending-review.js');
const { saveUserBullet, loadUserBullets, generateUserId } = await import('../src/user-library.js');
const { resetLocationLibraryForTests } = await import('../src/location-library.js');
const { resetRiflePrecisionLibraryForTests } = await import('../src/rifle-precision-library.js');
const { setVerboseSyncLoggingEnabled } = await import('../src/sync/sync-log.js');
const { getDiagnosticLog } = await import('../src/debug-log.js');

test.beforeEach(async () => {
  localStorage.clear();
  await resetLocationLibraryForTests();
  await resetRiflePrecisionLibraryForTests();
  await resetPendingReviewForTests();
});

// Same convention as rifle-precision-analysis-view.test.js's own
// captureCsvExport: stub URL.createObjectURL to capture the Blob
// downloadFile() builds, and the original document.createElement to
// capture the <a download> filename it's given.
// Awaits `action()`'s return value (a no-op if it's already a plain,
// non-promise value) before restoring the monkeypatches — required for
// shareOrDownloadOwnBundle()'s tests below, since it's async and any
// downloadFile() call inside it happens after an internal await, not
// before action() itself returns.
async function captureDownload(action) {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalCreateElement = document.createElement;
  let capturedBlob = null;
  let capturedFilename = null;
  URL.createObjectURL = (blob) => { capturedBlob = blob; return 'blob:mock'; };
  URL.revokeObjectURL = () => {};
  document.createElement = (tag) => {
    const node = originalCreateElement(tag);
    if (tag === 'a') {
      const original = node.click.bind(node);
      Object.defineProperty(node, 'download', {
        get() { return capturedFilename; },
        set(v) { capturedFilename = v; }
      });
      node.click = original;
    }
    return node;
  };
  let result;
  try {
    result = await action();
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    document.createElement = originalCreateElement;
  }
  return { result, filename: capturedFilename, blob: capturedBlob };
}

test('downloadOwnBundle triggers a download named backup-<deviceId>.json', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const { result: bundle, filename, blob } = await captureDownload(() => downloadOwnBundle());
  assert.equal(bundle.device.id, 'my-device');
  assert.equal(filename, 'backup-my-device.json');
  const text = await blob.text();
  assert.deepEqual(JSON.parse(text), bundle);
});

test('importPeerBundleText imports a new record and records the peer device', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  localStorage.setItem('ballistics_device_name_v1', JSON.stringify({ name: 'Peer Device', modifiedAt: '2021-01-01T00:00:00.000Z' }));
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'Peer Bullet', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const peerBundleText = serializeBackupBundle(buildBackupBundle());
  localStorage.clear();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const { device, totals } = await importPeerBundleText(peerBundleText);

  assert.equal(device.id, 'peer-device');
  assert.equal(totals.imported, 1);
  assert.equal(loadUserBullets().length, 1);
  assert.equal(loadUserBullets()[0].name, 'Peer Bullet');
  assert.equal(getDeviceLabel('peer-device'), 'Peer Device');
});

test('importPeerBundleText records a pending review on diverged content', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Local', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const localBullet = loadUserBullets()[0];

  const peerBundle = {
    format: 'ebalka2-backup', version: 1,
    device: { id: 'peer-device', name: 'Peer', modifiedAt: '2021-01-01T00:00:00.000Z' },
    exportedAt: new Date().toISOString(),
    arsenal: { bullets: [{ ...localBullet, name: 'Remote', modifiedBy: 'peer-device' }], rifles: [] },
    locations: { locations: [] },
    riflePrecision: { projects: [] }
  };

  const { totals } = await importPeerBundleText(JSON.stringify(peerBundle));
  assert.equal(totals.skippedReview, 1);
  assert.equal(listPendingReviews().length, 1);
});

test('importPeerBundleText rejects with the typed parseBackupBundle error on a malformed file', async () => {
  await assert.rejects(() => importPeerBundleText('not json'), (err) => err.code === 'invalid-json');
});

function setUserAgent(ua, { touch = 0 } = {}) {
  Object.defineProperty(global, 'navigator', {
    value: { ...global.navigator, userAgent: ua, maxTouchPoints: touch },
    configurable: true
  });
}

test('isIOS detects iPhone/iPad user agents', () => {
  setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
  assert.equal(isIOS(), true);
  setUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
  assert.equal(isIOS(), true);
});

test('isIOS detects iPadOS reporting as a touch-capable Mac', () => {
  setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15', { touch: 5 });
  assert.equal(isIOS(), true);
});

test('isIOS is false for a real desktop Mac (no touch) or a non-Apple desktop', () => {
  setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15', { touch: 0 });
  assert.equal(isIOS(), false);
  setUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0');
  assert.equal(isIOS(), false);
});

test('isShareSupported reflects navigator.share/canShare presence', () => {
  delete global.navigator.share;
  delete global.navigator.canShare;
  assert.equal(isShareSupported(), false);
  global.navigator.share = async () => {};
  global.navigator.canShare = () => true;
  assert.equal(isShareSupported(), true);
  delete global.navigator.share;
  delete global.navigator.canShare;
});

function captureShare() {
  let sharedFiles = null;
  let canShareResult = true;
  let shareImpl = async ({ files }) => { sharedFiles = files; };
  global.navigator.canShare = ({ files }) => canShareResult && files && files.length > 0;
  global.navigator.share = (opts) => shareImpl(opts);
  return {
    getSharedFiles: () => sharedFiles,
    setCanShare: (v) => { canShareResult = v; },
    setShareImpl: (fn) => { shareImpl = fn; },
    cleanup: () => { delete global.navigator.share; delete global.navigator.canShare; }
  };
}

test('shareOrDownloadOwnBundle shares the bundle as a File named backup-<deviceId>.json', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const control = captureShare();
  try {
    const bundle = await shareOrDownloadOwnBundle();
    const files = control.getSharedFiles();
    assert.equal(files.length, 1);
    assert.equal(files[0].name, 'backup-my-device.json');
    assert.deepEqual(JSON.parse(await files[0].text()), bundle);
  } finally {
    control.cleanup();
  }
});

test('shareOrDownloadOwnBundle falls back to a plain download when canShare says no', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const control = captureShare();
  control.setCanShare(false);
  try {
    const { filename } = await captureDownload(() => shareOrDownloadOwnBundle());
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(filename, 'backup-my-device.json');
  } finally {
    control.cleanup();
  }
});

test('shareOrDownloadOwnBundle treats a cancelled share sheet as done, without falling back to download', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const control = captureShare();
  control.setShareImpl(async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); });
  try {
    const { filename } = await captureDownload(() => shareOrDownloadOwnBundle());
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(filename, null, 'a cancelled share sheet must not trigger a fallback download');
  } finally {
    control.cleanup();
  }
});

test('shareOrDownloadOwnBundle falls back to download on a genuine share failure', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const control = captureShare();
  control.setShareImpl(async () => { throw new Error('boom'); });
  try {
    const { filename } = await captureDownload(() => shareOrDownloadOwnBundle());
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(filename, 'backup-my-device.json');
  } finally {
    control.cleanup();
  }
});

test('a genuine share failure is also reported through logDiagnostic, even with verbose sync logging off', async () => {
  setVerboseSyncLoggingEnabled(false);
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const control = captureShare();
  control.setShareImpl(async () => { throw new Error('boom'); });
  try {
    await captureDownload(() => shareOrDownloadOwnBundle());
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(getDiagnosticLog().some((line) => line.includes('share failed') && line.includes('boom')));
  } finally {
    control.cleanup();
  }
});

test('shareOrDownloadOwnBundle downloads directly when the share API isn\'t supported at all', async () => {
  delete global.navigator.share;
  delete global.navigator.canShare;
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const { filename } = await captureDownload(() => shareOrDownloadOwnBundle());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(filename, 'backup-my-device.json');
});

function makeFile(content, name, { webkitRelativePath, type = 'application/json' } = {}) {
  const file = new File([content], name, { type });
  if (webkitRelativePath) file.webkitRelativePath = webkitRelativePath;
  return file;
}

test('importPickedFiles imports every backup-*.json in a plain multi-file selection, ignoring other files', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');

  localStorage.setItem('ballistics_device_id_v1', 'peer-a');
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'A', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const bundleA = serializeBackupBundle(buildBackupBundle());
  localStorage.clear();
  await resetLocationLibraryForTests();

  localStorage.setItem('ballistics_device_id_v1', 'peer-b');
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'B', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const bundleB = serializeBackupBundle(buildBackupBundle());
  localStorage.clear();
  await resetLocationLibraryForTests();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const files = [
    makeFile(bundleA, 'backup-peer-a.json'),
    makeFile(bundleB, 'backup-peer-b.json'),
    makeFile('not a backup', 'notes.txt', { type: 'text/plain' })
  ];

  const { devices, totals } = await importPickedFiles(files);
  assert.equal(totals.imported, 2);
  assert.equal(devices.length, 2);
  assert.equal(loadUserBullets().length, 2);
});

test('importPickedFiles skips an unparseable file without aborting the rest of the batch', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'peer-a');
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'A', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const bundleA = serializeBackupBundle(buildBackupBundle());
  localStorage.clear();
  await resetLocationLibraryForTests();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const files = [makeFile('not json {{{', 'backup-broken.json'), makeFile(bundleA, 'backup-peer-a.json')];

  const { totals } = await importPickedFiles(files);
  assert.equal(totals.imported, 1);
  assert.equal(loadUserBullets().length, 1);
});

test('importPickedFiles resolves a peer\'s referenced photo from an assets/ subfolder present in a directory selection', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const photoBytes = 'directory photo bytes';
  // A real digest of `photoBytes`, not a stand-in: resolveOne() now verifies
  // that an asset's content hashes to the ref that named it before trusting
  // it (docs/plans/orphaned-storage-cleanup.md phase 2), so a made-up ref
  // would be correctly rejected as corrupt.
  const photoRef = 'sha256-e78a23c9fec77d1bd40c6d23632c3c9592cd925bb918b4e9fcfe4f5a0ecb3c97';
  const peerBundle = {
    format: 'ebalka2-backup', version: 1, photoStorage: 'referenced',
    device: { id: 'peer-device', name: 'Peer', modifiedAt: '2021-01-01T00:00:00.000Z' },
    exportedAt: new Date().toISOString(),
    arsenal: { bullets: [], rifles: [] },
    locations: { locations: [{ id: 'loc1', name: 'Range', photoRef, targets: [] }] },
    riflePrecision: { projects: [] }
  };
  const files = [
    makeFile(JSON.stringify(peerBundle), 'backup-peer-device.json', { webkitRelativePath: 'sync-folder/backup-peer-device.json' }),
    makeFile(photoBytes, `${photoRef}.jpg`, { webkitRelativePath: `sync-folder/assets/${photoRef}.jpg`, type: 'image/jpeg' })
  ];

  await importPickedFiles(files);

  const { loadUserLocations } = await import('../src/location-library.js');
  const locations = loadUserLocations();
  assert.equal(locations.length, 1);
  assert.ok(locations[0].photo.startsWith('data:image/jpeg;base64,'));
  const decoded = Buffer.from(locations[0].photo.split(',')[1], 'base64').toString();
  assert.equal(decoded, photoBytes);
});

test('importPickedFiles never attempts photo resolution for a plain (non-directory) multi-file selection', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const peerBundle = {
    format: 'ebalka2-backup', version: 1, photoStorage: 'referenced',
    device: { id: 'peer-device', name: 'Peer', modifiedAt: '2021-01-01T00:00:00.000Z' },
    exportedAt: new Date().toISOString(),
    arsenal: { bullets: [], rifles: [] },
    locations: { locations: [{ id: 'loc1', name: 'Range', photoRef: 'sha256-abc123', targets: [] }] },
    riflePrecision: { projects: [] }
  };
  // No webkitRelativePath on either file — a plain multi-file picker
  // (Phase 8b), even if an assets file happened to be selected alongside.
  const files = [
    makeFile(JSON.stringify(peerBundle), 'backup-peer-device.json'),
    makeFile('bytes', 'sha256-abc123.jpg', { type: 'image/jpeg' })
  ];

  await importPickedFiles(files);

  const { loadUserLocations } = await import('../src/location-library.js');
  assert.equal(loadUserLocations()[0].photo, null);
});

test('syncViaPickedFiles imports first, then immediately re-publishes this device\'s own bundle', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'peer-a');
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'A', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const bundleA = serializeBackupBundle(buildBackupBundle());
  localStorage.clear();
  await resetLocationLibraryForTests();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const files = [makeFile(bundleA, 'backup-peer-a.json')];

  delete global.navigator.share;
  delete global.navigator.canShare;
  const { result, filename, blob } = await captureDownload(() => syncViaPickedFiles(files));
  const syncResult = await result;

  assert.equal(syncResult.totals.imported, 1);
  assert.equal(syncResult.ownDevice.id, 'my-device');
  assert.equal(filename, 'backup-my-device.json');
  const publishedBundle = JSON.parse(await blob.text());
  assert.equal(publishedBundle.arsenal.bullets.length, 1); // the just-imported bullet is included in the re-publish
});

test('importPickedFiles skips this device\'s own backup file, by name and by device id', async () => {
  // 8a's whole-folder `webkitdirectory` selection hands back everything in
  // the synced folder, which necessarily includes the bundle this device
  // published there last time. Merging a device's own stale snapshot back
  // into itself resolves nothing it doesn't already know and would list
  // the device under its own "Synced with".
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const ownBundleText = serializeBackupBundle(buildBackupBundle());

  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  localStorage.setItem('ballistics_device_name_v1', JSON.stringify({ name: 'Peer', modifiedAt: '2021-01-01T00:00:00.000Z' }));
  const peerBundleText = serializeBackupBundle(buildBackupBundle());
  localStorage.setItem('ballistics_device_id_v1', 'my-device');

  const { devices } = await importPickedFiles([
    makeFile(ownBundleText, 'backup-my-device.json', { webkitRelativePath: 'sync-folder/backup-my-device.json' }),
    // The same bundle under a hand-renamed filename — caught by its own
    // device block rather than by the filename convention alone.
    makeFile(ownBundleText, 'backup-renamed-copy.json', { webkitRelativePath: 'sync-folder/backup-renamed-copy.json' }),
    makeFile(peerBundleText, 'backup-peer-device.json', { webkitRelativePath: 'sync-folder/backup-peer-device.json' })
  ]);

  assert.deepEqual(devices, ['Peer'], 'only the real peer counts as synced-with');
});

test('exportOwnBundle takes the plain download off iOS, even where the share sheet exists', async () => {
  // Safari on macOS implements navigator.share/canShare, so a capability
  // check alone would quietly route desktop 8a through the share sheet —
  // a worse path than the native Save As dialog it already has.
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const originalUa = navigator.userAgent;
  const originalShare = navigator.share;
  const originalCanShare = navigator.canShare;
  let shareCalls = 0;
  navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15';
  navigator.maxTouchPoints = 0;
  navigator.share = async () => { shareCalls++; };
  navigator.canShare = () => true;
  try {
    const { filename } = await captureDownload(() => exportOwnBundle());
    assert.equal(shareCalls, 0, 'desktop Safari must not get the share sheet');
    assert.equal(filename, 'backup-my-device.json');
  } finally {
    navigator.userAgent = originalUa;
    navigator.share = originalShare;
    navigator.canShare = originalCanShare;
  }
});

test('exportOwnBundle uses the share sheet on iOS', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  const originalUa = navigator.userAgent;
  const originalShare = navigator.share;
  const originalCanShare = navigator.canShare;
  let sharedFilename = null;
  navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/605.1.15';
  navigator.share = async ({ files }) => { sharedFilename = files[0].name; };
  navigator.canShare = () => true;
  try {
    await exportOwnBundle();
    assert.equal(sharedFilename, 'backup-my-device.json');
  } finally {
    navigator.userAgent = originalUa;
    navigator.share = originalShare;
    navigator.canShare = originalCanShare;
  }
});

test('manual sync surfaces a peer with a badly-skewed clock in the status', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  localStorage.setItem('ballistics_device_name_v1', JSON.stringify({ name: 'Fast Clock', modifiedAt: '2021-01-01T00:00:00.000Z' }));
  const peerBundle = buildBackupBundle();
  peerBundle.exportedAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3h ahead
  localStorage.setItem('ballistics_device_id_v1', 'my-device');

  const { getClockSkewedDevices } = await import('../src/sync/last-sync-status.js');
  await importPeerBundleText(serializeBackupBundle(peerBundle));

  const skewed = getClockSkewedDevices();
  assert.equal(skewed.length, 1);
  assert.equal(skewed[0], 'Fast Clock');
});

test('regression: importing a manually-synced peer that hasn\'t synced in weeks is not flagged as clock-skewed', async () => {
  // Manual sync (Phase 8a/8b) makes long gaps between syncs from the same
  // peer routine, not exceptional — this must not be mistaken for a wrong
  // clock.
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  const peerBundle = buildBackupBundle();
  peerBundle.exportedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // a month ago
  localStorage.setItem('ballistics_device_id_v1', 'my-device');

  const { getClockSkewedDevices } = await import('../src/sync/last-sync-status.js');
  await importPeerBundleText(serializeBackupBundle(peerBundle));
  assert.deepEqual(getClockSkewedDevices(), []);
});
