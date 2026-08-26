import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  getActiveProjectId, setActiveProjectId, resetRiflePrecisionNavForTests
} = await import('../src/rifle-precision-nav.js');
const { getCookie, removeCookie } = await import('../src/cookies.js');

const COOKIE_NAME = 'ballistics_rifle_precision_active_project_v1';

test.beforeEach(() => {
  resetRiflePrecisionNavForTests();
  removeCookie(COOKIE_NAME);
});

test('getActiveProjectId() starts out null', () => {
  assert.equal(getActiveProjectId(), null);
});

test('setActiveProjectId() is readable back immediately', () => {
  setActiveProjectId('rp-project-1');
  assert.equal(getActiveProjectId(), 'rp-project-1');
});

test('setActiveProjectId() writes the id to a cookie a fresh module load would pick up — survives navigation and an app restart', async () => {
  setActiveProjectId('rp-project-1');
  assert.equal(getCookie(COOKIE_NAME), 'rp-project-1', 'expected the active project id to be written to the cookie');

  const fresh = await import(`../src/rifle-precision-nav.js?reload=${Date.now()}`);
  assert.equal(fresh.getActiveProjectId(), 'rp-project-1');
});

test('setActiveProjectId(null) clears the cookie — a fresh module load then starts with no active project', async () => {
  setActiveProjectId('rp-project-1');
  setActiveProjectId(null);
  assert.equal(getCookie(COOKIE_NAME), null);

  const fresh = await import(`../src/rifle-precision-nav.js?reload=${Date.now()}`);
  assert.equal(fresh.getActiveProjectId(), null);
});

test('resetRiflePrecisionNavForTests() clears the in-memory id (not the cookie)', () => {
  setActiveProjectId('rp-project-1');
  resetRiflePrecisionNavForTests();
  assert.equal(getActiveProjectId(), null);
  assert.equal(getCookie(COOKIE_NAME), 'rp-project-1', 'the cookie itself is untouched by the test-only in-memory reset');
});
