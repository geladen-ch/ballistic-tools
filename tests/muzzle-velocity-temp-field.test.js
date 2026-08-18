import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();

const { setUnit, resetUnits } = await import('../src/prefs.js');
const { muzzleVelocityTempField } = await import('../src/ui/muzzle-velocity-temp-field.js');

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

test('getValues() is empty (no correction applied) while the checkbox is unchecked', () => {
  const field = muzzleVelocityTempField();
  assert.deepEqual(field.getValues(), {});
});

test('details are hidden until the checkbox is checked, then revealed', () => {
  const field = muzzleVelocityTempField();
  const [checkbox] = findInputs(field.node);
  const details = field.node.childNodes[1];

  assert.equal(details.style.display, 'none');
  checkbox.checked = true;
  fireEvent(checkbox, 'change');
  assert.equal(details.style.display, '');
});

test('getValues() returns engine-unit referenceTempC and velocityTempSensitivity once enabled', () => {
  const field = muzzleVelocityTempField();
  const [checkbox, , sensitivityInput] = findInputs(field.node);
  checkbox.checked = true;
  fireEvent(checkbox, 'change');

  const values = field.getValues();
  assert.equal(values.referenceTempC, 15); // default, metric prefs
  assert.ok(Math.abs(values.velocityTempSensitivity - 1.0) < 1e-9, `expected 1.0, got ${values.velocityTempSensitivity}`);

  sensitivityInput.value = '2';
  fireEvent(sensitivityInput, 'input');
  assert.ok(Math.abs(field.getValues().velocityTempSensitivity - 2) < 1e-9);
});

test('sensitivity input round-trips correctly under imperial prefs (ft/s per °F)', () => {
  setUnit('velocity', 'ft/s');
  setUnit('temperature', 'tempF');

  const field = muzzleVelocityTempField();
  const [checkbox, , sensitivityInput] = findInputs(field.node);
  checkbox.checked = true;
  fireEvent(checkbox, 'change');

  // Default engine value is 1.0 m/s/°C; displayed value should already be
  // converted to ft/s/°F (~1.823), and reading it back should recover ~1.0.
  assert.ok(Math.abs(parseFloat(sensitivityInput.value) - 1.823) < 0.01, `displayed ${sensitivityInput.value}`);
  const values = field.getValues();
  assert.ok(Math.abs(values.velocityTempSensitivity - 1.0) < 1e-3, `round-tripped to ${values.velocityTempSensitivity}`);

  resetUnits();
});

test('lock() with temperature data checks the box, fills it in, and disables everything', () => {
  const field = muzzleVelocityTempField();
  field.lock({ referenceTempC: 10, velocityTempSensitivity: 1.5 });

  const [checkbox, referenceInput, sensitivityInput] = findInputs(field.node);
  assert.equal(checkbox.checked, true);
  assert.equal(checkbox.disabled, true);
  assert.equal(referenceInput.disabled, true);
  assert.equal(sensitivityInput.disabled, true);
  assert.equal(field.node.childNodes[1].style.display, ''); // details revealed

  const values = field.getValues();
  assert.equal(values.referenceTempC, 10);
  assert.ok(Math.abs(values.velocityTempSensitivity - 1.5) < 1e-9);
});

test('lock(null) disables everything but leaves the correction off (cartridge has no temperature data)', () => {
  const field = muzzleVelocityTempField();
  field.lock(null);

  const [checkbox, referenceInput, sensitivityInput] = findInputs(field.node);
  assert.equal(checkbox.checked, false);
  assert.equal(checkbox.disabled, true);
  assert.equal(referenceInput.disabled, true);
  assert.equal(sensitivityInput.disabled, true);
  assert.deepEqual(field.getValues(), {});
});

test('unlock() returns everything to its default, editable, unchecked state', () => {
  const field = muzzleVelocityTempField();
  field.lock({ referenceTempC: 10, velocityTempSensitivity: 1.5 });
  field.unlock();

  const [checkbox, referenceInput, sensitivityInput] = findInputs(field.node);
  assert.equal(checkbox.checked, false);
  assert.equal(checkbox.disabled, false);
  assert.equal(referenceInput.disabled, false);
  assert.equal(sensitivityInput.disabled, false);
  assert.deepEqual(field.getValues(), {});
});

test('unit suffix on the sensitivity label reflects the current velocity/temperature preferences', () => {
  setUnit('velocity', 'ft/s');
  setUnit('temperature', 'tempF');
  const field = muzzleVelocityTempField();
  const label = field.node.childNodes[1].childNodes[1].childNodes[0]; // details > sensitivity field div > label
  const suffixNode = label.childNodes[1];
  assert.equal(suffixNode.textContent, ' (ft/s/°F)');
  resetUnits();
});
