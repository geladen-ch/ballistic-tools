import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();

const { scopeClicksField } = await import('../src/ui/scope-clicks-field.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('defaults to mrad with a 0.1 click value for both axes', () => {
  const field = scopeClicksField();
  const settings = field.getSettings();
  assert.equal(settings.unit, 'mrad');
  assert.equal(settings.horizontal, 0.1);
  assert.equal(settings.vertical, 0.1);
});

test('offers exactly mrad and MOA as choices', () => {
  const field = scopeClicksField();
  const [select] = findByTag(field.node, 'SELECT');
  const values = select.childNodes.map((o) => o.attributes.value);
  assert.deepEqual(values, ['mrad', 'arcmin']);
});

test('typed values are read back verbatim in the currently selected unit', () => {
  const field = scopeClicksField();
  const inputs = findByTag(field.node, 'INPUT');
  const [horizontalInput, verticalInput] = inputs;
  horizontalInput.value = '0.25';
  verticalInput.value = '0.2';
  fireEvent(horizontalInput, 'input');
  fireEvent(verticalInput, 'input');

  const settings = field.getSettings();
  assert.equal(settings.horizontal, 0.25);
  assert.equal(settings.vertical, 0.2);
});

test('switching the shared unit converts both values, preserving the physical click size', () => {
  const field = scopeClicksField(); // starts at 0.1 mrad / 0.1 mrad
  const [select] = findByTag(field.node, 'SELECT');

  select.value = 'arcmin';
  fireEvent(select, 'change');

  const settings = field.getSettings();
  assert.equal(settings.unit, 'arcmin');
  // 0.1 mrad ~= 0.3438 MOA
  assert.ok(Math.abs(settings.horizontal - 0.344) < 0.001, `got ${settings.horizontal}`);
  assert.ok(Math.abs(settings.vertical - 0.344) < 0.001, `got ${settings.vertical}`);

  // switching back should recover ~0.1 mrad (within display rounding)
  select.value = 'mrad';
  fireEvent(select, 'change');
  assert.ok(Math.abs(field.getSettings().horizontal - 0.1) < 0.001);
});

test('setSettings writes unit/horizontal/vertical without firing onInput', () => {
  let calls = 0;
  const field = scopeClicksField({ onInput: () => calls++ });
  field.setSettings({ unit: 'arcmin', horizontal: 0.25, vertical: 0.5 });

  assert.deepEqual(field.getSettings(), { unit: 'arcmin', horizontal: 0.25, vertical: 0.5 });
  assert.equal(calls, 0);

  const [select] = findByTag(field.node, 'SELECT');
  assert.equal(select.value, 'arcmin');
});

test('a value set via setSettings converts correctly if the unit is switched afterward', () => {
  const field = scopeClicksField();
  field.setSettings({ unit: 'mrad', horizontal: 0.2, vertical: 0.2 });

  const [select] = findByTag(field.node, 'SELECT');
  select.value = 'arcmin';
  fireEvent(select, 'change');

  // 0.2 mrad ~= 0.6876 MOA
  assert.ok(Math.abs(field.getSettings().horizontal - 0.688) < 0.001);
});

test('regression: an emptied input does not fire onInput and getSettings() falls back to the last real value instead of NaN', () => {
  let calls = 0;
  const field = scopeClicksField({ onInput: () => calls++ });
  const [horizontalInput] = findByTag(field.node, 'INPUT');

  horizontalInput.value = '0.3';
  fireEvent(horizontalInput, 'input');
  assert.equal(calls, 1);

  // <input type=number> reports '' for a transient invalid/mid-edit state
  // (e.g. text selected and retyped) — this used to leak straight into
  // getSettings() as NaN and get persisted to a cookie (see
  // rifle-section.js's saveManualRifle()), permanently zeroing the user's
  // remembered click value on the next reload.
  horizontalInput.value = '';
  fireEvent(horizontalInput, 'input');
  assert.equal(calls, 1, 'onInput should not fire for a blank value');
  assert.equal(field.getSettings().horizontal, 0.3, 'getSettings() should fall back to the last real value, not NaN');

  horizontalInput.value = '0.4';
  fireEvent(horizontalInput, 'input');
  assert.equal(calls, 2);
  assert.equal(field.getSettings().horizontal, 0.4);
});

test('onInput fires on both a typed value and a unit switch', () => {
  let calls = 0;
  const field = scopeClicksField({ onInput: () => calls++ });
  const [select] = findByTag(field.node, 'SELECT');
  const [horizontalInput] = findByTag(field.node, 'INPUT');

  fireEvent(horizontalInput, 'input');
  assert.equal(calls, 1);

  select.value = 'arcmin';
  fireEvent(select, 'change');
  assert.equal(calls, 2);
});
