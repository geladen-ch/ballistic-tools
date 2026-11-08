// Face resolution for PDF templates: the style key svg2pdf.js asks jsPDF
// for, value parsing, and inheritance including the rule that a
// family-declaring element must itself resolve to a registered face.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  styleKey, parseFontWeight, parseFontStyle, parseFontFamily, resolveFaces, missingCharacters, describeCharacters
} from '../src/pdf/font-style.js';

test('styleKey matches svg2pdf.js: four classic keys, <weight><style> otherwise', () => {
  assert.equal(styleKey(400, 'normal'), 'normal');
  assert.equal(styleKey(400, 'italic'), 'italic');
  assert.equal(styleKey(700, 'normal'), 'bold');
  assert.equal(styleKey(700, 'italic'), 'bolditalic');
  assert.equal(styleKey(300, 'normal'), '300normal');
  assert.equal(styleKey(600, 'italic'), '600italic');
});

test('font-weight: numbers in steps of 100 and normal/bold; relative keywords rejected', () => {
  assert.equal(parseFontWeight('normal'), 400);
  assert.equal(parseFontWeight('bold'), 700);
  assert.equal(parseFontWeight(' 300 '), 300);
  assert.equal(parseFontWeight('900'), 900);
  for (const bad of ['lighter', 'bolder', '350', '1000', '0', 'heavy']) {
    assert.ok(parseFontWeight(bad) instanceof Error, bad);
  }
});

test('font-style: normal and italic only; oblique rejected', () => {
  assert.equal(parseFontStyle('italic'), 'italic');
  assert.equal(parseFontStyle('normal'), 'normal');
  assert.ok(parseFontStyle('oblique') instanceof Error);
});

test('font-family: one name, quotes stripped, no fallback list', () => {
  assert.equal(parseFontFamily('Overpass'), 'Overpass');
  assert.equal(parseFontFamily(' "Barlow Light" '), 'Barlow Light');
  assert.equal(parseFontFamily("'B612'"), 'B612');
  assert.ok(parseFontFamily('Overpass, sans-serif') instanceof Error);
  assert.ok(parseFontFamily('""') instanceof Error);
});

const node = (label, props, texts = [], children = []) => ({ label, ...props, texts, children });

test('resolveFaces inherits family/weight/style and reports each text run and family declaration', () => {
  const tree = node('svg', {}, [], [
    node('g', { fontFamily: 'Overpass', fontWeight: '300' }, [], [
      node('text', {}, ['Light '], [node('tspan', { fontWeight: 'bold', fontStyle: 'italic' }, ['bold italic'])]),
      node('text', { fontStyle: 'italic' }, ['  ', 'light italic'])
    ])
  ]);
  const { uses, errors } = resolveFaces(tree);
  assert.deepEqual(errors, []);
  assert.deepEqual(uses.map((u) => [u.label, u.family, u.weight, u.style, u.text]), [
    ['g', 'Overpass', 300, 'normal', ''],
    ['text', 'Overpass', 300, 'normal', 'Light '],
    ['tspan', 'Overpass', 700, 'italic', 'bold italic'],
    ['text', 'Overpass', 300, 'italic', 'light italic']
  ]);
});

test('resolveFaces: text without any font-family has family null; bad values are errors', () => {
  const { uses, errors } = resolveFaces(node('text', { fontWeight: 'lighter' }, ['x']));
  assert.equal(uses[0].family, null);
  assert.equal(uses[0].weight, 400);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /lighter/);
});

test('missingCharacters skips line breaks and tabs, and always reports characters above U+FFFF', () => {
  const has = (cp) => cp < 0x2000;
  assert.deepEqual(missingCharacters('a\tb\nc', has), []);
  assert.deepEqual(missingCharacters('a☃b☃', has), ['☃']);
  assert.deepEqual(missingCharacters('x😀', () => true), ['😀']);
  assert.equal(describeCharacters(['☃']), 'U+2603 (☃)');
});
