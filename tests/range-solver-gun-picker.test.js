import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const { mountDialogRoot, isDialogOpen } = await import('../src/ui/app-dialog.js');
const { rangeSolverGunPickerBody, openRangeSolverGunPicker } = await import('../src/ui/range-solver/gun-picker.js');
const { saveUserRifle } = await import('../src/user-library.js');
const { loadRifleState, saveRifleState, resetShotStateForTests } = await import('../src/shot-state.js');
const { registerRoute } = await import('../src/router.js');
const { setRangeSolverMode, setRangeSolverTab, getRangeSolverTab, resetRangeSolverNavForTests } = await import('../src/range-solver-nav.js');
const { resetGunsNavForTests } = await import('../src/guns-nav.js');

let dialogContainer;
let mounts = 0;
registerRoute('/range-solver', () => {
  mounts++;
  setRangeSolverMode(true);
  return () => setRangeSolverMode(false);
});

test.beforeEach(() => {
  localStorage.clear();
  resetShotStateForTests();
  resetRangeSolverNavForTests();
  resetGunsNavForTests();
  dialogContainer = makeElement('div');
  mountDialogRoot(dialogContainer);
  mounts = 0;
  location.hash = '#/range-solver';
});

function findByClass(node, cls, out = []) {
  if (typeof node.className === 'string' && node.className.split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

const rifleButton = (root, name) => findByClass(root, 'gun-picker-rifle').find((b) => b.textContent.includes(name));
const loadButtons = (root) => findByClass(root, 'gun-picker-load');

function seedRifles() {
  saveUserRifle({ id: 'r1', name: 'Single Rifle', cartridges: [{ id: 'c1', name: 'Only Load', muzzleVelocity: 800 }] });
  saveUserRifle({
    id: 'r2', name: 'Multi Rifle',
    cartridges: [{ id: 'c2', name: 'Load A', muzzleVelocity: 790 }, { id: 'c3', name: 'Load B', muzzleVelocity: 810 }]
  });
  saveUserRifle({
    id: 'r3', name: 'Other Multi',
    cartridges: [{ id: 'c4', name: 'Load C' }, { id: 'c5', name: 'Load D' }]
  });
}

test('with no rifle that has a cartridge, the body is the empty-state hint', () => {
  saveUserRifle({ id: 'r0', name: 'Empty Rifle', cartridges: [] });
  const body = rangeSolverGunPickerBody({ onPick: () => {} });
  assert.equal(body.textContent, t('rangeSolver.gunPicker.emptyHint'));
});

test('lists rifles with cartridges only, all collapsed when none is active', () => {
  seedRifles();
  saveUserRifle({ id: 'r0', name: 'Empty Rifle', cartridges: [] });
  const body = rangeSolverGunPickerBody({ onPick: () => {} });
  assert.equal(findByClass(body, 'gun-picker-rifle').length, 3);
  assert.ok(!body.textContent.includes('Empty Rifle'));
  assert.equal(loadButtons(body).length, 0);
  assert.ok(rifleButton(body, 'Single Rifle').textContent.includes('Only Load'), 'a single-cartridge rifle names its load inline');
  assert.ok(rifleButton(body, 'Multi Rifle').textContent.includes(t('rangeSolver.gunPicker.loadCount', { count: 2 })));
});

test('a single-cartridge rifle picks itself on click and closes the dialog', () => {
  seedRifles();
  let picked = null;
  openRangeSolverGunPicker();
  const body = rangeSolverGunPickerBody({ onPick: (rifleId, cartridgeId) => { picked = { rifleId, cartridgeId }; } });
  fireEvent(rifleButton(body, 'Single Rifle'), 'click');
  assert.deepEqual(picked, { rifleId: 'r1', cartridgeId: 'c1' });
  assert.equal(isDialogOpen(), false);
});

test('a multi-cartridge rifle expands its loads, collapsing any other open list', () => {
  seedRifles();
  let picked = null;
  const body = rangeSolverGunPickerBody({ onPick: () => { picked = true; } });

  fireEvent(rifleButton(body, 'Multi Rifle'), 'click');
  assert.equal(picked, null, 'expanding must not pick anything');
  assert.deepEqual(loadButtons(body).map((b) => b.textContent.includes('Load A') || b.textContent.includes('Load B')), [true, true]);
  assert.equal(rifleButton(body, 'Multi Rifle').getAttribute('aria-expanded'), 'true');

  fireEvent(rifleButton(body, 'Other Multi'), 'click');
  const loads = loadButtons(body);
  assert.equal(loads.length, 2, 'only one rifle\'s loads are ever open');
  assert.ok(loads[0].textContent.includes('Load C'));
  assert.equal(rifleButton(body, 'Multi Rifle').getAttribute('aria-expanded'), 'false');

  fireEvent(rifleButton(body, 'Other Multi'), 'click');
  assert.equal(loadButtons(body).length, 0, 'clicking the open rifle again collapses it');
});

test('clicking a load picks that rifle + load', () => {
  seedRifles();
  let picked = null;
  const body = rangeSolverGunPickerBody({ onPick: (rifleId, cartridgeId) => { picked = { rifleId, cartridgeId }; } });
  fireEvent(rifleButton(body, 'Multi Rifle'), 'click');
  fireEvent(loadButtons(body).find((b) => b.textContent.includes('Load B')), 'click');
  assert.deepEqual(picked, { rifleId: 'r2', cartridgeId: 'c3' });
});

test('the active multi-cartridge rifle opens pre-expanded with its current load marked', () => {
  seedRifles();
  saveRifleState({ library: { rifleId: 'r2', cartridgeId: 'c3' } });
  const body = rangeSolverGunPickerBody({ onPick: () => {} });
  assert.ok(rifleButton(body, 'Multi Rifle').className.includes('current'));
  const current = loadButtons(body).filter((b) => b.className.includes('current'));
  assert.equal(current.length, 1);
  assert.ok(current[0].textContent.includes('Load B'));
});

test('picking from the opened modal activates the gun and remounts the solver on the same tab', () => {
  seedRifles();
  setRangeSolverMode(true);
  setRangeSolverTab('atmosphere');
  openRangeSolverGunPicker();
  assert.equal(isDialogOpen(), true);

  fireEvent(rifleButton(dialogContainer, 'Multi Rifle'), 'click');
  fireEvent(loadButtons(dialogContainer).find((b) => b.textContent.includes('Load A')), 'click');

  assert.equal(isDialogOpen(), false);
  assert.deepEqual(loadRifleState().library, { rifleId: 'r2', cartridgeId: 'c2' });
  assert.equal(mounts, 1, 'the solver view remounts on the new gun');
  assert.equal(getRangeSolverTab(), 'atmosphere');
});

test('Cancel closes without changing anything', () => {
  seedRifles();
  saveRifleState({ library: { rifleId: 'r1', cartridgeId: 'c1' } });
  openRangeSolverGunPicker();
  const cancel = findByTag(dialogContainer, 'BUTTON').find((b) => b.textContent === t('rangeSolver.gunPicker.cancel'));
  fireEvent(cancel, 'click');
  assert.equal(isDialogOpen(), false);
  assert.deepEqual(loadRifleState().library, { rifleId: 'r1', cartridgeId: 'c1' });
  assert.equal(location.hash, '#/range-solver');
  assert.equal(mounts, 0);
});

test('Manage Arsenal closes and goes to Guns the way the old nav item did', () => {
  seedRifles();
  saveRifleState({ library: { rifleId: 'r1', cartridgeId: 'c1' } });
  openRangeSolverGunPicker();
  const manage = findByTag(dialogContainer, 'BUTTON').find((b) => b.textContent === t('rangeSolver.gunPicker.manageArsenal'));
  fireEvent(manage, 'click');
  assert.equal(isDialogOpen(), false);
  assert.equal(location.hash, '#/guns/arsenal');
});
