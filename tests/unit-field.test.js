import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();

const { setUnit, resetUnits } = await import('../src/prefs.js');
const { unitField } = await import('../src/ui/unit-field.js');

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('slider field displays and round-trips a non-metric preferred unit', () => {
  setUnit('velocity', 'ft/s');
  const field = unitField({ id: 'muzzleVelocity', min: 200, max: 1200, step: 1, value: 840, slider: true });

  const [range, number] = findInputs(field.node);
  assert.equal(range.tagName, 'INPUT');
  assert.ok(Math.abs(parseFloat(range.value) - 2755.9) < 1, `range.value was ${range.value}`);
  assert.equal(number.value, range.value);

  // simulate typing a new value into the number box
  number.value = '2000';
  fireEvent(number, 'input');
  assert.equal(range.value, '2000', 'typing into the number box should mirror onto the slider');

  const engineValue = field.getEngineValue();
  assert.ok(Math.abs(engineValue - 609.6) < 0.5, `expected ~609.6 m/s, got ${engineValue}`);

  resetUnits();
});

test('slider field mirrors slider drags onto the number box', () => {
  resetUnits();
  const field = unitField({ id: 'maxRange', min: 100, max: 2000, step: 10, value: 1000, slider: true });
  const [range, number] = findInputs(field.node);

  range.value = '1500';
  fireEvent(range, 'input');
  assert.equal(number.value, '1500');
  assert.equal(field.getEngineValue(), 1500);
});

test('temperature step size converts without the point offset leaking in', () => {
  setUnit('temperature', 'tempF');
  const field = unitField({ id: 'tempC', min: -30, max: 45, step: 1, value: 15, slider: true });
  const [range] = findInputs(field.node);
  assert.ok(Math.abs(parseFloat(range.step) - 1.8) < 1e-6, `step was ${range.step}`);
  assert.ok(Math.abs(parseFloat(range.value) - 59) < 0.1);
  resetUnits();
});

test('a dimensionless field (no FIELD_UNITS entry) passes through unconverted', () => {
  const field = unitField({ id: 'bc', min: 0.1, max: 1.0, step: 0.001, value: 0.475, slider: true });
  const [range] = findInputs(field.node);
  assert.equal(range.value, '0.475');
  assert.equal(field.getEngineValue(), 0.475);
});

test('non-slider number field builds a single input with no stray "undefined" class', () => {
  const field = unitField({ id: 'v1', value: 880, step: 0.1 });
  const [number] = findInputs(field.node);
  assert.equal(number.className, ''); // regression check for the class:undefined -> "undefined" bug
  assert.equal(number.value, '880');
});

test('field label is translated from "fields.<id>" and carries a derived, stable id', () => {
  const field = unitField({ id: 'muzzleVelocity', min: 200, max: 1200, step: 1, value: 840, slider: true });
  const [labelSpan] = findByTag(field.node, 'SPAN');
  assert.equal(labelSpan.textContent, 'Muzzle velocity');
  assert.equal(labelSpan.id, 'i18n-fields-muzzleVelocity');
  assert.equal(labelSpan.getAttribute('data-i18n'), 'fields.muzzleVelocity');
});

test('setEngineValue writes a converted display value without firing onInput', () => {
  setUnit('velocity', 'ft/s');
  let inputFired = false;
  const field = unitField({ id: 'muzzleVelocity', min: 200, max: 1200, step: 1, value: 840, onInput: () => { inputFired = true; } });
  field.setEngineValue(792);
  const [number] = findInputs(field.node);
  assert.ok(Math.abs(parseFloat(number.value) - 2598.4) < 1, `number.value was ${number.value}`);
  assert.equal(inputFired, false);
  assert.ok(Math.abs(field.getEngineValue() - 792) < 0.5);
  resetUnits();
});

test('setEngineValue updates both the range and its paired number box in slider mode', () => {
  const field = unitField({ id: 'maxRange', min: 100, max: 2000, step: 10, value: 1000, slider: true });
  field.setEngineValue(1500);
  const [range, number] = findInputs(field.node);
  assert.equal(range.value, '1500');
  assert.equal(number.value, '1500');
});

test('optional: true starts blank when value is null, and getEngineValue() reports null rather than NaN', () => {
  const field = unitField({ id: 'sightHeight', min: 0, max: 100, step: 1, value: null, optional: true });
  const [number] = findInputs(field.node);
  assert.equal(number.value, '');
  assert.equal(field.getEngineValue(), null);
});

test('optional: true still displays and round-trips a real value normally', () => {
  const field = unitField({ id: 'sightHeight', min: 0, max: 100, step: 1, value: 45, optional: true });
  const [number] = findInputs(field.node);
  assert.equal(number.value, '45');
  assert.equal(field.getEngineValue(), 45);

  number.value = '60';
  fireEvent(number, 'input');
  assert.equal(field.getEngineValue(), 60);
});

test('optional: true — setEngineValue(null) clears the field back to blank', () => {
  const field = unitField({ id: 'sightHeight', min: 0, max: 100, step: 1, value: 45, optional: true });
  field.setEngineValue(null);
  const [number] = findInputs(field.node);
  assert.equal(number.value, '');
  assert.equal(field.getEngineValue(), null);
});

test('optional: true — a value of 0 is a real value, not treated as blank', () => {
  const field = unitField({ id: 'sightHeight', min: 0, max: 100, step: 1, value: 0, optional: true });
  const [number] = findInputs(field.node);
  assert.equal(number.value, '0');
  assert.equal(field.getEngineValue(), 0);
});

test('regression: non-slider mode does not fire onInput for a blank/invalid value (was: fired with NaN)', () => {
  let calls = 0;
  const field = unitField({ id: 'maxRange', min: 100, max: 2000, step: 10, value: 1000, onInput: () => { calls++; } });
  const [number] = findInputs(field.node);

  number.value = ''; // what <input type=number> reports mid-edit (e.g. text selected and retyped)
  fireEvent(number, 'input');
  assert.equal(calls, 0, 'onInput should not fire for a blank, non-optional field');

  number.value = '1500';
  fireEvent(number, 'input');
  assert.equal(calls, 1);
  assert.equal(field.getEngineValue(), 1500);
});

test('regression: non-slider optional field still fires onInput on blank (a legitimate "unset" state)', () => {
  let calls = 0;
  const field = unitField({ id: 'sightHeight', min: 0, max: 100, step: 1, value: 45, optional: true, onInput: () => { calls++; } });
  const [number] = findInputs(field.node);

  number.value = '';
  fireEvent(number, 'input');
  assert.equal(calls, 1, 'a blank optional field is a real, propagate-worthy state');
  assert.equal(field.getEngineValue(), null);
});

test('setDisabled(true) disables the number input (and the range, in slider mode)', () => {
  const field = unitField({ id: 'maxRange', min: 100, max: 2000, step: 10, value: 1000, slider: true });
  field.setDisabled(true);
  const [range, number] = findInputs(field.node);
  assert.equal(range.disabled, true);
  assert.equal(number.disabled, true);
  field.setDisabled(false);
  assert.equal(range.disabled, false);
  assert.equal(number.disabled, false);
});

// ---- Live validation (src/ui/field-validity.js) ----

test('typing an out-of-range value shows the red border and an "allowed range" hint, live', () => {
  const field = unitField({ id: 'muzzleVelocity', min: 50, max: 1500, step: 1, value: 800 });
  const [number] = findInputs(field.node);

  number.value = '30';
  fireEvent(number, 'input');

  assert.equal(number.classList.contains('field-invalid'), true);
  const hint = findByTag(field.node, 'P').find((p) => p.className.includes('warning'));
  assert.ok(hint && hint.textContent.includes('50') && hint.textContent.includes('1500'));

  number.value = '800';
  fireEvent(number, 'input');
  assert.equal(number.classList.contains('field-invalid'), false);
});

test('a blank non-optional field is invalid once touched; a blank optional field never is', () => {
  const required = unitField({ id: 'zeroRange', min: 0, max: 5000, step: 5, value: 100 });
  const [requiredInput] = findInputs(required.node);
  requiredInput.value = '';
  fireEvent(requiredInput, 'input');
  assert.equal(requiredInput.classList.contains('field-invalid'), true);

  const optional = unitField({ id: 'riflingTwist', min: 1, max: 1000, step: 1, value: 250, optional: true });
  const [optionalInput] = findInputs(optional.node);
  optionalInput.value = '';
  fireEvent(optionalInput, 'input');
  assert.equal(optionalInput.classList.contains('field-invalid'), false);
});

test('a field is pristine (no red border) on a freshly-built, never-touched instance, even with a bad initial value', () => {
  const field = unitField({ id: 'muzzleVelocity', min: 50, max: 1500, step: 1, value: 9999 });
  const [number] = findInputs(field.node);
  assert.equal(number.classList.contains('field-invalid'), false);
});

test('validate() forces a never-touched field dirty, revealing the violation, and returns its validity', () => {
  const field = unitField({ id: 'muzzleVelocity', min: 50, max: 1500, step: 1, value: 9999 });
  const [number] = findInputs(field.node);
  assert.equal(field.validate(), false);
  assert.equal(number.classList.contains('field-invalid'), true);

  const validField = unitField({ id: 'muzzleVelocity', min: 50, max: 1500, step: 1, value: 800 });
  assert.equal(validField.validate(), true);
});

test('extraCheck runs after the plain min/max check passes, and can fail on its own', () => {
  let otherValue = 100;
  const field = unitField({
    id: 'rangeStep', min: 1, max: 500, step: 1, value: 50,
    extraCheck: (v) => (v > otherValue ? 'too big' : null)
  });
  const [number] = findInputs(field.node);

  number.value = '150';
  fireEvent(number, 'input');
  assert.equal(number.classList.contains('field-invalid'), true, 'exceeds otherValue (100)');

  otherValue = 200;
  number.value = '150'; // re-fire on the same value, same idea as a sibling field's own onInput re-validating
  fireEvent(number, 'input');
  assert.equal(number.classList.contains('field-invalid'), false);
});

test('slider mode reflects a range drag onto the validation state even though it never fires a native input event on the number box', () => {
  const field = unitField({ id: 'muzzleVelocity', min: 50, max: 1500, step: 1, value: 800, slider: true });
  // In slider mode the editable number box lives inside the <label> (see
  // unit-field.js's own labelChildren), so a depth-first scan finds it
  // *before* the range sibling — this is the box fieldValidity() is
  // actually attached to, regardless of which the field's own internal
  // closures happen to call "number" vs. "range".
  const [number, range] = findInputs(field.node);

  range.value = '30';
  fireEvent(range, 'input');

  assert.equal(number.classList.contains('field-invalid'), true);
});
