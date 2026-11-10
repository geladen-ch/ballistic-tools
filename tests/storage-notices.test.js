import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, makeElement, fireEvent } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { isIOS, isHomeScreenApp } = await import('../src/platform.js');
const {
  recordBackupSaved, recordDataChanged, seedUnsavedData, snoozeBackupReminder, isBackupReminderDue, getLastBackupAt,
  isBackupReminderEnabled, setBackupReminderEnabled,
  BACKUP_REMINDER_AFTER_MS, BACKUP_REMINDER_SNOOZE_MS
} = await import('../src/backup-reminder-state.js');
const {
  isInstallNoticeAllowed, snoozeInstallNotice, dismissInstallNotice, INSTALL_NOTICE_SNOOZE_MS
} = await import('../src/install-notice-prefs.js');
const { maybeShowStorageNotice } = await import('../src/storage-notices.js');
const { mountDialogRoot, isDialogOpen } = await import('../src/ui/app-dialog.js');
const { initI18n } = await import('../src/i18n.js');
const { saveUserBullet, generateUserId } = await import('../src/user-library.js');
const { resetLocationLibraryForTests } = await import('../src/location-library.js');
const { resetRiflePrecisionLibraryForTests } = await import('../src/rifle-precision-library.js');

await initI18n();

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0';
const T0 = Date.parse('2026-11-01T12:00:00Z');

function setDevice({ ua = IPHONE, standalone, displayStandalone = false } = {}) {
  Object.defineProperty(global, 'navigator', {
    value: { userAgent: ua, maxTouchPoints: 5, standalone },
    configurable: true
  });
  global.window.matchMedia = (query) => ({
    matches: query === '(display-mode: standalone)' && displayStandalone,
    addEventListener() {}, removeEventListener() {}
  });
}

function addBullet() {
  saveUserBullet({
    id: generateUserId('user-bullet'), name: 'B', manufacturer: 'M', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }
  });
}

function findByClass(node, cls, out = []) {
  if ((node.className || '').split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

let root;
test.beforeEach(async () => {
  localStorage.clear();
  await resetLocationLibraryForTests();
  await resetRiflePrecisionLibraryForTests();
  root = makeElement('div');
  mountDialogRoot(root);
  setDevice();
});

test('isHomeScreenApp: Apple\'s standalone flag or the display-mode query', () => {
  setDevice({ standalone: true });
  assert.equal(isHomeScreenApp(), true);
  setDevice({ standalone: false });
  assert.equal(isHomeScreenApp(), false);
  setDevice({ standalone: undefined, displayStandalone: true });
  assert.equal(isHomeScreenApp(), true);
  setDevice({ ua: DESKTOP });
  assert.equal(isIOS(), false);
});

test('backup reminder: nothing changed, nothing due', () => {
  assert.equal(isBackupReminderDue(T0 + 100 * BACKUP_REMINDER_AFTER_MS), false);
});

test('backup reminder: a change never backed up is due a week after the change', () => {
  recordDataChanged(T0);
  assert.equal(isBackupReminderDue(T0 + BACKUP_REMINDER_AFTER_MS - 1), false);
  assert.equal(isBackupReminderDue(T0 + BACKUP_REMINDER_AFTER_MS), true);
});

test('backup reminder: later changes do not restart the clock', () => {
  recordDataChanged(T0);
  recordDataChanged(T0 + BACKUP_REMINDER_AFTER_MS - 10);
  assert.equal(isBackupReminderDue(T0 + BACKUP_REMINDER_AFTER_MS), true);
});

test('backup reminder: a backup clears it; a change after an old backup is due at once', () => {
  recordDataChanged(T0);
  recordBackupSaved(T0 + 1);
  assert.equal(getLastBackupAt(), T0 + 1);
  assert.equal(isBackupReminderDue(T0 + 30 * BACKUP_REMINDER_AFTER_MS), false);
  const later = T0 + 2 * BACKUP_REMINDER_AFTER_MS;
  recordDataChanged(later);
  assert.equal(isBackupReminderDue(later), true);
});

test('backup reminder: a change after a recent backup waits for the backup to age', () => {
  recordBackupSaved(T0);
  recordDataChanged(T0 + 1);
  assert.equal(isBackupReminderDue(T0 + BACKUP_REMINDER_AFTER_MS - 1), false);
  assert.equal(isBackupReminderDue(T0 + BACKUP_REMINDER_AFTER_MS), true);
});

test('backup reminder: "Later" holds it back for the snooze period only', () => {
  recordDataChanged(T0);
  const due = T0 + BACKUP_REMINDER_AFTER_MS;
  snoozeBackupReminder(due);
  assert.equal(isBackupReminderDue(due + BACKUP_REMINDER_SNOOZE_MS - 1), false);
  assert.equal(isBackupReminderDue(due + BACKUP_REMINDER_SNOOZE_MS), true);
});

test('backup reminder: data from before this tracking starts its clock on first launch, not at once', () => {
  seedUnsavedData(true, T0);
  assert.equal(isBackupReminderDue(T0), false);
  assert.equal(isBackupReminderDue(T0 + BACKUP_REMINDER_AFTER_MS), true);
});

test('backup reminder: seeding does nothing without data, or once a backup exists', () => {
  seedUnsavedData(false, T0);
  assert.equal(isBackupReminderDue(T0 + 10 * BACKUP_REMINDER_AFTER_MS), false);
  recordBackupSaved(T0);
  seedUnsavedData(true, T0 + 1);
  assert.equal(isBackupReminderDue(T0 + 10 * BACKUP_REMINDER_AFTER_MS), false);
});

test('a library write marks the data as changed', () => {
  addBullet();
  assert.equal(isBackupReminderDue(Date.now() + BACKUP_REMINDER_AFTER_MS), true);
});

test('install notice: "Not now" snoozes it, "Don\'t show again" ends it', () => {
  assert.equal(isInstallNoticeAllowed(T0), true);
  snoozeInstallNotice(INSTALL_NOTICE_SNOOZE_MS, T0);
  assert.equal(isInstallNoticeAllowed(T0 + INSTALL_NOTICE_SNOOZE_MS - 1), false);
  assert.equal(isInstallNoticeAllowed(T0 + INSTALL_NOTICE_SNOOZE_MS), true);
  dismissInstallNotice();
  assert.equal(isInstallNoticeAllowed(T0 + 100 * INSTALL_NOTICE_SNOOZE_MS), false);
});

test('off iOS, no notice ever shows', () => {
  setDevice({ ua: DESKTOP });
  addBullet();
  recordDataChanged(0);
  assert.equal(maybeShowStorageNotice(), null);
  assert.equal(isDialogOpen(), false);
});

test('in an iOS browser tab, the install notice shows; with data it offers a backup first', () => {
  setDevice({ standalone: false });
  assert.equal(maybeShowStorageNotice(), 'install');
  assert.equal(findByClass(root, 'app-dialog-actions')[0].childNodes.length, 2); // Not now, Don't show again

  addBullet();
  mountDialogRoot(root);
  assert.equal(maybeShowStorageNotice(), 'install');
  const buttons = findByClass(root, 'app-dialog-actions')[0].childNodes;
  assert.equal(buttons.length, 3);
  assert.equal(buttons[0].textContent, 'Save backup');
});

test('"Not now" on the install notice lets the backup reminder through on a later launch', () => {
  setDevice({ standalone: false });
  addBullet();
  localStorage.setItem('ballistics_unsaved_since_v1', new Date(Date.now() - BACKUP_REMINDER_AFTER_MS).toISOString());
  assert.equal(maybeShowStorageNotice(), 'install');
  const notNow = findByClass(root, 'app-dialog-actions')[0].childNodes[1];
  fireEvent(notNow, 'click');
  assert.equal(isDialogOpen(), false);
  assert.equal(maybeShowStorageNotice(), 'backup');
});

test('installed on the Home Screen: only the backup reminder, and only when due', () => {
  setDevice({ standalone: true });
  addBullet();
  assert.equal(maybeShowStorageNotice(), null);
  localStorage.setItem('ballistics_unsaved_since_v1', new Date(Date.now() - BACKUP_REMINDER_AFTER_MS).toISOString());
  assert.equal(maybeShowStorageNotice(), 'backup');
  const later = findByClass(root, 'app-dialog-actions')[0].childNodes[1];
  assert.equal(later.textContent, 'Later');
  fireEvent(later, 'click');
  assert.equal(maybeShowStorageNotice(), null);
});

test('backup reminders are on by default; switched off, nothing is ever due', () => {
  assert.equal(isBackupReminderEnabled(), true);
  recordDataChanged(T0);
  setBackupReminderEnabled(false);
  assert.equal(isBackupReminderDue(T0 + 100 * BACKUP_REMINDER_AFTER_MS), false);
  setBackupReminderEnabled(true);
  assert.equal(isBackupReminderDue(T0 + BACKUP_REMINDER_AFTER_MS), true);
});

test('"Never show again" on the reminder turns the setting off', () => {
  setDevice({ standalone: true });
  addBullet();
  localStorage.setItem('ballistics_unsaved_since_v1', new Date(Date.now() - BACKUP_REMINDER_AFTER_MS).toISOString());
  assert.equal(maybeShowStorageNotice(), 'backup');
  const never = findByClass(root, 'app-dialog-actions')[0].childNodes[2];
  assert.equal(never.textContent, 'Never show again');
  fireEvent(never, 'click');
  assert.equal(isBackupReminderEnabled(), false);
  assert.equal(maybeShowStorageNotice(), null);
});
