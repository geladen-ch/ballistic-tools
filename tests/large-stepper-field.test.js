import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();

const { setUnit, resetUnits } = await import('../src/prefs.js');
const { displaySpanToEngine } = await import('../src/units.js');
const { largeStepperField } = await import('../src/ui/large-stepper-field.js');

function findByClass(node, className, out = []) {
  if (node.className && node.className.split(' ').includes(className)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, className, out);
  return out;
}

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

test.beforeEach(() => resetUnits());

test('renders a number input flanked by two large +/- buttons', () => {
  const field = largeStepperField({ id: 'windSpeed', min: 0, max: 30, step: 0.5, value: 2 });
  const buttons = findByClass(field.node, 'large-stepper-btn');
  assert.equal(buttons.length, 2);
  const [number] = findInputs(field.node);
  assert.equal(number.value, '2');
  assert.equal(field.getEngineValue(), 2);
});

test('the + button steps up by the given engine step, and fires onInput', () => {
  let calls = 0;
  const field = largeStepperField({ id: 'windSpeed', min: 0, max: 30, step: 0.5, value: 2, onInput: () => { calls++; } });
  const [, incButton] = findByClass(field.node, 'large-stepper-btn');
  fireEvent(incButton, 'click');
  assert.equal(field.getEngineValue(), 2.5);
  assert.equal(calls, 1);
});

test('the - button steps down by the given engine step', () => {
  const field = largeStepperField({ id: 'windSpeed', min: 0, max: 30, step: 0.5, value: 2 });
  const [decButton] = findByClass(field.node, 'large-stepper-btn');
  fireEvent(decButton, 'click');
  assert.equal(field.getEngineValue(), 1.5);
});

test('stepping compounds on a value just typed by hand, not a stale starting value', () => {
  const field = largeStepperField({ id: 'windSpeed', min: 0, max: 30, step: 0.5, value: 2 });
  const [number] = findInputs(field.node);
  const [, incButton] = findByClass(field.node, 'large-stepper-btn');

  number.value = '10';
  fireEvent(number, 'input');
  fireEvent(incButton, 'click');
  assert.equal(field.getEngineValue(), 10.5);
});

test('clamps at min and max', () => {
  const field = largeStepperField({ id: 'windSpeed', min: 0, max: 1, step: 0.5, value: 1 });
  const [decButton, incButton] = findByClass(field.node, 'large-stepper-btn');

  fireEvent(incButton, 'click'); // already at max
  assert.equal(field.getEngineValue(), 1);

  fireEvent(decButton, 'click');
  fireEvent(decButton, 'click');
  fireEvent(decButton, 'click'); // past min
  assert.equal(field.getEngineValue(), 0);
});

test('setEngineValue() writes the field without firing onInput', () => {
  let calls = 0;
  const field = largeStepperField({ id: 'windSpeed', min: 0, max: 30, step: 0.5, value: 2, onInput: () => { calls++; } });
  field.setEngineValue(5);
  assert.equal(field.getEngineValue(), 5);
  assert.equal(calls, 0);
});

test('respects a non-metric wind speed preference — displays and steps in fps, reads back in m/s', () => {
  setUnit('windSpeed', 'ft/s');
  const field = largeStepperField({ id: 'windSpeed', min: 0, max: 10, step: 1, value: 5 });
  const [number] = findInputs(field.node);
  // ft/s displays with 0 decimals (see units.js) — 5 m/s rounds to 16 ft/s.
  assert.equal(number.value, '16');
  assert.ok(Math.abs(field.getEngineValue() - 4.877) < 0.05, `getEngineValue() was ${field.getEngineValue()}`);
});

test('a `decimals` override rounds to that precision instead of the unit choice\'s own default (ft/s normally rounds to 0)', () => {
  setUnit('windSpeed', 'ft/s');
  const field = largeStepperField({ id: 'windSpeed', min: 0, max: 10, step: 1, value: 5, decimals: 1 });
  const [number] = findInputs(field.node);
  assert.equal(number.value, '16.4');
});

test('a `decimals` override also keeps stepper clicks free of floating-point noise', () => {
  setUnit('windSpeed', 'mph');
  // Mirrors range-solver-view.js's own call: a "1 mph" step handed in as
  // its engine-unit (m/s) equivalent, which engineSpanToDisplay() then
  // converts back to mph internally — the round trip that used to leave
  // noise like 0.9999999999999999 in the displayed value.
  const step = displaySpanToEngine('windSpeed', 1, 'mph');
  const field = largeStepperField({ id: 'windSpeed', min: 0, max: 30, step, value: 0, decimals: 1 });
  const [number] = findInputs(field.node);
  const [, incButton] = findByClass(field.node, 'large-stepper-btn');
  fireEvent(incButton, 'click');
  assert.equal(number.value, 1);
});
