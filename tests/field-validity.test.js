import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { fieldValidity } = await import('../src/ui/field-validity.js');

test('starts pristine: no red border, no hint, even when the initial value would already fail the check', () => {
  const input = makeElement('input');
  const { hintNode } = fieldValidity(input, () => 'always invalid');

  assert.equal(input.classList.contains('field-invalid'), false);
  assert.equal(hintNode.style.display, 'none');
});

test('typing marks it dirty — an invalid value now shows the red border and the message', () => {
  const input = makeElement('input');
  input.value = 'x';
  const { hintNode } = fieldValidity(input, () => 'too small');

  fireEvent(input, 'input');

  assert.equal(input.classList.contains('field-invalid'), true);
  assert.equal(hintNode.style.display, '');
  assert.equal(hintNode.textContent, 'too small');
});

test('a message that clears on a later edit hides the hint and removes the red border', () => {
  const input = makeElement('input');
  let valid = false;
  const { hintNode } = fieldValidity(input, () => (valid ? null : 'nope'));

  fireEvent(input, 'input');
  assert.equal(input.classList.contains('field-invalid'), true);

  valid = true;
  fireEvent(input, 'input');
  assert.equal(input.classList.contains('field-invalid'), false);
  assert.equal(hintNode.style.display, 'none');
});

test('a <select> firing "change" (not "input") is tracked the same way', () => {
  const select = makeElement('select');
  const { hintNode } = fieldValidity(select, () => 'required');

  fireEvent(select, 'change');

  assert.equal(select.classList.contains('field-invalid'), true);
  assert.equal(hintNode.textContent, 'required');
});

test('validate() forces a never-touched field dirty and reports its current validity', () => {
  const input = makeElement('input');
  const { validate, hintNode } = fieldValidity(input, () => 'bad');

  // Untouched — still pristine right up until validate() is called.
  assert.equal(input.classList.contains('field-invalid'), false);

  const ok = validate();

  assert.equal(ok, false);
  assert.equal(input.classList.contains('field-invalid'), true);
  assert.equal(hintNode.style.display, '');
});

test('validate() returns true once a field is (or becomes) valid', () => {
  const input = makeElement('input');
  const { validate } = fieldValidity(input, () => null);
  assert.equal(validate(), true);
});
