import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { saveUserBullet, saveUserRifle, deleteUserBullet, generateUserId } = await import('../src/user-library.js');
const {
  saveUserLocation, deleteUserLocation, loadUserLocations, resetLocationLibraryForTests
} = await import('../src/location-library.js');
const {
  saveRiflePrecisionProject, loadRiflePrecisionProjects, resetRiflePrecisionLibraryForTests
} = await import('../src/rifle-precision-library.js');
const { getDeviceId } = await import('../src/sync/device-id.js');
const { getDeviceName } = await import('../src/sync/device-name.js');
const { buildBackupBundle, serializeBackupBundle, parseBackupBundle, backupFileName } =
  await import('../src/sync/backup-bundle.js');

test.beforeEach(async () => {
  localStorage.clear();
  await resetLocationLibraryForTests();
  await resetRiflePrecisionLibraryForTests();
});

test('backupFileName derives the filename from the device id', () => {
  assert.equal(backupFileName('abc-123'), 'backup-abc-123.json');
});

test('buildBackupBundle carries device identity, format/version, and every library', () => {
  const bundle = buildBackupBundle();
  assert.equal(bundle.format, 'ebalka2-backup');
  assert.equal(bundle.version, 1);
  assert.equal(bundle.device.id, getDeviceId());
  assert.equal(bundle.device.name, getDeviceName());
  assert.ok(typeof bundle.device.modifiedAt === 'string');
  assert.ok(typeof bundle.exportedAt === 'string');
  assert.deepEqual(bundle.arsenal, { bullets: [], rifles: [] });
  assert.deepEqual(bundle.locations, { locations: [] });
  assert.deepEqual(bundle.riflePrecision, { projects: [] });
});

test('buildBackupBundle always produces inline photo storage — Phase 7\'s referenced split is applied afterward, by the caller', () => {
  assert.equal(buildBackupBundle().photoStorage, 'inline');
});

test('buildBackupBundle returns an independent snapshot — mutating it never corrupts the actual library state', () => {
  // Regression: location-library.js's/rifle-precision-library.js's own
  // WithTombstones() readers hand back their live `mirror` array by
  // reference, not a copy (unlike user-library.js's own load(), which is
  // JSON.parse(localStorage...)-backed and already independent every
  // call). A bundle consumer that mutates its own copy in place — exactly
  // what photo-assets.js's applyReferencedPhotoStorage() does — must never
  // be able to reach back into this device's actual in-memory records
  // through it.
  saveUserLocation({ id: 'loc1', name: 'Range', altitudeM: null, photo: 'data:image/jpeg;base64,AAA', targets: [] });
  saveRiflePrecisionProject({ id: 'proj1', name: 'Project', targets: [], createdAt: '2020-01-01T00:00:00.000Z' });

  const bundle = buildBackupBundle();
  delete bundle.locations.locations[0].photo;
  bundle.locations.locations[0].photoRef = 'sha256-mutated';
  bundle.riflePrecision.projects[0].name = 'Mutated Name';

  assert.equal(loadUserLocations()[0].photo, 'data:image/jpeg;base64,AAA');
  assert.equal(loadUserLocations()[0].photoRef, undefined);
  assert.equal(loadRiflePrecisionProjects()[0].name, 'Project');
});

test('buildBackupBundle includes tombstones, unlike the per-library export formats', () => {
  const bulletId = generateUserId('user-bullet');
  saveUserBullet({ id: bulletId, name: 'B1', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  deleteUserBullet(bulletId);

  const bundle = buildBackupBundle();
  assert.equal(bundle.arsenal.bullets.length, 1);
  assert.ok(bundle.arsenal.bullets[0].deletedAt);
});

test('buildBackupBundle stamps a device record on first build, stable on the next', () => {
  const first = buildBackupBundle();
  const second = buildBackupBundle();
  assert.equal(first.device.modifiedAt, second.device.modifiedAt);
});

test('serializeBackupBundle/parseBackupBundle round-trip', () => {
  saveUserRifle({
    id: generateUserId('user-rifle'), name: 'R1', defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1, cartridges: []
  });
  const bundle = buildBackupBundle();
  const text = serializeBackupBundle(bundle);
  const parsed = parseBackupBundle(text);
  assert.deepEqual(parsed, bundle);
});

test('parseBackupBundle rejects invalid JSON with a typed error', () => {
  assert.throws(() => parseBackupBundle('not json'), (err) => err.code === 'invalid-json');
});

test('parseBackupBundle rejects well-formed JSON that is not a backup bundle', () => {
  assert.throws(() => parseBackupBundle(JSON.stringify({ format: 'ebalka2-arsenal', bullets: [], rifles: [] })),
    (err) => err.code === 'invalid-format');
});

test('parseBackupBundle rejects a bundle missing a required section', () => {
  const bundle = buildBackupBundle();
  delete bundle.riflePrecision;
  assert.throws(() => parseBackupBundle(JSON.stringify(bundle)), (err) => err.code === 'invalid-format');
});

test('the bundle strips the local-only `unsaved` flag from every library, but keeps modifiedBy', () => {
  // Same rule as the three per-library export files' own
  // stripLocalOnlyFields: `unsaved` is local bookkeeping that always reads
  // misleadingly on another device. `modifiedBy` is the deliberate
  // opposite — a peer needs it to render "(from Guns' iPhone)".
  const bulletId = generateUserId('user-bullet');
  saveUserBullet({ id: bulletId, name: 'B', manufacturer: 'M', caliberM: 0.007, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserRifle({ id: generateUserId('user-rifle'), name: 'R', cartridges: [] });
  saveUserLocation({ id: generateUserId('location'), name: 'L', altitudeM: null, photo: null, targets: [] });
  saveRiflePrecisionProject({ id: generateUserId('rp'), name: 'P', distanceM: 100, caliberMm: 7, targets: [] });
  deleteUserBullet(bulletId);

  const bundle = buildBackupBundle();
  const everyRecord = [
    ...bundle.arsenal.bullets, ...bundle.arsenal.rifles,
    ...bundle.locations.locations, ...bundle.riflePrecision.projects
  ];
  assert.ok(everyRecord.length >= 4);
  for (const record of everyRecord) {
    assert.ok(!('unsaved' in record), `expected no unsaved on ${record.id}`);
  }
  const rifle = bundle.arsenal.rifles[0];
  assert.equal(typeof rifle.modifiedBy, 'string', 'modifiedBy still travels');
  assert.equal(rifle.revision, 1, 'revision travels too — needed for a peer to order it correctly regardless of clocks');
  // The tombstone is stripped too, without losing what makes it a tombstone.
  const tomb = bundle.arsenal.bullets.find((b) => b.id === bulletId);
  assert.ok(tomb.deletedAt && tomb.deletedBy);
  assert.equal(tomb.revision, 2, 'the deletion is its own local write, one more than the create it replaced');
});
