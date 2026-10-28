// Scopes and reticles through sync: carried in the backup bundle, merged
// like the Arsenal's other records, and every reticle from a peer checked
// (in the import worker, run in-process here) before anything is stored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const userLib = await import('../src/user-library.js');
const reticleLib = await import('../src/reticle-library.js');
const bundleMod = await import('../src/sync/backup-bundle.js');
const manualSync = await import('../src/sync/manual-sync.js');
const { SYNCED_LIBRARIES } = await import('../src/sync/synced-libraries.js');
const { revertToSnapshot } = await import('../src/sync/change-history.js');
const { recordTypeLabel } = await import('../src/sync/record-type-labels.js');
const svgClient = await import('../src/reticle/svg-import/client.js');
const { decodeReticleRecord } = await import('../src/reticle/reticle-record.js');
const { defaultScopeRecord } = await import('../src/scope-record.js');
const { createDocument, addElement } = await import('../src/reticle/model.js');
const { createElement } = await import('../src/reticle/element-types.js');
const { fieldOfViewAngle } = await import('../src/quantity.js');

let checks = 0;
let workerAnswers = true;
svgClient.setImportersForTests({
  reticleRecords: (text) => {
    checks += 1;
    if (!workerAnswers) return { ok: false, code: 'timeout' };
    return { ok: true, valid: JSON.parse(text).map((r) => { try { decodeReticleRecord(r); return true; } catch { return false; } }) };
  }
});

// A "device": its own localStorage (scopes, rifles, device id) and its own
// reticle store.
async function becomeDevice(id) {
  localStorage.clear();
  localStorage.setItem('ballistics_device_id_v1', id);
  await reticleLib.resetReticleLibraryForTests();
}
const bundleText = () => bundleMod.serializeBackupBundle(bundleMod.buildBackupBundle());

function reticle(id = 'user-reticle-1', model = 'Dot') {
  let doc = createDocument();
  doc = addElement(doc, createElement('dot', { x: 0, y: 0.001, units: 'mrad' })).doc;
  doc = addElement(doc, { ...createElement('hline', { x: 0.001, y: 0, end: 0.004, units: 'mrad' }), mirror: true, repeat: { enabled: true, direction: 'down', count: 2, step: 0.001 } }).doc;
  return reticleLib.saveUserReticle({ ...doc, id, manufacturer: 'Acme', model });
}
function scope() {
  return userLib.saveUserScope({
    ...defaultScopeRecord(), id: 'user-scope-1', manufacturer: 'Acme', model: '5-25x56', reticleIds: ['user-reticle-1'],
    fovMaxRad: fieldOfViewAngle(7.5, 100), fovMinRad: fieldOfViewAngle(1.5, 100)
  });
}

test.beforeEach(() => {
  checks = 0;
  workerAnswers = true;
});

test('scopes and reticles are in the bundle and merge onto a peer exactly; an unchanged round trip changes nothing', async () => {
  await becomeDevice('device-a');
  const original = reticle();
  scope();
  const fromA = bundleText();
  const parsed = JSON.parse(fromA);
  assert.equal(parsed.arsenal.scopes.length, 1);
  assert.equal(parsed.arsenal.reticles.length, 1);
  assert.ok(!('unsaved' in parsed.arsenal.reticles[0]));

  await becomeDevice('device-b');
  await manualSync.importPeerBundleText(fromA);
  assert.equal(checks, 1, 'the reticles were checked');
  const [received] = reticleLib.loadUserReticles();
  assert.equal(received.name, 'Acme Dot');
  assert.equal(received.revision, original.revision, 'adopted as it was');
  assert.deepEqual(received.elements, original.elements);
  assert.deepEqual(userLib.loadUserScopes().map((s) => [s.id, s.name, s.reticleIds]), [['user-scope-1', 'Acme 5-25x56', ['user-reticle-1']]]);

  // A's bundle again: nothing to do.
  const before = reticleLib.loadUserReticlesWithTombstones()[0];
  await manualSync.importPeerBundleText(fromA);
  assert.equal(reticleLib.loadUserReticlesWithTombstones()[0], before, 'the same record, not rewritten');
});

test('a peer\'s reticle that fails its check is left out, the rest merged; a check that can\'t finish stores none', async () => {
  await becomeDevice('device-a');
  reticle('user-reticle-1', 'Good');
  const bundle = JSON.parse(bundleText());
  bundle.arsenal.reticles.push({
    id: 'user-reticle-bad', name: 'Acme Bad', manufacturer: 'Acme', model: 'Bad', revision: 1, modifiedAt: '2026-01-01T00:00:00.000Z',
    referenceScope: { type: 'ffp', zoomMin: 5, zoomMax: 25 }, elements: [{ type: 'dot', x: 99, y: 0, diameter: 0.001 }]
  });

  await becomeDevice('device-b');
  await manualSync.importPeerBundleText(JSON.stringify(bundle));
  assert.deepEqual(reticleLib.loadUserReticlesWithTombstones().map((r) => r.id), ['user-reticle-1']);

  await becomeDevice('device-c');
  workerAnswers = false;
  await manualSync.importPeerBundleText(JSON.stringify(bundle));
  assert.deepEqual(reticleLib.loadUserReticlesWithTombstones(), []);
});

test('a bundle with no reticles needs no check; one from a build before scopes merges the rest and deletes nothing', async () => {
  await becomeDevice('device-a');
  const old = JSON.parse(bundleText());
  delete old.arsenal.scopes;
  delete old.arsenal.reticles;

  await becomeDevice('device-b');
  reticle();
  scope();
  await manualSync.importPeerBundleText(JSON.stringify(old));
  assert.equal(checks, 0);
  assert.equal(reticleLib.loadUserReticles().length, 1);
  assert.equal(userLib.loadUserScopes().length, 1);
});

test('deleting a scope or a reticle reaches the peer', async () => {
  await becomeDevice('device-a');
  reticle();
  scope();
  const created = bundleText();
  await becomeDevice('device-b');
  await manualSync.importPeerBundleText(created);
  const bState = { scopes: localStorage.getItem('ballistics_user_scopes_v1'), reticles: reticleLib.loadUserReticlesWithTombstones() };

  await becomeDevice('device-a');
  await manualSync.importPeerBundleText(created);
  reticleLib.deleteUserReticle('user-reticle-1');
  userLib.deleteUserScope('user-scope-1');
  const deleted = bundleText();

  await becomeDevice('device-b');
  localStorage.setItem('ballistics_user_scopes_v1', bState.scopes);
  for (const record of bState.reticles) reticleLib.importUserReticle(record);
  await manualSync.importPeerBundleText(deleted);
  assert.deepEqual(reticleLib.loadUserReticles(), []);
  assert.deepEqual(userLib.loadUserScopes(), []);
  assert.ok(reticleLib.loadUserReticlesWithTombstones()[0].deletedAt);
});

test('adopting a stored reticle as a local edit (pending review, history) decodes it, repeats and all', async () => {
  await becomeDevice('device-a');
  const saved = reticle();
  const stored = reticleLib.loadUserReticlesWithTombstones()[0];
  const lib = SYNCED_LIBRARIES.find((l) => l.recordType === 'reticle');
  assert.equal(lib.decode(stored), stored, 'merged in its stored form');
  lib.save({ ...stored, model: 'Theirs' });
  const adopted = reticleLib.getUserReticle(saved.id);
  assert.equal(adopted.name, 'Acme Theirs');
  assert.equal(adopted.revision, 2);
  assert.deepEqual(adopted.elements[1].repeat, saved.elements[1].repeat);

  revertToSnapshot('reticle', stored);
  assert.equal(reticleLib.getUserReticle(saved.id).name, 'Acme Dot');
});

test('change history and review name the new libraries', () => {
  assert.equal(recordTypeLabel('scope'), t('settings.changeHistory.recordTypeScope'));
  assert.equal(recordTypeLabel('reticle'), t('settings.changeHistory.recordTypeReticle'));
  assert.deepEqual(SYNCED_LIBRARIES.map((l) => l.recordType), ['bullet', 'rifle', 'scope', 'reticle', 'location', 'rifle-precision-project']);
});
