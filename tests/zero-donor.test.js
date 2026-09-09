import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();
await warmCatalogs();

const { resolveZeroDonorBallistics } = await import('../src/zero-donor.js');
const { saveUserBullet } = await import('../src/user-library.js');

test.beforeEach(() => {
  localStorage.clear();
});

const RIFLE = {
  id: 'r1',
  cartridges: [
    { id: 'donor', name: 'Practice', muzzleVelocity: 800, bulletId: 'swiss-gp11' },
    { id: 'recipient', name: 'Duty', muzzleVelocity: 820, bulletId: 'swiss-gp11', zeroedWithCartridgeId: 'donor' }
  ]
};

test('null when the cartridge has no donor set', async () => {
  const noDonor = RIFLE.cartridges[0];
  assert.equal(await resolveZeroDonorBallistics(RIFLE, noDonor), null);
});

test('null when zeroedWithCartridgeId doesn\'t resolve to any sibling on the rifle (stale data)', async () => {
  const stale = { id: 'x', zeroedWithCartridgeId: 'does-not-exist' };
  assert.equal(await resolveZeroDonorBallistics(RIFLE, stale), null);
});

test('resolves a built-in donor bullet\'s BC profile alongside the donor\'s own muzzle velocity/temp fields', async () => {
  const recipient = RIFLE.cartridges[1];
  const resolved = await resolveZeroDonorBallistics(RIFLE, recipient);
  assert.deepEqual(resolved, {
    muzzleVelocity: 800, referenceTempC: undefined, velocityTempSensitivity: undefined,
    bc: 0.274, dragModel: 'G7', massKg: 0.0113, caliberM: 0.00778
  });
});

test('resolves a user-library donor bullet\'s cdTable profile, and prefers the user library over the built-in catalog', async () => {
  saveUserBullet({
    id: 'user-donor-bullet', name: 'Custom', manufacturer: 'Me', caliberM: 0.008, massKg: 0.012,
    profile: { type: 'cdTable', table: [[0.5, 0.2], [1.5, 0.4]] }
  });
  const rifle = {
    id: 'r2',
    cartridges: [
      { id: 'donor', name: 'Donor', muzzleVelocity: 850, referenceTempC: 15, velocityTempSensitivity: 1.1, bulletId: 'user-donor-bullet' },
      { id: 'recipient', name: 'Recipient', muzzleVelocity: 870, bulletId: 'swiss-gp11', zeroedWithCartridgeId: 'donor' }
    ]
  };
  const resolved = await resolveZeroDonorBallistics(rifle, rifle.cartridges[1]);
  assert.deepEqual(resolved, {
    muzzleVelocity: 850, referenceTempC: 15, velocityTempSensitivity: 1.1,
    cdTable: [[0.5, 0.2], [1.5, 0.4]], massKg: 0.012, caliberM: 0.008
  });
});

test('null when the donor\'s own bulletId doesn\'t resolve to any known bullet', async () => {
  const rifle = {
    id: 'r3',
    cartridges: [
      { id: 'donor', name: 'Donor', muzzleVelocity: 800, bulletId: 'no-such-bullet' },
      { id: 'recipient', name: 'Recipient', muzzleVelocity: 820, bulletId: 'swiss-gp11', zeroedWithCartridgeId: 'donor' }
    ]
  };
  assert.equal(await resolveZeroDonorBallistics(rifle, rifle.cartridges[1]), null);
});
