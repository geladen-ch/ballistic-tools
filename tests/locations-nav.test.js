import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const { setRangeSolverMode, setRangeSolverTab, getRangeSolverTab, resetRangeSolverNavForTests } = await import('../src/range-solver-nav.js');
const { goToLocations, takeLocationsReturnPath, requestLocationsDone, resetLocationsNavForTests } = await import('../src/locations-nav.js');

test.beforeEach(() => {
  resetLocationsNavForTests();
  resetRangeSolverNavForTests();
  location.hash = '';
});

test('takeLocationsReturnPath falls back to the Range Solver when nothing was recorded', () => {
  assert.equal(takeLocationsReturnPath(), '/range-solver');
  assert.equal(takeLocationsReturnPath('/elsewhere'), '/elsewhere');
});

test('goToLocations records where it was opened from and opens Locations', () => {
  location.hash = '#/truing-session';
  goToLocations();
  assert.equal(location.hash, '#/locations');
  assert.equal(takeLocationsReturnPath(), '/truing-session');
});

test('the return path is one-shot', () => {
  location.hash = '#/truing-session';
  goToLocations();
  takeLocationsReturnPath();
  assert.equal(takeLocationsReturnPath(), '/range-solver');
});

test('requestLocationsDone sends the user back to where Locations was opened from', () => {
  location.hash = '#/truing-session';
  goToLocations();
  requestLocationsDone();
  assert.equal(location.hash, '#/truing-session');
});

test('requestLocationsDone goes to the Range Solver when Locations was opened directly', () => {
  location.hash = '#/locations';
  requestLocationsDone();
  assert.equal(location.hash, '#/range-solver');
});

for (const tab of ['target', 'rangeCard', 'atmosphere']) {
  test(`Done returns to the Range Solver's ${tab} tab when Locations was opened from it`, () => {
    location.hash = '#/range-solver';
    setRangeSolverMode(true);
    setRangeSolverTab(tab);
    goToLocations();
    setRangeSolverMode(false); // the router unmounts the Range Solver
    location.hash = '#/locations';
    requestLocationsDone();
    assert.equal(location.hash, '#/range-solver');
    setRangeSolverMode(true); // and mounts it again
    assert.equal(getRangeSolverTab(), tab);
  });
}

test('opening Locations from outside the Range Solver does not carry a tab back', () => {
  location.hash = '#/truing-session';
  goToLocations();
  requestLocationsDone();
  setRangeSolverMode(true);
  assert.equal(getRangeSolverTab(), 'target');
});
