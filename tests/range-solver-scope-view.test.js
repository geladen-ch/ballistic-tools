import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent, makeElement } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
await warmCatalogs();

const { saveUserScope, saveUserRifle } = await import('../src/user-library.js');
const reticleLibrary = await import('../src/reticle-library.js');
const { saveRifleState, resetShotStateForTests } = await import('../src/shot-state.js');
const { resetRangeSolverNavForTests } = await import('../src/range-solver-nav.js');
const { resetRangeSolverStateForTests } = await import('../src/range-solver-state.js');
const prefs = await import('../src/range-solver-prefs.js');
const { defaultScopeRecord, DEFAULT_CLICK_RAD } = await import('../src/scope-record.js');
const { createDocument } = await import('../src/reticle/model.js');
const { fieldOfViewAngle, mradToRad } = await import('../src/quantity.js');
const { resetUnits } = await import('../src/prefs.js');
const { resolveRifleOptic, rifleOpticKey } = await import('../src/rifle-optic.js');
const { zoomRingSlider } = await import('../src/ui/zoom-ring-slider.js');
const { scopeView } = await import('../src/ui/range-solver/scope-view.js');
const { settleZoom } = await import('../src/reticle/sight-picture.js');
const rangeSolverView = await import('../src/views/range-solver-view.js');

test.beforeEach(async () => {
  localStorage.clear();
  resetUnits();
  resetShotStateForTests();
  resetRangeSolverNavForTests();
  resetRangeSolverStateForTests();
  prefs.setScopeViewOn(false);
  prefs.setScopeAimMode('hold');
  prefs.setScopeRingPosition('auto');
  prefs.setScopeBdcOverlayOn(false);
  prefs.setBdcRangeDisplay('callout');
  prefs.setReticleOverlayColor('auto');
  prefs.setReticleOverlayShape('dots');
  await reticleLibrary.resetReticleLibraryForTests();
});

const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));
// Waits for `ready()`, polling: what is loaded or computed asynchronously
// (the rifle's optic, the BDC overlay's trajectories) takes as long as a
// loaded machine makes it, so no fixed delay is safe.
async function waitFor(ready, what, timeoutMs = 20000) {
  const until = Date.now() + timeoutMs;
  while (!ready()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await settle(20);
  }
}

function findAll(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const child of node.childNodes || []) findAll(child, pred, out);
  return out;
}
const hasClass = (cls) => (n) => typeof n.className === 'string' && n.className.split(' ').includes(cls);
const byClass = (root, cls) => findAll(root, (n) => hasClass(cls)(n) || (n.getAttribute && (n.getAttribute('class') || '').split(' ').includes(cls)));
function isHidden(node) {
  for (let n = node; n; n = n.parentNode) if (n.style && n.style.display === 'none') return true;
  return false;
}

function userReticle(id) {
  return reticleLibrary.saveUserReticle({ ...createDocument(), id, manufacturer: 'Acme', model: id });
}
function userScope(overrides = {}) {
  return saveUserScope({
    ...defaultScopeRecord(), id: 'user-scope-1', manufacturer: 'Acme', model: '5-25x56', reticleIds: ['user-reticle-1'],
    fovMaxRad: fieldOfViewAngle(7.5, 100), fovMinRad: fieldOfViewAngle(1.5, 100), magnificationMin: 5, magnificationMax: 25,
    clickUnit: 'mrad', clickHorizontalRad: DEFAULT_CLICK_RAD.mrad, clickVerticalRad: DEFAULT_CLICK_RAD.mrad,
    ...overrides
  });
}
function userRifle(overrides = {}) {
  return saveUserRifle({
    id: 'user-rifle-1', name: 'My Rifle', defaultSightHeightM: 0.05, defaultZeroRangeM: 100, defaultTwistDirection: 'right',
    defaultClickUnit: 'mrad', defaultClickHorizontalRad: mradToRad(0.1), defaultClickVerticalRad: mradToRad(0.1), source: '',
    cartridges: [{ id: 'c1', name: 'Load', muzzleVelocity: 850, referenceTempC: 15, velocityTempSensitivity: 0, bulletId: 'nato-m855' }],
    ...overrides
  });
}

test('a rifle\'s optic: its own reticle, else the scope\'s first that loads; anything missing is null', async () => {
  userReticle('user-reticle-1');
  userReticle('user-reticle-2');
  userScope({ reticleIds: ['user-reticle-1', 'user-reticle-2'] });
  let optic = await resolveRifleOptic({ id: 'r', scopeId: 'user-scope-1', reticleId: 'user-reticle-2' });
  assert.equal(optic.scope.id, 'user-scope-1');
  assert.equal(optic.reticle.id, 'user-reticle-2');
  optic = await resolveRifleOptic({ id: 'r', scopeId: 'user-scope-1', reticleId: 'gone' });
  assert.equal(optic.reticle.id, 'user-reticle-1');
  userScope({ reticleIds: ['gone', 'user-reticle-2'] });
  optic = await resolveRifleOptic({ id: 'r', scopeId: 'user-scope-1' });
  assert.equal(optic.reticle.id, 'user-reticle-2');

  const builtIn = await resolveRifleOptic({ id: 'r', scopeId: 'sb-pm2-3-20x50', reticleId: 'sb-p4fl' });
  assert.equal(builtIn.scope.id, 'sb-pm2-3-20x50');
  assert.equal(builtIn.reticle.id, 'sb-p4fl');

  assert.equal(await resolveRifleOptic(null), null);
  assert.equal(await resolveRifleOptic({ id: 'r' }), null);
  assert.equal(await resolveRifleOptic({ id: 'r', scopeId: 'user-scope-missing' }), null);
  userScope({ reticleIds: [] });
  assert.equal(await resolveRifleOptic({ id: 'r', scopeId: 'user-scope-1' }), null);
  userScope({ reticleIds: ['gone'] });
  assert.equal(await resolveRifleOptic({ id: 'r', scopeId: 'user-scope-1' }), null);
});

test('the optic key changes with the rifle, its scope and its reticle', () => {
  assert.equal(rifleOpticKey(null), '');
  assert.equal(rifleOpticKey({ id: 'a' }), '');
  const a = rifleOpticKey({ id: 'a', scopeId: 's', reticleId: 'x' });
  assert.notEqual(a, rifleOpticKey({ id: 'a', scopeId: 's', reticleId: 'y' }));
  assert.notEqual(a, rifleOpticKey({ id: 'b', scopeId: 's', reticleId: 'x' }));
});

test('the scope view prefs round-trip and default to off / hold', () => {
  assert.equal(prefs.isScopeViewOn(), false);
  prefs.setScopeViewOn(true);
  assert.equal(prefs.isScopeViewOn(), true);
  assert.equal(prefs.getScopeAimMode(), 'hold');
  prefs.setScopeAimMode('dialElevation');
  assert.equal(prefs.getScopeAimMode(), 'dialElevation');
  prefs.setScopeAimMode('nonsense');
  assert.equal(prefs.getScopeAimMode(), 'dialElevation');
  assert.equal(prefs.getScopeRingPosition(), 'auto');
  prefs.setScopeRingPosition('below');
  assert.equal(prefs.getScopeRingPosition(), 'below');
  prefs.setScopeRingPosition('nonsense');
  assert.equal(prefs.getScopeRingPosition(), 'below');
});

test('zoom ring: switching orientation re-places the thumb and ticks along the other axis', () => {
  const optics = { type: 'ffp', zoomMin: 4, zoomMax: 16 };
  const ring = zoomRingSlider({ orientation: 'vertical' });
  ring.setRing(optics, [4, 16], (z) => settleZoom(optics, z), 7);
  const thumb = () => byClass(ring.node, 'zoom-ring-thumb')[0];
  assert.equal(thumb().style.top, '75.000%');
  assert.equal(thumb().style.left, '');
  ring.setOrientation('horizontal');
  assert.equal(ring.getOrientation(), 'horizontal');
  assert.equal(ring.node.getAttribute('aria-orientation'), 'horizontal');
  assert.ok(hasClass('zoom-ring-horizontal')(ring.node) && !hasClass('zoom-ring-vertical')(ring.node));
  assert.equal(thumb().style.left, '25.000%');
  assert.equal(thumb().style.top, '');
  const ticks = byClass(ring.node, 'zoom-ring-tick');
  assert.ok(ticks.length > 0 && ticks.every((tick) => tick.style.left && !tick.style.top));
  assert.equal(ring.getValue(), 7, 'the value survives the switch');
  ring.setOrientation('diagonal');
  assert.equal(ring.getOrientation(), 'horizontal');
});

// A matchMedia stand-in answering each query from `state`, with the
// listeners it was handed, so a test can flip the orientation.
function fakeMedia(state) {
  const listeners = new Set();
  globalThis.matchMedia = (query) => ({
    get matches() { return !!state[query]; },
    addEventListener: (type, fn) => listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn)
  });
  return { flip: (next) => { Object.assign(state, next); for (const fn of listeners) fn(); }, listeners };
}

test('the scope ring lies below the reticle per the setting, the orientation and the mobile chrome', (t) => {
  t.after(() => { delete globalThis.matchMedia; });
  const NARROW = '(max-width: 780px)';
  const PORTRAIT = '(orientation: portrait)';
  const layoutOf = (view) => {
    const main = byClass(view.node, 'scope-view-main')[0];
    const ring = byClass(view.node, 'zoom-ring')[0];
    return { below: hasClass('ring-below')(main), orientation: ring.getAttribute('aria-orientation') };
  };

  // Auto: below on a narrow portrait screen, beside once it turns.
  const media = fakeMedia({ [NARROW]: true, [PORTRAIT]: true });
  let view = scopeView();
  assert.deepEqual(layoutOf(view), { below: true, orientation: 'horizontal' });
  media.flip({ [PORTRAIT]: false });
  assert.deepEqual(layoutOf(view), { below: false, orientation: 'vertical' });
  view.dispose();
  assert.equal(media.listeners.size, 0, 'dispose drops the media listeners');

  // Auto on a wide portrait screen stays beside; Below does not.
  fakeMedia({ [NARROW]: false, [PORTRAIT]: true });
  view = scopeView();
  assert.equal(layoutOf(view).below, false);
  view.dispose();
  prefs.setScopeRingPosition('below');
  view = scopeView();
  assert.equal(layoutOf(view).below, true);
  view.dispose();

  // Below never applies in landscape; Beside never moves.
  fakeMedia({ [NARROW]: true, [PORTRAIT]: false });
  view = scopeView();
  assert.equal(layoutOf(view).below, false);
  view.dispose();
  prefs.setScopeRingPosition('beside');
  fakeMedia({ [NARROW]: true, [PORTRAIT]: true });
  view = scopeView();
  assert.deepEqual(layoutOf(view), { below: false, orientation: 'vertical' });
  view.dispose();
});

test('zoom ring: keys step, leave an SFP calibration snap, and stop at the ends', () => {
  const optics = { type: 'sfp', zoomMin: 4, zoomMax: 16, calibrationZoom: 10 };
  const seen = [];
  const ring = zoomRingSlider({ orientation: 'vertical', onInput: (z) => seen.push(z) });
  ring.setRing(optics, [4, 16], (z) => settleZoom(optics, z), 10);
  assert.equal(ring.getValue(), 10);
  assert.equal(ring.node.getAttribute('aria-valuetext'), '10×');
  fireEvent(ring.node, 'keydown', { key: 'ArrowUp' });
  assert.ok(ring.getValue() > 10.5, `left the snap window upwards: ${ring.getValue()}`);
  fireEvent(ring.node, 'keydown', { key: 'ArrowDown' });
  assert.equal(ring.getValue(), 10, 'stepping back in snaps again');
  fireEvent(ring.node, 'keydown', { key: 'End' });
  assert.equal(ring.getValue(), 16);
  fireEvent(ring.node, 'keydown', { key: 'PageUp' });
  assert.equal(ring.getValue(), 16);
  fireEvent(ring.node, 'keydown', { key: 'Home' });
  assert.equal(ring.getValue(), 4);
  assert.equal(seen.at(-1), 4);
  // The calibration bar is marked.
  assert.equal(byClass(ring.node, 'calibration').length, 1);
  // A fixed scope has no ring.
  ring.setRing({ type: 'fixed', zoomMin: 4, zoomMax: 4 }, null, null, 4);
  assert.equal(ring.node.style.display, 'none');
});

async function mountSolver() {
  const container = makeElement('main');
  const cleanup = rangeSolverView.mount(container);
  await settle(120);
  return { container, cleanup };
}

test('no toggle for a rifle without a scope', async () => {
  userRifle();
  saveRifleState({ library: { rifleId: 'user-rifle-1', cartridgeId: 'c1' } });
  const { container, cleanup } = await mountSolver();
  const toggle = byClass(container, 'range-solver-scope-toggle')[0];
  assert.ok(toggle);
  assert.equal(toggle.style.display, 'none');
  assert.ok(isHidden(byClass(container, 'scope-view')[0]));
  cleanup();
});

test('a rifle with a scope offers the toggle; on, the scope view shows above a compact readout with the aiming mark', async () => {
  userRifle({ scopeId: 'sb-pm2-3-20x50', reticleId: 'sb-p4fl' });
  saveRifleState({ library: { rifleId: 'user-rifle-1', cartridgeId: 'c1' } });
  const { container, cleanup } = await mountSolver();
  const toggle = byClass(container, 'range-solver-scope-toggle')[0];
  assert.equal(toggle.style.display, '');
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(toggle.getAttribute('aria-label'), t('rangeSolver.scopeView.toggle'));
  const view = byClass(container, 'scope-view')[0];
  assert.ok(isHidden(view));

  fireEvent(toggle, 'click');
  await settle();
  assert.equal(prefs.isScopeViewOn(), true);
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.ok(!isHidden(view));
  assert.equal(toggle.parentNode.className, 'scope-view-corner', 'the toggle moves into the reticle\'s corner');
  assert.equal(byClass(container, 'range-solver-scope-toggle').length, 1);
  assert.ok(byClass(container, 'range-solver-readout')[0].className.includes('compact'));
  assert.ok(byClass(container, 'range-solver-layout')[0].className.includes('scope-view-on'));
  // The default 500 m shot is well inside a 3-20x's field at its highest zoom.
  assert.equal(byClass(view, 'scope-view-mark-ring').length, 1);
  assert.equal(byClass(view, 'scope-view-arrow-head').length, 0);
  assert.ok(byClass(view, 'reticle-shape').length > 0, 'the reticle is drawn');

  fireEvent(toggle, 'click');
  await settle();
  assert.equal(prefs.isScopeViewOn(), false);
  assert.ok(isHidden(view));
  assert.ok(!byClass(container, 'range-solver-readout')[0].className.includes('compact'));
  assert.equal(toggle.parentNode.className, 'range-solver-conditions-row', 'and back to the conditions row');
  assert.equal(byClass(container, 'range-solver-scope-toggle').length, 1);
  cleanup();
});

test('the mode switch is remembered', async () => {
  prefs.setScopeViewOn(true);
  userRifle({ scopeId: 'sb-pm2-3-20x50', reticleId: 'sb-p4fl' });
  saveRifleState({ library: { rifleId: 'user-rifle-1', cartridgeId: 'c1' } });
  const { container, cleanup } = await mountSolver();
  const dial = findAll(container, (n) => n.getAttribute && n.getAttribute('data-mode') === 'dialElevation')[0];
  assert.equal(dial.parentNode.parentNode.className, 'scope-view-corner-left', 'the switch sits in the reticle\'s top-left corner');
  assert.equal(dial.getAttribute('aria-label'), t('rangeSolver.scopeView.mode.dialElevation'));
  assert.equal(dial.textContent || '', '', 'icon only, no text');
  const hold = findAll(container, (n) => n.getAttribute && n.getAttribute('data-mode') === 'hold')[0];
  assert.equal(hold.getAttribute('aria-pressed'), 'true');
  fireEvent(dial, 'click');
  await settle();
  assert.equal(prefs.getScopeAimMode(), 'dialElevation');
  assert.equal(dial.getAttribute('aria-pressed'), 'true');
  assert.equal(hold.getAttribute('aria-pressed'), 'false');
  assert.ok(dial.className.includes('active') && !hold.className.includes('active'));
  cleanup();
});

test('BDC overlay: only for a reticle with BDC marks; on, each mark is labelled with its range and its crosswind holds, the aiming mark\'s ring kept', async (tc) => {
  // The fake worker never answers: the trajectories fly inline instead.
  const worker = global.Worker;
  delete global.Worker;
  tc.after(() => { global.Worker = worker; });
  prefs.setScopeViewOn(true);
  userRifle({ scopeId: 'sb-pm2-3-20x50', reticleId: 'sb-p4fl' });
  saveRifleState({ library: { rifleId: 'user-rifle-1', cartridgeId: 'c1' } });
  let mounted = await mountSolver();
  await waitFor(() => byClass(mounted.container, 'reticle-shape').length > 0, 'the P4F reticle');
  assert.equal(byClass(mounted.container, 'scope-view-corner-bottom-left')[0].style.display, 'none', 'no BDC marks, no toggle');
  mounted.cleanup();

  userRifle({ scopeId: 'element-immersive-5x30-bdc', reticleId: 'element-lpr-1d-bdc' });
  mounted = await mountSolver();
  const { container, cleanup } = mounted;
  await waitFor(() => byClass(container, 'reticle-shape').length > 0, 'the LPR-1D BDC reticle');
  const corner = byClass(container, 'scope-view-corner-bottom-left')[0];
  const toggle = byClass(container, 'scope-view-bdc-toggle')[0];
  assert.equal(corner.style.display, '');
  assert.equal(toggle.parentNode, corner);
  assert.equal(toggle.getAttribute('aria-label'), t('rangeSolver.scopeView.bdcOverlay'));
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(byClass(container, 'scope-view-bdc-label').length, 0);
  const windValue = byClass(container, 'scope-view-bdc-wind-value')[0];
  assert.equal(windValue.parentNode, corner);
  assert.equal(windValue.style.display, 'none', 'no reference crosswind while off');

  fireEvent(toggle, 'click');
  await waitFor(() => byClass(container, 'scope-view-bdc-dot').length > 0, 'the BDC overlay\'s trajectories');
  assert.equal(prefs.isScopeBdcOverlayOn(), true);
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(byClass(container, 'scope-view-mark-ring').length, 1, 'the ring stays');
  assert.equal(byClass(container, 'scope-view-mark-dot').length, 1, 'and its dot');
  const labels = byClass(container, 'scope-view-bdc-label');
  const dots = byClass(container, 'scope-view-bdc-dot');
  assert.ok(dots.length > 5, String(dots.length));
  assert.ok(labels.length > 1 && labels.length <= dots.length, 'labels that would crowd each other are left out');
  assert.equal(byClass(container, 'scope-view-bdc-wind').length, 12 * dots.length);
  assert.equal(windValue.style.display, '');
  assert.equal(windValue.textContent, '4 m/s', 'the reference crosswind above the toggle');
  assert.equal(windValue.getAttribute('aria-label'), t('rangeSolver.scopeView.bdcReferenceWind', { value: '4 m/s' }));
  const ranges = labels.map((n) => Number(n.textContent));
  assert.ok(ranges.every((r, i) => i === 0 || r > ranges[i - 1]), `ranges grow down the reticle: ${ranges}`);
  assert.equal(ranges[0], 100, 'the centre holds for the zero');

  const dial = findAll(container, (n) => n.getAttribute && n.getAttribute('data-mode') === 'dialElevation')[0];
  fireEvent(dial, 'click');
  await settle();
  const dialed = byClass(container, 'scope-view-bdc-label').map((n) => Number(n.textContent));
  assert.equal(dialed[0], 500, 'dialed, the centre holds for the target');
  assert.ok(dialed[1] > 500);

  fireEvent(toggle, 'click');
  await settle();
  assert.equal(prefs.isScopeBdcOverlayOn(), false);
  assert.equal(byClass(container, 'scope-view-bdc-label').length, 0);
  assert.equal(byClass(container, 'scope-view-mark-ring').length, 1, 'the ring is still there');
  assert.equal(windValue.style.display, 'none');
  cleanup();
});

const fixedScope = (overrides = {}) => ({
  ...defaultScopeRecord(), id: 'fixed-1', type: 'fixed', magnificationMin: 4, magnificationMax: 4, fovMaxRad: 0.12, fovMinRad: null, ...overrides
});
const reticleOf = (elements) => ({ illumination: { enabled: false }, elements });
const smallReticle = reticleOf([
  { type: 'dot', x: 0, y: 0, diameter: 0.001 },
  { type: 'hline', x: -0.012, y: 0, endX: 0.012, width: 0.0002 }
]);

test('zoom to reticle: opens at the fit, magnifying the field, labelled, and stepped with − / +', async () => {
  const view = scopeView();
  const corner = byClass(view.node, 'scope-view-corner-bottom-right')[0];
  const button = byClass(view.node, 'scope-view-reticle-zoom-toggle')[0];
  const steps = byClass(view.node, 'scope-view-reticle-zoom-steps')[0];
  const [zoomOut, zoomIn] = steps.childNodes;
  const label = byClass(view.node, 'scope-view-reticle-zoom-value')[0];
  const field = byClass(view.node, 'scope-view-field')[0];
  const canvas = byClass(view.node, 'scope-view-canvas')[0];
  assert.equal(corner.style.display, 'none', 'nothing shown without an optic');

  view.setOptic({ scope: fixedScope(), reticle: smallReticle });
  view.setShot({ elevationRad: 0.02, windageRad: 0 });
  await settle();
  assert.equal(corner.style.display, '');
  assert.equal(button.getAttribute('aria-label'), t('rangeSolver.scopeView.reticleZoom'));
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(label.style.display, 'none');
  assert.equal(steps.style.display, 'none', '− / + only while on');
  assert.equal(field.getAttribute('transform') || '', '');
  assert.equal(byClass(view.node, 'scope-view-mark-ring').length, 1, 'the hold is inside the plain field');

  fireEvent(button, 'click');
  await settle();
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.ok(button.className.includes('active'));
  assert.equal(steps.style.display, '');
  assert.equal(zoomOut.getAttribute('aria-label'), t('rangeSolver.scopeView.reticleZoomOut'));
  assert.equal(zoomIn.getAttribute('aria-label'), t('rangeSolver.scopeView.reticleZoomIn'));
  assert.equal(view.getReticleZoom(), 4.5);
  assert.equal(field.getAttribute('transform'), 'translate(500 500) scale(4.50000) translate(-500 -500)');
  assert.ok(canvas.classList.contains('reticle-zoomed'));
  assert.equal(label.style.display, '');
  assert.equal(label.textContent, t('rangeSolver.scopeView.reticleZoomValue', { nominal: '4×', extra: '4.5×' }));
  assert.equal(byClass(view.node, 'scope-view-mark-ring').length, 0, 'magnified, the hold leaves the view');
  assert.equal(byClass(view.node, 'scope-view-arrow-head').length, 1);

  fireEvent(zoomOut, 'click');
  await settle();
  assert.equal(view.getReticleZoom(), 4);
  assert.equal(label.textContent, t('rangeSolver.scopeView.reticleZoomValue', { nominal: '4×', extra: '4×' }));
  for (let i = 0; i < 3; i++) fireEvent(zoomOut, 'click');
  await settle();
  assert.equal(view.getReticleZoom(), 1);
  assert.equal(zoomOut.disabled, true);
  assert.equal(field.getAttribute('transform') || '', '', '1×: the plain field');
  assert.equal(byClass(view.node, 'scope-view-mark-ring').length, 1);
  for (let i = 0; i < 4; i++) fireEvent(zoomIn, 'click');
  assert.equal(view.getReticleZoom(), 4.5, 'the fit is a stop');
  for (let i = 0; i < 7; i++) fireEvent(zoomIn, 'click');
  await settle();
  assert.equal(view.getReticleZoom(), 10);
  assert.equal(zoomIn.disabled, true);
  assert.equal(zoomOut.disabled, false);

  fireEvent(button, 'click');
  await settle();
  assert.equal(view.getReticleZoom(), 1);
  assert.equal(field.getAttribute('transform') || '', '');
  assert.ok(!canvas.classList.contains('reticle-zoomed'));
  fireEvent(button, 'click');
  assert.equal(view.getReticleZoom(), 10, 'on again: the last setting');
  view.dispose();
});

test('zoom to reticle: any fixed scope, not variable ones; a full reticle opens at 1×; remembered per scope', () => {
  const view = scopeView();
  const corner = byClass(view.node, 'scope-view-corner-bottom-right')[0];
  const button = byClass(view.node, 'scope-view-reticle-zoom-toggle')[0];
  const variable = { ...fixedScope({ id: 'ffp-1', type: 'ffp', magnificationMin: 2, fovMinRad: 0.06 }) };
  view.setOptic({ scope: variable, reticle: smallReticle });
  assert.equal(corner.style.display, 'none');
  const full = reticleOf([{ type: 'dot', x: 0, y: 0.055, diameter: 0.001 }]);
  view.setOptic({ scope: fixedScope({ id: 'fixed-2' }), reticle: full });
  assert.equal(corner.style.display, '');
  fireEvent(button, 'click');
  assert.equal(view.getReticleZoom(), 1);

  const bars = reticleOf([{ type: 'vbar', x: 0, y: 0.01, endY: 0.06, nominalWidth: 0.004, endWidth: 0.001, thinningLength: 0.01 }]);
  view.setOptic({ scope: fixedScope({ id: 'fixed-3' }), reticle: bars });
  fireEvent(button, 'click');
  assert.equal(view.getReticleZoom(), 5, 'thinning bars only: the unfitted default');
  view.setOptic({ scope: fixedScope({ id: 'fixed-4' }), reticle: smallReticle });
  assert.equal(view.getReticleZoom(), 1, 'another scope starts off');
  view.setOptic({ scope: fixedScope({ id: 'fixed-3' }), reticle: bars });
  assert.equal(view.getReticleZoom(), 5, 'and the first is remembered');
  view.dispose();
});

test('the overlay colour: Auto is vermillion, blue on a reticle lit red or amber; a fixed choice is that colour', () => {
  const { reticleOverlayHex, getReticleOverlayColor, getReticleOverlayShape } = prefs;
  assert.equal(getReticleOverlayColor(), 'auto');
  assert.equal(getReticleOverlayShape(), 'dots');
  assert.equal(reticleOverlayHex('auto', undefined), '#D55E00');
  assert.equal(reticleOverlayHex('auto', { enabled: false, colour: 'red' }), '#D55E00', 'unlit');
  assert.equal(reticleOverlayHex('auto', { enabled: true, colour: 'red' }), '#0072B2');
  assert.equal(reticleOverlayHex('auto', { enabled: true, colour: 'amber' }), '#0072B2');
  assert.equal(reticleOverlayHex('auto', { enabled: true, colour: 'green' }), '#D55E00');
  assert.equal(reticleOverlayHex('vermillion', { enabled: true, colour: 'red' }), '#D55E00');
  assert.equal(reticleOverlayHex('blue', undefined), '#0072B2');
  prefs.setReticleOverlayColor('nonsense');
  assert.equal(getReticleOverlayColor(), 'auto');
});

test('the scope view takes its overlay colour per reticle', async () => {
  const lit = (colour) => ({ illumination: { enabled: true, colour }, elements: smallReticle.elements });
  let view = scopeView();
  view.setOptic({ scope: fixedScope(), reticle: smallReticle });
  assert.equal(view.node.style.getPropertyValue('--scope-mark'), '#D55E00');
  view.setOptic({ scope: fixedScope({ id: 'fixed-2' }), reticle: lit('amber') });
  assert.equal(view.node.style.getPropertyValue('--scope-mark'), '#0072B2');
  prefs.setReticleOverlayColor('vermillion');
  view = scopeView();
  view.setOptic({ scope: fixedScope(), reticle: lit('red') });
  assert.equal(view.node.style.getPropertyValue('--scope-mark'), '#D55E00');
});

test('hashes: the aiming mark\'s centre is a cross; the BDC overlay draws crosses and upright hashes, the reference\'s longer and thicker', async () => {
  const { integrate } = await import('../src/engine/trajectory.js');
  const { holdTable, withReferenceWind } = await import('../src/reticle/bdc-overlay.js');
  prefs.setReticleOverlayShape('hashes');
  const view = scopeView();
  const reticle = reticleOf([...smallReticle.elements, { type: 'bdc', x: 0, y: 0 }, { type: 'bdc', x: 0, y: 0.004 }]);
  view.setOptic({ scope: fixedScope(), reticle });
  view.setShot({ elevationRad: 0.002, windageRad: 0.001 });
  await settle();
  assert.equal(byClass(view.node, 'scope-view-mark-ring').length, 1, 'with its ring');
  assert.equal(byClass(view.node, 'scope-view-mark-cross').length, 1);
  assert.equal(byClass(view.node, 'scope-view-mark-dot').length, 0);

  const state = { muzzleVelocity: 840, bc: 0.475, dragModel: 'G1', zeroRange: 100, sightHeightM: 0.05, maxRange: 1500, rangeStep: 5 };
  const still = holdTable(integrate({ ...state, windSpeed: 0, windAngleRad: 0 }).points);
  const reference = holdTable(integrate({ ...state, windSpeed: 4, windAngleRad: Math.PI / 2 }).points);
  view.setBdcTables({ still: withReferenceWind(still, reference, 4), referenceSpeed: 4 });
  fireEvent(byClass(view.node, 'scope-view-bdc-toggle')[0], 'click');
  await settle();
  assert.equal(byClass(view.node, 'scope-view-mark-ring').length, 1, 'the ring stays with the overlay on');
  assert.equal(byClass(view.node, 'scope-view-mark-cross').length, 1);
  assert.equal(byClass(view.node, 'scope-view-bdc-cross').length, 2);
  const hashes = byClass(view.node, 'scope-view-bdc-hash');
  assert.equal(hashes.length, 24);
  assert.equal(byClass(view.node, 'scope-view-bdc-dot').length + byClass(view.node, 'scope-view-bdc-wind').length, 0, 'no dots');
  const strokes = [...new Set(hashes.map((h) => Number(h.getAttribute('stroke-width'))))].sort((a, b) => a - b);
  assert.equal(strokes.length, 2, 'two weights');
  const length = (h) => { const m = h.getAttribute('d').match(/M[-\d.]+ ([-\d.]+)V([-\d.]+)/); return Number(m[2]) - Number(m[1]); };
  const thick = hashes.filter((h) => Number(h.getAttribute('stroke-width')) === strokes[1]);
  const thin = hashes.filter((h) => Number(h.getAttribute('stroke-width')) === strokes[0]);
  assert.equal(thick.length, 4, 'the reference, either side, on both rows');
  assert.ok(length(thick[0]) > length(thin[0]), 'the reference\'s longer');
  const tops = new Set(hashes.map((h) => h.getAttribute('d').match(/M[-\d.]+ ([-\d.]+)V/)[1]));
  const crossCentres = new Set(byClass(view.node, 'scope-view-bdc-cross').map((c) => c.getAttribute('d').match(/M[-\d.]+ ([-\d.]+)H/)[1]));
  assert.deepEqual([...tops].sort(), [...crossCentres].sort(), 'the hashes hang from the levels the crosses are centred on');
  assert.equal(byClass(view.node, 'scope-view-bdc-label').length > 0, true);
});

test('the leads: in Hold to both axes; in Dial elevation none back to the centre along the horizontal axis', async () => {
  const leads = (view) => byClass(view.node, 'scope-view-lead');
  prefs.setScopeAimMode('hold');
  let view = scopeView();
  view.setOptic({ scope: fixedScope({ id: 'fixed-leads' }), reticle: smallReticle });
  view.setShot({ elevationRad: 0.01, windageRad: 0.008 });
  await settle();
  assert.equal(leads(view).length, 2);

  prefs.setScopeAimMode('dialElevation');
  view = scopeView();
  view.setOptic({ scope: fixedScope({ id: 'fixed-leads' }), reticle: smallReticle });
  view.setShot({ elevationRad: 0.01, windageRad: 0.008 });
  await settle();
  assert.equal(byClass(view.node, 'scope-view-mark-ring').length, 1, 'the mark is drawn');
  assert.equal(leads(view).length, 0);
  assert.equal(byClass(view.node, 'scope-view-lead-halo').length, 0);
});

test('BDC labels crowding each other shrink to fit, down to 75 %, before any is left out', async () => {
  const { integrate } = await import('../src/engine/trajectory.js');
  const { holdTable, withReferenceWind } = await import('../src/reticle/bdc-overlay.js');
  const state = { muzzleVelocity: 840, bc: 0.475, dragModel: 'G1', zeroRange: 100, sightHeightM: 0.05, maxRange: 2000, rangeStep: 5 };
  const still = holdTable(integrate({ ...state, windSpeed: 0, windAngleRad: 0 }).points);
  const reference = holdTable(integrate({ ...state, windSpeed: 4, windAngleRad: Math.PI / 2 }).points);
  const tables = { still: withReferenceWind(still, reference, 4), referenceSpeed: 4 };
  prefs.setScopeBdcOverlayOn(true);
  prefs.setBdcRangeDisplay('below');
  // A 4x fixed scope with a 0.12 rad field: 490 drawing units over 0.06 rad,
  // so the labels' full pitch (36 x 1.1) is about 4.85 mrad of rows.
  async function labelsAt(spacingMrad, id) {
    const view = scopeView();
    const levels = [0, 1, 2, 3].map((i) => mradToRad(i * spacingMrad));
    view.setOptic({ scope: fixedScope({ id }), reticle: reticleOf([...smallReticle.elements, ...levels.map((y) => ({ type: 'bdc', x: 0, y }))]) });
    view.setShot({ elevationRad: 0.002, windageRad: 0 });
    view.setBdcTables(tables);
    await settle();
    return byClass(view.node, 'scope-view-bdc-label').map((n) => Number(n.getAttribute('font-size')));
  }
  const wide = await labelsAt(6, 'fixed-labels-wide');
  assert.deepEqual(wide, [36, 36, 36, 36], 'room enough: full size');
  const medium = await labelsAt(4, 'fixed-labels-medium');
  assert.equal(medium.length, 4, 'shrunk, every label still shown');
  assert.ok(medium[0] < 36 && medium[0] > 27, String(medium[0]));
  assert.ok(medium.every((size) => size === medium[0]), 'all at one size');
  const tight = await labelsAt(2, 'fixed-labels-tight');
  assert.ok(tight.length < 4 && tight.length > 0, `some left out: ${tight.length}`);
  assert.ok(tight.every((size) => size === 27), 'only at 75 %');
});

test('Callout: each number level with its mark, a leader each (but one on its own row\'s holds), crossing no other leader, number or wind hold at any zoom', async () => {
  const { integrate } = await import('../src/engine/trajectory.js');
  const { holdTable, withReferenceWind } = await import('../src/reticle/bdc-overlay.js');
  const { loadScope } = await import('../src/scopes.js');
  const { loadReticle } = await import('../src/reticles.js');
  prefs.setScopeBdcOverlayOn(true);
  const state = { muzzleVelocity: 790, bc: 0.243, dragModel: 'G7', zeroRange: 100, sightHeightM: 0.05, maxRange: 2000, rangeStep: 5 };
  const still = holdTable(integrate({ ...state, windSpeed: 0, windAngleRad: 0 }).points);
  const reference = holdTable(integrate({ ...state, windSpeed: 4, windAngleRad: Math.PI / 2 }).points);
  const scope = await loadScope('element-immersive-5x30-bdc');
  const reticle = await loadReticle('element-lpr-1d-bdc');
  prefs.setBdcRangeDisplay('callout');
  const view = scopeView();
  view.setOptic({ scope: { ...scope, id: 'callouts-scope' }, reticle });
  view.setShot({ elevationRad: 0.004, windageRad: 0.001 });
  view.setBdcTables({ still: withReferenceWind(still, reference, 4), referenceSpeed: 4 });
  const points = (d) => [...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
  const side = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const cross = (a, b, c, d) => side(c, d, a) * side(c, d, b) < 0 && side(a, b, c) * side(a, b, d) < 0;
  const hitsBox = (p, q, box) => {
    for (let i = 0; i <= 50; i++) {
      const x = p.x + ((q.x - p.x) * i) / 50, y = p.y + ((q.y - p.y) * i) / 50;
      if (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) return true;
    }
    return false;
  };
  const crossings = () => {
    const leaders = byClass(view.node, 'scope-view-bdc-leader').map((n) => points(n.getAttribute('d')));
    const labels = byClass(view.node, 'scope-view-bdc-label');
    const boxes = labels.map((n) => {
      const size = Number(n.getAttribute('font-size')), x = Number(n.getAttribute('x')), base = Number(n.getAttribute('y'));
      const half = (n.textContent.length * 0.6 * size) / 2;
      return { x0: x - half, x1: x + half, y0: base - 0.72 * size, y1: base };
    });
    // The overlay's holds as drawn (wind dots and marks' dots), a leader's
    // own mark's dot — where it starts — aside.
    const holds = byClass(view.node, 'scope-view-bdc-wind').concat(byClass(view.node, 'scope-view-bdc-dot')).map((c) => {
      const x = Number(c.getAttribute('cx')), y = Number(c.getAttribute('cy')), r = Number(c.getAttribute('r'));
      return { x0: x - r, x1: x + r, y0: y - r, y1: y + r };
    });
    // Each leader's own number: the one its end is up against. A number
    // without a leader sits on its own row's holds.
    const near = (p, b) => Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.y0 - p.y, 0, p.y - b.y1));
    const own = leaders.map((a) => {
      const end = a[a.length - 1];
      return boxes.reduce((best, b, j) => (near(end, b) < near(end, boxes[best]) ? j : best), 0);
    });
    assert.equal(new Set(own).size, leaders.length, 'one leader per number at most');
    boxes.forEach((box, j) => {
      if (own.includes(j)) return;
      const y = (box.y0 + box.y1) / 2;
      const rowEnd = Math.max(...holds.filter((h) => h.y0 <= y && h.y1 >= y).map((h) => h.x1));
      assert.ok(box.x0 <= rowEnd + 12, `${labels[j].textContent} has no leader but is clear of its row`);
    });
    let n = 0;
    for (const a of leaders) {
      const start = a[0];
      const others = holds.filter((h) => !(start.x >= h.x0 && start.x <= h.x1 && start.y >= h.y0 && start.y <= h.y1));
      for (let s = 1; s < a.length; s++) for (const h of others) if (hitsBox(a[s - 1], a[s], h)) n += 1;
    }
    leaders.forEach((a, i) => {
      for (let s = 1; s < a.length; s++) {
        leaders.forEach((b, j) => {
          if (j <= i) return;
          for (let t = 1; t < b.length; t++) if (cross(a[s - 1], a[s], b[t - 1], b[t])) n += 1;
        });
        boxes.forEach((box, j) => { if (j !== own[i] && hitsBox(a[s - 1], a[s], box)) n += 1; });
      }
    });
    return { n, count: labels.length };
  };
  const zoomButton = byClass(view.node, 'scope-view-reticle-zoom-toggle')[0];
  const zoomIn = byClass(view.node, 'scope-view-reticle-zoom-steps')[0].childNodes[1];
  fireEvent(zoomButton, 'click');
  const firstLegs = { upright: 0, diagonal: 0 };
  for (let step = 0; step <= 6; step++) {
    await settle();
    const { n, count } = crossings();
    assert.ok(count > 5, `${view.getReticleZoom().toFixed(1)}x: ${count} numbers`);
    assert.equal(n, 0, `${view.getReticleZoom().toFixed(1)}x: ${n} crossings`);
    // Leaving their mark, leaders go at 45 degrees rather than straight up
    // or down — but where 45 degrees would run into a hold of the overlay.
    const markXs = byClass(view.node, 'scope-view-bdc-dot').map((d) => Number(d.getAttribute('cx')));
    const holdBoxes = byClass(view.node, 'scope-view-bdc-wind').concat(byClass(view.node, 'scope-view-bdc-dot')).map((h) => {
      const x = Number(h.getAttribute('cx')), y = Number(h.getAttribute('cy')), r = Number(h.getAttribute('r')) + 1;
      return { x0: x - r, x1: x + r, y0: y - r, y1: y + r };
    });
    for (const [a, b] of byClass(view.node, 'scope-view-bdc-leader').map((l) => points(l.getAttribute('d')))) {
      if (!markXs.some((m) => Math.abs(m - a.x) < 0.5) || Math.abs(b.y - a.y) < 1e-6) continue;
      if (Math.abs(b.x - a.x) > 1e-6) { firstLegs.diagonal += 1; continue; }
      firstLegs.upright += 1;
      const diagonal = { x: a.x + Math.abs(b.y - a.y), y: b.y };
      const blocked = holdBoxes.some((h) => !(a.x >= h.x0 && a.x <= h.x1 && a.y >= h.y0 && a.y <= h.y1) && hitsBox(a, diagonal, h));
      assert.ok(blocked, `${view.getReticleZoom().toFixed(1)}x: straight up where 45 degrees was clear`);
    }
    fireEvent(zoomIn, 'click');
  }
  assert.ok(firstLegs.diagonal > 0, JSON.stringify(firstLegs));
  await settle();
  // Zoomed in, some leaders start at their mark, the rest at their row's end.
  const markXs = byClass(view.node, 'scope-view-bdc-dot').map((d) => Number(d.getAttribute('cx')));
  const starts = byClass(view.node, 'scope-view-bdc-leader').map((n) => points(n.getAttribute('d'))[0].x);
  const fromMark = starts.filter((x) => markXs.some((m) => Math.abs(m - x) < 0.5)).length;
  assert.ok(fromMark > 0 && fromMark < starts.length, `${fromMark} of ${starts.length} from the mark`);
  // Every number sits level with its mark's dot.
  const dots = byClass(view.node, 'scope-view-bdc-dot').map((n) => Number(n.getAttribute('cy')));
  for (const label of byClass(view.node, 'scope-view-bdc-label')) {
    const centre = Number(label.getAttribute('y')) - (0.72 * Number(label.getAttribute('font-size'))) / 2;
    assert.ok(dots.some((y) => Math.abs(y - centre) < 0.5), `level: ${centre}`);
  }
  assert.equal(byClass(view.node, 'bdc-callouts').length, 1, 'the canvas isn\'t clipped to the circle');
});

test('Upwind: each range beside its mark on the side the wind comes from (the right with none), that side\'s wind holds left out', async () => {
  const { integrate } = await import('../src/engine/trajectory.js');
  const { holdTable, withReferenceWind } = await import('../src/reticle/bdc-overlay.js');
  const state = { muzzleVelocity: 840, bc: 0.475, dragModel: 'G1', zeroRange: 100, sightHeightM: 0.05, maxRange: 2000, rangeStep: 5 };
  const still = holdTable(integrate({ ...state, windSpeed: 0, windAngleRad: 0 }).points);
  const reference = holdTable(integrate({ ...state, windSpeed: 4, windAngleRad: Math.PI / 2 }).points);
  prefs.setScopeBdcOverlayOn(true);
  prefs.setBdcRangeDisplay('upwind');
  const reticle = reticleOf([...smallReticle.elements, { type: 'bdc', x: 0, y: 0 }, { type: 'bdc', x: 0, y: mradToRad(5) }]);
  for (const [crosswindMs, side] of [[3, 1], [-3, -1], [0, 1]]) {
    const view = scopeView();
    view.setOptic({ scope: fixedScope({ id: `upwind-${crosswindMs}` }), reticle });
    view.setShot({ elevationRad: 0.002, windageRad: 0, crosswindMs });
    view.setBdcTables({ still: withReferenceWind(still, reference, 4), referenceSpeed: 4 });
    await settle();
    const dots = byClass(view.node, 'scope-view-bdc-dot');
    const labels = byClass(view.node, 'scope-view-bdc-label');
    assert.equal(labels.length, 2, String(crosswindMs));
    assert.equal(byClass(view.node, 'scope-view-bdc-leader').length, 0, 'no leaders');
    for (const [i, label] of labels.entries()) {
      const cx = Number(dots[i].getAttribute('cx'));
      assert.equal(label.getAttribute('text-anchor'), side > 0 ? 'start' : 'end');
      assert.ok(Math.sign(Number(label.getAttribute('x')) - cx) === side, `${crosswindMs}: label side`);
    }
    // Per row: the six holds on the far side drawn, none on the label's.
    const cxs = dots.map((d) => Number(d.getAttribute('cx')));
    const winds = byClass(view.node, 'scope-view-bdc-wind').map((w) => Number(w.getAttribute('cx')));
    assert.equal(winds.length, 12, `${crosswindMs}: winds`);
    assert.ok(winds.every((x) => cxs.some((c) => Math.sign(x - c) === -side)), `${crosswindMs}: only the far side`);
  }
});
