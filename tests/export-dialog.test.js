import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
const { exportDialog } = await import('../src/ui/arsenal/export-dialog.js');

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

const bullets = [
  { id: 'b1', name: 'Bullet One' },
  { id: 'b2', name: 'Bullet Two' }
];
const rifles = [
  { id: 'r1', name: 'Rifle One', cartridges: [{ id: 'c1', bulletId: 'b1' }, { id: 'c2', bulletId: 'built-in-not-in-library' }] },
  { id: 'r2', name: 'Rifle Two', cartridges: [] }
];

test('every bullet and rifle is checked by default', () => {
  const dialog = exportDialog({ bullets, rifles, onExport: () => {}, onCancel: () => {} });
  assert.equal(byId(dialog.node, 'export-bullet-b1').checked, true);
  assert.equal(byId(dialog.node, 'export-bullet-b2').checked, true);
  assert.equal(byId(dialog.node, 'export-rifle-r1').checked, true);
  assert.equal(byId(dialog.node, 'export-rifle-r2').checked, true);
});

test('clicking Export with everything checked reports every bullet and rifle id', () => {
  let reported = null;
  const dialog = exportDialog({ bullets, rifles, onExport: (sel) => { reported = sel; }, onCancel: () => {} });
  const exportButton = findByTag(dialog.node, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.exportButton');
  fireEvent(exportButton, 'click');
  assert.deepEqual(reported.bulletIds.sort(), ['b1', 'b2']);
  assert.deepEqual(reported.rifleIds.sort(), ['r1', 'r2']);
});

test('unchecking a bullet excludes it from the reported selection', () => {
  let reported = null;
  const dialog = exportDialog({ bullets, rifles, onExport: (sel) => { reported = sel; }, onCancel: () => {} });
  const bulletCheckbox = byId(dialog.node, 'export-bullet-b2');
  bulletCheckbox.checked = false;
  fireEvent(bulletCheckbox, 'change');

  const exportButton = findByTag(dialog.node, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.exportButton');
  fireEvent(exportButton, 'click');
  assert.deepEqual(reported.bulletIds, ['b1']);
});

test('unchecking then re-checking a rifle re-selects the bullets its cartridges reference', () => {
  const dialog = exportDialog({ bullets, rifles, onExport: () => {}, onCancel: () => {} });
  const bulletCheckbox = byId(dialog.node, 'export-bullet-b1');
  const rifleCheckbox = byId(dialog.node, 'export-rifle-r1');

  bulletCheckbox.checked = false;
  fireEvent(bulletCheckbox, 'change');
  assert.equal(bulletCheckbox.checked, false);

  // Unchecking the rifle itself must not force the bullet back on.
  rifleCheckbox.checked = false;
  fireEvent(rifleCheckbox, 'change');
  assert.equal(bulletCheckbox.checked, false, 'unchecking a rifle should not cascade');

  // Checking it (again) does cascade.
  rifleCheckbox.checked = true;
  fireEvent(rifleCheckbox, 'change');
  assert.equal(bulletCheckbox.checked, true, 'checking a rifle should re-select its bullets');
});

test('unchecking a bullet a checked rifle depends on automatically unchecks that rifle too', () => {
  const dialog = exportDialog({ bullets, rifles, onExport: () => {}, onCancel: () => {} });
  const bulletCheckbox = byId(dialog.node, 'export-bullet-b1');
  const rifleCheckbox = byId(dialog.node, 'export-rifle-r1');
  assert.equal(rifleCheckbox.checked, true);

  bulletCheckbox.checked = false;
  fireEvent(bulletCheckbox, 'change');

  assert.equal(rifleCheckbox.checked, false, 'a rifle can\'t be usefully exported without a bullet it depends on');
});

test('unchecking a bullet shared by multiple rifles unchecks every one of them', () => {
  const sharedBullets = [{ id: 'b1', name: 'Shared Bullet' }];
  const sharedRifles = [
    { id: 'r1', name: 'Rifle One', cartridges: [{ id: 'c1', bulletId: 'b1' }] },
    { id: 'r2', name: 'Rifle Two', cartridges: [{ id: 'c2', bulletId: 'b1' }] }
  ];
  const dialog = exportDialog({ bullets: sharedBullets, rifles: sharedRifles, onExport: () => {}, onCancel: () => {} });
  const bulletCheckbox = byId(dialog.node, 'export-bullet-b1');

  bulletCheckbox.checked = false;
  fireEvent(bulletCheckbox, 'change');

  assert.equal(byId(dialog.node, 'export-rifle-r1').checked, false);
  assert.equal(byId(dialog.node, 'export-rifle-r2').checked, false);
});

test('a bullet required by a checked rifle is enforced round-trip: checking the rifle re-includes it, unchecking the bullet excludes the rifle again', () => {
  let reported = null;
  const dialog = exportDialog({ bullets, rifles, onExport: (sel) => { reported = sel; }, onCancel: () => {} });
  const bulletCheckbox = byId(dialog.node, 'export-bullet-b1');
  const rifleCheckbox = byId(dialog.node, 'export-rifle-r1');

  // Exclude the bullet — its dependent rifle goes with it.
  bulletCheckbox.checked = false;
  fireEvent(bulletCheckbox, 'change');
  assert.equal(rifleCheckbox.checked, false);

  // Re-checking the rifle brings the bullet back.
  rifleCheckbox.checked = true;
  fireEvent(rifleCheckbox, 'change');
  assert.equal(bulletCheckbox.checked, true);

  const exportButton = findByTag(dialog.node, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.exportButton');
  fireEvent(exportButton, 'click');
  assert.ok(reported.bulletIds.includes('b1'));
  assert.ok(reported.rifleIds.includes('r1'));
});

test('a rifle referencing a bullet not in the user library (e.g. a stray built-in id) is unaffected — cascade only touches known user bullets', () => {
  const dialog = exportDialog({ bullets, rifles, onExport: () => {}, onCancel: () => {} });
  const rifleCheckbox = byId(dialog.node, 'export-rifle-r1');
  assert.doesNotThrow(() => fireEvent(rifleCheckbox, 'change'));
});

test('clicking Cancel calls onCancel', () => {
  let cancelled = false;
  const dialog = exportDialog({ bullets, rifles, onExport: () => {}, onCancel: () => { cancelled = true; } });
  const cancelButton = findByTag(dialog.node, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.cancelButton');
  fireEvent(cancelButton, 'click');
  assert.equal(cancelled, true);
});

test('an empty library shows the "no bullets"/"no rifles" hints instead of an empty list', () => {
  const dialog = exportDialog({ bullets: [], rifles: [], onExport: () => {}, onCancel: () => {} });
  const hints = findByTag(dialog.node, 'P').map((p) => p.getAttribute('data-i18n'));
  assert.ok(hints.includes('arsenal.noBullets'));
  assert.ok(hints.includes('arsenal.noRifles'));
});
