import test from 'node:test';
import assert from 'node:assert/strict';

const {
  setPendingBulletPrefill, takePendingBulletPrefill,
  setPendingRiflePrefill, takePendingRiflePrefill,
  setPendingCartridgeActivation, takePendingCartridgeActivation
} = await import('../src/arsenal-prefill.js');

test('bullet prefill is null until set', () => {
  assert.equal(takePendingBulletPrefill(), null);
});

test('taking a set bullet prefill returns it once, then clears it', () => {
  setPendingBulletPrefill({ bc: 0.45, dragModel: 'G1' });
  assert.deepEqual(takePendingBulletPrefill(), { bc: 0.45, dragModel: 'G1' });
  assert.equal(takePendingBulletPrefill(), null);
});

test('bullet and rifle prefills are independent', () => {
  setPendingBulletPrefill({ bc: 0.45, dragModel: 'G1' });
  setPendingRiflePrefill({ name: 'My Rifle' });
  assert.deepEqual(takePendingRiflePrefill(), { name: 'My Rifle' });
  assert.deepEqual(takePendingBulletPrefill(), { bc: 0.45, dragModel: 'G1' });
});

test('cartridge activation is null until set', () => {
  assert.equal(takePendingCartridgeActivation(), null);
});

test('taking a set cartridge activation returns it once, then clears it', () => {
  setPendingCartridgeActivation({ rifleId: 'r1', cartridgeId: 'c1', precisionR50Mrad: 0.18 });
  assert.deepEqual(takePendingCartridgeActivation(), { rifleId: 'r1', cartridgeId: 'c1', precisionR50Mrad: 0.18 });
  assert.equal(takePendingCartridgeActivation(), null);
});

test('cartridge activation is independent of the bullet/rifle prefills', () => {
  setPendingBulletPrefill({ bc: 0.45, dragModel: 'G1' });
  setPendingCartridgeActivation({ rifleId: 'r1', cartridgeId: 'c1', precisionR50Mrad: 0.18 });
  assert.deepEqual(takePendingCartridgeActivation(), { rifleId: 'r1', cartridgeId: 'c1', precisionR50Mrad: 0.18 });
  assert.deepEqual(takePendingBulletPrefill(), { bc: 0.45, dragModel: 'G1' });
});
