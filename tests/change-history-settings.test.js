import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { mountDialogRoot } = await import('../src/ui/app-dialog.js');
const { changeHistorySection } = await import('../src/ui/change-history-settings.js');
const { resetChangeHistoryForTests } = await import('../src/sync/change-history.js');
const { saveUserBullet, deleteUserBullet, loadUserBullets, generateUserId } = await import('../src/user-library.js');
const { resetLocationLibraryForTests } = await import('../src/location-library.js');
const { resetRiflePrecisionLibraryForTests } = await import('../src/rifle-precision-library.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function mount() {
  const container = makeElement('main');
  container.appendChild(changeHistorySection().node);
  return container;
}

// Only the "external refresh" test below needs the `refresh` handle
// itself — every other test here only ever looks at the rendered DOM.
function mountWithRefresh() {
  const container = makeElement('main');
  const { node, refresh } = changeHistorySection();
  container.appendChild(node);
  return { container, refresh };
}

let dialogRoot;
const settle = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

test.beforeEach(async () => {
  localStorage.clear();
  await resetLocationLibraryForTests();
  await resetRiflePrecisionLibraryForTests();
  await resetChangeHistoryForTests();
  dialogRoot = makeElement('div');
  mountDialogRoot(dialogRoot);
});

test('shows the empty hint when there is no history yet', () => {
  const container = mount();
  assert.ok(container.textContent.includes('No recent changes yet'));
});

test('lists a recent edit with a Revert button', () => {
  // Two writes: history holds superseded versions, so creating a record
  // captures nothing — there has to be something it replaced.
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'My Bullet', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserBullet({ id, name: 'My Bullet Renamed', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const container = mount();
  assert.ok(container.textContent.includes('My Bullet'));
  const revertButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'settings.changeHistory.revertButton');
  assert.ok(revertButton);
});

test('reverting a deletion brings the record back and re-renders the list', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'My Bullet', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  deleteUserBullet(id);
  assert.equal(loadUserBullets().length, 0);

  const container = mount();
  // One entry: the live record the deletion superseded. (The create itself
  // captured nothing — there was no earlier version to keep.)
  const revertButtons = findByTag(container, 'BUTTON').filter((b) => b.getAttribute && b.getAttribute('data-i18n') === 'settings.changeHistory.revertButton');
  assert.equal(revertButtons.length, 1);
  fireEvent(revertButtons[0], 'click');
  await settle(); // the snapshot is fetched from storage first

  assert.equal(loadUserBullets().length, 1);
  assert.equal(loadUserBullets()[0].name, 'My Bullet');
});

test('Recently Deleted shows the empty hint when nothing has been deleted', () => {
  const container = mount();
  assert.ok(container.textContent.includes('Nothing recently deleted'));
});

test('Recently Deleted lists a deleted record with a Restore button, separate from the flat recent-changes list', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Gone Bullet', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  deleteUserBullet(id);

  const container = mount();
  const restoreButtons = findByTag(container, 'BUTTON').filter((b) => b.getAttribute && b.getAttribute('data-i18n') === 'settings.changeHistory.restoreButton');
  assert.equal(restoreButtons.length, 1, 'expected exactly one Restore button in the trash-bin section');

  fireEvent(restoreButtons[0], 'click');
  await settle();
  assert.equal(loadUserBullets().length, 1);
  assert.equal(loadUserBullets()[0].name, 'Gone Bullet');
  // Restoring is itself an edit, so the record drops back out of the trash bin.
  assert.ok(container.textContent.includes('Nothing recently deleted'));
});

test('History… opens a dialog listing every retained version of that record, each independently restorable', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'V1', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserBullet({ id, name: 'V2', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserBullet({ id, name: 'V3', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = mount();
  const historyButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'settings.changeHistory.historyButton');
  assert.ok(historyButton, 'expected a History… button next to the recent-changes entry');
  fireEvent(historyButton, 'click');

  // The two superseded versions — V3 is the current value, which is not
  // something there is any point "restoring" to.
  assert.ok(dialogRoot.textContent.includes('V1'));
  assert.ok(dialogRoot.textContent.includes('V2'));
  const restoreVersionButtons = findByTag(dialogRoot, 'BUTTON')
    .filter((b) => b.getAttribute && b.getAttribute('data-i18n') === 'settings.changeHistory.restoreVersionButton');
  assert.equal(restoreVersionButtons.length, 2, 'one restore action per retained version');

  fireEvent(restoreVersionButtons[1], 'click'); // the older one (V1), listed second (newest first)
  await settle();
  assert.equal(loadUserBullets()[0].name, 'V1');
});

test('each history entry shows who made the change', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Attributed', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserBullet({ id, name: 'Attributed v2', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = mount();
  assert.ok(container.textContent.includes(t('settings.changeHistory.thisDeviceLabel')),
    'a local edit should be attributed to "this device"');
});

// settings-view.js wires this refresh() in as backupSyncSection()'s
// onSyncApplied, specifically so a sync cycle, a manual import, or a
// resolved conflict — none of which this section has any other way to
// learn about — shows up here right away rather than only after the
// whole Settings page is next reopened. This test stands in for that
// wiring without pulling in the sync UI: any write reaching the
// change-history store the same way a merge-applied one would is enough
// to prove refresh() actually re-reads the store rather than replaying a
// stale snapshot taken at mount time.
test('refresh() picks up a change-history entry added after mount, simulating a sync-driven write', () => {
  // A history entry describes the version a write *superseded*, not the
  // new value (see summaryFor's own comment) — so creating the record
  // captures nothing yet, and the entry this test looks for, once it
  // exists, is named after the *original* value ("Before Sync"), not the
  // one that replaced it.
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Before Sync', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const { container, refresh } = mountWithRefresh();
  assert.ok(!container.textContent.includes('Before Sync'), 'nothing superseded it yet, so no history entry exists');

  // A write happening "elsewhere" (a merge-applied overwrite, in
  // production) — this section's own DOM has no listener on it, so
  // nothing changes here until refresh() is explicitly called.
  saveUserBullet({ id, name: 'After Sync', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  assert.ok(!container.textContent.includes('Before Sync'), 'must not update on its own without refresh()');

  refresh();
  assert.ok(container.textContent.includes('Before Sync'), 'the superseded version should now be listed');
});

// ---- how many rows: up to 50 kept per list, ten visible at a time ----

const BULLET = { manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } };
const buttonsFor = (container, key) => findByTag(container, 'BUTTON').filter((b) => b.getAttribute && b.getAttribute('data-i18n') === key);
function findByClass(node, cls, out = []) {
  if (node.classList && node.classList.contains(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

test('Recent changes keeps fifty entries, not twenty', () => {
  const id = generateUserId('user-bullet');
  for (let i = 0; i < 61; i++) saveUserBullet({ id, name: `Edit ${i}`, ...BULLET });

  const container = mount();
  assert.equal(buttonsFor(container, 'settings.changeHistory.revertButton').length, 50, 'sixty entries exist; the list holds the newest fifty');
  assert.ok(container.textContent.includes('Edit 59'), 'the newest is there');
  assert.ok(!container.textContent.includes('Edit 0 '), 'the oldest is not');
});

test('Recently deleted keeps fifty entries, not twenty', () => {
  for (let i = 0; i < 55; i++) {
    const id = generateUserId('user-bullet');
    saveUserBullet({ id, name: `Doomed ${i}`, ...BULLET });
    deleteUserBullet(id);
  }
  const container = mount();
  assert.equal(buttonsFor(container, 'settings.changeHistory.restoreButton').length, 50);
});

test('each list scrolls inside its own box', () => {
  const container = mount();
  const scrollers = findByClass(container, 'history-scroll');
  assert.equal(scrollers.length, 2, 'one for Recently deleted, one for Recent changes');
});

test('each list is sized to exactly ten rows, measured, and unbounded when there are ten or fewer', () => {
  // No layout engine here, so a stand-in ResizeObserver hands over its
  // callback and the rows report positions. Rows 32px apart: ten of them
  // are 320px, so that is what the box must be.
  const observers = [];
  global.ResizeObserver = class { constructor(callback) { observers.push(callback); } observe() {} disconnect() {} };
  try {
    const id = generateUserId('user-bullet');
    for (let i = 0; i < 13; i++) saveUserBullet({ id, name: `Edit ${i}`, ...BULLET }); // 12 entries

    const container = mount();
    const [deletedBox, recentBox] = findByClass(container, 'history-scroll');
    const stub = (box) => box.childNodes[0].childNodes.forEach((row, i) => { row.getBoundingClientRect = () => ({ top: 100 + i * 32 }); });
    stub(deletedBox);
    stub(recentBox);
    observers.forEach((callback) => callback());

    assert.equal(recentBox.style.maxHeight, '320px', 'twelve rows: the box shows the first ten');
    assert.equal(deletedBox.style.maxHeight, 'none', 'only the empty hint: nothing to limit');
  } finally {
    delete global.ResizeObserver;
  }
});

test('the measurement follows the row heights, so wrapped rows still show ten', () => {
  const observers = [];
  global.ResizeObserver = class { constructor(callback) { observers.push(callback); } observe() {} disconnect() {} };
  try {
    const id = generateUserId('user-bullet');
    for (let i = 0; i < 13; i++) saveUserBullet({ id, name: `Edit ${i}`, ...BULLET });
    const container = mount();
    const recentBox = findByClass(container, 'history-scroll')[1];
    // A narrow screen: every row is three lines tall.
    recentBox.childNodes[0].childNodes.forEach((row, i) => { row.getBoundingClientRect = () => ({ top: i * 96 }); });
    observers.forEach((callback) => callback());
    assert.equal(recentBox.style.maxHeight, '960px');
  } finally {
    delete global.ResizeObserver;
  }
});

test('a restore button is disabled while the snapshot is being fetched, so a second click cannot restore twice', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Once', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  deleteUserBullet(id);
  const container = mount();
  const [restoreButton] = buttonsFor(container, 'settings.changeHistory.restoreButton');

  fireEvent(restoreButton, 'click');
  assert.equal(restoreButton.disabled, true, 'disabled at once, before the fetch has finished');
  await settle();
  assert.equal(loadUserBullets().length, 1);
});

test('history entries are dated in ISO form, with no time and no locale format', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'V1', ...BULLET });
  saveUserBullet({ id, name: 'V2', ...BULLET });
  const gone = generateUserId('user-bullet');
  saveUserBullet({ id: gone, name: 'Gone', ...BULLET });
  deleteUserBullet(gone);

  const container = mount();
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const rows = findByTag(container, 'SPAN').map((s) => s.textContent).filter((text) => text.includes('—'));
  assert.ok(rows.length >= 2, 'a recent change and a deletion are listed');
  for (const row of rows) {
    assert.ok(row.includes(iso), row);
    assert.ok(!/\d{1,2}:\d{2}/.test(row), `no time of day in: ${row}`);
  }
});
