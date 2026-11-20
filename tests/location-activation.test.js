import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();
const { activateRangeSolverLocation } = await import('../src/location-activation.js');
const { loadRangeSolverLocationState, loadRangeSolverTargetState, resetRangeSolverStateForTests } = await import('../src/range-solver-state.js');

test.beforeEach(() => resetRangeSolverStateForTests());

const far = { id: 'far', name: 'Far', rangeM: 800, losAngleRad: 0.02 };
const near = { id: 'near', name: 'Near', rangeM: 300, losAngleRad: -0.01 };

test('activating a location selects its nearest target in distance order (the Fire list\'s top row)', () => {
  activateRangeSolverLocation({ id: 'loc', name: 'L', altitudeM: null, targets: [far, near] });
  assert.deepEqual(loadRangeSolverLocationState(), { locationId: 'loc', targetId: 'near' });
  assert.equal(loadRangeSolverTargetState().rangeM, 300);
  assert.equal(loadRangeSolverTargetState().losAngleRad, -0.01);
});

test('activating a location set to its own order selects its first listed target', () => {
  activateRangeSolverLocation({ id: 'loc', name: 'L', altitudeM: null, targetOrder: 'custom', targets: [far, near] });
  assert.equal(loadRangeSolverLocationState().targetId, 'far');
  assert.equal(loadRangeSolverTargetState().rangeM, 800);
});

test('a location with no targets activates with no target selected', () => {
  activateRangeSolverLocation({ id: 'loc', name: 'L', altitudeM: null, targets: [] });
  assert.deepEqual(loadRangeSolverLocationState(), { locationId: 'loc', targetId: null });
});
