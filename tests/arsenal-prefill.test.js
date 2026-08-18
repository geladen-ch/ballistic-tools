import test from 'node:test';
import assert from 'node:assert/strict';

const {
  setPendingBulletPrefill, takePendingBulletPrefill,
  setPendingRiflePrefill, takePendingRiflePrefill
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
