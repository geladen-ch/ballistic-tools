import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';
import { degToRad } from '../src/quantity.js';

installFakeDom();
installFakeIndexedDb();

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
const { setIndicatorStyle, setOutputUnit } = await import('../src/range-solver-prefs.js');
const { setSpinDriftMode } = await import('../src/spin-drift-prefs.js');
const { setUnit, resetUnits } = await import('../src/prefs.js');
const { getCookie } = await import('../src/cookies.js');
const { saveUserLocation, loadUserLocations, resetLocationLibraryForTests } = await import('../src/location-library.js');
const { generateUserId } = await import('../src/user-library.js');
const { takePendingPlacement } = await import('../src/location-placement-nav.js');
const rangeSolverView = await import('../src/views/range-solver-view.js');
const { setFireConfig, resetFireConfigForTests } = await import('../src/range-solver-fire-config.js');
const { removeCookie } = await import('../src/cookies.js');

test.beforeEach(async () => {
  resetShotStateForTests();
  resetRangeSolverNavForTests();
  resetRangeSolverStateForTests();
  setIndicatorStyle('signs'); // restore the default so it doesn't leak into other tests
  setOutputUnit('clicks'); // ditto — the output-unit tests below change this cookie
  resetUnits(); // ditto — several tests below change distance/wind-speed unit prefs
  setSpinDriftMode('off'); // ditto — the spin-drift tests below change this cookie
  await resetLocationLibraryForTests();
  resetFireConfigForTests();
  for (const name of ['ballistics_range_solver_fire_config_v1', 'ballistics_range_solver_scope_view_v1', 'ballistics_range_card_row_count_v1']) removeCookie(name);
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

test('opens on the Fire! pane (range field and wind dial visible); the Atmosphere pane starts hidden', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  assert.equal(getRangeSolverTab(), 'fire');
  const rangeField = findById(container, 'targetRange');
  const windAngleField = findById(container, 'windAngle');
  const tempField = findById(container, 'tempC');
  assert.ok(rangeField && windAngleField && tempField);
  assert.ok(!isHidden(rangeField));
  assert.ok(!isHidden(windAngleField));
  assert.ok(isHidden(tempField), 'Atmosphere starts hidden');
  cleanup();
});

test('switching the pane (setRangeSolverTab) swaps Fire! and Atmosphere', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  setRangeSolverTab('atmosphere');
  assert.ok(isHidden(findById(container, 'targetRange')));
  assert.ok(isHidden(findById(container, 'windAngle')));
  assert.ok(!isHidden(findById(container, 'tempC')));

  setRangeSolverTab('fire');
  assert.ok(!isHidden(findById(container, 'targetRange')));
  assert.ok(!isHidden(findById(container, 'windAngle')));
  assert.ok(isHidden(findById(container, 'tempC')));
  cleanup();
});

test('the Fire! pane holds one cell per shown element; the readout can be switched off', async () => {
  const container = makeElement('main');
  let cleanup = rangeSolverView.mount(container);
  await settle();
  const pane = findByClass(container, 'fire-pane')[0];
  for (const id of ['gun', 'context', 'readout', 'flight', 'manual', 'wind']) {
    assert.equal(findByClass(pane, `fire-cell-${id}`).length, 1, id);
    assert.ok(pane.className.includes(`fire-has-${id}`), id);
  }
  for (const id of ['scope', 'list', 'picker']) assert.equal(findByClass(pane, `fire-cell-${id}`).length, 0, `${id}: nothing to show`);
  cleanup();

  setFireConfig({ readout: false });
  cleanup = rangeSolverView.mount(container);
  await settle();
  assert.equal(findByClass(container, 'fire-cell-readout').length, 0);
  assert.equal(findByClass(container, 'fire-cell-flight').length, 1, 'the flight data stays');
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

test('the "mrad" output-unit preference shows a one-decimal angular correction instead of whole clicks', async () => {
  setOutputUnit('mrad');
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const [elevationValue, windageValue] = findByClass(container, 'range-solver-click-value');
  // Same default scenario as the whole-click test above (positive elevation,
  // flat-zero windage) but at one decimal place, no scope click value involved.
  assert.match(elevationValue.textContent, /^\+\d+\.\d$/);
  assert.equal(windageValue.textContent, '0.0');

  cleanup();
});

test('the "MOA" output-unit preference also shows a one-decimal angular correction', async () => {
  setOutputUnit('moa');
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const [elevationValue] = findByClass(container, 'range-solver-click-value');
  assert.match(elevationValue.textContent, /^\+\d+\.\d$/);

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

test('the "U/D, L/R" indicator style shows U for up-elevation and R for a right (positive) windage correction', async () => {
  setIndicatorStyle('udlr');
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const [elevationValue] = findByClass(container, 'range-solver-click-value');
  assert.match(elevationValue.textContent, /^U\d+$/);

  const windSpeedInput = findById(container, 'windSpeed');
  windSpeedInput.value = '5';
  fireEvent(windSpeedInput, 'input');

  const [, windageValue] = findByClass(container, 'range-solver-click-value');
  assert.match(windageValue.textContent, /^[RL]\d+$/);

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

test('target range default depends on the distance unit: 500 m or 500 yd', async () => {
  for (const [unit, expected] of [['m', 500], ['yd', 500]]) {
    setUnit('distance', unit);
    const container = makeElement('main');
    const cleanup = rangeSolverView.mount(container);
    await settle();
    assert.equal(Number(findById(container, 'targetRange').value), expected, `unit ${unit}`);
    cleanup();
  }
});

test('wind speed always defaults to 0, regardless of the wind-speed unit', async () => {
  for (const unit of ['m/s', 'ft/s', 'mph', 'km/h']) {
    setUnit('windSpeed', unit);
    const container = makeElement('main');
    const cleanup = rangeSolverView.mount(container);
    await settle();
    assert.equal(Number(findById(container, 'windSpeed').value), 0, `unit ${unit}`);
    cleanup();
  }
});

test('wind speed stepper is 0.5 m/s, 1 mph, 1 ft/s, or 1 km/h depending on the wind-speed unit', async () => {
  for (const [unit, expected] of [['m/s', 0.5], ['mph', 1], ['ft/s', 1], ['km/h', 1]]) {
    setUnit('windSpeed', unit);
    const container = makeElement('main');
    const cleanup = rangeSolverView.mount(container);
    await settle();
    assert.equal(Number(findById(container, 'windSpeed').step), expected, `unit ${unit}`);
    cleanup();
  }
});

test('clicking the wind speed stepper in mph adds a clean 1 mph, with no floating-point noise', async () => {
  setUnit('windSpeed', 'mph');
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const incButton = findByClass(container, 'wind-control-inc')[0];
  fireEvent(incButton, 'click');
  const windInput = findById(container, 'windSpeed');

  assert.equal(windInput.value, 1);

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

// Range Solver reads spinDriftMode: getSpinDriftMode() directly — the
// user's own Settings choice among 'off'/'litz'/'mccoy4dof' — and passes
// it straight through to trajectory.js's computeImpact(), which
// dispatches on it via resolveSpinDriftMode() (see range-solver-view.js's
// own recompute()). The default rifle/bullet (DEFAULT_BULLET_STATE in
// bullet-section.js, matching defaults in rifle-section.js) already
// carries a full mass/caliber/length/twist rate, so these exercise the
// real dispatch through trajectory.js end to end, not just a stub.
for (const mode of ['litz', 'mccoy4dof']) {
  test(`with spinDriftMode '${mode}' selected, windage reflects real spin drift, not flat zero, even with no wind`, async () => {
    setSpinDriftMode(mode);
    const container = makeElement('main');
    const cleanup = rangeSolverView.mount(container);
    await settle();

    const [, windageValue] = findByClass(container, 'range-solver-click-value');
    assert.match(windageValue.textContent, /^[+−]\d+$/, `expected a nonzero, signed windage correction from spin drift alone, got "${windageValue.textContent}"`);

    cleanup();
  });
}

test("with spinDriftMode 'off' selected, windage stays flat zero even though the data could support spin drift — the user's choice to disable it is respected, not silently upgraded", async () => {
  setSpinDriftMode('off');
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const [, windageValue] = findByClass(container, 'range-solver-click-value');
  assert.equal(windageValue.textContent, '0');

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

test('Target/Wind/Atmosphere inputs persist across unmount/remount via range-solver-state.js\'s own cookie (Wind is embedded in the Target tab)', async () => {
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
  assert.ok(getCookie('ballistics_range_solver_state_v2'), 'expected the state cookie to be written');

  const container2 = makeElement('main');
  cleanup = rangeSolverView.mount(container2);
  await settle();
  assert.equal(findById(container2, 'targetRange').value, '777');
  assert.equal(findById(container2, 'windSpeed').value, '3');
  cleanup();
});

test('always reopens on the Fire! pane, even if Atmosphere was active when it was last closed', async () => {
  const container = makeElement('main');
  let cleanup = rangeSolverView.mount(container);
  await settle();
  setRangeSolverTab('atmosphere');
  cleanup();

  const container2 = makeElement('main');
  cleanup = rangeSolverView.mount(container2);
  await settle();
  assert.equal(getRangeSolverTab(), 'fire');
  cleanup();
});

// ---- Locations & Targets library integration ----

const rowsOf = (container) => findByClass(container, 'range-card-row');
const activeRows = (container) => findByClass(container, 'range-card-row--active');
const rowByName = (container, name) => rowsOf(container).find((r) => r.textContent.includes(name));

test('with no active location: no location name, no targets list, no photo picker, no picture icon', async () => {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  assert.ok(isHidden(findByClass(container, 'fire-context-location')[0]));
  assert.equal(findByClass(container, 'fire-cell-list').length, 0);
  assert.equal(findByClass(container, 'fire-cell-picker').length, 0);
  assert.ok(isHidden(findByTitle(container, t('rangeSolverLocations.photoPickerButtonLabel'))));
  assert.equal(findById(container, 'rangeSolverTargetSelect'), null, 'the target dropdown is gone');
  cleanup();
});

test('an active location shows its name and a targets list sorted by range, the selected target enlarged', async () => {
  const t1 = makeTestTarget({ name: 'Steel plate', rangeM: 650 });
  const t2 = makeTestTarget({ name: null, rangeM: 300 }); // exercises the default-numbered label
  const location = saveUserLocation(makeTestLocation({ targets: [t1, t2] }));
  saveRangeSolverLocationState({ locationId: location.id, targetId: t1.id });
  saveRangeSolverTargetState({ rangeM: t1.rangeM, losAngleRad: degToRad(t1.losAngleDeg) });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const name = findByClass(container, 'fire-context-name')[0];
  assert.ok(!isHidden(name));
  assert.equal(name.textContent, 'Home Range');
  const rows = rowsOf(container);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].textContent.includes(t('rangeSolverLocations.defaultTargetName', { n: 2 })), 'nearest first');
  assert.ok(rows[1].textContent.includes('Steel plate'));
  assert.deepEqual(activeRows(container), [rows[1]]);
  assert.equal(findById(container, 'targetRange').value, '650');
  cleanup();
});

test('tapping a row copies its range/LoS into the fields and enlarges it', async () => {
  const t1 = makeTestTarget({ name: 'Far', rangeM: 650, losAngleDeg: 12 });
  const t2 = makeTestTarget({ name: 'Near', rangeM: 300, losAngleDeg: -5 });
  const location = saveUserLocation(makeTestLocation({ targets: [t1, t2] }));
  saveRangeSolverLocationState({ locationId: location.id, targetId: t1.id });
  saveRangeSolverTargetState({ rangeM: t1.rangeM, losAngleRad: degToRad(t1.losAngleDeg) });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  fireEvent(rowByName(container, 'Near'), 'click');
  assert.equal(findById(container, 'targetRange').value, '300');
  assert.equal(findById(container, 'losAngle').value, '-5');
  assert.equal(loadRangeSolverLocationState().targetId, t2.id);
  assert.ok(activeRows(container)[0].textContent.includes('Near'));
  cleanup();
});

test('a target with a fractional LoS angle stays selected — the field\'s own display rounding is not a hand edit', async () => {
  // Regression: the LoS field rounds to tenths of a degree on every
  // setEngineValue(); a target stored as 5.57° used to read as hand-edited
  // (5.6 !== 5.57) the instant it was selected, deselecting it at once.
  const t1 = makeTestTarget({ name: 'Flat', rangeM: 650, losAngleDeg: 0 });
  const t2 = makeTestTarget({ name: 'Uphill', rangeM: 300, losAngleDeg: 5.57 });
  const location = saveUserLocation(makeTestLocation({ targets: [t1, t2] }));
  saveRangeSolverLocationState({ locationId: location.id, targetId: t1.id });
  saveRangeSolverTargetState({ rangeM: t1.rangeM, losAngleRad: degToRad(t1.losAngleDeg) });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  fireEvent(rowByName(container, 'Uphill'), 'click');
  assert.equal(findById(container, 'losAngle').value, '5.6');
  assert.equal(loadRangeSolverLocationState().targetId, t2.id, 'still selected');
  assert.ok(activeRows(container)[0].textContent.includes('Uphill'));
  cleanup();
});

test('hand-editing the range deselects: every row the same size, nothing written back; a row tap selects again', async () => {
  const t1 = makeTestTarget({ name: 'Far', rangeM: 650, losAngleDeg: 0 });
  const t2 = makeTestTarget({ name: 'Near', rangeM: 300, losAngleDeg: 0 });
  const location = saveUserLocation(makeTestLocation({ targets: [t1, t2] }));
  saveRangeSolverLocationState({ locationId: location.id, targetId: t1.id });
  saveRangeSolverTargetState({ rangeM: t1.rangeM, losAngleRad: degToRad(t1.losAngleDeg) });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();
  assert.equal(activeRows(container).length, 1);

  const rangeInput = findById(container, 'targetRange');
  rangeInput.value = '700';
  fireEvent(rangeInput, 'input');
  assert.equal(activeRows(container).length, 0, 'no enlarged row for a hand-typed range');
  assert.equal(loadRangeSolverLocationState().targetId, null);
  assert.equal(loadUserLocations().find((l) => l.id === location.id).targets[0].rangeM, 650, 'never written back');

  fireEvent(rowByName(container, 'Near'), 'click');
  assert.equal(rangeInput.value, '300');
  assert.equal(activeRows(container).length, 1);
  cleanup();
});

test('a locationId that no longer resolves (deleted) falls back to "no location" and clears the saved pointer', async () => {
  saveRangeSolverLocationState({ locationId: 'deleted-location-id', targetId: 'deleted-target-id' });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  assert.ok(isHidden(findByClass(container, 'fire-context-location')[0]));
  assert.equal(loadRangeSolverLocationState().locationId, null);
  cleanup();
});

test('a location with no targets counts as no location: no name, no list', async () => {
  const location = saveUserLocation(makeTestLocation({ targets: [] }));
  saveRangeSolverLocationState({ locationId: location.id, targetId: null });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  assert.ok(isHidden(findByClass(container, 'fire-context-location')[0]));
  assert.equal(findByClass(container, 'fire-cell-list').length, 0);
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

test('a photo location shows the inline photo picker, not the picture icon, while list or picker is on', async () => {
  const placed = makeTestTarget({ rangeM: 650, losAngleDeg: 0, coords: { x: 0.3, y: 0.4 } });
  const savedLocation = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [placed] }));
  saveRangeSolverLocationState({ locationId: savedLocation.id, targetId: placed.id });

  const container = makeElement('main');
  let cleanup = rangeSolverView.mount(container);
  await settle();
  assert.equal(findByClass(container, 'fire-cell-picker').length, 1);
  assert.ok(isHidden(findByTitle(container, t('rangeSolverLocations.photoPickerButtonLabel'))));
  cleanup();

  setFireConfig({ picker: false });
  cleanup = rangeSolverView.mount(container);
  await settle();
  assert.equal(findByClass(container, 'fire-cell-picker').length, 0);
  assert.ok(isHidden(findByTitle(container, t('rangeSolverLocations.photoPickerButtonLabel'))), 'the list still offers the targets');
  cleanup();
});

test('with list and picker off, a photo location gets the prominent picture icon, which hands off to the full-screen picker', async () => {
  setFireConfig({ list: false, picker: false });
  const placed = makeTestTarget({ rangeM: 650, losAngleDeg: 0, coords: { x: 0.3, y: 0.4 } });
  // Named `savedLocation`, not `location` — the test asserts against the
  // real global `location.hash` below.
  const savedLocation = saveUserLocation(makeTestLocation({ photo: TEST_PHOTO, targets: [placed] }));
  saveRangeSolverLocationState({ locationId: savedLocation.id, targetId: placed.id });
  saveRangeSolverTargetState({ rangeM: placed.rangeM, losAngleRad: degToRad(placed.losAngleDeg) });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();

  const photoButton = findByTitle(container, t('rangeSolverLocations.photoPickerButtonLabel'));
  assert.ok(!isHidden(photoButton));
  assert.ok(photoButton.className.includes('prominent'));
  fireEvent(photoButton, 'click');
  assert.equal(location.hash, '#/locations/place');
  assert.deepEqual(takePendingPlacement(), { locationId: savedLocation.id, targetId: null, returnPath: '/range-solver', selectMode: true });
  assert.deepEqual(loadRangeSolverLocationState(), { locationId: savedLocation.id, targetId: placed.id });
  cleanup();
});

test('with list and picker off and no photo, there is no picture icon', async () => {
  setFireConfig({ list: false, picker: false });
  const savedLocation = saveUserLocation(makeTestLocation({ photo: null, targets: [makeTestTarget()] }));
  saveRangeSolverLocationState({ locationId: savedLocation.id, targetId: null });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();
  assert.ok(isHidden(findByTitle(container, t('rangeSolverLocations.photoPickerButtonLabel'))));
  cleanup();
});

// ---- Ignore line-of-sight angles ----

const elevationText = (container) => findByClass(container, 'range-solver-click-value')[0].textContent;

test('ignoring LoS angles hides the LoS field and angle meter and solves every shot level', async () => {
  saveRangeSolverTargetState({ rangeM: 600, losAngleRad: degToRad(0) });
  const container = makeElement('main');
  let cleanup = rangeSolverView.mount(container);
  await settle();
  const level = elevationText(container);
  cleanup();

  saveRangeSolverTargetState({ rangeM: 600, losAngleRad: degToRad(30) });
  cleanup = rangeSolverView.mount(container);
  await settle();
  const steep = elevationText(container);
  assert.notEqual(steep, level, 'a 30° shot needs less elevation');
  cleanup();

  setFireConfig({ ignoreLos: true });
  cleanup = rangeSolverView.mount(container);
  await settle();
  assert.equal(elevationText(container), level, 'solved as level');
  assert.ok(isHidden(findById(container, 'losAngle')));
  assert.equal(findById(container, 'losAngle').value, '30', 'the stored angle is untouched');
  cleanup();
});

test('ignoring LoS is blocked by a target at 5° or more: the LoS field stays and is used', async () => {
  setFireConfig({ ignoreLos: true });
  const steep = makeTestTarget({ name: 'Steep', rangeM: 600, losAngleDeg: -5 });
  const savedLocation = saveUserLocation(makeTestLocation({ targets: [steep] }));
  saveRangeSolverLocationState({ locationId: savedLocation.id, targetId: steep.id });
  saveRangeSolverTargetState({ rangeM: 600, losAngleRad: degToRad(-5) });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();
  assert.ok(!isHidden(findById(container, 'losAngle')));
  assert.equal(findById(container, 'losAngle').value, '-5');
  cleanup();
});

test('while LoS angles are ignored, a row tap still copies the target\'s LoS, and only the range decides a hand edit', async () => {
  setFireConfig({ ignoreLos: true });
  const t1 = makeTestTarget({ name: 'Near', rangeM: 300, losAngleDeg: 2 });
  const t2 = makeTestTarget({ name: 'Far', rangeM: 650, losAngleDeg: -3 });
  const savedLocation = saveUserLocation(makeTestLocation({ targets: [t1, t2] }));
  saveRangeSolverLocationState({ locationId: savedLocation.id, targetId: t1.id });
  saveRangeSolverTargetState({ rangeM: 300, losAngleRad: degToRad(2) });

  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle();
  fireEvent(rowByName(container, 'Far'), 'click');
  assert.equal(findById(container, 'losAngle').value, '-3');
  assert.equal(loadRangeSolverLocationState().targetId, t2.id);
  cleanup();
});
