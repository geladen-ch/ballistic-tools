import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { onLibraryWrite } = await import('../src/sync/write-hooks.js');
const { saveUserBullet, deleteUserBullet, generateUserId } = await import('../src/user-library.js');
const { saveUserLocation, deleteUserLocation, resetLocationLibraryForTests } = await import('../src/location-library.js');
const {
  saveRiflePrecisionProject, deleteRiflePrecisionProject, resetRiflePrecisionLibraryForTests
} = await import('../src/rifle-precision-library.js');

test.beforeEach(async () => {
  localStorage.clear();
  await resetLocationLibraryForTests();
  await resetRiflePrecisionLibraryForTests();
});

test('every bullet write notifies with recordType bullet', () => {
  const events = [];
  onLibraryWrite((e) => events.push(e));
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'B', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  deleteUserBullet(id);

  assert.equal(events.length, 2);
  assert.equal(events[0].recordType, 'bullet');
  assert.equal(events[0].record.id, id);
  assert.equal(events[1].recordType, 'bullet');
  assert.ok(events[1].record.deletedAt);
});

test('location writes notify with recordType location', () => {
  const events = [];
  onLibraryWrite((e) => events.push(e));
  const location = { id: generateUserId('location'), name: 'L', altitudeM: null, photo: null, targets: [] };
  saveUserLocation(location);
  deleteUserLocation(location.id);

  assert.equal(events.filter((e) => e.recordType === 'location').length, 2);
});

test('rifle-precision-project writes notify with recordType rifle-precision-project', () => {
  const events = [];
  onLibraryWrite((e) => events.push(e));
  const project = { id: generateUserId('rp-project'), name: 'P', targets: [], createdAt: '2020-01-01T00:00:00.000Z' };
  saveRiflePrecisionProject(project);
  deleteRiflePrecisionProject(project.id);

  assert.equal(events.filter((e) => e.recordType === 'rifle-precision-project').length, 2);
});
