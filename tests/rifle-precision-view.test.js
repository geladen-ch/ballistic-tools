import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb, fireEvent } from './helpers/fake-dom.js';

installFakeDom();
installFakeIndexedDb();

const { makeElement } = await import('./helpers/fake-dom.js');
const { initI18n, t } = await import('../src/i18n.js');
await initI18n();

const riflePrecisionView = await import('../src/views/rifle-precision-view.js');
const {
  loadRiflePrecisionProjects, saveRiflePrecisionProject, resetRiflePrecisionLibraryForTests
} = await import('../src/rifle-precision-library.js');
const { generateUserId } = await import('../src/user-library.js');
const { getActiveProjectId, takePendingMarking, resetRiflePrecisionNavForTests } = await import('../src/rifle-precision-nav.js');

test.beforeEach(async () => {
  await resetRiflePrecisionLibraryForTests();
  resetRiflePrecisionNavForTests();
  location.hash = '';
  global.confirm = () => true;
});

function settle(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unsavedBadgeIn(rowInfoOrRow) {
  return findByTag(rowInfoOrRow, 'SPAN').find((s) => s.className === 'unsaved-badge');
}

function fakeExportFile({ projects = [] }) {
  const payload = { format: 'ebalka2-rifle-precision', version: 1, exportedAt: new Date().toISOString(), projects };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function findInputs(node, out = []) {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName)) out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

function byId(node, id) {
  return findInputs(node).find((n) => n.id === id);
}

function findAnyById(node, id) {
  if (node.id === id) return node;
  for (const child of node.childNodes || []) {
    const found = findAnyById(child, id);
    if (found) return found;
  }
  return undefined;
}

function buttonByKey(node, key) {
  return findByTag(node, 'BUTTON').find((b) => b.getAttribute('data-i18n') === key);
}

function findByClass(node, cls, out = []) {
  if ((node.className || '').split(' ').includes(cls)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, cls, out);
  return out;
}

function rowByText(container, text) {
  return findByClass(container, 'arsenal-row').find((r) => r.textContent.includes(text));
}

function isHidden(node) {
  let n = node;
  while (n) {
    if (n.style && n.style.display === 'none') return true;
    n = n.parentNode;
  }
  return false;
}

function makeTestProject(overrides = {}) {
  return {
    id: generateUserId('rp-project'), name: 'Home Range', distanceM: 100, caliberMm: 7.62,
    targets: [], createdAt: new Date().toISOString(), ...overrides
  };
}

function makeTestTarget(overrides = {}) {
  return {
    id: generateUserId('rp-target'), name: null, notes: null,
    photo: 'data:image/jpeg;base64,AAA', photoWidth: 1000, photoHeight: 800, photoFilename: null,
    calibration: { point1: null, point2: null, realLengthMm: null },
    groups: [],
    ...overrides
  };
}

test('mount() builds a DOM tree, showing "No projects" when the library is empty', () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);
  assert.ok(container.childNodes.length > 0);
  assert.ok(container.textContent.includes(t('riflePrecision.noProjects')));
});

test('adding a project via the form saves it and shows it in the list', () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(buttonByKey(container, 'riflePrecision.addProjectButton'), 'click');
  byId(container, 'riflePrecisionProjectName').value = 'My Range';
  fireEvent(byId(container, 'riflePrecisionProjectName'), 'input');
  fireEvent(buttonByKey(container, 'riflePrecision.saveProjectButton'), 'click');

  const stored = loadRiflePrecisionProjects();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].name, 'My Range');
  assert.ok(container.textContent.includes('My Range'));
});

test('a project name is required — saving a blank name does nothing', () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(buttonByKey(container, 'riflePrecision.addProjectButton'), 'click');
  fireEvent(buttonByKey(container, 'riflePrecision.saveProjectButton'), 'click');

  assert.equal(loadRiflePrecisionProjects().length, 0);
});

test('the project form uses the standard caliber input (designation dropdown + manual entry), and it round-trips to caliberMm', () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(buttonByKey(container, 'riflePrecision.addProjectButton'), 'click');
  byId(container, 'riflePrecisionProjectName').value = 'Caliber Test';
  fireEvent(byId(container, 'riflePrecisionProjectName'), 'input');
  assert.ok(byId(container, 'bulletCaliber'), 'expected the standard caliber designation <select>');
  const caliberInput = byId(container, 'bulletCaliberMm');
  assert.ok(caliberInput, 'expected the standard caliber manual-entry <input>');
  caliberInput.value = '6.5';
  fireEvent(caliberInput, 'input');
  fireEvent(buttonByKey(container, 'riflePrecision.saveProjectButton'), 'click');

  const stored = loadRiflePrecisionProjects();
  assert.equal(stored.length, 1);
  assert.ok(Math.abs(stored[0].caliberMm - 6.5) < 1e-6);
});

test('"Add project" is hidden while its own form is open, visible again after Cancel', () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  assert.ok(buttonByKey(container, 'riflePrecision.addProjectButton'));
  fireEvent(buttonByKey(container, 'riflePrecision.addProjectButton'), 'click');
  assert.equal(buttonByKey(container, 'riflePrecision.addProjectButton'), undefined);
  fireEvent(buttonByKey(container, 'riflePrecision.cancelButton'), 'click');
  assert.ok(buttonByKey(container, 'riflePrecision.addProjectButton'));
});

test('clicking an inactive project row activates it — revealing its Targets section, Edit and Delete buttons', () => {
  const project = saveRiflePrecisionProject(makeTestProject());
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  assert.ok(!container.textContent.includes(t('riflePrecision.targetsHeading')), 'no project active by default');
  assert.equal(buttonByKey(rowByText(container, 'Home Range'), 'riflePrecision.editButton'), undefined, 'no Edit button while inactive');
  assert.equal(buttonByKey(rowByText(container, 'Home Range'), 'riflePrecision.deleteButton'), undefined, 'no Delete button while inactive');

  fireEvent(rowByText(container, 'Home Range'), 'click');

  assert.equal(getActiveProjectId(), project.id);
  assert.ok(container.textContent.includes(t('riflePrecision.targetsHeading')));
  assert.ok(buttonByKey(rowByText(container, 'Home Range'), 'riflePrecision.editButton'), 'Edit button appears once active');
  assert.ok(buttonByKey(rowByText(container, 'Home Range'), 'riflePrecision.deleteButton'), 'Delete button appears once active');
});

test('an inactive project shows only a summary — no action buttons and no target list', () => {
  const target = makeTestTarget({ name: 'Alpha' });
  saveRiflePrecisionProject(makeTestProject({ name: 'Backup Range', targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const row = rowByText(container, 'Backup Range');
  assert.ok(row, 'the summary row still renders');
  assert.equal(findByTag(row, 'BUTTON').length, 0, 'no action buttons on an inactive project row');
  assert.ok(!container.textContent.includes('Alpha'), 'target list not shown for an inactive project');
});

function makeUsableTarget(overrides = {}) {
  return makeTestTarget({
    calibration: { point1: { x: 0.1, y: 0.5 }, point2: { x: 0.9, y: 0.5 }, realLengthMm: 200 },
    groups: [{ id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.51, y: 0.49 }] }],
    ...overrides
  });
}

test('a project with no targets shows the red "no usable targets found" hint', () => {
  saveRiflePrecisionProject(makeTestProject({ name: 'Empty Range' }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const row = rowByText(container, 'Empty Range');
  const hint = findByClass(row, 'warning')[0];
  assert.ok(hint, 'the red hint renders even with zero targets');
  assert.equal(hint.textContent, t('riflePrecision.noUsableTargetsHint'));
  assert.equal(findByClass(row, 'caution').length, 0, 'not also the amber one');
});

test('a project where every target is usable shows no usability hint', () => {
  saveRiflePrecisionProject(makeTestProject({ name: 'Clean Range', targets: [makeUsableTarget({ name: 'A' })] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const row = rowByText(container, 'Clean Range');
  assert.equal(findByClass(row, 'caution').length, 0);
  assert.equal(findByClass(row, 'warning').length, 0);
});

test('a project with a mix of usable and unusable targets shows the amber "unusable targets present" hint, on both active and inactive rows', () => {
  const project = saveRiflePrecisionProject(makeTestProject({
    name: 'Mixed Range',
    targets: [makeUsableTarget({ name: 'Good' }), makeTestTarget({ name: 'Bad' })]
  }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const inactiveHint = findByClass(rowByText(container, 'Mixed Range'), 'caution')[0];
  assert.ok(inactiveHint, 'shown while inactive');
  assert.equal(inactiveHint.textContent, t('riflePrecision.unusableTargetsPresentHint'));

  fireEvent(rowByText(container, 'Mixed Range'), 'click');
  const activeHint = findByClass(rowByText(container, project.name), 'caution')[0];
  assert.ok(activeHint, 'still shown once active');
  assert.equal(activeHint.textContent, t('riflePrecision.unusableTargetsPresentHint'));
});

test('a project where no target is usable shows the red "no usable targets found" hint', () => {
  saveRiflePrecisionProject(makeTestProject({ name: 'Broken Range', targets: [makeTestTarget({ name: 'Bad' })] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const hint = findByClass(rowByText(container, 'Broken Range'), 'warning')[0];
  assert.ok(hint, 'the red hint renders');
  assert.equal(hint.textContent, t('riflePrecision.noUsableTargetsHint'));
  assert.equal(findByClass(rowByText(container, 'Broken Range'), 'caution').length, 0, 'not also the amber one');
});

test('the active project is always shown first, ahead of inactive projects sorted latest-modified first', async () => {
  saveRiflePrecisionProject(makeTestProject({ name: 'Older' }));
  await new Promise((r) => setTimeout(r, 5));
  saveRiflePrecisionProject(makeTestProject({ name: 'Newer' }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const namesInOrder = () => findByClass(container, 'arsenal-row')
    .map((row) => row.textContent)
    .filter((text) => text.includes('Older') || text.includes('Newer'))
    .map((text) => (text.includes('Older') ? 'Older' : 'Newer'));

  assert.deepEqual(namesInOrder(), ['Newer', 'Older'], 'newest-modified first while nothing is active');

  fireEvent(rowByText(container, 'Older'), 'click');
  assert.deepEqual(namesInOrder(), ['Older', 'Newer'], 'the now-active project moves ahead of modifiedAt-sorted order');
});

test('editing a project updates its name, distance and caliber', () => {
  const project = saveRiflePrecisionProject(makeTestProject({ name: 'Old Name', distanceM: 100, caliberMm: 5.56 }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, 'Old Name'), 'click');
  fireEvent(buttonByKey(rowByText(container, 'Old Name'), 'riflePrecision.editButton'), 'click');

  byId(container, 'riflePrecisionProjectName').value = 'New Name';
  fireEvent(byId(container, 'riflePrecisionProjectName'), 'input');
  fireEvent(buttonByKey(container, 'riflePrecision.saveProjectButton'), 'click');

  const stored = loadRiflePrecisionProjects().find((p) => p.id === project.id);
  assert.equal(stored.name, 'New Name');
});

test('deleting the active project removes it after confirmation', () => {
  saveRiflePrecisionProject(makeTestProject({ name: 'To Delete' }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, 'To Delete'), 'click');
  global.confirm = () => true;
  fireEvent(buttonByKey(rowByText(container, 'To Delete'), 'riflePrecision.deleteButton'), 'click');

  assert.equal(loadRiflePrecisionProjects().length, 0);
});

test('declining the delete confirmation keeps the project', () => {
  saveRiflePrecisionProject(makeTestProject({ name: 'Keep Me' }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, 'Keep Me'), 'click');
  global.confirm = () => false;
  fireEvent(buttonByKey(rowByText(container, 'Keep Me'), 'riflePrecision.deleteButton'), 'click');

  assert.equal(loadRiflePrecisionProjects().length, 1);
});

test('opening a project reveals its existing targets, with a per-group shot-count summary', () => {
  const group = { id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.6 }] };
  const target = makeTestTarget({ name: 'Alpha', groups: [group] });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');

  assert.ok(container.textContent.includes('Alpha'));
  assert.ok(container.textContent.includes(t('riflePrecision.shotCount', { count: 2 })));
  assert.equal(findByClass(container, 'rp-target-thumb').length, 1);
});

test('a target\'s saved original photo filename is shown in its row', () => {
  const target = makeTestTarget({ name: 'Charlie', photoFilename: 'IMG_0472.jpg' });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');

  assert.ok(rowByText(container, 'Charlie').textContent.includes('IMG_0472.jpg'));
});

test('a target with no saved filename (e.g. one created before this field existed) renders its row without error', () => {
  const target = makeTestTarget({ name: 'Delta', photoFilename: null });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');

  assert.ok(rowByText(container, 'Delta'));
});

test('a target with no groups shows "No groups yet"', () => {
  const target = makeTestTarget({ name: 'Bravo' });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');

  assert.ok(rowByText(container, 'Bravo').textContent.includes(t('riflePrecision.noGroups')));
});

test('a target missing calibration, POA and impacts shows the "Unusable" badge and a red hint listing all three requirements', () => {
  const target = makeTestTarget({ name: 'Echo' }); // default: no calibration, no groups
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');

  const row = rowByText(container, 'Echo');
  const badge = findByClass(row, 'unusable-badge')[0];
  assert.ok(badge, 'the "Unusable" badge renders');
  assert.equal(badge.textContent, t('riflePrecision.unusableBadge'));

  const hint = findByClass(row, 'warning')[0];
  assert.ok(hint, 'a red (.hint.warning) requirements line renders');
  assert.ok((hint.className || '').split(' ').includes('hint'), 'uses the shared .hint.warning red-text class');
  assert.equal(hint.textContent, t('riflePrecision.targetUnusableHint', {
    items: [
      t('riflePrecision.missingCalibrationLabel'),
      t('riflePrecision.missingPoaLabel'),
      t('riflePrecision.missingImpactLabel')
    ].join(', ')
  }));
});

test('a target missing only impacts (calibrated, POA set) shows a hint naming just that one requirement', () => {
  const target = makeTestTarget({
    name: 'Foxtrot',
    calibration: { point1: { x: 0.1, y: 0.5 }, point2: { x: 0.9, y: 0.5 }, realLengthMm: 200 },
    groups: [{ id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [] }]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');

  const row = rowByText(container, 'Foxtrot');
  assert.ok(findByClass(row, 'unusable-badge')[0], 'still unusable — missing an impact');
  const hint = findByClass(row, 'warning')[0];
  assert.equal(hint.textContent, t('riflePrecision.targetUnusableHint', { items: t('riflePrecision.missingImpactLabel') }));
});

test('a fully usable target (calibrated, POA, at least one impact) shows neither the badge nor the hint', () => {
  const target = makeTestTarget({
    name: 'Golf',
    calibration: { point1: { x: 0.1, y: 0.5 }, point2: { x: 0.9, y: 0.5 }, realLengthMm: 200 },
    groups: [{ id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.51, y: 0.49 }] }]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');

  const row = rowByText(container, 'Golf');
  assert.equal(findByClass(row, 'unusable-badge').length, 0, 'no badge once fully usable');
  assert.equal(findByClass(row, 'warning').length, 0, 'no red hint once fully usable');
});

test('clicking "Add target" reveals the inline photo-add flow', () => {
  const project = saveRiflePrecisionProject(makeTestProject());
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');
  fireEvent(buttonByKey(container, 'riflePrecision.addTargetButton'), 'click');

  assert.ok(buttonByKey(container, 'riflePrecision.choosePhotoButton'), 'the photo-add flow is now attached and visible');
});

test('a target row\'s own Edit button is hidden (not removed) — the edit form/mechanism still works when triggered directly', () => {
  const target = makeTestTarget({ name: 'Original' });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');

  const targetEditButton = buttonByKey(rowByText(container, 'Original'), 'riflePrecision.editButton');
  assert.ok(targetEditButton, 'the button node still exists — hidden, not removed');
  assert.ok(isHidden(targetEditButton), 'the target row\'s own Edit button is hidden');

  // The project-level Edit button (a different row entirely) is
  // unaffected — only the per-target trigger is hidden.
  const projectEditButton = buttonByKey(rowByText(container, project.name), 'riflePrecision.editButton');
  assert.ok(projectEditButton, 'project row also has an Edit button');
  assert.ok(!isHidden(projectEditButton), 'the project-level Edit button stays visible');

  // The underlying form/metadata this button used to trigger is still
  // fully wired up — the click listener still fires and the form/save
  // path still works when invoked directly, same as before it was hidden.
  fireEvent(targetEditButton, 'click');
  const nameInput = byId(container, 'riflePrecisionTargetName');
  assert.ok(nameInput, 'the rename form is still attached and functional');
  nameInput.value = 'Renamed';
  fireEvent(nameInput, 'input');
  fireEvent(buttonByKey(container, 'riflePrecision.saveTargetButton'), 'click');

  const stored = loadRiflePrecisionProjects().find((p) => p.id === project.id);
  assert.equal(stored.targets[0].name, 'Renamed');
});

test('deleting a target removes it from its project after confirmation', () => {
  const target = makeTestTarget({ name: 'Doomed' });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');
  global.confirm = () => true;
  fireEvent(buttonByKey(rowByText(container, 'Doomed'), 'riflePrecision.deleteButton'), 'click');

  const stored = loadRiflePrecisionProjects().find((p) => p.id === project.id);
  assert.equal(stored.targets.length, 0);
});

test('"Mark shots" hands off the right project/target context and navigates to the marking route', () => {
  const target = makeTestTarget({ name: 'Charlie' });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');
  fireEvent(buttonByKey(rowByText(container, 'Charlie'), 'riflePrecision.continueMarkingButton'), 'click');

  assert.equal(location.hash, '#/rifle-precision/target');
  assert.deepEqual(takePendingMarking(), { projectId: project.id, targetId: target.id });
});

test('"View report" is hidden on the active project while none of its targets are usable', () => {
  const target = makeTestTarget({ name: 'Echo' }); // unusable by default — no calibration/POA/impact
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');

  assert.equal(buttonByKey(rowByText(container, project.name), 'riflePrecision.viewReportButton'), undefined);
});

test('"View report" appears on the active project once it has a usable target, and navigates to the precision report', () => {
  const target = makeTestTarget({
    name: 'Usable',
    calibration: { point1: { x: 0.1, y: 0.5 }, point2: { x: 0.9, y: 0.5 }, realLengthMm: 200 },
    groups: [{ id: generateUserId('rp-group'), poa: { x: 0.5, y: 0.5 }, shots: [{ x: 0.51, y: 0.49 }] }]
  });
  const project = saveRiflePrecisionProject(makeTestProject({ targets: [target] }));
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(rowByText(container, project.name), 'click');
  const reportButton = buttonByKey(rowByText(container, project.name), 'riflePrecision.viewReportButton');
  assert.ok(reportButton, 'View report shows once at least one target is usable');

  fireEvent(reportButton, 'click');
  assert.equal(location.hash, '#/rifle-precision/analysis');
  assert.equal(getActiveProjectId(), project.id);
});

// === Backup to file / whole-library export & import ===

test('adding a new project with a name that already exists overwrites it (no duplicate), and shows a live warning first', () => {
  const existing = saveRiflePrecisionProject(makeTestProject({ name: 'Same Name' }));

  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(buttonByKey(container, 'riflePrecision.addProjectButton'), 'click');
  const nameInput = byId(container, 'riflePrecisionProjectName');
  nameInput.value = 'Same Name';
  fireEvent(nameInput, 'input');

  const warning = findByTag(container, 'P').find((p) => p.getAttribute && p.getAttribute('data-i18n') === 'riflePrecision.duplicateNameWarning');
  assert.ok(warning);
  assert.equal(warning.style.display, '');

  fireEvent(buttonByKey(container, 'riflePrecision.saveProjectButton'), 'click');

  const projects = loadRiflePrecisionProjects();
  assert.equal(projects.length, 1, 'a name collision must overwrite, not duplicate');
  assert.equal(projects[0].id, existing.id, 'the original id is preserved (referential integrity for anything pointing at it)');
  assert.equal(getActiveProjectId(), existing.id, 'the merged project must become active');
});

test('a freshly saved project shows the "Not backed up" badge; its own "Backup to file" click clears it', () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(buttonByKey(container, 'riflePrecision.addProjectButton'), 'click');
  byId(container, 'riflePrecisionProjectName').value = 'New Project';
  fireEvent(byId(container, 'riflePrecisionProjectName'), 'input');
  fireEvent(buttonByKey(container, 'riflePrecision.saveProjectButton'), 'click');

  assert.equal(loadRiflePrecisionProjects()[0].unsaved, true);
  let row = rowByText(container, 'New Project');
  assert.ok(unsavedBadgeIn(row), 'expected the Not-backed-up badge on a just-created project');

  const saveToFileButton = buttonByKey(row, 'riflePrecision.saveToFileButton');
  fireEvent(saveToFileButton, 'click');

  assert.equal(loadRiflePrecisionProjects()[0].unsaved, false, 'exporting must clear unsaved');
  row = rowByText(container, 'New Project');
  assert.equal(unsavedBadgeIn(row), undefined, 'the badge must disappear once exported');
});

test('"Backup library to file…" opens a selection dialog; excluding an item from the selection leaves it unsaved', () => {
  saveRiflePrecisionProject(makeTestProject({ name: 'Project A' }));
  const b = saveRiflePrecisionProject(makeTestProject({ name: 'Project B' }));

  const container = makeElement('main');
  riflePrecisionView.mount(container);

  fireEvent(findAnyById(container, 'rifle-precision-save-library'), 'click');

  const exportCheckbox = byId(container, `export-rp-project-${b.id}`);
  assert.ok(exportCheckbox, 'expected the selection dialog to list both projects');
  exportCheckbox.checked = false;
  fireEvent(exportCheckbox, 'change');

  const exportButton = buttonByKey(container, 'riflePrecision.exportButton');
  fireEvent(exportButton, 'click');

  const projects = loadRiflePrecisionProjects();
  assert.equal(projects.find((p) => p.name === 'Project A').unsaved, false, 'the checked project should be marked saved');
  assert.equal(projects.find((p) => p.name === 'Project B').unsaved, true, 'the unchecked project should stay unsaved');
  // The dialog closes after exporting.
  assert.equal(byId(container, `export-rp-project-${b.id}`), undefined);
});

test('"Backup library to file…" can be cancelled without marking anything saved', () => {
  saveRiflePrecisionProject(makeTestProject({ name: 'Project A' }));

  const container = makeElement('main');
  riflePrecisionView.mount(container);
  fireEvent(findAnyById(container, 'rifle-precision-save-library'), 'click');

  const cancelButton = buttonByKey(container, 'riflePrecision.cancelButton');
  fireEvent(cancelButton, 'click');

  assert.equal(loadRiflePrecisionProjects()[0].unsaved, true);
});

test('picking a valid export file opens the import dialog listing its contents', async () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({ projects: [{ id: 'file-p1', name: 'Imported Project' }] })];
  fireEvent(input, 'change');
  await settle();

  assert.ok(byId(container, 'import-rp-project-file-p1'), 'expected the imported project to be listed');
});

test('picking an invalid (non-JSON) file shows a translated error instead of opening the dialog', async () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [new Blob(['not json {{{'], { type: 'application/json' })];
  fireEvent(input, 'change');
  await settle();

  assert.ok(container.textContent.includes(t('riflePrecision.importFileErrorInvalidJson')));
});

test('picking well-formed JSON that isn\'t a Rifle Precision export shows the "wrong format" error', async () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [new Blob([JSON.stringify({ hello: 'world' })], { type: 'application/json' })];
  fireEvent(input, 'change');
  await settle();

  assert.ok(container.textContent.includes(t('riflePrecision.importFileErrorInvalidFormat')));
});

test('importing a new project (no conflicts) adds it to the library, unsaved, with modifiedAt/createdAt preserved from the file', async () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const importedAt = '2020-05-01T00:00:00.000Z';
  const createdAt = '2019-01-01T00:00:00.000Z';
  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({
    projects: [{
      id: 'file-p1', name: 'Imported Project', distanceM: 100, caliberMm: 6.5, targets: [],
      createdAt, modifiedAt: importedAt
    }]
  })];
  fireEvent(input, 'change');
  await settle();

  const importButton = buttonByKey(container, 'riflePrecision.importButton');
  fireEvent(importButton, 'click');

  const projects = loadRiflePrecisionProjects();
  assert.equal(projects.length, 1);
  assert.equal(projects[0].name, 'Imported Project');
  assert.equal(projects[0].modifiedAt, importedAt, 'import must preserve the file\'s own modifiedAt');
  assert.equal(projects[0].createdAt, createdAt, 'import must preserve the file\'s own createdAt');
  assert.equal(projects[0].unsaved, true, 'an import is a local modification with no export of its own yet');

  assert.ok(container.textContent.includes(t('riflePrecision.importSummary', { saved: 1, skipped: 0 })));
});

test('importing over a same-named existing project in "overwrite" mode replaces it in place', async () => {
  saveRiflePrecisionProject(makeTestProject({ id: 'local-p1', name: 'My Project', distanceM: 100, caliberMm: 5.56 }));

  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({
    projects: [{ id: 'file-p1', name: 'My Project', distanceM: 300, caliberMm: 6.5, targets: [] }]
  })];
  fireEvent(input, 'change');
  await settle();

  const modeSelect = byId(container, 'import-rp-project-conflict-mode');
  modeSelect.value = 'overwrite';
  fireEvent(modeSelect, 'change');

  const importButton = buttonByKey(container, 'riflePrecision.importButton');
  fireEvent(importButton, 'click');

  const projects = loadRiflePrecisionProjects();
  assert.equal(projects.length, 1, 'must overwrite, not duplicate');
  assert.equal(projects[0].id, 'local-p1');
  assert.equal(projects[0].distanceM, 300);
});

test('importing over a same-named existing project in "rename" mode keeps both, auto-naming the import', async () => {
  saveRiflePrecisionProject(makeTestProject({ id: 'local-p1', name: 'My Project' }));

  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({
    projects: [{ id: 'file-p1', name: 'My Project', distanceM: 300, caliberMm: 6.5, targets: [] }]
  })];
  fireEvent(input, 'change');
  await settle();

  const modeSelect = byId(container, 'import-rp-project-conflict-mode');
  modeSelect.value = 'rename';
  fireEvent(modeSelect, 'change');

  const importButton = buttonByKey(container, 'riflePrecision.importButton');
  fireEvent(importButton, 'click');

  const projects = loadRiflePrecisionProjects();
  assert.equal(projects.length, 2, 'both the original and the renamed import should exist');
  assert.ok(projects.some((p) => p.name === 'My Project' && p.distanceM !== 300));
  assert.ok(projects.some((p) => p.name === 'My Project - copy (1)' && p.distanceM === 300));
});

test('importing in "overwrite if newer" mode skips an older conflicting item', async () => {
  saveRiflePrecisionProject(makeTestProject({ id: 'local-p1', name: 'My Project', distanceM: 100 }));
  const localModifiedAt = loadRiflePrecisionProjects()[0].modifiedAt;

  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({
    projects: [{
      id: 'file-p1', name: 'My Project', distanceM: 300, caliberMm: 6.5, targets: [],
      modifiedAt: '2000-01-01T00:00:00.000Z' // long before localModifiedAt
    }]
  })];
  fireEvent(input, 'change');
  await settle();

  const modeSelect = byId(container, 'import-rp-project-conflict-mode');
  modeSelect.value = 'overwriteIfNewer';
  fireEvent(modeSelect, 'change');

  const importButton = buttonByKey(container, 'riflePrecision.importButton');
  fireEvent(importButton, 'click');

  const projects = loadRiflePrecisionProjects();
  assert.equal(projects.length, 1);
  assert.equal(projects[0].distanceM, 100, 'an older import must not overwrite a newer local entry');
  assert.equal(projects[0].modifiedAt, localModifiedAt);
  assert.ok(container.textContent.includes(t('riflePrecision.importSummary', { saved: 0, skipped: 1 })));
});

test('"Load backup from file…" import can be cancelled from the import dialog without importing anything', async () => {
  const container = makeElement('main');
  riflePrecisionView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({ projects: [{ id: 'file-p1', name: 'Imported Project' }] })];
  fireEvent(input, 'change');
  await settle();

  const cancelButton = buttonByKey(container, 'riflePrecision.cancelButton');
  fireEvent(cancelButton, 'click');

  assert.deepEqual(loadRiflePrecisionProjects(), []);
  assert.equal(byId(container, 'import-rp-project-file-p1'), undefined, 'the dialog should be closed');
});
