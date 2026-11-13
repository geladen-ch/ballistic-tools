import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const { mountDialogRoot, isDialogOpen } = await import('../src/ui/app-dialog.js');
const { rangeSolverLocationPickerBody, openRangeSolverLocationPicker } = await import('../src/ui/range-solver/location-picker.js');
const { saveUserLocation, resetLocationLibraryForTests } = await import('../src/location-library.js');
const {
  loadRangeSolverLocationState, saveRangeSolverLocationState, loadRangeSolverTargetState,
  loadRangeSolverAtmosphereState, resetRangeSolverStateForTests
} = await import('../src/range-solver-state.js');
const { registerRoute } = await import('../src/router.js');
const { setRangeSolverMode, setRangeSolverTab, getRangeSolverTab, resetRangeSolverNavForTests } = await import('../src/range-solver-nav.js');
const { resetLocationsNavForTests, takeLocationsReturnPath } = await import('../src/locations-nav.js');

let dialogContainer;
let mounts = 0;
registerRoute('/range-solver', () => {
  mounts++;
  setRangeSolverMode(true);
  return () => setRangeSolverMode(false);
});

test.beforeEach(async () => {
  await resetLocationLibraryForTests();
  resetRangeSolverStateForTests();
  resetRangeSolverNavForTests();
  resetLocationsNavForTests();
  dialogContainer = makeElement('div');
  mountDialogRoot(dialogContainer);
  mounts = 0;
  location.hash = '#/range-solver';
});

function findByClass(node, cls, out = []) {
  if (typeof node.className === 'string' && node.className.split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

const rows = (root) => findByClass(root, 'location-picker-row');
const rowByName = (root, name) => rows(root).find((b) => b.textContent.includes(name));
const dialogButton = (label) => findByTag(dialogContainer, 'BUTTON').find((b) => b.textContent === label);

function seedLocations() {
  saveUserLocation({
    id: 'l1', name: 'Home Range', altitudeM: null, photo: null,
    targets: [{ id: 't1', name: 'Gong', notes: null, rangeM: 300, losAngleRad: 0.05, coords: null }]
  });
  saveUserLocation({
    id: 'l2', name: 'Alpine Range', altitudeM: 1500, photo: null,
    targets: [
      { id: 't2', name: 'Near', notes: null, rangeM: 450, losAngleRad: -0.1, coords: null },
      { id: 't3', name: 'Far', notes: null, rangeM: 800, losAngleRad: -0.2, coords: null }
    ]
  });
  saveUserLocation({ id: 'l0', name: 'Empty Spot', altitudeM: null, photo: null, targets: [] });
}

const noLocationRow = (root) => rows(root)[0];

test('with no location that has a target, only "No location" is offered, plus the empty-state hint', () => {
  saveUserLocation({ id: 'l0', name: 'Empty Spot', altitudeM: null, photo: null, targets: [] });
  const body = rangeSolverLocationPickerBody({ onPick: () => {} });
  assert.equal(rows(body).length, 1);
  assert.equal(noLocationRow(body).textContent, t('rangeSolverLocations.noLocationOption'));
  assert.ok(body.textContent.includes(t('rangeSolver.locationPicker.emptyHint')));
});

test('"No location" comes first, then only locations with targets, each with its target count', () => {
  seedLocations();
  const body = rangeSolverLocationPickerBody({ onPick: () => {} });
  assert.equal(rows(body).length, 3);
  assert.equal(noLocationRow(body).textContent, t('rangeSolverLocations.noLocationOption'));
  assert.ok(!body.textContent.includes('Empty Spot'));
  assert.ok(!body.textContent.includes(t('rangeSolver.locationPicker.emptyHint')));
  assert.ok(rowByName(body, 'Alpine Range').textContent.includes(t('rangeSolver.locationPicker.targetCount', { count: 2 })));
  assert.ok(rowByName(body, 'Home Range').textContent.includes(t('rangeSolver.locationPicker.targetCount', { count: 1 })));
});

test('"No location" is marked current when no location is active', () => {
  seedLocations();
  const body = rangeSolverLocationPickerBody({ onPick: () => {} });
  const current = rows(body).filter((b) => b.className.includes('current'));
  assert.deepEqual(current, [noLocationRow(body)]);
});

test('picking "No location" clears the active location and remounts the solver', () => {
  seedLocations();
  saveRangeSolverLocationState({ locationId: 'l2', targetId: 't3' });
  setRangeSolverMode(true);
  openRangeSolverLocationPicker();
  fireEvent(noLocationRow(dialogContainer), 'click');
  assert.equal(isDialogOpen(), false);
  assert.equal(loadRangeSolverLocationState().locationId, null);
  assert.equal(loadRangeSolverLocationState().targetId, null);
  assert.equal(mounts, 1);
});

test('the active location is marked current', () => {
  seedLocations();
  saveRangeSolverLocationState({ locationId: 'l2', targetId: 't3' });
  const body = rangeSolverLocationPickerBody({ onPick: () => {} });
  const current = rows(body).filter((b) => b.className.includes('current'));
  assert.equal(current.length, 1);
  assert.ok(current[0].textContent.includes('Alpine Range'));
  assert.equal(current[0].getAttribute('aria-current'), 'true');
});

test('picking from the opened modal activates the location and remounts the solver on the same pane', () => {
  seedLocations();
  setRangeSolverMode(true);
  setRangeSolverTab('atmosphere');
  openRangeSolverLocationPicker();
  assert.equal(isDialogOpen(), true);

  fireEvent(rowByName(dialogContainer, 'Alpine Range'), 'click');

  assert.equal(isDialogOpen(), false);
  assert.deepEqual(
    { locationId: loadRangeSolverLocationState().locationId, targetId: loadRangeSolverLocationState().targetId },
    { locationId: 'l2', targetId: 't2' },
    'lands on the first target, as the Locations manager does'
  );
  assert.equal(loadRangeSolverTargetState().rangeM, 450);
  assert.equal(loadRangeSolverTargetState().losAngleRad, -0.1);
  assert.equal(loadRangeSolverAtmosphereState().altitudeM, 1500, 'altitude seeds the atmosphere default');
  assert.equal(mounts, 1, 'the solver view remounts on the new location');
  assert.equal(getRangeSolverTab(), 'atmosphere');
});

test('Cancel closes without changing anything', () => {
  seedLocations();
  saveRangeSolverLocationState({ locationId: 'l1', targetId: 't1' });
  openRangeSolverLocationPicker();
  fireEvent(dialogButton(t('rangeSolver.locationPicker.cancel')), 'click');
  assert.equal(isDialogOpen(), false);
  assert.equal(loadRangeSolverLocationState().locationId, 'l1');
  assert.equal(location.hash, '#/range-solver');
  assert.equal(mounts, 0);
});

test('Manage locations closes and goes to Locations with the solver as return path', () => {
  seedLocations();
  openRangeSolverLocationPicker();
  fireEvent(dialogButton(t('rangeSolver.locationPicker.manageLocations')), 'click');
  assert.equal(isDialogOpen(), false);
  assert.equal(location.hash, '#/locations');
  assert.equal(takeLocationsReturnPath('/elsewhere'), '/range-solver');
});
