import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  isUpdateNotificationsEnabled, setUpdateNotificationsEnabled,
  getLastSeenVersion, setLastSeenVersion
} = await import('../src/update-notification-prefs.js');
const { removeCookie } = await import('../src/cookies.js');

const ENABLED_COOKIE = 'ballistics_update_notifications_enabled_v1';
const LAST_SEEN_COOKIE = 'ballistics_last_seen_version_v1';

test.beforeEach(() => {
  removeCookie(ENABLED_COOKIE);
  removeCookie(LAST_SEEN_COOKIE);
});

test('update notifications default to enabled', () => {
  assert.equal(isUpdateNotificationsEnabled(), true);
});

test('setUpdateNotificationsEnabled(false) persists and is read back', () => {
  setUpdateNotificationsEnabled(false);
  assert.equal(isUpdateNotificationsEnabled(), false);
  setUpdateNotificationsEnabled(true);
  assert.equal(isUpdateNotificationsEnabled(), true);
});

test('last seen version defaults to null (never recorded)', () => {
  assert.equal(getLastSeenVersion(), null);
});

test('setLastSeenVersion persists and is read back', () => {
  setLastSeenVersion('v104');
  assert.equal(getLastSeenVersion(), 'v104');
  setLastSeenVersion('v109');
  assert.equal(getLastSeenVersion(), 'v109');
});
