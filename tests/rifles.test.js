import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { loadRifleCatalog, loadRifle } = await import('../src/rifles.js');

test('loadRifleCatalog resolves a plain list of rifle ids — no duplicated name/cartridges/etc.', () => {
  const catalog = loadRifleCatalog();
  assert.ok(Array.isArray(catalog));
  assert.deepEqual([...catalog].sort(), [
    'ak74',
    'akm',
    'fass57',
    'fass90',
    'k31',
    'm16a2',
    'm4a1',
    'svd'
  ]);
  for (const entry of catalog) assert.equal(typeof entry, 'string');
});

test('loadRifleCatalog returns the same array instance across repeated calls (it\'s an imported module binding, not a fetch)', () => {
  const first = loadRifleCatalog();
  const second = loadRifleCatalog();
  assert.equal(first, second);
});

test('loadRifle resolves a rifle with SI-unit defaults and a list of cartridges', async () => {
  const rifle = await loadRifle('ak74');
  assert.equal(rifle.name, 'AK74');
  assert.equal(typeof rifle.defaultSightHeightM, 'number');
  assert.ok(rifle.defaultSightHeightM < 1, 'defaultSightHeightM should be a small SI value (meters), not mm');
  assert.equal(typeof rifle.defaultZeroRangeM, 'number');
  assert.ok(rifle.defaultClickUnit === 'mrad' || rifle.defaultClickUnit === 'arcmin');
  assert.equal(typeof rifle.defaultClickHorizontal, 'number');
  assert.equal(typeof rifle.defaultClickVertical, 'number');
  assert.ok(Array.isArray(rifle.cartridges));
  assert.ok(rifle.cartridges.length > 0);
  for (const c of rifle.cartridges) {
    assert.equal(typeof c.id, 'string');
    assert.equal(typeof c.name, 'string');
    assert.equal(typeof c.muzzleVelocity, 'number');
    assert.equal(typeof c.bulletId, 'string');
  }
});

test('loadRifle resolves a cartridge with an optional temperature dependency', async () => {
  const rifle = await loadRifle('ak74');
  const withTemp = rifle.cartridges.find((c) => c.referenceTempC != null);
  assert.ok(withTemp, 'expected at least one cartridge with temperature dependency');
  assert.equal(typeof withTemp.referenceTempC, 'number');
  assert.equal(typeof withTemp.velocityTempSensitivity, 'number');
});

test('loadRifle rejects for an unknown id', async () => {
  await assert.rejects(() => loadRifle('does-not-exist'));
});

test('loadRifle caches per id — repeated calls resolve the same data without re-fetching', async () => {
  const first = await loadRifle('svd');
  const second = await loadRifle('svd');
  assert.equal(first, second);
});

// Regression coverage for the data/rifles.info import: every catalog
// entry must resolve to a well-formed record, and every cartridge's
// bulletId must resolve against the bullet library those rifle files
// reference (imported earlier from data/bullets.info).
test('every catalog rifle resolves to a well-formed record with cartridges that reference real bullets', async () => {
  const { loadBullet } = await import('../src/bullets.js');
  const catalog = loadRifleCatalog();
  assert.ok(catalog.length >= 8, `expected at least 8 rifles, got ${catalog.length}`);

  for (const id of catalog) {
    const rifle = await loadRifle(id);
    assert.equal(rifle.id, id, `id mismatch for ${id}`);
    assert.equal(typeof rifle.name, 'string');
    assert.ok(rifle.name.length > 0, `${id} has an empty name`);
    assert.ok(rifle.defaultSightHeightM > 0 && rifle.defaultSightHeightM < 0.5, `implausible defaultSightHeightM for ${id}: ${rifle.defaultSightHeightM}`);
    assert.ok(rifle.defaultZeroRangeM > 0, `implausible defaultZeroRangeM for ${id}: ${rifle.defaultZeroRangeM}`);
    assert.ok(rifle.defaultClickUnit === 'mrad' || rifle.defaultClickUnit === 'arcmin', `unexpected defaultClickUnit for ${id}`);
    assert.equal(typeof rifle.defaultClickHorizontal, 'number');
    assert.equal(typeof rifle.defaultClickVertical, 'number');
    assert.equal(typeof rifle.source, 'string');
    assert.ok(Array.isArray(rifle.cartridges) && rifle.cartridges.length > 0, `${id} has no cartridges`);

    for (const c of rifle.cartridges) {
      assert.equal(typeof c.id, 'string');
      assert.equal(typeof c.name, 'string');
      assert.ok(c.muzzleVelocity > 100 && c.muzzleVelocity < 1500, `implausible muzzleVelocity for ${id}/${c.id}: ${c.muzzleVelocity}`);
      if (c.referenceTempC != null) {
        assert.equal(typeof c.velocityTempSensitivity, 'number');
        assert.ok(c.referenceTempC > -50 && c.referenceTempC < 60, `implausible referenceTempC for ${id}/${c.id}`);
      }
      await assert.doesNotReject(() => loadBullet(c.bulletId), `${id}/${c.id} references unknown bullet "${c.bulletId}"`);
    }
  }
});

test('the data/rifles.info imports carry each source file\'s exact muzzle velocity / temperature data', async () => {
  const ak74 = await loadRifle('ak74');
  const sevenN6 = ak74.cartridges.find((c) => c.bulletId === 'russian-545x39-7n6');
  assert.deepEqual(
    { muzzleVelocity: sevenN6.muzzleVelocity, referenceTempC: sevenN6.referenceTempC, velocityTempSensitivity: sevenN6.velocityTempSensitivity },
    { muzzleVelocity: 900, referenceTempC: 15, velocityTempSensitivity: 0.8 }
  );

  const svd = await loadRifle('svd');
  assert.equal(svd.cartridges.length, 1);
  assert.equal(svd.cartridges[0].bulletId, 'russian-762x54r-7n1');
  assert.equal(svd.cartridges[0].muzzleVelocity, 830);

  const m4a1 = await loadRifle('m4a1');
  const m193 = m4a1.cartridges.find((c) => c.bulletId === 'nato-m193');
  assert.equal(m193.muzzleVelocity, 971);
  assert.ok(Math.abs(m193.referenceTempC - 21.11) < 1e-9);
});
