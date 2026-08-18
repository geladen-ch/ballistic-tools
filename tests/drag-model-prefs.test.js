import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  isDragModelVisible, setDragModelVisible, visibleDragModels, resetDragModelPrefsForTests
} = await import('../src/drag-model-prefs.js');
const { DRAG_MODELS } = await import('../src/engine/drag-tables.js');
const { getCookie, setCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_hidden_drag_models_v1';

test.beforeEach(() => {
  resetDragModelPrefsForTests();
  removeCookie(COOKIE_NAME);
});

test('every known model is visible by default (opt-out, not opt-in)', () => {
  for (const m of DRAG_MODELS) assert.equal(isDragModelVisible(m.id), true);
  assert.deepEqual(visibleDragModels().map((m) => m.id), DRAG_MODELS.map((m) => m.id));
});

test('setDragModelVisible(id, false) hides just that model and persists to a cookie', () => {
  setDragModelVisible('G1', false);
  assert.equal(isDragModelVisible('G1'), false);
  assert.equal(isDragModelVisible('G7'), true);
  assert.equal(getCookie(COOKIE_NAME), 'G1');
});

test('setDragModelVisible(id, true) shows it again and updates the cookie', () => {
  setDragModelVisible('G1', false);
  setDragModelVisible('G1', true);
  assert.equal(isDragModelVisible('G1'), true);
  assert.equal(getCookie(COOKIE_NAME), '');
});

test('visibleDragModels() reflects hides, in registry order', () => {
  setDragModelVisible('G1', false);
  assert.deepEqual(visibleDragModels().map((m) => m.id), ['G7']);
});

test('a garbage/unknown id in the cookie is dropped rather than trusted verbatim', async () => {
  setCookie(COOKIE_NAME, 'G1,not-a-real-model');
  const fresh = await import(`../src/drag-model-prefs.js?reload=${Date.now()}`);
  assert.equal(fresh.isDragModelVisible('G1'), false);
  assert.deepEqual(fresh.visibleDragModels().map((m) => m.id), ['G7']);
});

test('a hidden model survives a fresh module load (session-to-session persistence)', async () => {
  setDragModelVisible('G7', false);
  const fresh = await import(`../src/drag-model-prefs.js?reload=${Date.now()}`);
  assert.equal(fresh.isDragModelVisible('G7'), false);
  assert.equal(fresh.isDragModelVisible('G1'), true);
});
