import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  loadUserBullets, saveUserBullet, deleteUserBullet, findUserBulletByName, importUserBullet, markUserBulletsSaved,
  loadUserRifles, saveUserRifle, deleteUserRifle, findUserRifleByName, importUserRifle, markUserRiflesSaved,
  generateUserId
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
  const { modifiedAt, unsaved, ...rest } = stored[0];
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
  const { modifiedAt, unsaved, ...rest } = stored[0];
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
