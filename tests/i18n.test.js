import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t, getLanguage, changeLanguage, i18nId, applyI18nText, SUPPORTED_LANGUAGES } = await import('../src/i18n.js');
await initI18n();

test('all three supported languages load and translate a known key', async () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    await changeLanguage(code);
    assert.equal(getLanguage(), code);
    const label = t('fields.muzzleVelocity');
    assert.ok(label && label.length > 0, `empty translation for ${code}`);
  }
  await changeLanguage('en');
});

test('interpolation substitutes variables into the translated string', () => {
  const msg = t('trajectory.statusOk', { count: 42, angle: '0.123', angleMrad: '2.15' });
  assert.match(msg, /42/);
  assert.match(msg, /0\.123/);
  assert.match(msg, /2\.15/);
  assert.doesNotMatch(msg, /\{\{/); // no unresolved {{placeholders}} left behind
});

test('a missing/garbage language falls back to English rather than throwing', async () => {
  await changeLanguage('xx');
  const label = t('fields.bc');
  assert.equal(label, 'Ballistic coefficient');
  await changeLanguage('en');
});

test('i18nId derives a stable, DOM-safe id from a dotted translation key', () => {
  assert.equal(i18nId('fields.muzzleVelocity'), 'i18n-fields-muzzleVelocity');
  assert.equal(i18nId('common.error'), 'i18n-common-error');
});

test('applyI18nText sets data-i18n, a derived id, and the translated text', () => {
  const node = { attributes: {}, setAttribute(k, v) { this.attributes[k] = v; }, id: '', textContent: '' };
  applyI18nText(node, 'nav.home');
  assert.equal(node.attributes['data-i18n'], 'nav.home');
  assert.equal(node.id, 'i18n-nav-home');
  assert.equal(node.textContent, 'Home');
});

test('applyI18nText does not overwrite a caller-supplied id', () => {
  const node = { attributes: {}, setAttribute(k, v) { this.attributes[k] = v; }, id: 'custom-id', textContent: '' };
  applyI18nText(node, 'nav.home');
  assert.equal(node.id, 'custom-id');
});
