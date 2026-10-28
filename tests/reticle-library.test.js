import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const lib = await import('../src/reticle-library.js');
const { onLibraryWrite } = await import('../src/sync/write-hooks.js');
const { createElement } = await import('../src/reticle/element-types.js');
const { createDocument, addElement } = await import('../src/reticle/model.js');
const { generateUserId } = await import('../src/user-library.js');

test.beforeEach(async () => { await lib.resetReticleLibraryForTests(); });

function makeReticle(overrides = {}) {
  let doc = createDocument();
  doc = addElement(doc, createElement('dot', { x: 0, y: 0.001, units: 'mrad' })).doc;
  const { name, ...rest } = doc;
  return { ...rest, id: generateUserId('user-reticle'), manufacturer: 'Acme', model: 'Dot', ...overrides };
}

const writes = [];
onLibraryWrite((event) => writes.push(event));

test('starts empty; a saved reticle is listed decoded, stamped and unsaved', () => {
  assert.deepEqual(lib.loadUserReticles(), []);
  const saved = lib.saveUserReticle(makeReticle());
  assert.equal(saved.name, 'Acme Dot');
  assert.equal(saved.revision, 1);
  assert.equal(saved.unsaved, true);
  assert.ok(saved.modifiedAt);
  const [listed] = lib.loadUserReticles();
  assert.equal(listed.elements.length, 1);
  assert.equal(listed.elements[0].id, 'e1');
  assert.equal(lib.getUserReticle(saved.id), listed);
  // Stored in the record form, elements without ids.
  const [stored] = lib.loadUserReticlesWithTombstones();
  assert.ok(!('id' in stored.elements[0]));
  assert.ok(!('groups' in stored));
});

test('a reticle is decoded once per stored record, and again after it changes', () => {
  const saved = lib.saveUserReticle(makeReticle());
  assert.equal(lib.loadUserReticles()[0], lib.loadUserReticles()[0]);
  lib.saveUserReticle({ ...saved, model: 'Dot 2' });
  assert.equal(lib.loadUserReticles()[0].name, 'Acme Dot 2');
  assert.equal(lib.loadUserReticles()[0].revision, 2);
});

test('writes persist to IndexedDB and survive a reload', async () => {
  const saved = lib.saveUserReticle(makeReticle());
  await lib.flushReticleLibraryWritesForTests();
  await lib.reloadReticleLibraryForTests();
  assert.equal(lib.getUserReticle(saved.id).name, 'Acme Dot');
});

test('delete writes a shape-keeping tombstone, notified as a reticle write', async () => {
  const saved = lib.saveUserReticle(makeReticle());
  writes.length = 0;
  lib.deleteUserReticle(saved.id);
  assert.deepEqual(lib.loadUserReticles(), []);
  const [tomb] = lib.loadUserReticlesWithTombstones();
  assert.equal(tomb.name, 'Acme Dot');
  assert.ok(tomb.deletedAt);
  assert.deepEqual(tomb.elements, []);
  assert.equal(tomb.revision, 2);
  assert.equal(writes[0].recordType, 'reticle');
  assert.equal(writes[0].previous.id, saved.id);
  lib.deleteUserReticle('nope');
  assert.equal(lib.loadUserReticlesWithTombstones().length, 1);
});

test('find by name: case-insensitive, live records only, one id excluded', () => {
  const saved = lib.saveUserReticle(makeReticle());
  assert.equal(lib.findUserReticleByName('  acme DOT ').id, saved.id);
  assert.equal(lib.findUserReticleByName('Acme Dot', { excludeId: saved.id }), null);
  lib.deleteUserReticle(saved.id);
  assert.equal(lib.findUserReticleByName('Acme Dot'), null);
});

test('import keeps the record as given, its revision and dates included', () => {
  const imported = { id: 'r-imported', name: 'X Y', manufacturer: 'X', model: 'Y', referenceScope: { type: 'fixed', zoomMin: 4 }, elements: [], revision: 7, modifiedAt: '2020-01-01T00:00:00.000Z' };
  lib.importUserReticle(imported);
  const [listed] = lib.loadUserReticles();
  assert.equal(listed.revision, 7);
  assert.equal(listed.modifiedAt, '2020-01-01T00:00:00.000Z');
  assert.equal(listed.unsaved, true);
});

test('a record that does not decode is listed as damaged, not lost', () => {
  lib.importUserReticle({ id: 'bad', name: 'Bad One', manufacturer: 'Bad', model: 'One', referenceScope: { type: 'ffp', zoomMin: 9, zoomMax: 1 }, elements: [] });
  const [listed] = lib.loadUserReticles();
  assert.equal(listed.damaged, true);
  assert.equal(listed.name, 'Bad One');
  assert.deepEqual(listed.elements, []);
});

test('markUserReticlesSaved clears unsaved without restamping; storedUserReticleOf gives the stored record while unedited', () => {
  const saved = lib.saveUserReticle(makeReticle());
  lib.markUserReticlesSaved([saved.id]);
  const [listed] = lib.loadUserReticles();
  assert.equal(listed.unsaved, false);
  assert.equal(listed.modifiedAt, saved.modifiedAt);
  assert.equal(lib.storedUserReticleOf(listed), lib.loadUserReticlesWithTombstones()[0]);
  const edited = { ...listed, model: 'Edited', revision: listed.revision + 1 };
  assert.equal(lib.storedUserReticleOf(edited).name, 'Acme Edited');
});
