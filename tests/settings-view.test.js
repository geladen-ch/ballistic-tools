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
const { SPIN_DRIFT_MODE_CHOICES, getSpinDriftMode, setSpinDriftMode } = await import('../src/spin-drift-prefs.js');

const DRAG_MODEL_COOKIE_NAME = 'ballistics_hidden_drag_models_v1';
const ALL_IDS = DRAG_MODELS.map((m) => m.id);
// Only G1/G7 are visible by default (see drag-model-prefs.js).
const DEFAULT_VISIBLE_IDS = ['G1', 'G7'];
const DEFAULT_HIDDEN_IDS = ALL_IDS.filter((id) => !DEFAULT_VISIBLE_IDS.includes(id));

const SPIN_DRIFT_MODE_COOKIE_NAME = 'ballistics_spin_drift_mode_v1';
const ZERO_FOR_SPIN_DRIFT_COOKIE_NAME = 'ballistics_zero_for_spin_drift_enabled_v1';

test.beforeEach(() => {
  resetDragModelPrefsForTests();
  removeCookie(DRAG_MODEL_COOKIE_NAME);
  removeCookie(SPIN_DRIFT_MODE_COOKIE_NAME);
  removeCookie(ZERO_FOR_SPIN_DRIFT_COOKIE_NAME);
});

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.childNodes || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function isHidden(node) {
  let n = node;
  while (n) {
    if (n.style && n.style.display === 'none') return true;
    n = n.parentNode;
  }
  return false;
}

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

// The spin-drift calculation method — a 3-way choice (Off / Litz /
// McCoy 4-DOF, see spin-drift-prefs.js's SPIN_DRIFT_MODE_CHOICES), not a
// checkbox, so every windage-computing view can respect exactly which
// method the user picked rather than the app silently choosing one for
// them.
test('the spin-drift-mode select offers exactly the 3 known choices, defaulting to off', () => {
  const container = makeElement('main');
  settingsView.mount(container);
  const select = findById(container, 'settings-spin-drift-mode');
  assert.ok(select, 'expected a spin-drift-mode select');
  assert.deepEqual(
    Array.from(select.childNodes).map((o) => o.value),
    SPIN_DRIFT_MODE_CHOICES.map((c) => c.value)
  );
  assert.equal(select.value, 'off');
});

test('changing the spin-drift-mode select persists the choice (cookie round trip)', () => {
  const container = makeElement('main');
  settingsView.mount(container);
  const select = findById(container, 'settings-spin-drift-mode');

  select.value = 'mccoy4dof';
  fireEvent(select, 'change');
  assert.equal(getSpinDriftMode(), 'mccoy4dof');

  settingsView.mount(container); // simulate navigating away and back
  assert.equal(findById(container, 'settings-spin-drift-mode').value, 'mccoy4dof');
});

test('the "account for spin drift when zeroing" row is hidden while the method is off, and shown for either real method', () => {
  const container = makeElement('main');
  settingsView.mount(container);
  const select = findById(container, 'settings-spin-drift-mode');
  const zeroForSpinDriftCheckbox = findById(container, 'settings-zero-for-spin-drift-enabled');

  assert.ok(isHidden(zeroForSpinDriftCheckbox), 'expected the row hidden while off');

  for (const mode of ['litz', 'mccoy4dof']) {
    select.value = mode;
    fireEvent(select, 'change');
    assert.ok(!isHidden(zeroForSpinDriftCheckbox), `expected the row shown for ${mode}`);
  }

  select.value = 'off';
  fireEvent(select, 'change');
  assert.ok(isHidden(zeroForSpinDriftCheckbox), 'expected the row hidden again once switched back to off');
});

test('a previously saved litz choice (mounted fresh) already shows the "zero for spin drift" row, not just after a live change', () => {
  setSpinDriftMode('litz');
  const container = makeElement('main');
  settingsView.mount(container);
  assert.ok(!isHidden(findById(container, 'settings-zero-for-spin-drift-enabled')));
});
