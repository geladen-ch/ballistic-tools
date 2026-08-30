import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { freshId } from './helpers/fresh-import.js';

installFakeDom();

const {
  loadCartridgeState, saveCartridgeState,
  loadRifleState, saveRifleState,
  loadAtmosphereState, saveAtmosphereState,
  resetShotStateForTests
} = await import('../src/shot-state.js');
const { getCookie } = await import('../src/cookies.js');

test.beforeEach(() => resetShotStateForTests());

test('each slice starts as null — "nothing saved yet"', () => {
  assert.equal(loadCartridgeState(), null);
  assert.equal(loadRifleState(), null);
  assert.equal(loadAtmosphereState(), null);
});

test('saving a slice makes it loadable', () => {
  saveCartridgeState({ muzzleVelocity: 800 });
  assert.deepEqual(loadCartridgeState(), { muzzleVelocity: 800 });
});

test('saves merge into the existing slice rather than replacing it', () => {
  saveAtmosphereState({ tempC: 20, pressureHpa: 1000 });
  saveAtmosphereState({ tempC: 25 }); // e.g. a wind-less view saving only its own fields
  assert.deepEqual(loadAtmosphereState(), { tempC: 25, pressureHpa: 1000 });
});

test('the three slices are independent of each other', () => {
  saveCartridgeState({ muzzleVelocity: 800 });
  saveRifleState({ zeroRange: 200 });
  assert.equal(loadAtmosphereState(), null);
  assert.deepEqual(loadCartridgeState(), { muzzleVelocity: 800 });
  assert.deepEqual(loadRifleState(), { zeroRange: 200 });
});

test('resetShotStateForTests() clears every slice back to null', () => {
  saveCartridgeState({ muzzleVelocity: 800 });
  saveRifleState({ zeroRange: 200 });
  saveAtmosphereState({ tempC: 20 });
  resetShotStateForTests();
  assert.equal(loadCartridgeState(), null);
  assert.equal(loadRifleState(), null);
  assert.equal(loadAtmosphereState(), null);
});

// ---- Cookie persistence (the actual "Guns" feature requirement — the
// active gun configuration must survive an app restart) ----

test('saving the rifle or cartridge slice writes a cookie', () => {
  saveRifleState({ zeroRange: 150 });
  saveCartridgeState({ muzzleVelocity: 820 });
  const raw = getCookie('ballistics_gun_state_v1');
  assert.ok(raw, 'expected a gun-state cookie to be written');
  assert.deepEqual(JSON.parse(raw), { cartridge: { muzzleVelocity: 820 }, rifle: { zeroRange: 150 } });
});

test('rifle/cartridge state survives a fresh module load (an app restart)', async () => {
  saveRifleState({ zeroRange: 175, library: { rifleId: 'my-rifle', cartridgeId: 'c1' } });
  saveCartridgeState({ muzzleVelocity: 810, bullet: { selectedId: 'my-bullet' } });

  const fresh = await import(`../src/shot-state.js?reload=${freshId()}`);
  assert.deepEqual(fresh.loadRifleState(), { zeroRange: 175, library: { rifleId: 'my-rifle', cartridgeId: 'c1' } });
  assert.deepEqual(fresh.loadCartridgeState(), { muzzleVelocity: 810, bullet: { selectedId: 'my-bullet' } });
});

test('atmosphere state does NOT survive a fresh module load — session-only, unlike rifle/cartridge', async () => {
  saveAtmosphereState({ tempC: 30 });
  const fresh = await import(`../src/shot-state.js?reload=${freshId()}`);
  assert.equal(fresh.loadAtmosphereState(), null);
});

test('resetShotStateForTests() also clears the cookie itself, not just the in-memory mirror', async () => {
  saveRifleState({ zeroRange: 150 });
  resetShotStateForTests();
  assert.equal(getCookie('ballistics_gun_state_v1'), null);

  const fresh = await import(`../src/shot-state.js?reload=${freshId()}`);
  assert.equal(fresh.loadRifleState(), null);
});

test('a malformed cookie value falls back to defaults rather than throwing', async () => {
  const { setCookie } = await import('../src/cookies.js');
  setCookie('ballistics_gun_state_v1', 'not valid json');
  const fresh = await import(`../src/shot-state.js?reload=${freshId()}`);
  assert.equal(fresh.loadRifleState(), null);
  assert.equal(fresh.loadCartridgeState(), null);
  resetShotStateForTests();
});
