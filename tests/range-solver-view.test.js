import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
await warmCatalogs();

const { resetShotStateForTests } = await import('../src/shot-state.js');
const {
  isInRangeSolverMode, getRangeSolverTab, setRangeSolverTab, resetRangeSolverNavForTests
} = await import('../src/range-solver-nav.js');
const {
  resetRangeSolverStateForTests, saveRangeSolverLocationState, loadRangeSolverLocationState,
  saveRangeSolverTargetState, wasAtmosphereTouchedThisSession
} = await import('../src/range-solver-state.js');
const { setIndicatorStyle } = await import('../src/range-solver-prefs.js');
const { getCookie } = await import('../src/cookies.js');
const { saveUserLocation, loadUserLocations } = await import('../src/location-library.js');
const { generateUserId } = await import('../src/user-library.js');
const { mountDialogRoot } = await import('../src/ui/app-dialog.js');
const { takePendingPlacement } = await import('../src/location-placement-nav.js');
const rangeSolverView = await import('../src/views/range-solver-view.js');

// showDialog() (the sync-target confirm) needs its overlay mounted once —
// same setup app-dialog.test.js's own suite uses — before any test in
// this file that clicks the sync button. Kept as its own root (not part
// of a mounted range-solver-view container) since app-dialog.js's overlay
// is always a sibling of the routed view, never inside it.
const dialogRoot = makeElement('div');
mountDialogRoot(dialogRoot);

test.beforeEach(() => {
  resetShotStateForTests();
  resetRangeSolverNavForTests();
  resetRangeSolverStateForTests();
  setIndicatorStyle('signs'); // restore the default so it doesn't leak into other tests
  localStorage.clear();
});

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.childNodes || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function findByClass(node, className, out = []) {
  if (node.className && node.className.split(' ').includes(className)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, className, out);
  return out;
}

function isHidden(node) {
  let n = node;
  while (n) {
    if (n.style && n.style.display === 'none') return true;
    n = n.parentNode;
  }
  return false;
}

function settle(ms = 50) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findByTitle(node, title) {
  if (node.title === title) return node;
  for (const child of node.childNodes || []) {
    const found = findByTitle(child, title);
    if (found) return found;
  }
  return null;
}

function makeTestLocation(overrides = {}) {
  return { id: generateUserId('location'), name: 'Home Range', altitudeM: null, photo: null, targets: [], ...overrides };
}

function makeTestTarget(overrides = {}) {
  return { id: generateUserId('target'), name: null, notes: null, rangeM: 650, losAngleDeg: 12, coords: null, ...overrides };
}

const TEST_PHOTO = 'data:image/jpeg;base64,AAA';

test('mount() builds a DOM tree without throwing, and enters Range Solver mode', async () => {
  const container = makeElement('main');
  assert.equal(isInRangeSolverMode(), false);
  const cleanup = rangeSolverView.mount(container);
  await settle();
  assert.ok(container.childNodes.length > 0);
  assert.equal(isInRangeSolverMode(), true);
  cleanup();
  assert.equal(isInRangeSolverMode(), false, 'cleanup should leave Range Solver mode');
});

test('mount() replaces its content on a second mount into the same container, and clears another view\'s leftovers', async () => {
  const container = makeElement('main');
  const cleanup1 = rangeSolverView.mount(container);
  await settle();
  const firstCount = container.childNodes.length;
  cleanup1();

  const cleanup2 = rangeSolverView.mount(container);
  await settle();
  assert.equal(container.childNodes.length, firstCount, 're-mounting duplicated content');

  const foreign = makeElement('div');
  foreign.id = 'leftover-from-another-view';
  container.appendChild(foreign);
  const cleanup3 = rangeSolverView.mount(container);
  await settle();
  assert.ok(!container.childNodes.includes(foreign), 'mount() left another view\'s content in place');
  cleanup3();
});

test('has no page header — every pixel counts on a small outdoor screen', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();
  assert.equal(findByTag(container, 'H1').length, 0);
  cleanup();
});

test('shows the Guns rifle/bullet summary at the top of the output pane', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();
  assert.ok(container.textContent.includes(t('guns.changeButton')));
  cleanup();
});

test('defaults to the Target tab; Wind and Atmosphere start hidden', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  assert.equal(getRangeSolverTab(), 'target');
  const rangeField = findById(container, 'targetRange');
  const windAngleField = findById(container, 'windAngle');
  const tempField = findById(container, 'tempC');
  assert.ok(rangeField, 'expected the Target range field');
  assert.ok(windAngleField, 'expected the Wind angle field');
  assert.ok(tempField, 'expected the Atmosphere temperature field');
  assert.ok(!isHidden(rangeField), 'Target tab should be visible by default');
  assert.ok(isHidden(windAngleField), 'Wind tab should start hidden');
  assert.ok(isHidden(tempField), 'Atmosphere tab should start hidden');

  cleanup();
});

test('switching the nav tab (setRangeSolverTab) swaps which input pane is visible', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  setRangeSolverTab('wind');
  const rangeField = findById(container, 'targetRange');
  const windAngleField = findById(container, 'windAngle');
  assert.ok(isHidden(rangeField), 'Target tab should hide once Wind is active');
  assert.ok(!isHidden(windAngleField), 'Wind tab should become visible');

  setRangeSolverTab('atmosphere');
  const tempField = findById(container, 'tempC');
  assert.ok(isHidden(windAngleField));
  assert.ok(!isHidden(tempField));

  cleanup();
});

test('computes a live, whole-click elevation/windage readout from the default rifle/bullet/target', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const [elevationValue, windageValue] = findByClass(container, 'range-solver-click-value');
  assert.ok(elevationValue, 'expected an elevation readout');
  assert.ok(windageValue, 'expected a windage readout');
  // Default target range (400m) is well past the default 100m zero, so
  // elevation should show a positive "dial up" correction; default wind
  // speed is 0, so windage should show flat zero. "+/-" is the indicator
  // style's own default (see range-solver-prefs.js).
  assert.match(elevationValue.textContent, /^\+\d+$/);
  assert.equal(windageValue.textContent, '0');

  cleanup();
});

test('the "Arrows" indicator style (a Settings preference, opted into over the "+/-" default) shows a leading arrow instead of a sign', async () => {
  setIndicatorStyle('arrows');
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const [elevationValue] = findByClass(container, 'range-solver-click-value');
  assert.match(elevationValue.textContent, /^↑\d+$/);

  cleanup();
});

test('changing the target range recomputes the elevation readout live, no Calculate button', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const [elevationValueBefore] = findByClass(container, 'range-solver-click-value');
  const before = elevationValueBefore.textContent;

  const rangeInput = findById(container, 'targetRange');
  rangeInput.value = '900';
  fireEvent(rangeInput, 'input');

  const [elevationValueAfter] = findByClass(container, 'range-solver-click-value');
  assert.notEqual(elevationValueAfter.textContent, before, 'a farther target should need more elevation correction');
  assert.equal(findByTag(container, 'BUTTON').some((b) => /calculate/i.test(b.textContent)), false);

  cleanup();
});

test('an emptied input (mid-edit) shows a "—" placeholder everywhere instead of NaN', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const rangeInput = findById(container, 'targetRange');
  rangeInput.value = '';
  fireEvent(rangeInput, 'input');

  const [elevationValue, windageValue] = findByClass(container, 'range-solver-click-value');
  assert.equal(elevationValue.textContent, '—');
  assert.equal(windageValue.textContent, '—');
  for (const v of findByClass(container, 'range-solver-footer-value')) assert.equal(v.textContent, '—');

  cleanup();
});

test('retyping a value after clearing it recovers a real result', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const rangeInput = findById(container, 'targetRange');
  rangeInput.value = '';
  fireEvent(rangeInput, 'input');
  rangeInput.value = '400';
  fireEvent(rangeInput, 'input');

  const [elevationValue] = findByClass(container, 'range-solver-click-value');
  assert.match(elevationValue.textContent, /^\+\d+$/);

  cleanup();
});

test('a nonzero crosswind produces a nonzero windage correction with a direction glyph', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const windSpeedInput = findById(container, 'windSpeed');
  windSpeedInput.value = '5';
  fireEvent(windSpeedInput, 'input');

  const [, windageValue] = findByClass(container, 'range-solver-click-value');
  assert.match(windageValue.textContent, /^[+−]\d+$/);

  cleanup();
});

test('the footer shows time of flight, residual velocity, and residual energy', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const footerValues = findByClass(container, 'range-solver-footer-value');
  assert.equal(footerValues.length, 3);
  for (const v of footerValues) assert.notEqual(v.textContent, '—');

  cleanup();
});

test('Target/Wind/Atmosphere inputs persist across unmount/remount via range-solver-state.js\'s own cookie', async () => {
  const container = makeElement('main');
  let cleanup = rangeSolverView.mount(container);
  await settle();

  const rangeInput = findById(container, 'targetRange');
  rangeInput.value = '777';
  fireEvent(rangeInput, 'input');

  const windSpeedInput = findById(container, 'windSpeed');
  windSpeedInput.value = '3';
  fireEvent(windSpeedInput, 'input');

  cleanup();
  assert.ok(getCookie('ballistics_range_solver_state_v1'), 'expected the state cookie to be written');

  const container2 = makeElement('main');
  cleanup = rangeSolverView.mount(container2);
  await settle();
  assert.equal(findById(container2, 'targetRange').value, '777');
  assert.equal(findById(container2, 'windSpeed').value, '3');
  cleanup();
});

test('always reopens on the Target tab, even if Wind/Atmosphere was active when it was last closed', async () => {
  const container = makeElement('main');
  let cleanup = rangeSolverView.mount(container);
  await settle();
  setRangeSolverTab('atmosphere');
  cleanup();

  const container2 = makeElement('main');
  cleanup = rangeSolverView.mount(container2);
  await settle();
  assert.equal(getRangeSolverTab(), 'target');
  cleanup();
});

// ---- Locations & Targets library integration ----

test('with no active location, only the manage-locations icon shows — no name, no target select', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  assert.ok(isHidden(findByClass(container, 'range-solver-location-name')[0]));
  assert.ok(isHidden(findById(container, 'rangeSolverTargetSelect')));
  assert.ok(!isHidden(findByTitle(container, t('rangeSolverLocations.manageButtonLabel'))));

  cleanup();
});

test('an active location shows its name and a target select populated from its own targets', async () => {
  const t1 = makeTestTarget({ name: 'Steel plate' });
  const t2 = makeTestTarget({ name: null }); // exercises the default-numbered label
  const location = saveUserLocation(makeTestLocation({ targets: [t1, t2] }));
  saveRangeSolverLocationState({ locationId: location.id, targetId: t1.id });
  saveRangeSolverTargetState({ rangeM: t1.rangeM, losAngleDeg: t1.losAngleDeg });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const nameEl = findByClass(container, 'range-solver-location-name')[0];
  assert.ok(!isHidden(nameEl));
  assert.equal(nameEl.textContent, 'Home Range');

  const select = findById(container, 'rangeSolverTargetSelect');
  assert.ok(!isHidden(select));
  const optionLabels = [...select.childNodes].map((o) => o.textContent);
  assert.deepEqual(optionLabels, ['Steel plate', t('rangeSolverLocations.defaultTargetName', { n: 2 })]);
  assert.equal(select.value, t1.id);
  assert.equal(findById(container, 'targetRange').value, '650');

  cleanup();
});

test('picking a different target in the select copies its range/LoS into the fields', async () => {
  const t1 = makeTestTarget({ rangeM: 650, losAngleDeg: 12 });
  const t2 = makeTestTarget({ rangeM: 300, losAngleDeg: -5 });
  const location = saveUserLocation(makeTestLocation({ targets: [t1, t2] }));
  saveRangeSolverLocationState({ locationId: location.id, targetId: t1.id });
  saveRangeSolverTargetState({ rangeM: t1.rangeM, losAngleDeg: t1.losAngleDeg });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const select = findById(container, 'rangeSolverTargetSelect');
  select.value = t2.id;
  fireEvent(select, 'change');

  assert.equal(findById(container, 'targetRange').value, '300');
  assert.equal(findById(container, 'losAngle').value, '-5');
  assert.ok(isHidden(findByTitle(container, t('rangeSolverLocations.syncButtonLabel'))), 'freshly loaded, nothing diverged yet');

  cleanup();
});

test('hand-editing range after a target loads shows the sync button; switching targets hides it again with no confirmation', async () => {
  const t1 = makeTestTarget({ rangeM: 650, losAngleDeg: 0 });
  const t2 = makeTestTarget({ rangeM: 300, losAngleDeg: 0 });
  const location = saveUserLocation(makeTestLocation({ targets: [t1, t2] }));
  saveRangeSolverLocationState({ locationId: location.id, targetId: t1.id });
  saveRangeSolverTargetState({ rangeM: t1.rangeM, losAngleDeg: t1.losAngleDeg });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const syncButton = findByTitle(container, t('rangeSolverLocations.syncButtonLabel'));
  assert.ok(isHidden(syncButton));

  const rangeInput = findById(container, 'targetRange');
  rangeInput.value = '700';
  fireEvent(rangeInput, 'input');
  assert.ok(!isHidden(syncButton), 'diverged from the loaded target — sync button should appear');

  // Switching targets discards the unsynced edit with no confirmation.
  const select = findById(container, 'rangeSolverTargetSelect');
  select.value = t2.id;
  fireEvent(select, 'change');
  assert.equal(rangeInput.value, '300');
  assert.ok(isHidden(syncButton));

  cleanup();
});

test('the sync button opens a confirm dialog; confirming writes the hand-edited values back into the saved target', async () => {
  const target = makeTestTarget({ rangeM: 650, losAngleDeg: 0 });
  const location = saveUserLocation(makeTestLocation({ targets: [target] }));
  saveRangeSolverLocationState({ locationId: location.id, targetId: target.id });
  saveRangeSolverTargetState({ rangeM: target.rangeM, losAngleDeg: target.losAngleDeg });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const rangeInput = findById(container, 'targetRange');
  rangeInput.value = '710';
  fireEvent(rangeInput, 'input');

  const syncButton = findByTitle(container, t('rangeSolverLocations.syncButtonLabel'));
  fireEvent(syncButton, 'click');

  const confirmButton = findByClass(dialogRoot, 'app-dialog-actions')[0].childNodes[0];
  assert.equal(confirmButton.textContent, t('rangeSolverLocations.syncConfirmButton'));
  fireEvent(confirmButton, 'click');

  assert.ok(isHidden(syncButton), 'no longer diverged once saved back');
  const stored = loadUserLocations().find((l) => l.id === location.id);
  assert.equal(stored.targets[0].rangeM, 710);

  cleanup();
});

test('a locationId that no longer resolves (deleted) falls back to "no location" and clears the saved pointer', async () => {
  saveRangeSolverLocationState({ locationId: 'deleted-location-id', targetId: 'deleted-target-id' });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  assert.ok(isHidden(findByClass(container, 'range-solver-location-name')[0]));
  assert.equal(loadRangeSolverLocationState().locationId, null);

  cleanup();
});

test('a location with zero targets shows its name but no target select, behaving like manual entry', async () => {
  const location = saveUserLocation(makeTestLocation({ targets: [] }));
  saveRangeSolverLocationState({ locationId: location.id, targetId: null });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  assert.ok(!isHidden(findByClass(container, 'range-solver-location-name')[0]));
  assert.ok(isHidden(findById(container, 'rangeSolverTargetSelect')));
  assert.ok(isHidden(findByTitle(container, t('rangeSolverLocations.syncButtonLabel'))));

  cleanup();
});

test('hand-editing the Atmosphere tab flips wasAtmosphereTouchedThisSession(), the signal "Set active" (see locations-view.js) checks before defaulting a location\'s altitude', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  assert.equal(wasAtmosphereTouchedThisSession(), false);
  setRangeSolverTab('atmosphere');
  const tempInput = findById(container, 'tempC');
  tempInput.value = '3';
  fireEvent(tempInput, 'input');

  assert.equal(wasAtmosphereTouchedThisSession(), true);

  cleanup();
});

test('the photo picker icon is hidden unless the active location has a photo', async () => {
  const withoutPhoto = saveUserLocation(makeTestLocation({ photo: null, targets: [] }));
  saveRangeSolverLocationState({ locationId: withoutPhoto.id, targetId: null });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  assert.ok(isHidden(findByTitle(container, t('rangeSolverLocations.photoPickerButtonLabel'))));

  cleanup();
});

test('an active location with a photo shows the photo picker icon; clicking it hands off to the full-screen picker route in select mode, without touching the current selection', async () => {
  const placed = makeTestTarget({ rangeM: 650, losAngleDeg: 0, coords: { x: 0.3, y: 0.4 } });
  // Named `savedLocation`, not `location` — this test asserts against the
  // real global `location.hash` below, which a same-named local would
  // otherwise shadow (see range-solver-view.js's own matching comment).
  const savedLocation = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [placed] }));
  saveRangeSolverLocationState({ locationId: savedLocation.id, targetId: placed.id });
  saveRangeSolverTargetState({ rangeM: placed.rangeM, losAngleDeg: placed.losAngleDeg });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const photoButton = findByTitle(container, t('rangeSolverLocations.photoPickerButtonLabel'));
  assert.ok(!isHidden(photoButton));

  fireEvent(photoButton, 'click');

  assert.equal(location.hash, '#/locations/place');
  assert.deepEqual(takePendingPlacement(), { locationId: savedLocation.id, targetId: null, returnPath: '/range-solver', selectMode: true });
  // The button's own handoff never touches the current selection itself —
  // picking a different target (if any) only happens inside the picker
  // route, tested in location-placement-view.test.js.
  assert.deepEqual(loadRangeSolverLocationState(), { locationId: savedLocation.id, targetId: placed.id });

  cleanup();
});
