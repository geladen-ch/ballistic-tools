import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, getLanguage, changeLanguage } = await import('../src/i18n.js');
await initI18n();

const { mountLanguageSwitcher } = await import('../src/ui/language-switcher.js');
const { registerRoute, startRouter, rerender } = await import('../src/router.js');

test('header switcher lists all supported languages and defaults to the current one', () => {
  const container = makeElement('div');
  mountLanguageSwitcher(container);
  const select = container.childNodes[0];
  assert.equal(select.tagName, 'SELECT');
  assert.equal(select.value, getLanguage());
  const optionValues = select.childNodes.map((o) => o.attributes.value);
  assert.deepEqual(optionValues.sort(), ['de', 'en', 'fr', 'it', 'ru']);
});

test('changing the header switcher calls changeLanguage with the selected code', async () => {
  const container = makeElement('div');
  mountLanguageSwitcher(container);
  const select = container.childNodes[0];

  select.value = 'fr';
  fireEvent(select, 'change');
  await new Promise((r) => setTimeout(r, 0)); // let the async changeLanguage() settle

  assert.equal(getLanguage(), 'fr');
  await changeLanguage('en');
});

test('a second switcher instance stays in sync when language changes elsewhere', async () => {
  const containerA = makeElement('div');
  const containerB = makeElement('div');
  mountLanguageSwitcher(containerA);
  mountLanguageSwitcher(containerB);

  await changeLanguage('ru');
  assert.equal(containerA.childNodes[0].value, 'ru');
  assert.equal(containerB.childNodes[0].value, 'ru');

  await changeLanguage('en');
});

test('router.rerender() re-invokes the current route\'s mount without changing the path', () => {
  let mountCount = 0;
  registerRoute('/rerender-test', () => {
    mountCount++;
  });
  global.location = { hash: '#/rerender-test' };
  global.window = { addEventListener() {} };
  startRouter('/rerender-test');
  assert.equal(mountCount, 1);
  rerender();
  assert.equal(mountCount, 2);
});
