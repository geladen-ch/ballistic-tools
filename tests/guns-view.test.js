import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
await warmCatalogs();

const gunsView = await import('../src/views/guns-view.js');
const { resetShotStateForTests } = await import('../src/shot-state.js');
const { isInGunsMode, resetGunsNavForTests, setGunsReturnPath, takeGunsReturnPath } = await import('../src/guns-nav.js');
const { takePendingRiflePrefill, takePendingBulletPrefill } = await import('../src/arsenal-prefill.js');

test.beforeEach(() => {
  localStorage.clear();
  resetShotStateForTests();
  resetGunsNavForTests();
  location.hash = '';
});

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.childNodes || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

test('the Custom tab renders the rifle+cartridge picker (built-in/Arsenal/manual, same as Trajectory used to embed)', () => {
  const container = makeElement('main');
  gunsView.mount(container, 'custom');

  assert.ok(findById(container, 'rifleSelect'));
  assert.ok(findById(container, 'zeroRange'));
  assert.ok(findById(container, 'bulletSelect'));
  assert.ok(findById(container, 'add-rifle-to-arsenal'));
  assert.ok(findById(container, 'add-bullet-to-arsenal'));
});

test('the Arsenal tab renders the Arsenal page itself', () => {
  const container = makeElement('main');
  gunsView.mount(container, 'arsenal');

  assert.ok(findById(container, 'arsenal-add-rifle'), 'expected Arsenal\'s own "+ Add Rifle" button');
});

test('mounting either tab turns on Guns mode; the returned cleanup turns it back off', () => {
  const container = makeElement('main');
  const cleanup = gunsView.mount(container, 'custom');
  assert.equal(isInGunsMode(), true);

  cleanup();
  assert.equal(isInGunsMode(), false);
});

test('"Add rifle to arsenal" on the Custom tab jumps to Guns\' own Arsenal tab, not #/arsenal', () => {
  const container = makeElement('main');
  gunsView.mount(container, 'custom');

  const zeroRangeInput = findById(container, 'zeroRange');
  zeroRangeInput.value = '250';
  fireEvent(zeroRangeInput, 'input');

  location.hash = '#/guns/custom';
  fireEvent(findById(container, 'add-rifle-to-arsenal'), 'click');

  assert.equal(location.hash, '#/guns/arsenal');
  const prefill = takePendingRiflePrefill();
  assert.ok(prefill);
  assert.equal(prefill.defaultZeroRangeM, 250);
});

test('"Add bullet to arsenal" on the Custom tab jumps to Guns\' own Arsenal tab', () => {
  const container = makeElement('main');
  gunsView.mount(container, 'custom');

  const bcInput = findById(container, 'bc');
  bcInput.value = '0.55';
  fireEvent(bcInput, 'input');

  location.hash = '#/guns/custom';
  fireEvent(findById(container, 'add-bullet-to-arsenal'), 'click');

  assert.equal(location.hash, '#/guns/arsenal');
  const prefill = takePendingBulletPrefill();
  assert.equal(prefill.bc, 0.55);
  // dragModel/massKg were never touched, only bc — so they reflect the
  // default, now GP11's G7/0.0113 (see bullet-section.js).
  assert.equal(prefill.dragModel, 'G7');
  assert.ok(Math.abs(prefill.massKg - 0.0113) < 1e-9);
});

test('"Add rifle/bullet to arsenal" never touches the Guns return path — moving within Guns, not entering it fresh', () => {
  setGunsReturnPath('/hit-probability');
  const container = makeElement('main');
  gunsView.mount(container, 'custom');

  fireEvent(findById(container, 'add-rifle-to-arsenal'), 'click');

  // Still there, untouched — a real Done click (tested via nav-rail/
  // nav-tabbar) is what should eventually consume it.
  assert.equal(takeGunsReturnPath('/trajectory'), '/hit-probability');
});
