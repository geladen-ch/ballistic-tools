import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { bulletLengthField } = await import('../src/ui/arsenal/bullet-length-field.js');
const { setUnit, resetUnits } = await import('../src/prefs.js');

function findInput(node) {
  if (node.tagName === 'INPUT') return node;
  for (const child of node.childNodes || []) {
    const found = findInput(child);
    if (found) return found;
  }
  return null;
}

test.afterEach(() => resetUnits());

test('an untouched length comes back exactly as it was set, even through an imperial display', () => {
  setUnit('smallLength', 'in');
  const field = bulletLengthField({ value: 0.0315 });
  assert.equal(findInput(field.node).value, '1.240');
  assert.equal(field.getLengthM(), 0.0315);
  field.setLengthM(0.03251);
  assert.equal(field.getLengthM(), 0.03251);
});

test('a typed length converts from the display unit to metres', () => {
  setUnit('smallLength', 'in');
  const field = bulletLengthField({ value: 0.0315 });
  const input = findInput(field.node);
  input.value = '1.25';
  fireEvent(input, 'input');
  assert.ok(Math.abs(field.getLengthM() - 0.03175) < 1e-15);
});

test('blank stays blank', () => {
  const field = bulletLengthField({});
  assert.equal(field.getLengthM(), null);
});
