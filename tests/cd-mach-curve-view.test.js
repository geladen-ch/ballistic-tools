import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n } = await import('../src/i18n.js');
await initI18n();
const { makeStepper } = await import('../src/engine/trajectory.js');
const { MAX_STEPS } = await import('../src/engine/constants.js');
const cdMachCurveView = await import('../src/views/cd-mach-curve-view.js');
const { takePendingBulletPrefill } = await import('../src/arsenal-prefill.js');
const { resetCdMachCurveStateForTests } = await import('../src/cd-mach-curve-state.js');
const { removeCookie } = await import('../src/cookies.js');

test.beforeEach(() => {
  resetCdMachCurveStateForTests();
  removeCookie('ballistics_cd_mach_curve_state_v1');
  takePendingBulletPrefill(); // clear any leftover from another test file
});

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.childNodes || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

const ATMO = { tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0 };
const MASS_KG = 0.0092;
const CALIBER_M = 0.0069;
const TRUE_CD = 0.3;

// Forward-integrates the exact same (fresh-per-segment) physics the
// engine's own solver assumes, at a known flat Cd, so the resulting
// table is guaranteed solvable by the tool with these exact mass/caliber
// inputs — same technique as tests/cd-mach-curve.test.js's own
// buildSyntheticTable, just formatted as pasteable text here.
function buildVelocityTableText(ranges, v0) {
  const velocities = [v0];
  for (let i = 0; i < ranges.length - 1; i++) {
    const dd = ranges[i + 1] - ranges[i];
    const stepper = makeStepper({ cdTable: [[0, TRUE_CD], [5, TRUE_CD]], massKg: MASS_KG, caliberM: CALIBER_M, windSpeed: 0, windAngle: 90, ...ATMO });
    let p = { x: 0, y: 0, z: 0, vx: velocities[i], vy: 0, vz: 0, t: 0 };
    let steps = 0;
    while (p.x < dd && steps < MAX_STEPS) { p = stepper.step(p); steps++; }
    velocities.push(Math.hypot(p.vx, p.vy, p.vz));
  }
  return ranges.map((r, i) => `${r} ${velocities[i].toFixed(4)}`).join('\n');
}

function fillAndCompute(container) {
  const textarea = findById(container, 'cdMachVelTable');
  textarea.value = buildVelocityTableText([0, 120, 260, 400], 850);
  fireEvent(textarea, 'input');

  const gramsInput = findById(container, 'massGrams');
  gramsInput.value = String(MASS_KG * 1000);
  fireEvent(gramsInput, 'input');

  const caliberInput = findById(container, 'bulletCaliberMm');
  caliberInput.value = String(CALIBER_M * 1000);
  fireEvent(caliberInput, 'input');

  return { textarea, gramsInput, caliberInput };
}

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

test('mount() builds a DOM tree without throwing, with Save to Arsenal disabled before any input', () => {
  const container = makeElement('main');
  assert.doesNotThrow(() => cdMachCurveView.mount(container));

  const buttons = findByTag(container, 'BUTTON');
  const saveButton = buttons.find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'cdMachCurve.saveToArsenalButton');
  assert.ok(saveButton, 'expected a Save to Arsenal button');
  assert.equal(saveButton.disabled, true);
});

test('the table section shows a hint recommending a minimum step size and warning about tables that never reach Mach 1.0', () => {
  const container = makeElement('main');
  cdMachCurveView.mount(container);

  const hints = findByTag(container, 'P').filter((p) => p.getAttribute && p.getAttribute('data-i18n') === 'cdMachCurve.tableRecommendationHint');
  assert.equal(hints.length, 1, 'expected exactly one recommendation hint');
  assert.match(hints[0].textContent, /20 m\/s/);
  assert.match(hints[0].textContent, /Mach 1\.0/);
});

test('chart has a "download chart as SVG" button, same as Trajectory\'s own chart', () => {
  const container = makeElement('main');
  cdMachCurveView.mount(container);

  const buttons = findByTag(container, 'BUTTON');
  const downloadBtn = buttons.find((b) => b.getAttribute && b.getAttribute('title') === 'Download chart as SVG');
  assert.ok(downloadBtn, 'expected a chart download button');
});

test('both the Interpolated and Calculated tables have their own copy-CSV and download-CSV buttons', () => {
  const container = makeElement('main');
  cdMachCurveView.mount(container);

  const buttons = findByTag(container, 'BUTTON');
  const byTitle = (title) => buttons.filter((b) => b.getAttribute && b.getAttribute('title') === title);
  assert.equal(byTitle('Copy table as CSV').length, 2, 'expected one copy button per output table');
  assert.equal(byTitle('Download table as CSV').length, 2, 'expected one download button per output table');
});

test('computing a valid table enables Save to Arsenal, and Save hands mass/caliber/cdTable off to Arsenal', () => {
  const container = makeElement('main');
  cdMachCurveView.mount(container);

  fillAndCompute(container);

  const buttons = findByTag(container, 'BUTTON');
  const computeButton = buttons.find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'cdMachCurve.computeButton');
  const saveButton = buttons.find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'cdMachCurve.saveToArsenalButton');
  assert.ok(computeButton && saveButton);

  fireEvent(computeButton, 'click');

  const interpolatedRows = findByTag(container, 'TBODY')[0].childNodes;
  assert.ok(interpolatedRows.length > 0, 'expected the Interpolated table to have rows after a successful compute');
  assert.equal(saveButton.disabled, false, 'expected Save to Arsenal to be enabled once a result exists');

  fireEvent(saveButton, 'click');

  assert.equal(location.hash, '#/guns/arsenal');
  const prefill = takePendingBulletPrefill();
  assert.ok(prefill, 'expected a pending bullet prefill');
  assert.ok(Math.abs(prefill.massKg - MASS_KG) < 1e-6, `massKg ${prefill.massKg}`);
  assert.ok(Math.abs(prefill.caliberM - CALIBER_M) < 1e-6, `caliberM ${prefill.caliberM}`);
  assert.ok(Array.isArray(prefill.cdTable) && prefill.cdTable.length > 0, 'expected a non-empty cdTable');
  for (const [mach, cd] of prefill.cdTable) {
    assert.ok(Number.isFinite(mach) && Number.isFinite(cd));
  }
});

test('inputs survive navigating away and back (re-mounting into a fresh container)', () => {
  const container1 = makeElement('main');
  cdMachCurveView.mount(container1);
  const { textarea } = fillAndCompute(container1);

  const unitSystemSelect = findById(container1, 'cdMachTableUnitSystem');
  unitSystemSelect.value = 'archaic';
  fireEvent(unitSystemSelect, 'change');

  const showCalculatedCheckbox = findById(container1, 'cdMachShowCalculated');
  showCalculatedCheckbox.checked = true;
  fireEvent(showCalculatedCheckbox, 'change');

  const saveSourceSelect = findById(container1, 'cdMachSaveSource');
  saveSourceSelect.value = 'calculated';
  fireEvent(saveSourceSelect, 'change');

  const velocityTableText = textarea.value;

  // A different container, standing in for the router handing the view a
  // fresh mount on navigating back — nothing carries over except through
  // cd-mach-curve-state.js's own cookie.
  const container2 = makeElement('main');
  cdMachCurveView.mount(container2);

  assert.equal(findById(container2, 'cdMachVelTable').value, velocityTableText);
  assert.equal(findById(container2, 'massGrams').value, String(MASS_KG * 1000));
  assert.equal(findById(container2, 'bulletCaliberMm').value, (CALIBER_M * 1000).toFixed(2));
  assert.equal(findById(container2, 'cdMachTableUnitSystem').value, 'archaic');
  assert.equal(findById(container2, 'cdMachShowCalculated').checked, true);
  assert.equal(findById(container2, 'cdMachSaveSource').value, 'calculated');

  // Restored inputs are also automatically recomputed on mount (the
  // view's own existing auto-run), so the result isn't just the raw
  // fields but a live, populated table too.
  const buttons = findByTag(container2, 'BUTTON');
  const saveButton = buttons.find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'cdMachCurve.saveToArsenalButton');
  assert.equal(saveButton.disabled, false, 'expected the restored inputs to auto-recompute into an enabled Save button');
});

test('editing an input after a successful compute disables Save to Arsenal again', () => {
  const container = makeElement('main');
  cdMachCurveView.mount(container);
  fillAndCompute(container);

  const buttons = findByTag(container, 'BUTTON');
  const computeButton = buttons.find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'cdMachCurve.computeButton');
  const saveButton = buttons.find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'cdMachCurve.saveToArsenalButton');
  fireEvent(computeButton, 'click');
  assert.equal(saveButton.disabled, false);

  const textarea = findById(container, 'cdMachVelTable');
  fireEvent(textarea, 'input');
  assert.equal(saveButton.disabled, true, 'expected Save to Arsenal to be disabled again after editing an input post-compute');
});
