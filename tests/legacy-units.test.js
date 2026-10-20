import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLegacy, encodeLegacy, decodeFieldValues, encodeFieldValues } from '../src/legacy-units.js';

test('stored atmosphere fields decode to internal names and units, and encode back exactly', () => {
  const stored = { tempC: 7, pressureHpa: 925.3, humidityPct: 40, altitudeM: 500, atmospherePreset: 'custom' };
  const memory = decodeLegacy(stored);
  assert.deepEqual(memory, { tempC: 7, pressurePa: 92530, humidity: 0.4, altitudeM: 500, atmospherePreset: 'custom' });
  assert.deepEqual(encodeLegacy(memory), stored);
});

test('fields already in internal form, and fields the table does not know, pass through untouched', () => {
  assert.deepEqual(decodeLegacy({ pressurePa: 95000, foo: 1 }), { pressurePa: 95000, foo: 1 });
  assert.deepEqual(encodeLegacy({ tempC: 3, bar: 'x' }), { tempC: 3, bar: 'x' });
});

test('null objects and null values survive, with the key renamed', () => {
  assert.equal(decodeLegacy(null), null);
  assert.equal(encodeLegacy(undefined), undefined);
  assert.deepEqual(decodeLegacy({ pressureHpa: null }), { pressurePa: null });
});

test('a value stored under a field id keeps its key and converts only its unit', () => {
  assert.deepEqual(decodeFieldValues({ pressureMedianError: 7, pressureMedianErrorPreset: 'byAltitude' }), { pressureMedianError: 700, pressureMedianErrorPreset: 'byAltitude' });
  assert.deepEqual(encodeFieldValues({ pressureMedianError: 700, tempMedianError: 5 }), { pressureMedianError: 7, tempMedianError: 5 });
  assert.equal(decodeFieldValues(null), null);
});
