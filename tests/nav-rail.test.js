import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent, makeElement } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { mountNavRail } = await import('../src/ui/nav-rail.js');
const { resetNavPrefsForTests, isGroupOpen, isRailCollapsed } = await import('../src/nav-prefs.js');
const { setGunsMode, setGunsReturnPath, resetGunsNavForTests, takeGunsReturnPath } = await import('../src/guns-nav.js');
const {
  setRangeSolverMode, getRangeSolverTab, resetRangeSolverNavForTests
} = await import('../src/range-solver-nav.js');
const { saveRifleState, resetShotStateForTests } = await import('../src/shot-state.js');
const { saveUserRifle } = await import('../src/user-library.js');

test.beforeEach(() => {
  resetNavPrefsForTests();
  resetGunsNavForTests();
  resetRangeSolverNavForTests();
  resetShotStateForTests();
  localStorage.clear();
  location.hash = '';
});

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function findByClass(node, className, out = []) {
  if (node.className && node.className.split(' ').includes(className)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, className, out);
  return out;
}

test('renders expanded by default, with both groups open', () => {
  const container = makeElement('nav');
  mountNavRail(container);

  assert.equal(container.className, 'app-rail');
  const tools = findByClass(container, 'rail-tool');
  // 3 measurement + 2 visible analysis tools (range-card is hidden from
  // listings; range-solver is a GROUPS.shooting tool, not an accordion
  // one — see nav-tools.js), all visible since both groups start open
  assert.equal(tools.length, 5);
});

test('Shooting is a flat direct link (like Guns/Settings), not an accordion group', () => {
  const container = makeElement('nav');
  mountNavRail(container);

  const summaries = findByClass(container, 'rail-group-summary');
  assert.ok(!summaries.some((n) => n.textContent.includes(t('nav.rangeSolver'))), 'Shooting should not render as an accordion summary');

  const link = findByClass(container, 'rail-item').find((n) => n.getAttribute('href') === '#/range-solver');
  assert.ok(link, 'expected a plain rail-item link straight to /range-solver');
  assert.ok(link.textContent.includes(t('nav.rangeSolver')));
});

test('every tool row shows its name, a status chip, and a description', () => {
  const container = makeElement('nav');
  mountNavRail(container);

  const bcRow = findByClass(container, 'rail-tool').find((row) => row.textContent.includes(t('catalog.bcTools')));
  assert.ok(bcRow, 'expected a rail row for BC Tools');
  assert.ok(bcRow.textContent.includes(t('catalog.statusLive')), 'BC Tools is fully live (Calculation, Conversion, and Labradar all usable)');
  assert.ok(bcRow.textContent.includes(t('catalog.bcToolsDesc')));
});

test('a live tool is a real link; a planned tool is not', () => {
  const container = makeElement('nav');
  mountNavRail(container);

  const links = findByTag(container, 'A');
  assert.ok(links.some((a) => a.getAttribute('href') === '#/bc-tools'));

  const plannedRow = findByClass(container, 'rail-tool').find((row) => row.textContent.includes(t('catalog.groupSizePhoto')));
  assert.ok(plannedRow, 'expected a row for the planned Rifle precision calculator tool');
  assert.equal(plannedRow.tagName, 'DIV');
  assert.ok(plannedRow.className.includes('disabled'));
});

test('the tool matching the current route is highlighted active', () => {
  location.hash = '#/trajectory';
  const container = makeElement('nav');
  mountNavRail(container);

  const active = findByClass(container, 'active').find((n) => n.className.includes('rail-tool'));
  assert.ok(active, 'expected one rail-tool with the active class');
  assert.ok(active.textContent.includes(t('nav.trajectory')));
});

test('Home, Guns and Settings are pinned links, and Home is current at the root path', () => {
  location.hash = '';
  const container = makeElement('nav');
  mountNavRail(container);

  const items = findByClass(container, 'rail-item');
  assert.ok(items.some((n) => n.textContent.includes(t('nav.guns')) && n.getAttribute('href') === '#/guns/custom'));
  assert.ok(items.some((n) => n.textContent.includes(t('nav.settings')) && n.getAttribute('href') === '#/settings'));

  const home = items.find((n) => n.getAttribute('href') === '#/');
  assert.ok(home.className.includes('current'));
});

test('clicking Guns (no active rifle) opens Custom and records the return path', () => {
  location.hash = '#/trajectory';
  const container = makeElement('nav');
  mountNavRail(container);

  const gunsLink = findByClass(container, 'rail-item').find((n) => n.textContent.includes(t('nav.guns')));
  fireEvent(gunsLink, 'click');

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
  mountNavRail(container);

  const gunsLink = findByClass(container, 'rail-item').find((n) => n.textContent.includes(t('nav.guns')));
  assert.equal(gunsLink.getAttribute('href'), '#/guns/arsenal');
  fireEvent(gunsLink, 'click');

  assert.equal(location.hash, '#/guns/arsenal');
  assert.equal(takeGunsReturnPath('/fallback'), '/hit-probability');
});

test('clicking a group\'s summary collapses it and persists the choice', () => {
  const container = makeElement('nav');
  mountNavRail(container);

  const summary = findByClass(container, 'rail-group-summary').find((n) => n.textContent.includes(t('catalog.groupAnalysis')));
  fireEvent(summary, 'click');

  assert.equal(isGroupOpen('analysis'), false);
  // Analysis's own tools should no longer be in the DOM once collapsed.
  const stillThere = findByClass(container, 'rail-tool').some((row) => row.textContent.includes(t('nav.trajectory')));
  assert.equal(stillThere, false);
  // Measurement is untouched.
  assert.ok(findByClass(container, 'rail-tool').some((row) => row.textContent.includes(t('catalog.bcTools'))));
});

test('the collapse button switches to icon-only mode and persists the choice', () => {
  const container = makeElement('nav');
  mountNavRail(container);

  const collapseBtn = findByTag(container, 'BUTTON').find((b) => b.id === 'rail-collapse-toggle');
  fireEvent(collapseBtn, 'click');

  assert.equal(isRailCollapsed(), true);
  assert.equal(container.className, 'app-rail collapsed');
  assert.equal(findByClass(container, 'rail-tool').length, 0, 'expanded tool rows should be gone');
  assert.ok(findByClass(container, 'rail-c-item').length > 0, 'expected icon-only rail items instead');
});

test('in collapsed mode, Shooting is still a plain icon link straight to /range-solver, not a flyout group', () => {
  const container = makeElement('nav');
  mountNavRail(container);
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.id === 'rail-collapse-toggle'), 'click');

  const link = findByClass(container, 'rail-c-item').find((n) => n.getAttribute('href') === '#/range-solver');
  assert.ok(link, 'expected a plain rail-c-item link straight to /range-solver');
  assert.equal(link.getAttribute('title'), t('nav.rangeSolver'));
  assert.equal(link.tagName, 'A', 'not a flyout-toggle BUTTON like the accordion groups use');
});

test('in collapsed mode, clicking the Guns icon routes the same way as the expanded rail', () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  saveRifleState({ library: { rifleId: 'my-rifle', cartridgeId: 'c1' } });
  location.hash = '#/trajectory';
  const container = makeElement('nav');
  mountNavRail(container);
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.id === 'rail-collapse-toggle'), 'click');

  const gunsIcon = findByClass(container, 'rail-c-item').find((n) => n.getAttribute('title') === t('nav.guns'));
  assert.equal(gunsIcon.getAttribute('href'), '#/guns/arsenal');
  fireEvent(gunsIcon, 'click');

  assert.equal(location.hash, '#/guns/arsenal');
  assert.equal(takeGunsReturnPath('/fallback'), '/trajectory');
});

test('in collapsed mode, clicking a group icon opens a flyout with that group\'s tools', () => {
  const container = makeElement('nav');
  mountNavRail(container);
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.id === 'rail-collapse-toggle'), 'click');

  // Re-queried after every click — render() rebuilds the whole rail from
  // scratch, so a node captured before a click is stale immediately after.
  const measurementIcon = () => findByClass(container, 'rail-c-item').find((n) => n.className.includes('measurement'));
  assert.equal(findByClass(container, 'flyout').length, 0, 'no flyout before any click');

  fireEvent(measurementIcon(), 'click');
  const flyouts = findByClass(container, 'flyout');
  assert.equal(flyouts.length, 1);
  assert.ok(flyouts[0].textContent.includes(t('catalog.bcTools')));

  // Clicking the same icon again closes it.
  fireEvent(measurementIcon(), 'click');
  assert.equal(findByClass(container, 'flyout').length, 0);
});

test('opening the other group\'s flyout closes the first one', () => {
  const container = makeElement('nav');
  mountNavRail(container);
  fireEvent(findByTag(container, 'BUTTON').find((b) => b.id === 'rail-collapse-toggle'), 'click');

  const items = () => findByClass(container, 'rail-c-item');
  fireEvent(items().find((n) => n.className.includes('measurement')), 'click');
  assert.ok(findByClass(container, 'flyout')[0].textContent.includes(t('catalog.bcTools')));

  fireEvent(items().find((n) => n.className.includes('analysis')), 'click');
  const flyouts = findByClass(container, 'flyout');
  assert.equal(flyouts.length, 1, 'only one flyout should be open at a time');
  assert.ok(flyouts[0].textContent.includes(t('nav.trajectory')));
});

// ---- Guns mode (see guns-nav.js) — replaces the whole rail's own
// content while the Guns section is open. ----

test('while in Guns mode, the rail shows Done + Custom/Arsenal instead of its normal content', () => {
  const container = makeElement('nav');
  mountNavRail(container);
  setGunsMode(true);

  assert.equal(container.className, 'app-rail guns-mode');
  assert.equal(findByClass(container, 'rail-item').length, 0, 'the normal Home/group/pinned links should be gone');
  const tabs = findByClass(container, 'guns-tab');
  assert.equal(tabs.length, 2);
  assert.ok(tabs.some((a) => a.textContent.includes(t('guns.customTab')) && a.getAttribute('href') === '#/guns/custom'));
  assert.ok(tabs.some((a) => a.textContent.includes(t('guns.arsenalTab')) && a.getAttribute('href') === '#/guns/arsenal'));
  assert.ok(findByClass(container, 'done-btn')[0].textContent.includes(t('guns.doneButton')));
});

test('the Custom/Arsenal tab matching the current route is marked active', () => {
  location.hash = '#/guns/arsenal';
  const container = makeElement('nav');
  mountNavRail(container);
  setGunsMode(true);

  const active = findByClass(container, 'guns-tab').filter((a) => a.className.split(' ').includes('active'));
  assert.equal(active.length, 1);
  assert.ok(active[0].textContent.includes(t('guns.arsenalTab')));
});

test('turning Guns mode back off restores the normal rail', () => {
  const container = makeElement('nav');
  mountNavRail(container);
  setGunsMode(true);
  setGunsMode(false);

  assert.equal(container.className, 'app-rail');
  assert.ok(findByClass(container, 'rail-item').length > 0);
  assert.equal(findByClass(container, 'done-btn').length, 0);
});

test('Done navigates to the recorded Guns return path, falling back to Trajectory', () => {
  const container = makeElement('nav');
  mountNavRail(container);
  setGunsMode(true);

  const doneBtn = findByClass(container, 'done-btn')[0];
  location.hash = '#/guns/custom';
  fireEvent(doneBtn, 'click');
  assert.equal(location.hash, '#/trajectory', 'no return path recorded — falls back to Trajectory');

  setGunsReturnPath('/hit-probability');
  fireEvent(doneBtn, 'click');
  assert.equal(location.hash, '#/hit-probability');
});

// ---- Range Solver mode (see range-solver-nav.js) — the same "focused
// mode" idea as Guns, with its own Target/Wind/Atmosphere/Gun/Exit-solver
// control instead. Reuses .guns-tab/.done-btn as-is (see layout.css). ----

test('while in Range Solver mode, the rail shows Target/Wind/Atmosphere/Gun/Exit solver instead of its normal content', () => {
  const container = makeElement('nav');
  mountNavRail(container);
  setRangeSolverMode(true);

  assert.equal(container.className, 'app-rail range-solver-mode');
  assert.equal(findByClass(container, 'rail-item').length, 0, 'the normal Home/group/pinned links should be gone');
  const tabs = findByClass(container, 'guns-tab');
  assert.equal(tabs.length, 4, 'Target, Wind, Atmosphere, Gun');
  assert.ok(tabs.some((n) => n.textContent.includes(t('rangeSolver.navTarget'))));
  assert.ok(tabs.some((n) => n.textContent.includes(t('rangeSolver.navWind'))));
  assert.ok(tabs.some((n) => n.textContent.includes(t('rangeSolver.navAtmosphere'))));
  assert.ok(tabs.some((n) => n.textContent.includes(t('nav.guns')) && n.getAttribute('href') === '#/guns/custom'));
  assert.ok(findByClass(container, 'done-btn')[0].textContent.includes(t('rangeSolver.exitSolver')));
});

test('Target is active by default; clicking Wind switches the active tab via range-solver-nav.js', () => {
  const container = makeElement('nav');
  mountNavRail(container);
  setRangeSolverMode(true);

  const tabByLabel = (key) => findByClass(container, 'guns-tab').find((n) => n.textContent.includes(t(key)));
  assert.ok(tabByLabel('rangeSolver.navTarget').className.includes('active'));

  fireEvent(tabByLabel('rangeSolver.navWind'), 'click');
  assert.equal(getRangeSolverTab(), 'wind');
  assert.ok(tabByLabel('rangeSolver.navWind').className.includes('active'));
  assert.ok(!tabByLabel('rangeSolver.navTarget').className.includes('active'));
});

test('Exit solver always goes to Home, regardless of where Range Solver was opened from', () => {
  location.hash = '#/range-solver';
  const container = makeElement('nav');
  mountNavRail(container);
  setRangeSolverMode(true);

  fireEvent(findByClass(container, 'done-btn')[0], 'click');
  assert.equal(location.hash, '#/');
});

test('turning Range Solver mode back off restores the normal rail', () => {
  const container = makeElement('nav');
  mountNavRail(container);
  setRangeSolverMode(true);
  setRangeSolverMode(false);

  assert.equal(container.className, 'app-rail');
  assert.ok(findByClass(container, 'rail-item').length > 0);
  assert.equal(findByClass(container, 'done-btn').length, 0);
});
