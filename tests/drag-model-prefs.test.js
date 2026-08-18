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
const ALL_IDS = DRAG_MODELS.map((m) => m.id);
const DEFAULT_VISIBLE_IDS = ['G1', 'G7'];
const DEFAULT_HIDDEN_IDS = ALL_IDS.filter((id) => !DEFAULT_VISIBLE_IDS.includes(id));

test.beforeEach(() => {
  resetDragModelPrefsForTests();
  removeCookie(COOKIE_NAME);
});

test('only G1 and G7 are visible by default (no prior preference) — everything else is opt-in', () => {
  assert.deepEqual(visibleDragModels().map((m) => m.id), DEFAULT_VISIBLE_IDS);
  for (const id of DEFAULT_HIDDEN_IDS) assert.equal(isDragModelVisible(id), false);
});

test('setDragModelVisible(id, false) hides just that model, leaving the rest of the default state alone', () => {
  setDragModelVisible('G7', false);
  assert.equal(isDragModelVisible('G7'), false);
  assert.equal(isDragModelVisible('G1'), true);
  assert.deepEqual(visibleDragModels().map((m) => m.id), ['G1']);
});

test('setDragModelVisible(id, true) shows a model that was hidden by default', () => {
  setDragModelVisible('G2', true);
  assert.equal(isDragModelVisible('G2'), true);
  assert.deepEqual(visibleDragModels().map((m) => m.id), ['G1', 'G2', 'G7']);
});

test('setDragModelVisible persists the resulting hidden set to a cookie', () => {
  setDragModelVisible('G7', false);
  const stored = new Set(getCookie(COOKIE_NAME).split(','));
  assert.deepEqual(stored, new Set([...DEFAULT_HIDDEN_IDS, 'G7']));
});

test('explicitly showing every model persists an empty cookie, and a reload respects that instead of re-defaulting', async () => {
  for (const id of DEFAULT_HIDDEN_IDS) setDragModelVisible(id, true);
  assert.equal(getCookie(COOKIE_NAME), '');
  const fresh = await import(`../src/drag-model-prefs.js?reload=${Date.now()}`);
  assert.deepEqual(fresh.visibleDragModels().map((m) => m.id), ALL_IDS);
});

test('a garbage/unknown id in the cookie is dropped rather than trusted verbatim', async () => {
  setCookie(COOKIE_NAME, 'G1,not-a-real-model');
  const fresh = await import(`../src/drag-model-prefs.js?reload=${Date.now()}`);
  assert.equal(fresh.isDragModelVisible('G1'), false);
  assert.deepEqual(fresh.visibleDragModels().map((m) => m.id), ALL_IDS.filter((id) => id !== 'G1'));
});

test('a hidden model survives a fresh module load (session-to-session persistence)', async () => {
  setDragModelVisible('G7', false);
  const fresh = await import(`../src/drag-model-prefs.js?reload=${Date.now()}`);
  assert.equal(fresh.isDragModelVisible('G7'), false);
  assert.equal(fresh.isDragModelVisible('G1'), true);
});

test('no cookie at all still defaults to G1/G7 only, even on a fresh module load', async () => {
  const fresh = await import(`../src/drag-model-prefs.js?reload=${Date.now()}`);
  assert.deepEqual(fresh.visibleDragModels().map((m) => m.id), DEFAULT_VISIBLE_IDS);
});
