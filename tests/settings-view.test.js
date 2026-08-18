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

test('renders one checkbox per known drag model, all checked (visible) by default', () => {
  const container = makeElement('main');
  settingsView.mount(container);
  for (const m of DRAG_MODELS) {
    const checkbox = dragModelCheckbox(container, m.id);
    assert.ok(checkbox, `expected a checkbox for ${m.id}`);
    assert.equal(checkbox.checked, true);
  }
});

test('unchecking one model leaves the others checked', () => {
  const container = makeElement('main');
  settingsView.mount(container);
  const [first, second] = DRAG_MODELS;

  const firstCheckbox = dragModelCheckbox(container, first.id);
  firstCheckbox.checked = false;
  fireEvent(firstCheckbox, 'change');

  assert.equal(dragModelCheckbox(container, first.id).checked, false);
  assert.equal(dragModelCheckbox(container, second.id).checked, true);
});

test('the sole remaining checked checkbox is disabled — the last visible model cannot be hidden', () => {
  const container = makeElement('main');
  settingsView.mount(container);
  const [first, second] = DRAG_MODELS;

  const firstCheckbox = dragModelCheckbox(container, first.id);
  firstCheckbox.checked = false;
  fireEvent(firstCheckbox, 'change');

  const secondCheckbox = dragModelCheckbox(container, second.id);
  assert.equal(secondCheckbox.checked, true);
  assert.equal(secondCheckbox.disabled, true, 'the only remaining visible model must not be uncheckable');
});

test('re-checking a hidden model re-enables the previously-sole checkbox', () => {
  const container = makeElement('main');
  settingsView.mount(container);
  const [first, second] = DRAG_MODELS;

  const firstCheckbox = dragModelCheckbox(container, first.id);
  firstCheckbox.checked = false;
  fireEvent(firstCheckbox, 'change');
  assert.equal(dragModelCheckbox(container, second.id).disabled, true);

  firstCheckbox.checked = true;
  fireEvent(firstCheckbox, 'change');

  assert.equal(dragModelCheckbox(container, second.id).disabled, false);
});

test('mounting again reflects a previously saved hide (cookie round trip)', () => {
  const container = makeElement('main');
  settingsView.mount(container);
  const [first] = DRAG_MODELS;

  const firstCheckbox = dragModelCheckbox(container, first.id);
  firstCheckbox.checked = false;
  fireEvent(firstCheckbox, 'change');

  settingsView.mount(container); // simulate navigating away and back
  assert.equal(dragModelCheckbox(container, first.id).checked, false);
});
