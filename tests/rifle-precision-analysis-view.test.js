import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const analysisView = await import('../src/views/rifle-precision-analysis-view.js');
const {
  saveRiflePrecisionProject, resetRiflePrecisionLibraryForTests
} = await import('../src/rifle-precision-library.js');
const { generateUserId } = await import('../src/user-library.js');
const { setActiveProjectId, resetRiflePrecisionNavForTests } = await import('../src/rifle-precision-nav.js');
const { computeCombinedStats, confidenceLevel } = await import('../src/engine/rifle-precision-stats.js');
const { resetRiflePrecisionAnalysisStateForTests } = await import('../src/rifle-precision-analysis-state.js');
const { removeCookie } = await import('../src/cookies.js');

test.beforeEach(async () => {
  await resetRiflePrecisionLibraryForTests();
  resetRiflePrecisionNavForTests();
  resetRiflePrecisionAnalysisStateForTests();
  removeCookie('ballistics_rifle_precision_analysis_state_v1');
  location.hash = '';
});

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function findByAttr(node, attr, value, out = []) {
  if (node.getAttribute && node.getAttribute(attr) === value) out.push(node);
  for (const child of node.childNodes || []) findByAttr(child, attr, value, out);
  return out;
}

function findByClass(node, cls, out = []) {
  if ((node.className || '').split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

function buttonByKey(node, key) {
  return findByTag(node, 'BUTTON').find((b) => b.getAttribute('data-i18n') === key);
}

function containsNode(ancestor, target) {
  if (ancestor === target) return true;
  for (const child of ancestor.childNodes || []) {
    if (containsNode(child, target)) return true;
  }
  return false;
}

// Locates a checkbox by the i18n key on its own <label><span> text — the
// Image options toggles (overlayToggle()'s own [checkbox, i18n span] pair).
function checkboxByLabelKey(node, key) {
  const span = findByAttr(node, 'data-i18n', key)[0];
  if (!span) return undefined;
  return findByTag(span.parentNode, 'INPUT').find((i) => i.type === 'checkbox');
}

// Locates a Numbers-table row by its description cell's i18n key.
function numbersRowByDescriptionKey(node, key) {
  const table = findByClass(node, 'rp-numbers-table')[0];
  return findByTag(table, 'TR').find((tr) => {
    const cell = tr.childNodes[0];
    return cell && cell.getAttribute && cell.getAttribute('data-i18n') === key;
  });
}
function checkboxInRow(tr) {
  return findByTag(tr, 'INPUT').find((i) => i.type === 'checkbox');
}

// A target calibrated at 10 px/mm (1000x1000 photo, a 100mm ruler across
// it), with one group of 5 shots pooled around its own POA — enough shots
// to clear computeCombinedStats()'s n>=3 "ok" floor and exercise the full
// analysis layout, not the "not enough shots" hint.
function makeAnalyzableProject(overrides = {}, offsetsMm = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
  const scale = 10; // px/mm
  const poaRel = { x: 0.5, y: 0.5 };
  const shots = offsetsMm.map(([dx, dy]) => ({
    x: 0.5 + (dx * scale) / 1000,
    y: 0.5 + (dy * scale) / 1000
  }));
  const target = {
    id: generateUserId('rp-target'), name: 'T1', notes: null,
    photo: 'data:image/jpeg;base64,AAA', photoWidth: 1000, photoHeight: 1000,
    calibration: { point1: { x: 0, y: 0.5 }, point2: { x: 1, y: 0.5 }, realLengthMm: 100 },
    groups: [{ id: generateUserId('rp-group'), poa: poaRel, shots }]
  };
  return saveRiflePrecisionProject({
    id: generateUserId('rp-project'), name: 'Home Range', distanceM: 100, caliberMm: 7.62,
    targets: [target], createdAt: new Date().toISOString(), ...overrides
  });
}

function makeTooFewShotsProject() {
  const target = {
    id: generateUserId('rp-target'), name: 'T1', notes: null,
    photo: 'data:image/jpeg;base64,AAA', photoWidth: 1000, photoHeight: 1000,
    calibration: { point1: { x: 0, y: 0.5 }, point2: { x: 1, y: 0.5 }, realLengthMm: 100 },
    groups: [{ id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.5, y: 0.5 }] }]
  };
  return saveRiflePrecisionProject({
    id: generateUserId('rp-project'), name: 'Too Few', distanceM: 100, caliberMm: 7.62,
    targets: [target], createdAt: new Date().toISOString()
  });
}

test('mount() with no active project redirects to /rifle-precision', () => {
  const container = makeElement('main');
  const cleanup = analysisView.mount(container);
  assert.equal(location.hash, '#/rifle-precision');
  cleanup();
});

test('mount() redirects when the active project id no longer resolves', () => {
  setActiveProjectId('deleted-project');
  const container = makeElement('main');
  const cleanup = analysisView.mount(container);
  assert.equal(location.hash, '#/rifle-precision');
  cleanup();
});

test('too few pooled shots shows the "nothing to analyse" hint instead of the full layout', () => {
  const project = makeTooFewShotsProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  assert.ok(container.textContent.includes(t('riflePrecision.noShotsToAnalyzeHint')));
  assert.ok(!container.textContent.includes(t('riflePrecision.numbersHeading')), 'no Numbers table when there is nothing to analyse');
});

test('the page heading is "<project name> precision report"', () => {
  const project = makeAnalyzableProject({ name: 'Home Range' });
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const heading = findByTag(container, 'H1')[0];
  assert.ok(heading, 'expected an h1 heading');
  assert.equal(heading.textContent, t('riflePrecision.precisionReportHeading', { name: 'Home Range' }));
});

test('a subheading states distance/caliber/shot count, and the project name is no longer repeated in the Numbers table', () => {
  const project = makeAnalyzableProject({ name: 'Home Range' });
  const stats = computeCombinedStats(project);
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  assert.ok(container.textContent.includes(t('riflePrecision.shotCount', { count: stats.shotCount })), 'subheading includes the shot count');
  const nameOccurrences = container.textContent.split('Home Range').length - 1;
  assert.equal(nameOccurrences, 1, 'project name appears once (the h1) — no longer repeated as a Numbers-table heading');
});

test('Back navigates to the project list', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  fireEvent(buttonByKey(container, 'riflePrecision.backButton'), 'click');
  assert.equal(location.hash, '#/rifle-precision');
});

test('the confidence-o-meter shows the right level/color for known confidence bounds', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const stats = computeCombinedStats(project);
  const level = confidenceLevel(stats.confidenceLower, stats.confidenceUpper);
  assert.ok(container.textContent.includes(t(`riflePrecision.confidenceLevel${level}Line1`)));

  const info = findByClass(container, 'rp-confidence-info')[0];
  assert.ok(info, 'info panel element renders');
  assert.ok(info.style.background, 'info panel is colored per its confidence level');
});

test('no raw "riflePrecision.*" i18n key ever leaks into the rendered analysis view', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);
  assert.ok(!container.textContent.includes('riflePrecision.'), 'no raw i18n key leaked into rendered text');
});

test('"Aggregate results" (renamed from "Diagram") and "Legend" each get their own card, inside a shared responsive row wrapper', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const row = findByClass(container, 'rp-aggregate-legend-row')[0];
  assert.ok(row, 'wrapper renders');
  const cards = row.childNodes.filter((c) => (c.className || '').split(' ').includes('card'));
  assert.equal(cards.length, 2, 'diagram card and legend card, side by side');
  assert.ok(cards[0].textContent.includes(t('riflePrecision.aggregateResultsHeading')));
  assert.ok(cards[1].textContent.includes(t('riflePrecision.legendHeading')));
});

test('the results-unit selector defaults to the user\'s absolute unit and switching to mrad/MOA updates the Numbers table and legend values', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const select = findByTag(container, 'SELECT').find((s) => s.id === 'riflePrecisionResultsUnit');
  assert.ok(select, 'the results-unit select renders');
  assert.equal(select.value, 'absolute');

  const sigmaValueCell = () => numbersRowByDescriptionKey(container, 'riflePrecision.stdDeviationDescription').childNodes[2];
  assert.ok(sigmaValueCell().textContent.includes('mm'), sigmaValueCell().textContent);

  select.value = 'mrad';
  fireEvent(select, 'change');
  assert.ok(sigmaValueCell().textContent.includes('mrad'), sigmaValueCell().textContent);

  select.value = 'moa';
  fireEvent(select, 'change');
  assert.ok(sigmaValueCell().textContent.includes('MOA'), sigmaValueCell().textContent);
});

test('Numbers-table default "show" states: R95 and its confidence interval checked; sigma/R50/R99/POI-CI/ES5x/ES10x unchecked; shot count has no "show" checkbox at all', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const shotCountRow = numbersRowByDescriptionKey(container, 'riflePrecision.shotCountLabel');
  assert.equal(checkboxInRow(shotCountRow), undefined, 'no checkbox — impacts are already a permanent, non-optional diagram element');

  const expectations = [
    ['riflePrecision.legendPoiCi', false],
    ['riflePrecision.stdDeviationDescription', false],
    ['riflePrecision.r50Description', false],
    ['riflePrecision.r95Description', true],
    ['riflePrecision.r95ConfidenceMarginLabel', true],
    ['riflePrecision.r99Description', false],
    ['riflePrecision.es5xDescription', false],
    ['riflePrecision.es10xDescription', false]
  ];
  for (const [key, expected] of expectations) {
    const row = numbersRowByDescriptionKey(container, key);
    assert.equal(checkboxInRow(row).checked, expected, key);
  }
});

test('Numbers-table "Confidence interval" and "R95 confidence interval" rows use the literal "-X%/+Y%" / "-X/+Y" delta format', () => {
  const project = makeAnalyzableProject();
  const stats = computeCombinedStats(project);
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const ciCell = numbersRowByDescriptionKey(container, 'riflePrecision.confidenceIntervalLabel').childNodes[2];
  assert.match(ciCell.textContent, /^-\d+%\/\+\d+%$/, ciCell.textContent);

  const r95CiCell = numbersRowByDescriptionKey(container, 'riflePrecision.r95ConfidenceMarginLabel').childNodes[2];
  assert.match(r95CiCell.textContent, /^-.+\/\+.+$/, r95CiCell.textContent);

  const es5xCell = numbersRowByDescriptionKey(container, 'riflePrecision.es5xDescription').childNodes[2];
  assert.ok(es5xCell.textContent.includes(stats.d5x.toFixed(2)), 'ES5x reports the corrected full diameter, not a halved radius');
});

test('toggling each Numbers-table "show" checkbox adds/removes the corresponding SVG element', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const cases = [
    ['riflePrecision.legendPoiCi', 'poi-ci-box'],
    ['riflePrecision.stdDeviationDescription', 'sigma-circle'],
    ['riflePrecision.r50Description', 'r50-circle'],
    ['riflePrecision.r99Description', 'r99-circle'],
    ['riflePrecision.es5xDescription', 'es5x-circle'],
    ['riflePrecision.es10xDescription', 'es10x-circle']
  ];
  for (const [key, role] of cases) {
    const checkbox = checkboxInRow(numbersRowByDescriptionKey(container, key));
    assert.equal(findByAttr(container, 'data-role', role).length, 0, `${role} hidden by default`);
    checkbox.checked = true;
    fireEvent(checkbox, 'change');
    assert.equal(findByAttr(container, 'data-role', role).length, 1, `${role} appears once toggled on`);
    checkbox.checked = false;
    fireEvent(checkbox, 'change');
    assert.equal(findByAttr(container, 'data-role', role).length, 0, `${role} disappears once toggled back off`);
  }

  // R95 and its confidence interval are checked by default — unchecking removes each independently.
  assert.equal(findByAttr(container, 'data-role', 'r95-circle').length, 1);
  assert.equal(findByAttr(container, 'data-role', 'r95-band').length, 1);
  const r95Checkbox = checkboxInRow(numbersRowByDescriptionKey(container, 'riflePrecision.r95Description'));
  r95Checkbox.checked = false;
  fireEvent(r95Checkbox, 'change');
  assert.equal(findByAttr(container, 'data-role', 'r95-circle').length, 0);
  assert.equal(findByAttr(container, 'data-role', 'r95-band').length, 1, 'R95-CI band unaffected by the R95 circle toggle');

  const r95CiCheckbox = checkboxInRow(numbersRowByDescriptionKey(container, 'riflePrecision.r95ConfidenceMarginLabel'));
  r95CiCheckbox.checked = false;
  fireEvent(r95CiCheckbox, 'change');
  assert.equal(findByAttr(container, 'data-role', 'r95-band').length, 0);
});

test('each toggled Numbers-table "show" checkbox also adds/removes its own legend row', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const legendTable = findByClass(container, 'rp-legend-table')[0];
  assert.ok(!legendTable.textContent.includes(t('riflePrecision.legendSigma')));

  const sigmaCheckbox = checkboxInRow(numbersRowByDescriptionKey(container, 'riflePrecision.stdDeviationDescription'));
  sigmaCheckbox.checked = true;
  fireEvent(sigmaCheckbox, 'change');
  assert.ok(legendTable.textContent.includes(t('riflePrecision.legendSigma')));
});

test('the legend lists "All impacts" (renamed from "Pooled shot"), POA, average POI, R95, and 1-MOA reference by default', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const legendTable = findByClass(container, 'rp-legend-table')[0];
  assert.equal(t('riflePrecision.legendPooledShot'), 'All impacts');
  assert.ok(legendTable.textContent.includes(t('riflePrecision.legendPooledShot')));
  assert.ok(legendTable.textContent.includes(t('riflePrecision.legendPoa')));
  assert.ok(legendTable.textContent.includes(t('riflePrecision.legendPoi')));
  assert.ok(legendTable.textContent.includes(t('riflePrecision.legendR95')));
  assert.ok(legendTable.textContent.includes(t('riflePrecision.legendR95Ci')));
  assert.ok(legendTable.textContent.includes(t('riflePrecision.legendOneMoa')));
  assert.ok(!legendTable.textContent.includes(t('riflePrecision.legendPoiCi')));
});

test('"Image options" (renamed from "Display") defaults: Impacts to scale, 1 MOA reference and Save-legend checked, Scale unchecked', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  assert.ok(container.textContent.includes(t('riflePrecision.imageOptionsHeading')));
  assert.equal(checkboxByLabelKey(container, 'riflePrecision.impactsToScaleLabel').checked, true);
  assert.equal(checkboxByLabelKey(container, 'riflePrecision.legendOneMoa').checked, true);
  assert.equal(checkboxByLabelKey(container, 'riflePrecision.scaleLabel').checked, false);
  assert.equal(checkboxByLabelKey(container, 'riflePrecision.includeLegendCheckboxLabel').checked, true);
});

test('the "impacts to scale" checkbox (now checked by default) switches pooled-shot dot radius between true bore radius and the fixed marker size', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const expectedBoreR = String(project.caliberMm / 2);
  const shotsInitially = findByAttr(container, 'data-role', 'pooled-shot');
  assert.ok(shotsInitially.length > 0);
  for (const shot of shotsInitially) assert.equal(shot.getAttribute('r'), expectedBoreR, 'checked by default — true bore radius already applied');

  const checkbox = checkboxByLabelKey(container, 'riflePrecision.impactsToScaleLabel');
  checkbox.checked = false;
  fireEvent(checkbox, 'change');
  const rAfter = findByAttr(container, 'data-role', 'pooled-shot')[0].getAttribute('r');
  assert.notEqual(rAfter, expectedBoreR, 'reverts to the fixed marker size once unchecked');
});

test('unchecking "1 MOA reference" removes the diagram circle, its caption, and its legend row', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  assert.equal(findByAttr(container, 'data-role', 'one-moa-circle').length, 1);
  assert.ok(container.textContent.includes(t('riflePrecision.legendOneMoa')));

  const checkbox = checkboxByLabelKey(container, 'riflePrecision.legendOneMoa');
  checkbox.checked = false;
  fireEvent(checkbox, 'change');

  assert.equal(findByAttr(container, 'data-role', 'one-moa-circle').length, 0);
  const legendTable = findByClass(container, 'rp-legend-table')[0];
  assert.ok(!legendTable.textContent.includes(t('riflePrecision.legendOneMoa')));
});

test('toggling the "Scale" checkbox adds and removes the scale bar from the diagram', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  assert.equal(findByAttr(container, 'data-role', 'scale-bar').length, 0, 'scale bar hidden by default');

  const checkbox = checkboxByLabelKey(container, 'riflePrecision.scaleLabel');
  checkbox.checked = true;
  fireEvent(checkbox, 'change');
  assert.equal(findByAttr(container, 'data-role', 'scale-bar').length, 1, 'scale bar appears once toggled on');

  checkbox.checked = false;
  fireEvent(checkbox, 'change');
  assert.equal(findByAttr(container, 'data-role', 'scale-bar').length, 0, 'scale bar disappears once toggled back off');
});

test('the diagram always plots one pooled-shot dot per pooled shot, and a POA/POI marker', () => {
  const project = makeAnalyzableProject();
  const stats = computeCombinedStats(project);
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  assert.equal(findByAttr(container, 'data-role', 'pooled-shot').length, stats.shotCount);
  assert.equal(findByAttr(container, 'data-role', 'poa-marker').length, 1);
  assert.equal(findByAttr(container, 'data-role', 'poi-marker').length, 1);
});

test('moving the hit-probability slider (now inside Image options) shows the interactive circle and updates the readout', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  assert.equal(findByAttr(container, 'data-role', 'hit-probability-circle').length, 0, 'hidden at 0%');

  const slider = findByTag(container, 'INPUT').find((i) => i.type === 'range');
  assert.ok(slider);
  slider.value = '50';
  fireEvent(slider, 'input');

  assert.equal(findByAttr(container, 'data-role', 'hit-probability-circle').length, 1, 'shown once above 0%');
  assert.ok(container.textContent.includes(t('riflePrecision.hitProbabilityLabel')));

  const legendTable = findByClass(container, 'rp-legend-table')[0];
  const legendRow = findByTag(legendTable, 'TR').find((tr) => tr.textContent.includes(t('riflePrecision.legendHitProbability')));
  assert.ok(legendRow, 'legend gains a hit-probability row once the slider is above 0%');
  assert.match(legendRow.childNodes[2].textContent, /^50%:/, 'the legend value leads with the percent, before the radius');
});

function gridSelectIn(container) {
  return findByTag(container, 'SELECT').find((s) => s.id === 'riflePrecisionGridSelect');
}
function gridLineGroupIn(container) {
  return findByAttr(container, 'data-role', 'grid-lines')[0];
}

test('the grid select (now inside Image options) defaults to "None" — no grid lines rendered, and none listed in the legend', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const gridSelect = gridSelectIn(container);
  assert.ok(gridSelect, 'the grid select control renders');
  assert.equal(gridSelect.value, 'none', 'defaults to "None"');
  assert.equal(gridLineGroupIn(container), undefined, 'no grid-lines group when "None" is selected');
});

test('selecting a grid spacing draws lines on the diagram and lists Grid in the legend; "None" removes both', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const gridSelect = gridSelectIn(container);
  gridSelect.value = 'mrad-0.1';
  fireEvent(gridSelect, 'change');
  assert.ok(gridLineGroupIn(container), 'grid-lines group renders');
  const legendTable = findByClass(container, 'rp-legend-table')[0];
  assert.ok(legendTable.textContent.includes(t('riflePrecision.legendGrid')));

  gridSelect.value = 'none';
  fireEvent(gridSelect, 'change');
  assert.equal(gridLineGroupIn(container), undefined, 'grid-lines group removed once switched back to "None"');
  assert.ok(!legendTable.textContent.includes(t('riflePrecision.legendGrid')));
});

test('report input settings (results unit, Numbers-table show toggles, grid, hit-probability slider, Image options checkboxes) survive navigating away and back', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container1 = makeElement('main');
  const cleanup1 = analysisView.mount(container1);

  const resultsUnitSelect = findByTag(container1, 'SELECT').find((s) => s.id === 'riflePrecisionResultsUnit');
  resultsUnitSelect.value = 'mrad';
  fireEvent(resultsUnitSelect, 'change');

  const sigmaCheckbox = checkboxInRow(numbersRowByDescriptionKey(container1, 'riflePrecision.stdDeviationDescription'));
  sigmaCheckbox.checked = true;
  fireEvent(sigmaCheckbox, 'change');

  const r95Checkbox = checkboxInRow(numbersRowByDescriptionKey(container1, 'riflePrecision.r95Description'));
  r95Checkbox.checked = false;
  fireEvent(r95Checkbox, 'change');

  const gridSelect = gridSelectIn(container1);
  gridSelect.value = 'mrad-0.1';
  fireEvent(gridSelect, 'change');

  const scaleCheckbox = checkboxByLabelKey(container1, 'riflePrecision.scaleLabel');
  scaleCheckbox.checked = true;
  fireEvent(scaleCheckbox, 'change');

  const includeLegendCheckbox = checkboxByLabelKey(container1, 'riflePrecision.includeLegendCheckboxLabel');
  includeLegendCheckbox.checked = false;
  fireEvent(includeLegendCheckbox, 'change');

  const slider = findByTag(container1, 'INPUT').find((i) => i.type === 'range');
  slider.value = '42';
  fireEvent(slider, 'input');

  cleanup1();

  // Simulates navigating away and back — a second, independent mount.
  const container2 = makeElement('main');
  analysisView.mount(container2);

  assert.equal(findByTag(container2, 'SELECT').find((s) => s.id === 'riflePrecisionResultsUnit').value, 'mrad');
  assert.equal(checkboxInRow(numbersRowByDescriptionKey(container2, 'riflePrecision.stdDeviationDescription')).checked, true);
  assert.equal(checkboxInRow(numbersRowByDescriptionKey(container2, 'riflePrecision.r95Description')).checked, false);
  assert.equal(gridSelectIn(container2).value, 'mrad-0.1');
  assert.equal(checkboxByLabelKey(container2, 'riflePrecision.scaleLabel').checked, true);
  assert.equal(checkboxByLabelKey(container2, 'riflePrecision.includeLegendCheckboxLabel').checked, false);
  assert.equal(findByTag(container2, 'INPUT').find((i) => i.type === 'range').value, '42');
});

test('a fresh first-ever visit (nothing saved yet) still gets the hardcoded defaults, including "Save legend" now on by default', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  assert.equal(findByTag(container, 'SELECT').find((s) => s.id === 'riflePrecisionResultsUnit').value, 'absolute');
  assert.equal(checkboxInRow(numbersRowByDescriptionKey(container, 'riflePrecision.r95Description')).checked, true);
  assert.equal(gridSelectIn(container).value, 'none');
  assert.equal(checkboxByLabelKey(container, 'riflePrecision.includeLegendCheckboxLabel').checked, true);
});

test('CSV export downloads the right header and one row per pooled shot', async () => {
  const project = makeAnalyzableProject();
  const stats = computeCombinedStats(project);
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let capturedBlob = null;
  URL.createObjectURL = (blob) => { capturedBlob = blob; return 'blob:mock'; };
  URL.revokeObjectURL = () => {};
  try {
    fireEvent(buttonByKey(container, 'riflePrecision.exportCsvButton'), 'click');
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }

  assert.ok(capturedBlob, 'a Blob was constructed for download');
  const csvText = await capturedBlob.text();
  const lines = csvText.split('\r\n');
  assert.equal(lines[0], 'ShotX,ShotY,Target,Group,Distance,Description');
  assert.equal(lines.length, 1 + stats.pooledShots.length, 'header plus one row per pooled shot');
  assert.ok(lines[1].includes('T1'), 'target name column');
  assert.ok(lines[1].includes('Home Range'), 'project name in the description column');
});

test('the "Export target image" button is gone — its functionality is covered elsewhere; only CSV export remains in the bottom actions row', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  assert.equal(buttonByKey(container, 'riflePrecision.exportPhotoButton'), undefined);
  assert.ok(buttonByKey(container, 'riflePrecision.exportCsvButton'), 'CSV export unchanged: still a full labeled button');

  const actionsRow = findByClass(container, 'arsenal-form-actions')[0];
  assert.ok(actionsRow);
  assert.equal(findByTag(actionsRow, 'BUTTON').length, 1, 'only CSV export remains');
});

test('SVG export ("Save image") is an icon-only download-button control, placed next to the "Aggregate results" heading', () => {
  const project = makeAnalyzableProject();
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const iconButtons = findByClass(container, 'icon-button');
  assert.equal(iconButtons.length, 1, 'exactly one icon-only download button (SVG export)');
  const svgExportButton = iconButtons[0];
  assert.equal(svgExportButton.getAttribute('title'), t('riflePrecision.exportSvgButton'));

  const headerRow = findByClass(container, 'card-header-row').find((row) => containsNode(row, svgExportButton));
  assert.ok(headerRow, 'SVG export button lives inside a card-header-row');
  const headingInRow = findByTag(headerRow, 'H2')[0];
  assert.equal(headingInRow.textContent, t('riflePrecision.aggregateResultsHeading'));
  const diagramCard = findByClass(container, 'rp-diagram-card')[0];
  assert.ok(containsNode(diagramCard, svgExportButton), 'the header row sits inside the diagram card itself');
});

test('the diagram viewBox is centered on POI, not the origin/POA, for an off-origin project', () => {
  // Asymmetric offsets (mm, POA-relative) so the pooled POI centroid lands
  // away from the origin: average = ((0+4+0+4+2)/5, (0+0+4+4+2)/5) = (2, 2).
  const project = makeAnalyzableProject({}, [[0, 0], [4, 0], [0, 4], [4, 4], [2, 2]]);
  const stats = computeCombinedStats(project);
  assert.equal(stats.status, 'ok');
  assert.ok(Math.abs(stats.poiMm.x - 2) < 1e-9 && Math.abs(stats.poiMm.y - 2) < 1e-9, 'sanity: POI is off-origin');
  setActiveProjectId(project.id);
  const container = makeElement('main');
  analysisView.mount(container);

  const svgNode = findByAttr(container, 'class', 'rp-diagram-svg')[0];
  assert.ok(svgNode, 'diagram svg renders');
  const [minX, minY, width, height] = svgNode.getAttribute('viewBox').split(' ').map(Number);

  assert.ok(Math.abs((minX + width / 2) - stats.poiMm.x) < 1e-9, 'viewBox x-center is POI.x');
  assert.ok(Math.abs((minY + height / 2) - stats.poiMm.y) < 1e-9, 'viewBox y-center is POI.y');
  assert.equal(width, height, 'square viewBox');
});
