import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const {
  loadUserLocations, saveUserLocation, deleteUserLocation, findUserLocationByName,
  importUserLocation, markUserLocationsSaved,
  resetLocationLibraryForTests, reloadLocationLibraryForTests, flushLocationLibraryWritesForTests
} = await import('../src/location-library.js');
const { generateUserId } = await import('../src/user-library.js');

test.beforeEach(async () => { await resetLocationLibraryForTests(); });

function makeLocation(overrides = {}) {
  return { id: generateUserId('location'), name: 'My Range', altitudeM: null, photo: null, targets: [], ...overrides };
}

test('loadUserLocations starts empty', () => {
  assert.deepEqual(loadUserLocations(), []);
});

test('saveUserLocation adds a new entry, findable afterward', () => {
  const location = makeLocation();
  saveUserLocation(location);
  const stored = loadUserLocations();
  assert.equal(stored.length, 1);
  const { modifiedAt, unsaved, ...rest } = stored[0];
  assert.deepEqual(rest, location);
  assert.ok(typeof modifiedAt === 'string');
  assert.equal(unsaved, true);
});

test('saveUserLocation with an existing id overwrites in place (upsert), including its targets', () => {
  const id = generateUserId('location');
  saveUserLocation(makeLocation({ id, name: 'First' }));
  saveUserLocation(makeLocation({ id, name: 'Renamed', targets: [{ id: 't1', name: null, notes: null, rangeM: 400, losAngleDeg: 0, coords: null }] }));

  const locations = loadUserLocations();
  assert.equal(locations.length, 1);
  assert.equal(locations[0].name, 'Renamed');
  assert.equal(locations[0].targets.length, 1);
});

test('deleteUserLocation removes only the matching id', () => {
  const a = makeLocation({ name: 'A' });
  const b = makeLocation({ name: 'B' });
  saveUserLocation(a);
  saveUserLocation(b);
  deleteUserLocation(a.id);

  const remaining = loadUserLocations();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, b.id);
});

test('findUserLocationByName matches case/whitespace-insensitively and can exclude an id', () => {
  const location = makeLocation({ name: 'Home Range' });
  saveUserLocation(location);
  assert.ok(findUserLocationByName('  home RANGE  '));
  assert.equal(findUserLocationByName('Home Range', { excludeId: location.id }), undefined);
});

test('markUserLocationsSaved clears unsaved without touching modifiedAt, only for the given ids', () => {
  const a = saveUserLocation(makeLocation({ name: 'A' }));
  const b = saveUserLocation(makeLocation({ name: 'B' }));

  markUserLocationsSaved([a.id]);

  const stored = loadUserLocations();
  const storedA = stored.find((e) => e.id === a.id);
  const storedB = stored.find((e) => e.id === b.id);
  assert.equal(storedA.unsaved, false);
  assert.equal(storedA.modifiedAt, a.modifiedAt, 'marking saved must not restamp modifiedAt');
  assert.equal(storedB.unsaved, true);
});

test('a photo and a target\'s pin coords round-trip through save/load untouched', () => {
  const location = makeLocation({
    photo: 'data:image/jpeg;base64,AAA',
    targets: [{ id: 't1', name: null, notes: null, rangeM: 400, losAngleDeg: 0, coords: { x: 0.25, y: 0.75 } }]
  });
  saveUserLocation(location);
  const stored = loadUserLocations()[0];
  assert.equal(stored.photo, location.photo);
  assert.deepEqual(stored.targets[0].coords, { x: 0.25, y: 0.75 });
});

test('importUserLocation preserves the given modifiedAt (unlike saveUserLocation) but still marks unsaved: true', () => {
  const importedAt = '2020-01-01T00:00:00.000Z';
  const location = makeLocation({ modifiedAt: importedAt });
  const result = importUserLocation(location);
  assert.equal(result.modifiedAt, importedAt);
  assert.equal(result.unsaved, true);
  assert.equal(loadUserLocations()[0].modifiedAt, importedAt);
});

test('a saved location and its photo survive a reload from the store (not just from memory)', async () => {
  const location = makeLocation({
    photo: 'data:image/jpeg;base64,AAAA',
    targets: [{ id: 't1', name: null, notes: null, rangeM: 400, losAngleDeg: 0, coords: { x: 0.25, y: 0.75 } }]
  });
  saveUserLocation(location);
  await flushLocationLibraryWritesForTests();
  await reloadLocationLibraryForTests();

  const reloaded = loadUserLocations()[0];
  assert.equal(reloaded.photo, location.photo, 'photo must round-trip through Blob storage unchanged');
  assert.deepEqual(reloaded.targets[0].coords, { x: 0.25, y: 0.75 });
});

test('a deleted location does not resurrect after a reload from the store', async () => {
  const location = makeLocation();
  saveUserLocation(location);
  await flushLocationLibraryWritesForTests();
  deleteUserLocation(location.id);
  await flushLocationLibraryWritesForTests();
  await reloadLocationLibraryForTests();

  assert.deepEqual(loadUserLocations(), []);
});
