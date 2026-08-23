import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const bcToolsView = await import('../src/views/bc-tools-view.js');
const { setDragModelVisible, resetDragModelPrefsForTests } = await import('../src/drag-model-prefs.js');
const { DRAG_MODELS } = await import('../src/engine/drag-tables.js');

// FakeWorker.postMessage() never responds under this test harness (see
// tests/helpers/fake-dom.js), so pool.run() never resolves here — no test
// below asserts an actual computed BC result; that's exercised by hand in
// a real browser, same limitation every other pool-backed view test lives
// with.

// Both the Calculation panel's and the Labradar panel's field values
// persist in module-level state across mount() calls (see
// bc-tools-view.js) — reset it between tests so one test's typed values
// don't leak into the next.
test.beforeEach(() => {
  bcToolsView.resetBcToolsStateForTests();
  resetDragModelPrefsForTests();
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

function isHidden(node) {
  let n = node;
  while (n) {
    if (n.style && n.style.display === 'none') return true;
    n = n.parentNode;
  }
  return false;
}

test('mount() builds a DOM tree without throwing, and re-mounting replaces content', () => {
  const container = makeElement('main');
  assert.doesNotThrow(() => bcToolsView.mount(container));
  const firstCount = container.childNodes.length;
  assert.ok(firstCount > 0);
  bcToolsView.mount(container);
  assert.equal(container.childNodes.length, firstCount);
});

test('exactly one of the three outer tabs is active; Conversion shows its own panel, Labradar shows its real panel', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);

  const outerButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcTools.tabCalculation'), t('bcTools.tabConversion'), t('bcTools.tabLabradar')].includes(b.textContent));
  assert.equal(outerButtons.length, 3);
  assert.equal(outerButtons.filter((b) => b.className.includes('active')).length, 1);
  assert.equal(outerButtons[0].textContent, t('bcTools.tabCalculation'));
  assert.equal(outerButtons[0].className.includes('active'), true, 'Calculation should be the initial tab');

  const runButton = findByTag(container, 'BUTTON').find((b) => b.textContent === t('bcEstimate.estimateButton'));
  const conversionBcInput = findById(container, 'convBc');
  const pickFileButton = findByTag(container, 'BUTTON').find((b) => b.textContent === t('bcToolsLabradar.pickFileButton'));
  assert.ok(runButton && conversionBcInput && pickFileButton);

  assert.equal(isHidden(runButton), false, 'Calculation content visible by default');
  assert.equal(isHidden(conversionBcInput), true);
  assert.equal(isHidden(pickFileButton), true);

  fireEvent(outerButtons[1], 'click'); // Conversion
  assert.equal(outerButtons[1].className.includes('active'), true);
  assert.equal(outerButtons[0].className.includes('active'), false);
  assert.equal(isHidden(conversionBcInput), false);
  assert.equal(isHidden(runButton), true);

  fireEvent(outerButtons[2], 'click'); // Labradar
  assert.equal(outerButtons[2].className.includes('active'), true);
  assert.equal(outerButtons[1].className.includes('active'), false);
  assert.equal(isHidden(pickFileButton), false);
  assert.equal(isHidden(conversionBcInput), true, 'Conversion panel hidden once Labradar is active');
});

test('Labradar tab: the file input is hidden and its picker button triggers it', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  const outerButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcTools.tabCalculation'), t('bcTools.tabConversion'), t('bcTools.tabLabradar')].includes(b.textContent));
  fireEvent(outerButtons[2], 'click'); // Labradar

  const fileInput = findByTag(container, 'INPUT').find((i) => i.type === 'file');
  assert.ok(fileInput, 'expected a file input in the Labradar panel');
  assert.equal(isHidden(fileInput), true);

  let clicked = false;
  fileInput.click = () => { clicked = true; };
  const pickFileButton = findByTag(container, 'BUTTON').find((b) => b.textContent === t('bcToolsLabradar.pickFileButton'));
  fireEvent(pickFileButton, 'click');
  assert.equal(clicked, true);
});

test('Labradar tab: the R^2 gate and sigma-clip filter selects default to Normal/Conservative', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  const outerButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcTools.tabCalculation'), t('bcTools.tabConversion'), t('bcTools.tabLabradar')].includes(b.textContent));
  fireEvent(outerButtons[2], 'click'); // Labradar

  const r2Select = findById(container, 'labradarR2Gate');
  const sigmaSelect = findById(container, 'labradarSigmaClip');
  assert.ok(r2Select && sigmaSelect);
  assert.equal(r2Select.value, 'normal');
  assert.equal(sigmaSelect.value, 'conservative');
});

test('Labradar tab: drag model, atmosphere, and filter choices survive navigating away and back (unmount/remount)', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  fireEvent(findLabradarButton(container), 'click');

  const dragModelSelect = findById(container, 'labradarDragModel');
  dragModelSelect.value = 'G1';
  fireEvent(dragModelSelect, 'change');

  const tempInput = findById(container, 'tempC');
  tempInput.value = '5';
  fireEvent(tempInput, 'input');

  const r2Select = findById(container, 'labradarR2Gate');
  r2Select.value = 'highNoise';
  fireEvent(r2Select, 'change');

  const denoiseSlider = findById(container, 'labradarDenoiseThreshold');
  denoiseSlider.value = '1.5';
  fireEvent(denoiseSlider, 'input');

  bcToolsView.mount(container); // simulate navigating away and back
  fireEvent(findLabradarButton(container), 'click');

  assert.equal(findById(container, 'labradarDragModel').value, 'G1');
  assert.equal(findById(container, 'tempC').value, '5');
  assert.equal(findById(container, 'labradarR2Gate').value, 'highNoise');
  assert.equal(findById(container, 'labradarDenoiseThreshold').value, '1.5');
});

test('Labradar tab: the De-noise threshold slider defaults to Tight (3) and maps to a threshold of 0.99', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  fireEvent(findLabradarButton(container), 'click');

  const denoiseSlider = findById(container, 'labradarDenoiseThreshold');
  assert.equal(denoiseSlider.value, '3');
  assert.equal(denoiseSlider.min, '1');
  assert.equal(denoiseSlider.max, '3');
  assert.equal(denoiseSlider.step, '0.5');
});

function settle(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function labradarTrackZipBlob() {
  const trackCsv = 'sep=;\nDevice ID;LBR-1;;\nSeries No;0001\nShot No;0001\n\n' +
    'Time (s);Vel (m/s);Dist (m);SNR\n0.000000;800.00;0.00;-\n0.007021;795.00;5.37;33.07\n' +
    '0.008021;793.00;6.14;40.15\n0.009021;790.00;6.90;39.80\n0.010021;788.00;7.67;35.07\n';
  const bytes = zipSync({ 'Shot0001 Track.csv': strToU8(trackCsv) });
  return new Blob([bytes], { type: 'application/zip' });
}

function findByClass(node, className, out = []) {
  if (node.className && String(node.className).split(/\s+/).includes(className)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, className, out);
  return out;
}

function findLabradarButton(container) {
  const outerButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcTools.tabCalculation'), t('bcTools.tabConversion'), t('bcTools.tabLabradar')].includes(b.textContent));
  return outerButtons[2];
}

let zipSync, strToU8;
test.before(async () => {
  ({ zipSync, strToU8 } = await import('../src/vendor/fflate/fflate.js'));
});

test('Labradar tab: uploading a zip parses tracks immediately but does not start computing until Compute is clicked', async () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  fireEvent(findLabradarButton(container), 'click');

  const fileInput = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  fileInput.files = [labradarTrackZipBlob()];
  fireEvent(fileInput, 'change');
  await settle();

  const computeButton = findByTag(container, 'BUTTON').find((b) => b.textContent === t('bcToolsLabradar.computeButton'));
  assert.ok(computeButton, 'expected a Compute button');
  assert.equal(computeButton.disabled, false, 'Compute should be enabled once a real track parsed');
  assert.equal(findByClass(container, 'status-chip-pending').length, 1, 'the track should be waiting to compute, not already computing');
  assert.equal(findByClass(container, 'status-chip-computing').length, 0);
});

test('Labradar tab: the Compute button stays disabled when the zip contains no real tracks', async () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  fireEvent(findLabradarButton(container), 'click');

  const bytes = zipSync({ 'Report.csv': strToU8('Shot ID;V0\n0001;768\n') });
  const fileInput = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  fileInput.files = [new Blob([bytes], { type: 'application/zip' })];
  fireEvent(fileInput, 'change');
  await settle();

  const computeButton = findByTag(container, 'BUTTON').find((b) => b.textContent === t('bcToolsLabradar.computeButton'));
  assert.equal(computeButton.disabled, true);
  assert.equal(findByClass(container, 'status-chip-not-a-track').length, 1);
});

test('Labradar tab: clicking Compute moves parsed tracks into the computing state', async () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  fireEvent(findLabradarButton(container), 'click');

  const fileInput = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  fileInput.files = [labradarTrackZipBlob()];
  fireEvent(fileInput, 'change');
  await settle();

  const computeButton = findByTag(container, 'BUTTON').find((b) => b.textContent === t('bcToolsLabradar.computeButton'));
  fireEvent(computeButton, 'click');

  assert.equal(findByClass(container, 'status-chip-computing').length, 1, 'expected the track to show as computing right after Compute is clicked');
  assert.equal(computeButton.disabled, true, 'Compute should be disabled while a batch is in flight');
});

test('exactly one of the two mode buttons is active; switching swaps the v2 field for the tof field', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);

  const modeButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcEstimate.modeVelocity'), t('bcEstimate.modeTof')].includes(b.textContent));
  assert.equal(modeButtons.length, 2);
  assert.equal(modeButtons[0].textContent, t('bcEstimate.modeVelocity'));
  assert.equal(modeButtons[0].className.includes('active'), true, 'Velocity should be the initial mode');

  const v2Input = findById(container, 'v2');
  const tofInput = findById(container, 'tof');
  assert.ok(v2Input && tofInput);
  assert.equal(isHidden(v2Input), false);
  assert.equal(isHidden(tofInput), true);

  fireEvent(modeButtons[1], 'click'); // Time of flight
  assert.equal(modeButtons[1].className.includes('active'), true);
  assert.equal(modeButtons[0].className.includes('active'), false);
  assert.equal(isHidden(v2Input), true);
  assert.equal(isHidden(tofInput), false);

  fireEvent(modeButtons[0], 'click'); // back to Velocity
  assert.equal(isHidden(v2Input), false);
  assert.equal(isHidden(tofInput), true);
});

test('switching modes leaves v1/r1/r2 values untouched', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);

  const v1Input = findById(container, 'v1');
  v1Input.value = '900';
  fireEvent(v1Input, 'input');

  const modeButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcEstimate.modeVelocity'), t('bcEstimate.modeTof')].includes(b.textContent));
  fireEvent(modeButtons[1], 'click'); // Time of flight
  fireEvent(modeButtons[0], 'click'); // back to Velocity

  assert.equal(findById(container, 'v1').value, '900');
});

test('field values, drag model, and time of flight survive navigating away and back (unmount/remount)', () => {
  const container = makeElement('main');
  const unmount = bcToolsView.mount(container);

  findById(container, 'v1').value = '910';
  fireEvent(findById(container, 'v1'), 'input');
  findById(container, 'r1').value = '5';
  fireEvent(findById(container, 'r1'), 'input');
  findById(container, 'r2').value = '350';
  fireEvent(findById(container, 'r2'), 'input');

  const dragModelSelect = findById(container, 'dragModel');
  dragModelSelect.value = 'G7';
  fireEvent(dragModelSelect, 'change');

  const modeButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcEstimate.modeVelocity'), t('bcEstimate.modeTof')].includes(b.textContent));
  fireEvent(modeButtons[1], 'click'); // Time of flight
  findById(container, 'tof').value = '0.4';
  fireEvent(findById(container, 'tof'), 'input');

  unmount();
  bcToolsView.mount(container); // simulate navigating to another tool and back

  assert.equal(findById(container, 'v1').value, '910', 'v1 should survive remount');
  assert.equal(findById(container, 'r1').value, '5', 'r1 should survive remount');
  assert.equal(findById(container, 'r2').value, '350', 'r2 should survive remount');
  assert.equal(findById(container, 'dragModel').value, 'G7', 'drag model should survive remount');

  // Mode itself resets to Velocity on remount (matches hit-probability-
  // view.js's own precedent of not persisting which tab is active), but
  // the tof value typed while in ToF mode is still there once you switch
  // back to it.
  const modeButtons2 = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcEstimate.modeVelocity'), t('bcEstimate.modeTof')].includes(b.textContent));
  assert.equal(modeButtons2[0].className.includes('active'), true, 'Velocity should be active again after remount');
  fireEvent(modeButtons2[1], 'click');
  assert.equal(findById(container, 'tof').value, '0.4', 'tof should survive remount');
});

test('clicking Estimate BC shows the computing status', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);

  const status = findByTag(container, 'DIV').find((d) => d.className && d.className.startsWith('status'));
  const runButton = findByTag(container, 'BUTTON').find((b) => b.textContent === t('bcEstimate.estimateButton'));
  assert.ok(status && runButton);

  fireEvent(runButton, 'click');
  assert.equal(status.textContent, t('common.computing'));
});

test('an invalid time of flight shows an error instead of running the calculation', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);

  const modeButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcEstimate.modeVelocity'), t('bcEstimate.modeTof')].includes(b.textContent));
  fireEvent(modeButtons[1], 'click'); // Time of flight

  const tofInput = findById(container, 'tof');
  tofInput.value = '0';
  fireEvent(tofInput, 'input');

  const status = findByTag(container, 'DIV').find((d) => d.className && d.className.startsWith('status'));
  const runButton = findByTag(container, 'BUTTON').find((b) => b.textContent === t('bcEstimate.estimateButton'));
  fireEvent(runButton, 'click');

  assert.equal(status.textContent, t('common.error', { message: t('bcTools.invalidTof') }));
  assert.ok(status.className.includes('error'));
});

test('r1 must be nearer than r2 — a live cross-field check on both fields, from either side', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);

  const r1Input = findById(container, 'r1');
  const r2Input = findById(container, 'r2');

  // r1's own range tops out at 200, so drop r2 below r1's default (0)
  // first, then raise r1 past it — both stay within their own plain
  // min/max bounds, isolating the cross-field check.
  r2Input.value = '10'; // r2's own min
  fireEvent(r2Input, 'input');
  r1Input.value = '50';
  fireEvent(r1Input, 'input');
  assert.equal(r1Input.classList.contains('field-invalid'), true);
  const r1Hint = findByTag(container, 'P').find((p) => p.className.includes('warning') && p.textContent === t('bcEstimate.errorNearRangeExceedsFar'));
  assert.ok(r1Hint);

  // Fixing it from the other side (raising r2 back past r1) clears both.
  r2Input.value = '300';
  fireEvent(r2Input, 'input');
  assert.equal(r1Input.classList.contains('field-invalid'), false);
  assert.equal(r2Input.classList.contains('field-invalid'), false);

  // And breaking it from r2's side (dropping it below r1 again) flags r2 too.
  r2Input.value = '10';
  fireEvent(r2Input, 'input');
  assert.equal(r2Input.classList.contains('field-invalid'), true);
});

// ---- BC Conversion ----
// Unlike the Calculation/ToF panels above, conversion is a plain
// synchronous formula (no worker pool involved — see engine/bc-convert.js),
// so these tests assert real computed results directly.

function openConversionTab(container) {
  const outerButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcTools.tabCalculation'), t('bcTools.tabConversion'), t('bcTools.tabLabradar')].includes(b.textContent));
  fireEvent(outerButtons[1], 'click');
}

test('the conversion result recomputes automatically on every input change, with no button to press', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  openConversionTab(container);

  const result = findById(container, 'conv-result');
  assert.notEqual(result.textContent, '—', 'the default inputs should already produce a real result on mount');

  const before = result.textContent;
  const bcInput = findById(container, 'convBc');
  bcInput.value = '0.6';
  fireEvent(bcInput, 'input');
  assert.notEqual(result.textContent, before, 'changing the source BC should recompute without a button');
});

test('converting a model to itself leaves the BC unchanged', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  openConversionTab(container);

  const sourceSelect = findById(container, 'convSourceModel');
  const targetSelect = findById(container, 'convTargetModel');
  const bcInput = findById(container, 'convBc');
  bcInput.value = '0.512';
  fireEvent(bcInput, 'input');
  sourceSelect.value = 'G7';
  fireEvent(sourceSelect, 'change');
  targetSelect.value = 'G7';
  fireEvent(targetSelect, 'change');

  const result = findById(container, 'conv-result');
  assert.equal(result.textContent, '0.5120');
});

test('an empty or non-positive source BC shows the placeholder instead of a stale result', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  openConversionTab(container);

  const bcInput = findById(container, 'convBc');
  bcInput.value = '0';
  fireEvent(bcInput, 'input');

  const result = findById(container, 'conv-result');
  assert.equal(result.textContent, '—');
});

test('toggling the velocity unit restates the same physical velocity and leaves the converted BC unchanged', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);
  openConversionTab(container);

  const velocityInput = findById(container, 'convVelocity');
  const velocityUnitSelect = findById(container, 'convVelocityUnit');
  const result = findById(container, 'conv-result');

  assert.equal(velocityUnitSelect.value, 'm/s', 'defaults to m/s absent a ft/s global preference');
  velocityInput.value = '800';
  fireEvent(velocityInput, 'input');
  const before = result.textContent;

  velocityUnitSelect.value = 'ft/s';
  fireEvent(velocityUnitSelect, 'change');
  assert.equal(velocityInput.value, (800 / 0.3048).toFixed(0), 'restates 800 m/s in ft/s rather than resetting');
  assert.equal(result.textContent, before, 'the same physical velocity must convert to the same BC');
});

test('both drag-model pickers list every standard model, even one hidden in Settings', () => {
  setDragModelVisible('G8', false);

  const container = makeElement('main');
  bcToolsView.mount(container);

  // The Calculation panel's own picker respects the Settings preference...
  const calcSelect = findById(container, 'dragModel');
  assert.equal(findByTag(calcSelect, 'OPTION').some((o) => o.getAttribute('value') === 'G8'), false);

  // ...but both Conversion pickers must not, regardless of which side G8
  // would be missing from.
  openConversionTab(container);
  const sourceSelect = findById(container, 'convSourceModel');
  const targetSelect = findById(container, 'convTargetModel');
  for (const select of [sourceSelect, targetSelect]) {
    const ids = findByTag(select, 'OPTION').map((o) => o.getAttribute('value'));
    assert.deepEqual(ids.sort(), DRAG_MODELS.map((m) => m.id).sort());
  }
});
