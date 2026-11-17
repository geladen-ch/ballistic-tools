// Optional latitude and longitude on a location: the form and its checks, the list row, and the record's round trips
// (library, export, merge, tombstone).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent } from './helpers/fake-dom.js';
import { degToRad } from '../src/quantity.js';
import { near } from './helpers/weather-fixtures.js';

installFakeDom();
installFakeIndexedDb();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const locationsView = await import('../src/views/locations-view.js');
const {
  loadUserLocations, saveUserLocation, deleteUserLocation, resetLocationLibraryForTests, reloadLocationLibraryForTests,
  flushLocationLibraryWritesForTests, loadUserLocationsWithTombstones
} = await import('../src/location-library.js');
const { generateUserId } = await import('../src/user-library.js');
const { resetRangeSolverStateForTests } = await import('../src/range-solver-state.js');
const { buildExportPayload, serializeExport, parseImportPayload, resolveImportItem } = await import('../src/location-export.js');
const { equivalent } = await import('../src/sync/merge.js');
const { formatCoordinates, hasCoordinates } = await import('../src/ui/locations/coordinates-text.js');
const { FIELD_BOUNDS } = await import('../src/units.js');

const rad = degToRad;

test.beforeEach(async () => {
  await resetLocationLibraryForTests();
  resetRangeSolverStateForTests();
  location.hash = '';
});

const all = (node, test, out = []) => { if (test(node)) out.push(node); for (const c of node.childNodes || []) all(c, test, out); return out; };
const byId = (root, id) => all(root, (n) => n.id === id)[0];
const buttonByKey = (root, key) => all(root, (n) => n.tagName === 'BUTTON' && n.getAttribute('data-i18n') === key)[0];
const byKey = (root, key) => all(root, (n) => n.getAttribute && n.getAttribute('data-i18n') === key)[0];
const type = (root, id, value) => { const n = byId(root, id); n.value = value; fireEvent(n, 'input'); };

function openAddForm() {
  const container = makeElement('main');
  locationsView.mount(container);
  fireEvent(buttonByKey(container, 'rangeSolverLocations.addLocationButton'), 'click');
  return container;
}
const save = (container) => fireEvent(buttonByKey(container, 'rangeSolverLocations.saveLocationButton'), 'click');
const warning = (container) => all(container, (n) => n.className === 'hint warning' && n.textContent && n.style.display !== 'none').map((n) => n.textContent);

test('the bounds are ±90° and ±180°, in radians', () => {
  assert.equal(FIELD_BOUNDS.latitudeRad.max, Math.PI / 2); assert.equal(FIELD_BOUNDS.latitudeRad.min, -Math.PI / 2);
  assert.equal(FIELD_BOUNDS.longitudeRad.max, Math.PI); assert.equal(FIELD_BOUNDS.longitudeRad.min, -Math.PI);
});

test('typing a position saves it in radians next to the altitude', () => {
  const c = openAddForm();
  type(c, 'locationName', 'Range 1'); type(c, 'altitudeM', '470');
  type(c, 'latitudeRad', '47.37'); type(c, 'longitudeRad', '8.54');
  save(c);
  const [l] = loadUserLocations();
  near(l.latitudeRad, rad(47.37), 1e-12); near(l.longitudeRad, rad(8.54), 1e-12);
  assert.equal(l.altitudeM, 470);
});

test('no position is fine: both fields stay empty (null) and no warning is shown', () => {
  const c = openAddForm();
  type(c, 'locationName', 'Plain');
  assert.deepEqual(warning(c), []);
  save(c);
  const [l] = loadUserLocations();
  assert.equal(l.latitudeRad ?? null, null); assert.equal(l.longitudeRad ?? null, null);
});

test('latitude without longitude (or the other way round) is refused with a message; both empty is allowed again', () => {
  const c = openAddForm();
  type(c, 'locationName', 'Half');
  type(c, 'latitudeRad', '47.37');
  assert.deepEqual(warning(c), [t('rangeSolverLocations.errorCoordinatesPair')]);
  save(c);
  assert.equal(loadUserLocations().length, 0);
  type(c, 'latitudeRad', ''); type(c, 'longitudeRad', '8.54');
  assert.deepEqual(warning(c), [t('rangeSolverLocations.errorCoordinatesPair')]);
  save(c);
  assert.equal(loadUserLocations().length, 0);
  type(c, 'longitudeRad', '');
  assert.deepEqual(warning(c), []);
  save(c);
  assert.equal(loadUserLocations().length, 1);
});

test('exactly 0, 0 is refused; 0 with another coordinate is a real place', () => {
  const c = openAddForm();
  type(c, 'locationName', 'Null Island');
  type(c, 'latitudeRad', '0'); type(c, 'longitudeRad', '0');
  assert.deepEqual(warning(c), [t('rangeSolverLocations.errorCoordinatesZero')]);
  save(c);
  assert.equal(loadUserLocations().length, 0);
  type(c, 'longitudeRad', '0.5');
  assert.deepEqual(warning(c), []);
  save(c);
  const [l] = loadUserLocations();
  assert.equal(l.latitudeRad, 0); near(l.longitudeRad, rad(0.5), 1e-12);
});

test('out-of-range values are refused by the field itself and nothing is saved', () => {
  for (const [lat, lon] of [['90.5', '8'], ['-91', '8'], ['47', '180.5'], ['47', '-181']]) {
    const c = openAddForm();
    type(c, 'locationName', 'Far'); type(c, 'latitudeRad', lat); type(c, 'longitudeRad', lon);
    save(c);
    assert.equal(loadUserLocations().length, 0, `${lat}, ${lon}`);
  }
  const c = openAddForm();
  type(c, 'locationName', 'Edge'); type(c, 'latitudeRad', '90'); type(c, 'longitudeRad', '-180');
  save(c);
  assert.equal(loadUserLocations().length, 1);
});

test('pasting "47.37, 8.54" into either box fills both; pasting a plain number is left to the box', () => {
  const c = openAddForm();
  let prevented = 0;
  fireEvent(byId(c, 'latitudeRad'), 'paste', { clipboardData: { getData: () => '47.37, 8.54' }, preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
  assert.equal(byId(c, 'latitudeRad').value, '47.37'); assert.equal(byId(c, 'longitudeRad').value, '8.54');
  fireEvent(byId(c, 'longitudeRad'), 'paste', { clipboardData: { getData: () => `47°22'12"N 8°32'24"W` }, preventDefault() { prevented++; } });
  assert.equal(prevented, 2);
  assert.equal(byId(c, 'latitudeRad').value, '47.37'); assert.equal(byId(c, 'longitudeRad').value, '-8.54');
  fireEvent(byId(c, 'latitudeRad'), 'paste', { clipboardData: { getData: () => '12.5' }, preventDefault() { prevented++; } });
  assert.equal(prevented, 2);
  fireEvent(byId(c, 'latitudeRad'), 'paste', { clipboardData: { getData: () => 'nonsense' }, preventDefault() { prevented++; } });
  assert.equal(prevented, 2);
});

test('a position without an altitude shows the non-blocking advice; saving still works', () => {
  const c = openAddForm();
  const advice = byKey(c, 'rangeSolverLocations.coordinatesNeedAltitude');
  assert.equal(advice.style.display, 'none');
  type(c, 'locationName', 'No height'); type(c, 'latitudeRad', '47.37'); type(c, 'longitudeRad', '8.54');
  assert.equal(advice.style.display, '');
  type(c, 'altitudeM', '470');
  assert.equal(advice.style.display, 'none');
  type(c, 'altitudeM', '');
  save(c);
  assert.equal(loadUserLocations().length, 1);
});

test('the list row shows the position, and editing starts from the saved values', () => {
  saveUserLocation({ id: generateUserId('location'), name: 'Home', altitudeM: 470, latitudeRad: rad(47.37), longitudeRad: rad(8.54), photo: null, targets: [] });
  const c = makeElement('main');
  locationsView.mount(c);
  assert.ok(c.textContent.includes('47.37, 8.54'), c.textContent);
  assert.equal(formatCoordinates(rad(47.3779), rad(-8.5657)), '47.3779, -8.5657');
  assert.equal(formatCoordinates(rad(47.123456789), rad(8)), '47.12346, 8');
  assert.equal(hasCoordinates({ latitudeRad: 0, longitudeRad: 0 }), true);
  assert.equal(hasCoordinates({ latitudeRad: 1 }), false);
  assert.equal(hasCoordinates(null), false);
});

test('the position survives a reload of the library, and an export file carries it and imports it back', async () => {
  const id = generateUserId('location');
  saveUserLocation({ id, name: 'Home', altitudeM: 470, latitudeRad: rad(47.37), longitudeRad: rad(8.54), photo: null, targets: [] });
  await flushLocationLibraryWritesForTests();
  await reloadLocationLibraryForTests();
  const [l] = loadUserLocations();
  near(l.latitudeRad, rad(47.37), 1e-15); near(l.longitudeRad, rad(8.54), 1e-15);
  const text = serializeExport(buildExportPayload({ locations: [l] }));
  const file = JSON.parse(text).locations[0];
  assert.equal(file.latitudeRad, l.latitudeRad); assert.equal(file.longitudeRad, l.longitudeRad);
  const { locations } = parseImportPayload(text);
  const r = resolveImportItem(locations[0], { existingList: [], mode: 'overwrite', generateId: () => 'new', nameTaken: () => false });
  assert.equal(r.record.latitudeRad, l.latitudeRad); assert.equal(r.record.longitudeRad, l.longitudeRad);
});

test('a deleted location (tombstone) carries no position, so it cannot grow keys on a reload', async () => {
  const id = generateUserId('location');
  saveUserLocation({ id, name: 'Gone', altitudeM: 1, latitudeRad: rad(47), longitudeRad: rad(8), photo: null, targets: [] });
  deleteUserLocation(id);
  await flushLocationLibraryWritesForTests();
  const tomb = loadUserLocationsWithTombstones().find((e) => e.id === id);
  assert.ok(tomb.deletedAt);
  assert.ok(!('latitudeRad' in tomb) && !('longitudeRad' in tomb));
  const before = JSON.stringify(tomb);
  await reloadLocationLibraryForTests();
  assert.equal(JSON.stringify(loadUserLocationsWithTombstones().find((e) => e.id === id)), before);
});

test('sync merge: an absent position equals a null one; a different position is a real difference', () => {
  const base = { id: 'a', name: 'A', altitudeM: 470, modifiedAt: '2026-11-16T10:00:00.000Z', modifiedBy: 'd1', targets: [] };
  assert.equal(equivalent({ ...base, latitudeRad: null, longitudeRad: null }, base), true);
  assert.equal(equivalent({ ...base, latitudeRad: rad(47), longitudeRad: rad(8) }, { ...base, latitudeRad: rad(47), longitudeRad: rad(8) }), true);
  assert.equal(equivalent({ ...base, latitudeRad: rad(47), longitudeRad: rad(8) }, { ...base, latitudeRad: rad(47.1), longitudeRad: rad(8) }), false);
  assert.equal(equivalent({ ...base, latitudeRad: rad(47), longitudeRad: rad(8) }, base), false);
});
