import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const unitConversionView = await import('../src/views/unit-conversion-view.js');

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test.beforeEach(() => {
  unitConversionView.resetUnitConversionStateForTests();
});

test('mount() renders all seven categories, each seeded with a value', () => {
  const container = makeElement('main');
  unitConversionView.mount(container);

  assert.ok(container.textContent.includes(t('unitConversion.title')));
  for (const key of ['angle', 'range', 'length', 'speed', 'mass', 'temperature', 'pressure']) {
    assert.ok(container.textContent.includes(t(`unitConversion.${key}`)), `expected a "${key}" category card`);
  }

  const inputs = findByTag(container, 'INPUT');
  // 3 angle + 3 range + 3 length + 4 speed + 2 mass + 2 temperature + 3 pressure
  assert.equal(inputs.length, 20);
  assert.ok(inputs.every((input) => input.value !== ''), 'every field should start seeded, not blank');
});

test('editing a field in one category does not affect another category', () => {
  const container = makeElement('main');
  unitConversionView.mount(container);

  const inputs = findByTag(container, 'INPUT');
  const rangeMetersInput = inputs.find((input) => parseFloat(input.value) === 100); // Range's seeded 100 m
  const massGramsInput = inputs.find((input) => parseFloat(input.value) === 10); // Mass's seeded 10 g
  assert.ok(rangeMetersInput && massGramsInput && rangeMetersInput !== massGramsInput);

  rangeMetersInput.value = '500';
  fireEvent(rangeMetersInput, 'input');
  assert.equal(parseFloat(massGramsInput.value), 10, 'editing Range must not touch Mass');
});

test('re-mounting keeps the last edited value (session-only persistence)', () => {
  const container = makeElement('main');
  unitConversionView.mount(container);

  const firstInputs = findByTag(container, 'INPUT');
  const rangeMetersInput = firstInputs.find((input) => parseFloat(input.value) === 100);
  rangeMetersInput.value = '250';
  fireEvent(rangeMetersInput, 'input');

  unitConversionView.mount(container);
  const secondInputs = findByTag(container, 'INPUT');
  assert.ok(secondInputs.some((input) => parseFloat(input.value) === 250), 'expected 250 m to survive a re-mount');
});

test('resetUnitConversionStateForTests() clears session state back to the seed defaults', () => {
  const container = makeElement('main');
  unitConversionView.mount(container);
  const rangeMetersInput = findByTag(container, 'INPUT').find((input) => parseFloat(input.value) === 100);
  rangeMetersInput.value = '250';
  fireEvent(rangeMetersInput, 'input');

  unitConversionView.resetUnitConversionStateForTests();
  unitConversionView.mount(container);
  assert.ok(findByTag(container, 'INPUT').some((input) => parseFloat(input.value) === 100), 'expected the seed 100 m back after a reset');
});
