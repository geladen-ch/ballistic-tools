import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { isIphoneSyncSupportEnabled, setIphoneSyncSupportEnabled } = await import('../src/sync/photo-storage-prefs.js');

test.beforeEach(() => localStorage.clear());

test('defaults to disabled (referenced photo storage is the default)', () => {
  assert.equal(isIphoneSyncSupportEnabled(), false);
});

test('setIphoneSyncSupportEnabled persists and is read back', () => {
  setIphoneSyncSupportEnabled(true);
  assert.equal(isIphoneSyncSupportEnabled(), true);
  setIphoneSyncSupportEnabled(false);
  assert.equal(isIphoneSyncSupportEnabled(), false);
});
