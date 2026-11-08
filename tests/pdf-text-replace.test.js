// String substitution in PDF template text: plain string → string, every
// occurrence, pairs in order, matches reported per pair.
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceInText, validatePairs } from '../src/pdf/text-replace.js';

test('replaces every occurrence and reports which pairs matched', () => {
  const r = replaceInText('[RANGE] and [RANGE] at Distance', [['[RANGE]', '300 m'], ['MISSING', 'x'], ['Distance', 'Дистанция']]);
  assert.equal(r.text, '300 m and 300 m at Дистанция');
  assert.deepEqual([...r.matched].sort(), [0, 2]);
});

test('pairs apply in the given order, each to the result of the previous', () => {
  assert.equal(replaceInText('A', [['A', 'B'], ['B', 'C']]).text, 'C');
  assert.equal(replaceInText('A', [['B', 'C'], ['A', 'B']]).text, 'B');
});

test('no convention: any substring can be replaced, including special characters', () => {
  assert.equal(replaceInText('x = $1 (a.b)', [['$1', '$&'], ['(a.b)', '?']]).text, 'x = $& ?');
});

test('validatePairs rejects malformed input', () => {
  assert.doesNotThrow(() => validatePairs([['a', 'b']]));
  assert.throws(() => validatePairs('a'));
  assert.throws(() => validatePairs([['a']]));
  assert.throws(() => validatePairs([['a', 1]]));
  assert.throws(() => validatePairs([['', 'b']]), /empty/);
});
