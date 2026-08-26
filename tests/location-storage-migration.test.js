import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { loadUserLocations, saveUserLocation, resetLocationLibraryForTests } = await import('../src/location-library.js');
const { migrateLegacyLocationStorage } = await import('../src/location-storage-migration.js');
const { generateUserId } = await import('../src/user-library.js');

const LEGACY_KEY = 'ballistics_user_locations_v1';

test.beforeEach(async () => {
  await resetLocationLibraryForTests();
  localStorage.removeItem(LEGACY_KEY);
});

function makeLegacyLocation(overrides = {}) {
  return {
    id: generateUserId('location'), name: 'Legacy Range', altitudeM: null, photo: null, targets: [],
    modifiedAt: '2021-01-01T00:00:00.000Z', unsaved: false,
    ...overrides
  };
}

test('no legacy key present -> no-op', async () => {
  await migrateLegacyLocationStorage();
  assert.deepEqual(loadUserLocations(), []);
  assert.equal(localStorage.getItem(LEGACY_KEY), null);
});

test('imports every legacy location and removes the legacy key', async () => {
  const a = makeLegacyLocation({ name: 'A' });
  const b = makeLegacyLocation({ name: 'B' });
  localStorage.setItem(LEGACY_KEY, JSON.stringify([a, b]));

  await migrateLegacyLocationStorage();

  const stored = loadUserLocations();
  assert.equal(stored.length, 2);
  assert.ok(stored.find((e) => e.id === a.id && e.name === 'A'));
  assert.ok(stored.find((e) => e.id === b.id && e.name === 'B'));
  assert.equal(localStorage.getItem(LEGACY_KEY), null);
});

test('preserves the legacy modifiedAt (import semantics, not a fresh save)', async () => {
  const location = makeLegacyLocation({ modifiedAt: '2019-06-15T00:00:00.000Z' });
  localStorage.setItem(LEGACY_KEY, JSON.stringify([location]));

  await migrateLegacyLocationStorage();

  assert.equal(loadUserLocations()[0].modifiedAt, '2019-06-15T00:00:00.000Z');
});

test('malformed JSON under the legacy key is left untouched, nothing imported', async () => {
  localStorage.setItem(LEGACY_KEY, '{not valid json');

  await migrateLegacyLocationStorage();

  assert.deepEqual(loadUserLocations(), []);
  assert.equal(localStorage.getItem(LEGACY_KEY), '{not valid json');
});

test('an id collision with an existing IndexedDB location keeps both, re-idding the legacy one', async () => {
  const sharedId = generateUserId('location');
  saveUserLocation({ id: sharedId, name: 'Current', altitudeM: null, photo: null, targets: [] });
  const legacy = makeLegacyLocation({ id: sharedId, name: 'Legacy' });
  localStorage.setItem(LEGACY_KEY, JSON.stringify([legacy]));

  await migrateLegacyLocationStorage();

  const stored = loadUserLocations();
  assert.equal(stored.length, 2);
  const current = stored.find((e) => e.name === 'Current');
  const migrated = stored.find((e) => e.name === 'Legacy');
  assert.ok(current);
  assert.ok(migrated);
  assert.equal(current.id, sharedId);
  assert.notEqual(migrated.id, sharedId, 'the incoming legacy record must get a fresh id, not clobber the existing one');
});

test('a legacy photo (data-URL string) round-trips into the mirror', async () => {
  const location = makeLegacyLocation({ photo: 'data:image/jpeg;base64,AAAA' });
  localStorage.setItem(LEGACY_KEY, JSON.stringify([location]));

  await migrateLegacyLocationStorage();

  assert.equal(loadUserLocations()[0].photo, 'data:image/jpeg;base64,AAAA');
});

test('running again after a successful migration is a no-op (nothing left to migrate)', async () => {
  localStorage.setItem(LEGACY_KEY, JSON.stringify([makeLegacyLocation()]));
  await migrateLegacyLocationStorage();
  assert.equal(loadUserLocations().length, 1);

  await migrateLegacyLocationStorage();

  assert.equal(loadUserLocations().length, 1, 'a second run must not re-import or duplicate anything');
});
