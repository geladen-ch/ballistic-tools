import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { isBackupSyncEnabled, setBackupSyncEnabled } = await import('../src/backup-sync-prefs.js');

test.beforeEach(() => localStorage.clear());

test('defaults to disabled', () => {
  assert.equal(isBackupSyncEnabled(), false);
});

test('setBackupSyncEnabled persists and is read back', () => {
  setBackupSyncEnabled(true);
  assert.equal(isBackupSyncEnabled(), true);
  setBackupSyncEnabled(false);
  assert.equal(isBackupSyncEnabled(), false);
});
