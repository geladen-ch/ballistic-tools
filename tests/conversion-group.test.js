import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { conversionGroup } = await import('../src/ui/unit-conversion/conversion-group.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

const RANGE_UNITS = [
  { unit: 'm', label: 'm', decimals: 1 },
  { unit: 'yd', label: 'yd', decimals: 1 },
  { unit: 'ft', label: 'ft', decimals: 0 }
];

test('editing one field recalculates every other field in the group', () => {
  const group = conversionGroup({ titleKey: 'unitConversion.range', units: RANGE_UNITS });
  const [mInput, ydInput, ftInput] = findByTag(group, 'INPUT');

  mInput.value = '100';
  fireEvent(mInput, 'input');
  assert.equal(parseFloat(ydInput.value), 109.4);
  assert.equal(parseFloat(ftInput.value), 328);

  ftInput.value = '10';
  fireEvent(ftInput, 'input');
  assert.equal(parseFloat(mInput.value), 3);
  assert.ok(Math.abs(parseFloat(ydInput.value) - 3.3) < 0.05, `yd was ${ydInput.value}`);
});

test('a blank/non-numeric intermediate value is a no-op, not a reset', () => {
  const group = conversionGroup({ titleKey: 'unitConversion.range', units: RANGE_UNITS });
  const [mInput, ydInput] = findByTag(group, 'INPUT');

  mInput.value = '100';
  fireEvent(mInput, 'input');
  assert.equal(parseFloat(ydInput.value), 109.4);

  mInput.value = '';
  fireEvent(mInput, 'input');
  assert.equal(parseFloat(ydInput.value), 109.4, 'yd should keep its last real value, not clear or reset');
});

test('seeds every field from initialValue/initialUnit at construction', () => {
  const group = conversionGroup({
    titleKey: 'unitConversion.range', units: RANGE_UNITS, initialValue: 100, initialUnit: 'm'
  });
  const [mInput, ydInput, ftInput] = findByTag(group, 'INPUT');
  assert.equal(parseFloat(mInput.value), 100);
  assert.equal(parseFloat(ydInput.value), 109.4);
  assert.equal(parseFloat(ftInput.value), 328);
});

test('handles the temperature scale offset (not just a ratio)', () => {
  const group = conversionGroup({
    titleKey: 'unitConversion.temperature',
    units: [{ unit: 'tempC', label: '°C', decimals: 1 }, { unit: 'tempF', label: '°F', decimals: 1 }]
  });
  const [cInput, fInput] = findByTag(group, 'INPUT');

  cInput.value = '20';
  fireEvent(cInput, 'input');
  assert.equal(parseFloat(fInput.value), 68);

  fInput.value = '32';
  fireEvent(fInput, 'input');
  assert.equal(parseFloat(cInput.value), 0);
});

test('reports each change via onChange as (unit, rawValue)', () => {
  const calls = [];
  const group = conversionGroup({
    titleKey: 'unitConversion.range', units: RANGE_UNITS,
    onChange: (unit, value) => calls.push([unit, value])
  });
  const [mInput] = findByTag(group, 'INPUT');
  mInput.value = '50';
  fireEvent(mInput, 'input');
  assert.deepEqual(calls, [['m', 50]]);
});
