import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { loadBulletCatalog, loadBullet, loadCaliberDesignations, designationFor, matchCaliberDesignation } = await import('../src/bullets.js');

test('loadBulletCatalog resolves a plain list of bullet ids — no duplicated name/manufacturer/etc.', () => {
  const catalog = loadBulletCatalog();
  assert.ok(Array.isArray(catalog));
  assert.deepEqual([...catalog].sort(), [
    'hornady-30-eldm-208',
    'hornady-338-eldm-285',
    'hornady-50-amax-750',
    'hornady-65-eldm-147',
    'lapua-224-scenarl-69',
    'lapua-22lr',
    'lapua-30-scenar-167',
    'lapua-30-scenarl-155',
    'lapua-338-scenar-250',
    'lapua-338-scenar-300',
    'lapua-65-scenar-139',
    'lapua-65-scenarl-136',
    'nato-m193',
    'nato-m80',
    'nato-m855',
    'ruag-338-swissp-ball-252',
    'ruag-338-swissp-target-250',
    'russian-545x39-7n10',
    'russian-545x39-7n6',
    'russian-762x39-m43',
    'russian-762x54r-7n1',
    'swiss-gp11',
    'swiss-gp90'
  ]);
  for (const entry of catalog) assert.equal(typeof entry, 'string');
});

test('loadBulletCatalog returns the same array instance across repeated calls (it\'s an imported module binding, not a fetch)', () => {
  const first = loadBulletCatalog();
  const second = loadBulletCatalog();
  assert.equal(first, second);
});

test('loadBulletCatalog is synchronous — no network round-trip for the catalog itself', () => {
  const result = loadBulletCatalog();
  assert.ok(Array.isArray(result), 'should be the array itself, not a Promise of one');
});

test('loadBullet resolves a BC-profile bullet with SI-unit fields and no redundant caliber label', async () => {
  const bullet = await loadBullet('swiss-gp11');
  assert.equal(bullet.name, '174gr GP11');
  assert.equal(bullet.manufacturer, 'Military');
  assert.equal('caliber' in bullet, false, 'colloquial caliber label should come from the designations lookup, not be stored here');
  assert.equal(typeof bullet.caliberM, 'number');
  assert.equal(typeof bullet.lengthM, 'number');
  assert.equal(typeof bullet.massKg, 'number');
  assert.ok(bullet.massKg < 1, 'massKg should be a small SI value, not a raw grain count');
  assert.equal(typeof bullet.source, 'string');
  assert.equal(bullet.profile.type, 'bc');
  assert.equal(typeof bullet.profile.bc, 'number');
  assert.ok(bullet.profile.model === 'G1' || bullet.profile.model === 'G7');
});

test('loadBullet resolves a cdTable-profile bullet with a well-formed Mach/Cd table', async () => {
  const bullet = await loadBullet('hornady-30-eldm-208');
  assert.equal(bullet.profile.type, 'cdTable');
  assert.ok(Array.isArray(bullet.profile.table));
  assert.ok(bullet.profile.table.length > 10);
  for (const [mach, cd] of bullet.profile.table) {
    assert.equal(typeof mach, 'number');
    assert.equal(typeof cd, 'number');
    assert.ok(cd > 0 && cd < 2, `implausible Cd value ${cd} at Mach ${mach}`);
  }
  for (let i = 1; i < bullet.profile.table.length; i++) {
    assert.ok(bullet.profile.table[i][0] > bullet.profile.table[i - 1][0]);
  }
});

test('loadBullet rejects for an unknown id', async () => {
  await assert.rejects(() => loadBullet('does-not-exist'));
});

test('loadCaliberDesignations resolves the diameter -> colloquial name lookup table', async () => {
  const designations = await loadCaliberDesignations();
  assert.ok(Array.isArray(designations));
  assert.ok(designations.some((d) => d.designation === '7.62 / .308 / .30'));
  assert.ok(designations.some((d) => d.designation === '6.5 / .264'));
});

test('designationFor matches an exact (or near-exact) diameter', async () => {
  const designations = await loadCaliberDesignations();
  assert.equal(designationFor(0.0078232, designations), '7.62 / .308 / .30');
  // .264in bullets are marketed as "6.5 / .264" even though 0.0067056m is
  // actually 6.7056mm — this is exactly the mismatch the lookup exists for.
  assert.equal(designationFor(0.0067056, designations), '6.5 / .264');
});

test('designationFor falls back to a raw-mm label for an uncatalogued diameter', async () => {
  const designations = await loadCaliberDesignations();
  // 6.40mm sits in the gap between "6 / .243" (0.00617) and "6.5 / .264"
  // (0.00671) — well outside DESIGNATION_TOLERANCE_M (3e-5) of either, so
  // it's genuinely uncatalogued, unlike 0.009 (the old test value), which
  // the table now has an entry within tolerance of ("9 Luger", 0.00901).
  assert.equal(designationFor(0.0064, designations), '6.40mm');
});

// matchCaliberDesignation is designationFor()'s own building block, used
// directly by ui/arsenal/caliber-field.js — unlike designationFor() it
// must distinguish "matched a real designation" from "nothing close
// enough" (a raw-mm label isn't a valid <select> value there), so it
// returns the entry object itself, or null, rather than always a string.
test('matchCaliberDesignation returns the matched entry object within tolerance, or null when nothing is close enough', async () => {
  const designations = await loadCaliberDesignations();
  const match = matchCaliberDesignation(0.0078232, designations);
  assert.equal(match.designation, '7.62 / .308 / .30');
  assert.equal(match.caliberM, 0.00782);

  assert.equal(matchCaliberDesignation(0.0064, designations), null);
});

// Regression coverage for the data/bullets.info import: every catalog
// entry must resolve to a well-formed record, and the manufacturer
// inferred from the source filename/name (Hornady, Lapua, RUAG) or
// "Military" for everything else must actually match what's stored.
test('every catalog bullet resolves to a well-formed record', async () => {
  const catalog = loadBulletCatalog();
  assert.ok(catalog.length >= 23, `expected at least 23 bullets, got ${catalog.length}`);

  for (const id of catalog) {
    const bullet = await loadBullet(id);
    assert.equal(bullet.id, id, `id mismatch for ${id}`);
    assert.equal(typeof bullet.name, 'string');
    assert.ok(bullet.name.length > 0, `${id} has an empty name`);
    assert.equal(typeof bullet.manufacturer, 'string');
    assert.equal(typeof bullet.caliberM, 'number');
    assert.ok(bullet.caliberM > 0 && bullet.caliberM < 0.02, `implausible caliberM for ${id}: ${bullet.caliberM}`);
    assert.equal(typeof bullet.lengthM, 'number');
    assert.equal(typeof bullet.massKg, 'number');
    assert.ok(bullet.massKg > 0 && bullet.massKg < 1, `implausible massKg for ${id}: ${bullet.massKg}`);
    assert.equal(typeof bullet.source, 'string');

    if (bullet.profile.type === 'bc') {
      assert.equal(typeof bullet.profile.bc, 'number');
      assert.ok(bullet.profile.model === 'G1' || bullet.profile.model === 'G7', `unexpected drag model for ${id}`);
    } else {
      assert.equal(bullet.profile.type, 'cdTable');
      assert.ok(Array.isArray(bullet.profile.table) && bullet.profile.table.length > 5, `${id}'s cdTable is too short`);
      for (const [mach, cd] of bullet.profile.table) {
        assert.equal(typeof mach, 'number');
        assert.ok(cd > 0 && cd < 2, `implausible Cd ${cd} at Mach ${mach} for ${id}`);
      }
      for (let i = 1; i < bullet.profile.table.length; i++) {
        assert.ok(bullet.profile.table[i][0] > bullet.profile.table[i - 1][0], `${id}'s cdTable Mach values aren't strictly ascending`);
      }
    }
  }
});

test('manufacturer is inferred from the bullet id/name (Hornady, Lapua, RUAG), "Military" otherwise', async () => {
  const catalog = loadBulletCatalog();
  assert.ok(catalog.length >= 23, `expected at least 23 bullets, got ${catalog.length}`);

  for (const id of catalog) {
    const bullet = await loadBullet(id);
    let expected = 'Military';
    if (id.startsWith('hornady-')) expected = 'Hornady';
    else if (id.startsWith('lapua-')) expected = 'Lapua';
    else if (id.startsWith('ruag-')) expected = 'RUAG';
    assert.equal(bullet.manufacturer, expected, `${id} should be manufacturer "${expected}"`);
  }
});
