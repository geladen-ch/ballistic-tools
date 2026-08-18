import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const bcToolsView = await import('../src/views/bc-tools-view.js');

// FakeWorker.postMessage() never responds under this test harness (see
// tests/helpers/fake-dom.js), so pool.run() never resolves here — no test
// below asserts an actual computed BC result; that's exercised by hand in
// a real browser, same limitation every other pool-backed view test lives
// with.

// The Calculation panel's field values persist in module-level state
// across mount() calls (see bc-tools-view.js) — reset it between tests so
// one test's typed values don't leak into the next.
test.beforeEach(() => bcToolsView.resetBcToolsStateForTests());

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

test('exactly one of the three outer tabs is active; Conversion and Labradar show their own stub message', () => {
  const container = makeElement('main');
  bcToolsView.mount(container);

  const outerButtons = findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('tab-btn') &&
    [t('bcTools.tabCalculation'), t('bcTools.tabConversion'), t('bcTools.tabLabradar')].includes(b.textContent));
  assert.equal(outerButtons.length, 3);
  assert.equal(outerButtons.filter((b) => b.className.includes('active')).length, 1);
  assert.equal(outerButtons[0].textContent, t('bcTools.tabCalculation'));
  assert.equal(outerButtons[0].className.includes('active'), true, 'Calculation should be the initial tab');

  const runButton = findByTag(container, 'BUTTON').find((b) => b.textContent === t('bcEstimate.estimateButton'));
  const conversionStub = findByTag(container, 'P').find((p) => p.textContent === t('bcTools.conversionStub'));
  const labradarStub = findByTag(container, 'P').find((p) => p.textContent === t('bcTools.labradarStub'));
  assert.ok(runButton && conversionStub && labradarStub);

  assert.equal(isHidden(runButton), false, 'Calculation content visible by default');
  assert.equal(isHidden(conversionStub), true);
  assert.equal(isHidden(labradarStub), true);

  fireEvent(outerButtons[1], 'click'); // Conversion
  assert.equal(outerButtons[1].className.includes('active'), true);
  assert.equal(outerButtons[0].className.includes('active'), false);
  assert.equal(isHidden(conversionStub), false);
  assert.equal(isHidden(runButton), true);

  fireEvent(outerButtons[2], 'click'); // Labradar
  assert.equal(outerButtons[2].className.includes('active'), true);
  assert.equal(outerButtons[1].className.includes('active'), false);
  assert.equal(isHidden(labradarStub), false);
  assert.equal(isHidden(conversionStub), true, 'Conversion stub hidden once Labradar is active');
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
