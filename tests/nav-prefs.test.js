import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  isRailCollapsed, setRailCollapsed, isGroupOpen, setGroupOpen, resetNavPrefsForTests
} = await import('../src/nav-prefs.js');
const { getCookie } = await import('../src/cookies.js');

test.beforeEach(() => resetNavPrefsForTests());

test('the rail defaults to expanded', () => {
  assert.equal(isRailCollapsed(), false);
});

test('setRailCollapsed persists to a cookie a fresh read would pick up', () => {
  setRailCollapsed(true);
  assert.equal(isRailCollapsed(), true);
  const saved = JSON.parse(getCookie('ballistics_nav_prefs_v1'));
  assert.equal(saved.collapsed, true);
});

test('both groups default to open', () => {
  assert.equal(isGroupOpen('measurement'), true);
  assert.equal(isGroupOpen('analysis'), true);
});

test('collapsing one group leaves the other alone', () => {
  setGroupOpen('measurement', false);
  assert.equal(isGroupOpen('measurement'), false);
  assert.equal(isGroupOpen('analysis'), true);
});

test('group state persists to the same cookie', () => {
  setGroupOpen('analysis', false);
  const saved = JSON.parse(getCookie('ballistics_nav_prefs_v1'));
  assert.equal(saved.groups.analysis, false);
});
