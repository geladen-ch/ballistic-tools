import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom, installFakeIndexedDb, fireEvent, makeElement } from './helpers/fake-dom.js';
import { legacyReticleFile } from './helpers/legacy-reticle-file.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const arsenalView = await import('../src/views/arsenal-view.js');
const { mountDialogRoot } = await import('../src/ui/app-dialog.js');
const userLibrary = await import('../src/user-library.js');
const reticleLibrary = await import('../src/reticle-library.js');
const { setPendingArsenalTab, takePendingArsenalTab } = await import('../src/arsenal-prefill.js');
const { resetShotStateForTests } = await import('../src/shot-state.js');
const { planImportBatch, exportBundle, isLegacyReticleFile } = await import('../src/arsenal-export.js');
const { defaultScopeRecord } = await import('../src/scope-record.js');
const { createDocument, addElement } = await import('../src/reticle/model.js');
const { createElement } = await import('../src/reticle/element-types.js');
const { encodeReticleRecord, decodeReticleRecord } = await import('../src/reticle/reticle-record.js');
const { parseReticle } = await import('../src/reticle/file-codec.js');
const svgClient = await import('../src/reticle/svg-import/client.js');
const { fieldOfViewAngle } = await import('../src/quantity.js');
const { resetUnits } = await import('../src/prefs.js');

// The import worker's jobs, run in-process (the test DOM's Worker never answers).
svgClient.setImportersForTests({
  reticle: (text) => {
    try { return { ok: true, doc: parseReticle(text) }; } catch (err) { return { ok: false, code: err.code }; }
  },
  reticleRecords: (text) => ({
    ok: true,
    valid: JSON.parse(text).map((r) => { try { decodeReticleRecord(r); return true; } catch { return false; } })
  })
});

// Every download's file content.
const downloads = [];
global.URL.createObjectURL = (blob) => { downloads.push(blob); return 'blob:test'; };
global.URL.revokeObjectURL = () => {};
const lastDownload = async () => JSON.parse(await downloads[downloads.length - 1].text());

const dialogRoot = makeElement('div');
mountDialogRoot(dialogRoot);

test.beforeEach(async () => {
  localStorage.clear();
  resetUnits();
  resetShotStateForTests();
  arsenalView.resetArsenalTabForTests();
  takePendingArsenalTab();
  await reticleLibrary.resetReticleLibraryForTests();
  downloads.length = 0;
});

const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));
function findAll(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  for (const child of node.childNodes || []) findAll(child, predicate, out);
  return out;
}
const byId = (root, id) => findAll(root, (n) => n.id === id)[0];
const buttons = (root, key) => findAll(root, (n) => n.tagName === 'BUTTON' && n.textContent === t(key));
const rowsOf = (root, cls) => findAll(root, (n) => (n.className || '').split(' ').includes(cls));
function type(root, id, value) {
  const input = byId(root, id);
  input.value = String(value);
  fireEvent(input, 'input');
}
async function pickFile(container, text, name = 'file.json') {
  const input = findAll(container, (n) => n.tagName === 'INPUT' && n.type === 'file')[0];
  input.files = [{ name, size: text.length, text: async () => text }];
  for (const handler of input._listeners.change) await handler({ target: input });
  await settle(20);
}

function reticle(id, model, extra = {}) {
  let doc = createDocument();
  doc = addElement(doc, createElement('dot', { x: 0, y: 0.001, units: 'mrad' })).doc;
  return reticleLibrary.saveUserReticle({ ...doc, id, manufacturer: 'Acme', model, ...extra });
}
function scope(overrides = {}) {
  return userLibrary.saveUserScope({
    ...defaultScopeRecord(), id: 'user-scope-1', manufacturer: 'Acme', model: '5-25x56', reticleIds: ['user-reticle-1'],
    fovMaxRad: fieldOfViewAngle(7.5, 100), fovMinRad: fieldOfViewAngle(1.5, 100), ...overrides
  });
}
function rifle(overrides = {}) {
  return userLibrary.saveUserRifle({
    id: 'user-rifle-1', name: 'My Rifle', defaultSightHeightM: 0.05, defaultZeroRangeM: 100, defaultTwistDirection: 'right',
    defaultClickUnit: 'mrad', defaultClickHorizontalRad: 0.0001, defaultClickVerticalRad: 0.0001, source: '', cartridges: [],
    ...overrides
  });
}

// ---- arsenal-export.js ----

test('exportBundle: a rifle brings its own scope and that scope\'s own reticles; built-in ones are only referred to', () => {
  const userScopes = [{ id: 's1', reticleIds: ['r1', 'sb-p4lf'] }, { id: 's2', reticleIds: ['r2'] }];
  const userReticles = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }];
  const bundle = exportBundle({ rifles: [{ id: 'a', scopeId: 's1' }, { id: 'b', scopeId: 'sb-pm2-3-20x50' }], userScopes, userReticles });
  assert.deepEqual(bundle.scopes.map((s) => s.id), ['s1']);
  assert.deepEqual(bundle.reticles.map((r) => r.id), ['r1']);
  const scopeOnly = exportBundle({ scopes: [userScopes[1]], reticles: [userReticles[2]], userScopes, userReticles });
  assert.deepEqual(scopeOnly.reticles.map((r) => r.id), ['r2', 'r3']);
});

test('planImportBatch: reticles, then scopes, then rifles, every link remapped to where its target landed', () => {
  const plan = planImportBatch({
    mode: 'rename',
    reticles: [{ id: 'f-r1', name: 'Acme Dot', manufacturer: 'Acme', model: 'Dot' }],
    scopes: [{ id: 'f-s1', name: 'Acme X', manufacturer: 'Acme', model: 'X', reticleIds: ['f-r1', 'sb-p4lf'] }],
    rifles: [
      { id: 'f-a', name: 'A', cartridges: [], scopeId: 'f-s1', reticleId: 'f-r1' },
      { id: 'f-b', name: 'B', cartridges: [], scopeId: 'trijicon-acog-4x32-rco-m4', reticleId: 'trijicon-rco-m4-chevron' }
    ],
    existingReticles: [{ id: 'f-r1', name: 'Acme Dot' }],
    existingScopes: [{ id: 'other', name: 'Acme X' }],
    generateReticleId: () => 'new-r', generateScopeId: () => 'new-s', generateRifleId: () => 'new-rifle', generateBulletId: () => 'new-b'
  });
  const [reticleResult] = plan.reticleResults;
  assert.deepEqual([reticleResult.resolved.record.id, reticleResult.resolved.record.model, reticleResult.resolved.record.name],
    ['new-r', 'Dot - copy (1)', 'Acme Dot - copy (1)'], 'renamed: a new model, its name following');
  const [scopeResult] = plan.scopeResults;
  assert.equal(scopeResult.resolved.record.model, 'X - copy (1)');
  assert.deepEqual(scopeResult.resolved.record.reticleIds, ['new-r', 'sb-p4lf']);
  const [a, b] = plan.rifleResults.map((r) => r.resolved.record);
  assert.deepEqual([a.scopeId, a.reticleId], ['new-s', 'new-r']);
  assert.deepEqual([b.scopeId, b.reticleId], ['trijicon-acog-4x32-rco-m4', 'trijicon-rco-m4-chevron'], 'built-in links untouched');
});

test('isLegacyReticleFile tells a 4.3.x reticle file from an Arsenal export', () => {
  assert.ok(isLegacyReticleFile(legacyReticleFile(createDocument())));
  assert.ok(!isLegacyReticleFile(JSON.stringify({ format: 'ebalka2-arsenal', bullets: [], rifles: [] })));
  assert.ok(!isLegacyReticleFile('{nope'));
});

// ---- the Arsenal ----

test('a rifle\'s Save to file takes its own scope and that scope\'s own reticles along, all then saved', async () => {
  reticle('user-reticle-1', 'Dot');
  reticle('user-reticle-other', 'Other');
  scope({ reticleIds: ['user-reticle-1', 'sb-p4lf'] });
  rifle({ scopeId: 'user-scope-1', reticleId: 'user-reticle-1' });
  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();
  activate(container, 'My Rifle');
  fireEvent(buttons(byId(container, 'arsenal-tab-rifles'), 'arsenal.saveToFileButton')[0], 'click');
  const file = await lastDownload();
  assert.deepEqual(file.rifles.map((r) => r.scopeId), ['user-scope-1']);
  assert.deepEqual(file.scopes.map((s) => s.id), ['user-scope-1']);
  assert.deepEqual(file.reticles.map((r) => r.id), ['user-reticle-1']);
  assert.ok(!('unsaved' in file.scopes[0]) && !('unsaved' in file.reticles[0]));
  assert.equal(userLibrary.loadUserScopes()[0].unsaved, false);
  assert.equal(reticleLibrary.getUserReticle('user-reticle-1').unsaved, false);
  assert.equal(reticleLibrary.getUserReticle('user-reticle-other').unsaved, true);
});

function activate(container, name) {
  const row = rowsOf(container, 'row-clickable').find((r) => r.textContent.includes(name));
  if (row) fireEvent(row, 'click');
}

test('a scope\'s and a reticle\'s own Save to file; the Scopes tab\'s Save offers just scopes and reticles', async () => {
  reticle('user-reticle-1', 'Dot');
  scope();
  rifle();
  setPendingArsenalTab('scopes');
  const container = makeElement('main');
  arsenalView.mount(container);
  const tab = byId(container, 'arsenal-tab-scopes');
  const scopeRow = rowsOf(tab, 'arsenal-row').find((r) => r.textContent.includes('Acme 5-25x56'));
  fireEvent(buttons(scopeRow, 'arsenal.saveToFileButton')[0], 'click');
  let file = await lastDownload();
  assert.deepEqual([file.scopes.length, file.reticles.length, file.rifles.length], [1, 1, 0]);
  const reticleRow = rowsOf(tab, 'arsenal-reticle-row')[0];
  fireEvent(buttons(reticleRow, 'arsenal.saveToFileButton')[0], 'click');
  file = await lastDownload();
  assert.deepEqual([file.scopes.length, file.reticles.length], [0, 1]);

  fireEvent(byId(container, 'arsenal-save-optics'), 'click');
  assert.ok(byId(container, 'export-scope-user-scope-1'));
  assert.ok(byId(container, 'export-reticle-user-reticle-1'));
  assert.equal(byId(container, 'export-rifle-user-rifle-1'), undefined);
  fireEvent(buttons(container, 'arsenal.exportButton')[0], 'click');
  file = await lastDownload();
  assert.deepEqual([file.bullets.length, file.rifles.length, file.scopes.length, file.reticles.length], [0, 0, 1, 1]);
});

test('loading an export brings in its scopes and reticles, links intact; a reticle that can\'t be read is named and left out', async () => {
  const good = encodeReticleRecord({ ...createDocument(), id: 'f-r1', manufacturer: 'Acme', model: 'Dot' });
  const bad = { id: 'f-bad', name: 'Bad One', manufacturer: 'Bad', model: 'One', referenceScope: { type: 'ffp', zoomMin: 9, zoomMax: 1 }, elements: [] };
  const fileScope = { ...defaultScopeRecord(), id: 'f-s1', name: 'Acme X', manufacturer: 'Acme', model: 'X', reticleIds: ['f-r1'], fovMaxRad: 0.1, fovMinRad: 0.02 };
  const fileRifle = { id: 'f-a', name: 'Imported', cartridges: [], scopeId: 'f-s1', reticleId: 'f-r1', defaultClickUnit: 'mrad', defaultClickHorizontalRad: 0.0001, defaultClickVerticalRad: 0.0001 };
  const text = JSON.stringify({ format: 'ebalka2-arsenal', version: 1, bullets: [], rifles: [fileRifle], scopes: [fileScope], reticles: [good, bad] });
  const container = makeElement('main');
  arsenalView.mount(container);
  await pickFile(container, text);
  assert.ok(container.textContent.includes(t('arsenal.importInvalidReticles', { names: 'Bad One' })));
  assert.equal(byId(container, 'import-reticle-f-bad'), undefined);
  fireEvent(buttons(container, 'arsenal.importButton')[0], 'click');
  assert.deepEqual(reticleLibrary.loadUserReticles().map((r) => r.id), ['f-r1']);
  assert.deepEqual(userLibrary.loadUserScopes().map((s) => [s.id, s.reticleIds]), [['f-s1', ['f-r1']]]);
  assert.deepEqual(userLibrary.loadUserRifles().map((r) => [r.scopeId, r.reticleId]), [['f-s1', 'f-r1']]);
});

test('loading a 4.3.x reticle file asks for what it lacks, adds the reticle, then opens the scope form with the file\'s optics', async () => {
  const text = readFileSync(new URL('../src/reticles/sb-p4lf.json', import.meta.url), 'utf8');
  // A 4.3.x file of that reticle, with the optics of a 3-20x scope (13 m to 2.1 m at 100 m).
  const doc = decodeReticleRecord(JSON.parse(text));
  const legacy = JSON.parse(legacyReticleFile({ ...doc, name: 'SB P4LF' }));
  legacy.scope = { type: 'ffp', fovMaxRad: fieldOfViewAngle(13, 100), fovMinRad: fieldOfViewAngle(2.1, 100), fovDistanceM: 100, zoomMin: 20 * 2.1 / 13, zoomMax: 20 };
  const container = makeElement('main');
  arsenalView.mount(container);
  await pickFile(container, JSON.stringify(legacy), 'SB-P4LF.reticle.json');

  assert.equal(byId(dialogRoot, 'legacyReticleModel').value, 'SB P4LF');
  assert.equal(byId(dialogRoot, 'legacyReticleZoomMin').value, '3.23');
  assert.equal(byId(dialogRoot, 'legacyReticleCreateScope').checked, true);
  const add = buttons(dialogRoot, 'arsenal.legacyAddButton')[0];
  fireEvent(add, 'click');
  assert.ok(dialogRoot.textContent.includes(t('fields.errorRequired')), 'manufacturer missing: stays open');
  assert.deepEqual(reticleLibrary.loadUserReticles(), []);

  type(dialogRoot, 'legacyReticleManufacturer', 'Schmidt & Bender');
  type(dialogRoot, 'legacyReticleModel', 'P4LF');
  type(dialogRoot, 'legacyReticleZoomMin', 3);
  fireEvent(add, 'click');
  const [saved] = reticleLibrary.loadUserReticles();
  assert.equal(saved.name, 'Schmidt & Bender P4LF');
  assert.deepEqual(saved.referenceScope, { type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 20 });
  assert.equal(saved.elements.length, doc.elements.length);
  assert.ok(container.textContent.includes(t('arsenal.legacyAdded', { name: 'Schmidt & Bender P4LF' })));

  // The scope form, on the Scopes tab, filled in: the model is left to the user.
  assert.notEqual(byId(container, 'arsenal-tab-scopes').style.display, 'none');
  assert.equal(byId(container, 'arsenalScopeManufacturer').value, 'Schmidt & Bender');
  assert.equal(byId(container, 'arsenalScopeMagnificationMin').value, '3');
  assert.equal(byId(container, 'arsenalScopeFovMax').value, '13');
  assert.equal(byId(container, `arsenalScopeReticle-${saved.id}`).checked, true);
  type(container, 'arsenalScopeModel', '3-20x50 PM II');
  fireEvent(buttons(container, 'arsenal.saveScopeButton')[0], 'click');
  const [newScope] = userLibrary.loadUserScopes();
  assert.equal(newScope.fovMaxRad, legacy.scope.fovMaxRad, 'the file\'s field of view, exactly');
  assert.deepEqual(newScope.reticleIds, [saved.id]);
});

test('a 4.3.x reticle file whose name is already taken is refused until the model is changed; Cancel adds nothing', async () => {
  reticle('user-reticle-1', 'Dot', { manufacturer: 'Acme' });
  const container = makeElement('main');
  arsenalView.mount(container);
  await pickFile(container, legacyReticleFile({ ...createDocument(), name: 'Dot' }));
  type(dialogRoot, 'legacyReticleManufacturer', 'Acme');
  fireEvent(buttons(dialogRoot, 'arsenal.legacyAddButton')[0], 'click');
  assert.ok(dialogRoot.textContent.includes(t('arsenal.legacyNameTaken', { name: 'Acme Dot' })));
  fireEvent(buttons(dialogRoot, 'arsenal.cancelButton')[0], 'click');
  assert.equal(reticleLibrary.loadUserReticles().length, 1);
});
