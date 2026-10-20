import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { formatQuantity, toFixedDisplay, toDisplayUnit, fromDisplayUnit, displayChoice } = await import('../src/display-units.js');
const { setUnit, resetUnits } = await import('../src/prefs.js');

test.afterEach(() => resetUnits());

test('a tiny negative residue never prints as "-0.00"', () => {
  assert.equal(toFixedDisplay(-1e-19, 2), '0.00');
  assert.equal(toFixedDisplay(-0, 1), '0.0');
  assert.equal(toFixedDisplay(-0.004, 2), '0.00');
  assert.equal(toFixedDisplay(-0.006, 2), '-0.01');
  assert.equal(formatQuantity('smallLength', -1e-19, { decimals: 2 }), '0.00 mm');
});

test('values convert from the kind\'s internal unit by default, or from a named unit', () => {
  setUnit('distance', 'yd');
  assert.ok(Math.abs(toDisplayUnit('distance', 91.44) - 100) < 1e-12);
  assert.ok(Math.abs(fromDisplayUnit('distance', 100) - 91.44) < 1e-12);
  setUnit('smallLength', 'cm');
  assert.equal(formatQuantity('smallLength', 45, { from: 'mm' }), '4.5 cm');
});

test('a stale or unknown preference falls back to the group default', () => {
  setUnit('distance', 'furlong');
  assert.equal(displayChoice('distance').unit, 'm');
});
