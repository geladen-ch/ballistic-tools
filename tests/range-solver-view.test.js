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
const { resetRangeSolverStateForTests } = await import('../src/range-solver-state.js');
const { setIndicatorStyle } = await import('../src/range-solver-prefs.js');
const { getCookie } = await import('../src/cookies.js');
const rangeSolverView = await import('../src/views/range-solver-view.js');

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
