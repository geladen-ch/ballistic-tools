import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeCloneName, cloneRifleRecord, cloneCartridgeRecord, isNameTaken } from '../src/arsenal-clone.js';

const en = (name, n) => `${name} (Clone ${n})`;

test('the proposed name is "<name> (Clone 1)" when that is free', () => {
  assert.equal(proposeCloneName('Tikka', ['Tikka'], en), 'Tikka (Clone 1)');
});

test('the proposed name counts on past clone names already taken, case-insensitively', () => {
  assert.equal(proposeCloneName('Tikka', ['Tikka', 'tikka (clone 1)', 'Tikka (Clone 2) '], en), 'Tikka (Clone 3)');
});

test('cloning a clone counts on from the original name instead of stacking suffixes', () => {
  assert.equal(proposeCloneName('Tikka (Clone 1)', ['Tikka', 'Tikka (Clone 1)'], en), 'Tikka (Clone 2)');
});

test('a localized pattern is recognized when cloning a clone', () => {
  const de = (name, n) => `${name} (Klon ${n})`;
  assert.equal(proposeCloneName('Sako (Klon 2)', ['Sako', 'Sako (Klon 1)', 'Sako (Klon 2)'], de), 'Sako (Klon 3)');
});

test('a name with regex characters in it is handled literally', () => {
  assert.equal(proposeCloneName('.308 [A+B]', ['.308 [A+B]'], en), '.308 [A+B] (Clone 1)');
});

test('isNameTaken ignores case and surrounding whitespace', () => {
  assert.equal(isNameTaken('  my RIFLE ', ['My rifle']), true);
  assert.equal(isNameTaken('My rifle 2', ['My rifle']), false);
});

test('a cloned rifle gets the new id and name, fresh cartridge ids, and none of the original\'s record history', () => {
  const rifle = {
    id: 'r1', name: 'Tikka', defaultSightHeightM: 0.05, scopeId: 's1', source: 'shop',
    modifiedAt: '2026-01-01T00:00:00Z', modifiedBy: 'dev', revision: 7, unsaved: false,
    cartridges: [
      { id: 'c1', name: 'Practice', bulletId: 'b1', muzzleVelocity: 800, zeroedWithCartridgeId: null },
      { id: 'c2', name: 'Match', bulletId: 'b2', muzzleVelocity: 820, zeroedWithCartridgeId: 'c1' },
      { id: 'c3', name: 'Hunt', bulletId: 'b2', muzzleVelocity: 790 }
    ]
  };
  let n = 0;
  const clone = cloneRifleRecord(rifle, { id: 'r2', name: 'Tikka (Clone 1)', newCartridgeId: () => `n${++n}` });

  assert.equal(clone.id, 'r2');
  assert.equal(clone.name, 'Tikka (Clone 1)');
  assert.equal(clone.scopeId, 's1');
  assert.equal(clone.source, 'shop');
  assert.equal(clone.defaultSightHeightM, 0.05);
  for (const key of ['modifiedAt', 'modifiedBy', 'revision', 'unsaved']) assert.ok(!(key in clone), key);

  assert.deepEqual(clone.cartridges.map((c) => c.id), ['n1', 'n2', 'n3']);
  assert.deepEqual(clone.cartridges.map((c) => c.bulletId), ['b1', 'b2', 'b2']);
  assert.equal(clone.cartridges[1].zeroedWithCartridgeId, 'n1', 'the zero donor is re-pointed at its own copy');
  assert.equal(clone.cartridges[0].zeroedWithCartridgeId, null);
  assert.ok(!('zeroedWithCartridgeId' in clone.cartridges[2]), 'no field is added that the original did not have');

  // The original is left untouched.
  assert.equal(rifle.cartridges[1].zeroedWithCartridgeId, 'c1');
  assert.equal(rifle.cartridges[0].id, 'c1');
});

test('a dangling zero donor on a cloned rifle becomes no donor rather than pointing outside the clone', () => {
  const rifle = { id: 'r1', name: 'X', cartridges: [{ id: 'c1', name: 'A', zeroedWithCartridgeId: 'gone' }] };
  const clone = cloneRifleRecord(rifle, { id: 'r2', name: 'Y', newCartridgeId: () => 'n1' });
  assert.equal(clone.cartridges[0].zeroedWithCartridgeId, null);
});

test('a cloned cartridge keeps every field, its zero donor included, under the new id and name', () => {
  const cartridge = { id: 'c2', name: 'Match', bulletId: 'b2', muzzleVelocity: 820, zeroedWithCartridgeId: 'c1', precision: { r50Rad: 1e-4 } };
  const clone = cloneCartridgeRecord(cartridge, { id: 'c9', name: 'Match (Clone 1)' });
  assert.deepEqual(clone, { ...cartridge, id: 'c9', name: 'Match (Clone 1)' });
});
