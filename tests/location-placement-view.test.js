import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const locationPlacementView = await import('../src/views/location-placement-view.js');
const { loadUserLocations, saveUserLocation } = await import('../src/location-library.js');
const { generateUserId } = await import('../src/user-library.js');
const {
  resetRangeSolverStateForTests, saveRangeSolverLocationState, loadRangeSolverLocationState,
  saveRangeSolverTargetState, loadRangeSolverTargetState
} = await import('../src/range-solver-state.js');
const {
  setPendingPlacement, isInPlacementMode, getPlacementReturnPath,
  requestZoomIn, requestZoomOut, requestDone, resetLocationPlacementNavForTests
} = await import('../src/location-placement-nav.js');

test.beforeEach(() => {
  localStorage.clear();
  resetRangeSolverStateForTests();
  resetLocationPlacementNavForTests();
  location.hash = '';
});

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function findByClass(node, cls, out = []) {
  if ((node.className || '').split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

function makeTestLocation(overrides = {}) {
  return { id: generateUserId('location'), name: 'Home Range', altitudeM: null, photo: null, targets: [], ...overrides };
}

function makeTestTarget(overrides = {}) {
  return { id: generateUserId('target'), name: null, notes: null, rangeM: 650, losAngleDeg: 12, coords: null, ...overrides };
}

const TEST_PHOTO = 'data:image/jpeg;base64,AAA';

test('mount() with no pending context redirects to /locations', () => {
  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);
  assert.equal(location.hash, '#/locations');
  cleanup();
});

test('mount() redirects to the pending returnPath when the named location no longer resolves', () => {
  setPendingPlacement({ locationId: 'deleted-location', targetId: null, returnPath: '/range-solver', selectMode: true });
  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);
  assert.equal(location.hash, '#/range-solver');
  cleanup();
});

test('mount() redirects when the location has no photo', () => {
  const loc = saveUserLocation(makeTestLocation({ photo: null }));
  setPendingPlacement({ locationId: loc.id, targetId: null, returnPath: '/locations', selectMode: true });
  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);
  assert.equal(location.hash, '#/locations');
  cleanup();
});

test('mount() enters placement mode with the pending returnPath, and cleanup exits it', () => {
  const loc = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO }));
  setPendingPlacement({ locationId: loc.id, targetId: null, returnPath: '/range-solver', selectMode: true });
  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);

  assert.equal(isInPlacementMode(), true);
  assert.equal(getPlacementReturnPath(), '/range-solver');

  cleanup();
  assert.equal(isInPlacementMode(), false);
});

test('select mode renders a tap-to-select pin per placed target and a chip per unplaced one', () => {
  const placed = makeTestTarget({ rangeM: 650, losAngleDeg: 0, coords: { x: 0.3, y: 0.4 } });
  const unplaced = makeTestTarget({ rangeM: 300, losAngleDeg: 0, coords: null });
  const loc = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [placed, unplaced] }));
  setPendingPlacement({ locationId: loc.id, targetId: null, returnPath: '/range-solver', selectMode: true });

  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);

  const pins = findByClass(container, 'target-photo-overlay-pin');
  assert.equal(pins.length, 1);
  assert.equal(pins[0].style.left, '30.000%');
  assert.equal(pins[0].style.top, '40.000%');
  const chips = findByClass(container, 'target-photo-overlay-chip');
  assert.equal(chips.length, 1);
  assert.equal(findByClass(container, 'photo-viewport-marker').length, 0, 'select mode has no draggable marker');

  cleanup();
});

test('select mode\'s pin/chip labels include the target\'s name only when it has a custom one, not the default numbered fallback', () => {
  const named = makeTestTarget({ name: 'Steel plate', rangeM: 650, losAngleDeg: 5, coords: { x: 0.3, y: 0.4 } });
  const unnamed = makeTestTarget({ name: null, rangeM: 300, losAngleDeg: -5, coords: { x: 0.6, y: 0.6 } });
  const unnamedUnplaced = makeTestTarget({ name: null, rangeM: 500, losAngleDeg: 10, coords: null });
  const loc = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [named, unnamed, unnamedUnplaced] }));
  setPendingPlacement({ locationId: loc.id, targetId: null, returnPath: '/range-solver', selectMode: true });

  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);

  const pins = findByClass(container, 'target-photo-overlay-pin');
  const namedPin = pins.find((p) => p.style.left === '30.000%');
  const unnamedPin = pins.find((p) => p.style.left === '60.000%');
  assert.equal(namedPin.textContent, 'Steel plate 650 m, 5°');
  assert.equal(findByTag(namedPin, 'STRONG')[0].textContent, 'Steel plate', 'name is bolded');
  assert.equal(unnamedPin.textContent, '300 m, -5°', 'no "Target N" fallback name in the label');

  const chip = findByClass(container, 'target-photo-overlay-chip')[0];
  assert.equal(chip.textContent, '500 m, 10°', 'unplaced chip also skips the default fallback name');

  cleanup();
});

test('tapping a pin in select mode selects that target immediately and navigates back, no Done needed', () => {
  const t1 = makeTestTarget({ rangeM: 650, losAngleDeg: 12, coords: { x: 0.5, y: 0.5 } });
  const t2 = makeTestTarget({ rangeM: 300, losAngleDeg: -5, coords: { x: 0.2, y: 0.2 } });
  const loc = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [t1, t2] }));
  saveRangeSolverLocationState({ locationId: loc.id, targetId: t1.id });
  setPendingPlacement({ locationId: loc.id, targetId: null, returnPath: '/range-solver', selectMode: true });

  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);

  const pins = findByClass(container, 'target-photo-overlay-pin');
  const t2Pin = pins.find((p) => p.style.left === '20.000%');
  fireEvent(t2Pin, 'click');

  assert.equal(location.hash, '#/range-solver');
  assert.deepEqual(loadRangeSolverLocationState(), { locationId: loc.id, targetId: t2.id });
  assert.deepEqual(loadRangeSolverTargetState(), { rangeM: 300, losAngleDeg: -5 });

  cleanup();
});

test('select mode: Done alone (no pin tapped) navigates back without changing the current selection', () => {
  const target = makeTestTarget({ coords: { x: 0.5, y: 0.5 } });
  const loc = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [target] }));
  saveRangeSolverLocationState({ locationId: loc.id, targetId: target.id });
  saveRangeSolverTargetState({ rangeM: target.rangeM, losAngleDeg: target.losAngleDeg });
  setPendingPlacement({ locationId: loc.id, targetId: null, returnPath: '/range-solver', selectMode: true });

  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);

  requestDone();

  assert.equal(location.hash, '#/range-solver');
  assert.deepEqual(loadRangeSolverLocationState(), { locationId: loc.id, targetId: target.id });
  assert.deepEqual(loadRangeSolverTargetState(), { rangeM: target.rangeM, losAngleDeg: target.losAngleDeg });

  cleanup();
});

test('placement mode renders the target being placed as a draggable marker (hidden until it has coords) and every other placed target as a static reference dot', () => {
  const other = makeTestTarget({ name: 'Steel plate', rangeM: 300, coords: { x: 0.1, y: 0.2 } });
  const beingPlaced = makeTestTarget({ rangeM: 650, coords: null });
  const loc = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [other, beingPlaced] }));
  setPendingPlacement({ locationId: loc.id, targetId: beingPlaced.id, returnPath: '/locations', selectMode: false });

  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);

  const marker = findByClass(container, 'photo-viewport-marker')[0];
  assert.ok(marker);
  assert.equal(marker.style.display, 'none', 'not placed yet');
  const otherMarkers = findByClass(container, 'target-pin-other-marker');
  assert.equal(otherMarkers.length, 1);
  assert.ok(otherMarkers[0].textContent.includes('Steel plate'));
  assert.equal(otherMarkers[0].style.left, '10.000%');
  assert.equal(otherMarkers[0].style.top, '20.000%');
  assert.equal(findByClass(container, 'target-photo-overlay-pin').length, 0, 'placement mode has no tap-to-select pins');

  cleanup();
});

test('placement mode: nothing is persisted until Done — Clear pin only changes local state', () => {
  const target = makeTestTarget({ coords: { x: 0.4, y: 0.6 } });
  const loc = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [target] }));
  setPendingPlacement({ locationId: loc.id, targetId: target.id, returnPath: '/locations', selectMode: false });

  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);

  const clearButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'rangeSolverLocations.removePinButton');
  fireEvent(clearButton, 'click');

  assert.deepEqual(loadUserLocations().find((l) => l.id === loc.id).targets[0].coords, { x: 0.4, y: 0.6 }, 'not persisted yet');
  assert.equal(findByClass(container, 'photo-viewport-marker')[0].style.display, 'none', 'cleared locally though');

  cleanup();
});

test('placement mode: Done commits the current local coords via saveUserLocation, then navigates back', () => {
  const target = makeTestTarget({ coords: { x: 0.4, y: 0.6 } });
  const loc = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [target] }));
  setPendingPlacement({ locationId: loc.id, targetId: target.id, returnPath: '/locations', selectMode: false });

  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);

  const clearButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'rangeSolverLocations.removePinButton');
  fireEvent(clearButton, 'click');
  requestDone();

  assert.equal(location.hash, '#/locations');
  assert.equal(loadUserLocations().find((l) => l.id === loc.id).targets[0].coords, null, 'the clear is committed on Done');

  cleanup();
});

test('placement mode: Zoom In/Zoom Out reach the mounted view without throwing', () => {
  const target = makeTestTarget({ coords: { x: 0.4, y: 0.6 } });
  const loc = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [target] }));
  setPendingPlacement({ locationId: loc.id, targetId: target.id, returnPath: '/locations', selectMode: false });

  const container = makeElement('main');
  const cleanup = locationPlacementView.mount(container);

  assert.doesNotThrow(() => requestZoomIn());
  assert.doesNotThrow(() => requestZoomOut());

  cleanup();
});

test('zoom/pan carries over when re-entering the same location\'s photo, but not to a different location', () => {
  const targetA = makeTestTarget({ coords: { x: 0.4, y: 0.6 } });
  const locA = saveUserLocation(makeTestLocation({ name: 'Range A', photo: TEST_PHOTO, targets: [targetA] }));
  const targetB = makeTestTarget({ coords: { x: 0.4, y: 0.6 } });
  const locB = saveUserLocation(makeTestLocation({ name: 'Range B', photo: TEST_PHOTO, targets: [targetB] }));

  // First visit to A: zoom in (deterministic — see photo-viewport.test.js,
  // the scale portion of zoomIn() doesn't depend on any layout geometry
  // the fake DOM can't provide), then leave via cleanup — the same path
  // Done/navigating away takes.
  setPendingPlacement({ locationId: locA.id, targetId: targetA.id, returnPath: '/locations', selectMode: false });
  let container = makeElement('main');
  let cleanup = locationPlacementView.mount(container);
  requestZoomIn();
  cleanup();

  // Re-entering A finds the same zoom level waiting, not reset to default.
  setPendingPlacement({ locationId: locA.id, targetId: targetA.id, returnPath: '/locations', selectMode: false });
  container = makeElement('main');
  cleanup = locationPlacementView.mount(container);
  let inner = findByClass(container, 'photo-viewport-inner')[0];
  assert.ok(inner.style.transform.includes('scale(1.5)'), inner.style.transform);
  cleanup();

  // A different location's photo is unaffected — opens at the default.
  setPendingPlacement({ locationId: locB.id, targetId: targetB.id, returnPath: '/locations', selectMode: false });
  container = makeElement('main');
  cleanup = locationPlacementView.mount(container);
  inner = findByClass(container, 'photo-viewport-inner')[0];
  assert.equal(inner.style.transform, undefined);
  cleanup();
});
