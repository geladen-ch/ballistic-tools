import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const markingView = await import('../src/views/rifle-precision-marking-view.js');
const {
  saveRiflePrecisionProject, findRiflePrecisionProjectById, resetRiflePrecisionLibraryForTests
} = await import('../src/rifle-precision-library.js');
const { generateUserId } = await import('../src/user-library.js');
const {
  setPendingMarking, isInMarkingMode, requestZoomIn, requestZoomOut, requestDone,
  resetRiflePrecisionNavForTests
} = await import('../src/rifle-precision-nav.js');

test.beforeEach(async () => {
  await resetRiflePrecisionLibraryForTests();
  resetRiflePrecisionNavForTests();
  location.hash = '';
});

function isHidden(node) {
  let n = node;
  while (n) {
    if (n.style && n.style.display === 'none') return true;
    n = n.parentNode;
  }
  return false;
}

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

// Elements built via src/svg.js's svgEl() (the calibration line overlay,
// the crosshair glyph inside every draggable marker) route their own
// `class` prop through plain setAttribute rather than dom.js's el(),
// which special-cases 'class' into the fake DOM's `className` string
// property — so findByClass() above can't see them; this walks the
// `class` *attribute* instead, which svgEl-built nodes do carry.
function findByAttr(node, attr, value, out = []) {
  if (node.getAttribute && node.getAttribute(attr) === value) out.push(node);
  for (const child of node.childNodes || []) findByAttr(child, attr, value, out);
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

// Every draggable point (both calibration points, the active group's own
// point of aim, the active group's own shots) is a `.photo-viewport-marker`
// carrying a `data-point-role` (shots also carry `data-shot-index`) — see
// rifle-precision-marking-view.js's own handleTap()/renderDraggableMarker().
function markerWithRole(node, role) {
  return findByClass(node, 'photo-viewport-marker').find((n) => n.getAttribute('data-point-role') === role);
}

function shotMarker(node, index) {
  return findByClass(node, 'photo-viewport-marker')
    .find((n) => n.getAttribute('data-point-role') === 'shot' && n.getAttribute('data-shot-index') === String(index));
}

const TEST_PHOTO = 'data:image/jpeg;base64,AAA';
const PHOTO_W = 1000;
const PHOTO_H = 800;

function makeTestProject(overrides = {}) {
  return {
    id: generateUserId('rp-project'), name: 'Home Range', distanceM: 100, caliberMm: 7.62,
    targets: [], createdAt: new Date().toISOString(), ...overrides
  };
}

function makeTestTarget(overrides = {}) {
  return {
    id: generateUserId('rp-target'), name: null, notes: null,
    photo: TEST_PHOTO, photoWidth: PHOTO_W, photoHeight: PHOTO_H,
    calibration: { point1: null, point2: null, realLengthMm: null },
    groups: [],
    ...overrides
  };
}

// photoViewport() (src/ui/locations/photo-viewport.js) drives its pan/tap
// gestures off real pointer events + getBoundingClientRect()/setPointerCapture(),
// none of which the fake DOM (tests/helpers/fake-dom.js) implements — the
// existing Locations placement-view test suite sidesteps this by only ever
// pre-seeding already-placed coords and driving plain buttons (Clear pin,
// Done, Zoom). To actually exercise this view's own tap/drag-driven state
// machine end to end, this monkey-patches just enough surface onto the
// widget/img nodes the fake DOM already builds — entirely test-local, no
// production code involved — so pointerdown/move/up round-trip through
// photo-viewport.js's real coordinate math exactly the way a real
// tap/drag would.
let pointerIdCounter = 0;
function primePhotoGesture(container) {
  const widget = findByClass(container, 'photo-viewport')[0];
  widget.getBoundingClientRect = () => ({ left: 0, top: 0, width: PHOTO_W, height: PHOTO_H });
  widget.setPointerCapture = () => {};
  widget.closest = () => null; // "not inside a <button>" — every tap here targets the plain photo background
  const img = findByTag(widget, 'IMG')[0];
  img.naturalWidth = PHOTO_W;
  img.naturalHeight = PHOTO_H;
  fireEvent(img, 'load');
  return widget;
}

// A tap-on-empty-background gesture — pointerdown+pointerup with the
// photo widget itself as e.target, matching primePhotoGesture()'s own
// `widget.closest = () => null` stub (so photo-viewport.js's own
// `e.target.closest('.photo-viewport-marker')` check at pointerdown
// always misses, i.e. this always lands as a plain background tap, never
// a marker drag).
function tap(widget, xFrac, yFrac) {
  const pointerId = ++pointerIdCounter;
  const evt = { pointerId, clientX: xFrac * PHOTO_W, clientY: yFrac * PHOTO_H, target: widget };
  fireEvent(widget, 'pointerdown', evt);
  fireEvent(widget, 'pointerup', evt);
}

// A drag gesture that starts *on* an existing marker element — a minimal
// stand-in for e.target whose own closest('.photo-viewport-marker')
// resolves to that exact marker (mirroring how a real DOM node under the
// pointer resolves via its ancestor chain), so photo-viewport.js's own
// pointerdown routing takes the 'drag-marker' branch (not 'pan') and
// remembers `markerNode` as the one it hands back as onMarkerMove's
// second argument on every subsequent move.
function dragMarker(widget, markerNode, toXfrac, toYfrac) {
  const pointerId = ++pointerIdCounter;
  const fakeTarget = { closest: (sel) => (sel === '.photo-viewport-marker' ? markerNode : null) };
  fireEvent(widget, 'pointerdown', { pointerId, clientX: 0, clientY: 0, target: fakeTarget });
  const move = { pointerId, clientX: toXfrac * PHOTO_W, clientY: toYfrac * PHOTO_H, target: widget };
  fireEvent(widget, 'pointermove', move);
  fireEvent(widget, 'pointerup', move);
}

test('mount() with no pending context redirects to /rifle-precision', () => {
  const container = makeElement('main');
  const cleanup = markingView.mount(container);
  assert.equal(location.hash, '#/rifle-precision');
  cleanup();
});

test('mount() redirects when the named project/target no longer resolves', () => {
  setPendingMarking({ projectId: 'deleted-project', targetId: 'deleted-target' });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);
  assert.equal(location.hash, '#/rifle-precision');
  cleanup();
});

test('mount() redirects when the target has no photo', () => {
  const target = makeTestTarget({ photo: null });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);
  assert.equal(location.hash, '#/rifle-precision');
  cleanup();
});

test('mount() enters marking mode, and cleanup exits it', () => {
  const target = makeTestTarget();
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  assert.equal(isInMarkingMode(), true);
  cleanup();
  assert.equal(isInMarkingMode(), false);
});

test('calibration: tapping the photo places point 1 immediately (no confirm step), and advances the hint to point 2', () => {
  const target = makeTestTarget();
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  assert.ok(container.textContent.includes(t('riflePrecision.stepCalibration')));
  assert.ok(container.textContent.includes(t('riflePrecision.calibrationHint1')));

  const widget = primePhotoGesture(container);
  tap(widget, 0.2, 0.3);

  let stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.calibration.point1.x.toFixed(3), '0.200');
  assert.equal(stored.calibration.point1.y.toFixed(3), '0.300');
  assert.equal(stored.calibration.point2, null);
  assert.ok(container.textContent.includes(t('riflePrecision.calibrationHint2')));
  assert.ok(markerWithRole(container, 'cal1'), 'point 1 renders as a draggable marker');

  // A further tap elsewhere places point 2, also immediately.
  tap(widget, 0.6, 0.3);
  stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.calibration.point2.x.toFixed(3), '0.600');
  assert.ok(markerWithRole(container, 'cal2'), 'point 2 also renders as a draggable marker');

  cleanup();
});

test('calibration: dragging an already-placed point updates its persisted coordinates', () => {
  const target = makeTestTarget({ calibration: { point1: { x: 0.2, y: 0.2 }, point2: null, realLengthMm: null } });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);
  const widget = primePhotoGesture(container);

  const point1Marker = markerWithRole(container, 'cal1');
  dragMarker(widget, point1Marker, 0.35, 0.4);

  const stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.calibration.point1.x.toFixed(3), '0.350');
  assert.equal(stored.calibration.point1.y.toFixed(3), '0.400');

  cleanup();
});

test('calibration: once both points exist, a connecting line and (once a length is set) its legend render, updating live as the length is typed', () => {
  const target = makeTestTarget({ calibration: { point1: { x: 0.1, y: 0.5 }, point2: { x: 0.9, y: 0.5 }, realLengthMm: null } });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  assert.equal(findByAttr(container, 'class', 'rp-calibration-line-svg').length, 1, 'the connecting line renders once both points exist');
  const initialLabel = findByClass(container, 'rp-calibration-length-label')[0];
  assert.ok(initialLabel, 'the legend element exists once both points do');
  assert.equal(initialLabel.style.display, 'none', 'but stays hidden until a length is set');

  const lengthInput = byId(container, 'riflePrecisionCalibrationLength');
  assert.ok(lengthInput, 'the length input is shown as soon as both points exist, with no separate confirm-point-2 gate');

  // Live-typing updates the on-screen legend without persisting yet.
  lengthInput.value = '200';
  fireEvent(lengthInput, 'input');
  let label = findByClass(container, 'rp-calibration-length-label')[0];
  assert.ok(label, 'the legend appears as soon as a valid length is typed');
  assert.equal(label.textContent, '200 mm');
  let stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.calibration.realLengthMm, null, 'not persisted yet — only committed on change/blur');

  // Committing (change/blur) persists it but does NOT auto-advance —
  // calibration only ends when the user explicitly presses "Done
  // calibrating", so a value can still be double-checked/edited.
  fireEvent(lengthInput, 'change');
  stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.calibration.realLengthMm, 200);
  assert.ok(container.textContent.includes(t('riflePrecision.stepCalibration')), 'stays on the calibration step');
  assert.ok(!container.textContent.includes(t('riflePrecision.stepPointOfAim')));

  const doneButton = buttonByKey(container, 'riflePrecision.calibrationDoneButton');
  assert.ok(doneButton, 'an explicit Done button appears once calibration is complete');
  fireEvent(doneButton, 'click');
  assert.ok(container.textContent.includes(t('riflePrecision.stepPointOfAim')), 'pressing Done advances to the point-of-aim step');

  cleanup();
});

test('calibration: the Done button does not appear until both points and a length are all set, and re-typing a length after Done was already available does not auto-advance', () => {
  const target = makeTestTarget({ calibration: { point1: { x: 0.1, y: 0.5 }, point2: { x: 0.9, y: 0.5 }, realLengthMm: null } });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  assert.ok(isHidden(buttonByKey(container, 'riflePrecision.calibrationDoneButton')), 'no Done button before a length is committed');

  const lengthInput = byId(container, 'riflePrecisionCalibrationLength');
  lengthInput.value = '150';
  fireEvent(lengthInput, 'change');
  assert.ok(!isHidden(buttonByKey(container, 'riflePrecision.calibrationDoneButton')), 'Done button appears once fully calibrated');
  assert.ok(container.textContent.includes(t('riflePrecision.stepCalibration')), 'still on the calibration step until Done is pressed');

  cleanup();
});

test('calibration: the Done button\'s visibility updates live as the length is typed, without waiting for change/blur', () => {
  const target = makeTestTarget({ calibration: { point1: { x: 0.1, y: 0.5 }, point2: { x: 0.9, y: 0.5 }, realLengthMm: null } });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  const doneButton = buttonByKey(container, 'riflePrecision.calibrationDoneButton');
  assert.ok(doneButton, 'the Done button node exists from the start (its visibility is what toggles, not its presence)');
  assert.ok(isHidden(doneButton), 'hidden before any length is typed');

  const lengthInput = byId(container, 'riflePrecisionCalibrationLength');
  lengthInput.value = '1';
  fireEvent(lengthInput, 'input');
  assert.ok(!isHidden(doneButton), 'a single valid digit already shows Done live, before change/blur');
  assert.equal(findRiflePrecisionProjectById(project.id).targets[0].calibration.realLengthMm, null, 'not persisted yet — this is a live display-only update');

  lengthInput.value = '';
  fireEvent(lengthInput, 'input');
  assert.ok(isHidden(doneButton), 'clearing the field hides Done live again');

  lengthInput.value = '0';
  fireEvent(lengthInput, 'input');
  assert.ok(isHidden(doneButton), 'a non-positive length stays hidden');

  lengthInput.value = '250';
  fireEvent(lengthInput, 'input');
  assert.ok(!isHidden(doneButton), 'a valid length shows Done again');

  cleanup();
});

test('point of aim: tapping the photo places the group\'s POA immediately and auto-advances into shot mode', () => {
  const target = makeTestTarget({ calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 } });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);
  const widget = primePhotoGesture(container);

  assert.ok(container.textContent.includes(t('riflePrecision.stepPointOfAim')));
  tap(widget, 0.5, 0.5);

  const stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.groups.length, 1);
  assert.equal(stored.groups[0].poa.x.toFixed(3), '0.500');
  assert.equal(stored.groups[0].shots.length, 0);
  assert.ok(container.textContent.includes(t('riflePrecision.stepImpacts')), 'auto-advances straight into shot mode');
  assert.ok(markerWithRole(container, 'poa'), 'the new group\'s own POA is now a draggable marker');

  cleanup();
});

test('shots: tapping appends immediately and stays draggable; dragging one updates only its own coordinates', () => {
  const group = { id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [] };
  const target = makeTestTarget({
    calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 },
    groups: [group]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);
  const widget = primePhotoGesture(container);

  // Enter shot mode for the one existing group via the group switcher.
  const groupTab = findByTag(container, 'BUTTON').find((b) => b.textContent === t('riflePrecision.groupTabLabel', { n: 1, count: 0 }));
  fireEvent(groupTab, 'click');
  assert.ok(container.textContent.includes(t('riflePrecision.stepImpacts')));

  tap(widget, 0.51, 0.49);
  tap(widget, 0.49, 0.51);
  let stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.groups[0].shots.length, 2);
  assert.equal(findByClass(container, 'rp-impact-marker').length, 2, 'each shot renders as a plain, draggable circle marker');

  // Drag the first shot (index 0) — only its own coordinates change.
  const firstShot = shotMarker(container, 0);
  dragMarker(widget, firstShot, 0.7, 0.75);
  stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.groups[0].shots[0].x.toFixed(3), '0.700');
  assert.equal(stored.groups[0].shots[0].y.toFixed(3), '0.750');
  assert.equal(stored.groups[0].shots[1].x.toFixed(3), '0.490', 'the other shot is untouched');

  cleanup();
});

test('delete impact: ignores taps on empty space, deletes only the tapped impact, and Cancel exits without deleting', () => {
  const group = {
    id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 },
    shots: [{ x: 0.51, y: 0.49 }, { x: 0.49, y: 0.51 }, { x: 0.52, y: 0.52 }]
  };
  const target = makeTestTarget({
    calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 },
    groups: [group]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);
  const widget = primePhotoGesture(container);

  const groupTab = findByTag(container, 'BUTTON').find((b) => b.textContent === t('riflePrecision.groupTabLabel', { n: 1, count: 3 }));
  fireEvent(groupTab, 'click');

  fireEvent(buttonByKey(container, 'riflePrecision.deleteImpactButton'), 'click');
  assert.ok(container.textContent.includes(t('riflePrecision.stepDeleteImpact')));
  assert.ok(container.textContent.includes(t('riflePrecision.deleteImpactHint')));
  assert.equal(findByClass(container, 'rp-impact-marker').length, 0, 'shots no longer render as draggable markers while deleting');
  const deleteButtons = findByClass(container, 'rp-shot-marker-delete');
  assert.equal(deleteButtons.length, 3, 'every shot instead renders as its own delete button');

  // A tap on empty space does nothing and stays in delete mode.
  tap(widget, 0.05, 0.95);
  let stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.groups[0].shots.length, 3, 'empty-space tap did not delete anything');
  assert.ok(container.textContent.includes(t('riflePrecision.stepDeleteImpact')), 'still in delete mode');

  // Tapping the middle impact's own delete button removes only that one.
  fireEvent(findByClass(container, 'rp-shot-marker-delete')[1], 'click');
  stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.groups[0].shots.length, 2);
  assert.equal(stored.groups[0].shots[0].x.toFixed(3), '0.510');
  assert.equal(stored.groups[0].shots[1].x.toFixed(3), '0.520', 'the deleted shot was the middle one, not the last');
  assert.ok(container.textContent.includes(t('riflePrecision.stepImpacts')), 'deleting exits back to shot mode');

  // Re-enter delete mode and Cancel — nothing is deleted.
  fireEvent(buttonByKey(container, 'riflePrecision.deleteImpactButton'), 'click');
  fireEvent(buttonByKey(container, 'riflePrecision.cancelDeleteImpactButton'), 'click');
  stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.groups[0].shots.length, 2, 'Cancel deleted nothing');
  assert.ok(container.textContent.includes(t('riflePrecision.stepImpacts')));

  cleanup();
});

test('only the active group\'s own point of aim is draggable; switching groups flips which one is', () => {
  const groupA = { id: generateUserId('rp-group'), poa: { x: 0.3, y: 0.3 }, shots: [{ x: 0.31, y: 0.31 }] };
  const groupB = { id: generateUserId('rp-group'), poa: { x: 0.7, y: 0.7 }, shots: [] };
  const target = makeTestTarget({
    calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 },
    groups: [groupA, groupB]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  // Mounts idle (already calibrated, groups exist) with the last group (B) active.
  assert.ok(container.textContent.includes(t('riflePrecision.stepGroups')));
  assert.ok(markerWithRole(container, 'poa'), 'group B (the last one) starts active and draggable');
  assert.equal(findByClass(container, 'target-pin-other-marker').length, 1, 'group A shows only as a static reference dot');
  assert.equal(findByClass(container, 'rp-impact-marker').length, 0, 'the inactive group\'s own shots are not shown');

  const groupATab = findByTag(container, 'BUTTON').find((b) => b.textContent === t('riflePrecision.groupTabLabel', { n: 1, count: 1 }));
  fireEvent(groupATab, 'click');

  assert.ok(container.textContent.includes(t('riflePrecision.stepImpacts')), 'selecting a group resumes shot mode for it');
  assert.equal(findByClass(container, 'target-pin-other-marker').length, 1, 'group B is now the static one');
  assert.ok(markerWithRole(container, 'poa'), 'group A is now draggable');
  assert.equal(findByClass(container, 'rp-impact-marker').length, 1, 'group A\'s own shot is now shown, draggable');

  cleanup();
});

test('adding a second group renders the first group\'s point of aim as a static reference dot, with Cancel offered', () => {
  const existingGroup = { id: generateUserId('rp-group'), poa: { x: 0.3, y: 0.3 }, shots: [{ x: 0.31, y: 0.31 }, { x: 0.29, y: 0.29 }] };
  const target = makeTestTarget({
    calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 },
    groups: [existingGroup]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  fireEvent(buttonByKey(container, 'riflePrecision.addGroupButton'), 'click');

  assert.ok(container.textContent.includes(t('riflePrecision.stepPointOfAim')));
  assert.ok(container.textContent.includes(t('riflePrecision.poaHint')));
  const refDots = findByClass(container, 'target-pin-other-marker');
  assert.equal(refDots.length, 1);
  assert.ok(refDots[0].textContent.includes(t('riflePrecision.groupLabel', { n: 1 })));
  assert.equal(markerWithRole(container, 'poa'), undefined, 'no draggable POA yet — nothing has been placed for the new group');
  assert.ok(buttonByKey(container, 'riflePrecision.cancelAddGroup'));

  cleanup();
});

test('Recalibrate re-enters the calibration step with the existing points and length already displayed, not wiped, and leaves groups/shots untouched', () => {
  const existingGroup = { id: generateUserId('rp-group'), poa: { x: 0.3, y: 0.3 }, shots: [{ x: 0.31, y: 0.31 }] };
  const target = makeTestTarget({
    calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 },
    groups: [existingGroup]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  fireEvent(buttonByKey(container, 'riflePrecision.recalibrateButton'), 'click');

  // Nothing was persisted/cleared just by entering the step — the stored
  // calibration and groups are exactly what they were before.
  const stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.deepEqual(stored.calibration, { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 });
  assert.equal(stored.groups.length, 1, 'recalibrating does not touch existing groups/shots');

  assert.ok(container.textContent.includes(t('riflePrecision.stepCalibration')));
  // Both points already exist, so the hint is the "second point" one, not
  // the "place your first point" one, and no confirm() prompt is involved.
  assert.ok(container.textContent.includes(t('riflePrecision.calibrationHint2')));
  assert.equal(buttonByKey(container, 'riflePrecision.recalibrateButton'), undefined, 'no "re"-calibrate button mid-calibration itself');

  // The display is initialized with the existing points and length, ready
  // to drag/edit in place rather than starting from a blank slate.
  assert.ok(markerWithRole(container, 'cal1'), 'existing point 1 renders as a draggable marker');
  assert.ok(markerWithRole(container, 'cal2'), 'existing point 2 renders as a draggable marker');
  assert.equal(byId(container, 'riflePrecisionCalibrationLength').value, '200', 'the length input is pre-filled with the existing value');
  const label = findByClass(container, 'rp-calibration-length-label')[0];
  assert.equal(label.textContent, '200 mm', 'the connecting line\'s length legend is shown immediately');
  assert.ok(buttonByKey(container, 'riflePrecision.calibrationDoneButton'), 'already fully calibrated, so Done is available right away');

  cleanup();
});

test('Zoom In/Zoom Out and Done reach the mounted view without throwing, and Done navigates back to the project list', () => {
  const target = makeTestTarget();
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  assert.doesNotThrow(() => requestZoomIn());
  assert.doesNotThrow(() => requestZoomOut());
  requestDone();
  assert.equal(location.hash, '#/rifle-precision');

  cleanup();
});

test('zoom/pan carries over when re-entering the same target\'s photo, but not to a different target', () => {
  const targetA = makeTestTarget({ name: 'A' });
  const targetB = makeTestTarget({ name: 'B' });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [targetA, targetB] }));

  setPendingMarking({ projectId: project.id, targetId: targetA.id });
  let container = makeElement('main');
  let cleanup = markingView.mount(container);
  requestZoomIn();
  cleanup();

  setPendingMarking({ projectId: project.id, targetId: targetA.id });
  container = makeElement('main');
  cleanup = markingView.mount(container);
  let inner = findByClass(container, 'photo-viewport-inner')[0];
  assert.ok(inner.style.transform.includes('scale(1.5)'), inner.style.transform);
  cleanup();

  setPendingMarking({ projectId: project.id, targetId: targetB.id });
  container = makeElement('main');
  cleanup = markingView.mount(container);
  inner = findByClass(container, 'photo-viewport-inner')[0];
  assert.equal(inner.style.transform, undefined);
  cleanup();
});

test('impact markers are sized to the rifle\'s own caliber (not a fixed size), and colored to match the precision-report diagram\'s own impacts', () => {
  // point1/point2 800px apart horizontally (1000px-wide photo) for a
  // 200mm real length -> 4 px/mm. caliberMm 7.62 (makeTestProject's own
  // default) -> diameter = 30.48px -> 3.048% of width, 3.81% of height
  // (PHOTO_W/PHOTO_H differ, so the two percentages must differ too — see
  // renderImpactMarker()'s own comment on why one shared % would be an
  // ellipse whenever the photo isn't square).
  const group = { id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.51, y: 0.49 }] };
  const target = makeTestTarget({
    calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 },
    groups: [group]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  const marker = shotMarker(container, 0);
  assert.ok(marker, 'the shot renders');
  assert.ok((marker.className || '').split(' ').includes('rp-impact-marker'));
  assert.ok(Math.abs(parseFloat(marker.style.width) - 3.048) < 1e-6, marker.style.width);
  assert.ok(Math.abs(parseFloat(marker.style.height) - 3.81) < 1e-6, marker.style.height);
  assert.equal(marker.style.background, '#3a7bd5', 'matches the diagram\'s own COLOR_POOLED_SHOT');

  cleanup();
});

test('the point-of-aim marker and calibration markers/line are colored to match the precision-report diagram (red PoA, green calibration)', () => {
  const group = { id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [] };
  const target = makeTestTarget({
    calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 },
    groups: [group]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  assert.equal(markerWithRole(container, 'poa').style.color, '#e0605a', 'matches the diagram\'s own COLOR_POA');

  fireEvent(buttonByKey(container, 'riflePrecision.recalibrateButton'), 'click');
  assert.equal(markerWithRole(container, 'cal1').style.color, '#2ecc71');
  assert.equal(markerWithRole(container, 'cal2').style.color, '#2ecc71');
  const line = findByAttr(container, 'class', 'rp-calibration-line-svg')[0];
  assert.equal(findByTag(line, 'LINE')[0].getAttribute('stroke'), '#2ecc71');

  cleanup();
});

test('the extreme-spread line/label and average-POI marker render live once a group has 2+ shots, and update as shots are added', () => {
  const group = { id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.51, y: 0.49 }] };
  const target = makeTestTarget({
    calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 },
    groups: [group]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);
  const widget = primePhotoGesture(container);

  assert.equal(findByAttr(container, 'class', 'rp-extreme-spread-line-svg').length, 0, 'nothing to measure an ES from with only 1 shot');
  assert.equal(findByClass(container, 'rp-poi-marker').length, 0);

  // Enter shot mode and add a second shot, well clear of the first.
  const groupTab = findByTag(container, 'BUTTON').find((b) => b.textContent === t('riflePrecision.groupTabLabel', { n: 1, count: 1 }));
  fireEvent(groupTab, 'click');
  tap(widget, 0.2, 0.2);

  const stored = findRiflePrecisionProjectById(project.id).targets[0];
  assert.equal(stored.groups[0].shots.length, 2);

  const lineSvg = findByAttr(container, 'class', 'rp-extreme-spread-line-svg')[0];
  assert.ok(lineSvg, 'the ES line now renders');
  assert.equal(findByTag(lineSvg, 'LINE')[0].getAttribute('stroke'), '#3a7bd5', 'matches the diagram\'s own COLOR_POOLED_SHOT (blue)');

  const label = findByClass(container, 'rp-extreme-spread-length-label')[0];
  assert.ok(label, 'its length legend renders');
  assert.ok(label.textContent.includes(t('riflePrecision.esLabel')), label.textContent);

  const poi = findByClass(container, 'rp-poi-marker')[0];
  assert.ok(poi, 'the average-POI marker renders');
  assert.equal(poi.style.background, '#e8a33d', 'matches the diagram\'s own COLOR_POI');

  // The label is drawn on top of everything else in this overlay group
  // (it's the one most likely to be obscured, since it can land right
  // next to or over the POI marker) — see renderGroupOverlay()'s own
  // comment. DOM/paint order for sibling absolutely-positioned elements
  // with no z-index is document order, so "on top" just means "appended
  // later" within their shared parent.
  const markersLayer = findByClass(container, 'photo-viewport-markers')[0];
  const siblings = Array.from(markersLayer.childNodes);
  assert.ok(siblings.indexOf(label) > siblings.indexOf(poi), 'the ES label is appended after (renders on top of) the POI marker');

  cleanup();
});

test('"Save group overview image" appears alongside the group selector in idle mode, and clicking it does not throw', () => {
  const group = { id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.51, y: 0.49 }, { x: 0.49, y: 0.51 }] };
  const target = makeTestTarget({
    calibration: { point1: { x: 0.1, y: 0.1 }, point2: { x: 0.9, y: 0.1 }, realLengthMm: 200 },
    groups: [group]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  setPendingMarking({ projectId: project.id, targetId: target.id });
  const container = makeElement('main');
  const cleanup = markingView.mount(container);

  // Mounts idle (already calibrated, a group exists) — the group selector
  // and the save-overview button should already be showing.
  assert.ok(container.textContent.includes(t('riflePrecision.stepGroups')));
  const saveButton = buttonByKey(container, 'riflePrecision.saveGroupOverviewButton');
  assert.ok(saveButton, 'the button renders next to the group selector');

  const widget = findByClass(container, 'photo-viewport')[0];
  widget.getBoundingClientRect = () => ({ left: 0, top: 0, width: PHOTO_W, height: PHOTO_H });
  assert.doesNotThrow(() => fireEvent(saveButton, 'click'));

  cleanup();
});
