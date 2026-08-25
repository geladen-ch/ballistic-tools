import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const locationsView = await import('../src/views/locations-view.js');
const { loadUserLocations, saveUserLocation, resetLocationLibraryForTests } = await import('../src/location-library.js');
const { generateUserId } = await import('../src/user-library.js');
const {
  loadRangeSolverLocationState, saveRangeSolverLocationState, loadRangeSolverTargetState, loadRangeSolverAtmosphereState,
  markAtmosphereTouched, resetRangeSolverStateForTests
} = await import('../src/range-solver-state.js');
const { standardAtmosphereAt } = await import('../src/engine/atmosphere.js');
const { takePendingPlacement } = await import('../src/location-placement-nav.js');

test.beforeEach(async () => {
  await resetLocationLibraryForTests();
  resetRangeSolverStateForTests();
  location.hash = '';
  global.confirm = () => true;
});

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function findInputs(node, out = []) {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName)) out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

function byId(node, id) {
  return findInputs(node).find((n) => n.id === id);
}

function buttonByKey(node, key) {
  return findByTag(node, 'BUTTON').find((b) => b.getAttribute('data-i18n') === key);
}

function byI18nKey(node, key, out = []) {
  if (node.getAttribute && node.getAttribute('data-i18n') === key) out.push(node);
  for (const child of node.childNodes || []) byI18nKey(child, key, out);
  return out[0];
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

function rowByText(container, text) {
  return findByClass(container, 'arsenal-row').find((r) => r.textContent.includes(text));
}

function currentSection(container) {
  return findByClass(container, 'locations-current')[0];
}

function knownSection(container) {
  return findByClass(container, 'locations-known')[0];
}

// Makes `location` the current one before mount, same effect clicking its
// Known-locations row would have — most tests below only care that a
// location *is* current, not about exercising the click itself.
function makeCurrent(location, targetId) {
  saveRangeSolverLocationState({ locationId: location.id, targetId: targetId ?? (location.targets[0]?.id ?? null) });
}

test('mount() builds a DOM tree, showing "No location" as current by default with an empty Known locations list', async () => {
  const container = makeElement('main');
  locationsView.mount(container);
  assert.ok(container.childNodes.length > 0);
  const current = currentSection(container);
  assert.ok(current.textContent.includes(t('rangeSolverLocations.currentLocationHeading')));
  assert.ok(current.textContent.includes(t('rangeSolverLocations.noLocationOption')));
});

test('adding a location via the form saves it and shows it in Known locations, not as current', async () => {
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(container, 'rangeSolverLocations.addLocationButton'), 'click');
  byId(container, 'locationName').value = 'Local Range';
  fireEvent(byId(container, 'locationName'), 'input');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.saveLocationButton'), 'click');

  const stored = loadUserLocations();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].name, 'Local Range');
  assert.ok(knownSection(container).textContent.includes('Local Range'));
  assert.ok(!currentSection(container).textContent.includes('Local Range'));
});

test('a location name is required', async () => {
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(container, 'rangeSolverLocations.addLocationButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.saveLocationButton'), 'click');

  assert.equal(loadUserLocations().length, 0);
});

test('"Add location" is hidden while any form is open (adding/editing a location, or one of the current location\'s targets)', async () => {
  const location = saveUserLocation(makeTestLocation());
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  assert.ok(buttonByKey(container, 'rangeSolverLocations.addLocationButton'), 'visible with no form open');

  fireEvent(buttonByKey(container, 'rangeSolverLocations.addLocationButton'), 'click');
  assert.equal(buttonByKey(container, 'rangeSolverLocations.addLocationButton'), undefined, 'hidden while adding a new location');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.cancelButton'), 'click');
  assert.ok(buttonByKey(container, 'rangeSolverLocations.addLocationButton'), 'visible again after cancel');

  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  assert.equal(buttonByKey(container, 'rangeSolverLocations.addLocationButton'), undefined, 'hidden while editing the current location');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.cancelButton'), 'click');

  fireEvent(buttonByKey(container, 'rangeSolverLocations.addTargetButton'), 'click');
  assert.equal(buttonByKey(container, 'rangeSolverLocations.addLocationButton'), undefined, 'hidden while adding one of its targets');
});

test('Edit and the target list only appear for the current location; Known-location rows only offer Save-to-file, Delete, and click-to-activate', async () => {
  const current = saveUserLocation(makeTestLocation({ name: 'Current One' }));
  const known = saveUserLocation(makeTestLocation({ name: 'Known One' }));
  makeCurrent(current);
  const container = makeElement('main');
  locationsView.mount(container);

  const currentRow = rowByText(currentSection(container), 'Current One');
  assert.ok(buttonByKey(currentRow, 'rangeSolverLocations.editButton'));
  assert.ok(buttonByKey(currentRow, 'rangeSolverLocations.saveToFileButton'));
  assert.ok(buttonByKey(currentRow, 'rangeSolverLocations.deleteButton'));
  assert.ok(currentSection(container).textContent.includes(t('rangeSolverLocations.targetsHeading')));

  const knownRow = rowByText(knownSection(container), 'Known One');
  assert.equal(buttonByKey(knownRow, 'rangeSolverLocations.editButton'), undefined, 'no Edit on a Known-locations row');
  assert.ok(buttonByKey(knownRow, 'rangeSolverLocations.saveToFileButton'));
  assert.ok(buttonByKey(knownRow, 'rangeSolverLocations.deleteButton'));
  assert.ok(!knownSection(container).textContent.includes(t('rangeSolverLocations.targetsHeading')), 'no target list for a Known-locations row');
});

test('clicking a Known-locations row activates it: moves it to Current, and the previous current location moves back to Known', async () => {
  const target = makeTestTarget({ rangeM: 777, losAngleDeg: 3 });
  const toActivate = saveUserLocation(makeTestLocation({ name: 'To Activate', targets: [target] }));
  const wasCurrent = saveUserLocation(makeTestLocation({ name: 'Was Current' }));
  makeCurrent(wasCurrent);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(rowByText(knownSection(container), 'To Activate'), 'click');

  assert.deepEqual(loadRangeSolverLocationState(), { locationId: toActivate.id, targetId: target.id });
  assert.deepEqual(loadRangeSolverTargetState(), { rangeM: 777, losAngleDeg: 3 });
  assert.equal(location.hash, '', 'stays on the Locations page — activating no longer navigates away');
  assert.ok(currentSection(container).textContent.includes('To Activate'));
  assert.ok(knownSection(container).textContent.includes('Was Current'));
  assert.ok(!knownSection(container).textContent.includes('To Activate'));
});

test('clicking the "No location" row in Known locations activates manual entry', async () => {
  const location = saveUserLocation(makeTestLocation());
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(rowByText(knownSection(container), t('rangeSolverLocations.noLocationOption')), 'click');

  assert.deepEqual(loadRangeSolverLocationState(), { locationId: null, targetId: null });
  assert.ok(currentSection(container).textContent.includes(t('rangeSolverLocations.noLocationOption')));
});

test('activating a location closes any open location/target edit form', async () => {
  const other = saveUserLocation(makeTestLocation({ name: 'Other' }));
  const current = saveUserLocation(makeTestLocation({ name: 'Editing Me' }));
  makeCurrent(current);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  assert.ok(byId(container, 'locationName'), 'edit form is open');

  fireEvent(rowByText(knownSection(container), 'Other'), 'click');
  assert.equal(byId(container, 'locationName'), undefined, 'edit form closed once a different location became current');
});

test('an altitude on the newly-activated location defaults the atmosphere to standard/50% humidity when untouched this session', async () => {
  const loc = saveUserLocation(makeTestLocation({ altitudeM: 800, targets: [] }));
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(rowByText(knownSection(container), 'Home Range'), 'click');

  const expected = standardAtmosphereAt(800);
  const stored = loadRangeSolverAtmosphereState();
  assert.equal(stored.humidityPct, 50);
  assert.equal(stored.altitudeM, 800);
  assert.equal(stored.tempC, expected.tempC);
  assert.equal(stored.pressureHpa, expected.pressureHpa);
  assert.equal(stored.atmospherePreset, 'custom');
  assert.ok(loc.altitudeM === 800); // sanity: this is the location we expect
});

test('activating a location leaves the atmosphere untouched once the user has hand-edited it this session', async () => {
  markAtmosphereTouched();
  saveUserLocation(makeTestLocation({ altitudeM: 800, targets: [] }));
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(rowByText(knownSection(container), 'Home Range'), 'click');

  assert.equal(loadRangeSolverAtmosphereState(), null);
});

test('deleting a Known-locations row removes it after confirmation', async () => {
  saveUserLocation(makeTestLocation({ name: 'To Delete' }));
  const container = makeElement('main');
  locationsView.mount(container);

  global.confirm = () => true;
  fireEvent(buttonByKey(knownSection(container), 'rangeSolverLocations.deleteButton'), 'click');

  assert.equal(loadUserLocations().length, 0);
});

test('declining the delete confirmation keeps the location', async () => {
  saveUserLocation(makeTestLocation({ name: 'Keep Me' }));
  const container = makeElement('main');
  locationsView.mount(container);

  global.confirm = () => false;
  fireEvent(buttonByKey(knownSection(container), 'rangeSolverLocations.deleteButton'), 'click');

  assert.equal(loadUserLocations().length, 1);
  global.confirm = () => true;
});

test('deleting the current location falls back to "No location"', async () => {
  const location = saveUserLocation(makeTestLocation({ name: 'Current Doomed' }));
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.deleteButton'), 'click');

  assert.equal(loadUserLocations().length, 0);
  assert.deepEqual(loadRangeSolverLocationState(), { locationId: null, targetId: null });
  assert.ok(currentSection(container).textContent.includes(t('rangeSolverLocations.noLocationOption')));
});

test('adding a target to the current location saves it nested under that location', async () => {
  const location = saveUserLocation(makeTestLocation());
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(container, 'rangeSolverLocations.addTargetButton'), 'click');
  byId(container, 'targetRange').value = '500';
  fireEvent(byId(container, 'targetRange'), 'input');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.saveTargetButton'), 'click');

  const stored = loadUserLocations().find((l) => l.id === location.id);
  assert.equal(stored.targets.length, 1);
  assert.equal(stored.targets[0].rangeM, 500);
});

test('naming a new target the same as an existing sibling at the same location shows a live, non-blocking duplicate warning', async () => {
  const existing = makeTestTarget({ name: 'Berm', rangeM: 400 });
  const location = saveUserLocation(makeTestLocation({ targets: [existing] }));
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(container, 'rangeSolverLocations.addTargetButton'), 'click');

  const nameInput = byId(container, 'targetName');
  const warning = () => findByTag(container, 'P').find((p) => p.getAttribute && p.getAttribute('data-i18n') === 'rangeSolverLocations.duplicateTargetNameWarning');
  assert.equal(warning().style.display, 'none', 'no warning on a freshly-opened blank form');

  nameInput.value = 'Berm';
  fireEvent(nameInput, 'input');
  assert.equal(warning().style.display, '', 'duplicating a sibling target name should warn live');
  assert.equal(nameInput.classList.contains('field-invalid'), false, 'duplicate-name is a non-blocking warning, not a validation error');

  nameInput.value = 'Other Berm';
  fireEvent(nameInput, 'input');
  assert.equal(warning().style.display, 'none');
});

test('a target with no pin is badged "not placed" only once its location has a photo; placing the pin (or removing the photo) clears it', async () => {
  const placed = makeTestTarget({ name: 'Alpha', coords: { x: 0.5, y: 0.5 } });
  const unplaced = makeTestTarget({ name: 'Bravo', coords: null });
  const location = saveUserLocation(makeTestLocation({ name: 'No Photo Range', photo: null, targets: [placed, unplaced] }));
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  assert.equal(findByClass(container, 'not-placed-badge').length, 0, 'no photo yet — nothing to be "not placed" on');

  saveUserLocation({ ...loadUserLocations()[0], photo: 'data:image/jpeg;base64,AAA' });
  locationsView.mount(container); // re-mount to pick up the freshly-saved photo, same as a real navigation would

  assert.equal(findByClass(rowByText(container, 'Alpha'), 'not-placed-badge').length, 0);
  assert.equal(findByClass(rowByText(container, 'Bravo'), 'not-placed-badge').length, 1);
});

test('the photo field shows a thumbnail and "Remove photo" only once a photo is set', async () => {
  const withPhoto = saveUserLocation(makeTestLocation({ photo: 'data:image/jpeg;base64,AAA' }));
  const container = makeElement('main');
  makeCurrent(withPhoto);
  locationsView.mount(container);

  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  assert.notEqual(findByClass(container, 'location-photo-thumb')[0].style.display, 'none');
  assert.equal(byI18nKey(container, 'rangeSolverLocations.noPhotoHint').style.display, 'none');
  assert.notEqual(buttonByKey(container, 'rangeSolverLocations.removePhotoButton').style.display, 'none');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.cancelButton'), 'click');

  const withoutPhoto = saveUserLocation(makeTestLocation({ name: 'No Photo Range', photo: null }));
  makeCurrent(withoutPhoto);
  locationsView.mount(container);
  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  assert.equal(findByClass(container, 'location-photo-thumb')[0].style.display, 'none');
  assert.notEqual(byI18nKey(container, 'rangeSolverLocations.noPhotoHint').style.display, 'none');
  assert.equal(buttonByKey(container, 'rangeSolverLocations.removePhotoButton').style.display, 'none');
});

test('saving the current location without touching its photo field preserves the existing photo', async () => {
  const location = saveUserLocation(makeTestLocation({ photo: 'data:image/jpeg;base64,AAA' }));
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.saveLocationButton'), 'click');

  assert.equal(loadUserLocations().find((l) => l.id === location.id).photo, location.photo);
});

test('"Remove photo" then Save clears the current location\'s photo', async () => {
  const location = saveUserLocation(makeTestLocation({ photo: 'data:image/jpeg;base64,AAA' }));
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.removePhotoButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.saveLocationButton'), 'click');

  assert.equal(loadUserLocations().find((l) => l.id === location.id).photo, null);
});

test('saving the current location without changing its photo leaves every target\'s placed pin untouched', async () => {
  const target = makeTestTarget({ coords: { x: 0.4, y: 0.6 } });
  const location = saveUserLocation(makeTestLocation({ photo: 'data:image/jpeg;base64,AAA', targets: [target] }));
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.saveLocationButton'), 'click');

  assert.deepEqual(loadUserLocations().find((l) => l.id === location.id).targets[0].coords, { x: 0.4, y: 0.6 });
});

test('"Remove photo" then Save clears every target\'s placed pin too; Cancel instead leaves them untouched', async () => {
  const target = makeTestTarget({ coords: { x: 0.4, y: 0.6 } });
  const location = saveUserLocation(makeTestLocation({ photo: 'data:image/jpeg;base64,AAA', targets: [target] }));
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.removePhotoButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.cancelButton'), 'click');

  assert.deepEqual(loadUserLocations().find((l) => l.id === location.id).targets[0].coords, { x: 0.4, y: 0.6 }, 'Cancel discards the removal, pin untouched');

  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.removePhotoButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.saveLocationButton'), 'click');

  assert.equal(loadUserLocations().find((l) => l.id === location.id).targets[0].coords, null, 'saving the removal clears the pin');
});

test('the "not placed" badges update live as the photo field changes, before Save — and Cancel reverts them to the persisted state', async () => {
  const placed = makeTestTarget({ name: 'Placed', coords: { x: 0.4, y: 0.6 } });
  const unplaced = makeTestTarget({ name: 'Unplaced', coords: null });
  const location = saveUserLocation(makeTestLocation({ photo: 'data:image/jpeg;base64,AAA', targets: [placed, unplaced] }));
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  assert.equal(findByClass(rowByText(container, 'Placed'), 'not-placed-badge').length, 0, 'baseline: placed target has no badge');
  assert.equal(findByClass(rowByText(container, 'Unplaced'), 'not-placed-badge').length, 1, 'baseline: unplaced target is badged');

  fireEvent(buttonByKey(container, 'rangeSolverLocations.removePhotoButton'), 'click');
  assert.equal(findByClass(rowByText(container, 'Placed'), 'not-placed-badge').length, 1, 'live: removing the photo badges the previously-placed target too');
  assert.equal(findByClass(rowByText(container, 'Unplaced'), 'not-placed-badge').length, 1, 'live: still badged');

  fireEvent(buttonByKey(container, 'rangeSolverLocations.cancelButton'), 'click');
  fireEvent(buttonByKey(currentSection(container), 'rangeSolverLocations.editButton'), 'click');
  assert.equal(findByClass(rowByText(container, 'Placed'), 'not-placed-badge').length, 0, 'reverted: back to no badge after Cancel');
  assert.equal(findByClass(rowByText(container, 'Unplaced'), 'not-placed-badge').length, 1, 'reverted: still badged, as it always was');
});

test('a target row only offers "Place it" once the location has a photo, and only for an already-saved target', async () => {
  const target = makeTestTarget();
  const location = saveUserLocation(makeTestLocation({ photo: null, targets: [target] }));
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  const targetRow = rowByText(container, t('rangeSolverLocations.defaultTargetName', { n: 1 }));
  assert.equal(buttonByKey(targetRow, 'rangeSolverLocations.placeItButton'), undefined, 'no photo yet');

  saveUserLocation({ ...loadUserLocations()[0], photo: 'data:image/jpeg;base64,AAA' });
  locationsView.mount(container);
  const targetRowWithPhoto = rowByText(container, t('rangeSolverLocations.defaultTargetName', { n: 1 }));
  assert.ok(buttonByKey(targetRowWithPhoto, 'rangeSolverLocations.placeItButton'));

  // The Add-target form's own "Place it" — only for existing targets. The
  // existing target's own row keeps its "Place it" throughout, so this
  // checks the *count* doesn't grow once the (photo-less-target) Add form
  // opens, rather than asserting none exist anywhere in the page.
  const beforeAdd = findByTag(container, 'BUTTON').filter((b) => b.getAttribute('data-i18n') === 'rangeSolverLocations.placeItButton').length;
  fireEvent(buttonByKey(container, 'rangeSolverLocations.addTargetButton'), 'click');
  const afterAdd = findByTag(container, 'BUTTON').filter((b) => b.getAttribute('data-i18n') === 'rangeSolverLocations.placeItButton').length;
  assert.equal(afterAdd, beforeAdd, 'a brand-new, not-yet-saved target has nowhere to attach a pin to yet');
});

test('clicking a target row\'s "Place it" hands off the right location/target context and navigates to the placement route', async () => {
  const target = makeTestTarget();
  // Named `savedLocation`, not `location` — this test asserts against the
  // real global `location.hash` below, which a same-named local would
  // otherwise shadow (see locations-view.js's own matching comment).
  const savedLocation = saveUserLocation(makeTestLocation({ photo: 'data:image/jpeg;base64,AAA', targets: [target] }));
  makeCurrent(savedLocation);
  const container = makeElement('main');
  locationsView.mount(container);

  const targetRow = rowByText(container, t('rangeSolverLocations.defaultTargetName', { n: 1 }));
  fireEvent(buttonByKey(targetRow, 'rangeSolverLocations.placeItButton'), 'click');

  assert.equal(location.hash, '#/locations/place');
  assert.deepEqual(takePendingPlacement(), { locationId: savedLocation.id, targetId: target.id, returnPath: '/locations', selectMode: false });
});

test('the target edit form\'s own "Place it" button hands off the same way', async () => {
  const target = makeTestTarget();
  const savedLocation = saveUserLocation(makeTestLocation({ photo: 'data:image/jpeg;base64,AAA', targets: [target] }));
  makeCurrent(savedLocation);
  const container = makeElement('main');
  locationsView.mount(container);

  const targetRow = rowByText(container, t('rangeSolverLocations.defaultTargetName', { n: 1 }));
  fireEvent(buttonByKey(targetRow, 'rangeSolverLocations.editButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.placeItButton'), 'click');

  assert.equal(location.hash, '#/locations/place');
  assert.deepEqual(takePendingPlacement(), { locationId: savedLocation.id, targetId: target.id, returnPath: '/locations', selectMode: false });
});

test('an existing target\'s pin coords pass through untouched when the target form is saved with no pin interaction', async () => {
  const target = makeTestTarget({ coords: { x: 0.4, y: 0.6 } });
  const location = saveUserLocation(makeTestLocation({ photo: 'data:image/jpeg;base64,AAA', targets: [target] }));
  makeCurrent(location);
  const container = makeElement('main');
  locationsView.mount(container);

  const targetRow = rowByText(container, t('rangeSolverLocations.defaultTargetName', { n: 1 }));
  fireEvent(buttonByKey(targetRow, 'rangeSolverLocations.editButton'), 'click');
  fireEvent(buttonByKey(container, 'rangeSolverLocations.saveTargetButton'), 'click');

  const stored = loadUserLocations().find((l) => l.id === location.id);
  assert.deepEqual(stored.targets[0].coords, { x: 0.4, y: 0.6 });
});

test('exporting a Known-locations row clears its unsaved badge', async () => {
  const location = saveUserLocation(makeTestLocation());
  assert.equal(location.unsaved, true);
  const container = makeElement('main');
  locationsView.mount(container);

  fireEvent(buttonByKey(knownSection(container), 'rangeSolverLocations.saveToFileButton'), 'click');

  assert.equal(loadUserLocations()[0].unsaved, false);
});
