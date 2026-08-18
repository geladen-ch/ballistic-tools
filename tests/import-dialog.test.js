import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
const { importDialog } = await import('../src/ui/arsenal/import-dialog.js');

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT' || node.tagName === 'SELECT') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}
function byId(node, id) {
  return findInputs(node).find((n) => n.id === id);
}
function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

const fileBullets = [
  { id: 'file-b1', name: 'Bullet One', modifiedAt: '2021-01-01T00:00:00.000Z' }, // no conflict
  { id: 'file-b2', name: 'Existing Bullet', modifiedAt: '2021-06-01T00:00:00.000Z' } // conflicts, newer
];
const fileRifles = [
  { id: 'file-r1', name: 'Rifle One', cartridges: [{ id: 'c1', bulletId: 'file-b1' }] }
];
const existingBullets = [
  { id: 'local-b2', name: 'Existing Bullet', modifiedAt: '2020-01-01T00:00:00.000Z' }
];
const existingRifles = [];

test('every item is checked by default (import everything unless excluded)', () => {
  const dialog = importDialog({ bullets: fileBullets, rifles: fileRifles, existingBullets, existingRifles, onImport: () => {}, onCancel: () => {} });
  assert.equal(byId(dialog.node, 'import-bullet-file-b1').checked, true);
  assert.equal(byId(dialog.node, 'import-bullet-file-b2').checked, true);
  assert.equal(byId(dialog.node, 'import-rifle-file-r1').checked, true);
});

test('a conflicting item shows a badge naming the comparison; a non-conflicting one shows none', () => {
  const dialog = importDialog({ bullets: fileBullets, rifles: fileRifles, existingBullets, existingRifles, onImport: () => {}, onCancel: () => {} });
  const comparison = t('arsenal.importComparisonNewer');
  const expectedBadge = t('arsenal.importConflictBadge', { comparison });

  assert.ok(dialog.node.textContent.includes(expectedBadge), 'expected the conflicting bullet to show a "newer" badge');

  const noConflictLabel = findByTag(dialog.node, 'LABEL').find((l) => l.textContent.startsWith('Bullet One') || l.textContent.includes('Bullet One'));
  assert.ok(noConflictLabel, 'expected a label for the non-conflicting bullet');
  assert.ok(!noConflictLabel.textContent.includes(t('arsenal.importConflictBadge', { comparison: t('arsenal.importComparisonNewer') })));
});

test('clicking Import reports the checked ids and the chosen conflict mode', () => {
  let reported = null;
  const dialog = importDialog({ bullets: fileBullets, rifles: fileRifles, existingBullets, existingRifles, onImport: (r) => { reported = r; }, onCancel: () => {} });

  const modeSelect = byId(dialog.node, 'import-conflict-mode');
  modeSelect.value = 'rename';
  fireEvent(modeSelect, 'change');

  const importButton = findByTag(dialog.node, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.importButton');
  fireEvent(importButton, 'click');

  assert.deepEqual(reported.bulletIds.sort(), ['file-b1', 'file-b2']);
  assert.deepEqual(reported.rifleIds, ['file-r1']);
  assert.equal(reported.mode, 'rename');
});

test('deselecting an item excludes it from the reported import', () => {
  let reported = null;
  const dialog = importDialog({ bullets: fileBullets, rifles: fileRifles, existingBullets, existingRifles, onImport: (r) => { reported = r; }, onCancel: () => {} });

  const bulletCheckbox = byId(dialog.node, 'import-bullet-file-b2');
  bulletCheckbox.checked = false;
  fireEvent(bulletCheckbox, 'change');

  const importButton = findByTag(dialog.node, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.importButton');
  fireEvent(importButton, 'click');

  assert.deepEqual(reported.bulletIds, ['file-b1']);
});

test('checking a rifle re-selects the file bullets its cartridges reference', () => {
  const dialog = importDialog({ bullets: fileBullets, rifles: fileRifles, existingBullets, existingRifles, onImport: () => {}, onCancel: () => {} });
  const bulletCheckbox = byId(dialog.node, 'import-bullet-file-b1');
  const rifleCheckbox = byId(dialog.node, 'import-rifle-file-r1');

  bulletCheckbox.checked = false;
  fireEvent(bulletCheckbox, 'change');
  assert.equal(bulletCheckbox.checked, false);

  rifleCheckbox.checked = false;
  fireEvent(rifleCheckbox, 'change');
  assert.equal(bulletCheckbox.checked, false, 'unchecking a rifle should not cascade');

  rifleCheckbox.checked = true;
  fireEvent(rifleCheckbox, 'change');
  assert.equal(bulletCheckbox.checked, true, 'checking a rifle should re-select its file bullets');
});

test('unchecking a bullet a checked rifle depends on automatically unchecks that rifle too', () => {
  const dialog = importDialog({ bullets: fileBullets, rifles: fileRifles, existingBullets, existingRifles, onImport: () => {}, onCancel: () => {} });
  const bulletCheckbox = byId(dialog.node, 'import-bullet-file-b1');
  const rifleCheckbox = byId(dialog.node, 'import-rifle-file-r1');
  assert.equal(rifleCheckbox.checked, true);

  bulletCheckbox.checked = false;
  fireEvent(bulletCheckbox, 'change');

  assert.equal(rifleCheckbox.checked, false, 'a rifle can\'t be usefully imported without a bullet it depends on');
});

test('unchecking a bullet shared by multiple rifles in the file unchecks every one of them', () => {
  const sharedBullets = [{ id: 'file-b1', name: 'Shared Bullet' }];
  const sharedRifles = [
    { id: 'file-r1', name: 'Rifle One', cartridges: [{ id: 'c1', bulletId: 'file-b1' }] },
    { id: 'file-r2', name: 'Rifle Two', cartridges: [{ id: 'c2', bulletId: 'file-b1' }] }
  ];
  const dialog = importDialog({ bullets: sharedBullets, rifles: sharedRifles, existingBullets: [], existingRifles: [], onImport: () => {}, onCancel: () => {} });

  const bulletCheckbox = byId(dialog.node, 'import-bullet-file-b1');
  bulletCheckbox.checked = false;
  fireEvent(bulletCheckbox, 'change');

  assert.equal(byId(dialog.node, 'import-rifle-file-r1').checked, false);
  assert.equal(byId(dialog.node, 'import-rifle-file-r2').checked, false);
});

test('the mode select defaults to "overwrite" and offers all three modes', () => {
  const dialog = importDialog({ bullets: fileBullets, rifles: fileRifles, existingBullets, existingRifles, onImport: () => {}, onCancel: () => {} });
  const modeSelect = byId(dialog.node, 'import-conflict-mode');
  assert.equal(modeSelect.value, 'overwrite');
  assert.deepEqual(modeSelect.childNodes.map((o) => o.attributes.value), ['overwrite', 'overwriteIfNewer', 'rename']);
});

test('an empty file shows the "no bullets"/"no rifles" import hints', () => {
  const dialog = importDialog({ bullets: [], rifles: [], existingBullets: [], existingRifles: [], onImport: () => {}, onCancel: () => {} });
  const hints = findByTag(dialog.node, 'P').map((p) => p.getAttribute('data-i18n'));
  assert.ok(hints.includes('arsenal.importNoBullets'));
  assert.ok(hints.includes('arsenal.importNoRifles'));
});

test('clicking Cancel calls onCancel', () => {
  let cancelled = false;
  const dialog = importDialog({ bullets: fileBullets, rifles: fileRifles, existingBullets, existingRifles, onImport: () => {}, onCancel: () => { cancelled = true; } });
  const cancelButton = findByTag(dialog.node, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.cancelButton');
  fireEvent(cancelButton, 'click');
  assert.equal(cancelled, true);
});
