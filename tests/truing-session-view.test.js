import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
await warmCatalogs();

const { makeElement } = await import('./helpers/fake-dom.js');
const truingSessionView = await import('../src/views/truing-session-view.js');
const { conditionsSummary } = await import('../src/ui/truing-session/conditions.js');
const units = await import('../src/ui/truing-session/units.js');
const farCheckText = (key) => t(key, { far: units.dist(870), err: units.dist(20), cost: units.angle(0.3, 1), ...units.missExample() });
const { resetShotStateForTests, saveRifleState } = await import('../src/shot-state.js');
const { saveUserRifle, generateUserId } = await import('../src/user-library.js');
const { resetLocationLibraryForTests, saveUserLocation } = await import('../src/location-library.js');
const { saveRangeSolverLocationState, resetRangeSolverStateForTests } = await import('../src/range-solver-state.js');
const { resetTruingSessionStateForTests, saveTruingSessionState } = await import('../src/truing-session-state.js');

function settle(ms = 40) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.beforeEach(async () => {
  localStorage.clear();
  resetShotStateForTests();
  resetTruingSessionStateForTests();
  await resetLocationLibraryForTests();
  if (resetRangeSolverStateForTests) resetRangeSolverStateForTests();
});

test('with no active Arsenal rifle/cartridge, shows the Arsenal gate instead of throwing', () => {
  const container = makeElement('main');
  assert.doesNotThrow(() => truingSessionView.mount(container));
  assert.ok(container.textContent.includes(t('truingSession.gate.needsArsenal')));
});

test('with an Arsenal rifle but no active location, shows the location gate', async () => {
  const bulletId = 'geladen-308-178-eld-m';
  saveUserRifle({
    id: 'r1', name: 'My Rifle', defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [{ id: 'c1', name: 'My Load', muzzleVelocity: 792.48, bulletId }]
  });
  saveRifleState({ library: { rifleId: 'r1', cartridgeId: 'c1' } });
  await settle();

  const container = makeElement('main');
  assert.doesNotThrow(() => truingSessionView.mount(container));
  assert.ok(container.textContent.includes(t('truingSession.gate.needsLocation')));
});

test('with an Arsenal rifle and an active location with a target, mounts the Prepare phase without throwing', async () => {
  setUpArsenalAndLocation();
  await settle();

  const container = makeElement('main');
  assert.doesNotThrow(() => truingSessionView.mount(container));
  await settle();
  assert.ok(container.textContent.includes(t('truingSession.rangeGrading.heading')));
});

test('the Prepare phase shows the active location\'s name, and "Start shooting" stays disabled until "All checked, all good" is confirmed', async () => {
  setUpArsenalAndLocation();
  await settle();

  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();

  assert.ok(container.textContent.includes('My Range'), 'expected the active location\'s name to be shown');

  const buttons = findByTag(container, 'BUTTON');
  const startButton = buttons.find((b) => b.textContent === t('truingSession.prepare.startShootingButton'));
  assert.ok(startButton, 'expected a Start shooting button');
  assert.equal(startButton.disabled, true, 'Start shooting must stay disabled until the location recheck is confirmed');
  assert.ok(container.textContent.includes(t('truingSession.prepare.startBlockedHint')));

  const confirmBox = findByTag(container, 'INPUT').find((i) => i.id === 'truingRangeRechecked');
  assert.ok(confirmBox, 'expected the "All checked, all good" confirmation checkbox');
  confirmBox.checked = true;
  fireEvent(confirmBox, 'change');

  // Confirming re-renders Prepare (gaps and grade are recomputed from the
  // confirmed distances), so look the button up again.
  const startAfter = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.prepare.startShootingButton'));
  assert.equal(startAfter.disabled, true, 'the conditions still have to be confirmed');
  assert.ok(container.textContent.includes(t('truingSession.prepare.startBlockedConditions')));
  confirmConditions(container);
  const startReady = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.prepare.startShootingButton'));
  assert.equal(startReady.disabled, false, 'Start shooting must unlock once the recheck and the conditions are confirmed');
});

function tickRangeRechecked(container) {
  const box = findByTag(container, 'INPUT').find((i) => i.id === 'truingRangeRechecked');
  assert.ok(box, 'expected the range re-check checkbox');
  box.checked = true;
  fireEvent(box, 'change');
}

function confirmConditions(container) {
  const box = findByTag(container, 'INPUT').find((i) => i.id === 'truingConditionsConfirmed');
  assert.ok(box, 'expected the conditions confirmation checkbox');
  box.checked = true;
  fireEvent(box, 'change');
}

test('the tool has its own conditions card, seeded once from the shared atmosphere and frozen into the session at Start', async () => {
  const { saveAtmosphereState } = await import('../src/shot-state.js');
  saveAtmosphereState({ tempC: 4, pressureHpa: 950, humidityPct: 30, windSpeed: 0, windAngle: 90 });
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  assert.ok(container.textContent.includes(t('truingSession.conditions.heading')));
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  assert.equal(loadTruingSessionState().conditions.pressureHpa, 950, 'seeded from the shared atmosphere the first time');

  // the shared atmosphere changing later (another tool) does not move the tool's own conditions
  saveAtmosphereState({ tempC: 30, pressureHpa: 1010 });
  tickRangeRechecked(container);
  confirmConditions(container);
  const start = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.prepare.startShootingButton'));
  assert.equal(start.disabled, false);
  fireEvent(start, 'click');
  await settle();
  const persisted = loadTruingSessionState();
  assert.equal(persisted.phase, 'shoot');
  assert.equal(persisted.sessionConditions.tempC, 4);
  assert.equal(persisted.sessionConditions.pressureHpa, 950);
  assert.ok(container.textContent.includes(t('truingSession.conditions.used', { summary: conditionsSummary(persisted.sessionConditions) })), 'the Shoot screen says which air it uses');
  assert.ok(!findByTag(container, 'INPUT').some((i) => i.id === 'truingConditionsConfirmed'), 'the card is not editable once shooting');
});

test('a sea-level-reduced pressure at altitude is called out on the conditions card; a plausible one is not', async () => {
  const { saveAtmosphereState } = await import('../src/shot-state.js');
  saveAtmosphereState({ tempC: 8, pressureHpa: 1013, humidityPct: 50 });
  setUpArsenalAndLocation();
  await settle();
  const { loadUserLocations, saveUserLocation: save } = await import('../src/location-library.js');
  save({ ...loadUserLocations()[0], altitudeM: 1500 });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const warning = (c) => findByTag(c, 'P').find((p) => p.className && String(p.className).includes('warning') && p.textContent.includes('1500'));
  assert.ok(warning(container), 'QNH warning shown');

  const { resetShotStateForTests: reset } = await import('../src/shot-state.js');
  reset();
  const { resetTruingSessionStateForTests: resetTs } = await import('../src/truing-session-state.js');
  resetTs();
  localStorage.clear();
  saveAtmosphereState({ tempC: 8, pressureHpa: 850, humidityPct: 50 });
  setUpArsenalAndLocation();
  await settle();
  save({ ...loadUserLocations()[0], altitudeM: 1500 });
  const container2 = makeElement('main');
  truingSessionView.mount(container2);
  await settle();
  assert.ok(!warning(container2), 'no warning for a real station pressure');
});

function setUpArsenalAndLocation(targetSpecs = [{ name: 'Near', rangeM: 100, losAngleDeg: 0 }, { name: 'Far', rangeM: 870, losAngleDeg: 0 }]) {
  const bulletId = 'geladen-308-178-eld-m';
  saveUserRifle({
    id: 'r1', name: 'My Rifle', defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [{ id: 'c1', name: 'My Load', muzzleVelocity: 792.48, bulletId }]
  });
  saveRifleState({ library: { rifleId: 'r1', cartridgeId: 'c1' } });

  const locationId = generateUserId('location');
  saveUserLocation({
    id: locationId, name: 'My Range', altitudeM: null, photo: null,
    targets: targetSpecs.map((tg) => ({ id: generateUserId('target'), notes: null, coords: null, ...tg }))
  });
  saveRangeSolverLocationState({ locationId, targetId: null });
}

test('the Shoot phase mounts without throwing', async () => {
  setUpArsenalAndLocation();
  await settle();
  saveTruingSessionState({ phase: 'shoot' });

  const container = makeElement('main');
  assert.doesNotThrow(() => truingSessionView.mount(container));
  await settle();
  assert.ok(container.textContent.includes(t('truingSession.shoot.liveHeading')));
});

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('recording a group in the Shoot phase updates the live panel and persists the session', async () => {
  setUpArsenalAndLocation();
  await settle();
  saveTruingSessionState({ phase: 'shoot' });

  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();

  const inputs = findByTag(container, 'INPUT');
  const shotsInput = inputs.find((i) => i.getAttribute('type') === 'number' && i !== inputs[inputs.length - 1]);
  assert.ok(shotsInput, 'expected a shots-count number input');
  const numberInputs = inputs.filter((i) => i.getAttribute('type') === 'number');
  assert.ok(numberInputs.length >= 2, 'expected at least shots and come-up number inputs');
  numberInputs[0].value = '4';
  fireEvent(numberInputs[0], 'input');
  numberInputs[1].value = '101'; // clicks of 0.1 mrad
  fireEvent(numberInputs[1], 'input');

  const buttons = findByTag(container, 'BUTTON');
  const recordButton = buttons.find((b) => b.textContent === t('truingSession.shoot.recordGroupButton'));
  assert.ok(recordButton, 'expected a Record group button');
  fireEvent(recordButton, 'click');
  await settle();

  assert.ok(container.textContent.includes(t('truingSession.shoot.liveNoDataYet')) === false, 'live panel should no longer say "nothing recorded yet"');

  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  const persisted = loadTruingSessionState();
  assert.equal(persisted.shootSession.groups.length, 1);
  assert.equal(persisted.shootSession.groups[0].shots, 4);
  assert.ok(Math.abs(persisted.shootSession.groups[0].observedComeUp - 10.1) < 1e-9, 'entered in clicks, stored in mrad');
});

test('the Prepare screen tells how many rounds are worth bringing, and says the numbers are minimums', async () => {
  setUpArsenalAndLocation([
    { name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 500, losAngleDeg: 0 }, { name: 'D', rangeM: 800, losAngleDeg: 0 }
  ]);
  await settle();
  saveTruingSessionState({ phase: 'prepare' });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(300);
  const text = container.textContent;
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetHeading')), 'the budget advice is drawn after the rest of the panel');
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetMinimum')), 'and says it is a minimum: rounds the spotter cannot see do not count');
  // the default homework (no chronograph, nothing checked) has a knee; the default budget of 20 is that knee here, so it needs no row of its own
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetRowKnee')));
  assert.ok(!text.includes(t('truingSession.rangeGrading.budgetRowYours')), 'the default budget sits on a row of the table already');
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetRowPlus', { n: 10 })) && text.includes(t('truingSession.rangeGrading.budgetRowPlus', { n: 20 })));
});

async function recordGroupNow(container, shots, comeUp) {
  // the shots and come-up fields have no id; the weather fields (when opened) do
  const numberInputs = findByTag(container, 'INPUT').filter((i) => i.getAttribute('type') === 'number' && !i.id);
  numberInputs[0].value = String(shots); fireEvent(numberInputs[0], 'input');
  numberInputs[1].value = String(Number((comeUp / 0.1).toFixed(3))); fireEvent(numberInputs[1], 'input'); // the field takes clicks of 0.1 mrad
  const record = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.recordGroupButton'));
  assert.ok(record, 'expected a Record group button');
  fireEvent(record, 'click');
  await settle();
}

test('the Shoot phase follows the plan: the planned distances in order with their planned shots, and nothing after the plan is done', async () => {
  setUpArsenalAndLocation([
    { name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 500, losAngleDeg: 0 },
    { name: 'D', rangeM: 600, losAngleDeg: 0 }, { name: 'E', rangeM: 800, losAngleDeg: 0 }
  ]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', plan: { ranges: [100, 300, 800], shots: [1, 5, 6], targets: [100, 300, 800] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();

  assert.ok(container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(100) })));
  assert.ok(container.textContent.includes(t('truingSession.shoot.plannedStep', { shots: 1 })), 'the near group is planned at one round');
  await recordGroupNow(container, 1, 0);
  // the ladder alone would take the farthest safe distance (500 or more); the plan says 300
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(300) })), 'the next planned distance, not the farthest safe one');
  assert.ok(container.textContent.includes(t('truingSession.shoot.plannedStep', { shots: 5 })));
  await recordGroupNow(container, 5, 1.6);
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(800) })));
  await recordGroupNow(container, 6, 8.6);
  assert.ok(container.textContent.includes(t('truingSession.shoot.ladderDone')), 'every planned distance is shot: the ladder is complete, no leftover distances proposed');
  assert.ok(!container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(500) })));
  assert.ok(!container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(600) })));
});

// Observations generated from the view's own bullet (resolved through the
// same cartridge section the view uses) with a known drag error injected,
// so the fixture stays consistent with whatever the catalog says about it.
async function truthComeUps(dragPct, ranges) {
  const { cartridgeSection } = await import('../src/ui/sections/cartridge-section.js');
  const { comeUpMrad } = await import('../src/engine/truing-session.js');
  const section = cartridgeSection({});
  await section.setLibraryCartridge({ muzzleVelocity: 792.48, bulletId: 'geladen-308-178-eld-m' });
  const state = {
    ...section.getValues(), zeroRange: 100, sightHeight: 50,
    tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 50, windSpeed: 0, windAngle: 90, losAngleDeg: 0
  };
  const truth = { ...state, bcGainFactor: 1 / (1 + dragPct / 100) };
  return ranges.map((r) => comeUpMrad(truth, r));
}

async function concludeFixture({ velocities, rechecked = true }) {
  const [near, far] = await truthComeUps(4, [100, 870]);
  saveTruingSessionState({
    phase: 'conclude',
    // A real session can't reach Shoot without "All checked, all good",
    // which is what lowers each target's blunder weight; without it a
    // single far group can't rule out a ranging blunder well enough for a
    // BC write (Scenario E) -- the correct call, not a bug.
    rangeRecheckedThisSession: rechecked,
    homeworkState: { chronographAvailable: true, mvSD: 3 },
    shootSession: {
      groups: [
        { rangeM: 100, observedComeUp: near, shots: 4, sigmaMrad: 0.15, resolved: false },
        { rangeM: 870, observedComeUp: far, shots: 8, sigmaMrad: 0.06, resolved: true }
      ],
      chronoVelocities: velocities,
      missedImpactCount: 0, triedRanges: [100, 870], farthestValidatedM: 870, confidenceZ: 2
    }
  });
}

const TEN_READINGS = [792.5, 793.1, 791.8, 792.9, 792.2, 793.4, 792.0, 792.7, 792.6, 792.3];

test('the Conclude phase offers to save a resolved, chronographed BC correction, and saving compounds it onto the cartridge', async () => {
  setUpArsenalAndLocation();
  await settle();
  await concludeFixture({ velocities: TEN_READINGS });

  const container = makeElement('main');
  assert.doesNotThrow(() => truingSessionView.mount(container));
  await settle(80);

  const saveButton = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.conclusion.saveButton'));
  assert.ok(saveButton, 'expected a save-to-cartridge button for a resolved, chronographed BC finding');
  assert.ok(findByTag(container, 'BUTTON').some((b) => b.textContent === t('truingSession.choice.sessionOnly')), 'the "this session only" alternative must be offered alongside');

  fireEvent(saveButton, 'click');

  const { loadUserRifles } = await import('../src/user-library.js');
  const updatedCartridge = loadUserRifles().find((r) => r.id === 'r1').cartridges.find((c) => c.id === 'c1');
  // +4% drag injected -> a factor near 1/1.04 = 0.962.
  assert.ok(updatedCartridge.bcGainFactor > 0.93 && updatedCartridge.bcGainFactor < 0.99, `got ${updatedCartridge.bcGainFactor}`);
});

test('acceptance 3: a ticked chronograph box with no readings captured never offers a BC write', async () => {
  setUpArsenalAndLocation();
  await settle();
  await concludeFixture({ velocities: [] });

  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(80);

  assert.ok(!findByTag(container, 'BUTTON').some((b) => b.textContent === t('truingSession.conclusion.saveButton')));
});

test('fewer than 5 captured readings (misses marked null) never offers a BC write', async () => {
  setUpArsenalAndLocation();
  await settle();
  await concludeFixture({ velocities: [792.5, null, 793.1, null, 791.8, 792.9] });

  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(80);

  assert.ok(!findByTag(container, 'BUTTON').some((b) => b.textContent === t('truingSession.conclusion.saveButton')));
});

test('"Start a new session" discards the session after a second tap', async () => {
  setUpArsenalAndLocation();
  await settle();
  await concludeFixture({ velocities: TEN_READINGS });

  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(80);

  const newSession = () => findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.conclusion.newSessionButton') || b.textContent === t('truingSession.conclusion.newSessionConfirm'));
  fireEvent(newSession(), 'click');
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  assert.ok(loadTruingSessionState().shootSession, 'one tap must not discard anything');
  fireEvent(newSession(), 'click');
  const persisted = loadTruingSessionState();
  assert.equal(persisted.shootSession, undefined);
  assert.equal(persisted.phase, 'prepare');
  assert.equal(persisted.rangeRecheckedThisSession, undefined);
});

function inputById(container, id) {
  return findByTag(container, 'INPUT').find((i) => i.getAttribute('id') === id);
}

test('homework answers survive a remount (they are read from the same slice they are written to)', async () => {
  setUpArsenalAndLocation();
  await settle();

  const first = makeElement('main');
  truingSessionView.mount(first);
  await settle();
  const zero = inputById(first, 'truingZeroVerified');
  zero.checked = true;
  fireEvent(zero, 'change');

  const second = makeElement('main');
  truingSessionView.mount(second);
  await settle();
  assert.equal(inputById(second, 'truingZeroVerified').checked, true);
});

function distanceInputs(container) {
  return findByTag(container, 'TABLE').flatMap((tbl) => findByTag(tbl, 'INPUT')).filter((_, i) => i % 2 === 0);
}

async function editFarDistanceAndConfirm(container, value) {
  const far = distanceInputs(container).find((i) => String(i.value) === '870');
  far.value = String(value);
  fireEvent(far, 'change');
  await settle();
  tickRangeRechecked(container);
  await settle();
}

test('step 7: a corrected distance asks "update the location card / this session only"; session-only leaves the location untouched', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();

  await editFarDistanceAndConfirm(container, 855);
  const sessionOnly = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.choice.sessionOnly'));
  assert.ok(sessionOnly, 'expected the two-way choice after a changed distance');
  fireEvent(sessionOnly, 'click');
  await settle();

  const { loadUserLocations } = await import('../src/location-library.js');
  assert.ok(loadUserLocations()[0].targets.some((tg) => tg.rangeM === 870), 'the location record must be unchanged');
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  const persisted = loadTruingSessionState();
  assert.ok(Object.values(persisted.targetOverrides).some((ov) => ov.rangeM === 855));
  assert.equal(persisted.rangeRecheckedThisSession, true);
});

test('step 7: "update the main location card" writes the corrected distance back', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();

  await editFarDistanceAndConfirm(container, 855);
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.choice.updateCard')), 'click');
  await settle();

  const { loadUserLocations } = await import('../src/location-library.js');
  assert.ok(loadUserLocations()[0].targets.some((tg) => tg.rangeM === 855));
});

test('step 5a: declaring the range flat never writes an angle anywhere, even when a distance on an angled target is corrected', async () => {
  const bulletId = 'geladen-308-178-eld-m';
  saveUserRifle({
    id: 'r1', name: 'My Rifle', defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [{ id: 'c1', name: 'My Load', muzzleVelocity: 792.48, bulletId }]
  });
  saveRifleState({ library: { rifleId: 'r1', cartridgeId: 'c1' } });
  const locationId = generateUserId('location');
  saveUserLocation({
    id: locationId, name: 'Slight Slope', altitudeM: null, photo: null,
    targets: [
      { id: generateUserId('target'), name: 'Near', rangeM: 100, losAngleDeg: 0, notes: null, coords: null },
      { id: generateUserId('target'), name: 'Far', rangeM: 870, losAngleDeg: 3, notes: null, coords: null }
    ]
  });
  saveRangeSolverLocationState({ locationId, targetId: null });
  await settle();

  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const flat = inputById(container, 'truingFlatRange');
  assert.ok(flat, 'a recorded angle of 3 degrees keeps the flat checkbox on offer');
  assert.equal(flat.checked, false, 'a nonzero recorded angle leaves it unticked by default');
  flat.checked = true;
  fireEvent(flat, 'change');
  await settle();

  await editFarDistanceAndConfirm(container, 860);
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.choice.updateCard')), 'click');
  await settle();

  const { loadUserLocations } = await import('../src/location-library.js');
  const far = loadUserLocations()[0].targets.find((tg) => tg.name === 'Far');
  assert.equal(far.rangeM, 860);
  assert.equal(far.losAngleDeg, 3, 'the recorded angle must survive the flat declaration');
});

test('the Conclude phase mounts without throwing, with no groups recorded', async () => {
  setUpArsenalAndLocation();
  await settle();
  saveTruingSessionState({ phase: 'conclude' });

  const container = makeElement('main');
  assert.doesNotThrow(() => truingSessionView.mount(container));
  await settle();
  assert.ok(container.textContent.includes(t('truingSession.conclusion.noData')));
});

async function preparePromptText(targetSpecs) {
  setUpArsenalAndLocation(targetSpecs);
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  return container.textContent;
}

test('the flat-range checkbox is never ticked by default, even when every recorded angle is 0', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const flat = inputById(container, 'truingFlatRange');
  assert.ok(flat, 'with all-zero recorded angles the flat checkbox is on offer');
  assert.equal(flat.checked, false, 'a location card cannot tell "flat" from "never measured", so flat is never assumed');
});

test('far-target cross-check: with nothing near the far target, Prepare asks for its distance and angle again', async () => {
  const text = await preparePromptText([{ name: 'Near', rangeM: 100, losAngleDeg: 0 }, { name: 'Far', rangeM: 870, losAngleDeg: 0 }]);
  assert.ok(text.includes(farCheckText('truingSession.prepare.farCheckDistanceAngle')), 'flat is not assumed, so the angle is asked for too');
});

test('far-target cross-check: once the user declares the range flat, only the distance is asked for', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const flat = inputById(container, 'truingFlatRange');
  flat.checked = true;
  fireEvent(flat, 'change');
  await settle();
  const text = container.textContent;
  assert.ok(text.includes(farCheckText('truingSession.prepare.farCheckDistance')));
  assert.ok(!text.includes(farCheckText('truingSession.prepare.farCheckDistanceAngle')));
});

test('far-target cross-check: a recorded angle also leaves the range undeclared, so the angle is asked for', async () => {
  const text = await preparePromptText([{ name: 'Near', rangeM: 100, losAngleDeg: 0 }, { name: 'Far', rangeM: 870, losAngleDeg: 3 }]);
  assert.ok(text.includes(farCheckText('truingSession.prepare.farCheckDistanceAngle')), 'a recorded angle means the range is not flat by default, so the angle is asked for too');
});

test('far-target cross-check: the prompt is shown even when another target is close to the far one', async () => {
  const text = await preparePromptText([{ name: 'Near', rangeM: 100, losAngleDeg: 0 }, { name: 'Mid', rangeM: 800, losAngleDeg: 0 }, { name: 'Far', rangeM: 870, losAngleDeg: 0 }]);
  assert.ok(text.includes(farCheckText('truingSession.prepare.farCheckDistanceAngle')) || text.includes(farCheckText('truingSession.prepare.farCheckDistance')));
});

test('the angle fields of the truing session say which way is positive', () => {
  for (const key of ['truingSession.location.angleColumn', 'truingSession.recheck.angleLabel']) {
    assert.match(t(key), /\+/, `${key}: ${t(key)}`);
  }
});

test('a group records its own weather and chronograph readings; the next group carries the same air until it changes again', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 870, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({
    phase: 'shoot', homeworkState: { chronographAvailable: true },
    plan: { ranges: [100, 300, 870], shots: [1, 4, 6], targets: [100, 300, 870] },
    sessionConditions: { tempC: 10, pressureHpa: 1013, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 }
  });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();

  // the first group: no weather change ticked, so no conditions on the group; readings kept on the group
  const chronoField = () => findByTag(container, 'INPUT').find((i) => i.getAttribute('type') === 'text');
  chronoField().value = '790 791 -';
  await recordGroupNow(container, 1, 0);
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  let groups = loadTruingSessionState().shootSession.groups;
  assert.equal(groups[0].conditions, undefined);
  assert.deepEqual(groups[0].chronoVelocities, [790, 791, null]);

  // the second: the weather has changed (a warmer target)
  const changed = findByTag(container, 'INPUT').find((i) => i.id === 'truingGroupWeatherChanged');
  changed.checked = true;
  fireEvent(changed, 'change');
  const temp = findByTag(container, 'INPUT').find((i) => i.id === 'tempC');
  assert.ok(temp, 'the temperature field appears once the weather is marked as changed');
  temp.value = '24';
  fireEvent(temp, 'input');
  await recordGroupNow(container, 4, 1.6);
  groups = loadTruingSessionState().shootSession.groups;
  assert.equal(groups[1].conditions.tempC, 24);
  assert.ok(groups[1].conditions.pressureHpa > 0);

  // the third carries the second's air without asking again
  await recordGroupNow(container, 6, 10);
  groups = loadTruingSessionState().shootSession.groups;
  assert.equal(groups[2].conditions.tempC, 24);
  assert.equal(loadTruingSessionState().shootSession.chronoVelocities.length, 3, 'the pooled list still counts the readings');
});

test('the conditions card says where the zero comes from: the cartridge\'s zero atmosphere in Arsenal when it has one', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  assert.ok(!findByTag(container, 'INPUT').some((i) => i.id === 'truingZeroAirDifferent'), 'no zero-conditions checkbox of its own');
  assert.ok(container.textContent.includes(t('truingSession.conditions.zeroFromConditions', { long: units.dist(200) })));

  // a cartridge with a zero atmosphere
  const { saveUserRifle, loadUserRifles } = await import('../src/user-library.js');
  const rifle = loadUserRifles().find((r) => r.id === 'r1');
  saveUserRifle({ ...rifle, cartridges: rifle.cartridges.map((c) => ({ ...c, zeroAtmosphere: { tempC: 30, pressureHpa: 1000, humidityPct: 20, altitudeM: 100 } })) });
  const container2 = makeElement('main');
  truingSessionView.mount(container2);
  await settle(200);
  assert.ok(container2.textContent.includes(t('truingSession.conditions.zeroFromArsenal', { summary: conditionsSummary({ tempC: 30, pressureHpa: 1000, humidityPct: 20 }) })));
});

test('the Shoot screen shows what to dial for the next shot: the app\'s own dope before any group, the fit after, and it follows a weather change', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 870, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({
    phase: 'shoot', plan: { ranges: [100, 300, 870], shots: [1, 4, 6], targets: [100, 300, 870] },
    sessionConditions: { tempC: 15, pressureHpa: 1013.25, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 }
  });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const dopeLines = () => findByTag(container, 'P').filter((p) => String(p.className).includes('truing-session-next-shot-dope')).map((p) => p.textContent);

  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotHeading', { range: units.dist(100) })));
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotFromApp')));
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotDialFull')), 'says the recorded come-up is the whole dial');
  assert.equal(dopeLines().length, 2, 'elevation and windage');

  await recordGroupNow(container, 1, 0);
  await recordGroupNow(container, 4, 1.6);
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotHeading', { range: units.dist(870) })));
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotFromFit')), 'after a group it comes from the fit');
  const before = dopeLines()[0];
  assert.match(before, /±/, 'the fit gives the elevation an uncertainty');

  // a warm target: the elevation for the same shot moves
  const changed = findByTag(container, 'INPUT').find((i) => i.id === 'truingGroupWeatherChanged');
  changed.checked = true;
  fireEvent(changed, 'change');
  const temp = findByTag(container, 'INPUT').find((i) => i.id === 'tempC');
  temp.value = '-15';
  fireEvent(temp, 'input');
  assert.notEqual(dopeLines()[0], before, 'a 30 degree colder target has a different elevation');
});

test('a stalled ladder names the step cap, asks for an intermediate distance, and accepts "none available"', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 870, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({
    phase: 'shoot', homeworkState: { backdropHeightM: 1 }, plan: { ranges: [100, 870], shots: [1, 8], targets: [100, 870] },
    sessionConditions: { tempC: 15, pressureHpa: 1013.25, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 }
  });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  await recordGroupNow(container, 1, 0);
  assert.ok(container.textContent.includes(t('truingSession.shoot.ladderStuckCap', { far: units.dist(870), farthest: units.dist(100), low: units.dist(100), high: units.dist(400) })), 'names the cap and the range that would fix it');
  assert.ok(container.textContent.includes(t('truingSession.shoot.intermediateQuestion')));
  const none = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.noIntermediateButton'));
  assert.ok(none, 'expected a "none available" answer');
  fireEvent(none, 'click');
  assert.ok(container.textContent.includes(t('truingSession.shoot.noIntermediateAnswer')));
  assert.ok(!container.textContent.includes(t('truingSession.shoot.intermediateQuestion')), 'it is not asked again');
});

test('a first shot that may leave the backdrop is warned about, with the zero range offered; going on anyway is allowed', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 500, losAngleDeg: 0 }, { name: 'C', rangeM: 870, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({
    phase: 'shoot', homeworkState: { backdropHeightM: 1 }, plan: { ranges: [500, 870], shots: [4, 8], targets: [500, 870] },
    sessionConditions: { tempC: 15, pressureHpa: 1013.25, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 }
  });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const warned = () => findByTag(container, 'P').some((p) => String(p.className).includes('warning') && p.textContent.startsWith(t('truingSession.shoot.firstRungWarning', { range: units.dist(500), backdrop: units.dist(1, 1), miss: units.dist(0, 1) }).slice(0, 25)));
  assert.ok(warned(), 'the first-shot warning');
  const anyway = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.firstRungAnyway'));
  assert.ok(findByTag(container, 'BUTTON').some((b) => b.textContent === t('truingSession.shoot.firstRungNearer', { range: units.dist(100) })), 'the zero range is offered');
  fireEvent(anyway, 'click');
  assert.ok(!warned(), 'going on anyway dismisses it');
});

test('Conclude reminds that the stated uncertainties assume the ticked homework was done', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 870, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({
    phase: 'conclude', homeworkState: { zeroVerified: true },
    sessionConditions: { tempC: 15, pressureHpa: 1013.25, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 },
    shootSession: {
      groups: [{ rangeM: 100, observedComeUp: 0, shots: 3, sigmaMrad: 0.05, resolved: true }, { rangeM: 870, observedComeUp: 10.2, shots: 8, sigmaMrad: 0.05, resolved: true }],
      chronoVelocities: [], missedImpactCount: 0, missedRanges: [], retryRanges: [], retriedMisses: [], triedRanges: [100, 870], farthestValidatedM: 870, rangeChecks: [], angleChecks: {}
    }
  });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(200);
  assert.ok(container.textContent.includes(t('truingSession.conclusion.homeworkAssumed', { items: t('truingSession.homework.tick.zeroVerified') }).slice(0, 40)));
});

test('after a missed impact with nothing to retreat to, an extra group at a validated distance gives the missed distance its one retry', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({
    phase: 'shoot', plan: { ranges: [100, 300], shots: [1, 6], targets: [100, 300] },
    sessionConditions: { tempC: 15, pressureHpa: 1013.25, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 }
  });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const button = (text) => findByTag(container, 'BUTTON').find((b) => b.textContent === text);
  await recordGroupNow(container, 1, 0);
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(300) })));
  fireEvent(button(t('truingSession.shoot.cantSeeImpactButton')), 'click');
  await settle();
  // stuck: 300 m missed and nothing nearer to retreat to
  fireEvent(button(t('truingSession.shoot.noIntermediateButton')), 'click');
  const again = button(t('truingSession.shoot.repeatGroupButton', { range: units.dist(100) }));
  assert.ok(again, 'an extra group at the validated distance is offered');
  fireEvent(again, 'click');
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(100) })));
  assert.ok(container.textContent.includes(t('truingSession.shoot.repeatStep')));
  await recordGroupNow(container, 3, 0);
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(300) })), 'the missed distance is tried once more');
});

test('typing in a conditions field does not rebuild the field: the same input stays in the page after the plan is recomputed', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const pressure = findByTag(container, 'INPUT').find((i) => i.id === 'pressureHpa');
  assert.ok(pressure);
  // a real browser drops the focus of any control that is taken out of the page, even if it is put straight back
  let card = pressure;
  while (card.parentNode && !String(card.className).includes('truing-session-conditions')) card = card.parentNode;
  const host = card.parentNode;
  let detached = 0;
  const removeChild = host.removeChild.bind(host);
  host.removeChild = (child) => { if (child === card) detached++; return removeChild(child); };
  pressure.value = '9';
  fireEvent(pressure, 'input');
  await settle(700); // past the pause after which the plan is drawn again
  assert.equal(detached, 0, 'the conditions card is never taken out of the page while the plan is redrawn');
  assert.ok(findByTag(container, 'INPUT').includes(pressure));
  assert.equal(pressure.value, '9');
});

test('editing a target distance waits for a pause before redrawing, so the field the shooter tabs into is not destroyed', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const before = distanceInputs(container);
  const far = before.find((i) => String(i.value) === '870');
  far.value = '875';
  fireEvent(far, 'change');
  assert.ok(distanceInputs(container).includes(far), 'not redrawn the instant the field is left');
  await settle(700);
  assert.ok(!distanceInputs(container).includes(far), 'redrawn after the pause');
  assert.ok(distanceInputs(container).some((i) => String(i.value) === '875'), 'with the edit kept');
});

test('changing the backdrop height on the Shoot screen keeps what was typed into the group fields', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 870, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({
    phase: 'shoot', plan: { ranges: [100, 300, 870], shots: [1, 4, 6], targets: [100, 300, 870] },
    sessionConditions: { tempC: 15, pressureHpa: 1013.25, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 }
  });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const fields = findByTag(container, 'INPUT').filter((i) => i.getAttribute('type') === 'number' && !i.id);
  const comeUp = fields[1];
  comeUp.value = '1.25';
  fireEvent(comeUp, 'input');
  const backdrop = fields[fields.length - 1];
  backdrop.value = '4.5';
  fireEvent(backdrop, 'change');
  assert.ok(findByTag(container, 'INPUT').includes(comeUp), 'the group fields were not redrawn');
  assert.equal(comeUp.value, '1.25');
});

test('both confirmations are checkboxes with their labels in the warning colour, and editing a distance unticks the re-check', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const labelOf = (id) => {
    let n = findByTag(container, 'INPUT').find((i) => i.id === id);
    while (n && n.tagName !== 'LABEL') n = n.parentNode;
    return n;
  };
  for (const id of ['truingRangeRechecked', 'truingConditionsConfirmed']) {
    const label = labelOf(id);
    assert.ok(label, `${id} is a labelled checkbox`);
    assert.ok(String(label.className).includes('warning'), `${id} label is in the warning colour`);
  }
  tickRangeRechecked(container);
  const box = () => findByTag(container, 'INPUT').find((i) => i.id === 'truingRangeRechecked');
  assert.equal(box().checked, true);
  const far = distanceInputs(container).find((i) => String(i.value) === '870');
  far.value = '880';
  fireEvent(far, 'change');
  assert.equal(box().checked, false, 'a changed distance has to be confirmed again');
});

// ---- user-preferred units ----
async function withUnits(prefs, outputUnit, fn) {
  const { setUnit, resetUnits } = await import('../src/prefs.js');
  const { setOutputUnit } = await import('../src/range-solver-prefs.js');
  for (const [group, unit] of Object.entries(prefs)) setUnit(group, unit);
  if (outputUnit) setOutputUnit(outputUnit);
  try { await fn(); } finally { resetUnits(); setOutputUnit('clicks'); }
}
const IMPERIAL = { distance: 'yd', velocity: 'ft/s', windSpeed: 'mph', altitude: 'ft', temperature: 'tempF', pressure: 'inHg', angleDispersion: 'arcmin' };
const SESSION_AIR = { tempC: 15, pressureHpa: 1013.25, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 };
// a distance or speed left in metric units on screen: "870 m", "3 m/s", "0.14 mrad" -- never once a preference says otherwise
const METRIC_LEFTOVER = /\d\s?m(?![\w/])|\d\s?m\/s|\d\s?mrad|\{\{/;

test('with imperial and MOA preferences, Prepare shows distances, speeds and angles in them and reads typed distances back as metres', async () => {
  await withUnits(IMPERIAL, 'moa', async () => {
    setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 500, losAngleDeg: 0 }, { name: 'C', rangeM: 870, losAngleDeg: 0 }]);
    await settle();
    const container = makeElement('main');
    truingSessionView.mount(container);
    await settle(300);
    const text = container.textContent;
    assert.ok(text.includes('yd'), 'distances in yards');
    assert.ok(text.includes(t('truingSession.location.rangeColumn', { unit: 'yd' })), 'the table column says yd');
    const leftover = text.match(METRIC_LEFTOVER);
    assert.equal(leftover, null, `no metric leftover on Prepare: ${leftover && text.slice(Math.max(0, leftover.index - 80), leftover.index + 40)}`);
    // the table shows yards; an angle edit on the far target must not turn 951 yd back into 869.9 m
    const far = distanceInputs(container).find((i) => String(i.value) === String(units.toDisplayDistance(870)));
    assert.ok(far, 'the far target is shown in yards');
    const angleInputs = findByTag(container, 'TABLE').flatMap((tbl) => findByTag(tbl, 'INPUT')).filter((_, i) => i % 2 === 1);
    angleInputs[2].value = '2';
    fireEvent(angleInputs[2], 'change');
    const { loadTruingSessionState } = await import('../src/truing-session-state.js');
    const edit = loadTruingSessionState().pendingTargetEdits;
    const pending = Object.values(edit || {})[0];
    assert.equal(pending.rangeM, 870, 'the untouched distance keeps its metres');
    // a typed distance is yards
    far.value = '1000';
    fireEvent(far, 'change');
    const typed = Object.values(loadTruingSessionState().pendingTargetEdits).find((e) => e.rangeM !== 870);
    assert.ok(Math.abs(typed.rangeM - 914.4) < 0.01, `1000 yd is 914.4 m (${typed.rangeM})`);
  });
});

test('with imperial and MOA preferences, the Shoot screen takes readings in ft/s and an elevation in clicks, and shows the next shot in MOA and clicks', async () => {
  await withUnits(IMPERIAL, 'moa', async () => {
    setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 870, losAngleDeg: 0 }]);
    await settle();
    saveTruingSessionState({ phase: 'shoot', homeworkState: { chronographAvailable: true }, plan: { ranges: [100, 300, 870], shots: [1, 4, 6], targets: [100, 300, 870] }, sessionConditions: SESSION_AIR });
    const container = makeElement('main');
    truingSessionView.mount(container);
    await settle();
    let text = container.textContent;
    assert.ok(text.includes(t('truingSession.shoot.nextRange', { range: units.dist(100) })), 'the next distance in yards');
    assert.ok(text.includes(t('truingSession.shoot.comeUpLabel', { unit: t('truingSession.shoot.nextShotClicks') })), 'the come-up is entered in clicks');
    assert.ok(text.includes('MOA') && text.includes(t('truingSession.shoot.nextShotClicks')), 'the next shot is in MOA, with clicks as well');
    assert.equal(text.match(METRIC_LEFTOVER), null, `no metric leftover on Shoot: ${text.match(METRIC_LEFTOVER)}`);

    const chrono = findByTag(container, 'INPUT').find((i) => i.getAttribute('type') === 'text');
    chrono.value = '2600 2602';
    await recordGroupNow(container, 1, 0);
    const { loadTruingSessionState } = await import('../src/truing-session-state.js');
    const v = loadTruingSessionState().shootSession.chronoVelocities;
    assert.ok(Math.abs(v[0] - 2600 * 0.3048) < 1e-6, `2600 ft/s is ${2600 * 0.3048} m/s (${v[0]})`);
    text = container.textContent;
    assert.equal(text.match(METRIC_LEFTOVER), null, `no metric leftover after a group: ${text.match(METRIC_LEFTOVER)}`);
  });
});

test('with imperial and MOA preferences, Conclude and the stalled-ladder messages carry no metric units', async () => {
  await withUnits(IMPERIAL, 'moa', async () => {
    setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 870, losAngleDeg: 0 }]);
    await settle();
    saveTruingSessionState({
      phase: 'conclude', homeworkState: { zeroVerified: true, chronographAvailable: true, mvSD: 6 }, sessionConditions: SESSION_AIR,
      shootSession: {
        groups: [{ rangeM: 100, observedComeUp: 0.3, shots: 3, sigmaMrad: 0.05, resolved: true }, { rangeM: 870, observedComeUp: 11.6, shots: 8, sigmaMrad: 0.05, resolved: true }],
        chronoVelocities: [800, 801, 799, 802, 800, 801], missedImpactCount: 0, missedRanges: [], retryRanges: [], retriedMisses: [], triedRanges: [100, 870], farthestValidatedM: 870, rangeChecks: [], angleChecks: {}
      }
    });
    const container = makeElement('main');
    truingSessionView.mount(container);
    await settle(400);
    const text = container.textContent;
    assert.ok(text.length > 200);
    assert.equal(text.match(METRIC_LEFTOVER), null, `no metric leftover on Conclude: ${text.match(METRIC_LEFTOVER)}`);
  });
});

test('every Conclude finding is written in the preferred units (MOA, ft/s, mph, yards)', async () => {
  const { conclusionPanel } = await import('../src/ui/truing-session/conclusion.js');
  await withUnits(IMPERIAL, 'moa', async () => {
    const analysis = {
      plannedFarReached: false, planFar: 870, farthestShot: 500, notMaterial: [], notDetermined: [], nothingMaterial: false,
      findings: [
        { case: 4, param: 'zeroMrad', value: 0.12, size: 0.05, clicks: 1.2, pMaterial: 0.9 },
        { case: 'measuredV0', param: 'v0Ms', value: -8, size: 2, pMaterial: 0.9 },
        { case: 8, reason: 'underdetermined', param: 'windMs', value: 1, size: 1.5, grade: 'B', pMaterial: 0.4 },
        { case: 6, members: ['dragPct', 'v0Ms'], valueMrad: 0.1, sizeMrad: 0.05, pMaterial: 0.5, action: 'chronograph' },
        { case: 2, grade: 'B', corrections: [{ rangeM: 500, deltaMrad: 0.2 }] }
      ]
    };
    const { node } = conclusionPanel({
      analysis, state: {}, clickMrad: 0.1, session: { groups: [{}], missedImpactCount: 0 }, rangeDeclaredFlat: true, rMax: 870,
      cartridgeName: 'X', bcDecision: null, homeworkTicked: [], mvSD: 6, conditionsText: '', onNewSession() {}
    });
    const text = node.textContent;
    assert.equal(text.match(METRIC_LEFTOVER), null, `no metric leftover: ${text.match(METRIC_LEFTOVER) && text.slice(text.match(METRIC_LEFTOVER).index - 60, text.match(METRIC_LEFTOVER).index + 30)}`);
    assert.ok(text.includes('MOA'), 'angles in MOA');
    assert.ok(text.includes('ft/s'), 'velocities in ft/s');
    assert.ok(text.includes('mph'), 'wind in mph');
    assert.ok(text.includes('yd'), 'distances in yards');
    // 0.12 mrad is 0.41 MOA
    assert.ok(text.includes(units.toDisplayAngle(0.12)), 'the zero shift converted');
  });
});
