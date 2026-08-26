import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const {
  loadRiflePrecisionProjects, saveRiflePrecisionProject, deleteRiflePrecisionProject,
  findRiflePrecisionProjectById, findRiflePrecisionProjectByName,
  importRiflePrecisionProject, markRiflePrecisionProjectsSaved,
  resetRiflePrecisionLibraryForTests, reloadRiflePrecisionLibraryForTests,
  flushRiflePrecisionLibraryWritesForTests
} = await import('../src/rifle-precision-library.js');
const { generateUserId } = await import('../src/user-library.js');

test.beforeEach(async () => { await resetRiflePrecisionLibraryForTests(); });

function makeTarget(overrides = {}) {
  return {
    id: generateUserId('rp-target'),
    name: 'Target 1',
    notes: '',
    photo: null,
    photoWidth: null,
    photoHeight: null,
    photoFilename: null,
    calibration: { point1: null, point2: null, realLengthMm: null },
    groups: [],
    ...overrides
  };
}

function makeProject(overrides = {}) {
  return {
    id: generateUserId('rp-project'),
    name: 'My Project',
    distanceM: 100,
    caliberMm: 7.62,
    targets: [],
    createdAt: '2020-01-01T00:00:00.000Z',
    ...overrides
  };
}

test('loadRiflePrecisionProjects starts empty', () => {
  assert.deepEqual(loadRiflePrecisionProjects(), []);
});

test('saveRiflePrecisionProject adds a new entry, findable afterward, and marks it unsaved', () => {
  const project = makeProject();
  saveRiflePrecisionProject(project);
  const stored = loadRiflePrecisionProjects();
  assert.equal(stored.length, 1);
  const { modifiedAt, unsaved, ...rest } = stored[0];
  assert.deepEqual(rest, project);
  assert.ok(typeof modifiedAt === 'string');
  assert.equal(unsaved, true);
});

test('saveRiflePrecisionProject with an existing id overwrites in place (upsert), including nested targets/groups/shots', () => {
  const id = generateUserId('rp-project');
  saveRiflePrecisionProject(makeProject({ id, name: 'First' }));
  saveRiflePrecisionProject(makeProject({
    id,
    name: 'Renamed',
    targets: [makeTarget({ groups: [{ id: 'g1', poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.4, y: 0.6 }] }] })]
  }));

  const projects = loadRiflePrecisionProjects();
  assert.equal(projects.length, 1);
  assert.equal(projects[0].name, 'Renamed');
  assert.equal(projects[0].targets.length, 1);
  assert.deepEqual(projects[0].targets[0].groups[0].shots, [{ x: 0.4, y: 0.6 }]);
});

test('deleteRiflePrecisionProject removes only the matching id', () => {
  const a = makeProject({ name: 'A' });
  const b = makeProject({ name: 'B' });
  saveRiflePrecisionProject(a);
  saveRiflePrecisionProject(b);
  deleteRiflePrecisionProject(a.id);

  const remaining = loadRiflePrecisionProjects();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, b.id);
});

test('findRiflePrecisionProjectById finds an existing project and returns null for an unknown id', () => {
  const project = saveRiflePrecisionProject(makeProject());
  assert.equal(findRiflePrecisionProjectById(project.id).id, project.id);
  assert.equal(findRiflePrecisionProjectById('nope'), null);
});

test('a target photo and calibration/group/shot coords round-trip through save/load untouched', () => {
  const project = makeProject({
    targets: [makeTarget({
      photo: 'data:image/jpeg;base64,AAA',
      photoWidth: 2000,
      photoHeight: 1500,
      photoFilename: 'range-day-target-3.jpg',
      calibration: { point1: { x: 0.1, y: 0.2 }, point2: { x: 0.3, y: 0.2 }, realLengthMm: 50 },
      groups: [{ id: 'g1', poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.51, y: 0.49 }, { x: 0.48, y: 0.52 }] }]
    })]
  });
  saveRiflePrecisionProject(project);
  const stored = loadRiflePrecisionProjects()[0];
  assert.equal(stored.targets[0].photo, project.targets[0].photo);
  assert.equal(stored.targets[0].photoFilename, project.targets[0].photoFilename);
  assert.deepEqual(stored.targets[0].calibration, project.targets[0].calibration);
  assert.deepEqual(stored.targets[0].groups[0].shots, project.targets[0].groups[0].shots);
});

test('a saved project and its target photo survive a reload from the store (not just from memory)', async () => {
  const project = makeProject({
    targets: [makeTarget({ photo: 'data:image/jpeg;base64,AAAA', photoWidth: 800, photoHeight: 600, photoFilename: 'target-1.png' })]
  });
  saveRiflePrecisionProject(project);
  await flushRiflePrecisionLibraryWritesForTests();
  await reloadRiflePrecisionLibraryForTests();

  const reloaded = loadRiflePrecisionProjects()[0];
  assert.equal(reloaded.targets[0].photo, project.targets[0].photo, 'photo must round-trip through Blob storage unchanged');
  assert.equal(reloaded.targets[0].photoWidth, 800);
  assert.equal(reloaded.targets[0].photoFilename, 'target-1.png');
});

test('a deleted project does not resurrect after a reload from the store', async () => {
  const project = makeProject();
  saveRiflePrecisionProject(project);
  await flushRiflePrecisionLibraryWritesForTests();
  deleteRiflePrecisionProject(project.id);
  await flushRiflePrecisionLibraryWritesForTests();
  await reloadRiflePrecisionLibraryForTests();

  assert.deepEqual(loadRiflePrecisionProjects(), []);
});

test('findRiflePrecisionProjectByName matches case/whitespace-insensitively and can exclude an id', () => {
  const project = saveRiflePrecisionProject(makeProject({ name: 'Home Range' }));
  assert.ok(findRiflePrecisionProjectByName('  home RANGE  '));
  assert.equal(findRiflePrecisionProjectByName('Home Range', { excludeId: project.id }), undefined);
});

test('importRiflePrecisionProject preserves the given modifiedAt and createdAt (unlike saveRiflePrecisionProject) but still marks unsaved: true', () => {
  const importedAt = '2020-01-01T00:00:00.000Z';
  const createdAt = '2019-06-01T00:00:00.000Z';
  const project = makeProject({ modifiedAt: importedAt, createdAt });
  const result = importRiflePrecisionProject(project);
  assert.equal(result.modifiedAt, importedAt);
  assert.equal(result.createdAt, createdAt);
  assert.equal(result.unsaved, true);
  assert.equal(loadRiflePrecisionProjects()[0].modifiedAt, importedAt);
  assert.equal(loadRiflePrecisionProjects()[0].createdAt, createdAt);
});

test('markRiflePrecisionProjectsSaved clears unsaved without touching modifiedAt, only for the given ids', () => {
  const a = saveRiflePrecisionProject(makeProject({ name: 'A' }));
  const b = saveRiflePrecisionProject(makeProject({ name: 'B' }));

  markRiflePrecisionProjectsSaved([a.id]);

  const stored = loadRiflePrecisionProjects();
  const storedA = stored.find((p) => p.id === a.id);
  const storedB = stored.find((p) => p.id === b.id);
  assert.equal(storedA.unsaved, false);
  assert.equal(storedA.modifiedAt, a.modifiedAt, 'marking saved must not restamp modifiedAt');
  assert.equal(storedB.unsaved, true);
});

// The regression test for the multi-store IndexedDB versioning gotcha
// (see db-schema.js): both this module and location-library.js open the
// same shared database. If a future change ever went back to each module
// declaring its own store list independently, a real browser wouldn't
// re-run onupgradeneeded for an already-existing database and one store
// would silently never get created. This asserts both stores actually end
// up populated when both modules are used against the same database.
test('location-library.js and rifle-precision-library.js both persist to the shared database', async () => {
  const { saveUserLocation, resetLocationLibraryForTests, loadUserLocations } = await import('../src/location-library.js');
  await resetLocationLibraryForTests();

  saveUserLocation({ id: generateUserId('location'), name: 'Shared DB Range', altitudeM: null, photo: null, targets: [] });
  saveRiflePrecisionProject(makeProject({ name: 'Shared DB Project' }));
  await flushRiflePrecisionLibraryWritesForTests();

  assert.equal(loadUserLocations().length, 1);
  assert.equal(loadRiflePrecisionProjects().length, 1);
});
