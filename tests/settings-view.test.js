import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n } = await import('../src/i18n.js');
await initI18n();
const settingsView = await import('../src/views/settings-view.js');
const { DRAG_MODELS } = await import('../src/engine/drag-tables.js');
const { resetDragModelPrefsForTests } = await import('../src/drag-model-prefs.js');
const { removeCookie } = await import('../src/cookies.js');

const DRAG_MODEL_COOKIE_NAME = 'ballistics_hidden_drag_models_v1';
const ALL_IDS = DRAG_MODELS.map((m) => m.id);
// Only G1/G7 are visible by default (see drag-model-prefs.js).
const DEFAULT_VISIBLE_IDS = ['G1', 'G7'];
const DEFAULT_HIDDEN_IDS = ALL_IDS.filter((id) => !DEFAULT_VISIBLE_IDS.includes(id));

test.beforeEach(() => {
  resetDragModelPrefsForTests();
  removeCookie(DRAG_MODEL_COOKIE_NAME);
});

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT' || node.tagName === 'SELECT') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

function dragModelCheckbox(container, id) {
  return findInputs(container).find((n) => n.id === 'settings-drag-model-' + id);
}

test('renders one checkbox per known drag model; only G1/G7 checked by default', () => {
  const container = makeElement('main');
  settingsView.mount(container);
  for (const id of ALL_IDS) {
    const checkbox = dragModelCheckbox(container, id);
    assert.ok(checkbox, `expected a checkbox for ${id}`);
    assert.equal(checkbox.checked, DEFAULT_VISIBLE_IDS.includes(id), `expected ${id}'s default checked state`);
  }
});

test('unchecking one default-visible model leaves the other one checked', () => {
  const container = makeElement('main');
  settingsView.mount(container);

  const g1Checkbox = dragModelCheckbox(container, 'G1');
  g1Checkbox.checked = false;
  fireEvent(g1Checkbox, 'change');

  assert.equal(dragModelCheckbox(container, 'G1').checked, false);
  assert.equal(dragModelCheckbox(container, 'G7').checked, true);
});

test('checking a default-hidden model turns it on without disturbing G1/G7', () => {
  const container = makeElement('main');
  settingsView.mount(container);

  const g2Checkbox = dragModelCheckbox(container, 'G2');
  g2Checkbox.checked = true;
  fireEvent(g2Checkbox, 'change');

  assert.equal(dragModelCheckbox(container, 'G2').checked, true);
  assert.equal(dragModelCheckbox(container, 'G1').checked, true);
  assert.equal(dragModelCheckbox(container, 'G7').checked, true);
});

test('the sole remaining checked checkbox is disabled — the last visible model cannot be hidden', () => {
  const container = makeElement('main');
  settingsView.mount(container);

  // Uncheck every model but G7 (G1 is the only other one that starts checked).
  const g1Checkbox = dragModelCheckbox(container, 'G1');
  g1Checkbox.checked = false;
  fireEvent(g1Checkbox, 'change');

  const g7Checkbox = dragModelCheckbox(container, 'G7');
  assert.equal(g7Checkbox.checked, true);
  assert.equal(g7Checkbox.disabled, true, 'the only remaining visible model must not be uncheckable');
});

test('re-checking a hidden model re-enables the previously-sole checkbox', () => {
  const container = makeElement('main');
  settingsView.mount(container);

  const g1Checkbox = dragModelCheckbox(container, 'G1');
  g1Checkbox.checked = false;
  fireEvent(g1Checkbox, 'change');

  const g7Checkbox = dragModelCheckbox(container, 'G7');
  assert.equal(g7Checkbox.disabled, true);

  g1Checkbox.checked = true;
  fireEvent(g1Checkbox, 'change');

  assert.equal(g7Checkbox.disabled, false);
});

test('mounting again reflects a previously saved change (cookie round trip)', () => {
  const container = makeElement('main');
  settingsView.mount(container);

  const g1Checkbox = dragModelCheckbox(container, 'G1');
  g1Checkbox.checked = false;
  fireEvent(g1Checkbox, 'change');

  settingsView.mount(container); // simulate navigating away and back
  assert.equal(dragModelCheckbox(container, 'G1').checked, false);
});

test('every default-hidden model actually starts hidden', () => {
  const container = makeElement('main');
  settingsView.mount(container);
  for (const id of DEFAULT_HIDDEN_IDS) {
    assert.equal(dragModelCheckbox(container, id).checked, false, `expected ${id} to start hidden`);
  }
});
