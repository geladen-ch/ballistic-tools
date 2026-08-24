import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
// See warm-catalogs.js — every await settle() below assumes the built-in
// bullet records (and their manufacturer fields) are already cache-warm.
await warmCatalogs();

const { manufacturerField } = await import('../src/ui/arsenal/manufacturer-field.js');
const { saveUserBullet } = await import('../src/user-library.js');
const {
  isBulletLibraryVisible, setBulletLibraryVisible, resetBulletLibraryPrefsForTests
} = await import('../src/bullet-library-prefs.js');
const { removeCookie } = await import('../src/cookies.js');

const BULLET_LIBRARY_COOKIE_NAME = 'ballistics_hidden_bullet_libraries_v1';

test.beforeEach(() => {
  localStorage.clear();
  resetBulletLibraryPrefsForTests();
  removeCookie(BULLET_LIBRARY_COOKIE_NAME);
});

function settle(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findInput(node) {
  if (node.tagName === 'INPUT') return node;
  for (const child of node.childNodes || []) {
    const found = findInput(child);
    if (found) return found;
  }
  return null;
}

function findSuggestList(node) {
  if (node.className && node.className.split(' ').includes('field-suggest-list')) return node;
  for (const child of node.childNodes || []) {
    const found = findSuggestList(child);
    if (found) return found;
  }
  return null;
}

function suggestTexts(list) {
  return list.childNodes.map((row) => row.textContent);
}

test('with no known-manufacturer resolution yet, focusing shows nothing rather than throwing', async () => {
  const field = manufacturerField();
  const input = findInput(field.node);
  fireEvent(input, 'focus');
  // no assertion beyond "didn't throw" — the async vendor list hasn't
  // resolved on the very first synchronous tick yet
  assert.ok(input);
});

test('focusing an empty field lists every known manufacturer, built-ins and Arsenal alike', async () => {
  saveUserBullet({
    id: 'my-bullet', name: 'Test', manufacturer: 'Acme',
    caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' }
  });
  const field = manufacturerField();
  await settle();
  const input = findInput(field.node);
  const list = findSuggestList(field.node);

  fireEvent(input, 'focus');
  const texts = suggestTexts(list);
  assert.ok(texts.includes('Hornady'), `expected Hornady, got ${texts}`);
  assert.ok(texts.includes('Lapua'), `expected Lapua, got ${texts}`);
  assert.ok(texts.includes('RUAG'), `expected RUAG, got ${texts}`);
  assert.ok(texts.includes('Acme'), `expected the Arsenal vendor Acme, got ${texts}`);
  assert.deepEqual([...texts].sort(), texts, 'expected the list sorted alphabetically');
});

test('a hidden library\'s manufacturers are excluded from the suggestion list', async () => {
  setBulletLibraryVisible('lapua-cd', false);
  const field = manufacturerField();
  await settle();
  const input = findInput(field.node);
  const list = findSuggestList(field.node);

  fireEvent(input, 'focus');
  const texts = suggestTexts(list);
  assert.ok(!texts.includes('Lapua'), `expected Lapua hidden, got ${texts}`);
  assert.ok(texts.includes('Hornady'), 'expected the still-visible hornady-reverse library\'s vendors to remain');
});

test('a user-typed manufacturer that only differs in casing from a built-in one is deduped, built-in casing wins', async () => {
  saveUserBullet({
    id: 'my-bullet', name: 'Test', manufacturer: 'lapua',
    caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' }
  });
  const field = manufacturerField();
  await settle();
  const input = findInput(field.node);
  const list = findSuggestList(field.node);

  fireEvent(input, 'focus');
  const texts = suggestTexts(list);
  assert.equal(texts.filter((t) => t.toLowerCase() === 'lapua').length, 1, `expected exactly one Lapua entry, got ${texts}`);
  assert.ok(texts.includes('Lapua'), `expected the built-in casing "Lapua" to win, got ${texts}`);
});

test('typing filters the list by case-insensitive substring match', async () => {
  const field = manufacturerField();
  await settle();
  const input = findInput(field.node);
  const list = findSuggestList(field.node);

  input.value = 'orn';
  fireEvent(input, 'input');
  const texts = suggestTexts(list);
  assert.deepEqual(texts, ['Hornady']);
});

test('a query matching nothing hides the list', async () => {
  const field = manufacturerField();
  await settle();
  const input = findInput(field.node);
  const list = findSuggestList(field.node);

  input.value = 'zzz-no-such-vendor';
  fireEvent(input, 'input');
  assert.equal(list.style.display, 'none');
});

test('clicking (mousedown) a suggestion fills the input and closes the list', async () => {
  const field = manufacturerField();
  await settle();
  const input = findInput(field.node);
  const list = findSuggestList(field.node);

  fireEvent(input, 'focus');
  const row = list.childNodes.find((r) => r.textContent === 'Hornady');
  assert.ok(row, 'expected a Hornady suggestion row');
  fireEvent(row, 'mousedown');

  assert.equal(input.value, 'Hornady');
  assert.equal(field.getValue(), 'Hornady');
  assert.equal(list.style.display, 'none');
});

test('Escape closes the list without changing the input', async () => {
  const field = manufacturerField();
  await settle();
  const input = findInput(field.node);
  const list = findSuggestList(field.node);

  fireEvent(input, 'focus');
  assert.notEqual(list.style.display, 'none');
  fireEvent(input, 'keydown', { key: 'Escape' });
  assert.equal(list.style.display, 'none');
});

test('blur closes the list', async () => {
  const field = manufacturerField();
  await settle();
  const input = findInput(field.node);
  const list = findSuggestList(field.node);

  fireEvent(input, 'focus');
  assert.notEqual(list.style.display, 'none');
  fireEvent(input, 'blur');
  assert.equal(list.style.display, 'none');
});

test('ArrowDown then Enter selects the highlighted suggestion', async () => {
  const field = manufacturerField();
  await settle();
  const input = findInput(field.node);
  const list = findSuggestList(field.node);

  input.value = 'orn'; // narrows to just "Hornady", so ArrowDown deterministically highlights it
  fireEvent(input, 'input');
  fireEvent(input, 'keydown', { key: 'ArrowDown' });
  fireEvent(input, 'keydown', { key: 'Enter' });

  assert.equal(field.getValue(), 'Hornady');
  assert.equal(list.style.display, 'none');
});

test('setDisabled(true) disables the underlying input', async () => {
  const field = manufacturerField();
  const input = findInput(field.node);
  field.setDisabled(true);
  assert.equal(input.disabled, true);
});
