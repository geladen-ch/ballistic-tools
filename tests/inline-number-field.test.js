import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { setUnit, resetUnits } = await import('../src/prefs.js');
const { inlineNumberField } = await import('../src/ui/inline-number-field.js');

function findInput(node) {
  if (node.tagName === 'INPUT') return node;
  for (const child of node.childNodes || []) {
    const found = findInput(child);
    if (found) return found;
  }
  return null;
}

test.afterEach(() => resetUnits());

test('an untouched inline field returns exactly the engine value it was given', () => {
  setUnit('distance', 'yd');
  const field = inlineNumberField({ id: 'targetRange', min: 10, max: 5000, decimals: 1, value: 914.4 });
  assert.equal(findInput(field.node).value, '1000');
  assert.equal(field.getEngineValue(), 914.4);
  field.setEngineValue(500);
  assert.equal(field.getEngineValue(), 500);
});

test('peekRoundTrip compares what is on screen: a value differing only below the display rounding reads as unchanged', () => {
  setUnit('distance', 'yd');
  // e.g. a cookie from a build that stored the rounded round-trip, next to the target it came from
  const field = inlineNumberField({ id: 'targetRange', min: 10, max: 5000, decimals: 1, value: 914.3999999 });
  assert.equal(field.getEngineValue(), field.peekRoundTrip(914.4));
  assert.notEqual(field.getEngineValue(), field.peekRoundTrip(920));
});

test('a typed value converts from the display unit', () => {
  setUnit('distance', 'yd');
  const field = inlineNumberField({ id: 'targetRange', min: 10, max: 5000, decimals: 1, value: 914.4 });
  const input = findInput(field.node);
  input.value = '500';
  fireEvent(input, 'input');
  assert.ok(Math.abs(field.getEngineValue() - 457.2) < 1e-9);
});
