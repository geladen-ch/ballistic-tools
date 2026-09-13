import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const {
  loadUserLocations, loadUserLocationsWithTombstones, saveUserLocation, deleteUserLocation, findUserLocationByName,
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
  const { modifiedAt, modifiedBy, revision, unsaved, ...rest } = stored[0];
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

test('deleteUserLocation writes a tombstone with an empty targets array (shape-preserving)', async () => {
  const location = makeLocation({ name: 'My Range', targets: [{ id: 't1', name: 'Target 1' }] });
  saveUserLocation(location);
  deleteUserLocation(location.id);

  assert.deepEqual(loadUserLocations(), []); // live reads never see it

  const withTombstones = loadUserLocationsWithTombstones();
  assert.equal(withTombstones.length, 1);
  const tomb = withTombstones[0];
  assert.equal(tomb.id, location.id);
  assert.equal(tomb.name, 'My Range');
  assert.deepEqual(tomb.targets, []);
  assert.ok(typeof tomb.deletedAt === 'string');
  assert.ok(typeof tomb.deletedBy === 'string');
  assert.equal(tomb.unsaved, true);

  await flushLocationLibraryWritesForTests();
  await reloadLocationLibraryForTests();
  const reloaded = loadUserLocationsWithTombstones()[0];
  assert.deepEqual(reloaded.targets, []); // survives an IndexedDB round-trip too
});

test('deleteUserLocation on an already-deleted or never-existing id is a no-op', () => {
  deleteUserLocation('does-not-exist');
  assert.deepEqual(loadUserLocationsWithTombstones(), []);
});

test('saveUserLocation increments revision from whatever was previously stored, starting at 1 for a new record', () => {
  const location = makeLocation({ name: 'V1' });
  const first = saveUserLocation(location);
  assert.equal(first.revision, 1);
  const second = saveUserLocation({ ...location, name: 'V2' });
  assert.equal(second.revision, 2);
});

test('deleteUserLocation bumps revision, treating the deletion as its own local write', () => {
  const location = makeLocation();
  saveUserLocation(location);
  deleteUserLocation(location.id);
  const tomb = loadUserLocationsWithTombstones().find((e) => e.id === location.id);
  assert.equal(tomb.revision, 2);
});

test('deleting and recreating a location under the same name does not falsely collide', () => {
  const location = makeLocation({ name: 'My Range' });
  saveUserLocation(location);
  deleteUserLocation(location.id);

  assert.equal(findUserLocationByName('My Range'), undefined);
  saveUserLocation(makeLocation({ name: 'My Range' }));
  assert.equal(loadUserLocations().length, 1);
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

test('importUserLocation preserves the incoming revision verbatim, deliberately not bumping it', () => {
  const location = makeLocation({ modifiedAt: '2020-01-01T00:00:00.000Z', revision: 7 });
  const result = importUserLocation(location);
  assert.equal(result.revision, 7);
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

test('regression: a tombstone is shape-preserving across the IndexedDB round-trip, photo included', async () => {
  // toStorable()/fromStorable() normalize an absent photo to `photo: null`,
  // so a tombstone written without that key silently grows one on reload.
  // Two devices either side of that reload would then hold byte-identical
  // deletions differing by one key, which merge.js reads as "same
  // timestamp, diverged content" — pinning every deleted location to the
  // review list permanently. Same reasoning as `targets: []`.
  const location = makeLocation({ name: 'Range' });
  saveUserLocation(location);
  deleteUserLocation(location.id);

  const beforeReload = loadUserLocationsWithTombstones().find((e) => e.id === location.id);
  await flushLocationLibraryWritesForTests();
  await reloadLocationLibraryForTests();
  const afterReload = loadUserLocationsWithTombstones().find((e) => e.id === location.id);

  assert.deepEqual(Object.keys(beforeReload).sort(), Object.keys(afterReload).sort());
  assert.equal(beforeReload.photo, null);
  assert.deepEqual(beforeReload.targets, []);

  const { equivalent } = await import('../src/sync/merge.js');
  assert.equal(equivalent(beforeReload, afterReload), true);
});
