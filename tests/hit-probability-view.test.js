import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { resetShotStateForTests } = await import('../src/shot-state.js');
const hitProbabilityView = await import('../src/views/hit-probability-view.js');

// This view's async initialization (fetching the target's result SVG and
// parsing it via DOMParser) needs real browser APIs the fake-dom test
// harness doesn't provide (its fetch stub only implements .json(), and
// there's no DOMParser polyfill) — so unlike the other views, this one
// isn't in views-smoke.test.js's generic mount-without-throwing loop.
// These tests instead cover the synchronous UI structure and interactions
// that don't depend on that async chain resolving; the illustration
// itself is verified by hand in a real browser.
test.beforeEach(() => {
  resetShotStateForTests();
  hitProbabilityView.resetHitProbabilityStateForTests();
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

// Whether `node` is currently hidden by any ancestor's display:none —
// robust to exactly how many wrapper levels sit between a field's own
// input and whichever block actually gets toggled (a preset field has one
// more wrapper level than a plain one; fake-dom has no Element.closest()
// to shortcut this).
function isHidden(node) {
  let n = node;
  while (n) {
    if (n.style && n.style.display === 'none') return true;
    n = n.parentNode;
  }
  return false;
}

function settle(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('mount() builds a DOM tree without throwing, and cleans up on unmount', () => {
  const container = makeElement('main');
  let unmount;
  assert.doesNotThrow(() => { unmount = hitProbabilityView.mount(container); });
  assert.ok(container.childNodes.length > 0);
  assert.equal(typeof unmount, 'function');
  assert.doesNotThrow(() => unmount());
});

test('re-mounting into the same container replaces its content', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  const firstCount = container.childNodes.length;
  hitProbabilityView.mount(container);
  assert.equal(container.childNodes.length, firstCount);
});

test('exactly one of the two tabs is active, and clicking another switches which panel is visible', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);

  const tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));
  assert.equal(tabButtons.length, 2);
  assert.equal(tabButtons.filter((b) => b.className.includes('active')).length, 1);
  assert.equal(tabButtons[0].className.includes('active'), true, 'Parameters should be the initial tab');

  const panels = findByTag(container, 'DIV').filter((d) => d.className && d.className.includes('input-panel'));
  assert.equal(panels.length, 2);
  assert.equal(isHidden(panels[0]), false, 'first panel visible by default');
  assert.equal(isHidden(panels[1]), true);

  fireEvent(tabButtons[1], 'click');
  assert.equal(tabButtons[1].className.includes('active'), true);
  assert.equal(tabButtons[0].className.includes('active'), false);
  assert.equal(isHidden(panels[1]), false);
  assert.equal(isHidden(panels[0]), true);
});

test('the simplified/detailed precision toggle never shows both interfaces at once', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  // Parameters is the default tab — both fields live here.

  const toggle = findById(container, 'simplifiedPrecisionEnabled');
  const benchField = findById(container, 'benchPrecision');
  const combinedField = findById(container, 'combinedPrecision');
  assert.ok(toggle && benchField && combinedField);

  // Detailed mode is the default.
  assert.equal(isHidden(benchField), false);
  assert.equal(isHidden(combinedField), true);

  toggle.checked = true;
  fireEvent(toggle, 'change');
  assert.equal(isHidden(combinedField), false, 'simplified block should now be visible');
  assert.equal(isHidden(benchField), true, 'detailed block should now be hidden');

  toggle.checked = false;
  fireEvent(toggle, 'change');
  assert.equal(isHidden(benchField), false, 'detailed block should be visible again');
  assert.equal(isHidden(combinedField), true, 'simplified block should be hidden again');
});

test('the moving-target checkbox (Parameters) reveals its own speed-error field', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  // Parameters is the default tab.

  const toggle = findById(container, 'movingTargetEnabled');
  const speedErrorField = findById(container, 'movingTargetSpeedError');
  assert.ok(toggle && speedErrorField);

  assert.equal(isHidden(speedErrorField), true);
  toggle.checked = true;
  fireEvent(toggle, 'change');
  assert.equal(isHidden(speedErrorField), false);
  toggle.checked = false;
  fireEvent(toggle, 'change');
  assert.equal(isHidden(speedErrorField), true);
});

test('the moving-target checkbox (Parameters) also reveals the speed field over in Simulation', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  const tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));

  // Parameters is the default tab, where the checkbox lives.
  const toggle = findById(container, 'movingTargetEnabled');
  toggle.checked = true;
  fireEvent(toggle, 'change');

  fireEvent(tabButtons[1], 'click'); // Simulation, to check the other field's own visibility
  const speedField = findById(container, 'movingTargetSpeed');
  assert.ok(speedField);
  assert.equal(isHidden(speedField), false, 'checking the box in Parameters should reveal the field in Simulation too');
});

test('battle zero toggle reveals its range field', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  const tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));
  fireEvent(tabButtons[1], 'click'); // Simulation

  const toggle = findById(container, 'battleZeroEnabled');
  const field = findById(container, 'battleZeroRange');
  assert.ok(toggle && field);
  assert.equal(isHidden(field), true);

  toggle.checked = true;
  fireEvent(toggle, 'change');
  assert.equal(isHidden(field), false);
});

test('the page title is translated via the real i18n key, not hardcoded', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  const h1 = findByTag(container, 'H1')[0];
  assert.equal(h1.textContent, t('hitProbability.title'));
});

test('hand-typing a preset field switches its select to "Custom"; picking a preset does not', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  // Parameters is the default tab — muzzleVelocitySD lives here.

  const numberInput = findById(container, 'muzzleVelocitySD');
  const select = numberInput.parentNode.childNodes[0];
  assert.equal(select.tagName, 'SELECT');
  assert.equal(select.value, 'factoryMatch', 'default preset should be selected initially');

  numberInput.value = '6.5';
  fireEvent(numberInput, 'input');
  assert.equal(select.value, '__custom__', 'typing a value by hand should switch the select to Custom');

  select.value = 'surplus';
  fireEvent(select, 'change');
  assert.equal(numberInput.value, '9', 'picking a preset should still pre-fill the field');
  assert.equal(select.value, 'surplus', 'picking a preset should not itself flip back to Custom');
});

test('Parameters and Simulation field values survive navigating away and back (unmount/remount)', () => {
  const container = makeElement('main');
  const unmount = hitProbabilityView.mount(container);
  let tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));

  // Parameters is the default tab.
  const windField = findById(container, 'windMedianError');
  windField.value = '3';
  fireEvent(windField, 'input');

  fireEvent(tabButtons[1], 'click'); // Simulation
  const rangeField = findById(container, 'targetRange');
  rangeField.value = '600';
  fireEvent(rangeField, 'input');

  const battleZeroToggle = findById(container, 'battleZeroEnabled');
  battleZeroToggle.checked = true;
  fireEvent(battleZeroToggle, 'change');

  unmount();
  hitProbabilityView.mount(container); // simulate navigating to another tool and back

  tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));
  assert.equal(findById(container, 'windMedianError').value, '3', 'Parameters field value should survive remount');

  fireEvent(tabButtons[1], 'click');
  assert.equal(findById(container, 'targetRange').value, '600', 'Simulation field value should survive remount');
  assert.equal(findById(container, 'battleZeroEnabled').checked, true, 'toggle state should survive remount');
  assert.equal(isHidden(findById(container, 'battleZeroRange')), false, 'the field a restored toggle reveals should already be visible on remount');
});

test('the target picker offers a thumbnail button per catalog target, and remembers the selection', async () => {
  // Unlike the result-SVG fetch (.text() + DOMParser, unsupported under
  // fake-dom), populating the picker only needs loadTarget()'s own
  // fetch()+.json() call, which fake-dom's fetch stub does support — so
  // this part of the async chain genuinely resolves here.
  const container = makeElement('main');
  const unmount = hitProbabilityView.mount(container);
  // Two parallel real file reads (loadTarget() per catalog entry) back
  // this — under a loaded full-suite run the default 30ms margin isn't
  // always enough, so this waits longer specifically here.
  await settle(150);

  const tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));
  fireEvent(tabButtons[1], 'click'); // Simulation

  const pickerButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('target-picker-item'));
  assert.equal(pickerButtons.length, 18, 'one button per catalog target');
  const thumbSrcs = pickerButtons.map((b) => findByTag(b, 'IMG')[0].src);
  assert.ok(thumbSrcs[0].endsWith('/targets/plate-40x60-thumb.svg'));
  assert.ok(thumbSrcs[1].endsWith('/targets/issf-300m-thumb.svg'));
  assert.ok(thumbSrcs[2].endsWith('/targets/ch-300m-b4-thumb.svg'));
  assert.ok(thumbSrcs[3].endsWith('/targets/ch-300m-b10-thumb.svg'));
  assert.ok(thumbSrcs[4].endsWith('/targets/ussr-4-thumb.svg'));
  assert.ok(thumbSrcs[5].endsWith('/targets/ussr-5-thumb.svg'));
  assert.ok(thumbSrcs[6].endsWith('/targets/ussr-8-thumb.svg'));
  assert.ok(thumbSrcs[7].endsWith('/targets/ch-campagne-e-thumb.svg'));
  assert.ok(thumbSrcs[8].endsWith('/targets/ch-campagne-f-thumb.svg'));
  assert.ok(thumbSrcs[9].endsWith('/targets/ch-campagne-g-thumb.svg'));
  assert.ok(thumbSrcs[10].endsWith('/targets/ch-campagne-h-thumb.svg'));
  assert.ok(thumbSrcs[11].endsWith('/targets/ch-campagne-k-thumb.svg'));
  assert.ok(thumbSrcs[12].endsWith('/targets/ch-nttc-score-thumb.svg'));
  assert.ok(thumbSrcs[13].endsWith('/targets/circle-100mm-thumb.svg'));
  assert.ok(thumbSrcs[14].endsWith('/targets/circle-200mm-thumb.svg'));
  assert.ok(thumbSrcs[15].endsWith('/targets/square-1m-thumb.svg'));
  assert.ok(thumbSrcs[16].endsWith('/targets/square-2m-thumb.svg'));
  assert.ok(thumbSrcs[17].endsWith('/targets/killer-tubby-thumb.svg'));
  assert.equal(pickerButtons[0].className, 'target-picker-item active', 'default selection should be the first catalog entry');
  assert.equal(pickerButtons[1].className, 'target-picker-item');

  fireEvent(pickerButtons[1], 'click');
  await settle();
  assert.equal(pickerButtons[1].className, 'target-picker-item active');
  assert.equal(pickerButtons[0].className, 'target-picker-item');

  unmount();
  const unmount2 = hitProbabilityView.mount(container);
  await settle(150);
  const tabButtons2 = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));
  fireEvent(tabButtons2[1], 'click');
  const pickerButtons2 = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('target-picker-item'));
  assert.equal(pickerButtons2[1].className, 'target-picker-item active', 'target selection should survive remount');
  unmount2();
});

test('the illustration zoom slider is present with a sensible default, and dragging it before the target has loaded does not throw', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  const tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));
  fireEvent(tabButtons[1], 'click'); // Simulation

  const slider = findById(container, 'illustrationZoom');
  assert.ok(slider, 'illustrationZoom slider should exist');
  assert.equal(slider.value, '1');

  // The result SVG fetch never resolves under fake-dom (see the file
  // header), so illustrationSvgRoot stays null — applyZoom() has to no-op
  // safely rather than throw when the slider fires before that.
  slider.value = '2';
  assert.doesNotThrow(() => fireEvent(slider, 'input'));
});

test('the "Impacts to scale" checkbox is present, on by default, and safe to toggle before the target has loaded', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  const tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));
  fireEvent(tabButtons[1], 'click'); // Simulation

  const checkbox = findById(container, 'impactsToScale');
  assert.ok(checkbox, 'impactsToScale checkbox should exist');
  assert.equal(checkbox.checked, true, '"Impacts to scale" should default to on');

  checkbox.checked = false;
  assert.doesNotThrow(() => fireEvent(checkbox, 'change'));
});

test('Single shot is the default scenario, with the spotter-corrected-only inputs and secondary result cards all hidden', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  const tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));

  fireEvent(tabButtons[1], 'click'); // Simulation
  const scenarioSelect = findById(container, 'scenario');
  assert.ok(scenarioSelect, 'scenario select should exist');
  assert.equal(scenarioSelect.value, 'singleShot');
  assert.equal(isHidden(findById(container, 'sightingShotCount')), true);
  assert.equal(isHidden(findById(container, 'spotterMeasure')), true, "spotter's measure lives alongside the scenario picker in Simulation");

  // The two H2 headings that only appear for spotter-corrected: the
  // second per-zone card and second contribution card should be hidden.
  const h2s = findByTag(container, 'H2');
  assert.equal(h2s.length, 5, 'primary perZone/contribution + illustration + secondary perZone/contribution');
  assert.equal(h2s[0].textContent, t('hitProbability.perZoneHeading'));
  assert.equal(isHidden(h2s[1]), true, 'secondary per-zone card should be hidden for Single shot');
  assert.equal(isHidden(h2s[4]), true, 'secondary contribution card should be hidden for Single shot');
});

test('switching to Spotter-corrected reveals the scenario-specific inputs and relabels/reveals both result sections', () => {
  const container = makeElement('main');
  hitProbabilityView.mount(container);
  const tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));

  fireEvent(tabButtons[1], 'click'); // Simulation
  const scenarioSelect = findById(container, 'scenario');
  scenarioSelect.value = 'spotterCorrected';
  fireEvent(scenarioSelect, 'change');

  assert.equal(isHidden(findById(container, 'sightingShotCount')), false, 'sighting shot count should now be visible');
  assert.equal(isHidden(findById(container, 'spotterMeasure')), false, "spotter's measure should now be visible");

  const h2s = findByTag(container, 'H2');
  assert.equal(h2s[0].textContent, t('hitProbability.perZoneHeadingSighting'));
  assert.equal(h2s[1].textContent, t('hitProbability.perZoneHeadingCorrected'));
  assert.equal(isHidden(h2s[1]), false, 'secondary per-zone card should now be visible');
  assert.equal(h2s[3].textContent, t('hitProbability.contributionHeadingSighting'));
  assert.equal(h2s[4].textContent, t('hitProbability.contributionHeadingCorrected'));
  assert.equal(isHidden(h2s[4]), false, 'secondary contribution card should now be visible');
});

test('the scenario selection survives navigating away and back (unmount/remount)', () => {
  const container = makeElement('main');
  const unmount = hitProbabilityView.mount(container);
  const tabButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));
  fireEvent(tabButtons[1], 'click');
  const scenarioSelect = findById(container, 'scenario');
  scenarioSelect.value = 'spotterCorrected';
  fireEvent(scenarioSelect, 'change');

  unmount();
  hitProbabilityView.mount(container);
  const tabButtons2 = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn'));
  fireEvent(tabButtons2[1], 'click');
  assert.equal(findById(container, 'scenario').value, 'spotterCorrected', 'scenario should survive remount');
  assert.equal(isHidden(findById(container, 'sightingShotCount')), false);
});
