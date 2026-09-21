import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { mountDialogRoot } = await import('../src/ui/app-dialog.js');
const { backupSyncSection } = await import('../src/ui/backup-sync-settings.js');
const { isBackupSyncEnabled, setBackupSyncEnabled } = await import('../src/backup-sync-prefs.js');
const { getDeviceName } = await import('../src/sync/device-name.js');
const { addPendingReview, resetPendingReviewForTests } = await import('../src/sync/pending-review.js');
const { isDeviceDeleted } = await import('../src/sync/device-registry.js');
const { resetLocationLibraryForTests } = await import('../src/location-library.js');
const { resetRiflePrecisionLibraryForTests } = await import('../src/rifle-precision-library.js');
const { isIphoneSyncSupportEnabled } = await import('../src/sync/photo-storage-prefs.js');
const { buildBackupBundle, serializeBackupBundle } = await import('../src/sync/backup-bundle.js');
const { saveUserBullet, loadUserBullets, generateUserId } = await import('../src/user-library.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function byKey(container, tag, key) {
  return findByTag(container, tag).find((n) => n.getAttribute && n.getAttribute('data-i18n') === key);
}

function mount(onSyncApplied) {
  const container = makeElement('main');
  container.appendChild(backupSyncSection(onSyncApplied));
  return container;
}

let dialogRoot;

test.beforeEach(async () => {
  localStorage.clear();
  await resetLocationLibraryForTests();
  await resetRiflePrecisionLibraryForTests();
  await resetPendingReviewForTests();
  dialogRoot = makeElement('div');
  mountDialogRoot(dialogRoot);
  delete global.window.showDirectoryPicker; // default: no File System Access support in this fake environment
});

test('collapsed state (default) shows only the warning and the enable checkbox', () => {
  const container = mount();
  const checkbox = findByTag(container, 'INPUT').find((i) => i.type === 'checkbox');
  assert.ok(checkbox);
  assert.equal(checkbox.checked, false);
  assert.ok(byKey(container, 'P', 'settings.backupSync.experimentalWarning'));
  // None of the enabled-state controls exist yet.
  assert.equal(byKey(container, 'LABEL', 'settings.backupSync.deviceNameLabel'), undefined);
});

test('checking the enable checkbox opens a confirmation dialog rather than enabling immediately', () => {
  const container = mount();
  const checkbox = findByTag(container, 'INPUT').find((i) => i.type === 'checkbox');
  checkbox.checked = true;
  fireEvent(checkbox, 'change');

  assert.equal(isBackupSyncEnabled(), false);
  assert.equal(checkbox.checked, false, 'checkbox reverts until the dialog is actually confirmed');
});

test('confirming the dialog enables backup/sync and re-renders the enabled state', () => {
  const container = mount();
  let checkbox = findByTag(container, 'INPUT').find((i) => i.type === 'checkbox');
  checkbox.checked = true;
  fireEvent(checkbox, 'change');

  // The dialog is mounted in its own separate root (app-dialog.js's
  // overlay), not inside the settings section's own container.
  const continueButton = findByTag(dialogRoot, 'BUTTON')
    .find((b) => b.textContent === t('settings.backupSync.confirmContinueButton'));
  assert.ok(continueButton, 'expected the confirmation dialog\'s Continue button to exist');
  fireEvent(continueButton, 'click');

  assert.equal(isBackupSyncEnabled(), true);
  checkbox = findByTag(container, 'INPUT').find((i) => i.type === 'checkbox');
  assert.equal(checkbox.checked, true);
  assert.ok(byKey(container, 'LABEL', 'settings.backupSync.deviceNameLabel'), 'enabled-state controls should now be present');
});

test('regression: re-enabling after being switched off always lands back on manual sync mode', async () => {
  // A user who had automatic mode on, then disabled the feature (maybe to
  // switch to a different sync folder or move the old one), must not have
  // automatic syncing silently resume the moment they re-enable — that
  // would mean syncing against whatever folder handle happens to still be
  // persisted, stale or not, with no fresh confirmation from the user.
  const { getSyncMode, setSyncMode } = await import('../src/sync/auto-sync.js');
  setBackupSyncEnabled(true);
  setSyncMode('automatic');
  setBackupSyncEnabled(false);
  assert.equal(getSyncMode(), 'automatic', 'sanity: the mode preference itself survives being disabled');

  const container = mount();
  const checkbox = findByTag(container, 'INPUT').find((i) => i.type === 'checkbox');
  checkbox.checked = true;
  fireEvent(checkbox, 'change');
  const continueButton = findByTag(dialogRoot, 'BUTTON')
    .find((b) => b.textContent === t('settings.backupSync.confirmContinueButton'));
  fireEvent(continueButton, 'click');

  assert.equal(isBackupSyncEnabled(), true);
  assert.equal(getSyncMode(), 'manual', 'must not resume automatic mode on re-enable');
});

test('unchecking the master checkbox disables backup/sync and collapses the section', () => {
  setBackupSyncEnabled(true);
  const container = mount();
  const checkbox = findByTag(container, 'INPUT').find((i) => i.type === 'checkbox');
  assert.equal(checkbox.checked, true);

  checkbox.checked = false;
  fireEvent(checkbox, 'change');

  assert.equal(isBackupSyncEnabled(), false);
  assert.equal(byKey(container, 'LABEL', 'settings.backupSync.deviceNameLabel'), undefined);
});

test('device name field defaults to the current device name and updates it on change', () => {
  setBackupSyncEnabled(true);
  const container = mount();
  const nameInput = findByTag(container, 'INPUT').find((i) => i.type === 'text');
  assert.equal(nameInput.value, getDeviceName());

  nameInput.value = "Guns' Laptop";
  fireEvent(nameInput, 'change');
  assert.equal(getDeviceName(), "Guns' Laptop");
});

test('without File System Access support, a single combined Sync control renders instead of a folder picker', () => {
  setBackupSyncEnabled(true);
  const container = mount();
  assert.ok(byKey(container, 'BUTTON', 'settings.backupSync.syncNowButton'));
  assert.equal(byKey(container, 'BUTTON', 'settings.backupSync.chooseFolderButton'), undefined);
  // Desktop non-Chromium (Phase 8a, the default in this fake environment
  // — see isIOS()): the hidden picker selects a whole folder in one
  // gesture, not a plain multi-file picker.
  const picker = findByTag(container, 'INPUT').find((i) => i.type === 'file');
  assert.ok(picker);
  assert.equal(picker.getAttribute('webkitdirectory'), 'true');
});

test('on iOS, the combined Sync control uses a plain multi-file picker, not a directory picker', () => {
  const originalNavigator = global.navigator;
  Object.defineProperty(global, 'navigator', {
    value: { ...originalNavigator, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
    configurable: true
  });
  try {
    setBackupSyncEnabled(true);
    const container = mount();
    assert.ok(byKey(container, 'BUTTON', 'settings.backupSync.syncNowButton'));
    const picker = findByTag(container, 'INPUT').find((i) => i.type === 'file');
    assert.equal(picker.getAttribute('webkitdirectory'), null);
    assert.equal(picker.getAttribute('multiple'), 'true');
  } finally {
    Object.defineProperty(global, 'navigator', { value: originalNavigator, configurable: true });
  }
});

test('the desktop manual-sync hint is followed by a caution not to rename the saved file', () => {
  // A save dialog offers to rename the backup when one already exists; the
  // renamed copy then sits beside the original as a second file.
  setBackupSyncEnabled(true);
  const container = mount();
  const caution = byKey(container, 'P', 'settings.backupSync.manualModeWarning');
  assert.ok(caution, 'the caution is shown');
  assert.ok(caution.classList.contains('hint'));
  assert.ok(caution.classList.contains('caution'), 'in the app\'s caution style');
  assert.ok(!caution.classList.contains('warning'), 'not the red warning style');
  assert.equal(byKey(container, 'P', 'settings.backupSync.iosModeWarning'), undefined, 'and not the iOS wording');
  assert.match(t('settings.backupSync.manualModeWarning'), /Do not change the proposed file name/);
});

test('on iOS the caution is the Files-app wording, in the same style, and not the desktop one', () => {
  const originalNavigator = global.navigator;
  Object.defineProperty(global, 'navigator', {
    value: { ...originalNavigator, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
    configurable: true
  });
  try {
    setBackupSyncEnabled(true);
    const container = mount();
    const caution = byKey(container, 'P', 'settings.backupSync.iosModeWarning');
    assert.ok(caution, 'the iOS caution is shown');
    assert.ok(caution.classList.contains('hint') && caution.classList.contains('caution'));
    assert.equal(byKey(container, 'P', 'settings.backupSync.manualModeWarning'), undefined);
    assert.match(t('settings.backupSync.iosModeWarning'), /Replace, not Keep Both/);
  } finally {
    Object.defineProperty(global, 'navigator', { value: originalNavigator, configurable: true });
  }
});

test('picking a peer backup file through the combined Sync control merges it and shows a summary', async () => {
  localStorage.setItem('ballistics_device_id_v1', 'peer-device');
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'Peer Bullet', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const peerBundleText = serializeBackupBundle(buildBackupBundle());
  localStorage.clear();
  await resetLocationLibraryForTests();

  localStorage.setItem('ballistics_device_id_v1', 'my-device');
  setBackupSyncEnabled(true);
  const container = mount();

  // syncViaPickedFiles() also re-publishes this device's own bundle
  // afterward (no navigator.share in this fake environment, so it falls
  // back to downloadFile()) — stub the Blob-URL plumbing that needs, same
  // convention as sync-manual-sync.test.js's own captureDownload.
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:mock';
  URL.revokeObjectURL = () => {};

  const picker = findByTag(container, 'INPUT').find((i) => i.type === 'file');
  picker.files = [new File([peerBundleText], 'backup-peer-device.json', { type: 'application/json' })];
  fireEvent(picker, 'change');
  await new Promise((r) => setTimeout(r, 20)); // let the async change handler settle
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;

  assert.equal(loadUserBullets().length, 1);
  assert.equal(loadUserBullets()[0].name, 'Peer Bullet');
  assert.ok(container.textContent.includes(t('settings.backupSync.manualSyncSummary', { count: 1 })));
});

test('the iPhone-sync-support checkbox is shown regardless of platform, off by default, and toggling it persists', () => {
  setBackupSyncEnabled(true);
  const container = mount();
  const label = byKey(container, 'SPAN', 'settings.backupSync.iphoneSyncLabel');
  assert.ok(label, 'expected the iPhone sync support field to be shown even without File System Access support');
  const checkbox = findByTag(container, 'INPUT').find((i) => i.id === 'settings-backup-sync-iphone-support');
  assert.equal(checkbox.checked, false);

  checkbox.checked = true;
  fireEvent(checkbox, 'change');
  assert.equal(isIphoneSyncSupportEnabled(), true);
});

test('with File System Access support, the folder-based controls render instead', () => {
  global.window.showDirectoryPicker = async () => ({});
  setBackupSyncEnabled(true);
  const container = mount();
  assert.ok(byKey(container, 'BUTTON', 'settings.backupSync.chooseFolderButton'));
  assert.equal(findByTag(container, 'INPUT').find((i) => i.type === 'file'), undefined);
});

test('the folder picker is preceded by a hint to pick a folder a cloud provider already syncs', () => {
  // The picker itself gives no indication that the folder chosen here
  // needs to already be kept in sync by something else (iCloud Drive,
  // OneDrive, Google Drive, Dropbox, ...) — nothing here does that on its
  // own. Shown before the "Choose Folder…" button, not after, so it's
  // read before the choice is made.
  global.window.showDirectoryPicker = async () => ({});
  setBackupSyncEnabled(true);
  const container = mount();

  const hint = byKey(container, 'P', 'settings.backupSync.folderHint');
  assert.ok(hint, 'expected a hint explaining what kind of folder to pick');
  const chooseButton = byKey(container, 'BUTTON', 'settings.backupSync.chooseFolderButton');

  const field = findByTag(container, 'DIV').find((d) => d.childNodes && d.childNodes.includes(chooseButton));
  const order = field.childNodes.indexOf(hint) - field.childNodes.indexOf(chooseButton);
  assert.ok(order < 0, 'expected the hint before the button, not after');
});

test('Sync Now starts disabled until a folder is actually chosen', async () => {
  const fakeHandle = {
    kind: 'directory',
    async *entries() {},
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted'
  };
  global.window.showDirectoryPicker = async () => fakeHandle;
  setBackupSyncEnabled(true);
  const container = mount();

  const syncNowButton = byKey(container, 'BUTTON', 'settings.backupSync.syncNowButton');
  await new Promise((resolve) => setTimeout(resolve, 0)); // let refreshFolderStatus()'s IndexedDB read settle
  assert.equal(syncNowButton.disabled, true);

  const chooseButton = byKey(container, 'BUTTON', 'settings.backupSync.chooseFolderButton');
  fireEvent(chooseButton, 'click');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(syncNowButton.disabled, false);
});

test('once a folder is chosen, its name is shown so a user with more than one synced folder can tell which one this is', async () => {
  const fakeHandle = {
    kind: 'directory',
    name: "Guns' Sync",
    async *entries() {},
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted'
  };
  global.window.showDirectoryPicker = async () => fakeHandle;
  setBackupSyncEnabled(true);
  const container = mount();

  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.chooseFolderButton'), 'click');
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(container.textContent.includes(t('settings.backupSync.folderChosenNamed', { name: "Guns' Sync" })));
  assert.ok(!container.textContent.includes(t('settings.backupSync.folderNotChosen')));
});

test('a folder handle with no name (spec-wise near-impossible) falls back to the generic "chosen" message', async () => {
  const fakeHandle = {
    kind: 'directory',
    async *entries() {},
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted'
  };
  global.window.showDirectoryPicker = async () => fakeHandle;
  setBackupSyncEnabled(true);
  const container = mount();

  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.chooseFolderButton'), 'click');
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(container.textContent.includes(t('settings.backupSync.folderChosen')));
});

test('a pending unresolvable-photo warning is shown, naming the peer, and clears once the sync engine reports it resolved', async () => {
  const { recordPendingPhotoDevices } = await import('../src/sync/last-sync-status.js');
  recordPendingPhotoDevices(["Guns' iPhone"]);
  global.window.showDirectoryPicker = async () => ({});
  setBackupSyncEnabled(true);
  const container = mount();

  assert.ok(container.textContent.includes(t('settings.backupSync.photoWarning', { devices: "Guns' iPhone" })));

  recordPendingPhotoDevices([]);
  const syncNowButton = byKey(container, 'BUTTON', 'settings.backupSync.syncNowButton');
  fireEvent(syncNowButton, 'click');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(!container.textContent.includes("Guns' iPhone"));
});

test('a pending review shows a badge and Review button; resolving it clears the badge', () => {
  setBackupSyncEnabled(true);
  addPendingReview({
    recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'peer-1', remoteVersion: { id: 'b1', name: 'Peer Bullet' }
  });
  const container = mount();
  const reviewButton = byKey(container, 'BUTTON', 'settings.backupSync.reviewButton');
  assert.ok(reviewButton, 'expected a Review… button while a conflict is pending');

  fireEvent(reviewButton, 'click');
  const keepMineButton = byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.keepMineButton');
  assert.ok(keepMineButton, 'expected the review dialog to list the conflicting bullet with a Keep mine option');
  fireEvent(keepMineButton, 'click');

  assert.equal(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), undefined);
});

test('a clock-skew warning naming the peer is shown in the status, and clears once the peer is back in step', async () => {
  const { recordClockSkewedDevices } = await import('../src/sync/last-sync-status.js');
  recordClockSkewedDevices(["Guns' iPhone"]);
  global.window.showDirectoryPicker = async () => ({});
  setBackupSyncEnabled(true);
  const container = mount();

  assert.ok(container.textContent.includes(t('settings.backupSync.clockSkewWarning', { devices: "Guns' iPhone" })));

  recordClockSkewedDevices([]);
  const syncNowButton = byKey(container, 'BUTTON', 'settings.backupSync.syncNowButton');
  fireEvent(syncNowButton, 'click');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(!container.textContent.includes("Guns' iPhone"));
});

test('resolving a conflict records the decision, so the same unchanged remote version cannot re-raise it', () => {
  // "Keep mine" saves the local record, which fires the library-write hook
  // and clears the entry; the decision is then recorded against the exact
  // competing version. Without that second step an 'unresolvable-timestamp'
  // conflict comes straight back on the next cycle, since resolving
  // restamps only the local side.
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const remoteVersion = { id, name: 'Theirs' };
  addPendingReview({ recordType: 'bullet', recordId: id, reason: 'unresolvable-timestamp', peerDeviceId: 'peer-1', remoteVersion });

  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');
  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.keepMineButton'), 'click');
  assert.equal(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), undefined);

  // The next cycle offers the identical conflict again.
  addPendingReview({ recordType: 'bullet', recordId: id, reason: 'unresolvable-timestamp', peerDeviceId: 'peer-1', remoteVersion: { id, name: 'Theirs' } });
  const reRendered = mount();
  assert.equal(byKey(reRendered, 'BUTTON', 'settings.backupSync.reviewButton'), undefined,
    'a decided conflict must not come back unchanged');
});

test('Take theirs writes the peer\'s version and records that decision too', () => {
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const remoteVersion = {
    id, name: 'Theirs', manufacturer: 'M', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }
  };
  addPendingReview({ recordType: 'bullet', recordId: id, reason: 'unresolvable-timestamp', peerDeviceId: 'peer-1', remoteVersion });

  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');
  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.takeTheirsButton'), 'click');

  assert.equal(loadUserBullets().find((b) => b.id === id).name, 'Theirs');
  addPendingReview({ recordType: 'bullet', recordId: id, reason: 'unresolvable-timestamp', peerDeviceId: 'peer-1', remoteVersion: { ...remoteVersion } });
  assert.equal(byKey(mount(), 'BUTTON', 'settings.backupSync.reviewButton'), undefined);
});

test('the review dialog shows both sides\' timestamps and the conflict reason, per the plan\'s own spec', () => {
  // The first cut of this dialog dropped "the two timestamps" the plan
  // calls for, leaving no way to tell a genuine content conflict apart
  // from, say, a tombstone on one side colliding with an unreadable
  // timestamp on the other — both looked identical in the dialog.
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const [localBullet] = loadUserBullets();
  addPendingReview({
    recordType: 'bullet', recordId: id, reason: 'same-timestamp-diverged-content', peerDeviceId: 'peer-1',
    remoteVersion: { id, name: 'Theirs', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' }, modifiedAt: localBullet.modifiedAt }
  });

  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');

  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.review.yours')));
  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.review.theirs')));
  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.review.reasonDiverged')));
});

// ---- a conflict whose device has since been deleted ----

function openConflictFrom(peerDeviceId) {
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const [localBullet] = loadUserBullets();
  addPendingReview({
    recordType: 'bullet', recordId: id, reason: 'same-timestamp-diverged-content', peerDeviceId,
    remoteVersion: { id, name: 'Theirs', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' }, modifiedAt: localBullet.modifiedAt }
  });
  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');
  return { id, container };
}

test('a conflict from a device that has since been deleted names it, and says it is deleted', () => {
  seedPeers({ kitchen: { name: 'Kitchen PC', modifiedAt: '2026-01-01T00:00:00.000Z', lastExportedAt: '2026-03-01T00:00:00.000Z', deletedUpTo: '2026-03-01T00:00:00.000Z' } });
  assert.equal(isDeviceDeleted('kitchen'), true);
  openConflictFrom('kitchen');

  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.review.fromPeer', { peer: 'Kitchen PC (deleted)' })));
  assert.ok(!dialogRoot.textContent.includes('from kitchen'), 'not the raw id');
});

test('a conflict from a deleted device this device only knows from a tombstone shows its id, marked deleted', () => {
  seedPeers({ ghost: { deletedUpTo: '2026-03-01T00:00:00.000Z' } });
  openConflictFrom('ghost');
  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.review.peerDeleted', { device: 'ghost' })));
});

test('a conflict from a live device still shows just its name', () => {
  seedPeers({ kitchen: KITCHEN });
  openConflictFrom('kitchen');
  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.review.fromPeer', { peer: 'Kitchen PC' })));
  assert.ok(!dialogRoot.textContent.includes('(deleted)'));
});

test('a conflict from a device that returned after being deleted shows just its name', () => {
  seedPeers({ kitchen: { name: 'Kitchen PC', modifiedAt: '2026-01-01T00:00:00.000Z', lastExportedAt: '2026-05-01T00:00:00.000Z', deletedUpTo: '2026-03-01T00:00:00.000Z' } });
  assert.equal(isDeviceDeleted('kitchen'), false);
  openConflictFrom('kitchen');
  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.review.fromPeer', { peer: 'Kitchen PC' })));
  assert.ok(!dialogRoot.textContent.includes('(deleted)'));
});

test('a conflict from a device nobody knows shows the raw id, as before', () => {
  openConflictFrom('mystery-device');
  assert.ok(dialogRoot.textContent.includes('mystery-device'));
  assert.ok(!dialogRoot.textContent.includes('(deleted)'));
});

test('a conflict from a deleted device can still be resolved: its version is in the conflict record, not in the device\'s file', () => {
  seedPeers({ kitchen: { name: 'Kitchen PC', modifiedAt: '2026-01-01T00:00:00.000Z', lastExportedAt: '2026-03-01T00:00:00.000Z', deletedUpTo: '2026-03-01T00:00:00.000Z' } });
  const { id } = openConflictFrom('kitchen');

  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.takeTheirsButton'), 'click');

  assert.equal(loadUserBullets().find((b) => b.id === id).name, 'Theirs');
});

test('the review dialog states which library a conflicting item belongs to, since two libraries can share a name', () => {
  // Reproduces the real "K31" field report: a built-in arsenal rifle and
  // a rifle-precision project can be named identically, with nothing
  // else in the dialog (name, peer, timestamps) able to tell a user which
  // one a given conflict is actually about.
  setBackupSyncEnabled(true);
  addPendingReview({
    recordType: 'rifle', recordId: 'r1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'peer-1', remoteVersion: { id: 'r1', name: 'K31' }
  });
  addPendingReview({
    recordType: 'rifle-precision-project', recordId: 'p1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'peer-1', remoteVersion: { id: 'p1', name: 'K31' }
  });

  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');

  assert.ok(dialogRoot.textContent.includes(
    t('settings.backupSync.review.libraryLine', { library: t('settings.changeHistory.recordTypeRifle') })
  ), 'expected the arsenal rifle conflict to be labeled as such');
  assert.ok(dialogRoot.textContent.includes(
    t('settings.backupSync.review.libraryLine', { library: t('settings.changeHistory.recordTypeRifleProject') })
  ), 'expected the rifle-precision project conflict to be labeled as such');
});

test('the review dialog marks whichever side is actually a deletion, not just an edit', () => {
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  addPendingReview({
    recordType: 'bullet', recordId: id, reason: 'unresolvable-timestamp', peerDeviceId: 'peer-1',
    remoteVersion: { id, name: 'Mine', deletedAt: 'not-a-valid-date', deletedBy: 'peer-1' }
  });

  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');

  const theirsLine = t('settings.backupSync.review.sideDeleted', {
    side: t('settings.backupSync.review.theirs'), when: t('settings.backupSync.review.unknownTimestamp')
  });
  assert.ok(dialogRoot.textContent.includes(theirsLine), 'expected the peer\'s tombstone to be labeled as a deletion with an unreadable timestamp');
});

test('regression: resolving a conflict with real, tied, non-zero revisions correctly dominates so it does not recur', () => {
  // A skip-review conflict can only arise when both sides' revisions are
  // equal (see merge.js's own comment) — at revision 0 for every record
  // that predates this field, but just as validly at any other tied
  // value once revisions are actually in use. "Keep mine" must still
  // produce a revision strictly ahead of that tie, or the very next sync
  // would see the peer's untouched, equal-or-higher revision "win" the
  // comparison outright and silently overwrite the user's explicit
  // choice — bypassing the review surface entirely, not just re-annoying
  // the user with it.
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Mine v1', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const tiedRevision = loadUserBullets()[0].revision; // 2, from the two saves above
  assert.ok(tiedRevision > 0);

  const remoteVersion = {
    id, name: 'Theirs', manufacturer: 'M', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }, revision: tiedRevision
  };
  addPendingReview({ recordType: 'bullet', recordId: id, reason: 'same-timestamp-diverged-content', peerDeviceId: 'peer-1', remoteVersion });

  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');
  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.keepMineButton'), 'click');

  const kept = loadUserBullets().find((b) => b.id === id);
  assert.equal(kept.name, 'Mine');
  assert.ok(kept.revision > tiedRevision, 'the resolved write must exceed the tie, not merely equal it');

});

test('regression (async companion): the kept, higher-revision record correctly beats the original tied remote on the next merge', async () => {
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Mine v1', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const tiedRevision = loadUserBullets()[0].revision;

  const remoteVersion = {
    id, name: 'Theirs', manufacturer: 'M', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }, revision: tiedRevision
  };
  addPendingReview({ recordType: 'bullet', recordId: id, reason: 'same-timestamp-diverged-content', peerDeviceId: 'peer-1', remoteVersion });

  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');
  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.keepMineButton'), 'click');

  const kept = loadUserBullets().find((b) => b.id === id);
  const { resolveRecord } = await import('../src/sync/merge.js');
  // The exact same competing version, re-offered unchanged (same
  // revision it always had), must lose outright now — not merely be
  // re-suppressed, but genuinely beaten on revision.
  assert.deepEqual(resolveRecord(kept, remoteVersion), { action: 'skip', reason: 'local-is-newer' });
});

test('picking a side makes the choice visibly stick: the two buttons are replaced by a resolved indicator', () => {
  // Before this, clicking either button left the row looking exactly as
  // it did beforehand — no confirmation the click did anything, in a
  // dialog whose own rows are a one-time snapshot that never re-renders
  // itself from the pending-review store.
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  addPendingReview({ recordType: 'bullet', recordId: id, reason: 'unresolvable-timestamp', peerDeviceId: 'peer-1', remoteVersion: { id, name: 'Theirs' } });

  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');
  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.keepMineButton'), 'click');

  assert.equal(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.keepMineButton'), undefined);
  assert.equal(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.takeTheirsButton'), undefined);
  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.review.resolvedKeepMine')));
  assert.ok(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.cancelButton'), 'expected a Cancel button once a side is picked');
});

test('Cancel undoes a "Keep mine" choice: restores the original record verbatim and re-offers the same conflict', () => {
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  const original = saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  addPendingReview({ recordType: 'bullet', recordId: id, reason: 'unresolvable-timestamp', peerDeviceId: 'peer-1', remoteVersion: { id, name: 'Theirs' } });

  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');
  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.keepMineButton'), 'click');
  // "Keep mine" restamps modifiedAt/revision even though content is unchanged.
  // Asserted on `revision`, not `modifiedAt`: both stamps come from
  // new Date() inside one synchronous burst, so they land in the same
  // millisecond often enough to make a string comparison intermittently
  // fail. `revision` is a strictly incrementing integer
  // (revision.js's nextLocalRevision), so it proves the same thing —
  // that the write really happened — without depending on the clock
  // ticking between two statements.
  const afterKeepMine = loadUserBullets().find((b) => b.id === id);
  assert.ok(afterKeepMine.revision > original.revision,
    `Keep mine must write a new revision (was ${original.revision}, now ${afterKeepMine.revision})`);
  assert.ok(Date.parse(afterKeepMine.modifiedAt) >= Date.parse(original.modifiedAt));

  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.cancelButton'), 'click');

  const restored = loadUserBullets().find((b) => b.id === id);
  assert.equal(restored.modifiedAt, original.modifiedAt, 'the exact pre-choice modifiedAt must come back, not a fresh one');
  assert.equal(restored.revision, original.revision);
  // The row goes back to its undecided state, in this same open dialog.
  assert.ok(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.keepMineButton'));
  assert.ok(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.takeTheirsButton'));
  // And the conflict is genuinely back, not just visually — a fresh
  // mount of the whole section must show it as outstanding again.
  assert.ok(byKey(mount(), 'BUTTON', 'settings.backupSync.reviewButton'));
});

test('Cancel undoes a "Take theirs" choice: the peer\'s content is reverted back to the original local record', () => {
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const remoteVersion = {
    id, name: 'Theirs', manufacturer: 'M', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }
  };
  addPendingReview({ recordType: 'bullet', recordId: id, reason: 'unresolvable-timestamp', peerDeviceId: 'peer-1', remoteVersion });

  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');
  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.takeTheirsButton'), 'click');
  assert.equal(loadUserBullets().find((b) => b.id === id).name, 'Theirs');

  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.cancelButton'), 'click');

  assert.equal(loadUserBullets().find((b) => b.id === id).name, 'Mine', 'the peer\'s content must not survive a cancel');
  assert.ok(byKey(mount(), 'BUTTON', 'settings.backupSync.reviewButton'), 'the conflict must be outstanding again');
});

test('onSyncApplied fires after a review-dialog resolution and again after a cancel', () => {
  // settings-view.js wires this in as changeHistorySection()'s refresh() —
  // resolving (or cancelling) a conflict writes through the normal save
  // path just like any other edit, so that section needs the same nudge a
  // sync cycle or manual import gets.
  setBackupSyncEnabled(true);
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Mine', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  addPendingReview({ recordType: 'bullet', recordId: id, reason: 'unresolvable-timestamp', peerDeviceId: 'peer-1', remoteVersion: { id, name: 'Theirs' } });

  let calls = 0;
  const container = mount(() => { calls += 1; });
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.reviewButton'), 'click');
  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.keepMineButton'), 'click');
  assert.equal(calls, 1, 'expected one call after resolving');

  fireEvent(byKey(dialogRoot, 'BUTTON', 'settings.backupSync.review.cancelButton'), 'click');
  assert.equal(calls, 2, 'expected a second call after cancelling');
});

// ---- the Devices list — docs/plans/orphaned-storage-cleanup.md phase 6 ----

function rowTexts(container) {
  // Each device is one hint paragraph carrying "<label> — <status>", or
  // just "<label>" when there is nothing true to say about it.
  return findByTag(container, 'P').map((p) => p.textContent);
}

test('the Devices list is hidden while this is the only device', () => {
  setBackupSyncEnabled(true);
  const container = mount();
  assert.ok(!container.textContent.includes(t('settings.backupSync.devices.heading')) ||
    findByTag(container, 'H4').every((h) => h.getAttribute('data-i18n') !== 'settings.backupSync.devices.heading' || h.parentNode.style.display === 'none'),
    'a one-row list of yourself is noise');
});

test('this device\'s own row never claims its backup file is missing', () => {
  // The registry only holds peers, so this row is synthesized. Its
  // publish time used to be null, which the UI read as "no backup file in
  // the folder" — beside a device that had just published.
  localStorage.setItem('ballistics_device_registry_v1', JSON.stringify({
    kitchen: { name: 'Kitchen PC', modifiedAt: '2026-01-01T00:00:00.000Z', lastExportedAt: '2026-09-01T00:00:00.000Z' }
  }));
  setBackupSyncEnabled(true);
  const container = mount();

  const own = rowTexts(container).find((text) => text.includes(t('settings.backupSync.devices.thisDevice', { device: getDeviceName() })));
  assert.ok(own, 'this device should be listed');
  assert.ok(!own.includes(t('settings.backupSync.devices.noBackup')),
    'nothing is known about this device\'s file from the registry, so nothing should be claimed');
});

test('this device\'s own row shows when it last published', () => {
  localStorage.setItem('ballistics_device_registry_v1', JSON.stringify({
    kitchen: { name: 'Kitchen PC', modifiedAt: '2026-01-01T00:00:00.000Z', lastExportedAt: '2026-09-01T00:00:00.000Z' }
  }));
  const publishedAt = '2026-09-15T12:00:00.000Z';
  localStorage.setItem('ballistics_own_published_at_v1', publishedAt);
  setBackupSyncEnabled(true);
  const container = mount();

  const expected = t('settings.backupSync.devices.published', { when: new Date(publishedAt).toLocaleString() });
  assert.ok(rowTexts(container).some((text) => text.includes(getDeviceName()) && text.includes(expected)));
});

test('a peer first seen during this visit appears after a sync, without reopening Settings', async () => {
  // renderDevices() used to run once at mount and never again, so a peer
  // whose bundle was read by the very sync the user just triggered stayed
  // invisible until Settings was reopened.
  // The fake IndexedDB is not reset between tests, so a folder handle
  // persisted by an earlier test would still be there. That made the
  // mount-time async folder read finish *after* the registry write below
  // and repaint the list on its own — so the refresh this test exists to
  // pin never had to happen, and it passed with the fix removed. Clear it,
  // and let everything the mount kicked off settle, so the only thing that
  // can put the peer on screen is the refresh after the sync.
  const { forgetFolder } = await import('../src/sync/fs-folder.js');
  await forgetFolder();
  global.window.showDirectoryPicker = async () => ({});
  setBackupSyncEnabled(true);
  const container = mount();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(!container.textContent.includes('Late Arrival PC'));

  localStorage.setItem('ballistics_device_registry_v1', JSON.stringify({
    late: { name: 'Late Arrival PC', modifiedAt: '2026-01-01T00:00:00.000Z', lastExportedAt: '2026-09-01T00:00:00.000Z' }
  }));
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.syncNowButton'), 'click');
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.ok(container.textContent.includes('Late Arrival PC'),
    'a sync ends in renderStatus(), which is what has to keep this list current');
});

test('a backup file in the folder that has not been read here yet still appears, under the name and id inside it', async () => {
  // The registry is filled by reading a peer's bundle in a sync cycle, so
  // a device whose file is in the folder but hasn't been through one in
  // this browser was invisible. The file is opened once to learn whose it
  // is — it is deliberately called something that says nothing about that.
  const real = localStorage.getItem('ballistics_device_id_v1');
  localStorage.setItem('ballistics_device_id_v1', 'stranger-device');
  localStorage.setItem('ballistics_device_name_v1', JSON.stringify({ name: 'Stranger PC', modifiedAt: '2021-01-01T00:00:00.000Z' }));
  const strangerText = serializeBackupBundle(buildBackupBundle());
  if (real) localStorage.setItem('ballistics_device_id_v1', real); else localStorage.removeItem('ballistics_device_id_v1');
  localStorage.removeItem('ballistics_device_name_v1');

  const notFound = () => Object.assign(new Error('not found'), { name: 'NotFoundError' });
  const fakeHandle = {
    kind: 'directory',
    name: 'Sync',
    async *entries() { yield ['backup-friday-export.json', { kind: 'file' }]; },
    async getFileHandle(name) {
      if (name !== 'backup-friday-export.json') throw notFound();
      return { kind: 'file', async getFile() { return { text: async () => strangerText }; } };
    },
    async getDirectoryHandle() { throw notFound(); },
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted'
  };
  global.window.showDirectoryPicker = async () => fakeHandle;
  setBackupSyncEnabled(true);
  const container = mount();

  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.chooseFolderButton'), 'click');
  await new Promise((resolve) => setTimeout(resolve, 30));
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.syncNowButton'), 'click');
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.ok(container.textContent.includes('Stranger PC'), 'listed by the name the file itself states');
});

// ---- deleting a device: one button, a picker, then the confirmation ----

function seedPeers(peers) {
  localStorage.setItem('ballistics_device_registry_v1', JSON.stringify(peers));
}
const dialogOpen = () => findByTag(dialogRoot, 'DIV').find((d) => d.classList.contains('app-dialog-overlay')).style.display !== 'none';
const dialogButtons = () => findByTag(dialogRoot, 'BUTTON').map((b) => b.textContent);
const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
const KITCHEN = { name: 'Kitchen PC', modifiedAt: '2026-01-01T00:00:00.000Z', lastExportedAt: '2026-01-15T00:00:00.000Z' };
const LAPTOP = { name: 'Old Laptop', modifiedAt: '2026-01-01T00:00:00.000Z', lastExportedAt: '2026-01-10T00:00:00.000Z' };
const pickerRows = () => findByTag(dialogRoot, 'DIV').filter((d) => d.classList.contains('arsenal-row'));

test('the Devices list has no Delete button on any row, just one "Delete device…" button', () => {
  seedPeers({ kitchen: KITCHEN, laptop: LAPTOP });
  setBackupSyncEnabled(true);
  const container = mount();

  assert.deepEqual(findByTag(container, 'BUTTON').filter((b) => b.textContent === t('settings.backupSync.devices.deleteDeviceButton')).length, 1);
  assert.equal(findByTag(container, 'BUTTON').filter((b) => b.textContent === 'Delete').length, 0, 'no per-row Delete');
  assert.ok(!dialogOpen(), 'and nothing is open until the button is pressed');
});

test('with only this device there is nothing to delete, so no button is offered', () => {
  setBackupSyncEnabled(true);
  const container = mount();
  assert.equal(byKey(container, 'BUTTON', 'settings.backupSync.devices.deleteDeviceButton'), undefined);
});

test('"Delete device…" opens a picker of the other devices, never this one, with a Cancel button', () => {
  seedPeers({ kitchen: KITCHEN, laptop: LAPTOP });
  setBackupSyncEnabled(true);
  const container = mount();

  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.devices.deleteDeviceButton'), 'click');

  assert.ok(dialogOpen());
  const text = dialogRoot.textContent;
  assert.ok(text.includes('Kitchen PC') && text.includes('Old Laptop'));
  assert.ok(!text.includes(getDeviceName()), 'this device can never be chosen');
  assert.equal(pickerRows().length, 2);
  assert.deepEqual(dialogButtons(), [t('settings.backupSync.devices.confirmCancel')], 'Cancel is the only button');
});

test('Cancel in the picker closes it and deletes nothing', async () => {
  seedPeers({ kitchen: KITCHEN });
  setBackupSyncEnabled(true);
  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.devices.deleteDeviceButton'), 'click');

  fireEvent(findByTag(dialogRoot, 'BUTTON').find((b) => b.textContent === t('settings.backupSync.devices.confirmCancel')), 'click');
  await settle();

  assert.ok(!dialogOpen());
  assert.equal(isDeviceDeleted('kitchen'), false);
});

test('picking a device goes on to the confirmation, and only confirming deletes it', async () => {
  seedPeers({ kitchen: KITCHEN, laptop: LAPTOP });
  setBackupSyncEnabled(true);
  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.devices.deleteDeviceButton'), 'click');

  const kitchenRow = pickerRows().find((row) => row.textContent.includes('Kitchen PC'));
  fireEvent(kitchenRow, 'click');

  assert.ok(dialogOpen(), 'the confirmation replaces the picker');
  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.devices.confirmTitle', { device: 'Kitchen PC' })));
  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.devices.confirmRejoins')));
  assert.equal(isDeviceDeleted('kitchen'), false, 'picking is not confirming');

  fireEvent(findByTag(dialogRoot, 'BUTTON').find((b) => b.textContent === t('settings.backupSync.devices.confirmDelete')), 'click');
  await settle();

  assert.equal(isDeviceDeleted('kitchen'), true);
  assert.equal(isDeviceDeleted('laptop'), false, 'only the one that was picked');
});

test('cancelling the confirmation after picking a device deletes nothing', async () => {
  seedPeers({ kitchen: KITCHEN });
  setBackupSyncEnabled(true);
  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.devices.deleteDeviceButton'), 'click');
  fireEvent(pickerRows()[0], 'click');

  fireEvent(findByTag(dialogRoot, 'BUTTON').find((b) => b.textContent === t('settings.backupSync.devices.confirmCancel')), 'click');
  await settle();

  assert.equal(isDeviceDeleted('kitchen'), false);
});

test('a device that synced recently gets its "probably still in use" warning in the confirmation', () => {
  const justNow = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  seedPeers({ kitchen: { ...KITCHEN, lastExportedAt: justNow } });
  setBackupSyncEnabled(true);
  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.devices.deleteDeviceButton'), 'click');
  fireEvent(pickerRows()[0], 'click');

  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.devices.confirmRecent', { when: new Date(justNow).toLocaleString() })));
});

test('a device that cannot be deleted yet is shown in the picker with the reason, and cannot be picked', async () => {
  seedPeers({ kitchen: KITCHEN, laptop: LAPTOP });
  addPendingReview({
    recordType: 'bullet', recordId: 'b1', reason: 'unresolvable-timestamp',
    peerDeviceId: 'kitchen', remoteVersion: { id: 'b1', name: 'Theirs' }
  });
  setBackupSyncEnabled(true);
  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.devices.deleteDeviceButton'), 'click');

  const kitchenRow = pickerRows().find((row) => row.textContent.includes('Kitchen PC'));
  assert.ok(kitchenRow.textContent.includes(t('settings.backupSync.devices.blockedConflicts', { device: 'Kitchen PC', count: 1 })));
  assert.ok(!kitchenRow.classList.contains('row-clickable'), 'not offered as a choice');

  fireEvent(kitchenRow, 'click');
  await settle();
  assert.ok(!dialogRoot.textContent.includes(t('settings.backupSync.devices.confirmTitle', { device: 'Kitchen PC' })), 'no confirmation for it');
  assert.equal(isDeviceDeleted('kitchen'), false);
  assert.ok(pickerRows().find((row) => row.textContent.includes('Old Laptop')).classList.contains('row-clickable'), 'the other one still can be');
});

test('a device nothing has been merged from is shown in the picker with "sync first", and cannot be picked', async () => {
  // Known only from a file in the folder: there is no export of it merged
  // here to record as discarded.
  seedPeers({ kitchen: { name: 'Kitchen PC', modifiedAt: '2026-01-01T00:00:00.000Z' } });
  setBackupSyncEnabled(true);
  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.devices.deleteDeviceButton'), 'click');

  const row = pickerRows().find((r) => r.textContent.includes('Kitchen PC'));
  assert.ok(row.textContent.includes(t('settings.backupSync.devices.blockedNotMerged', { device: 'Kitchen PC' })));
  assert.ok(!row.classList.contains('row-clickable'));
});

test('in a browser that cannot remove files the confirmation says the file stays, and does not claim it is removed', () => {
  seedPeers({ kitchen: KITCHEN });
  setBackupSyncEnabled(true); // no File System Access in this fake environment, as in Firefox
  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.devices.deleteDeviceButton'), 'click');
  fireEvent(pickerRows()[0], 'click');

  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.devices.confirmBodyNoFolder')));
  assert.ok(!dialogRoot.textContent.includes(t('settings.backupSync.devices.confirmBody')));
});

test('with folder access the confirmation says the file is removed', () => {
  global.window.showDirectoryPicker = async () => ({});
  seedPeers({ kitchen: KITCHEN });
  setBackupSyncEnabled(true);
  const container = mount();
  fireEvent(byKey(container, 'BUTTON', 'settings.backupSync.devices.deleteDeviceButton'), 'click');
  fireEvent(pickerRows()[0], 'click');

  assert.ok(dialogRoot.textContent.includes(t('settings.backupSync.devices.confirmBody')));
  assert.ok(!dialogRoot.textContent.includes(t('settings.backupSync.devices.confirmBodyNoFolder')));
});

// ---- "Clean Up Storage Now" only where it has something to do ----

test('a browser without folder access gets no "Clean Up Storage Now" button, hint or report area', () => {
  // What it is for is removing photo files from the sync folder; without
  // one, everything else it does already happens at every app start.
  setBackupSyncEnabled(true); // no File System Access in this fake environment, as in Firefox
  const container = mount();
  assert.equal(byKey(container, 'BUTTON', 'settings.backupSync.cleanup.runNowButton'), undefined);
  assert.equal(byKey(container, 'P', 'settings.backupSync.cleanup.runNowHint'), undefined);
  assert.ok(byKey(container, 'BUTTON', 'settings.backupSync.clearLogButton'), 'the rest of the Advanced section is still there');
});

test('with folder access "Clean Up Storage Now" is offered, with its hint', () => {
  global.window.showDirectoryPicker = async () => ({});
  setBackupSyncEnabled(true);
  const container = mount();
  assert.ok(byKey(container, 'BUTTON', 'settings.backupSync.cleanup.runNowButton'));
  assert.ok(byKey(container, 'P', 'settings.backupSync.cleanup.runNowHint'));
});

// ---- Copy log ----

test('Copy log hands over the persistent log, warnings included, even with verbose logging off and nothing in memory', async () => {
  // The in-memory trace is only filled while verbose logging is on and is
  // empty after a reload, so copying that alone left the warnings this log
  // exists for (a duplicate backup file removed, a sync that failed)
  // unreachable from the UI.
  const { logSyncEvent, clearSyncLog, clearPersistedSyncLog, setVerboseSyncLoggingEnabled } = await import('../src/sync/sync-log.js');
  setVerboseSyncLoggingEnabled(false);
  clearSyncLog();
  await clearPersistedSyncLog();
  logSyncEvent('warn', 'sync: removed backup-x (1).json — superseded');

  let copied = null;
  Object.defineProperty(global.navigator, 'clipboard', {
    configurable: true, value: { writeText: async (text) => { copied = text; } }
  });
  setBackupSyncEnabled(true);
  const container = mount();
  const copyButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute('aria-label') === t('settings.backupSync.copyLogButton'));
  assert.ok(copyButton, 'the Copy log button is there');

  fireEvent(copyButton, 'click');
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.match(copied || '', /WARN sync: removed backup-x \(1\)\.json/);
});
