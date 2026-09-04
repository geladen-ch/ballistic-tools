import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { mountNavTabbar } = await import('../src/ui/nav-tabbar.js');
const { setGunsMode, setGunsReturnPath, resetGunsNavForTests, takeGunsReturnPath } = await import('../src/guns-nav.js');
const {
  setRangeSolverMode, getRangeSolverTab, resetRangeSolverNavForTests
} = await import('../src/range-solver-nav.js');
const { saveRifleState, resetShotStateForTests } = await import('../src/shot-state.js');
const { saveUserRifle } = await import('../src/user-library.js');

test.beforeEach(() => {
  location.hash = '';
  resetGunsNavForTests();
  resetRangeSolverNavForTests();
  resetShotStateForTests();
  localStorage.clear();
});

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('shows six tabs: Home, Analysis, Measurement, Range Solver, Guns, Settings', () => {
  const container = makeElement('nav');
  mountNavTabbar(container);

  const tabs = findByTag(container, 'A');
  assert.equal(tabs.length, 6);
  assert.deepEqual(
    tabs.map((a) => a.getAttribute('href')),
    ['#/', '#/analysis', '#/measurement', '#/range-solver', '#/guns/custom', '#/settings']
  );
  assert.ok(tabs[1].textContent.includes(t('catalog.groupAnalysis')));
  assert.ok(tabs[2].textContent.includes(t('catalog.groupMeasurement')));
  assert.ok(tabs[3].textContent.includes(t('nav.rangeSolver')));
});

test('Home and Settings are icon-only — no visible label, accessible name via aria-label/title instead', () => {
  const container = makeElement('nav');
  mountNavTabbar(container);

  const [home, , , , , settings] = findByTag(container, 'A');
  for (const link of [home, settings]) {
    assert.ok(link.className.includes('tab-item-compact'), `expected .tab-item-compact on ${link.getAttribute('href')}`);
    assert.equal(findByTag(link, 'SPAN').length, 0, 'no visible label span');
  }
  assert.equal(home.getAttribute('aria-label'), t('nav.home'));
  assert.equal(home.getAttribute('title'), t('nav.home'));
  assert.equal(settings.getAttribute('aria-label'), t('nav.settings'));
  assert.equal(settings.getAttribute('title'), t('nav.settings'));
});

test('the four labeled tabs carry a lang attribute on their label, for hyphens:auto', () => {
  const container = makeElement('nav');
  mountNavTabbar(container);

  const [, analysis, measurement, rangeSolver, guns] = findByTag(container, 'A');
  for (const link of [analysis, measurement, rangeSolver, guns]) {
    const span = findByTag(link, 'SPAN')[0];
    assert.equal(span.getAttribute('lang'), 'en');
  }
});

test('the tab matching the current route is active', () => {
  location.hash = '#/analysis';
  const container = makeElement('nav');
  mountNavTabbar(container);

  const tabs = findByTag(container, 'A');
  const active = tabs.filter((a) => a.className.includes('active'));
  assert.equal(active.length, 1);
  assert.equal(active[0].getAttribute('href'), '#/analysis');
});

test('Measurement and Analysis tabs carry their own category class for the hue', () => {
  const container = makeElement('nav');
  mountNavTabbar(container);

  const tabs = findByTag(container, 'A');
  assert.ok(tabs[1].className.includes('tab-item-analysis'));
  assert.ok(tabs[2].className.includes('tab-item-measurement'));
  assert.ok(!tabs[0].className.includes('tab-item-measurement'));
});

test('clicking Guns (no active rifle) opens Custom and records the return path', () => {
  location.hash = '#/trajectory';
  const container = makeElement('nav');
  mountNavTabbar(container);

  const gunsTab = findByTag(container, 'A')[4];
  assert.equal(gunsTab.getAttribute('href'), '#/guns/custom');
  fireEvent(gunsTab, 'click');

  assert.equal(location.hash, '#/guns/custom');
  assert.equal(takeGunsReturnPath('/fallback'), '/trajectory');
});

test('clicking Guns with a saved Arsenal rifle active opens Arsenal instead', () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  saveRifleState({ library: { rifleId: 'my-rifle', cartridgeId: 'c1' } });
  location.hash = '#/hit-probability';
  const container = makeElement('nav');
  mountNavTabbar(container);

  const gunsTab = findByTag(container, 'A')[4];
  assert.equal(gunsTab.getAttribute('href'), '#/guns/arsenal');
  fireEvent(gunsTab, 'click');

  assert.equal(location.hash, '#/guns/arsenal');
  assert.equal(takeGunsReturnPath('/fallback'), '/hit-probability');
});

// ---- Guns mode (see guns-nav.js) — replaces the whole bar while the
// Guns section is open, mirroring nav-rail.js's own Guns-mode chrome. ----

test('while in Guns mode, the bar shows Custom/Arsenal links plus a Done button instead of its normal six tabs', () => {
  const container = makeElement('nav');
  mountNavTabbar(container);
  setGunsMode(true);

  assert.equal(container.className, 'app-tabbar guns-mode');
  const links = findByTag(container, 'A');
  assert.deepEqual(links.map((a) => a.getAttribute('href')), ['#/guns/custom', '#/guns/arsenal']);
  assert.ok(links[0].textContent.includes(t('guns.customTab')));
  assert.ok(links[1].textContent.includes(t('guns.arsenalTab')));

  const buttons = findByTag(container, 'BUTTON');
  assert.equal(buttons.length, 1);
  assert.ok(buttons[0].textContent.includes(t('guns.doneButton')));
});

test('the Custom/Arsenal link matching the current route is active', () => {
  location.hash = '#/guns/custom';
  const container = makeElement('nav');
  mountNavTabbar(container);
  setGunsMode(true);

  const active = findByTag(container, 'A').filter((a) => a.className.includes('active'));
  assert.equal(active.length, 1);
  assert.equal(active[0].getAttribute('href'), '#/guns/custom');
});

test('turning Guns mode back off restores the normal six tabs', () => {
  const container = makeElement('nav');
  mountNavTabbar(container);
  setGunsMode(true);
  setGunsMode(false);

  assert.equal(container.className, 'app-tabbar');
  assert.equal(findByTag(container, 'A').length, 6);
});

test('Done navigates to the recorded Guns return path, falling back to Trajectory', () => {
  const container = makeElement('nav');
  mountNavTabbar(container);
  setGunsMode(true);

  const doneBtn = findByTag(container, 'BUTTON')[0];
  location.hash = '#/guns/arsenal';
  fireEvent(doneBtn, 'click');
  assert.equal(location.hash, '#/trajectory');

  setGunsReturnPath('/hit-probability');
  fireEvent(doneBtn, 'click');
  assert.equal(location.hash, '#/hit-probability');
});

// ---- Range Solver mode (see range-solver-nav.js) — the same idea a
// second time, mirroring nav-rail.js's own Range Solver mode chrome. ----

test('while in Range Solver mode, the bar shows Target/Range Card/Atmosphere/Gun/Exit solver instead of its normal six tabs', () => {
  const container = makeElement('nav');
  mountNavTabbar(container);
  setRangeSolverMode(true);

  assert.equal(container.className, 'app-tabbar range-solver-mode');
  const links = findByTag(container, 'A');
  assert.equal(links.length, 1, 'only Gun is a real link');
  assert.equal(links[0].getAttribute('href'), '#/guns/custom');
  assert.ok(links[0].textContent.includes(t('nav.guns')));

  const buttons = findByTag(container, 'BUTTON');
  assert.equal(buttons.length, 4, 'Target, Range Card, Atmosphere, Exit solver');
  assert.ok(buttons.some((b) => b.textContent.includes(t('rangeSolver.navTarget'))));
  assert.ok(buttons.some((b) => b.textContent.includes(t('rangeSolver.navRangeCard'))));
  assert.ok(buttons.some((b) => b.textContent.includes(t('rangeSolver.navAtmosphere'))));
  assert.ok(buttons.some((b) => b.textContent.includes(t('rangeSolver.exitSolver'))));
});

test('Target is active by default; clicking Atmosphere switches the active tab via range-solver-nav.js', () => {
  const container = makeElement('nav');
  mountNavTabbar(container);
  setRangeSolverMode(true);

  const btnByLabel = (key) => findByTag(container, 'BUTTON').find((b) => b.textContent.includes(t(key)));
  assert.ok(btnByLabel('rangeSolver.navTarget').className.includes('active'));

  fireEvent(btnByLabel('rangeSolver.navAtmosphere'), 'click');
  assert.equal(getRangeSolverTab(), 'atmosphere');
  assert.ok(btnByLabel('rangeSolver.navAtmosphere').className.includes('active'));
});

test('Exit solver always goes to Home', () => {
  location.hash = '#/range-solver';
  const container = makeElement('nav');
  mountNavTabbar(container);
  setRangeSolverMode(true);

  const exitBtn = findByTag(container, 'BUTTON').find((b) => b.textContent.includes(t('rangeSolver.exitSolver')));
  fireEvent(exitBtn, 'click');
  assert.equal(location.hash, '#/');
});

test('turning Range Solver mode back off restores the normal six tabs', () => {
  const container = makeElement('nav');
  mountNavTabbar(container);
  setRangeSolverMode(true);
  setRangeSolverMode(false);

  assert.equal(container.className, 'app-tabbar');
  assert.equal(findByTag(container, 'A').length, 6);
});
