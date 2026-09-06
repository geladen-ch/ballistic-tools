import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const { mountDialogRoot } = await import('../src/ui/app-dialog.js');
const { rifleCartridgePickerBody } = await import('../src/ui/rifle-cartridge-picker.js');
const { saveUserRifle, generateUserId } = await import('../src/user-library.js');

test.beforeEach(() => {
  localStorage.clear();
  mountDialogRoot(makeElement('div'));
});

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('no rifles with cartridges shows the empty-state hint, not a list', () => {
  const body = rifleCartridgePickerBody({ onPick: () => {} });
  assert.equal(body.textContent, t('riflePrecision.noArsenalCartridgesHint'));
});

test('a rifle with zero cartridges is excluded — nothing useful to pick there', () => {
  saveUserRifle({ id: generateUserId('user-rifle'), name: 'Empty Rifle', cartridges: [] });
  const body = rifleCartridgePickerBody({ onPick: () => {} });
  assert.equal(body.textContent, t('riflePrecision.noArsenalCartridgesHint'));
});

test('renders one row per rifle, each with a cartridge select defaulting to the first cartridge', () => {
  saveUserRifle({
    id: 'r1', name: 'Rifle One',
    cartridges: [{ id: 'c1', name: 'Cartridge A' }, { id: 'c2', name: 'Cartridge B' }]
  });
  saveUserRifle({ id: 'r2', name: 'Rifle Two', cartridges: [{ id: 'c3', name: 'Cartridge C' }] });

  const body = rifleCartridgePickerBody({ onPick: () => {} });
  const selects = findByTag(body, 'SELECT');
  assert.equal(selects.length, 2);
  assert.equal(selects[0].value, 'c1');
  assert.equal(selects[1].value, 'c3');
  assert.ok(body.textContent.includes('Rifle One'));
  assert.ok(body.textContent.includes('Rifle Two'));
});

test('clicking a row hides the dialog and reports that row\'s currently-selected cartridge', () => {
  saveUserRifle({
    id: 'r1', name: 'Rifle One',
    cartridges: [{ id: 'c1', name: 'Cartridge A' }, { id: 'c2', name: 'Cartridge B' }]
  });

  let picked = null;
  const body = rifleCartridgePickerBody({ onPick: (rifleId, cartridgeId) => { picked = { rifleId, cartridgeId }; } });
  const select = findByTag(body, 'SELECT')[0];
  select.value = 'c2';

  const row = body.childNodes[0];
  fireEvent(row, 'click');

  assert.deepEqual(picked, { rifleId: 'r1', cartridgeId: 'c2' });
});

test('clicking the cartridge select itself does not pick the row', () => {
  saveUserRifle({
    id: 'r1', name: 'Rifle One',
    cartridges: [{ id: 'c1', name: 'Cartridge A' }]
  });

  let picked = false;
  const body = rifleCartridgePickerBody({ onPick: () => { picked = true; } });
  const select = findByTag(body, 'SELECT')[0];
  fireEvent(select, 'click');

  assert.equal(picked, false);
});
