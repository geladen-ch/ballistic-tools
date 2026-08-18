import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();

const { mountDisplayModeSwitch } = await import('../src/ui/display-mode-switch.js');
const { getDisplayMode, setDisplayMode, resetDisplayModePrefsForTests } = await import('../src/display-mode-prefs.js');

test.beforeEach(() => resetDisplayModePrefsForTests());

test('lists Auto/Desktop/Mobile and defaults to the current mode', () => {
  const container = makeElement('div');
  mountDisplayModeSwitch(container);
  const select = container.childNodes[0];
  assert.equal(select.tagName, 'SELECT');
  assert.equal(select.value, getDisplayMode());
  const optionValues = select.childNodes.map((o) => o.attributes.value);
  assert.deepEqual(optionValues, ['auto', 'desktop', 'mobile']);
});

test('changing the switch calls setDisplayMode with the selected value', () => {
  const container = makeElement('div');
  mountDisplayModeSwitch(container);
  const select = container.childNodes[0];

  select.value = 'mobile';
  fireEvent(select, 'change');

  assert.equal(getDisplayMode(), 'mobile');
});

test('a second switch instance stays in sync when the mode changes elsewhere', () => {
  const containerA = makeElement('div');
  const containerB = makeElement('div');
  mountDisplayModeSwitch(containerA);
  mountDisplayModeSwitch(containerB);

  setDisplayMode('desktop');
  assert.equal(containerA.childNodes[0].value, 'desktop');
  assert.equal(containerB.childNodes[0].value, 'desktop');
});
