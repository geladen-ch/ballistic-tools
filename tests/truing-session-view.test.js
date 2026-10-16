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
// The Prepare planning runs in a worker in the app; here it runs in-process, through a structured clone both ways like a real
// worker message, so anything that could not be posted to a worker fails here too.
const { setPlannerTransport } = await import('../src/ui/truing-session/prepare-planner.js');
const { computePrepare } = await import('../src/ui/truing-session/prepare-compute.js');
const { analyseSession } = await import('../src/ui/truing-session/session-model.js');
const runInProcess = async (type, request) => {
  const job = type === 'truingPrepare' ? computePrepare : (r) => { const { joint, ...analysis } = analyseSession(r); return analysis; };
  return structuredClone(job(structuredClone(request)));
};
setPlannerTransport(runInProcess);
const { conditionsSummary } = await import('../src/ui/truing-session/conditions.js');
const units = await import('../src/ui/truing-session/units.js');
const farCheckText = (key) => t(key, { far: units.dist(870), err: units.dist(20), cost: units.angle(0.3, 1), ...units.missExample() });
const { resetShotStateForTests, saveRifleState } = await import('../src/shot-state.js');
const { saveUserRifle, generateUserId } = await import('../src/user-library.js');
const { resetLocationLibraryForTests, saveUserLocation, loadUserLocations } = await import('../src/location-library.js');
const { saveRangeSolverLocationState, resetRangeSolverStateForTests } = await import('../src/range-solver-state.js');
const { resetTruingSessionStateForTests, saveTruingSessionState } = await import('../src/truing-session-state.js');
const { mountDialogRoot } = await import('../src/ui/app-dialog.js');

// the app's modal root, as index.html provides it
const dialogRoot = makeElement('div');
mountDialogRoot(dialogRoot);
const dialogOpen = () => dialogRoot.firstChild.style.display !== 'none';
const dialogText = () => dialogRoot.textContent;
async function answerDialog(label) {
  const button = findByTag(dialogRoot, 'BUTTON').find((b) => b.textContent === label);
  assert.ok(button, `expected a dialog button "${label}"`);
  fireEvent(button, 'click');
  await settle();
}

function settle(ms = 40) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.beforeEach(async () => {
  mountDialogRoot(dialogRoot);
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

function setUpArsenalAndLocation(targetSpecs = [{ name: 'Near', rangeM: 100, losAngleDeg: 0 }, { name: 'Far', rangeM: 870, losAngleDeg: 0 }], cartridgeExtras = {}) {
  const bulletId = 'geladen-308-178-eld-m';
  saveUserRifle({
    id: 'r1', name: 'My Rifle', defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [{ id: 'c1', name: 'My Load', muzzleVelocity: 792.48, bulletId, ...cartridgeExtras }]
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

// Strings as the Shoot screen records them, each under its target's key: the saved location's target at that distance, else
// the natural target there.
function keyed(groups) {
  const targets = loadUserLocations()[0].targets;
  return groups.map((g) => ({ targetKey: (targets.find((tg) => tg.rangeM === g.rangeM) || { id: `natural:${g.rangeM}` }).id, ...g }));
}

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

  const numberInputs = findByTag(container, 'INPUT').filter((i) => i.getAttribute('type') === 'number');
  assert.ok(numberInputs.length >= 1, 'expected the come-up number input');
  numberInputs[0].value = '101'; // clicks of 0.1 mrad
  fireEvent(numberInputs[0], 'input');

  const buttons = findByTag(container, 'BUTTON');
  const recordButton = buttons.find((b) => b.textContent === t('truingSession.shoot.recordGroupButton'));
  assert.ok(recordButton, 'expected a Record group button');
  fireEvent(recordButton, 'click');
  await settle();

  assert.ok(container.textContent.includes(t('truingSession.shoot.liveNoDataYet')) === false, 'live panel should no longer say "nothing recorded yet"');

  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  const persisted = loadTruingSessionState();
  assert.equal(persisted.shootSession.groups.length, 1);
  assert.equal(persisted.shootSession.groups[0].shots, 1, 'the recommended number of rounds: one at the first rung');
  assert.equal(persisted.shootSession.groups[0].mode, 'shots', 'a one-round string is read round by round');
  assert.equal(persisted.shootSession.groups[0].certaintyKey, 'good', 'the reading is good unless said otherwise');
  assert.ok(Math.abs(persisted.shootSession.groups[0].observedComeUp - 10.1) < 1e-9, 'entered in clicks, stored in mrad');
});

test('the Prepare screen tells how many rounds are worth bringing, and says the numbers are minimums', async () => {
  setUpArsenalAndLocation([
    { name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 500, losAngleDeg: 0 }, { name: 'D', rangeM: 800, losAngleDeg: 0 }
  ]);
  await settle();
  saveTruingSessionState({ phase: 'prepare', homeworkState: { roundBudget: 16, chronographAvailable: true } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(300);
  const text = container.textContent;
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetHeading')), 'the budget advice is drawn after the rest of the panel');
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetMinimum')), 'and says it is a minimum: rounds the spotter cannot see do not count');
  assert.ok(text.includes(t('truingSession.prepare.roundBudgetLabel')), 'and the budget field itself asks for a 20-25% margin on top');
  assert.ok(t('truingSession.prepare.roundBudgetLabel').includes('20'));
  // with a chronograph (nothing else checked, a marksman's own skill on top of the rifle's) more rounds pay up to a knee; a
  // budget of 16 is not on a row of the table, so it gets a row of its own
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetRowMinimal')));
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetRowOptimal')));
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetRowEnhanced')));
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetRowDeluxe')));
  assert.ok(text.includes(t('truingSession.rangeGrading.budgetRowYours')));
  assert.ok(text.includes(t('truingSession.prepare.roundBudgetHeading')) && text.includes(t('truingSession.prepare.roundBudgetIntro')));
});

test('the Prepare panes come in the order: equipment, homework, best distances, location check, range grading, rounds', async () => {
  setUpArsenalAndLocation([
    { name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 500, losAngleDeg: 0 }, { name: 'D', rangeM: 800, losAngleDeg: 0 }
  ]);
  await settle();
  saveTruingSessionState({ phase: 'prepare' });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(300);
  const text = container.textContent;
  const at = ['equipment.heading', 'homework.heading', 'prepare.optimalHeading', 'location.heading', 'rangeGrading.heading', 'prepare.roundBudgetHeading']
    .map((k) => text.indexOf(t(`truingSession.${k}`)));
  assert.ok(at.every((i) => i >= 0), `every pane is drawn: ${at}`);
  assert.deepEqual([...at].sort((x, y) => x - y), at, 'in the asked-for order');
});

test('picking a recommended number of rounds plans for it', async () => {
  setUpArsenalAndLocation([
    { name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 500, losAngleDeg: 0 }, { name: 'D', rangeM: 800, losAngleDeg: 0 }
  ]);
  await settle();
  saveTruingSessionState({ phase: 'prepare', homeworkState: { roundBudget: 16, chronographAvailable: true } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(300);
  const deluxeRow = findByTag(container, 'TR').find((r) => r.textContent.includes(t('truingSession.rangeGrading.budgetRowDeluxe')));
  assert.ok(deluxeRow, 'a Deluxe row');
  const pick = findByTag(deluxeRow, 'BUTTON')[0];
  const n = parseInt(/^(\d+)/.exec(deluxeRow.textContent)[1], 10);
  fireEvent(pick, 'click');
  await settle(300);
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  assert.equal(loadTruingSessionState().homeworkState.roundBudget, n);
});

// Before the first string at the planned far target the Shoot screen asks for one more reading of its distance (and angle): answer
// it with the distance as recorded and a level angle, when it is on screen. Returns whether it was.
async function answerFarRecheck(container) {
  const box = findByTag(container, 'DIV').find((d) => String(d.className).includes('truing-session-recheck'));
  if (!box || !container.textContent.includes(t('truingSession.shoot.farRecheck', { range: '' }).split(' ').slice(0, 4).join(' '))) return false;
  const range = Number(/(\d+(?:\.\d+)?)/.exec(findByTag(box, 'P')[0].textContent)[1]);
  const [distance, angleInput] = findByTag(box, 'INPUT').filter((i) => i.getAttribute('type') === 'number');
  distance.value = String(range);
  if (angleInput) angleInput.value = '0';
  fireEvent(findByTag(box, 'BUTTON').find((b) => b.textContent === t('truingSession.recheck.submitButton')), 'click');
  await settle();
  return true;
}

// The come-up field of the string on screen (then the backdrop field): a one-round string is read round by round, so its field is the
// first round's; a longer one read at its centre has the one field without an id.
const isComeUpOrBackdrop = (i) => i.getAttribute('type') === 'number' && (!i.id || i.id === 'truingShotComeUp0');

async function recordGroupNow(container, comeUp, { dialog = 'continue' } = {}) {
  await answerFarRecheck(container);
  // a string is always the recommended number of rounds; the string's come-up field has no id (the weather fields, when opened, do),
  // except the first round's field of a string read round by round, which is the only one a one-round string has
  const numberInputs = findByTag(container, 'INPUT').filter(isComeUpOrBackdrop);
  numberInputs[0].value = String(Number((comeUp / 0.1).toFixed(3))); fireEvent(numberInputs[0], 'input'); // the field takes clicks of 0.1 mrad
  const record = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.recordGroupButton'));
  assert.ok(record, 'expected a Record group button');
  fireEvent(record, 'click');
  await settle();
  // fewer velocities than rounds opens a question; most tests just carry on as is
  if (dialog !== 'leave' && dialogOpen()) await answerDialog(t(dialog === 'continue' ? 'truingSession.shoot.chronoShortContinue' : 'truingSession.shoot.chronoShortComplete'));
  // and the far target's re-range, if the next string is its first (most tests are about something else)
  if (!dialogOpen()) await answerFarRecheck(container);
}

test('the Shoot phase follows the plan: each distance once, nearest first, then strings of at most three to the distance with the most rounds left, and nothing after the plan is done', async () => {
  setUpArsenalAndLocation([
    { name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 500, losAngleDeg: 0 },
    { name: 'D', rangeM: 600, losAngleDeg: 0 }, { name: 'E', rangeM: 800, losAngleDeg: 0 }
  ]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', plan: { ranges: [100, 300, 800], shots: [1, 5, 6], targets: [100, 300, 800] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const expectNext = (rangeM, k, n, shots, after) => {
    assert.ok(container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(rangeM) })), `next: ${rangeM}`);
    assert.ok(container.textContent.includes(t('truingSession.shoot.shotsToShoot', { count: shots })), `${shots} shots at ${rangeM}`);
    const afterList = after > 0 ? `${units.dist(rangeM)}: ${after}` : null;
    if (afterList) assert.ok(container.textContent.includes(afterList), `${after} rounds still to come at ${rangeM}, in the programme's rest`);
    // a one-round string has only its round's field (and the backdrop); a longer one the come-up field of its centre and the backdrop
    assert.equal(findByTag(container, 'INPUT').filter((i) => i.getAttribute('type') === 'number' && !i.id).length, shots === 1 ? 1 : 2, 'the come-up and the backdrop: there is no rounds field, the string is the recommended number');
  };

  expectNext(100, 1, 1, 1, 0);
  await recordGroupNow(container, 0);
  // the ladder alone would take the farthest safe distance (500 or more); the plan says 300, its five rounds as 3 + 2
  expectNext(300, 1, 2, 3, 2);
  // the rest of the programme, string by string: the untried distance first, then the leftovers to the distance with most rounds left
  assert.deepEqual(
    findByTag(findByTag(container, 'OL').find((ol) => String(ol.className).includes('truing-session-programme')), 'LI').map((li) => li.textContent),
    [800, 800, 300].map((r, i) => `${units.dist(r)}: ${t('truingSession.shoot.shotsToShoot', { count: i === 2 ? 2 : 3 })}`),
    'the programme after the string being shot'
  );
  await recordGroupNow(container, 1.6);
  expectNext(800, 1, 2, 3, 3);
  await recordGroupNow(container, 8.6);
  // every distance shot once: 800 has three left, 300 two, so 800 first
  expectNext(800, 2, 2, 3, 0);
  await recordGroupNow(container, 8.6);
  expectNext(300, 2, 2, 2, 0);
  await recordGroupNow(container, 1.6);
  assert.ok(container.textContent.includes(t('truingSession.shoot.ladderDone')), 'every planned round is shot: the ladder is complete, no leftover distances proposed');
  assert.ok(!container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(500) })));
  assert.ok(!container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(600) })));
});

test('the shooter can re-measure the current target on their own: the heading shows its distance and angle, Cancel leaves everything as it was, Confirm records it like the prompted re-check', async () => {
  setUpArsenalAndLocation([
    { name: 'A', rangeM: 100, losAngleDeg: 2 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 800, losAngleDeg: 0 }
  ]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', plan: { ranges: [100, 300, 800], shots: [1, 5, 6], targets: [100, 300, 800] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const heading = (rangeM, angle) => t('truingSession.shoot.nextRangeWithAngle', { range: units.dist(rangeM), angle });
  assert.ok(container.textContent.includes(heading(100, '+2.0°')), 'the heading shows the target\'s distance and line of sight');
  const button = (label) => findByTag(container, 'BUTTON').find((b) => b.textContent === t(label));
  const form = () => findByTag(container, 'DIV').find((d) => String(d.className).includes('truing-session-recheck'));
  assert.equal(form(), undefined, 'no re-check is asked for here');
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');

  fireEvent(button('truingSession.shoot.remeasureButton'), 'click');
  assert.ok(form(), 'Re-measure opens the re-check in place');
  assert.equal(button('truingSession.shoot.remeasureButton').disabled, true);
  fireEvent(button('truingSession.recheck.cancelButton'), 'click');
  await settle();
  assert.equal(form(), undefined, 'Cancel closes it');
  assert.equal(button('truingSession.shoot.remeasureButton').disabled, false);
  assert.equal(((loadTruingSessionState().shootSession || {}).rangeChecks || []).length, 0, 'and records nothing');

  fireEvent(button('truingSession.shoot.remeasureButton'), 'click');
  const [distance, angle] = findByTag(form(), 'INPUT').filter((i) => i.getAttribute('type') === 'number');
  assert.ok(angle, 'the angle is asked for');
  distance.value = '110';
  angle.value = '4';
  fireEvent(button('truingSession.recheck.confirmButton'), 'click');
  await settle(200);
  const persisted = loadTruingSessionState();
  assert.equal(persisted.shootSession.rangeChecks.length, 1);
  assert.equal(persisted.shootSession.rangeChecks[0].believedRangeM, 100);
  assert.equal(persisted.shootSession.rangeChecks[0].newReadingM, 110);
  assert.equal(persisted.shootSession.measuredRanges[persisted.shootSession.rangeChecks[0].targetKey], 110, 'held for this session');
  assert.equal(Object.keys(persisted.targetOverrides || {}).length, 0, 'the target the strings are recorded at is left as it is');
  assert.ok(container.textContent.includes(t('truingSession.choice.changedIntro')), 'the session-only notice, like a prompted re-check');
  assert.ok(container.textContent.includes(heading(110, '+4.0°')), 'the heading shows the new readings');
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotHeading', { range: units.dist(110) })), 'the dial is worked out for the new distance');

  // an angle measured this session is asked for again when the shooter re-measures on their own
  fireEvent(button('truingSession.shoot.remeasureButton'), 'click');
  const again = findByTag(form(), 'INPUT').filter((i) => i.getAttribute('type') === 'number');
  assert.equal(again.length, 2);
  // a reading within the laser's own error moves the heading and the dial too, and a second re-check is held against the
  // distance the strings are recorded at, not against the last reading
  again[0].value = '111';
  again[1].value = '4';
  fireEvent(button('truingSession.recheck.confirmButton'), 'click');
  await settle(200);
  const checks = loadTruingSessionState().shootSession.rangeChecks;
  assert.deepEqual(checks.map((rc) => [rc.believedRangeM, rc.newReadingM]), [[100, 110], [100, 111]]);
  assert.ok(container.textContent.includes(heading(111, '+4.0°')));
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotHeading', { range: units.dist(111) })));
});

test('off a flat range a re-check always takes the angle: there is no way round it, and nothing is recorded without it', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 800, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', plan: { ranges: [100, 800], shots: [3, 6], targets: [100, 800] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.remeasureButton')), 'click');
  const box = findByTag(container, 'DIV').find((d) => String(d.className).includes('truing-session-recheck'));
  assert.equal(findByTag(box, 'INPUT').filter((i) => i.getAttribute('type') === 'checkbox').length, 0, 'no "no way to measure the angle" option');
  const [distance, angle] = findByTag(box, 'INPUT').filter((i) => i.getAttribute('type') === 'number');
  distance.value = '102';
  fireEvent(findByTag(box, 'BUTTON').find((b) => b.textContent === t('truingSession.recheck.confirmButton')), 'click');
  await settle();
  const warning = findByTag(box, 'P').find((p) => p.textContent === t('truingSession.recheck.needValues'));
  assert.ok(warning && warning.style.display !== 'none', 'the missing angle is asked for');
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  assert.equal(((loadTruingSessionState().shootSession || {}).rangeChecks || []).length, 0, 'nothing recorded without the angle');
  angle.value = '-1.5';
  fireEvent(findByTag(box, 'BUTTON').find((b) => b.textContent === t('truingSession.recheck.confirmButton')), 'click');
  await settle(200);
  assert.equal(loadTruingSessionState().shootSession.rangeChecks.length, 1);
});

test('on a range declared flat no angle is ever asked for or shown during Shoot: not in the heading, the far target\'s re-range, or a re-measure', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 800, losAngleDeg: 4 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', rangeDeclaredFlat: true, plan: { ranges: [100, 800], shots: [1, 6], targets: [100, 800] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const angleFields = () => findByTag(container, 'LABEL').filter((l) => l.textContent === t('truingSession.recheck.angleLabel')).length;
  const noAngleShown = () => !findByTag(container, 'H3').some((h) => h.textContent.includes('°'));
  assert.ok(noAngleShown());
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.remeasureButton')), 'click');
  assert.equal(angleFields(), 0, 'a re-measure takes the distance only');
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.recheck.cancelButton')), 'click');
  await settle();
  // the one string at 100 m: then the far target's re-range is asked for, the distance only
  const comeUp = findByTag(container, 'INPUT').filter(isComeUpOrBackdrop)[0];
  comeUp.value = '0'; fireEvent(comeUp, 'input');
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.recordGroupButton')), 'click');
  await settle(200);
  assert.ok(findByTag(container, 'DIV').some((d) => String(d.className).includes('truing-session-recheck')), 'the far target\'s re-range is on screen');
  assert.equal(angleFields(), 0, 'the far target\'s re-range takes the distance only');
  assert.ok(noAngleShown(), 'a recorded 4° is not shown on a flat range');
});

test('a natural target re-measured during Shoot is shown and dialled at the new reading', async () => {
  setUpArsenalAndLocation([{ name: 'Far', rangeM: 800, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', naturalTargets: [{ rangeM: 150 }], rangeDeclaredFlat: true, plan: { ranges: [150, 800], shots: [3, 6], targets: [150, 800] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(150) })));
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.remeasureButton')), 'click');
  const box = findByTag(container, 'DIV').find((d) => String(d.className).includes('truing-session-recheck'));
  const inputs = findByTag(box, 'INPUT').filter((i) => i.getAttribute('type') === 'number');
  assert.equal(inputs.length, 1, 'no angle on a range declared flat');
  inputs[0].value = '156';
  fireEvent(findByTag(box, 'BUTTON').find((b) => b.textContent === t('truingSession.recheck.confirmButton')), 'click');
  await settle(200);
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(156) })));
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotHeading', { range: units.dist(156) })));
  assert.ok(!container.textContent.includes(t('truingSession.choice.changedIntro')), 'a natural target has no location to leave alone');
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  assert.deepEqual(loadTruingSessionState().shootSession.rangeChecks.map((rc) => [rc.targetKey, rc.believedRangeM, rc.newReadingM]), [['natural:150', 150, 156]]);
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
      groups: keyed([
        { rangeM: 100, observedComeUp: near, shots: 4, sigmaMrad: 0.15, resolved: false, chronoVelocities: velocities },
        { rangeM: 870, observedComeUp: far, shots: 8, sigmaMrad: 0.06, resolved: true }
      ]),
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

  fireEvent(saveButton, 'click');

  const { loadUserRifles } = await import('../src/user-library.js');
  const updatedCartridge = loadUserRifles().find((r) => r.id === 'r1').cartridges.find((c) => c.id === 'c1');
  // +4% drag injected -> a factor near 1/1.04 = 0.962.
  assert.ok(updatedCartridge.bcGainFactor > 0.93 && updatedCartridge.bcGainFactor < 0.99, `got ${updatedCartridge.bcGainFactor}`);
});

// 12 readings spread far wider than the recorded 3 m/s SD: today's spread then governs the fit.
const WIDE_READINGS = [770, 815, 790, 805, 780, 820, 775, 810, 785, 800, 795, 765];

test('a significantly wider chronograph spread is offered for the cartridge only on the Conclude screen, with no session-only button', async () => {
  setUpArsenalAndLocation();
  await settle();
  await concludeFixture({ velocities: WIDE_READINGS });

  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(80);

  const buttons = () => findByTag(container, 'BUTTON');
  const toCartridge = buttons().find((b) => b.textContent === t('truingSession.shoot.sdToArsenal'));
  assert.ok(toCartridge, 'expected an "update the main cartridge record" button for the wider spread');

  fireEvent(toCartridge, 'click');
  await settle(80);

  const { loadUserRifles } = await import('../src/user-library.js');
  const cartridge = loadUserRifles().find((r) => r.id === 'r1').cartridges.find((c) => c.id === 'c1');
  assert.ok(cartridge.muzzleVelocitySD > 10, `got ${cartridge.muzzleVelocitySD}`);
  assert.ok(!buttons().some((b) => b.textContent === t('truingSession.shoot.sdToArsenal')), 'the button gives way to the saved note');
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
  return findByTag(container, 'TABLE').flatMap((tbl) => findByTag(tbl, 'TR')).map((tr) => findByTag(tr, 'TD')[1]).filter(Boolean).map((td) => findByTag(td, 'INPUT')[0]);
}

async function editFarDistanceAndConfirm(container, value) {
  const far = distanceInputs(container).find((i) => String(i.value) === '870');
  far.value = String(value);
  fireEvent(far, 'change');
  await settle();
  tickRangeRechecked(container);
  await settle();
}

test('step 7: a corrected distance is kept for this session only, the pane says so, and the location is never offered an update', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  assert.ok(container.textContent.includes(t('truingSession.location.sessionOnlyHint')), 'the location pane says corrections are for this session only');

  await editFarDistanceAndConfirm(container, 855);
  assert.ok(!findByTag(container, 'BUTTON').some((b) => /location card|Update the main/i.test(b.textContent)), 'no way to write the correction to the location');

  const { loadUserLocations } = await import('../src/location-library.js');
  assert.ok(loadUserLocations()[0].targets.some((tg) => tg.rangeM === 870), 'the location record must be unchanged');
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  const persisted = loadTruingSessionState();
  assert.ok(Object.values(persisted.targetOverrides).some((ov) => ov.rangeM === 855));
  assert.equal(persisted.rangeRecheckedThisSession, true);
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
  assert.ok(container.textContent.includes(t('truingSession.location.angleColumn')), 'off a flat range every target has its angle');
  flat.checked = true;
  fireEvent(flat, 'change');
  await settle();
  assert.ok(!container.textContent.includes(t('truingSession.location.angleColumn')), 'a range declared flat asks for no angle at all');
  assert.ok(!container.textContent.includes(t('truingSession.location.recheckAngleInstructions')));
  assert.equal(findByTag(container, 'TABLE').flatMap((tbl) => findByTag(tbl, 'INPUT')).length, 2, 'one distance field per target, no angle field');

  await editFarDistanceAndConfirm(container, 860);

  const { loadUserLocations } = await import('../src/location-library.js');
  const far = loadUserLocations()[0].targets.find((tg) => tg.name === 'Far');
  assert.equal(far.rangeM, 870, 'the location keeps its distance');
  assert.equal(far.losAngleDeg, 3, 'the recorded angle must survive the flat declaration');
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  assert.ok(Object.values(loadTruingSessionState().targetOverrides).some((ov) => ov.rangeM === 860 && ov.losAngleDeg === undefined), 'the corrected distance is held for the session, with no angle written');
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

  // the first group: no air change ticked, so only the wind (the starting one) is on the group; readings kept on the group
  const chronoField = () => findByTag(container, 'INPUT').find((i) => i.id === 'truingChronoReadings');
  const roundVelocity = () => findByTag(container, 'INPUT').find((i) => i.id === 'truingShotVelocity0');
  roundVelocity().value = '790'; // the first string is one round, read round by round
  await recordGroupNow(container, 0);
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  let groups = loadTruingSessionState().shootSession.groups;
  assert.deepEqual(groups[0].conditions, { windSpeed: 0, windAngle: 90 });
  assert.equal(groups[0].windConfidenceKey, 'good', 'a wind reading is Good unless said otherwise');
  assert.deepEqual(groups[0].chronoVelocities, [790]);

  // the second: the weather has changed (a warmer target)
  const changed = findByTag(container, 'INPUT').find((i) => i.id === 'truingGroupWeatherChanged');
  changed.checked = true;
  fireEvent(changed, 'change');
  const temp = findByTag(container, 'INPUT').find((i) => i.id === 'tempC');
  assert.ok(temp, 'the temperature field appears once the weather is marked as changed');
  temp.value = '24';
  fireEvent(temp, 'input');
  await recordGroupNow(container, 1.6);
  groups = loadTruingSessionState().shootSession.groups;
  assert.equal(groups[1].conditions.tempC, 24);
  assert.ok(groups[1].conditions.pressureHpa > 0);

  // the third carries the second's air without asking again
  await recordGroupNow(container, 10);
  groups = loadTruingSessionState().shootSession.groups;
  assert.equal(groups[2].conditions.tempC, 24);
});

test('the conditions card says where the zero comes from: the cartridge\'s zero atmosphere in Arsenal when it has one', async () => {
  setUpArsenalAndLocation();
  await settle();
  const { saveUserRifle: saveRifle, loadUserRifles: loadRifles } = await import('../src/user-library.js');
  saveRifle({ ...loadRifles().find((r) => r.id === 'r1'), defaultZeroRangeM: 200 }); // a zero long enough for the air to matter
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  assert.ok(!findByTag(container, 'INPUT').some((i) => i.id === 'truingZeroAirDifferent'), 'no zero-conditions checkbox of its own');
  assert.ok(container.textContent.includes(t('truingSession.conditions.zeroFromConditions', { long: units.nominalDist(200), short: units.nominalDist(100) })));

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
  // the two big readouts (elevation, windage) of the next shot, in Range Solver's own readout classes
  const dopeLines = () => findByTag(container, 'DIV').filter((d) => String(d.className).split(' ').includes('range-solver-stat')).map((d) => d.textContent);

  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotHeading', { range: units.dist(100) })));
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotFromApp')));
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotDialFull')), 'says the recorded come-up is the whole dial');
  assert.equal(dopeLines().length, 2, 'elevation and windage');

  await recordGroupNow(container, 0);
  await recordGroupNow(container, 1.6);
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
  await recordGroupNow(container, 0);
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
      groups: keyed([{ rangeM: 100, observedComeUp: 0, shots: 3, sigmaMrad: 0.05, resolved: true }, { rangeM: 870, observedComeUp: 10.2, shots: 8, sigmaMrad: 0.05, resolved: true }]),
      missedImpactCount: 0, missedRanges: [], retryRanges: [], retriedMisses: [], triedRanges: [100, 870], farthestValidatedM: 870, rangeChecks: [], angleChecks: {}
    }
  });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(200);
  assert.ok(container.textContent.includes(t('truingSession.conclusion.homeworkAssumed', { items: t('truingSession.homework.tick.zeroVerified') }).slice(0, 40)));
});

test('Conclude fits on the usual drag prior; an implausible result after a widening miss takes its information line from the widened fit', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 500, losAngleDeg: 0 }, { name: 'C', rangeM: 870, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({
    phase: 'conclude', homeworkState: { chronographAvailable: true, backdropHeightM: 4 },
    sessionConditions: { tempC: 15, pressureHpa: 1013.25, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 },
    shootSession: {
      groups: keyed([{ rangeM: 100, observedComeUp: 0, shots: 3, sigmaMrad: 0.05, chronoVelocities: [792, 793, 791, 792, 792, 793] }, { rangeM: 870, observedComeUp: 12.5, shots: 8, sigmaMrad: 0.05 }]),
      missedImpactCount: 1, missesAt: { 870: 1 }, missedRanges: [], retryRanges: [], retriedMisses: [870],
      triedRanges: [100, 500, 870], farthestValidatedM: 870, rangeChecks: [], angleChecks: {}
    }
  });
  // a scripted worker: the first (usual-prior) fit finds a drag scale of +30 %, the second (widened) one +33 %
  const { SIGMA_DRAG_PCT } = await import('../src/engine/truing-session.js');
  const requests = [];
  const finding = (value) => ({ case: 3, grade: 'A', param: 'dragPct', pMaterial: 1, value, size: 1.4, resolution: 0.9 });
  const result = (value) => ({ plannedFarReached: true, planFar: 870, farthestShot: 870, notMaterial: [], notDetermined: [], nothingMaterial: false, homeworkDoubt: {},
    findings: [finding(value)], theta: { dragPct: value }, warm: null });
  setPlannerTransport((type, request) => {
    if (type !== 'truingAnalyse') return runInProcess(type, request);
    requests.push(request);
    return Promise.resolve(result(request.priors.dragPct === SIGMA_DRAG_PCT ? 30 : 33));
  });
  try {
    const container = makeElement('main');
    truingSessionView.mount(container);
    await settle(200);
    const usual = requests.filter((r) => r.priors.dragPct === SIGMA_DRAG_PCT).length;
    const widened = requests.filter((r) => r.priors.dragPct > 2 * SIGMA_DRAG_PCT).length;
    assert.ok(usual >= 1 && widened === usual && usual + widened === requests.length, `each conclusion: one fit on the usual prior, one on the widened (${usual}/${widened}/${requests.length})`);
    const text = container.textContent;
    assert.ok(text.includes(t('truingSession.conclusion.implausibleWarning')), 'the result is implausible');
    assert.ok(text.includes(`${(1 / 1.33).toFixed(3)}, drag +33.0%`), 'the information line is the widened fit\'s');
    assert.ok(!text.includes(', drag +30.0%'), 'not the usual-prior fit\'s');
    // with no miss there is nothing widened, and no second fit
    const { loadTruingSessionState } = await import('../src/truing-session-state.js');
    const session = JSON.parse(JSON.stringify(loadTruingSessionState().shootSession));
    saveTruingSessionState({ shootSession: { ...session, missedImpactCount: 0, missesAt: {}, retriedMisses: [] } });
    requests.length = 0;
    truingSessionView.mount(makeElement('main'));
    await settle(200);
    assert.ok(requests.length >= 1 && requests.every((r) => r.priors.dragPct === SIGMA_DRAG_PCT), 'only the usual prior');
  } finally {
    setPlannerTransport(runInProcess);
  }
});

test('the Conclude screen adds the click-value warning only when the click value was ticked as done', async () => {
  const conclude = async (homeworkState) => {
    setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 870, losAngleDeg: 0 }]);
    await settle();
    saveTruingSessionState({
      phase: 'conclude', homeworkState,
      sessionConditions: { tempC: 15, pressureHpa: 1013.25, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 },
      shootSession: {
        groups: keyed([{ rangeM: 100, observedComeUp: 0, shots: 3, sigmaMrad: 0.05 }, { rangeM: 870, observedComeUp: 10.2, shots: 8, sigmaMrad: 0.05 }]),
        missedImpactCount: 0, missedRanges: [], retryRanges: [], retriedMisses: [], triedRanges: [100, 870], farthestValidatedM: 870, rangeChecks: [], angleChecks: {}
      }
    });
    const container = makeElement('main');
    truingSessionView.mount(container);
    await settle(200);
    return container.textContent;
  };
  const warning = t('truingSession.conclusion.homeworkClickValue');
  const withClick = await conclude({ zeroVerified: true, trackTested: true });
  assert.ok(withClick.includes(warning));
  assert.ok(withClick.includes(t('truingSession.conclusion.homeworkAssumed', { items: `${t('truingSession.homework.tick.trackTested')}, ${t('truingSession.homework.tick.zeroVerified')}` }).slice(0, 80)), 'the click value leads the list');
  assert.ok(!(await conclude({ zeroVerified: true })).includes(warning));
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
  await recordGroupNow(container, 0);
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
  await recordGroupNow(container, 0);
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
  const fields = findByTag(container, 'INPUT').filter(isComeUpOrBackdrop);
  const comeUp = fields[0];
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
    assert.ok(text.includes(t('truingSession.shoot.roundLabel', { n: 1, unit: t('truingSession.shoot.nextShotClicks') })), 'the come-up is entered in clicks');
    assert.ok(text.includes('MOA') && text.includes(t('truingSession.shoot.nextShotClicks')), 'the next shot is in MOA, with clicks as well');
    assert.equal(text.match(METRIC_LEFTOVER), null, `no metric leftover on Shoot: ${text.match(METRIC_LEFTOVER)}`);

    const chrono = findByTag(container, 'INPUT').find((i) => i.id === 'truingShotVelocity0'); // the first string is one round
    chrono.value = '2600';
    await recordGroupNow(container, 0);
    const { loadTruingSessionState } = await import('../src/truing-session-state.js');
    const v = loadTruingSessionState().shootSession.groups.at(-1).chronoVelocities;
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
        groups: keyed([{ rangeM: 100, observedComeUp: 0.3, shots: 3, sigmaMrad: 0.05, resolved: true, chronoVelocities: [800, 801, 799, 802, 800, 801] }, { rangeM: 870, observedComeUp: 11.6, shots: 8, sigmaMrad: 0.05, resolved: true }]),
        missedImpactCount: 0, missedRanges: [], retryRanges: [], retriedMisses: [], triedRanges: [100, 870], farthestValidatedM: 870, rangeChecks: [], angleChecks: {}
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

test('every Conclude finding is written in the preferred units (MOA, ft/s, yards)', async () => {
  const { conclusionPanel } = await import('../src/ui/truing-session/conclusion.js');
  await withUnits(IMPERIAL, 'moa', async () => {
    const analysis = {
      plannedFarReached: false, planFar: 870, farthestShot: 500, notMaterial: [], notDetermined: [], nothingMaterial: false,
      findings: [
        { case: 4, param: 'zeroMrad', value: 0.12, size: 0.05, clicks: 1.2, pMaterial: 0.9 },
        { case: 'measuredV0', param: 'v0Ms', value: -8, size: 2, pMaterial: 0.9 },
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
    assert.ok(text.includes('yd'), 'distances in yards');
    // 0.12 mrad is 0.41 MOA
    assert.ok(text.includes(units.toDisplayAngle(0.12)), 'the zero shift converted');
  });
});

test('chronograph readings are space-separated, with comma or dot as the decimal separator', async () => {
  const { parseReadings } = await import('../src/ui/truing-session/shoot-panel.js');
  assert.deepEqual(parseReadings('812 815.5 - 809,25 x'), [812, 815.5, null, 809.25, null]);
  assert.deepEqual(parseReadings('  812\t815  \n809 '), [812, 815, 809]);
  assert.deepEqual(parseReadings('812; 815'), [812, 815]);
  assert.deepEqual(parseReadings(''), []);
});

// ---- Rifle precision: bench rifle + shooter skill (or one simplified value), as in Hit Probability ----

const byId = (container, id) => findByTag(container, 'INPUT').concat(findByTag(container, 'SELECT')).find((n) => n.id === id);
async function mountPrepare(cartridgeExtras) {
  setUpArsenalAndLocation(undefined, cartridgeExtras);
  await settle();
  saveTruingSessionState({ phase: 'prepare' });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(60);
  return container;
}
const sessionR50 = async () => (await import('../src/truing-session-state.js')).loadTruingSessionState().homeworkState.r50Mrad;
const isHidden = (node) => { for (let n = node; n; n = n.parentNode) if (n.style && n.style.display === 'none') return true; return false; };

test('the rifle precision defaults to a basic rifle with a marksman, in quadrature', async () => {
  const container = await mountPrepare();
  assert.ok(byId(container, 'shooterSkill') && byId(container, 'position') && byId(container, 'simplifiedPrecisionEnabled'));
  assert.ok(isHidden(byId(container, 'combinedPrecision')), 'the simplified entry is off by default');
  assert.ok(Math.abs(await sessionR50() - Math.hypot(0.14, 0.12)) < 1e-9);
  assert.ok(container.textContent.includes(t('truingSession.homework.r50Resolved', { value: units.angle(Math.hypot(0.14, 0.12)) })));
});

test('the simplified toggle swaps bench rifle and shooter for one combined value', async () => {
  const container = await mountPrepare();
  const toggle = byId(container, 'simplifiedPrecisionEnabled');
  toggle.checked = true; fireEvent(toggle, 'change');
  assert.ok(isHidden(byId(container, 'benchPrecision')) && !isHidden(byId(container, 'combinedPrecision')));
  const combined = byId(container, 'combinedPrecision');
  combined.value = String(units.toDisplayAngle(0.3)); fireEvent(combined, 'input');
  assert.ok(Math.abs(await sessionR50() - 0.3) < 0.01, 'the combined value is the session R50');
});

test('an Arsenal rig precision recorded as combined selects the simplified entry; one recorded as bench keeps the shooter', async () => {
  let container = await mountPrepare({ precision: { mode: 'combined', r50Mrad: 0.25 } });
  assert.equal(byId(container, 'simplifiedPrecisionEnabled').checked, true);
  assert.equal(byId(container, 'combinedPrecisionThisRig').checked, true);
  assert.ok(Math.abs(await sessionR50() - 0.25) < 1e-9);

  resetTruingSessionStateForTests();
  container = await mountPrepare({ precision: { mode: 'own', r50Mrad: 0.2 } });
  assert.equal(byId(container, 'simplifiedPrecisionEnabled').checked, false);
  assert.ok(Math.abs(await sessionR50() - Math.hypot(0.2, 0.12)) < 1e-9);
});

test('a precision picked by hand is not replaced by the Arsenal one on the next visit', async () => {
  let container = await mountPrepare({ precision: { mode: 'own', r50Mrad: 0.2 } });
  const toggle = byId(container, 'simplifiedPrecisionEnabled');
  toggle.checked = true; fireEvent(toggle, 'change');
  container = makeElement('main');
  truingSessionView.mount(container);
  await settle(60);
  assert.equal(byId(container, 'simplifiedPrecisionEnabled').checked, true);
});

// ---- strings read round by round ----
// Read round by round the form has one come-up field (and, with a chronograph, one velocity field) per round: `text` is the come-ups in
// firing order, a "-" or a missing value leaves its field empty; `velocities` likewise in display units.
const roundFields = (container, prefix) => findByTag(container, 'INPUT').filter((i) => new RegExp(`^${prefix}\\d+$`).test(i.id || ''));
function fillRounds(container, text, velocities) {
  const comeUps = roundFields(container, 'truingShotComeUp');
  assert.ok(comeUps.length, 'expected the per-round come-up fields');
  const values = text.trim() === '' ? [] : text.trim().split(/\s+/);
  comeUps.forEach((field, i) => { field.value = values[i] == null || values[i] === '-' ? '' : values[i]; fireEvent(field, 'input'); });
  if (velocities != null) {
    const fields = roundFields(container, 'truingShotVelocity');
    assert.equal(fields.length, comeUps.length, 'one velocity field per round');
    const vs = velocities.trim() === '' ? [] : velocities.trim().split(/\s+/);
    fields.forEach((field, i) => { field.value = vs[i] == null || vs[i] === '-' ? '' : vs[i]; fireEvent(field, 'input'); });
  }
}
async function recordShotsNow(container, text, { velocities = null, dialog = 'continue' } = {}) {
  fillRounds(container, text, velocities);
  const record = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.recordGroupButton'));
  fireEvent(record, 'click');
  await settle();
  if (dialog !== 'leave' && dialogOpen()) await answerDialog(t(dialog === 'continue' ? 'truingSession.shoot.chronoShortContinue' : 'truingSession.shoot.chronoShortComplete'));
}

async function shootStringsSetUp() {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', plan: { ranges: [100, 300], shots: [1, 9], targets: [100, 300] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  await recordGroupNow(container, 0);
  const mode = findByTag(container, 'SELECT').find((s) => s.id === 'truingStringMode');
  assert.ok(mode, 'expected the string-reading choice');
  mode.value = 'shots';
  fireEvent(mode, 'change');
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  return { container, groups: () => loadTruingSessionState().shootSession.groups, session: () => loadTruingSessionState().shootSession };
}

test('a string read round by round records every come-up, averages them, and keeps the choice for the next string', async () => {
  const { container, groups } = await shootStringsSetUp();
  const certainty = findByTag(container, 'SELECT').find((s) => s.id === 'truingCertainty');
  assert.ok(certainty, 'the certainty picker is on every string, not just the near one');
  assert.equal(certainty.value, 'good', 'good by default');
  await recordShotsNow(container, '16 17 18');
  const g = groups()[1];
  assert.equal(g.mode, 'shots');
  assert.equal(g.shots, 3, 'the recommended number of rounds');
  assert.ok(Math.abs(g.observedComeUp - 1.7) < 1e-9, 'the mean of the rounds, in mrad');
  assert.deepEqual(g.shotComeUps.map((x) => Math.round(x * 100) / 100), [1.6, 1.7, 1.8]);
  assert.equal(g.certaintyKey, 'good');
  assert.ok(g.sigmaMrad > 0);
  assert.ok(g.noise && g.noise.sigmaObsMrad > 0 && Number.isFinite(g.noise.v0SensMrad) && 'r50Mrad' in g.noise, 'the string keeps the noise parts that do not depend on the velocity spread');
  // 9 rounds at 300 m: 3 + 3 + 3
  assert.ok(container.textContent.includes(t('truingSession.shoot.shotsToShoot', { count: 3 })), 'the next string at 300 m');
  assert.equal(findByTag(container, 'SELECT').find((s) => s.id === 'truingStringMode').value, 'shots', 'the reading choice stays');
});

test('the tool does not look for flyers: every round seen counts, and the screen says to shoot an obvious flyer again', async () => {
  const { container, groups } = await shootStringsSetUp();
  assert.ok(container.textContent.includes(t('truingSession.shoot.flyerRule')), 'the instruction is on the Shoot screen');
  fillRounds(container, '16 17 30');
  assert.ok(!container.textContent.includes('Leave round'), 'no flyer warning and no leave-it-out box');
  assert.equal(findByTag(container, 'INPUT').filter((i) => i.getAttribute('type') === 'checkbox' && i.parentNode && /round 3/i.test(i.parentNode.textContent)).length, 0);
  await recordShotsNow(container, '16 17 30');
  const g = groups()[1];
  assert.equal(g.shots, 3, 'nothing is left out');
  assert.equal(g.excludedShot, undefined);
  assert.ok(Math.abs(g.observedComeUp - (1.6 + 1.7 + 3.0) / 3) < 1e-9);
});

test('read round by round, the form has one come-up field per round and every one must be filled; the whole group can be reported as not seen', async () => {
  const { container, groups, session } = await shootStringsSetUp();
  assert.equal(roundFields(container, 'truingShotComeUp').length, 3, 'one come-up field for each of the three rounds');
  assert.equal(roundFields(container, 'truingShotVelocity').length, 0, 'no velocity fields without a chronograph');
  for (const text of ['16 17', '16 17 -', '']) {
    await recordShotsNow(container, text);
    assert.equal(groups().length, 1, `"${text}" is not recorded`);
    assert.ok(container.textContent.includes(t('truingSession.shoot.shotComeUpsCount', { n: 3 })), `"${text}" is asked for again`);
  }
  const miss = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.cantSeeImpactButton'));
  assert.ok(miss, 'the "cannot see the impacts" button stays, for the whole string');
  fireEvent(miss, 'click');
  await settle();
  assert.equal(groups().length, 1);
  assert.equal(session().missedImpactCount, 1, 'the whole string is a missed impact');
});

test('a string read at its centre has no rounds field: it is the recommended number of rounds', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', plan: { ranges: [100, 300], shots: [1, 9], targets: [100, 300] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  await recordGroupNow(container, 0);
  await recordGroupNow(container, 1.6);
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  const groups = loadTruingSessionState().shootSession.groups;
  assert.deepEqual(groups.map((g) => g.shots), [1, 3], 'one round at the near distance, a string of three at 300 m');
});

test('fewer velocities than rounds opens a question: go back and complete them, or carry on as is', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', homeworkState: { chronographAvailable: true }, plan: { ranges: [100, 300], shots: [1, 9], targets: [100, 300] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  const groups = () => loadTruingSessionState().shootSession?.groups || [];
  const chronoField = () => findByTag(container, 'INPUT').find((i) => i.id === 'truingChronoReadings');
  findByTag(container, 'INPUT').find((i) => i.id === 'truingShotVelocity0').value = '790'; // the one-round string is read round by round
  await recordGroupNow(container, 0, { dialog: 'leave' });
  assert.equal(dialogOpen(), false, 'one velocity for one round: nothing to ask');
  assert.equal(groups().length, 1);
  // the string at 300 m has three rounds; two velocities
  chronoField().value = '790 - 792';
  await recordGroupNow(container, 1.6, { dialog: 'leave' });
  assert.ok(dialogOpen() && dialogText().includes(t('truingSession.shoot.chronoShort', { n: 2, shots: 3 })));
  assert.equal(groups().length, 1, 'not recorded yet');
  await answerDialog(t('truingSession.shoot.chronoShortComplete'));
  assert.equal(dialogOpen(), false);
  assert.equal(groups().length, 1, 'going back records nothing');
  assert.equal(chronoField().value, '790 - 792', 'and keeps what was typed');
  await recordGroupNow(container, 1.6, { dialog: 'continue' });
  assert.equal(groups().length, 2, 'carrying on records the string as it is');
  assert.deepEqual(groups()[1].chronoVelocities, [790, null, 792]);
  assert.equal(groups()[1].shots, 3);
  // a velocity for every round: no question
  chronoField().value = '790 791 792';
  await recordGroupNow(container, 1.6, { dialog: 'leave' });
  assert.equal(dialogOpen(), false, 'every round has a velocity');
  assert.equal(groups().length, 3);
});

test('read round by round with a chronograph: one velocity field per round, and the same question when some are missing', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', homeworkState: { chronographAvailable: true }, plan: { ranges: [100, 300], shots: [1, 9], targets: [100, 300] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  const groups = () => loadTruingSessionState().shootSession?.groups || [];
  await recordGroupNow(container, 0, { dialog: 'leave' }); // the first rung: one round, one velocity wanted
  await answerDialog(t('truingSession.shoot.chronoShortContinue'));
  await answerFarRecheck(container); // 300 m is this plan's far target
  const mode = findByTag(container, 'SELECT').find((s) => s.id === 'truingStringMode');
  mode.value = 'shots';
  fireEvent(mode, 'change');
  assert.equal(roundFields(container, 'truingShotComeUp').length, 3);
  assert.equal(roundFields(container, 'truingShotVelocity').length, 3, 'a velocity field beside each come-up');
  const listField = findByTag(container, 'INPUT').find((i) => i.id === 'truingChronoReadings');
  assert.equal(listField.parentNode.style.display, 'none', 'the list-of-velocities field is only for strings read at their centre');
  await recordShotsNow(container, '16 17 18', { velocities: '790 - 792', dialog: 'leave' });
  assert.ok(dialogOpen() && dialogText().includes(t('truingSession.shoot.chronoShort', { n: 2, shots: 3 })));
  await answerDialog(t('truingSession.shoot.chronoShortComplete'));
  assert.equal(groups().length, 1, 'going back records nothing');
  assert.equal(roundFields(container, 'truingShotVelocity')[0].value, '790', 'and keeps what was typed');
  await recordShotsNow(container, '16 17 18', { velocities: '790 - 792', dialog: 'continue' });
  assert.deepEqual(groups()[1].chronoVelocities, [790, null, 792], 'a round with no velocity is a missed reading');
  assert.equal(groups()[1].shots, 3);
  await recordShotsNow(container, '16 17 18', { velocities: '790 791 792', dialog: 'leave' });
  assert.equal(dialogOpen(), false, 'a velocity for every round: no question');
  assert.deepEqual(groups()[2].chronoVelocities, [790, 791, 792]);
});

// ---- implausible entries: advice next to the field, recorded as typed ----
const hintText = (key, vars = {}) => t(`truingSession.shoot.plausibleHint.${key}`, { unit: t('truingSession.shoot.nextShotClicks'), rec: '', ...vars });
const fieldWarning = (input) => (input.parentNode ? input.parentNode.textContent : '');
const typeInto = (input, value) => { input.value = value; fireEvent(input, 'input'); };

test('a come-up that looks wrong gets a warning with the likely slip named, and is recorded as typed anyway', async () => {
  const { container, groups } = await shootStringsSetUp(); // the string at 300 m; the dope is about 16 clicks
  const mode = findByTag(container, 'SELECT').find((s) => s.id === 'truingStringMode');
  mode.value = 'average';
  fireEvent(mode, 'change');
  const comeUp = findByTag(container, 'INPUT').filter((i) => i.getAttribute('type') === 'number' && !i.id)[0];
  typeInto(comeUp, '16');
  assert.ok(!['mrad', 'delta', 'sign', 'tenth'].some((h) => fieldWarning(comeUp).includes(hintText(h).split('(')[0])), 'an ordinary entry has no warning');
  typeInto(comeUp, '1.6'); // mrad typed where clicks are wanted
  assert.ok(fieldWarning(comeUp).includes(hintText('mrad')), 'the mrad hint');
  typeInto(comeUp, '3'); // "+3": a difference to the recommended come-up
  assert.ok(fieldWarning(comeUp).includes(hintText('delta', { rec: '' }).split('(')[0]), 'the difference hint');
  typeInto(comeUp, '-3');
  assert.ok(fieldWarning(comeUp).includes(hintText('delta', { rec: '' }).split('(')[0]));
  typeInto(comeUp, '16');
  assert.ok(!fieldWarning(comeUp).includes(hintText('mrad')), 'the warning goes away when the entry is fixed');
  // advice only: whatever is typed is recorded
  typeInto(comeUp, '1.6');
  const record = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.recordGroupButton'));
  fireEvent(record, 'click');
  await settle();
  assert.equal(groups().length, 2);
  assert.ok(Math.abs(groups()[1].observedComeUp - 0.16) < 1e-9, 'the typed value, in mrad');
});

test('read round by round, each come-up and each velocity is judged on its own; the list of velocities gets one line', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', homeworkState: { chronographAvailable: true }, plan: { ranges: [100, 300], shots: [1, 9], targets: [100, 300] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  await recordGroupNow(container, 0);
  const mode = findByTag(container, 'SELECT').find((s) => s.id === 'truingStringMode');
  // centre mode: the list of velocities, one line for the whole field
  const list = findByTag(container, 'INPUT').find((i) => i.id === 'truingChronoReadings');
  typeInto(list, '790 79 791 7');
  const listWarning = fieldWarning(list);
  assert.ok(listWarning.includes('79, 7'), 'the values that look off are named in one line');
  typeInto(list, '790 791 792');
  assert.ok(!fieldWarning(list).includes('79, 7'));
  mode.value = 'shots';
  fireEvent(mode, 'change');
  const comeUps = roundFields(container, 'truingShotComeUp');
  const speeds = roundFields(container, 'truingShotVelocity');
  typeInto(comeUps[0], '16'); typeInto(comeUps[1], '17'); typeInto(comeUps[2], '160');
  assert.ok(!fieldWarning(comeUps[0]).includes(hintText('tenth')) && !fieldWarning(comeUps[1]).includes(hintText('tenth')));
  assert.ok(fieldWarning(comeUps[2]).includes(hintText('tenth')), 'only the third round looks off: a digit too many');
  typeInto(speeds[0], '790'); typeInto(speeds[1], '79'); typeInto(speeds[2], '791');
  assert.ok(fieldWarning(speeds[1]).includes(t('truingSession.shoot.plausibleHint.digit')), 'the second reading lost a digit');
  assert.ok(!fieldWarning(speeds[0]).includes(t('truingSession.shoot.plausibleHint.digit')));
  // recorded as typed, warnings and all
  const record = findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.recordGroupButton'));
  fireEvent(record, 'click');
  await settle();
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  const g = loadTruingSessionState().shootSession.groups[1];
  assert.deepEqual(g.chronoVelocities, [790, 79, 791]);
  assert.ok(Math.abs(g.shotComeUps[2] - 16) < 1e-9);
});

test('without a chronograph there is no question about velocities', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', plan: { ranges: [100], shots: [3], targets: [100] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  await recordGroupNow(container, 0, { dialog: 'leave' });
  assert.equal(dialogOpen(), false);
});

test('after a re-check corrected a planned target\'s distance, the rotation still shoots that target, at its corrected distance, and records it under its own key', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }]);
  await settle();
  const { loadUserLocations } = await import('../src/location-library.js');
  const [idA, idB] = loadUserLocations()[0].targets.map((tg) => tg.id);
  saveTruingSessionState({
    phase: 'shoot',
    plan: { ranges: [100, 300], shots: [1, 6], targets: [100, 300], keys: [idA, idB] },
    shootSession: {
      groups: [
        { rangeM: 100, targetKey: idA, observedComeUp: 0, shots: 1, sigmaMrad: 0.13 },
        { rangeM: 300, targetKey: idB, observedComeUp: 1.6, shots: 3, sigmaMrad: 0.08 }
      ],
      missedImpactCount: 0, missedRanges: [], retryRanges: [], retriedMisses: [], triedRanges: [100, 300], farthestValidatedM: 300,
      rangeChecks: [{ targetKey: idB, believedRangeM: 300, newReadingM: 312 }], angleChecks: {}, measuredRanges: { [idB]: 312 } // the re-check found B at 312 m
    }
  });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  assert.ok(container.textContent.includes(t('truingSession.shoot.nextRange', { range: units.dist(312) })), 'the next string is at B, shown at its corrected distance');
  assert.ok(container.textContent.includes(t('truingSession.shoot.shotsToShoot', { count: 3 })), 'the second of B\'s two strings');
  await recordGroupNow(container, 1.7);
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  const g = loadTruingSessionState().shootSession.groups[2];
  assert.equal(g.targetKey, idB, 'recorded under B, not a phantom target at the old distance');
  assert.equal(g.rangeM, 300, 'at the planned distance, like B\'s earlier string, so the range check corrects both alike');
  assert.ok(container.textContent.includes(t('truingSession.shoot.ladderDone')), 'every planned round shot');
});

test('the backdrop height field is in the location pane, not the equipment pane', async () => {
  setUpArsenalAndLocation();
  await settle();
  saveTruingSessionState({ phase: 'prepare' });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(300);
  const text = container.textContent;
  const field = text.indexOf(t('truingSession.equipment.backdropHint', { two: units.dist(2) }));
  assert.ok(field >= 0, 'the backdrop hint is drawn');
  assert.ok(field > text.indexOf(t('truingSession.location.heading')), 'after the location pane heading');
  assert.ok(field < text.indexOf(t('truingSession.rangeGrading.heading')), 'and before the next pane');
});

test('the notice after a mid-session correction says the location is unchanged, offers no way to save to it, and can be dismissed', async () => {
  const { sessionOnlyNotice } = await import('../src/ui/truing-session/recheck-prompt.js');
  let dismissed = false;
  const notice = sessionOnlyNotice({ changes: [{ name: 'B', field: 'range', from: 300, to: 312 }], onDismiss: () => { dismissed = true; } }).node;
  assert.ok(notice.textContent.includes(t('truingSession.choice.sessionOnlyNote')));
  assert.equal(findByTag(notice, 'BUTTON').length, 1, 'only a dismiss button');
  fireEvent(findByTag(notice, 'BUTTON')[0], 'click');
  assert.ok(dismissed);
});

test('nominalDist keeps its round number in metres and in yards', async () => {
  const { setUnit } = await import('../src/prefs.js');
  try {
    setUnit('distance', 'm');
    assert.equal(units.nominalDist(200), '200 m');
    setUnit('distance', 'yd');
    assert.equal(units.nominalDist(200), '200 yd');
    assert.equal(units.nominalDist(100), '100 yd');
  } finally { setUnit('distance', 'm'); }
});

test('the zero-atmosphere hint is left out for a zero of 100 m (yd) or less, whichever of the two the shooter reads in', async () => {
  const { setUnit } = await import('../src/prefs.js');
  const hint = () => t('truingSession.conditions.zeroFromConditions', { long: units.nominalDist(200), short: units.nominalDist(100) });
  const { saveUserRifle: saveRifle, loadUserRifles: loadRifles } = await import('../src/user-library.js');
  const mountWith = async (zeroRangeM) => {
    saveRifle({ ...loadRifles().find((r) => r.id === 'r1'), defaultZeroRangeM: zeroRangeM });
    const container = makeElement('main');
    truingSessionView.mount(container);
    await settle();
    const note = findByTag(container, 'P').find((p) => p.textContent === hint());
    return !!note && note.style.display !== 'none';
  };
  try {
    setUpArsenalAndLocation();
    await settle();
    assert.equal(await mountWith(100), false, '100 m');
    assert.equal(await mountWith(50), false, 'shorter');
    assert.equal(await mountWith(150), true, 'longer');
    setUnit('distance', 'yd');
    assert.equal(await mountWith(91.44), false, '100 yd');
    assert.equal(await mountWith(100), true, '100 m is more than 100 yd');
  } finally { setUnit('distance', 'm'); }
});

test('Prepare asks only how windy it is expected to be, with the boundary in the shooter\'s own wind unit', async () => {
  const { setUnit } = await import('../src/prefs.js');
  setUpArsenalAndLocation();
  await settle();
  const options = async (unit) => {
    setUnit('windSpeed', unit);
    const container = makeElement('main');
    truingSessionView.mount(container);
    await settle();
    const select = findByTag(container, 'SELECT').find((x) => x.id === 'truingWindStrength');
    assert.ok(select, 'the strength choice is there');
    assert.ok(!findByTag(container, 'SELECT').some((x) => x.id === 'truingWindConfidence'), 'and the old confidence dropdown is not');
    return findByTag(select, 'OPTION');
  };
  try {
    let opts = await options('m/s');
    assert.deepEqual(opts.map((o) => o.value), ['moderate', 'strong']);
    assert.ok(opts[0].textContent.includes('5 m/s') && opts[1].textContent.includes('5 m/s'));
    opts = await options('mph');
    assert.ok(opts[0].textContent.includes('11 mph') && opts[1].textContent.includes('11 mph'));
    opts = await options('km/h');
    assert.ok(opts[0].textContent.includes('18 km/h'));
    opts = await options('ft/s');
    assert.ok(opts[0].textContent.includes('16 ft/s'));
  } finally { setUnit('windSpeed', 'm/s'); }
});

test('the expected wind strength is saved, and a strength saved as a 3 m/s confidence by the earlier dropdown comes back as strong', async () => {
  setUpArsenalAndLocation();
  await settle();
  saveTruingSessionState({ phase: 'prepare', homeworkState: { windConfidenceMs: 3 } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const select = findByTag(container, 'SELECT').find((x) => x.id === 'truingWindStrength');
  assert.equal(select.value, 'strong');
  select.value = 'moderate';
  fireEvent(select, 'change');
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  assert.equal(loadTruingSessionState().homeworkState.windStrength, 'moderate');
});

test('the rounds field starts at the optimal number, follows it, and a number of the shooter\'s own stays', async () => {
  setUpArsenalAndLocation([
    { name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 500, losAngleDeg: 0 }, { name: 'D', rangeM: 800, losAngleDeg: 0 }
  ]);
  await settle();
  saveTruingSessionState({ phase: 'prepare', homeworkState: { chronographAvailable: true } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle(300);
  const budgetField = (c) => findByTag(c, 'INPUT').find((i) => i.getAttribute('type') === 'number' && i.getAttribute('min') === '6');
  const optimalRow = findByTag(container, 'TR').find((r) => r.textContent.includes(t('truingSession.rangeGrading.budgetRowOptimal')));
  const optimal = parseInt(/^(\d+)/.exec(optimalRow.textContent)[1], 10);
  assert.equal(parseInt(budgetField(container).value, 10), optimal, 'pre-filled with the optimal number');
  assert.ok(container.textContent.includes(t('truingSession.prepare.roundBudgetPrefilled')));
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  assert.equal(loadTruingSessionState().homeworkState.roundBudget, undefined, 'not saved as if the shooter had chosen it');

  const field = budgetField(container);
  field.value = '33';
  fireEvent(field, 'change');
  await settle(300);
  assert.equal(loadTruingSessionState().homeworkState.roundBudget, 33);
  const again = makeElement('main');
  truingSessionView.mount(again);
  await settle(300);
  assert.equal(parseInt(budgetField(again).value, 10), 33, 'the shooter\'s own number stays');
});

test('each group records the wind on its dial and the confidence in it; the next group starts from both, and the dope follows the dial', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 870, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({
    phase: 'shoot', plan: { ranges: [100, 300, 870], shots: [1, 4, 6], targets: [100, 300, 870] },
    sessionConditions: { tempC: 10, pressureHpa: 1013, humidityPct: 50, windSpeed: 0, windAngle: 90, altitudeM: 0 }
  });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  assert.ok(container.textContent.includes(t('truingSession.windConfidence.directionHint')), 'the hint that the wind direction matters, and to dial the observed windage');
  const confidence = () => findByTag(container, 'SELECT').find((x) => x.id === 'truingGroupWindConfidence');
  assert.deepEqual(findByTag(confidence(), 'OPTION').map((o) => o.value), ['excellent', 'good', 'fair', 'poor']);
  assert.equal(confidence().value, 'good');

  // a wind of 5 m/s moves the windage the screen recommends
  const windage = () => findByTag(container, 'DIV').find((d) => String(d.className).split(' ').includes('range-solver-stat') && d.textContent.includes(t('truingSession.shoot.nextShotWindage'))).textContent;
  const before = windage();
  const speed = findByTag(container, 'INPUT').find((i) => i.id === 'windSpeed');
  speed.value = '5';
  fireEvent(speed, 'input');
  assert.notEqual(windage(), before, 'the windage follows the dial as it is changed');
  confidence().value = 'fair';
  fireEvent(confidence(), 'change');
  await recordGroupNow(container, 0);

  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  let groups = loadTruingSessionState().shootSession.groups;
  assert.equal(groups[0].conditions.windSpeed, 5);
  assert.equal(groups[0].windConfidenceKey, 'fair');
  assert.ok(groups[0].noise.windSdMrad >= 0, 'the wind\'s error is kept with the string\'s noise parts');

  // the next group starts from the same wind and the same confidence
  assert.equal(confidence().value, 'fair');
  assert.equal(findByTag(container, 'INPUT').find((i) => i.id === 'windSpeed').value, speed.value);
  await recordGroupNow(container, 1.6);
  groups = loadTruingSessionState().shootSession.groups;
  assert.equal(groups[1].conditions.windSpeed, 5);
  assert.equal(groups[1].windConfidenceKey, 'fair');
});

test('the Prepare weather card is the air only: no wind dial there, and the conditions summary carries no wind', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  assert.ok(findByTag(container, 'INPUT').some((i) => i.id === 'tempC'), 'the air is there');
  assert.ok(!findByTag(container, 'INPUT').some((i) => i.id === 'windSpeed'), 'the wind is not');
  assert.equal(conditionsSummary({ tempC: 12, pressureHpa: 923, humidityPct: 40, windSpeed: 3, windAngle: 90 }), conditionsSummary({ tempC: 12, pressureHpa: 923, humidityPct: 40 }));
  assert.ok(!conditionsSummary({ tempC: 12, windSpeed: 3, windAngle: 90 }).includes('3'), 'a wind in the values is not written out');
});

test('the expected wind strength sits in the conditions card, between the air fields and the confirmation', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const text = container.textContent;
  const at = ['conditions.heading', 'homework.windStrengthLabel', 'conditions.confirmLabel', 'equipment.heading']
    .map((k) => text.indexOf(t(`truingSession.${k}`)));
  assert.ok(at.every((i) => i >= 0), `all present: ${at}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'conditions heading, wind strength, confirmation, then the first pane below');
  const select = findByTag(container, 'SELECT').find((x) => x.id === 'truingWindStrength');
  select.value = 'strong';
  fireEvent(select, 'change');
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  assert.equal(loadTruingSessionState().homeworkState.windStrength, 'strong', 'and it is still saved with the homework');
});

test('the Prepare weather is always the real air: no atmosphere preset to pick', async () => {
  setUpArsenalAndLocation();
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  assert.ok(!findByTag(container, 'SELECT').some((x) => x.id === 'atmospherePreset'), 'no preset selector');
  assert.ok(!findByTag(container, 'INPUT').some((i) => i.id === 'altitudeM'), 'no typed altitude (the pressure says it)');
  assert.ok(['tempC', 'pressureHpa', 'humidityPct'].every((id) => findByTag(container, 'INPUT').some((i) => i.id === id)), 'temperature, pressure and humidity as read');
});

test('the muzzle velocity average item shows the Arsenal value with its drift, sits above the SD, and its hint follows the chronograph', async () => {
  setUpArsenalAndLocation(undefined, { referenceTempC: 15, velocityTempSensitivity: 0.8 });
  await settle();
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const text = container.textContent;
  const label = t('truingSession.homework.mvAverageChecked', {
    arsenal: t('truingSession.homework.mvArsenalWithDrift', { velocity: units.vel(792.48), temp: units.temperature(15), rate: '+0.8 m/s/°C' })
  });
  assert.ok(text.includes(label), `label with the Arsenal value and drift: ${label}`);
  assert.ok(text.indexOf(label) < text.indexOf(t('truingSession.homework.mvSdShotsLabel')), 'above the SD');
  assert.ok(!findByTag(container, 'INPUT').some((i) => i.getAttribute('type') === 'number' && i.getAttribute('min') === '2' && i.getAttribute('max') === '100'), 'no shots-in-that-check box');
  // no chronograph: the item that matters most; ticking the chronograph box changes the hint
  assert.ok(text.includes(t('truingSession.homework.mvAverageHintNoChrono')));
  assert.ok(!text.includes(t('truingSession.homework.mvAverageHintChrono')));
  const chrono = findByTag(container, 'INPUT').find((i) => i.id === 'truingChronoAvailable');
  chrono.checked = true;
  fireEvent(chrono, 'change');
  await settle();
  assert.ok(container.textContent.includes(t('truingSession.homework.mvAverageHintChrono')));
  assert.ok(!container.textContent.includes(t('truingSession.homework.mvAverageHintNoChrono')));

  // a cartridge with no drift recorded shows the velocity alone
  localStorage.clear();
  setUpArsenalAndLocation();
  await settle();
  const plain = makeElement('main');
  truingSessionView.mount(plain);
  await settle();
  assert.ok(plain.textContent.includes(t('truingSession.homework.mvArsenal', { velocity: units.vel(792.48) })));
  assert.ok(!plain.textContent.includes('m/s/°C'));
});

test('"What would help" never advises something that reads as worse: each quoted spread is no larger than the current one', async () => {
  setUpArsenalAndLocation([
    { name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 200, losAngleDeg: 0 }, { name: 'C', rangeM: 300, losAngleDeg: 0 },
    { name: 'D', rangeM: 400, losAngleDeg: 0 }, { name: 'E', rangeM: 500, losAngleDeg: 0 }, { name: 'F', rangeM: 800, losAngleDeg: 0 }
  ]);
  await settle();
  let checked = 0;
  for (const homeworkState of [{ chronographAvailable: true, roundBudget: 20 }, { roundBudget: 20 }, { chronographAvailable: true, roundBudget: 30 }, { roundBudget: 12 }]) {
    saveTruingSessionState({ phase: 'prepare', homeworkState });
    const container = makeElement('main');
    truingSessionView.mount(container);
    await settle(200);
    for (const li of findByTag(container, 'LI')) {
      const m = /±([\d.]+)% → ±([\d.]+)%/.exec(li.textContent);
      if (!m) continue;
      checked++;
      assert.ok(Number(m[2]) <= Number(m[1]) + 1e-9, `advice reads as worse: ${li.textContent} (${JSON.stringify(homeworkState)})`);
    }
  }
  assert.ok(checked >= 8, `enough advice lines were checked: ${checked}`);
});

test('the Prepare readouts say they are calculating until the planner answers, and an answer to an older request is dropped', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 800, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'prepare' });
  const pending = [];
  setPlannerTransport((type, request) => (type === 'truingPrepare' ? new Promise((resolve) => pending.push({ request, resolve })) : runInProcess(type, request)));
  try {
    const container = makeElement('main');
    truingSessionView.mount(container);
    await settle();
    assert.ok(container.textContent.includes(t('truingSession.prepare.calculating')), 'calculating while the planner works');
    assert.equal(findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.prepare.startShootingButton')).disabled, true, 'no start without a plan');
    // a homework change sends a newer request before the first is answered
    const zero = findByTag(container, 'INPUT').find((i) => i.id === 'truingZeroVerified');
    zero.checked = true;
    fireEvent(zero, 'change');
    await settle();
    assert.ok(pending.length >= 2, `a second request: ${pending.length}`);
    const newest = pending[pending.length - 1];
    newest.resolve(computePrepare(structuredClone(newest.request)));
    await settle();
    const grading = () => container.textContent.includes(t('truingSession.rangeGrading.stringsHeading'));
    assert.ok(grading(), 'the newest answer is drawn');
    // the older answer, arriving late, does not replace it
    const older = pending[0];
    older.resolve({ ...computePrepare(structuredClone(older.request)), roundBudget: 999 });
    await settle();
    const field = findByTag(container, 'INPUT').find((i) => i.getAttribute('min') === '6');
    assert.notEqual(field.value, '999', 'a stale answer is dropped');
  } finally {
    setPlannerTransport(runInProcess);
  }
});

test('Conclude says which ticked item the shots do not bear out, and only above the doubt threshold', async () => {
  const { conclusionPanel } = await import('../src/ui/truing-session/conclusion.js');
  const base = { plannedFarReached: true, planFar: 800, farthestShot: 800, notMaterial: [], notDetermined: [], nothingMaterial: true, findings: [] };
  const draw = (homeworkDoubt) => conclusionPanel({
    analysis: { ...base, homeworkDoubt }, state: {}, clickMrad: 0.1, session: { groups: [{}], missedImpactCount: 0 }, rangeDeclaredFlat: true, rMax: 800,
    cartridgeName: 'X', bcDecision: null, homeworkTicked: ['zeroVerified', 'mvAverageChecked'], mvSD: 4, conditionsText: '', onNewSession() {}
  }).node.textContent;
  const zeroNote = t('truingSession.conclusion.homeworkDoubt', { item: t('truingSession.homework.tick.zeroVerified'), p: '93%' });
  assert.ok(draw({ zeroMrad: 0.93, v0Ms: 0.1 }).includes(zeroNote));
  assert.ok(!draw({ zeroMrad: 0.93, v0Ms: 0.1 }).includes(t('truingSession.homework.tick.mvAverageChecked') + ' tick'), 'the velocity, borne out, is not named');
  assert.ok(!draw({ zeroMrad: 0.3 }).includes(t('truingSession.conclusion.homeworkDoubt', { item: t('truingSession.homework.tick.zeroVerified'), p: '30%' })));
});

test('an implausible drag result is shown with the BC it fits, for information, and never offered for saving', async () => {
  const { conclusionPanel } = await import('../src/ui/truing-session/conclusion.js');
  const state = { dragModel: 'G7', bc: 0.2623, bcGainFactor: 1 };
  const draw = (value) => conclusionPanel({
    analysis: { plannedFarReached: true, planFar: 800, farthestShot: 800, notMaterial: [], notDetermined: [], nothingMaterial: false, homeworkDoubt: {},
      findings: [{ case: 3, grade: 'A', param: 'dragPct', pMaterial: 1, value, size: 1.4, resolution: 0.9 }] },
    state, clickMrad: 0.1, session: { groups: [{}], missedImpactCount: 0 }, rangeDeclaredFlat: true, rMax: 800,
    cartridgeName: 'X', bcDecision: null, homeworkTicked: [], mvSD: 4, conditionsText: '', onNewSession() {}, onSaveBc() {}
  }).node;
  const saveOffered = (node) => findByTag(node, 'BUTTON').some((b) => b.textContent === t('truingSession.conclusion.saveButton'));
  // 15 % is within the gain factor's 0.8-1.2, but more than three prior SDs out
  const far = draw(15);
  assert.ok(far.textContent.includes(t('truingSession.conclusion.implausibleWarning')));
  const factor = 1 / 1.15;
  assert.ok(far.textContent.includes(t('truingSession.conclusion.implausibleFittedBc', { model: 'G7', bc: (0.2623 * factor).toFixed(4), factor: factor.toFixed(3), drag: '+15.0%' })), 'the fitted BC, for information');
  assert.ok(!saveOffered(far), 'not offered for saving');
  const near = draw(5);
  assert.ok(!near.textContent.includes(t('truingSession.conclusion.implausibleWarning')));
  assert.ok(saveOffered(near), 'a plausible correction is offered as before');
});

test('the Shoot screen keeps the last analysis on screen, marked as updating, until the one for the newest group arrives', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 870, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', plan: { ranges: [100, 300, 870], shots: [1, 4, 6], targets: [100, 300, 870] } });
  const held = [];
  setPlannerTransport((type, request) => (type === 'truingAnalyse' ? new Promise((resolve) => held.push(() => resolve(runInProcess(type, request)))) : runInProcess(type, request)));
  try {
    const container = makeElement('main');
    truingSessionView.mount(container);
    await settle();
    await recordGroupNow(container, 0);
    assert.ok(held.length >= 1, 'the analysis was asked for');
    assert.ok(container.textContent.includes(t('truingSession.prepare.calculating')), 'the live panel says it is being worked out');
    held.splice(0).forEach((go) => go());
    await settle();
    assert.ok(!container.textContent.includes(t('truingSession.prepare.calculating')), 'and stops saying so once it has arrived');
    assert.ok(container.textContent.includes(t('truingSession.shoot.nextShotFromFit')), 'the next shot is dialled from the fit');
  } finally {
    setPlannerTransport(runInProcess);
  }
});

test('before the first string at the planned far target, the Shoot screen asks for its distance (and angle) again, once', async () => {
  setUpArsenalAndLocation([{ name: 'A', rangeM: 100, losAngleDeg: 0 }, { name: 'B', rangeM: 300, losAngleDeg: 0 }, { name: 'C', rangeM: 870, losAngleDeg: 0 }]);
  await settle();
  saveTruingSessionState({ phase: 'shoot', plan: { ranges: [100, 300, 870], shots: [1, 4, 6], targets: [100, 300, 870] } });
  const container = makeElement('main');
  truingSessionView.mount(container);
  await settle();
  const asked = () => container.textContent.includes(t('truingSession.shoot.farRecheck', { range: units.dist(870) }));
  const record = () => findByTag(container, 'BUTTON').find((b) => b.textContent === t('truingSession.shoot.recordGroupButton'));
  assert.ok(!asked() && record(), 'not at the near distances');
  // shoot the near and middle distances by hand, without answering anything
  for (const comeUp of [0, 1.6, 1.6]) {
    const input = findByTag(container, 'INPUT').filter(isComeUpOrBackdrop)[0];
    if (!input) break;
    input.value = String(comeUp / 0.1); fireEvent(input, 'input');
    fireEvent(record(), 'click');
    await settle();
    if (asked()) break;
  }
  assert.ok(asked(), 'asked before the first string at 870 m');
  assert.equal(record(), undefined, 'no string at the far target before the reading');
  assert.ok(await answerFarRecheck(container));
  const { loadTruingSessionState } = await import('../src/truing-session-state.js');
  const checks = loadTruingSessionState().shootSession.rangeChecks;
  assert.equal(checks.length, 1, 'the reading is recorded as a re-check of the far target');
  assert.ok(!asked() && record(), 'and then the string can be shot');
});
