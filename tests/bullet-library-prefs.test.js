import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  isBulletLibraryVisible, setBulletLibraryVisible, resetBulletLibraryPrefsForTests
} = await import('../src/bullet-library-prefs.js');
const { BULLET_LIBRARIES } = await import('../src/bullets/bullet-libraries.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_hidden_bullet_libraries_v1';
const LEGACY_COOKIE_NAME = 'ballistics_bullet_library_enabled_v1';
const ALL_IDS = BULLET_LIBRARIES.map((lib) => lib.id);

test.beforeEach(() => {
  resetBulletLibraryPrefsForTests();
  removeCookie(COOKIE_NAME);
  removeCookie(LEGACY_COOKIE_NAME);
});

test('every library is visible by default (no prior preference, no legacy cookie) — discoverable, not opt-in', () => {
  for (const id of ALL_IDS) assert.equal(isBulletLibraryVisible(id), true);
});

test('setBulletLibraryVisible(id, false) hides just that library, leaving the rest visible', () => {
  setBulletLibraryVisible('lapua-cd', false);
  assert.equal(isBulletLibraryVisible('lapua-cd'), false);
  assert.equal(isBulletLibraryVisible('geladen'), true);
});

test('setBulletLibraryVisible(id, true) re-shows a library that was hidden', () => {
  setBulletLibraryVisible('lapua-cd', false);
  setBulletLibraryVisible('lapua-cd', true);
  assert.equal(isBulletLibraryVisible('lapua-cd'), true);
});

test('setBulletLibraryVisible persists the resulting hidden set to a cookie', () => {
  setBulletLibraryVisible('lapua-cd', false);
  assert.equal(getCookie(COOKIE_NAME), 'lapua-cd');
});

test('a hidden library survives a fresh module load (session-to-session persistence)', async () => {
  setBulletLibraryVisible('lapua-cd', false);
  const fresh = await import(`../src/bullet-library-prefs.js?reload=${Date.now()}`);
  assert.equal(fresh.isBulletLibraryVisible('lapua-cd'), false);
  assert.equal(fresh.isBulletLibraryVisible('geladen'), true);
});

test('a garbage/unknown id in the cookie is dropped rather than trusted verbatim', async () => {
  setCookie(COOKIE_NAME, 'lapua-cd,not-a-real-library');
  const fresh = await import(`../src/bullet-library-prefs.js?reload=${Date.now()}`);
  assert.equal(fresh.isBulletLibraryVisible('lapua-cd'), false);
  assert.equal(fresh.isBulletLibraryVisible('geladen'), true);
});

test('no cookie at all, and no legacy cookie, defaults to every library visible on a fresh module load', async () => {
  const fresh = await import(`../src/bullet-library-prefs.js?reload=${Date.now()}`);
  for (const id of ALL_IDS) assert.equal(fresh.isBulletLibraryVisible(id), true);
});

test('an explicit legacy "off" (the old single boolean toggle) hides every library on first load under the new scheme', async () => {
  setCookie(LEGACY_COOKIE_NAME, 'false');
  const fresh = await import(`../src/bullet-library-prefs.js?reload=${Date.now()}`);
  for (const id of ALL_IDS) assert.equal(fresh.isBulletLibraryVisible(id), false);
});

test('an explicit legacy "on" leaves every library visible on first load under the new scheme', async () => {
  setCookie(LEGACY_COOKIE_NAME, 'true');
  const fresh = await import(`../src/bullet-library-prefs.js?reload=${Date.now()}`);
  for (const id of ALL_IDS) assert.equal(fresh.isBulletLibraryVisible(id), true);
});

test('the legacy cookie is only ever consulted once — an explicit new-scheme empty cookie is not re-defaulted from it', async () => {
  setCookie(LEGACY_COOKIE_NAME, 'false');
  setCookie(COOKIE_NAME, ''); // explicitly saved "hide nothing" under the new scheme
  const fresh = await import(`../src/bullet-library-prefs.js?reload=${Date.now()}`);
  for (const id of ALL_IDS) assert.equal(fresh.isBulletLibraryVisible(id), true);
});
