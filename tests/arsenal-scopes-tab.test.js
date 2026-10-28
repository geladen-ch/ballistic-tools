import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const arsenalView = await import('../src/views/arsenal-view.js');
const { loadUserScopes, saveUserScope } = await import('../src/user-library.js');
const reticleLibrary = await import('../src/reticle-library.js');
const designer = await import('../src/reticle-designer-state.js');
const { setPendingArsenalTab, takePendingArsenalTab } = await import('../src/arsenal-prefill.js');
const { defaultScopeRecord, actualMagnificationMin, DEFAULT_CLICK_RAD } = await import('../src/scope-record.js');
const { createDocument, addElement } = await import('../src/reticle/model.js');
const { createElement } = await import('../src/reticle/element-types.js');
const { fieldOfViewAngle, fieldOfViewWidth, mradToRad, moaToRad } = await import('../src/quantity.js');
const { resetUnits } = await import('../src/prefs.js');

test.beforeEach(async () => {
  localStorage.clear();
  resetUnits();
  arsenalView.resetArsenalTabForTests();
  takePendingArsenalTab();
  designer.resetReticleDesignerStateForTests();
  await reticleLibrary.resetReticleLibraryForTests();
  global.location.hash = '#/guns/arsenal';
});

const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
function findAll(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  for (const child of node.childNodes || []) findAll(child, predicate, out);
  return out;
}
const byId = (root, id) => findAll(root, (n) => n.id === id)[0];
const classesOf = (n) => `${n.className || ''} ${n.getAttribute?.('class') || ''}`.split(' ');
const buttons = (root, key) => findAll(root, (n) => n.tagName === 'BUTTON' && n.textContent === t(key));
function type(root, id, value) {
  const input = byId(root, id);
  input.value = String(value);
  fireEvent(input, 'input');
  return input;
}
function choose(root, id, value) {
  const select = byId(root, id);
  select.value = value;
  fireEvent(select, 'change');
}
function withConfirm(answer, fn) {
  const saved = global.confirm;
  const asked = [];
  global.confirm = (message) => { asked.push(message); return answer; };
  try { fn(); } finally { global.confirm = saved; }
  return asked;
}

function mountOnScopes() {
  setPendingArsenalTab('scopes');
  const container = makeElement('main');
  arsenalView.mount(container);
  return container;
}

function saveReticle(overrides = {}) {
  let doc = createDocument({ referenceScope: { type: 'ffp', zoomMin: 3, zoomMax: 20, calibrationZoom: 20 } });
  doc = addElement(doc, createElement('dot', { x: 0, y: 0.001, units: 'mrad' })).doc;
  return reticleLibrary.saveUserReticle({ ...doc, id: `user-reticle-${Math.random().toString(36).slice(2)}`, manufacturer: 'Acme', model: 'Dot', ...overrides });
}

function pm2(overrides = {}) {
  return {
    ...defaultScopeRecord(), id: 'user-scope-1', manufacturer: 'Schmidt & Bender', model: '3-20x50 PM II', reticleIds: [],
    magnificationMin: 3, magnificationMax: 20, fovMaxRad: fieldOfViewAngle(13, 100), fovMinRad: fieldOfViewAngle(2.1, 100),
    ...overrides
  };
}

test('a pending tab opens the Arsenal on Scopes, with empty scope and reticle lists', () => {
  const container = mountOnScopes();
  assert.notEqual(byId(container, 'arsenal-tab-scopes').style.display, 'none');
  assert.ok(byId(container, 'arsenal-tab-scopes').textContent.includes(t('arsenal.noScopes')));
  assert.ok(byId(container, 'arsenal-tab-scopes').textContent.includes(t('arsenal.noReticles')));
});

test('adding a scope: every field read in SI, the actual low zoom shown as typed, the chosen reticle kept', async () => {
  const reticle = saveReticle();
  const container = mountOnScopes();
  fireEvent(byId(container, 'arsenal-add-scope'), 'click');
  assert.equal(byId(container, 'arsenal-add-scope').style.display, 'none');
  type(container, 'arsenalScopeManufacturer', 'Schmidt & Bender');
  type(container, 'arsenalScopeModel', '3-20x50 PM II');
  type(container, 'arsenalScopeMagnificationMin', 3);
  type(container, 'arsenalScopeMagnificationMax', 20);
  type(container, 'arsenalScopeFovMax', 13);
  type(container, 'arsenalScopeFovMin', 2.1);
  assert.ok(container.textContent.includes(t('arsenal.scopeActualLowZoom', { zoom: '3.23' })));
  const check = byId(container, `arsenalScopeReticle-${reticle.id}`);
  check.checked = true;
  fireEvent(check, 'change');
  await settle();
  fireEvent(buttons(container, 'arsenal.saveScopeButton')[0], 'click');

  const [scope] = loadUserScopes();
  assert.equal(scope.name, 'Schmidt & Bender 3-20x50 PM II');
  assert.deepEqual([scope.type, scope.magnificationMin, scope.magnificationMax, scope.fovDistanceM], ['ffp', 3, 20, 100]);
  assert.ok(Math.abs(fieldOfViewWidth(scope.fovMaxRad, 100) - 13) < 1e-9);
  assert.ok(Math.abs(actualMagnificationMin(scope) - 20 * 2.1 / 13) < 1e-9);
  assert.equal(scope.calibrationZoom, null);
  assert.equal(scope.clickHorizontalRad, DEFAULT_CLICK_RAD.mrad);
  assert.deepEqual(scope.reticleIds, [reticle.id]);
  // Listed, with its summary; the form gone.
  const tab = byId(container, 'arsenal-tab-scopes');
  assert.ok(tab.textContent.includes('Schmidt & Bender 3-20x50 PM II'));
  assert.ok(tab.textContent.includes(t('arsenal.scopeSummary', { type: 'FFP', zoom: '3–20×', click: '0.1 mrad', count: 1 })));
  assert.equal(byId(container, 'arsenalScopeModel'), undefined);
  assert.ok(tab.textContent.includes(t('arsenal.reticleUsedBy', { count: 1 })));
});

test('the scope form refuses what doesn\'t fit, and saves nothing', () => {
  const container = mountOnScopes();
  fireEvent(byId(container, 'arsenal-add-scope'), 'click');
  type(container, 'arsenalScopeManufacturer', 'Acme');
  type(container, 'arsenalScopeModel', 'X');
  type(container, 'arsenalScopeMagnificationMax', 4);
  type(container, 'arsenalScopeFovMax', 10);
  type(container, 'arsenalScopeFovMin', 12);
  fireEvent(buttons(container, 'arsenal.saveScopeButton')[0], 'click');
  assert.deepEqual(loadUserScopes(), []);
  assert.ok(container.textContent.includes(t('arsenal.scopeErrorMagnificationOrder')));
  assert.ok(container.textContent.includes(t('reticleDesigner.errors.fovMinBelowMax')));
});

test('a fixed scope: one magnification and one field; an SFP adds its calibration zoom', () => {
  const container = mountOnScopes();
  fireEvent(byId(container, 'arsenal-add-scope'), 'click');
  const shown = (id) => {
    let node = byId(container, id);
    while (node && !(node.style && node.style.display === 'none')) node = node.parentNode;
    return !node;
  };
  assert.ok(shown('arsenalScopeFovMin') && !shown('arsenalScopeCalibrationZoom'));
  choose(container, 'arsenalScopeType', 'fixed');
  assert.ok(!shown('arsenalScopeFovMin') && !shown('arsenalScopeMagnificationMax'));
  type(container, 'arsenalScopeManufacturer', 'Trijicon');
  type(container, 'arsenalScopeModel', 'ACOG');
  type(container, 'arsenalScopeMagnificationMin', 4);
  type(container, 'arsenalScopeFovMax', 12.2);
  fireEvent(buttons(container, 'arsenal.saveScopeButton')[0], 'click');
  const [scope] = loadUserScopes();
  assert.deepEqual([scope.type, scope.magnificationMin, scope.magnificationMax, scope.fovMinRad], ['fixed', 4, 4, null]);

  fireEvent(byId(container, 'arsenal-add-scope'), 'click');
  choose(container, 'arsenalScopeType', 'sfp');
  assert.ok(shown('arsenalScopeCalibrationZoom'));
});

test('clicks: switching the unit swaps the usual size, converts any other', () => {
  const container = mountOnScopes();
  fireEvent(byId(container, 'arsenal-add-scope'), 'click');
  assert.equal(byId(container, 'arsenalScopeClickHorizontal').value, '0.1');
  type(container, 'arsenalScopeClickVertical', 0.2);
  choose(container, 'arsenalScopeClickUnit', 'arcmin');
  assert.equal(byId(container, 'arsenalScopeClickHorizontal').value, '0.25');
  assert.equal(byId(container, 'arsenalScopeClickVertical').value, '0.6875');
  type(container, 'arsenalScopeManufacturer', 'A');
  type(container, 'arsenalScopeModel', 'B');
  type(container, 'arsenalScopeFovMax', 10);
  type(container, 'arsenalScopeFovMin', 2);
  fireEvent(buttons(container, 'arsenal.saveScopeButton')[0], 'click');
  const [scope] = loadUserScopes();
  assert.equal(scope.clickUnit, 'arcmin');
  assert.ok(Math.abs(scope.clickHorizontalRad - moaToRad(0.25)) < 1e-15);
  assert.ok(Math.abs(scope.clickVerticalRad - moaToRad(0.6875)) < 1e-15);
});

test('editing a scope and saving it untouched keeps every value exactly; a name already used warns', () => {
  const stored = saveUserScope(pm2({ fovMaxRad: 0.12981737938686694, clickVerticalRad: mradToRad(0.1) }));
  saveUserScope(pm2({ id: 'user-scope-2', model: 'Other' }));
  const container = mountOnScopes();
  fireEvent(buttons(byId(container, 'arsenal-tab-scopes'), 'arsenal.editButton')[0], 'click');
  assert.equal(byId(container, 'arsenalScopeModel').value, '3-20x50 PM II');
  fireEvent(buttons(container, 'arsenal.saveScopeButton')[0], 'click');
  const saved = loadUserScopes().find((s) => s.id === stored.id);
  for (const key of ['fovMaxRad', 'fovMinRad', 'fovDistanceM', 'clickHorizontalRad', 'clickVerticalRad', 'magnificationMin']) {
    assert.equal(saved[key], stored[key], key);
  }
  assert.equal(saved.revision, 2);

  fireEvent(buttons(byId(container, 'arsenal-tab-scopes'), 'arsenal.editButton')[0], 'click');
  type(container, 'arsenalScopeModel', 'other');
  assert.ok(findAll(container, (n) => n.textContent === t('arsenal.duplicateNameWarning') && n.style.display !== 'none').length > 0);
});

test('the reticle picker offers the user\'s reticles and, once loaded, the built-in ones; a mismatched type is pointed out', async () => {
  saveReticle({ model: 'Fixed one', referenceScope: { type: 'fixed', zoomMin: 4, zoomMax: 4, calibrationZoom: 4 } });
  const container = mountOnScopes();
  fireEvent(byId(container, 'arsenal-add-scope'), 'click');
  await settle(60);
  for (const id of ['sb-p4lf', 'sb-tr2id', 'trijicon-rco-m4-chevron']) assert.ok(byId(container, `arsenalScopeReticle-${id}`), id);
  const thumbs = findAll(byId(container, 'arsenal-tab-scopes'), (n) => classesOf(n).includes('reticle-thumbnail'));
  assert.ok(thumbs.length >= 4);
  const hint = findAll(container, (n) => n.textContent === t('arsenal.scopeReticleTypeHint'))[0];
  assert.equal(hint.style.display, 'none');
  const fixed = byId(container, `arsenalScopeReticle-${reticleLibrary.loadUserReticles()[0].id}`);
  fixed.checked = true;
  fireEvent(fixed, 'change');
  assert.equal(hint.style.display, '', 'a fixed reticle on an FFP scope');
});

test('reticles are listed with a thumbnail and summary; deleting one asks and takes it off the scopes listing it', () => {
  const reticle = saveReticle({ illumination: { enabled: true, colour: 'red' } });
  saveUserScope(pm2({ reticleIds: [reticle.id, 'sb-p4lf'] }));
  const container = mountOnScopes();
  const tab = byId(container, 'arsenal-tab-scopes');
  const row = findAll(tab, (n) => classesOf(n).includes('arsenal-reticle-row'))[0];
  assert.ok(findAll(row, (n) => classesOf(n).includes('reticle-thumbnail')).length === 1);
  assert.ok(row.textContent.includes(`FFP · 3–20× · ${t('arsenal.reticleIlluminated')}`));

  const deleteReticle = buttons(row, 'arsenal.deleteButton')[0];
  const declined = withConfirm(false, () => fireEvent(deleteReticle, 'click'));
  assert.equal(declined[0], t('arsenal.confirmDeleteReticleWithScopes', { name: 'Acme Dot', count: 1 }));
  assert.equal(reticleLibrary.loadUserReticles().length, 1);
  withConfirm(true, () => fireEvent(deleteReticle, 'click'));
  assert.deepEqual(reticleLibrary.loadUserReticles(), []);
  assert.deepEqual(loadUserScopes()[0].reticleIds, ['sb-p4lf']);
});

test('a scope with no reticle is marked unusable; deleting a scope asks first', () => {
  saveUserScope(pm2());
  const container = mountOnScopes();
  const tab = byId(container, 'arsenal-tab-scopes');
  assert.ok(tab.textContent.includes(t('arsenal.unusableBadge')));
  withConfirm(false, () => fireEvent(buttons(tab, 'arsenal.deleteButton')[0], 'click'));
  assert.equal(loadUserScopes().length, 1);
  withConfirm(true, () => fireEvent(buttons(tab, 'arsenal.deleteButton')[0], 'click'));
  assert.deepEqual(loadUserScopes(), []);
});

test('a damaged reticle is listed to be deleted, not edited', () => {
  reticleLibrary.importUserReticle({ id: 'bad', name: 'Bad One', manufacturer: 'Bad', model: 'One', referenceScope: { type: 'ffp', zoomMin: 9, zoomMax: 1 }, elements: [] });
  const container = mountOnScopes();
  const row = findAll(byId(container, 'arsenal-tab-scopes'), (n) => classesOf(n).includes('arsenal-reticle-row'))[0];
  assert.ok(row.textContent.includes(t('arsenal.damagedBadge')));
  assert.equal(buttons(row, 'arsenal.editButton').length, 0);
  assert.equal(buttons(row, 'arsenal.deleteButton').length, 1);
});

test('Add/Edit reticle open the Reticle Designer, set to come back; unsaved work on another reticle there is asked about', () => {
  const reticle = saveReticle();
  const container = mountOnScopes();
  const tab = byId(container, 'arsenal-tab-scopes');
  fireEvent(buttons(tab, 'arsenal.editButton')[0], 'click');
  assert.equal(global.location.hash, '#/reticle-designer');
  assert.deepEqual(designer.getReticleTarget(), { reticleId: reticle.id, fromArsenal: true });
  assert.equal(designer.getReticleSession().history.present.model, 'Dot');

  // Unsaved work in the Designer: Add asks before discarding it.
  const session = designer.getReticleSession();
  designer.setReticleHistory({ ...session.history, present: { ...session.history.present, model: 'Changed' } });
  const declined = withConfirm(false, () => fireEvent(byId(container, 'arsenal-add-reticle'), 'click'));
  assert.equal(declined[0], t('arsenal.confirmDiscardDesigner'));
  assert.equal(designer.getReticleTarget().reticleId, reticle.id);
  // The same reticle, still open there, is picked up as it was — nothing asked.
  designer.setReticleReturnToArsenal(false);
  const asked = withConfirm(false, () => fireEvent(buttons(tab, 'arsenal.editButton')[0], 'click'));
  assert.equal(asked.length, 0);
  assert.equal(designer.getReticleSession().history.present.model, 'Changed');
  assert.equal(designer.getReticleTarget().fromArsenal, true);

  withConfirm(true, () => fireEvent(byId(container, 'arsenal-add-reticle'), 'click'));
  assert.deepEqual(designer.getReticleTarget(), { reticleId: null, fromArsenal: true });
  assert.equal(designer.getReticleSession().history.present.elements.length, 0);
});

test('the scope manufacturer suggests optics makers — built-in and the user\'s scopes and reticles — never bullet makers', async () => {
  const { saveUserBullet } = await import('../src/user-library.js');
  saveUserBullet({ id: 'b1', name: 'B', manufacturer: 'Bulletco', caliberM: 0.0078, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveReticle({ manufacturer: 'Reticle Works' });
  saveUserScope(pm2({ manufacturer: 'Glassmaker' }));
  const container = mountOnScopes();
  fireEvent(byId(container, 'arsenal-add-scope'), 'click');
  await settle(60);
  const input = byId(container, 'arsenalScopeManufacturer');
  fireEvent(input, 'focus');
  const list = findAll(container, (n) => classesOf(n).includes('field-suggest-list'))[0];
  const names = list.childNodes.map((row) => row.textContent);
  for (const name of ['Glassmaker', 'Reticle Works', 'Schmidt & Bender', 'Trijicon']) assert.ok(names.includes(name), name);
  assert.ok(!names.includes('Bulletco'));
  assert.ok(!names.some((n) => /lapua|hornady|sierra/i.test(n)), 'no built-in bullet makers');
  // Picking one fills the field and clears the "required" state at once.
  fireEvent(list.childNodes[names.indexOf('Trijicon')], 'mousedown');
  assert.equal(input.value, 'Trijicon');
});

test('the Scopes tab says how much of the largest loadable file the Arsenal takes, and warns near and over it', async () => {
  const { MAX_FILE_BYTES, NEAR_FILE_LIMIT } = await import('../src/arsenal-export.js');
  const { formatBytes } = await import('../src/format-bytes.js');
  const { saveUserBullet } = await import('../src/user-library.js');
  const big = saveReticle({ model: 'Big' });
  saveReticle({ model: 'Small' });
  const sizeLine = (container) => byId(container, 'arsenal-library-size');
  const warning = (container) => findAll(sizeLine(container), (n) => classesOf(n).includes('warning'))[0];

  let container = mountOnScopes();
  assert.ok(sizeLine(container).textContent.includes(formatBytes(MAX_FILE_BYTES)));
  assert.equal(warning(container), undefined);
  const row = findAll(container, (n) => classesOf(n).includes('arsenal-reticle-row'))[0];
  assert.match(row.textContent, / · \d+(\.\d)? (B|KB)/, 'each reticle says what it takes');

  // Anything stored counts — padding a bullet stands in for a big drawing.
  const bullet = { id: 'b1', name: 'B', manufacturer: 'Bulletco', caliberM: 0.0078, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } };
  saveUserBullet({ ...bullet, padding: 'x'.repeat(Math.ceil(MAX_FILE_BYTES * NEAR_FILE_LIMIT)) });
  container = mountOnScopes();
  assert.ok(warning(container).textContent.startsWith(t('arsenal.librarySizeNear', { limit: formatBytes(MAX_FILE_BYTES) }).slice(0, 20)));
  assert.ok(warning(container).textContent.includes(big.name), 'the largest reticles are named');

  saveUserBullet({ ...bullet, padding: 'x'.repeat(MAX_FILE_BYTES) });
  container = mountOnScopes();
  assert.ok(warning(container).textContent.includes(formatBytes(MAX_FILE_BYTES)));
  assert.notEqual(warning(container).textContent.slice(0, 30), t('arsenal.librarySizeNear', {}).slice(0, 30));
});
