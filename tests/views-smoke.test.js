import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { unitChoice } = await import('../src/units.js');
const { getCookie, removeCookie } = await import('../src/cookies.js');

const homeView = await import('../src/views/home-view.js');
const trajectoryView = await import('../src/views/trajectory-view.js');
const bcToolsView = await import('../src/views/bc-tools-view.js');
const cdMachCurveView = await import('../src/views/cd-mach-curve-view.js');
const settingsView = await import('../src/views/settings-view.js');
const { resetShotStateForTests } = await import('../src/shot-state.js');

// Shared shot state is a module-level singleton (by design — see
// shot-state.js), so each test needs a clean slate the same way
// cookie-backed state needs removeCookie().
test.beforeEach(() => resetShotStateForTests());

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

for (const [name, mod] of Object.entries({ homeView, trajectoryView, bcToolsView, cdMachCurveView, settingsView })) {
  test(`${name}.mount() builds a DOM tree without throwing`, () => {
    const container = makeElement('main');
    assert.doesNotThrow(() => mod.mount(container));
    assert.ok(container.childNodes.length > 0);
  });

  // Regression: the router reuses the same container across navigations
  // and language-change rerenders without clearing it itself — each
  // view's mount() must clear it first, or content piles up (this is
  // exactly what happened when home-view.js was missing its clear() call).
  test(`${name}.mount() replaces its content on a second mount into the same container, and clears another view's leftovers`, () => {
    const container = makeElement('main');
    mod.mount(container);
    const firstCount = container.childNodes.length;

    mod.mount(container);
    assert.equal(container.childNodes.length, firstCount, 're-mounting the same view duplicated its content');

    const foreign = makeElement('div');
    foreign.id = 'leftover-from-another-view';
    container.appendChild(foreign);
    mod.mount(container);
    assert.ok(
      !container.childNodes.includes(foreign),
      'mount() left another view\'s content in place instead of clearing it'
    );
  });
}

test('Home groups its tool cards under Measurement, Analysis, and Shooting headings, and links to Guns/Settings', () => {
  const container = makeElement('main');
  homeView.mount(container);

  const headings = findByTag(container, 'H2').map((h) => h.textContent);
  assert.ok(headings.includes(t('catalog.groupMeasurement')));
  assert.ok(headings.includes(t('catalog.groupAnalysis')));
  assert.ok(headings.includes(t('nav.rangeSolver')), 'expected a "Shooting" group heading');
  assert.ok(headings.includes(t('catalog.rangeSolver')), 'expected the card\'s own fuller "Range Solver" title inside it');

  const links = findByTag(container, 'A').map((a) => a.getAttribute('href'));
  assert.ok(links.includes('#/bc-tools'));
  assert.ok(links.includes('#/trajectory'));
  assert.ok(links.includes('#/range-solver'));
  assert.ok(links.includes('#/guns/custom'));
  assert.ok(links.includes('#/settings'));
});

test('Home\'s Guns link routes to Arsenal (and records the return path) when a saved Arsenal rifle is active', async () => {
  const { saveRifleState } = await import('../src/shot-state.js');
  const { saveUserRifle } = await import('../src/user-library.js');
  const { takeGunsReturnPath, resetGunsNavForTests } = await import('../src/guns-nav.js');
  resetGunsNavForTests();
  localStorage.clear();
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  saveRifleState({ library: { rifleId: 'my-rifle', cartridgeId: 'c1' } });
  location.hash = '#/';

  const container = makeElement('main');
  homeView.mount(container);

  const gunsLink = findByTag(container, 'A').find((a) => a.getAttribute('href') === '#/guns/arsenal');
  assert.ok(gunsLink, 'expected the Guns link to point at Arsenal');
  fireEvent(gunsLink, 'click');

  assert.equal(location.hash, '#/guns/arsenal');
  assert.equal(takeGunsReturnPath('/fallback'), '/');
});

test('trajectory table includes elevation and windage click columns', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const headerCells = findByTag(container, 'TH').map((th) => th.textContent);
  const rangeUnitLabel = unitChoice('range', 'm').label; // default distance pref is metric
  const velocityUnitLabel = unitChoice('velocity', 'm/s').label; // default velocity pref is metric
  const smallLengthUnitLabel = unitChoice('dropCm', 'mm').label; // default smallLength pref is mm
  assert.deepEqual(headerCells, [
    `${t('trajectory.colRange')} (${rangeUnitLabel})`,
    `${t('trajectory.colDrop')} (${smallLengthUnitLabel})`, `${t('trajectory.colWindage')} (${smallLengthUnitLabel})`,
    t('trajectory.colElevClicks'), t('trajectory.colWindClicks'),
    `${t('trajectory.colVelocity')} (${velocityUnitLabel})`, t('trajectory.colTof')
  ]);
});

test('trajectory view has a distance-step input defaulting to 100', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const rangeStepInput = findById(container, 'rangeStep');
  assert.ok(rangeStepInput, 'expected an input with id="rangeStep"');
  assert.equal(rangeStepInput.value, '100');
});

test('trajectory view has a line-of-sight angle input, defaulting to 0, unaffected by the distance-unit preference', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const losAngleInput = findById(container, 'losAngle');
  assert.ok(losAngleInput, 'expected an input with id="losAngle"');
  assert.equal(losAngleInput.value, '0');

  // Like windAngle, losAngle has no FIELD_UNITS entry (see units.js): a
  // fixed-unit (always degrees) field, not part of any unit group Settings
  // lets the user switch — unitField() passes such fields' min/max/value
  // straight through unconverted, so these stay exactly -90/90 regardless
  // of the active distance-unit preference (unlike maxRange's engine
  // "100/2000", which would be rescaled under e.g. a "yd" preference).
  assert.equal(losAngleInput.min, '-90');
  assert.equal(losAngleInput.max, '90');
});

test('mrad/MOA elevation and windage columns are toggleable but off by default', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const newColumnIds = ['elevMrad', 'windMrad', 'elevMOA', 'windMOA'];
  for (const id of newColumnIds) {
    const checkbox = findById(container, 'col-toggle-' + id);
    assert.ok(checkbox, `expected a checkbox for column "${id}"`);
    assert.equal(checkbox.checked, false, `"${id}" should default to unchecked`);
  }

  // and the header shouldn't include them until enabled
  const headerText = findByTag(container, 'TH').map((th) => th.textContent).join(' | ');
  for (const key of ['trajectory.colElevMrad', 'trajectory.colWindMrad', 'trajectory.colElevMOA', 'trajectory.colWindMOA']) {
    assert.ok(!headerText.includes(t(key)), `"${t(key)}" should not appear in the header by default`);
  }
});

test('mach column is toggleable but off by default', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const checkbox = findById(container, 'col-toggle-mach');
  assert.ok(checkbox, 'expected a checkbox for column "mach"');
  assert.equal(checkbox.checked, false, '"mach" should default to unchecked');

  const headerText = findByTag(container, 'TH').map((th) => th.textContent).join(' | ');
  assert.ok(!headerText.includes(t('trajectory.colMach')), `"${t('trajectory.colMach')}" should not appear in the header by default`);
});

test('kinetic energy column is toggleable but off by default, and its header shows the current energy unit preference', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const checkbox = findById(container, 'col-toggle-energy');
  assert.ok(checkbox, 'expected a checkbox for column "energy"');
  assert.equal(checkbox.checked, false, '"energy" should default to unchecked');

  checkbox.checked = true;
  fireEvent(checkbox, 'change');

  const energyChoice = unitChoice('energy', 'J'); // default energy unit preference
  const headerCells = findByTag(container, 'TH').map((th) => th.textContent);
  assert.ok(
    headerCells.some((text) => text.includes(t('trajectory.colEnergy')) && text.includes(energyChoice.label)),
    `expected a header cell like "Energy (${energyChoice.label})", got: ${headerCells.join(' | ')}`
  );
});

test('checking a new column adds it to the header and persists the choice to a cookie', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const checkbox = findById(container, 'col-toggle-elevMrad');
  checkbox.checked = true;
  fireEvent(checkbox, 'change');

  const headerCells = findByTag(container, 'TH').map((th) => th.textContent);
  assert.ok(headerCells.includes(t('trajectory.colElevMrad')));

  const saved = JSON.parse(getCookie('ballistics_trajectory_columns_v1'));
  assert.equal(saved.elevMrad, true);
});

test('the default 6 result columns remain visible out of the box', () => {
  removeCookie('ballistics_trajectory_columns_v1'); // a prior test in this file saves a choice; cookies persist across tests
  const container = makeElement('main');
  trajectoryView.mount(container);

  const headerText = findByTag(container, 'TH').map((th) => th.textContent);
  for (const key of ['trajectory.colElevClicks', 'trajectory.colWindClicks', 'trajectory.colTof']) {
    assert.ok(headerText.includes(t(key)), `expected "${t(key)}" in the default header`);
  }
  // colDrop/colWindage/colVelocity carry a unit suffix (like colRange/
  // colEnergy) rather than an exact-text match — see the dedicated header
  // test above.
  for (const key of ['trajectory.colDrop', 'trajectory.colWindage', 'trajectory.colVelocity']) {
    assert.ok(headerText.some((text) => text.startsWith(t(key))), `expected a "${t(key)}" column header`);
  }
});

test('Max Range / Range Step / Line of sight angle survive navigating away and back (re-mounting into a fresh container)', async () => {
  const { resetTrajectoryStateForTests } = await import('../src/trajectory-state.js');
  removeCookie('ballistics_trajectory_state_v1');
  resetTrajectoryStateForTests();

  const container1 = makeElement('main');
  trajectoryView.mount(container1);

  const maxRangeInput = findById(container1, 'maxRange');
  maxRangeInput.value = '1500';
  fireEvent(maxRangeInput, 'input');

  const rangeStepInput = findById(container1, 'rangeStep');
  rangeStepInput.value = '50';
  fireEvent(rangeStepInput, 'input');

  const losAngleInput = findById(container1, 'losAngle');
  losAngleInput.value = '12';
  fireEvent(losAngleInput, 'input');

  // A different container, standing in for the router handing the view a
  // fresh mount on navigating back — nothing carries over except through
  // trajectory-state.js's own cookie.
  const container2 = makeElement('main');
  trajectoryView.mount(container2);

  assert.equal(findById(container2, 'maxRange').value, '1500');
  assert.equal(findById(container2, 'rangeStep').value, '50');
  assert.equal(findById(container2, 'losAngle').value, '12');

  // Restore a clean slate so later tests in this file (and this suite's
  // own "defaults to 1000/100/0" assertions elsewhere) don't inherit this
  // test's own saved values via the shared cookie.
  resetTrajectoryStateForTests();
  removeCookie('ballistics_trajectory_state_v1');
});

test('nav and the trajectory page itself are labeled "Trajectory", not "Trajectory Table"', () => {
  assert.equal(t('nav.trajectory'), 'Trajectory');
  assert.equal(t('trajectory.title'), 'Trajectory');

  const container = makeElement('main');
  trajectoryView.mount(container);
  const heading = findByTag(container, 'H1')[0];
  assert.equal(heading.textContent, 'Trajectory');
});

test('the trajectory chart has a column selector offering every table column, defaulting to Drop', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const select = findById(container, 'trajectoryChartColumn');
  assert.ok(select, 'expected a select with id="trajectoryChartColumn"');
  assert.equal(select.value, 'dropCm');

  const optionValues = select.childNodes.map((o) => o.attributes.value);
  assert.deepEqual(optionValues, [
    'dropCm', 'windageCm', 'elevClicks', 'windClicks', 'elevMrad', 'windMrad',
    'elevMOA', 'windMOA', 'velocity', 'tof', 'mach', 'energy'
  ]);
});

test('switching the chart column does not throw, even before any computed data has arrived', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const select = findById(container, 'trajectoryChartColumn');
  select.value = 'velocity';
  assert.doesNotThrow(() => fireEvent(select, 'change'));
});

test('the trajectory chart has "view start"/"view end" zoom sliders, defaulting to the full 0-1000m range (the table\'s own default Max Range)', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const startInput = findById(container, 'trajectoryChartViewStart');
  const endInput = findById(container, 'trajectoryChartViewEnd');
  assert.ok(startInput, 'expected an input with id="trajectoryChartViewStart"');
  assert.ok(endInput, 'expected an input with id="trajectoryChartViewEnd"');
  assert.equal(startInput.value, '0');
  assert.equal(endInput.value, '1000');
  // The gap between the two sliders' own bounds must reflect the 20 m
  // minimum zoom window (see MIN_ZOOM_WINDOW_M in trajectory-view.js).
  assert.equal(startInput.max, '980');
  assert.equal(endInput.min, '20');
});

test('changing Max Range widens the chart zoom sliders\' bounds to match, while still fully zoomed out', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const maxRangeInput = findById(container, 'maxRange');
  maxRangeInput.value = '1500';
  fireEvent(maxRangeInput, 'input');

  const startInput = findById(container, 'trajectoryChartViewStart');
  const endInput = findById(container, 'trajectoryChartViewEnd');
  assert.equal(startInput.value, '0');
  assert.equal(endInput.value, '1500');
  assert.equal(endInput.max, '1500');
});

test('regression: editing max-range down to a transient blank value must not poison the zoom sliders with NaN', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const maxRangeInput = findById(container, 'maxRange');
  // <input type=number> reports '' for a transient invalid/mid-edit state
  // (e.g. selecting the field's text to retype it) — this used to fire
  // onInput with NaN and permanently corrupt the zoom sliders (see
  // src/ui/unit-field.js's isValidRaw guard and src/ui/zoom-range-slider.js's
  // setBounds finite guard).
  maxRangeInput.value = '';
  fireEvent(maxRangeInput, 'input');

  const startInput = findById(container, 'trajectoryChartViewStart');
  const endInput = findById(container, 'trajectoryChartViewEnd');
  for (const input of [startInput, endInput]) {
    assert.ok(!Number.isNaN(parseFloat(input.min)), `slider min was NaN: ${input.min}`);
    assert.ok(!Number.isNaN(parseFloat(input.max)), `slider max was NaN: ${input.max}`);
    assert.ok(!Number.isNaN(parseFloat(input.value)), `slider value was NaN: ${input.value}`);
  }

  // A subsequent real edit must also recover cleanly.
  maxRangeInput.value = '1500';
  fireEvent(maxRangeInput, 'input');
  assert.equal(endInput.value, '1500');
});

test('dragging the chart\'s "view end" slider inward, past the minimum window, is clamped to 20m from "view start"', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  const endInput = findById(container, 'trajectoryChartViewEnd');
  endInput.value = '10'; // below the 20m floor
  fireEvent(endInput, 'input');

  assert.equal(endInput.value, '10', 'the slider\'s own displayed value is left alone (the browser already clamps min/max)');
  const startInput = findById(container, 'trajectoryChartViewStart');
  // start's own max must have been pulled down so it can never cross
  // within 20m of whatever "end" actually resolved to.
  assert.ok(parseFloat(startInput.max) <= 0, `expected start's max to be clamped near 0, got ${startInput.max}`);
});

test('settings has a "show built-in rifles library" checkbox, checked by default, that persists to a cookie', async () => {
  const { isRifleLibraryEnabled } = await import('../src/library-prefs.js');
  const container = makeElement('main');
  settingsView.mount(container);

  const checkbox = findById(container, 'settings-rifle-library-enabled');
  assert.ok(checkbox, 'expected a checkbox with id="settings-rifle-library-enabled"');
  assert.equal(checkbox.checked, true);

  checkbox.checked = false;
  fireEvent(checkbox, 'change');
  assert.equal(isRifleLibraryEnabled(), false);

  // restore the default so it doesn't leak into other test files
  checkbox.checked = true;
  fireEvent(checkbox, 'change');
});

test('settings has a checkbox per built-in bullet library, checked by default, that persists to a cookie', async () => {
  const { isBulletLibraryVisible } = await import('../src/bullet-library-prefs.js');
  const container = makeElement('main');
  settingsView.mount(container);

  const checkbox = findById(container, 'bullet-library-geladen');
  assert.ok(checkbox, 'expected a checkbox with id="bullet-library-geladen"');
  assert.equal(checkbox.checked, true);
  assert.ok(findById(container, 'bullet-library-lapua-cd'), 'expected a checkbox with id="bullet-library-lapua-cd"');

  checkbox.checked = false;
  fireEvent(checkbox, 'change');
  assert.equal(isBulletLibraryVisible('geladen'), false);

  // restore the default so it doesn't leak into other test files
  checkbox.checked = true;
  fireEvent(checkbox, 'change');
});

test('settings has an energy-unit selector (Joules by default), persisting the choice to a cookie like every other unit group', async () => {
  const { getUnit, setUnit } = await import('../src/prefs.js');
  const container = makeElement('main');
  settingsView.mount(container);

  const select = findById(container, 'unit-energy');
  assert.ok(select, 'expected a select with id="unit-energy"');
  assert.equal(select.value, 'J');

  select.value = 'ft*lbf';
  fireEvent(select, 'change');
  assert.equal(getUnit('energy'), 'ft*lbf');

  // restore the default so it doesn't leak into other test files
  setUnit('energy', 'J');
});

test('settings has a wind-direction-dial appearance selector ("Clock" by default), persisting the choice to a cookie', async () => {
  const { getWindDialAppearance, setWindDialAppearance } = await import('../src/wind-dial-prefs.js');
  const { removeCookie } = await import('../src/cookies.js');
  removeCookie('ballistics_wind_dial_appearance_v1');

  const container = makeElement('main');
  settingsView.mount(container);

  const select = findById(container, 'settings-wind-dial-appearance');
  assert.ok(select, 'expected a select with id="settings-wind-dial-appearance"');
  assert.equal(select.value, 'clock');

  select.value = 'clean';
  fireEvent(select, 'change');
  assert.equal(getWindDialAppearance(), 'clean');

  setWindDialAppearance('clock'); // restore the default so it doesn't leak into other test files
});

test('settings has an app-wide theme picker (3 illustrative options), "Dark color" active by default, that persists the choice to a cookie', async () => {
  const { getTheme, setTheme, resetThemeForTests } = await import('../src/range-solver-prefs.js');
  resetThemeForTests();

  const container = makeElement('main');
  settingsView.mount(container);

  const themeButtons = findByTag(container, 'BUTTON').filter((b) => b.className.split(' ').includes('theme-option'));
  assert.equal(themeButtons.length, 3, 'expected one button per THEME_CHOICES entry');
  const activeButtons = themeButtons.filter((b) => b.className.split(' ').includes('active'));
  assert.equal(activeButtons.length, 1, 'expected exactly one active theme option');
  assert.equal(activeButtons[0].getAttribute('aria-pressed'), 'true');

  const darkButton = themeButtons[0]; // THEME_CHOICES lists "dark" first
  assert.ok(darkButton.className.split(' ').includes('active'), 'expected "Dark color" to be the default active option');

  const highContrastDarkButton = themeButtons[2]; // THEME_CHOICES lists "high-contrast-dark" last
  fireEvent(highContrastDarkButton, 'click');
  assert.equal(getTheme(), 'high-contrast-dark');

  setTheme('dark'); // restore the default so it doesn't leak into other test files
});

test('settings has a Range Solver output-indicator selector ("+/-" by default), persisting the choice to a cookie', async () => {
  const { getIndicatorStyle, setIndicatorStyle } = await import('../src/range-solver-prefs.js');
  const { removeCookie } = await import('../src/cookies.js');
  removeCookie('ballistics_range_solver_indicator_style_v1');

  const container = makeElement('main');
  settingsView.mount(container);

  const select = findById(container, 'settings-range-solver-indicator-style');
  assert.ok(select, 'expected a select with id="settings-range-solver-indicator-style"');
  assert.equal(select.value, 'signs');

  select.value = 'arrows';
  fireEvent(select, 'change');
  assert.equal(getIndicatorStyle(), 'arrows');

  setIndicatorStyle('signs'); // restore the default so it doesn't leak into other test files
});

// "Add rifle/bullet to arsenal" moved from here to Guns' own Custom tab
// (see tests/guns-view.test.js) along with the rest of the live picker —
// Trajectory only shows a compact summary now (see guns-summary.js).

test('Trajectory shows a Guns summary card instead of the full rifle/cartridge picker', () => {
  const container = makeElement('main');
  trajectoryView.mount(container);

  assert.equal(findById(container, 'zeroRange'), null, 'the live picker should no longer be embedded here');
  assert.equal(findById(container, 'add-rifle-to-arsenal'), null);
  const changeButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'guns.changeButton');
  assert.ok(changeButton, 'expected a Guns summary Change button');
});
