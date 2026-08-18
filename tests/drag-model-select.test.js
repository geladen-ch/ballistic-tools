import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { makeElement } = await import('./helpers/fake-dom.js');
const { dragModelOptionEls, setDragModelSelectValue } = await import('../src/ui/drag-model-select.js');
const { resetDragModelPrefsForTests, setDragModelVisible } = await import('../src/drag-model-prefs.js');
const { removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_hidden_drag_models_v1';

test.beforeEach(() => {
  resetDragModelPrefsForTests();
  removeCookie(COOKIE_NAME);
});

function optionValues(select) {
  return select.childNodes.map((o) => o.attributes.value);
}

test('dragModelOptionEls() offers every visible model by default', () => {
  const values = dragModelOptionEls().map((o) => o.attributes.value);
  assert.deepEqual(values, ['G1', 'G7']);
});

test('dragModelOptionEls() drops a model hidden in Settings', () => {
  setDragModelVisible('G1', false);
  const values = dragModelOptionEls().map((o) => o.attributes.value);
  assert.deepEqual(values, ['G7']);
});

test('dragModelOptionEls(required) still includes a hidden model when it is the value being set', () => {
  setDragModelVisible('G1', false);
  const values = dragModelOptionEls('G1').map((o) => o.attributes.value);
  assert.deepEqual(values, ['G1', 'G7']);
});

test('setDragModelSelectValue selects a visible value normally', () => {
  const select = makeElement('select');
  setDragModelSelectValue(select, 'G7');
  assert.deepEqual(optionValues(select), ['G1', 'G7']);
  assert.equal(select.value, 'G7');
});

test('setDragModelSelectValue still shows and selects a hidden-but-needed value', () => {
  setDragModelVisible('G1', false);
  const select = makeElement('select');
  setDragModelSelectValue(select, 'G1');
  assert.deepEqual(optionValues(select), ['G1', 'G7']);
  assert.equal(select.value, 'G1');
});

test('setDragModelSelectValue rebuilds options on every call (no stale leftover option)', () => {
  const select = makeElement('select');
  setDragModelVisible('G1', false);
  setDragModelSelectValue(select, 'G1'); // forced in, since it's the current value
  setDragModelVisible('G1', true);
  setDragModelSelectValue(select, 'G7'); // no longer needs forcing
  assert.deepEqual(optionValues(select), ['G1', 'G7']);
  assert.equal(select.value, 'G7');
});
