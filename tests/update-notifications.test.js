import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();

const { mountDialogRoot } = await import('../src/ui/app-dialog.js');
const { checkBootVersionChange, watchForLiveUpdate } = await import('../src/update-notifications.js');
const { CACHE_VERSION } = await import('../src/version.js');
const {
  isUpdateNotificationsEnabled, setUpdateNotificationsEnabled,
  getLastSeenVersion, setLastSeenVersion
} = await import('../src/update-notification-prefs.js');
const { removeCookie } = await import('../src/cookies.js');

const OLDER_VERSION = 'v1'; // guaranteed different from whatever the real CACHE_VERSION currently is

function findByClass(node, cls, out = []) {
  if ((node.className || '').split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

const dialogRoot = makeElement('div');
mountDialogRoot(dialogRoot);

function overlayIsOpen() {
  return findByClass(dialogRoot, 'app-dialog-overlay')[0].style.display !== 'none';
}

test.beforeEach(() => {
  removeCookie('ballistics_update_notifications_enabled_v1');
  removeCookie('ballistics_last_seen_version_v1');
  location.hash = '';
  // dialogRoot's overlay is a persistent singleton across this whole file
  // (mounted once, matching app.js's own real usage) — a prior test that
  // opened it without clicking a button through would otherwise leak into
  // the next one.
  findByClass(dialogRoot, 'app-dialog-overlay')[0].style.display = 'none';
});

test('first-ever visit (no stored version): no dialog, but the current version gets recorded', () => {
  assert.equal(getLastSeenVersion(), null);
  checkBootVersionChange();
  assert.equal(overlayIsOpen(), false);
  assert.equal(getLastSeenVersion(), CACHE_VERSION);
});

test('stored version equal to current: no dialog', () => {
  setLastSeenVersion(CACHE_VERSION);
  checkBootVersionChange();
  assert.equal(overlayIsOpen(), false);
});

test('stored version differs from current: shows the dialog with both versions in the message', () => {
  setLastSeenVersion(OLDER_VERSION);
  checkBootVersionChange();
  assert.equal(overlayIsOpen(), true);
  const message = findByClass(dialogRoot, 'app-dialog-message')[0].textContent;
  assert.ok(message.includes(OLDER_VERSION), message);
  assert.ok(message.includes(CACHE_VERSION), message);
  assert.equal(getLastSeenVersion(), CACHE_VERSION); // bookkeeping updated regardless
});

test('notifications disabled: no dialog, but bookkeeping still updates', () => {
  setLastSeenVersion(OLDER_VERSION);
  setUpdateNotificationsEnabled(false);
  checkBootVersionChange();
  assert.equal(overlayIsOpen(), false);
  assert.equal(getLastSeenVersion(), CACHE_VERSION);
});

test('"OK" closes the dialog and goes Home', () => {
  setLastSeenVersion(OLDER_VERSION);
  checkBootVersionChange();
  const buttons = findByClass(dialogRoot, 'app-dialog-actions')[0].childNodes;
  fireEvent(buttons[0], 'click'); // OK is first
  assert.equal(overlayIsOpen(), false);
  assert.equal(location.hash, '#/');
});

test('"What\'s new?" goes to Release History', () => {
  setLastSeenVersion(OLDER_VERSION);
  checkBootVersionChange();
  const buttons = findByClass(dialogRoot, 'app-dialog-actions')[0].childNodes;
  fireEvent(buttons[1], 'click'); // What's new? is second
  assert.equal(location.hash, '#/release-history');
});

test('"Never show again" disables the setting and goes Home', () => {
  setLastSeenVersion(OLDER_VERSION);
  assert.equal(isUpdateNotificationsEnabled(), true);
  checkBootVersionChange();
  const buttons = findByClass(dialogRoot, 'app-dialog-actions')[0].childNodes;
  fireEvent(buttons[2], 'click'); // Never show again is third
  assert.equal(isUpdateNotificationsEnabled(), false);
  assert.equal(location.hash, '#/');
});

// --- watchForLiveUpdate: a hand-built fake registration/worker, since no
// real ServiceWorkerRegistration exists in this environment — just enough
// of the standard addEventListener/statechange shape to exercise the
// actual logic (not a real browser API integration test).
function makeFakeEventTarget() {
  const listeners = {};
  return {
    addEventListener(type, cb) { (listeners[type] ??= []).push(cb); },
    dispatch(type) { for (const cb of listeners[type] || []) cb(); }
  };
}

test('watchForLiveUpdate shows the dialog once an update installs over an existing controller', () => {
  navigator.serviceWorker = { controller: {} }; // a controller already exists — this is an update, not first install
  const installing = { state: 'installing', ...makeFakeEventTarget() };
  const registration = { installing, ...makeFakeEventTarget() };

  watchForLiveUpdate(registration);
  registration.dispatch('updatefound');
  installing.state = 'installed';
  installing.dispatch('statechange');

  assert.equal(overlayIsOpen(), true);
  const message = findByClass(dialogRoot, 'app-dialog-message')[0].textContent;
  assert.ok(message.length > 0);
  const buttons = findByClass(dialogRoot, 'app-dialog-actions')[0].childNodes;
  assert.equal(buttons.length, 3);
});

test('watchForLiveUpdate does not fire on the very first install (no existing controller)', () => {
  navigator.serviceWorker = { controller: null };
  const installing = { state: 'installing', ...makeFakeEventTarget() };
  const registration = { installing, ...makeFakeEventTarget() };

  watchForLiveUpdate(registration);
  registration.dispatch('updatefound');
  installing.state = 'installed';
  installing.dispatch('statechange');

  assert.equal(overlayIsOpen(), false);
});

test('watchForLiveUpdate\'s "Got it" just closes the dialog', () => {
  navigator.serviceWorker = { controller: {} };
  const installing = { state: 'installing', ...makeFakeEventTarget() };
  const registration = { installing, ...makeFakeEventTarget() };

  watchForLiveUpdate(registration);
  registration.dispatch('updatefound');
  installing.state = 'installed';
  installing.dispatch('statechange');

  const buttons = findByClass(dialogRoot, 'app-dialog-actions')[0].childNodes;
  assert.doesNotThrow(() => fireEvent(buttons[0], 'click')); // Got it is first
  assert.equal(overlayIsOpen(), false);
  assert.equal(isUpdateNotificationsEnabled(), true); // unaffected
});

test('watchForLiveUpdate\'s "Restart now" reloads the app', () => {
  navigator.serviceWorker = { controller: {} };
  const installing = { state: 'installing', ...makeFakeEventTarget() };
  const registration = { installing, ...makeFakeEventTarget() };

  watchForLiveUpdate(registration);
  registration.dispatch('updatefound');
  installing.state = 'installed';
  installing.dispatch('statechange');

  let reloaded = false;
  const originalReload = location.reload;
  location.reload = () => { reloaded = true; };
  const buttons = findByClass(dialogRoot, 'app-dialog-actions')[0].childNodes;
  fireEvent(buttons[1], 'click'); // Restart now is second
  location.reload = originalReload;

  assert.equal(reloaded, true);
});

test('watchForLiveUpdate\'s "Never show this again" disables the setting', () => {
  navigator.serviceWorker = { controller: {} };
  const installing = { state: 'installing', ...makeFakeEventTarget() };
  const registration = { installing, ...makeFakeEventTarget() };

  watchForLiveUpdate(registration);
  registration.dispatch('updatefound');
  installing.state = 'installed';
  installing.dispatch('statechange');

  const buttons = findByClass(dialogRoot, 'app-dialog-actions')[0].childNodes;
  fireEvent(buttons[2], 'click'); // Never show this again is third
  assert.equal(isUpdateNotificationsEnabled(), false);
});
