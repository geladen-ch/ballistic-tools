import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  loadUserBullets, loadUserBulletsWithTombstones, saveUserBullet, deleteUserBullet, findUserBulletByName,
  importUserBullet, markUserBulletsSaved,
  loadUserRifles, loadUserRiflesWithTombstones, saveUserRifle, deleteUserRifle, findUserRifleByName, importUserRifle,
  markUserRiflesSaved, generateUserId
} = await import('../src/user-library.js');

test.beforeEach(() => localStorage.clear());

test('loadUserBullets starts empty', () => {
  assert.deepEqual(loadUserBullets(), []);
});

test('saveUserBullet adds a new entry, findable by id afterward', () => {
  const bullet = { id: generateUserId('user-bullet'), name: 'My 168gr', manufacturer: 'Custom', caliberM: 0.0078232, massKg: 0.01088622, profile: { type: 'bc', bc: 0.45, model: 'G1' } };
  saveUserBullet(bullet);
  const stored = loadUserBullets();
  assert.equal(stored.length, 1);
  const { modifiedAt, modifiedBy, revision, unsaved, ...rest } = stored[0];
  assert.deepEqual(rest, bullet);
  assert.ok(typeof modifiedAt === 'string');
  assert.equal(unsaved, true);
});

test('markUserBulletsSaved clears unsaved without touching modifiedAt', () => {
  const bullet = { id: generateUserId('user-bullet'), name: 'My 168gr', manufacturer: 'Custom', caliberM: 0.0078232, massKg: 0.01088622, profile: { type: 'bc', bc: 0.45, model: 'G1' } };
  const saved = saveUserBullet(bullet);
  assert.equal(saved.unsaved, true);

  markUserBulletsSaved([saved.id]);

  const stored = loadUserBullets()[0];
  assert.equal(stored.unsaved, false);
  assert.equal(stored.modifiedAt, saved.modifiedAt, 'marking saved must not restamp modifiedAt');
});

test('markUserBulletsSaved only affects the given ids', () => {
  const a = saveUserBullet({ id: generateUserId('user-bullet'), name: 'A', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const b = saveUserBullet({ id: generateUserId('user-bullet'), name: 'B', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  markUserBulletsSaved([a.id]);

  const stored = loadUserBullets();
  assert.equal(stored.find((e) => e.id === a.id).unsaved, false);
  assert.equal(stored.find((e) => e.id === b.id).unsaved, true);
});

test('importUserBullet preserves the given modifiedAt (unlike saveUserBullet) but still marks unsaved: true', () => {
  const importedAt = '2020-01-01T00:00:00.000Z';
  const bullet = {
    id: generateUserId('user-bullet'), name: 'Imported', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }, modifiedAt: importedAt
  };
  const result = importUserBullet(bullet);
  assert.equal(result.modifiedAt, importedAt);
  assert.equal(result.unsaved, true);
  assert.equal(loadUserBullets()[0].modifiedAt, importedAt);
});

test('saveUserBullet stamps a modifiedAt timestamp on every save', () => {
  const bullet = { id: generateUserId('user-bullet'), name: 'My 168gr', manufacturer: 'Custom', caliberM: 0.0078232, massKg: 0.01088622, profile: { type: 'bc', bc: 0.45, model: 'G1' } };
  const saved = saveUserBullet(bullet);
  assert.ok(typeof saved.modifiedAt === 'string' && !Number.isNaN(Date.parse(saved.modifiedAt)));
  assert.equal(loadUserBullets()[0].modifiedAt, saved.modifiedAt);
});

test('saveUserBullet with an existing id overwrites in place (upsert)', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'First', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserBullet({ id, name: 'Renamed', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.5, model: 'G7' } });

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].name, 'Renamed');
  assert.equal(bullets[0].profile.bc, 0.5);
});

test('deleteUserBullet removes only the matching id', () => {
  const a = generateUserId('user-bullet');
  const b = generateUserId('user-bullet');
  saveUserBullet({ id: a, name: 'A', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserBullet({ id: b, name: 'B', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  deleteUserBullet(a);

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].id, b);
});

test('deleteUserBullet writes a tombstone rather than a hard delete', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'My Bullet', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  deleteUserBullet(id);

  assert.deepEqual(loadUserBullets(), []); // live reads never see it

  const withTombstones = loadUserBulletsWithTombstones();
  assert.equal(withTombstones.length, 1);
  const tomb = withTombstones[0];
  assert.equal(tomb.id, id);
  assert.equal(tomb.name, 'My Bullet');
  assert.ok(typeof tomb.deletedAt === 'string');
  assert.ok(typeof tomb.deletedBy === 'string');
  assert.equal(tomb.unsaved, true);
  // Dropped entirely, not carried as null/undefined — a bullet has no
  // child array of its own to preserve.
  assert.equal('manufacturer' in tomb, false);
  assert.equal('profile' in tomb, false);
});

test('deleteUserBullet on an already-deleted or never-existing id is a no-op', () => {
  deleteUserBullet('does-not-exist');
  assert.deepEqual(loadUserBulletsWithTombstones(), []);
});

test('saveUserBullet increments revision from whatever was previously stored, starting at 1 for a new record', () => {
  const id = generateUserId('user-bullet');
  const first = saveUserBullet({ id, name: 'V1', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  assert.equal(first.revision, 1);
  const second = saveUserBullet({ id, name: 'V2', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  assert.equal(second.revision, 2);
});

test('importUserBullet preserves the incoming revision verbatim, deliberately not bumping it', () => {
  // See revision.js's own comment: bumping on merge-apply too causes an
  // unbounded climb once two devices exchange the same unchanged record
  // back and forth (this app's actual sync topology). Merge-applied
  // writes adopt verbatim, exactly like modifiedAt/modifiedBy already do.
  const bullet = {
    id: generateUserId('user-bullet'), name: 'Imported', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }, modifiedAt: '2020-01-01T00:00:00.000Z', revision: 7
  };
  const result = importUserBullet(bullet);
  assert.equal(result.revision, 7);
  assert.equal(loadUserBullets()[0].revision, 7);
});

test('importUserBullet on a record with no revision at all leaves it absent (reads as 0 downstream)', () => {
  const bullet = {
    id: generateUserId('user-bullet'), name: 'Legacy', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01,
    profile: { type: 'bc', bc: 0.4, model: 'G1' }, modifiedAt: '2020-01-01T00:00:00.000Z'
  };
  const result = importUserBullet(bullet);
  assert.equal(result.revision, undefined);
});

test('deleteUserBullet bumps revision, treating the deletion as its own local write', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Gone', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  deleteUserBullet(id);
  const tomb = loadUserBulletsWithTombstones().find((b) => b.id === id);
  assert.equal(tomb.revision, 2);
});

test('deleteUserRifle writes a tombstone with an empty cartridges array (shape-preserving)', () => {
  const id = generateUserId('user-rifle');
  saveUserRifle({
    id, name: 'My Rifle', defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [{ id: 'c1', name: 'Load 1', muzzleVelocity: 800, bulletId: 'b1' }]
  });
  deleteUserRifle(id);

  assert.deepEqual(loadUserRifles(), []);
  const tomb = loadUserRiflesWithTombstones()[0];
  assert.equal(tomb.id, id);
  assert.deepEqual(tomb.cartridges, []);
  assert.ok(typeof tomb.deletedAt === 'string');
});

test('deleting and recreating a bullet under the same name does not falsely collide', () => {
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'My Bullet', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const toDelete = findUserBulletByName('My Bullet');
  deleteUserBullet(toDelete.id);

  // findByName must not report a collision against the tombstone.
  assert.equal(findUserBulletByName('My Bullet'), undefined);
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'My Bullet', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  assert.equal(loadUserBullets().length, 1);
});

test('findUserBulletByName matches case/whitespace-insensitively', () => {
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'My Custom Bullet', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  assert.ok(findUserBulletByName('  my custom bullet  '));
  assert.equal(findUserBulletByName('no such bullet'), undefined);
});

test('findUserBulletByName can exclude a given id (for "editing this same entry" checks)', () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'My Bullet', manufacturer: 'Custom', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  assert.equal(findUserBulletByName('My Bullet', { excludeId: id }), undefined);
  assert.ok(findUserBulletByName('My Bullet'));
});

test('generateUserId produces distinct ids with the given prefix', () => {
  const a = generateUserId('user-bullet');
  const b = generateUserId('user-bullet');
  assert.notEqual(a, b);
  assert.ok(a.startsWith('user-bullet-'));
});

test('rifle CRUD mirrors the bullet CRUD (independent storage)', () => {
  const rifle = {
    id: generateUserId('user-rifle'), name: 'My Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  };
  saveUserRifle(rifle);
  const stored = loadUserRifles();
  assert.equal(stored.length, 1);
  const { modifiedAt, modifiedBy, revision, unsaved, ...rest } = stored[0];
  assert.deepEqual(rest, rifle);
  assert.ok(typeof modifiedAt === 'string');
  assert.equal(unsaved, true);
  assert.deepEqual(loadUserBullets(), []); // separate namespace

  deleteUserRifle(rifle.id);
  assert.deepEqual(loadUserRifles(), []);
});

test('markUserRiflesSaved clears unsaved without touching modifiedAt, and importUserRifle preserves a given modifiedAt', () => {
  const rifle = {
    id: generateUserId('user-rifle'), name: 'My Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  };
  const saved = saveUserRifle(rifle);
  markUserRiflesSaved([saved.id]);
  const stored = loadUserRifles()[0];
  assert.equal(stored.unsaved, false);
  assert.equal(stored.modifiedAt, saved.modifiedAt);

  const importedAt = '2020-01-01T00:00:00.000Z';
  const imported = importUserRifle({ ...rifle, id: generateUserId('user-rifle'), modifiedAt: importedAt });
  assert.equal(imported.modifiedAt, importedAt);
  assert.equal(imported.unsaved, true);
});

test('findUserRifleByName matches case/whitespace-insensitively', () => {
  saveUserRifle({
    id: generateUserId('user-rifle'), name: 'Grandpa\'s Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  assert.ok(findUserRifleByName("  GRANDPA'S RIFLE "));
});

test('a corrupted localStorage value behaves as an empty arsenal instead of throwing', () => {
  localStorage.setItem('ballistics_user_bullets_v1', 'not json');
  assert.deepEqual(loadUserBullets(), []);
});
