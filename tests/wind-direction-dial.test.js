import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();

const { windDirectionDial } = await import('../src/ui/wind-direction-dial.js');
const { setWindDialAppearance } = await import('../src/wind-dial-prefs.js');
const { removeCookie } = await import('../src/cookies.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.childNodes || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

test.beforeEach(() => removeCookie('ballistics_wind_dial_appearance_v1'));

test('builds without throwing and exposes the initial value', () => {
  const dial = windDirectionDial({ id: 'windAngle', value: 45 });
  assert.equal(dial.getValue(), 45);
  const numberInput = findById(dial.node, 'windAngle');
  assert.equal(numberInput.value, '45');
});

test('defaults to the "clock" skin, drawing 12/3/6/9 labels', () => {
  const dial = windDirectionDial({ id: 'windAngle', value: 0 });
  const texts = findByTag(dial.node, 'TEXT').map((n) => n.textContent);
  assert.deepEqual(texts.sort(), ['12', '3', '6', '9']);
});

test('the "clean" skin draws no labels', () => {
  const dial = windDirectionDial({ id: 'windAngle', value: 0, skin: 'clean' });
  assert.equal(findByTag(dial.node, 'TEXT').length, 0);
});

test('respects the wind-dial-appearance cookie preference when no explicit skin is given', () => {
  setWindDialAppearance('clean');
  const dial = windDirectionDial({ id: 'windAngle', value: 0 });
  assert.equal(findByTag(dial.node, 'TEXT').length, 0);
});

test('typing in the number field updates the value and fires onInput, without snapping', () => {
  let fired = 0;
  const dial = windDirectionDial({ id: 'windAngle', value: 0, onInput: () => fired++ });
  const numberInput = findById(dial.node, 'windAngle');
  numberInput.value = '47';
  fireEvent(numberInput, 'input');
  assert.equal(dial.getValue(), 47);
  assert.equal(fired, 1);
});

test('arrow keys step by 1deg, Shift+arrow by 15deg, both firing onInput', () => {
  let fired = 0;
  const dial = windDirectionDial({ id: 'windAngle', value: 10, onInput: () => fired++ });
  const svg = findByTag(dial.node, 'SVG')[0];

  fireEvent(svg, 'keydown', { key: 'ArrowRight' });
  assert.equal(dial.getValue(), 11);

  fireEvent(svg, 'keydown', { key: 'ArrowLeft', shiftKey: true });
  assert.equal(dial.getValue(), 356); // wraps below 0

  assert.equal(fired, 2);
});

test('setValue() writes the dial and number field without firing onInput', () => {
  let fired = 0;
  const dial = windDirectionDial({ id: 'windAngle', value: 0, onInput: () => fired++ });
  dial.setValue(400); // normalizes mod 360
  assert.equal(dial.getValue(), 40);
  assert.equal(findById(dial.node, 'windAngle').value, '40');
  assert.equal(fired, 0);
});

test('the hint line classifies head/tail, full-value and quartering angles', () => {
  const dial = windDirectionDial({ id: 'windAngle', value: 0 });
  const hint = () => findByTag(dial.node, 'P').find((n) => n.className.includes('hint'));

  dial.setValue(0);
  assert.match(hint().textContent, /Headwind/);

  dial.setValue(180);
  assert.match(hint().textContent, /Tailwind/);

  dial.setValue(90);
  assert.match(hint().textContent, /Full value/);

  dial.setValue(45);
  assert.match(hint().textContent, /Quartering/);
});
