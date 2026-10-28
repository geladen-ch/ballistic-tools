import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const arsenalView = await import('../src/views/arsenal-view.js');
const { loadUserScopes, saveUserScope, loadUserRifles, saveUserRifle } = await import('../src/user-library.js');
const reticleLibrary = await import('../src/reticle-library.js');
const { setPendingArsenalTab, takePendingArsenalTab } = await import('../src/arsenal-prefill.js');
const { saveRifleState, resetShotStateForTests } = await import('../src/shot-state.js');
const { defaultScopeRecord, DEFAULT_CLICK_RAD } = await import('../src/scope-record.js');
const { createDocument } = await import('../src/reticle/model.js');
const { fieldOfViewAngle, mradToRad } = await import('../src/quantity.js');
const { resetUnits } = await import('../src/prefs.js');

test.beforeEach(async () => {
  localStorage.clear();
  resetUnits();
  resetShotStateForTests();
  arsenalView.resetArsenalTabForTests();
  takePendingArsenalTab();
  await reticleLibrary.resetReticleLibraryForTests();
});

const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));
function findAll(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  for (const child of node.childNodes || []) findAll(child, predicate, out);
  return out;
}
const byId = (root, id) => findAll(root, (n) => n.id === id)[0];
const buttons = (root, key) => findAll(root, (n) => n.tagName === 'BUTTON' && n.textContent === t(key));
function choose(root, id, value) {
  const select = byId(root, id);
  select.value = value;
  fireEvent(select, 'change');
}
function type(root, id, value) {
  const input = byId(root, id);
  input.value = String(value);
  fireEvent(input, 'input');
}
function withConfirm(answer, fn) {
  const saved = global.confirm;
  const asked = [];
  global.confirm = (message) => { asked.push(message); return answer; };
  try { fn(); } finally { global.confirm = saved; }
  return asked;
}
const optionValues = (select) => findAll(select, (n) => n.tagName === 'OPTION').map((o) => o.value);
const option = (select, value) => findAll(select, (n) => n.tagName === 'OPTION' && n.value === value)[0];

function reticle(id, model) {
  return reticleLibrary.saveUserReticle({ ...createDocument(), id, manufacturer: 'Acme', model });
}
function scope(overrides = {}) {
  return saveUserScope({
    ...defaultScopeRecord(), id: 'user-scope-1', manufacturer: 'Acme', model: '5-25x56', reticleIds: ['user-reticle-1'],
    fovMaxRad: fieldOfViewAngle(7.5, 100), fovMinRad: fieldOfViewAngle(1.5, 100),
    clickUnit: 'arcmin', clickHorizontalRad: DEFAULT_CLICK_RAD.arcmin, clickVerticalRad: DEFAULT_CLICK_RAD.arcmin,
    ...overrides
  });
}
function rifle(overrides = {}) {
  return saveUserRifle({
    id: 'user-rifle-1', name: 'My Rifle', defaultSightHeightM: 0.05, defaultZeroRangeM: 100, defaultTwistDirection: 'right',
    defaultClickUnit: 'mrad', defaultClickHorizontalRad: mradToRad(0.1), defaultClickVerticalRad: mradToRad(0.1), source: '', cartridges: [],
    ...overrides
  });
}
// The Arsenal with `rifleId` active (its Edit button is in the Active rifle pane).
async function mountWithActive(rifleId) {
  if (rifleId) saveRifleState({ library: { rifleId, cartridgeId: null } });
  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();
  return container;
}
function editActiveRifle(container) {
  fireEvent(buttons(byId(container, 'arsenal-tab-rifles'), 'arsenal.editButton')[0], 'click');
}
const saveRifle = (container) => fireEvent(buttons(container, 'arsenal.saveRifleButton')[0], 'click');

test('the rifle\'s scope: none by default; the user\'s scopes, then the built-in ones; a scope without a reticle can\'t be picked', async () => {
  reticle('user-reticle-1', 'Dot');
  scope();
  scope({ id: 'user-scope-bare', model: 'Bare', reticleIds: [] });
  rifle();
  const container = await mountWithActive('user-rifle-1');
  editActiveRifle(container);
  const select = byId(container, 'arsenalRifleScope');
  assert.equal(select.value, '');
  assert.deepEqual(optionValues(select), ['', 'user-scope-1', 'user-scope-bare', 'sb-pm2-3-20x50', 'sb-cm2-6-36x56', 'trijicon-acog-4x32-rco-m4']);
  assert.equal(option(select, 'user-scope-bare').disabled, true);
  assert.equal(byId(container, 'arsenalRifleReticle').parentNode.style.display, 'none', 'no reticle choice to make');
});

test('linking a scope copies its click unit and values into the rifle, kept exact; edited afterwards, the scope is not changed', async () => {
  reticle('user-reticle-1', 'Dot');
  scope();
  rifle();
  const container = await mountWithActive('user-rifle-1');
  editActiveRifle(container);
  choose(container, 'arsenalRifleScope', 'user-scope-1');
  assert.equal(byId(container, 'arsenalRifleClickUnit').value, 'arcmin');
  assert.equal(byId(container, 'arsenalRifleClickHorizontal').value, '0.25');
  saveRifle(container);
  let saved = loadUserRifles()[0];
  assert.deepEqual([saved.scopeId, saved.reticleId], ['user-scope-1', 'user-reticle-1']);
  assert.equal(saved.defaultClickUnit, 'arcmin');
  assert.equal(saved.defaultClickHorizontalRad, DEFAULT_CLICK_RAD.arcmin);
  assert.ok(byId(container, 'arsenal-tab-rifles').textContent.includes(t('arsenal.rifleScopeLine', { name: 'Acme 5-25x56' })));

  // The rifle's clicks are its own from here on.
  editActiveRifle(container);
  type(container, 'arsenalRifleClickVertical', 0.5);
  saveRifle(container);
  saved = loadUserRifles()[0];
  assert.ok(Math.abs(saved.defaultClickVerticalRad - 2 * DEFAULT_CLICK_RAD.arcmin) < 1e-15);
  assert.equal(loadUserScopes()[0].clickVerticalRad, DEFAULT_CLICK_RAD.arcmin, 'never written back');
  assert.equal(saved.scopeId, 'user-scope-1', 'reopening keeps the link without recopying');

  // None unlinks it, the clicks staying.
  editActiveRifle(container);
  choose(container, 'arsenalRifleScope', '');
  saveRifle(container);
  saved = loadUserRifles()[0];
  assert.deepEqual([saved.scopeId, saved.reticleId], [null, null]);
  assert.equal(saved.defaultClickUnit, 'arcmin');
});

test('a built-in scope is linked by its id, never copied into the Arsenal', async () => {
  rifle();
  const container = await mountWithActive('user-rifle-1');
  editActiveRifle(container);
  choose(container, 'arsenalRifleScope', 'trijicon-acog-4x32-rco-m4');
  saveRifle(container);
  const saved = loadUserRifles()[0];
  assert.deepEqual([saved.scopeId, saved.reticleId], ['trijicon-acog-4x32-rco-m4', 'trijicon-rco-m4-chevron']);
  assert.equal(saved.defaultClickUnit, 'arcmin');
  assert.deepEqual(loadUserScopes(), []);
  assert.ok(byId(container, 'arsenal-tab-rifles').textContent.includes('Trijicon ACOG 4x32 USMC RCO M4/M4A1'));
});

test('a scope with several reticles asks which one; the choice is saved and shown', async () => {
  reticle('user-reticle-1', 'Dot');
  reticle('user-reticle-2', 'Tree');
  scope({ reticleIds: ['user-reticle-1', 'user-reticle-2'] });
  rifle();
  const container = await mountWithActive('user-rifle-1');
  editActiveRifle(container);
  choose(container, 'arsenalRifleScope', 'user-scope-1');
  const reticles = byId(container, 'arsenalRifleReticle');
  assert.equal(reticles.parentNode.style.display, '');
  assert.deepEqual(optionValues(reticles), ['user-reticle-1', 'user-reticle-2']);
  choose(container, 'arsenalRifleReticle', 'user-reticle-2');
  saveRifle(container);
  assert.equal(loadUserRifles()[0].reticleId, 'user-reticle-2');
  assert.ok(byId(container, 'arsenal-tab-rifles').textContent.includes(t('arsenal.rifleScopeLine', { name: 'Acme 5-25x56 — Acme Tree' })));
});

test('a scope the rifle names but this device doesn\'t have stays named, and saving keeps the link', async () => {
  rifle({ scopeId: 'user-scope-elsewhere', reticleId: 'user-reticle-elsewhere' });
  const container = await mountWithActive('user-rifle-1');
  assert.ok(byId(container, 'arsenal-tab-rifles').textContent.includes(t('arsenal.rifleScopeLine', { name: t('arsenal.scopeMissing') })));
  editActiveRifle(container);
  assert.equal(byId(container, 'arsenalRifleScope').value, 'user-scope-elsewhere');
  saveRifle(container);
  assert.deepEqual([loadUserRifles()[0].scopeId, loadUserRifles()[0].reticleId], ['user-scope-elsewhere', 'user-reticle-elsewhere']);
});

test('deleting a scope says how many rifles use it and unlinks them, their clicks kept', async () => {
  reticle('user-reticle-1', 'Dot');
  scope();
  rifle({ scopeId: 'user-scope-1', reticleId: 'user-reticle-1', defaultClickUnit: 'arcmin', defaultClickHorizontalRad: DEFAULT_CLICK_RAD.arcmin });
  setPendingArsenalTab('scopes');
  const container = await mountWithActive();
  const tab = byId(container, 'arsenal-tab-scopes');
  const asked = withConfirm(true, () => fireEvent(buttons(findAll(tab, (n) => (n.className || '').includes('arsenal-row'))[0], 'arsenal.deleteButton')[0], 'click'));
  assert.equal(asked[0], t('arsenal.confirmDeleteScopeWithRifles', { name: 'Acme 5-25x56', count: 1 }));
  const [saved] = loadUserRifles();
  assert.deepEqual([saved.scopeId, saved.reticleId, saved.defaultClickUnit], [null, null, 'arcmin']);
});

test('deleting a reticle moves a rifle to its scope\'s only remaining reticle; with several left, to none until picked', async () => {
  reticle('user-reticle-1', 'Dot');
  reticle('user-reticle-2', 'Tree');
  reticle('user-reticle-3', 'Duplex');
  scope({ reticleIds: ['user-reticle-1', 'user-reticle-2'] });
  scope({ id: 'user-scope-2', model: 'Other', reticleIds: ['user-reticle-1', 'user-reticle-2', 'user-reticle-3'] });
  rifle({ scopeId: 'user-scope-1', reticleId: 'user-reticle-1' });
  rifle({ id: 'user-rifle-2', name: 'Second', scopeId: 'user-scope-2', reticleId: 'user-reticle-1' });
  setPendingArsenalTab('scopes');
  const container = await mountWithActive();
  const row = findAll(byId(container, 'arsenal-tab-scopes'), (n) => (n.className || '').includes('arsenal-reticle-row') && n.textContent.includes('Acme Dot'))[0];
  withConfirm(true, () => fireEvent(buttons(row, 'arsenal.deleteButton')[0], 'click'));
  const byRifle = Object.fromEntries(loadUserRifles().map((r) => [r.id, r.reticleId]));
  assert.deepEqual(byRifle, { 'user-rifle-1': 'user-reticle-2', 'user-rifle-2': null });
});

test('a scope saved over another\'s name takes the rifles of the one it replaced', async () => {
  reticle('user-reticle-1', 'Dot');
  scope();
  scope({ id: 'user-scope-2', model: 'Other' });
  rifle({ scopeId: 'user-scope-2', reticleId: 'user-reticle-1' });
  setPendingArsenalTab('scopes');
  const container = await mountWithActive();
  const tab = byId(container, 'arsenal-tab-scopes');
  const otherRow = findAll(tab, (n) => (n.className || '').split(' ').includes('arsenal-row') && n.textContent.includes('Acme Other'))[0];
  fireEvent(buttons(otherRow, 'arsenal.editButton')[0], 'click');
  type(container, 'arsenalScopeModel', '5-25x56');
  fireEvent(buttons(container, 'arsenal.saveScopeButton')[0], 'click');
  assert.deepEqual(loadUserScopes().map((s) => s.id), ['user-scope-1']);
  assert.equal(loadUserRifles()[0].scopeId, 'user-scope-1');
});

test('taking a reticle off a scope moves its rifles off it too', async () => {
  reticle('user-reticle-1', 'Dot');
  reticle('user-reticle-2', 'Tree');
  scope({ reticleIds: ['user-reticle-1', 'user-reticle-2'] });
  rifle({ scopeId: 'user-scope-1', reticleId: 'user-reticle-2' });
  setPendingArsenalTab('scopes');
  const container = await mountWithActive();
  fireEvent(buttons(byId(container, 'arsenal-tab-scopes'), 'arsenal.editButton')[0], 'click');
  const box = byId(container, 'arsenalScopeReticle-user-reticle-2');
  box.checked = false;
  fireEvent(box, 'change');
  fireEvent(buttons(container, 'arsenal.saveScopeButton')[0], 'click');
  assert.equal(loadUserRifles()[0].reticleId, 'user-reticle-1');
});
