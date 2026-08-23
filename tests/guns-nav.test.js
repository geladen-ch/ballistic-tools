import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  isInGunsMode, setGunsMode, onGunsModeChange,
  setGunsReturnPath, takeGunsReturnPath,
  resolveGunsDestination, goToGuns,
  registerArsenalDoneHandler, requestGunsDone,
  resetGunsNavForTests
} = await import('../src/guns-nav.js');
const { saveRifleState, resetShotStateForTests } = await import('../src/shot-state.js');
const { saveUserRifle } = await import('../src/user-library.js');

test.beforeEach(() => {
  resetGunsNavForTests();
  resetShotStateForTests();
  localStorage.clear();
  location.hash = '';
});

test('starts out of Guns mode', () => {
  assert.equal(isInGunsMode(), false);
});

test('setGunsMode toggles isInGunsMode', () => {
  setGunsMode(true);
  assert.equal(isInGunsMode(), true);
  setGunsMode(false);
  assert.equal(isInGunsMode(), false);
});

test('onGunsModeChange listeners fire with the new value, only on an actual change', () => {
  const calls = [];
  onGunsModeChange((on) => calls.push(on));

  setGunsMode(true);
  assert.deepEqual(calls, [true]);

  setGunsMode(true); // no-op — already true
  assert.deepEqual(calls, [true]);

  setGunsMode(false);
  assert.deepEqual(calls, [true, false]);
});

test('onGunsModeChange returns an unsubscribe function', () => {
  let calls = 0;
  const unsubscribe = onGunsModeChange(() => { calls++; });
  setGunsMode(true);
  assert.equal(calls, 1);
  unsubscribe();
  setGunsMode(false);
  assert.equal(calls, 1, 'should not fire after unsubscribing');
});

test('takeGunsReturnPath returns the fallback when nothing was set', () => {
  assert.equal(takeGunsReturnPath('/trajectory'), '/trajectory');
});

test('takeGunsReturnPath returns the captured path, and clears it (one-shot)', () => {
  setGunsReturnPath('/hit-probability');
  assert.equal(takeGunsReturnPath('/trajectory'), '/hit-probability');
  // Taken once — a second call without a fresh setGunsReturnPath() falls
  // back again, same "take rather than read" reasoning as
  // arsenal-prefill.js's own one-shot handoff.
  assert.equal(takeGunsReturnPath('/trajectory'), '/trajectory');
});

test('resetGunsNavForTests() clears both the mode and the return path', () => {
  setGunsMode(true);
  setGunsReturnPath('/hit-probability');
  resetGunsNavForTests();
  assert.equal(isInGunsMode(), false);
  assert.equal(takeGunsReturnPath('/trajectory'), '/trajectory');
});

// ---- resolveGunsDestination/goToGuns — shared by guns-summary.js's own
// "Change" button and every plain "go to Guns" nav entry (nav-rail.js,
// nav-tabbar.js, home-view.js), so all of them land on the same sub-tab. ----

test('resolveGunsDestination defaults to Custom when no rifle is active', () => {
  assert.equal(resolveGunsDestination(), '/guns/custom');
});

test('resolveGunsDestination is Custom for a built-in library rifle', () => {
  saveRifleState({ library: { rifleId: 'k31', cartridgeId: 'x' } });
  assert.equal(resolveGunsDestination(), '/guns/custom');
});

test('resolveGunsDestination is Arsenal for a saved user rifle', () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  saveRifleState({ library: { rifleId: 'my-rifle', cartridgeId: 'c1' } });
  assert.equal(resolveGunsDestination(), '/guns/arsenal');
});

test('goToGuns records the current path and jumps to the resolved destination', () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  saveRifleState({ library: { rifleId: 'my-rifle', cartridgeId: 'c1' } });
  location.hash = '#/hit-probability';

  goToGuns();

  assert.equal(location.hash, '#/guns/arsenal');
  assert.equal(takeGunsReturnPath('/fallback'), '/hit-probability');
});

test('goToGuns falls back to Custom and records the root path when nothing is active', () => {
  goToGuns();
  assert.equal(location.hash, '#/guns/custom');
  assert.equal(takeGunsReturnPath('/fallback'), '/');
});

// ---- registerArsenalDoneHandler/requestGunsDone — lets Arsenal stage an
// activation locally and commit it only when Done is actually pressed. ----

test('requestGunsDone navigates like a plain Done click when nothing is registered', () => {
  setGunsReturnPath('/hit-probability');
  requestGunsDone('/trajectory');
  assert.equal(location.hash, '#/hit-probability');
});

test('requestGunsDone calls the registered handler before navigating', () => {
  const calls = [];
  registerArsenalDoneHandler(() => calls.push('committed'));
  requestGunsDone('/trajectory');
  assert.deepEqual(calls, ['committed']);
  assert.equal(location.hash, '#/trajectory');
});

test('the unregister function returned by registerArsenalDoneHandler stops it from firing', () => {
  const calls = [];
  const unregister = registerArsenalDoneHandler(() => calls.push('committed'));
  unregister();
  requestGunsDone('/trajectory');
  assert.deepEqual(calls, []);
});

test('registering a new handler replaces the previous one', () => {
  const calls = [];
  registerArsenalDoneHandler(() => calls.push('first'));
  registerArsenalDoneHandler(() => calls.push('second'));
  requestGunsDone('/trajectory');
  assert.deepEqual(calls, ['second']);
});

test('resetGunsNavForTests() also clears the registered Arsenal Done handler', () => {
  const calls = [];
  registerArsenalDoneHandler(() => calls.push('committed'));
  resetGunsNavForTests();
  requestGunsDone('/trajectory');
  assert.deepEqual(calls, []);
});
