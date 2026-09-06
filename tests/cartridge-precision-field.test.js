import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const { mountDialogRoot } = await import('../src/ui/app-dialog.js');
const { cartridgePrecisionField } = await import('../src/ui/arsenal/cartridge-precision-field.js');
const {
  saveRiflePrecisionProject, resetRiflePrecisionLibraryForTests
} = await import('../src/rifle-precision-library.js');
const { generateUserId } = await import('../src/user-library.js');

let dialogRoot;
test.beforeEach(async () => {
  await resetRiflePrecisionLibraryForTests();
  dialogRoot = makeElement('div');
  mountDialogRoot(dialogRoot);
});

function findByClass(node, cls, out = []) {
  if ((node.className || '').split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

function findInputs(node, out = []) {
  if (['INPUT', 'SELECT'].includes(node.tagName)) out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

function byId(node, id) {
  return findInputs(node).find((n) => n.id === id);
}

function makeTestProject(overrides = {}) {
  return {
    id: generateUserId('rp-project'), name: 'Home Range', distanceM: 100, caliberMm: 7.62,
    targets: [], createdAt: new Date().toISOString(), ...overrides
  };
}

// >= 3 pooled shots — computeCombinedStats()'s own floor for a real R50 —
// same fixture shape rifle-precision-view.test.js's own eligibility tests use.
function makeStatsReadyTarget(overrides = {}) {
  return {
    id: generateUserId('rp-target'), name: 'Target', notes: null,
    photo: 'data:image/jpeg;base64,AAA', photoWidth: 1000, photoHeight: 800, photoFilename: null,
    calibration: { point1: { x: 0.1, y: 0.5 }, point2: { x: 0.9, y: 0.5 }, realLengthMm: 200 },
    groups: [{
      id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 },
      shots: [{ x: 0.51, y: 0.49 }, { x: 0.49, y: 0.5 }, { x: 0.5, y: 0.52 }]
    }],
    ...overrides
  };
}

function isHidden(node) {
  let n = node;
  while (n) {
    if (n.style && n.style.display === 'none') return true;
    n = n.parentNode;
  }
  return false;
}

function pickProjectButton(node) {
  return findByClass(node, 'secondary').find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.pickRiflePrecisionProjectButton');
}

test('the "Pick from a Rifle Precision project…" button only appears once the checkbox is checked', () => {
  const field = cartridgePrecisionField({});
  assert.ok(isHidden(pickProjectButton(field.node)), 'hidden while the precision checkbox is unchecked');

  byId(field.node, 'cartridgePrecisionEnabled').checked = true;
  fireEvent(byId(field.node, 'cartridgePrecisionEnabled'), 'change');
  assert.ok(!isHidden(pickProjectButton(field.node)), 'visible once checked');
});

test('opening the picker with no eligible projects shows the empty-state hint', () => {
  const field = cartridgePrecisionField({});
  byId(field.node, 'cartridgePrecisionEnabled').checked = true;
  fireEvent(byId(field.node, 'cartridgePrecisionEnabled'), 'change');

  fireEvent(pickProjectButton(field.node), 'click');

  assert.ok(dialogRoot.textContent.includes(t('arsenal.noRiflePrecisionProjectsHint')));
});

test('a project with too few shots for real stats is not offered', () => {
  saveRiflePrecisionProject(makeTestProject({ name: 'Too Few Shots' }));
  const field = cartridgePrecisionField({});
  byId(field.node, 'cartridgePrecisionEnabled').checked = true;
  fireEvent(byId(field.node, 'cartridgePrecisionEnabled'), 'change');
  fireEvent(pickProjectButton(field.node), 'click');

  assert.ok(!dialogRoot.textContent.includes('Too Few Shots'));
  assert.ok(dialogRoot.textContent.includes(t('arsenal.noRiflePrecisionProjectsHint')));
});

test('picking an eligible project fills the field as "own"/R50 mrad, overwriting whatever mode/value was there', () => {
  saveRiflePrecisionProject(makeTestProject({
    name: 'Eligible Range', distanceM: 100, targets: [makeStatsReadyTarget()]
  }));

  let fired = 0;
  const field = cartridgePrecisionField({ onInput: () => { fired++; } });
  byId(field.node, 'cartridgePrecisionEnabled').checked = true;
  fireEvent(byId(field.node, 'cartridgePrecisionEnabled'), 'change');
  byId(field.node, 'cartridgePrecisionMode').value = 'combined';
  fireEvent(byId(field.node, 'cartridgePrecisionMode'), 'change');

  fireEvent(pickProjectButton(field.node), 'click');

  assert.ok(dialogRoot.textContent.includes('Eligible Range'));
  assert.ok(dialogRoot.textContent.includes(t('riflePrecision.confidenceLabel')), 'a "Confidence:" label precedes the badge');
  const row = findByClass(dialogRoot, 'arsenal-row')[0];
  fireEvent(row, 'click');

  assert.equal(byId(field.node, 'cartridgePrecisionEnabled').checked, true);
  assert.equal(byId(field.node, 'cartridgePrecisionMode').value, 'own', 'a project is always rifle-only/bench precision, never combined');
  assert.equal(byId(field.node, 'cartridgePrecisionConvention').value, 'r50');
  assert.equal(byId(field.node, 'cartridgePrecisionUnit').value, 'mrad');
  assert.ok(parseFloat(byId(field.node, 'cartridgePrecisionValue').value) > 0);
  assert.ok(fired > 0, 'onInput must fire so the caller can react (e.g. recompute)');

  const value = field.getValue();
  assert.equal(value.mode, 'own');
  assert.ok(value.r50Mrad > 0);
});
