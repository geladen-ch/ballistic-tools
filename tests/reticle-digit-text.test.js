import test from 'node:test';
import assert from 'node:assert/strict';
import { DIGIT_FONTS } from '../src/vendor/reticle-digits/digit-glyphs.js';
import { createElement, validateElement, DIGIT_FONT_IDS } from '../src/reticle/element-types.js';
import { layoutNumber } from '../src/reticle/digit-text.js';
import { expandInstances, recordPrimitives, primitiveHit } from '../src/reticle/geometry.js';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} !== ${b}`);

function number(overrides = {}) {
  return { ...createElement('number', { x: 2, y: 1, units: 'mrad' }), text: '25', digitHeight: 0.5, ...overrides };
}

test('the five fonts are there, each with all ten digits at figure height 1 and tabular advances', () => {
  assert.deepEqual(DIGIT_FONT_IDS, ['b612-regular', 'barlow-light', 'barlow-regular', 'overpass-light', 'overpass-regular']);
  for (const [id, font] of Object.entries(DIGIT_FONTS)) {
    assert.equal(font.license, 'SIL Open Font License 1.1', id);
    assert.deepEqual(Object.keys(font.glyphs), [...'0123456789'], id);
    assert.equal(new Set(Object.values(font.glyphs).map((g) => g.advance)).size, 1, `${id} tabular`);
    close(font.glyphs['7'].bbox[1], -1, 1e-3);
    close(font.glyphs['7'].bbox[3], 0, 0.02);
  }
});

test('the anchor aligns the ink: left end, centre or right end at x; y is the middle of the digits', () => {
  const left = layoutNumber(number({ anchor: 'left' }));
  close(left.bounds.minX, 2);
  const right = layoutNumber(number({ anchor: 'right' }));
  close(right.bounds.maxX, 2);
  const centre = layoutNumber(number({ anchor: 'centre' }));
  close((centre.bounds.minX + centre.bounds.maxX) / 2, 2);
  assert.equal(centre.scale, 0.5);
  close(centre.glyphs[0].y, 1.25, 1e-15);
  assert.ok(centre.bounds.minY < 0.76 && centre.bounds.maxY > 1.24);
  assert.equal(centre.glyphs.length, 2);
});

test('digits only: other text is invalid and draws nothing', () => {
  assert.deepEqual(validateElement(number()), {});
  assert.equal(validateElement(number({ text: '1.5' })).text, 'digitsOnly');
  assert.equal(validateElement(number({ text: '' })).text, 'digitsOnly');
  assert.equal(validateElement(number({ font: 'comic-sans' })).font, 'unknownFont');
  assert.equal(layoutNumber(number({ text: '' })), null);
});

test('mirroring moves the anchor to -x and swaps left and right, without mirroring the digits', () => {
  const element = number({ anchor: 'right', mirror: true });
  const [original, mirrored] = expandInstances(element).map((i) => i.record);
  assert.equal(mirrored.x, -2);
  assert.equal(mirrored.anchor, 'left');
  const [a] = recordPrimitives(original);
  const [b] = recordPrimitives(mirrored);
  close(a.bounds.maxX, 2);
  close(b.bounds.minX, -2);
  assert.deepEqual(b.glyphs.map((g) => g.d), a.glyphs.map((g) => g.d), 'same, unmirrored outlines');
  close(b.bounds.maxX - b.bounds.minX, a.bounds.maxX - a.bounds.minX);
});

test('a number is hit anywhere within its ink bounds', () => {
  const [p] = recordPrimitives(number());
  assert.ok(primitiveHit(p, 2, 1));
  assert.ok(!primitiveHit(p, 2, 2));
  assert.ok(primitiveHit(p, 2, 1.3, 0.1));
});
