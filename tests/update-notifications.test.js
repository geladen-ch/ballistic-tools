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
  getLastSeenVersion, setLastSeenVersion,
  getServiceWorkerRebuiltVersion
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

// checkBootVersionChange()'s Pass 1 (see its own comment) calls
// rebuildOfflineCache(), which ends in location.reload() — this fake DOM
// has no such method by default (see fake-dom.js), so without a stub
// every Pass-1 attempt would throw and silently fall through to Pass 2's
// path instead, defeating the point of testing the two passes separately.
let reloadCount = 0;
location.reload = () => { reloadCount++; };

// Pass 2 needs a call to already be recorded as "rebuilt for this
// version" — the real sequence is two separate boots (a reload in
// between), simulated here by calling checkBootVersionChange() twice in
// a row rather than pre-seeding the cookie directly, so these tests
// exercise the exact same path a real second boot takes.
async function triggerVersionChangeThroughBothPasses(oldVersion) {
  setLastSeenVersion(oldVersion);
  await checkBootVersionChange(); // Pass 1: silent rebuild + "reload"
  return checkBootVersionChange(); // Pass 2: dialog + bookkeeping
}

test.beforeEach(() => {
  removeCookie('ballistics_update_notifications_enabled_v1');
  removeCookie('ballistics_last_seen_version_v1');
  removeCookie('ballistics_sw_rebuilt_version_v1');
  location.hash = '';
  reloadCount = 0;
  // fake-dom's navigator has no onLine property at all (so it reads
  // undefined/falsy by default) — explicitly online here so every test
  // below exercises the normal path; the one offline-specific test sets
  // this false itself.
  navigator.onLine = true;
  // dialogRoot's overlay is a persistent singleton across this whole file
  // (mounted once, matching app.js's own real usage) — a prior test that
  // opened it without clicking a button through would otherwise leak into
  // the next one.
  findByClass(dialogRoot, 'app-dialog-overlay')[0].style.display = 'none';
});

test('first-ever visit (no stored version): no dialog, no rebuild, but the current version gets recorded', async () => {
  assert.equal(getLastSeenVersion(), null);
  await checkBootVersionChange();
  assert.equal(overlayIsOpen(), false);
  assert.equal(reloadCount, 0);
  assert.equal(getLastSeenVersion(), CACHE_VERSION);
});

test('stored version equal to current: no dialog, no rebuild', async () => {
  setLastSeenVersion(CACHE_VERSION);
  await checkBootVersionChange();
  assert.equal(overlayIsOpen(), false);
  assert.equal(reloadCount, 0);
});

test('Pass 1 — version change rebuilds the service worker silently: no dialog yet, lastSeen untouched', async () => {
  setLastSeenVersion(OLDER_VERSION);
  const reloading = await checkBootVersionChange();
  assert.equal(reloading, true);
  assert.equal(reloadCount, 1);
  assert.equal(overlayIsOpen(), false); // not shown yet — would be torn down by the reload a moment later
  assert.equal(getLastSeenVersion(), OLDER_VERSION); // left for Pass 2 to update
  assert.equal(getServiceWorkerRebuiltVersion(), CACHE_VERSION);
});

test('offline: defers the entire comparison, not just the rebuild — no rebuild, no dialog, lastSeen and the rebuilt marker both untouched', async () => {
  navigator.onLine = false;
  setLastSeenVersion(OLDER_VERSION);
  const reloading = await checkBootVersionChange();
  assert.equal(reloading, false);
  assert.equal(reloadCount, 0);
  assert.equal(overlayIsOpen(), false);
  // Neither tracker updates — burning either one here would mean this
  // version change is never properly handled once back online, since a
  // later online boot would see lastSeen already caught up (dialog would
  // never show) or the rebuilt marker already set (rebuild would never
  // run) even though neither actually happened.
  assert.equal(getLastSeenVersion(), OLDER_VERSION);
  assert.equal(getServiceWorkerRebuiltVersion(), null);
});

test('back online after an offline boot: the deferred version change now goes through Pass 1 normally', async () => {
  navigator.onLine = false;
  setLastSeenVersion(OLDER_VERSION);
  await checkBootVersionChange(); // deferred, no-op
  navigator.onLine = true;
  const reloading = await checkBootVersionChange();
  assert.equal(reloading, true);
  assert.equal(reloadCount, 1);
  assert.equal(getServiceWorkerRebuiltVersion(), CACHE_VERSION);
});

test('Pass 1 failure (e.g. rebuildOfflineCache() itself throws) falls through to Pass 2 instead of losing the boot', async () => {
  const originalReload = location.reload;
  location.reload = () => { throw new Error('simulated: location.reload unavailable'); };
  setLastSeenVersion(OLDER_VERSION);
  const reloading = await checkBootVersionChange();
  location.reload = originalReload;

  assert.equal(reloading, false); // nothing is actually reloading — safe for app.js to proceed and register normally
  assert.equal(overlayIsOpen(), true); // still tells the user something changed
  assert.equal(getLastSeenVersion(), CACHE_VERSION);
  // The rebuilt marker is still set even though the rebuild itself
  // failed — see checkBootVersionChange()'s own comment: it deliberately
  // doesn't retry a version it's already attempted, relying on the
  // separate reactive update()-failure recovery for that version instead
  // of looping here.
  assert.equal(getServiceWorkerRebuiltVersion(), CACHE_VERSION);
});

test('Pass 2 — after the rebuild, the next boot shows the dialog and updates bookkeeping instead of rebuilding again', async () => {
  await triggerVersionChangeThroughBothPasses(OLDER_VERSION);
  assert.equal(reloadCount, 1); // only Pass 1 reloaded — Pass 2 must not rebuild again
  assert.equal(overlayIsOpen(), true);
  const message = findByClass(dialogRoot, 'app-dialog-message')[0].textContent;
  assert.ok(message.includes(OLDER_VERSION), message);
  assert.ok(message.includes(CACHE_VERSION), message);
  assert.equal(getLastSeenVersion(), CACHE_VERSION);
});

test('notifications disabled: Pass 2 shows no dialog, but bookkeeping still updates', async () => {
  setUpdateNotificationsEnabled(false);
  await triggerVersionChangeThroughBothPasses(OLDER_VERSION);
  assert.equal(overlayIsOpen(), false);
  assert.equal(getLastSeenVersion(), CACHE_VERSION);
});

test('"OK" closes the dialog and goes Home', async () => {
  await triggerVersionChangeThroughBothPasses(OLDER_VERSION);
  const buttons = findByClass(dialogRoot, 'app-dialog-actions')[0].childNodes;
  fireEvent(buttons[0], 'click'); // OK is first
  assert.equal(overlayIsOpen(), false);
  assert.equal(location.hash, '#/');
});

test('"What\'s new?" goes to Release History', async () => {
  await triggerVersionChangeThroughBothPasses(OLDER_VERSION);
  const buttons = findByClass(dialogRoot, 'app-dialog-actions')[0].childNodes;
  fireEvent(buttons[1], 'click'); // What's new? is second
  assert.equal(location.hash, '#/release-history');
});

test('"Never show again" disables the setting and goes Home', async () => {
  assert.equal(isUpdateNotificationsEnabled(), true);
  await triggerVersionChangeThroughBothPasses(OLDER_VERSION);
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
