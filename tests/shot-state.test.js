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
const { getCookie, setCookie } = await import('../src/cookies.js');

const GUN_COOKIE = 'ballistics_gun_state_v2';
const V1_GUN_COOKIE = 'ballistics_gun_state_v1';

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
  saveAtmosphereState({ tempC: 20, pressurePa: 100000 });
  saveAtmosphereState({ tempC: 25 }); // e.g. a wind-less view saving only its own fields
  assert.deepEqual(loadAtmosphereState(), { tempC: 25, pressurePa: 100000 });
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
  const raw = getCookie(GUN_COOKIE);
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
  assert.equal(getCookie(GUN_COOKIE), null);

  const fresh = await import(`../src/shot-state.js?reload=${freshId()}`);
  assert.equal(fresh.loadRifleState(), null);
});

test('a malformed cookie value falls back to defaults rather than throwing', async () => {
  setCookie(GUN_COOKIE, 'not valid json');
  const fresh = await import(`../src/shot-state.js?reload=${freshId()}`);
  assert.equal(fresh.loadRifleState(), null);
  assert.equal(fresh.loadCartridgeState(), null);
  resetShotStateForTests();
});

test('the gun cookie holds the rifle in SI, clicks in radians with the turret unit beside them', () => {
  const clicks = { unit: 'arcmin', horizontalRad: Math.PI / 43200, verticalRad: Math.PI / 43200 };
  saveRifleState({ sightHeightM: 0.07, riflingTwistM: 0.27, zeroRange: 100, clicks });
  assert.deepEqual(JSON.parse(getCookie(GUN_COOKIE)).rifle, { sightHeightM: 0.07, riflingTwistM: 0.27, zeroRange: 100, clicks });
  assert.equal(getCookie(V1_GUN_COOKIE), null);
});

test('a v1 gun cookie (mm, clicks in the turret unit) is converted once into v2, and left in place', async () => {
  const v1 = { cartridge: { muzzleVelocity: 800 }, rifle: { sightHeight: 70, riflingTwist: 270, zeroRange: 100, clicks: { unit: 'arcmin', horizontal: 0.25, vertical: 0.25 } } };
  setCookie(V1_GUN_COOKIE, JSON.stringify(v1));
  const fresh = await import(`../src/shot-state.js?reload=${freshId()}`);
  const rifle = fresh.loadRifleState();
  assert.equal(rifle.sightHeightM, 0.07);
  assert.equal(rifle.riflingTwistM, 0.27);
  assert.equal(rifle.clicks.unit, 'arcmin');
  assert.ok(Math.abs(rifle.clicks.verticalRad - Math.PI / 43200) < 1e-15);
  assert.ok(!('sightHeight' in rifle) && !('horizontal' in rifle.clicks));
  assert.deepEqual(fresh.loadCartridgeState(), { muzzleVelocity: 800 });
  assert.deepEqual(JSON.parse(getCookie(GUN_COOKIE)), { cartridge: { muzzleVelocity: 800 }, rifle });
  assert.deepEqual(JSON.parse(getCookie(V1_GUN_COOKIE)), v1);
  resetShotStateForTests();
});
