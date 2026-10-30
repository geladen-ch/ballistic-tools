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
  await reticleLibrary.resetReticleLibraryForTests();
});

const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const builtIn = await resolveRifleOptic({ id: 'r', scopeId: 'sb-pm2-3-20x50', reticleId: 'sb-p4lf' });
  assert.equal(builtIn.scope.id, 'sb-pm2-3-20x50');
  assert.equal(builtIn.reticle.id, 'sb-p4lf');

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
  userRifle({ scopeId: 'sb-pm2-3-20x50', reticleId: 'sb-p4lf' });
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
  userRifle({ scopeId: 'sb-pm2-3-20x50', reticleId: 'sb-p4lf' });
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
