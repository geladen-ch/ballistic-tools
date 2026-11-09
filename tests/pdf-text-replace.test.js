// String substitution in PDF template text: plain string → string, every
// occurrence, pairs in order, matches reported per pair.
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceInText, validatePairs, translateText, textKeys } from '../src/pdf/text-replace.js';

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

test('translateText: {key} tokens translated, {key|upper} in capitals for the language, unknown keys reported and kept', () => {
  const dict = { 'card.title': 'Range card', 'card.box': 'izmir', 'card.empty': '' };
  const translate = (key) => (key in dict ? dict[key] : null);
  assert.deepEqual(translateText('{card.title} · [date]', translate, 'en'), { text: 'Range card · [date]', missing: [] });
  assert.equal(translateText('{card.box|upper}', translate, 'tr').text, 'İZMİR');
  assert.deepEqual(translateText('{card.nope} {card.empty}', translate, 'en'), { text: '{card.nope} {card.empty}', missing: ['card.nope', 'card.empty'] });
  assert.deepEqual(translateText('{card.title}', null, 'en').missing, ['card.title']);
  assert.equal(translateText('a {b c} {1x} [x]', translate, 'en').text, 'a {b c} {1x} [x]');
  assert.deepEqual(textKeys('{a.b} and {c|upper}'), ['a.b', 'c']);
});
