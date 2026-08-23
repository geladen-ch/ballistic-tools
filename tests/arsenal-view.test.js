import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();

const { initI18n, t } = await import('../src/i18n.js');
await initI18n();
// See warm-catalogs.js — every await settle() below assumes the built-in
// catalogs are already cache-warm, not racing a cold, contention-prone fetch.
await warmCatalogs();

const arsenalView = await import('../src/views/arsenal-view.js');
const trajectoryView = await import('../src/views/trajectory-view.js');
const gunsView = await import('../src/views/guns-view.js');
const { makeElement } = await import('./helpers/fake-dom.js');
const { loadUserBullets, saveUserBullet, loadUserRifles, saveUserRifle, generateUserId } = await import('../src/user-library.js');
const { setPendingBulletPrefill, setPendingRiflePrefill } = await import('../src/arsenal-prefill.js');
const { resetShotStateForTests, loadRifleState, saveCartridgeState, saveRifleState } = await import('../src/shot-state.js');
const { resetComparisonForTests, getComparisonSelection } = await import('../src/comparison-state.js');
const { requestGunsDone, resetGunsNavForTests } = await import('../src/guns-nav.js');

test.beforeEach(() => {
  localStorage.clear();
  resetShotStateForTests();
  resetComparisonForTests();
  resetGunsNavForTests();
});

function settle(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findByTag(node, tag, out = []) {
  if (node.tagName === tag) out.push(node);
  for (const child of node.childNodes || []) findByTag(child, tag, out);
  return out;
}

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT' || node.tagName === 'SELECT' || node.tagName === 'TEXTAREA') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

// Field lookups (text/number inputs, selects) use this narrower one;
// buttons (Add/Edit/Delete/Save/Cancel) need the tag-agnostic version
// below since they're never INPUT/SELECT.
function byId(node, id) {
  return findInputs(node).find((n) => n.id === id);
}

function findAnyById(node, id) {
  if (node.id === id) return node;
  for (const child of node.childNodes || []) {
    const found = findAnyById(child, id);
    if (found) return found;
  }
  return null;
}

// The rifle list's own Edit button for one specific rifle, found by the
// row's text rather than DOM position — robust regardless of how many
// bullets/rifles are listed, or which of the two cards renders first.
// Edit only ever renders for the *active* rifle (see arsenal-view.js's
// renderActiveRifle()) — callers that need it on a rifle that isn't
// already active must call activateRifleRow() first.
function rifleEditButton(container, rifleName) {
  const row = findByClass(container, 'arsenal-row').find((r) => r.textContent.includes(rifleName));
  return findByTag(row, 'BUTTON').find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.editButton');
}

// Clicks an "Other rifles" row to make it the active rifle — the
// click-to-activate replacement for the old "Set active" button.
// row-clickable is shared with the active rifle's own Cartridges list
// rows, so this is scoped to a row whose text also names the rifle,
// which in practice never collides with a differently-named cartridge.
function activateRifleRow(container, rifleName) {
  const row = findByClass(container, 'row-clickable').find((r) => r.textContent.includes(rifleName));
  fireEvent(row, 'click');
}

function findByClass(node, className, out = []) {
  if ((node.className || '').split(' ').includes(className)) out.push(node);
  for (const child of node.childNodes || []) findByClass(child, className, out);
  return out;
}

// Save/Cancel buttons aren't given ids (see bullet-form.js etc.) — they're
// always the two children of the shared .arsenal-form-actions wrapper.
function formActions(formNode) {
  const [actions] = findByClass(formNode, 'arsenal-form-actions');
  return { saveButton: actions.childNodes[0], cancelButton: actions.childNodes[1] };
}

// The cartridge form's own outer Save/Cancel, specifically — unlike
// formActions() above (which takes the *first* '.arsenal-form-actions' it
// finds, depth-first), this takes the *last* one, since the cartridge
// form's own action row is always its very last child while an embedded
// "Add new bullet" form (see cartridge-form.js) — itself carrying an
// earlier '.arsenal-form-actions' of its own — may or may not currently
// be showing.
function outerCartridgeFormActions(container) {
  const rows = findByClass(container, 'arsenal-form-actions');
  const outer = rows[rows.length - 1];
  return { saveButton: outer.childNodes[0], cancelButton: outer.childNodes[1] };
}

// The bullet select's own "Add new bullet" option (see cartridge-form.js)
// — found by its translated text rather than the module-private constant
// backing its value.
function newBulletOption(container) {
  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  return [...bulletSelect.childNodes].find((o) => o.textContent === t('arsenal.cartridgeAddNewBulletOption'));
}

// The caliber select is required (bullet-form.js) and, unlike every other
// field in these tests, has no meaningful default — its first option is a
// blank placeholder specifically so a form saved without an explicit
// choice fails validation instead of silently taking whichever
// designation happens to render first. Every "add a bullet" test that
// expects the save to actually go through has to pick one, same as a real
// user would.
function selectCaliber(container, designation) {
  const select = byId(container, 'bulletCaliber');
  select.value = designation;
  fireEvent(select, 'change');
}

test('an empty Arsenal shows "no bullets"/"no rifles" hints and Add buttons', () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  assert.ok(findAnyById(container, 'arsenal-add-bullet'));
  assert.ok(findAnyById(container, 'arsenal-add-rifle'));
  const text = container.textContent;
  assert.ok(text.length > 0);
});

test('"Add Bullet"/"Add Rifle" hide together while any add/edit form is open, and reappear once it closes', async () => {
  saveUserRifle({
    id: 'r1', name: 'My Rifle', defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1, cartridges: []
  });
  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  const addBullet = findAnyById(container, 'arsenal-add-bullet');
  const addRifle = findAnyById(container, 'arsenal-add-rifle');
  // Not asserting an exact '' here — a freshly constructed element's
  // style.display in this fake DOM starts out `undefined` (a plain object
  // literal, not a real CSSStyleDeclaration), unlike a real browser's own
  // default of ''. Either way, "not 'none'" is what "visible" actually means.
  assert.notEqual(addBullet.style.display, 'none', 'both visible with no form open');
  assert.notEqual(addRifle.style.display, 'none');

  // Opening the bullet form hides both, not just its own.
  fireEvent(addBullet, 'click');
  await settle();
  assert.equal(addBullet.style.display, 'none');
  assert.equal(addRifle.style.display, 'none', 'the rifle add button hides too — one form open at a time');

  const { cancelButton } = formActions(byId(container, 'arsenalBulletName').parentNode.parentNode);
  fireEvent(cancelButton, 'click');
  assert.notEqual(addBullet.style.display, 'none', 'both reappear once the form closes');
  assert.notEqual(addRifle.style.display, 'none');

  // Editing the active rifle (not just adding) also hides both.
  activateRifleRow(container, 'My Rifle');
  fireEvent(rifleEditButton(container, 'My Rifle'), 'click');
  await settle();
  assert.equal(addBullet.style.display, 'none');
  assert.equal(addRifle.style.display, 'none');

  // Opening the cartridge form (which discards the still-open rifle form
  // — see the mutual-exclusivity tests below) keeps both hidden too.
  fireEvent(findAnyById(container, 'arsenal-add-cartridge'), 'click');
  await settle();
  assert.equal(addBullet.style.display, 'none');
  assert.equal(addRifle.style.display, 'none');
});

// ---- Cross-form mutual exclusivity — only one add/edit form (bullet,
// rifle, or cartridge) is ever open across the whole page at once. ----

test('opening the bullet Edit form closes an already-open rifle Edit form', async () => {
  saveUserRifle({
    id: 'r1', name: 'My Rifle', defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1, cartridges: []
  });
  saveUserBullet({ id: 'b1', name: 'My Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  activateRifleRow(container, 'My Rifle');
  fireEvent(rifleEditButton(container, 'My Rifle'), 'click');
  await settle();
  assert.ok(byId(container, 'arsenalRifleName'), 'expected the rifle Edit form to be open');

  fireEvent(rifleEditButton(container, 'My Bullet'), 'click');
  await settle();

  assert.ok(byId(container, 'arsenalBulletName'), 'expected the bullet Edit form to be open');
  assert.equal(byId(container, 'arsenalRifleName'), undefined, 'the rifle Edit form should have been discarded');
});

test('opening the active rifle\'s Edit form closes an already-open bullet Edit form', async () => {
  saveUserRifle({
    id: 'r1', name: 'My Rifle', defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1, cartridges: []
  });
  saveUserBullet({ id: 'b1', name: 'My Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  fireEvent(rifleEditButton(container, 'My Bullet'), 'click');
  await settle();
  assert.ok(byId(container, 'arsenalBulletName'), 'expected the bullet Edit form to be open');

  activateRifleRow(container, 'My Rifle');
  fireEvent(rifleEditButton(container, 'My Rifle'), 'click');
  await settle();

  assert.ok(byId(container, 'arsenalRifleName'), 'expected the rifle Edit form to be open');
  assert.equal(byId(container, 'arsenalBulletName'), undefined, 'the bullet Edit form should have been discarded');
});

test('opening Add Cartridge on the active rifle closes an already-open bullet Edit form', async () => {
  saveUserRifle({
    id: 'r1', name: 'My Rifle', defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1, cartridges: []
  });
  saveUserBullet({ id: 'b1', name: 'My Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  activateRifleRow(container, 'My Rifle');
  fireEvent(rifleEditButton(container, 'My Bullet'), 'click');
  await settle();
  assert.ok(byId(container, 'arsenalBulletName'), 'expected the bullet Edit form to be open');

  fireEvent(findAnyById(container, 'arsenal-add-cartridge'), 'click');
  await settle();

  assert.ok(byId(container, 'arsenalCartridgeName'), 'expected the cartridge Add form to be open');
  // Not byId(container, 'arsenalBulletName') === undefined — the cartridge
  // form's own "Add new bullet" default (see cartridge-form.js) now opens
  // an *embedded* bullet form reusing that very id, so its mere presence
  // no longer distinguishes "the old top-level Edit form is gone." The
  // top-level Edit form's own heading does, though — only it renders one.
  const editHeading = findByTag(container, 'H2').find((h) => h.getAttribute && h.getAttribute('data-i18n') === 'arsenal.editBulletHeading');
  assert.equal(editHeading, undefined, 'the top-level bullet Edit form should have been discarded');
});

test('adding a bullet persists it and shows it in the list', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  const addButton = findAnyById(container, 'arsenal-add-bullet');
  fireEvent(addButton, 'click');
  await settle();

  byId(container, 'arsenalBulletName').value = 'My Test Bullet';
  fireEvent(byId(container, 'arsenalBulletName'), 'input');
  byId(container, 'arsenalBulletManufacturer').value = 'Acme';
  byId(container, 'massGrams').value = '10.5';
  fireEvent(byId(container, 'massGrams'), 'input');
  selectCaliber(container, '6.5 / .264');

  const form = byId(container, 'arsenalBulletName').parentNode.parentNode; // .field -> input-section
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].name, 'My Test Bullet');
  assert.equal(bullets[0].manufacturer, 'Acme');
  assert.ok(Math.abs(bullets[0].massKg - 0.0105) < 1e-9);
  assert.equal(bullets[0].profile.type, 'bc');
  assert.ok(Math.abs(bullets[0].caliberM - 0.00671) < 1e-9, 'should save exactly the chosen designation\'s caliber, not a default');
});

// Regression test for a real bug: a bullet can carry a slightly different
// (but still real-world plausible) caliberM than caliber-designations.json's
// own entry for the same designation — e.g. a spec sheet's more precise
// 0.0067056m ".264in" figure vs. this table's own "6.5 / .264" entry
// (0.00671) — 4.4e-6 m apart, just outside the bullet form's old, stricter
// match tolerance (1e-6) even though it's well inside designationFor's own
// tolerance (DESIGNATION_TOLERANCE_M in src/bullets.js, 3e-5 as of this
// writing), the one used everywhere else a bullet's caliber is displayed.
// That mismatch meant the caliber <select> silently failed to match
// anything and defaulted to its first option — so copying a bullet like
// this into the user's library (Add to Arsenal, or opening it in Arsenal's
// own bullet form at all) silently corrupted its caliber to whatever
// happened to be listed first. bullet-form.js now reuses designationFor()
// itself so both paths agree.
test('a bullet whose stored caliberM is a near-but-not-exact match still resolves to the right designation, not the select\'s first option', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({
    id, name: 'Copied 6.5mm Bullet', manufacturer: 'Lapua', caliberM: 0.0067056, massKg: 0.0088,
    profile: { type: 'bc', bc: 0.62, model: 'G7' }
  });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  const editButtons = findByTag(container, 'BUTTON').filter((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.editButton');
  fireEvent(editButtons[0], 'click');
  await settle();

  assert.equal(byId(container, 'bulletCaliber').value, '6.5 / .264', 'the near-exact stored value should still match the "6.5 / .264" designation');

  const form = byId(container, 'arsenalBulletName').parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1, 'editing must not create a second entry');
  // Re-saving always writes back the matched designation's own canonical
  // caliberM (0.00671), not the original 0.0067056 — expected and
  // harmless (same real bore diameter, see bullet-form.js). What matters
  // for this regression test is that it's still recognizably "6.5 / .264"
  // and not silently corrupted to whatever the select's first option is.
  assert.ok(Math.abs(bullets[0].caliberM - 0.00671) < 1e-9, 'saving without touching the caliber must not silently rewrite it to the wrong designation');
});

test('saving the bullet form without choosing a caliber is blocked, with a specific error', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  const addButton = findAnyById(container, 'arsenal-add-bullet');
  fireEvent(addButton, 'click');
  await settle();

  byId(container, 'arsenalBulletName').value = 'No Caliber Yet';
  fireEvent(byId(container, 'arsenalBulletName'), 'input');

  const form = byId(container, 'arsenalBulletName').parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  assert.deepEqual(loadUserBullets(), [], 'nothing should be saved without an explicit caliber choice');
  assert.ok(form.textContent.includes(t('arsenal.errorCaliberRequired')));
});

test('the bullet list shows each bullet\'s last-modified timestamp', () => {
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'Dated Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  const stored = loadUserBullets()[0];
  const expectedDate = new Date(stored.modifiedAt).toISOString().slice(0, 16).replace('T', ' ');

  const container = makeElement('main');
  arsenalView.mount(container);

  const row = findByClass(container, 'arsenal-row').find((r) => r.textContent.includes('Dated Bullet'));
  assert.ok(row.textContent.includes(t('arsenal.lastModified', { date: expectedDate })));
});

test('editing an existing bullet pre-fills the form and updates it in place', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({ id, name: 'Original', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  const editButtons = findByTag(container, 'BUTTON').filter((b) => b.textContent && b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.editButton');
  assert.equal(editButtons.length, 1);
  fireEvent(editButtons[0], 'click');
  await settle();

  const nameInput = byId(container, 'arsenalBulletName');
  assert.equal(nameInput.value, 'Original');
  // Regression: the stored record's drag data lives nested under
  // `.profile`, not at the top level — the form must flatten it before
  // prefilling, or this silently falls back to DEFAULT_VALUES' bc (0.45)
  // and a plain Save-without-touching-BC would quietly corrupt it.
  assert.equal(byId(container, 'bc').value, '0.4');
  assert.equal(byId(container, 'arsenalBulletDragModel').value, 'G1');
  nameInput.value = 'Renamed';
  fireEvent(nameInput, 'input');

  const form = nameInput.parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1, 'editing must not create a second entry');
  assert.equal(bullets[0].id, id);
  assert.equal(bullets[0].name, 'Renamed');
  assert.equal(bullets[0].profile.bc, 0.4, 'saving without touching BC must not corrupt it');
});

test('deleting a bullet removes it after confirmation', async () => {
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'ToDelete', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  const deleteButtons = findByTag(container, 'BUTTON').filter((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.deleteButton');
  assert.equal(deleteButtons.length, 1);
  global.confirm = () => true;
  fireEvent(deleteButtons[0], 'click');

  assert.deepEqual(loadUserBullets(), []);
});

test('deleting a bullet used by no cartridge shows the plain confirm message, with no count', async () => {
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'Unused Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  let confirmMessage = null;
  global.confirm = (msg) => { confirmMessage = msg; return true; };

  const deleteButtons = findByTag(container, 'BUTTON').filter((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.deleteButton');
  fireEvent(deleteButtons[0], 'click');

  assert.equal(confirmMessage, t('arsenal.confirmDeleteBullet', { name: 'Unused Bullet' }));
  global.confirm = () => true; // restore the default for later tests
});

test('deleting a bullet also deletes every cartridge that uses it (on any rifle), and the confirm prompt names the count', async () => {
  const bullet = saveUserBullet({ id: generateUserId('user-bullet'), name: 'Shared Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserRifle({
    id: 'r1', name: 'Rifle One', defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [
      { id: 'c1', name: 'Load A', muzzleVelocity: 800, bulletId: bullet.id },
      { id: 'c2', name: 'Load B', muzzleVelocity: 820, bulletId: 'swiss-gp11' }
    ]
  });
  saveUserRifle({
    id: 'r2', name: 'Rifle Two', defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [{ id: 'c3', name: 'Load C', muzzleVelocity: 790, bulletId: bullet.id }]
  });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  let confirmMessage = null;
  global.confirm = (msg) => { confirmMessage = msg; return true; };

  const bulletRow = findByClass(container, 'arsenal-row').find((r) => r.textContent.includes('Shared Bullet'));
  const bulletDeleteButton = findByTag(bulletRow, 'BUTTON').find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.deleteButton');
  fireEvent(bulletDeleteButton, 'click');

  assert.equal(confirmMessage, t('arsenal.confirmDeleteBulletWithCartridges', { name: 'Shared Bullet', count: 2 }));

  assert.equal(loadUserBullets().find((b) => b.id === bullet.id), undefined, 'the bullet itself should be gone');
  const rifles = loadUserRifles();
  const riflesById = Object.fromEntries(rifles.map((r) => [r.id, r]));
  assert.deepEqual(riflesById.r1.cartridges.map((c) => c.id), ['c2'], 'only the cartridge using the deleted bullet should be removed');
  assert.deepEqual(riflesById.r2.cartridges, [], 'Rifle Two\'s only cartridge used the deleted bullet');
  global.confirm = () => true; // restore the default for later tests
});

test('declining the delete confirmation keeps the bullet', async () => {
  saveUserBullet({ id: generateUserId('user-bullet'), name: 'Keep me', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  const deleteButtons = findByTag(container, 'BUTTON').filter((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.deleteButton');
  global.confirm = () => false;
  fireEvent(deleteButtons[0], 'click');

  assert.equal(loadUserBullets().length, 1);
  global.confirm = () => true; // restore the default for later tests
});

test('saving a new bullet with a name that already exists overwrites it (no duplicate)', async () => {
  const existingId = generateUserId('user-bullet');
  saveUserBullet({ id: existingId, name: 'Same Name', manufacturer: 'Old Mfr', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  fireEvent(findAnyById(container, 'arsenal-add-bullet'), 'click');
  await settle();

  const nameInput = byId(container, 'arsenalBulletName');
  nameInput.value = 'Same Name';
  fireEvent(nameInput, 'input');

  // the live duplicate warning should now be visible
  const warning = findByTag(container, 'P').find((p) => p.getAttribute && p.getAttribute('data-i18n') === 'arsenal.duplicateNameWarning');
  assert.ok(warning);
  assert.equal(warning.style.display, '');

  byId(container, 'arsenalBulletManufacturer').value = 'New Mfr';
  selectCaliber(container, '7.62 / .308 / .30');
  const form = nameInput.parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1, 'a name collision must overwrite, not duplicate');
  assert.equal(bullets[0].id, existingId, 'the original id is preserved (referential integrity for anything pointing at it)');
  assert.equal(bullets[0].manufacturer, 'New Mfr');
});

test('adding a bullet with a pasted Cd-Mach table saves it with a cdTable profile, no bc/dragModel', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-bullet'), 'click');
  await settle();

  byId(container, 'arsenalBulletName').value = 'Custom Curve Bullet';
  fireEvent(byId(container, 'arsenalBulletName'), 'input');
  byId(container, 'arsenalBulletManufacturer').value = 'Acme';
  byId(container, 'massGrams').value = '10.5';
  fireEvent(byId(container, 'massGrams'), 'input');
  selectCaliber(container, '7.62 / .308 / .30');

  const profileTypeSelect = byId(container, 'arsenalBulletProfileType');
  profileTypeSelect.value = 'cdTable';
  fireEvent(profileTypeSelect, 'change');

  const cdTableInput = byId(container, 'arsenalBulletCdTable');
  cdTableInput.value = '0.85 0.230\n0.95 0.310\n1.00 0.380';
  fireEvent(cdTableInput, 'input');

  const form = byId(container, 'arsenalBulletName').parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1);
  assert.deepEqual(bullets[0].profile, { type: 'cdTable', table: [[0.85, 0.230], [0.95, 0.310], [1.00, 0.380]] });
});

test('saving a Cd-Mach table with invalid input is blocked, with a specific error, instead of silently corrupting the bullet', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-bullet'), 'click');
  await settle();

  byId(container, 'arsenalBulletName').value = 'Bad Curve Bullet';
  fireEvent(byId(container, 'arsenalBulletName'), 'input');

  const profileTypeSelect = byId(container, 'arsenalBulletProfileType');
  profileTypeSelect.value = 'cdTable';
  fireEvent(profileTypeSelect, 'change');

  const cdTableInput = byId(container, 'arsenalBulletCdTable');
  cdTableInput.value = '0.85 0.230\nnot-a-number 0.310'; // bad line 2
  fireEvent(cdTableInput, 'input');

  const form = byId(container, 'arsenalBulletName').parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  assert.deepEqual(loadUserBullets(), [], 'nothing should be saved when the table fails to parse');
  const errorText = t('arsenal.cdTableErrorBadLine', { line: 2 });
  assert.ok(form.textContent.includes(errorText), `expected the specific parse error ("${errorText}") to be shown`);
});

test('the Cd-Mach table field shows live feedback as it\'s typed: a row count when valid, the specific error when not', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-bullet'), 'click');
  await settle();

  const profileTypeSelect = byId(container, 'arsenalBulletProfileType');
  profileTypeSelect.value = 'cdTable';
  fireEvent(profileTypeSelect, 'change');

  const cdTableInput = byId(container, 'arsenalBulletCdTable');
  const statusFor = (text) => {
    cdTableInput.value = text;
    fireEvent(cdTableInput, 'input');
    return findByTag(container, 'P').find((p) => p.textContent === t('arsenal.cdTableParsedOk', { count: 2 })
      || p.textContent === t('arsenal.cdTableErrorTooFewRows'));
  };

  assert.equal(statusFor('0.85 0.230\n0.95 0.310').textContent, t('arsenal.cdTableParsedOk', { count: 2 }));
  assert.equal(statusFor('0.85 0.230').textContent, t('arsenal.cdTableErrorTooFewRows'));
});

test('editing an existing custom-table bullet pre-fills the textarea with its stored table, formatted back as text', async () => {
  const id = generateUserId('user-bullet');
  saveUserBullet({
    id, name: 'Stored Curve', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01,
    profile: { type: 'cdTable', table: [[0.85, 0.23], [0.95, 0.31]] }
  });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  const editButtons = findByTag(container, 'BUTTON').filter((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.editButton');
  fireEvent(editButtons[0], 'click');
  await settle();

  assert.equal(byId(container, 'arsenalBulletProfileType').value, 'cdTable', 'should default to the table it actually has, not BC');
  assert.equal(byId(container, 'arsenalBulletCdTable').value, '0.85 0.23\n0.95 0.31');

  const form = byId(container, 'arsenalBulletName').parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1, 'editing must not create a second entry');
  assert.deepEqual(bullets[0].profile, { type: 'cdTable', table: [[0.85, 0.23], [0.95, 0.31]] });
});

test('the rifle list shows each rifle\'s last-modified timestamp', () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  const stored = loadUserRifles()[0];
  const expectedDate = new Date(stored.modifiedAt).toISOString().slice(0, 16).replace('T', ' ');

  const container = makeElement('main');
  arsenalView.mount(container);

  const row = findByClass(container, 'arsenal-row').find((r) => r.textContent.includes('My Rifle'));
  assert.ok(row.textContent.includes(t('arsenal.lastModified', { date: expectedDate })));
});

test('the bullet, rifle and cartridge forms each show their own explicit Save label, not a generic "Save"', async () => {
  saveUserBullet({ id: 'my-bullet', name: 'Test Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  fireEvent(findAnyById(container, 'arsenal-add-bullet'), 'click');
  await settle();
  let { saveButton } = formActions(byId(container, 'arsenalBulletName').parentNode.parentNode);
  assert.equal(saveButton.textContent, t('arsenal.saveBulletButton'));
  assert.notEqual(saveButton.textContent, 'Save');

  const { cancelButton } = formActions(byId(container, 'arsenalBulletName').parentNode.parentNode);
  fireEvent(cancelButton, 'click');

  fireEvent(findAnyById(container, 'arsenal-add-rifle'), 'click');
  await settle();
  ({ saveButton } = formActions(byId(container, 'arsenalRifleName').parentNode.parentNode));
  assert.equal(saveButton.textContent, t('arsenal.saveRifleButton'));

  const rifleNameInput = byId(container, 'arsenalRifleName');
  rifleNameInput.value = 'Cartridge Test Rifle';
  fireEvent(rifleNameInput, 'input');
  fireEvent(saveButton, 'click'); // a newly-added rifle becomes the active one automatically

  fireEvent(findAnyById(container, 'arsenal-add-cartridge'), 'click');
  await settle();
  ({ saveButton } = outerCartridgeFormActions(container));
  assert.equal(saveButton.textContent, t('arsenal.saveCartridgeButton'));
});

test('saving a new rifle closes the form, makes it the active rifle, and reveals cartridge management right away', async () => {
  saveUserBullet({ id: 'my-bullet', name: 'Test Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-rifle'), 'click');
  const rifleNameInput = byId(container, 'arsenalRifleName');
  rifleNameInput.value = 'My Rifle';
  fireEvent(rifleNameInput, 'input');

  let { saveButton } = formActions(rifleNameInput.parentNode.parentNode);
  fireEvent(saveButton, 'click');

  const rifles = loadUserRifles();
  assert.equal(rifles.length, 1);
  assert.equal(rifles[0].name, 'My Rifle');
  assert.deepEqual(rifles[0].cartridges, []);

  // Save closes the form — back to the list, no form fields left open
  assert.equal(byId(container, 'arsenalRifleName'), undefined, 'the form should be closed after Save');
  // A brand-new rifle becomes the active one immediately, so cartridge
  // management is already available with no separate activation step.
  assert.ok(findAnyById(container, 'arsenal-add-cartridge'));

  fireEvent(findAnyById(container, 'arsenal-add-cartridge'), 'click');
  await settle();

  const cartridgeNameInput = byId(container, 'arsenalCartridgeName');
  cartridgeNameInput.value = 'My Load';
  fireEvent(cartridgeNameInput, 'input');
  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = 'my-bullet';
  fireEvent(bulletSelect, 'change'); // closes the default-open "Add new bullet" embedded form

  ({ saveButton } = outerCartridgeFormActions(container));
  fireEvent(saveButton, 'click');

  const updatedRifles = loadUserRifles();
  assert.equal(updatedRifles[0].cartridges.length, 1);
  assert.equal(updatedRifles[0].cartridges[0].name, 'My Load');
  assert.equal(updatedRifles[0].cartridges[0].bulletId, 'my-bullet');
});

// ---- Rifling twist (optional field — see unit-field.js's optional mode
// and bullet-form.js's own optional length field, the pattern this mirrors) ----

test('rifling twist is left out of a saved rifle entirely when the field is left blank', () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-rifle'), 'click');
  const rifleNameInput = byId(container, 'arsenalRifleName');
  rifleNameInput.value = 'No Twist Rifle';
  fireEvent(rifleNameInput, 'input');
  assert.equal(byId(container, 'riflingTwist').value, '', 'expected the twist field to start blank');

  const { saveButton } = formActions(rifleNameInput.parentNode.parentNode);
  fireEvent(saveButton, 'click');

  assert.equal('defaultRiflingTwistM' in loadUserRifles()[0], false);
});

// ---- Input validation (sanity checks) — src/ui/field-validity.js and
// src/units.js's own FIELD_BOUNDS, wired into every Arsenal form. ----

test('Save on the rifle form is blocked while a field is out of range, and unblocked once fixed', () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-rifle'), 'click');
  const rifleNameInput = byId(container, 'arsenalRifleName');
  rifleNameInput.value = 'Bad Sight Height';
  fireEvent(rifleNameInput, 'input');

  const sightHeightInput = byId(container, 'sightHeight');
  sightHeightInput.value = '9999'; // FIELD_BOUNDS.sightHeight is 0–500mm
  fireEvent(sightHeightInput, 'input');
  assert.equal(sightHeightInput.classList.contains('field-invalid'), true, 'expected live red-border feedback while typing');

  const { saveButton } = formActions(rifleNameInput.parentNode.parentNode);
  fireEvent(saveButton, 'click');
  assert.deepEqual(loadUserRifles(), [], 'Save must be blocked while a field is invalid');

  sightHeightInput.value = '70';
  fireEvent(sightHeightInput, 'input');
  assert.equal(sightHeightInput.classList.contains('field-invalid'), false);
  fireEvent(saveButton, 'click');
  assert.equal(loadUserRifles().length, 1, 'Save proceeds once every field is back in range');
});

test('Save is also blocked by a field that was never touched, once Save itself is clicked', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-bullet'), 'click');
  await settle();
  // Name and caliber are both left blank/untouched — a freshly-opened
  // form must not already show red (see the next test), but clicking
  // Save should force both dirty and block.
  const nameInput = byId(container, 'arsenalBulletName');
  assert.equal(nameInput.classList.contains('field-invalid'), false, 'pristine on open');

  const { saveButton } = formActions(nameInput.parentNode.parentNode);
  fireEvent(saveButton, 'click');
  assert.equal(nameInput.classList.contains('field-invalid'), true, 'Save reveals the never-touched violation');
  assert.deepEqual(loadUserBullets(), []);
});

test('rifling twist rejects a literal 0 (a Miller\'s-formula divisor) but still allows blank ("unknown")', () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-rifle'), 'click');
  const twistInput = byId(container, 'riflingTwist');

  twistInput.value = '0';
  fireEvent(twistInput, 'input');
  assert.equal(twistInput.classList.contains('field-invalid'), true, 'expected 0 itself to be rejected');

  twistInput.value = '';
  fireEvent(twistInput, 'input');
  assert.equal(twistInput.classList.contains('field-invalid'), false, 'blank ("unknown") must still be allowed');
});

test('a typed rifling twist value is saved in meters, and pre-fills correctly when editing again', () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-rifle'), 'click');
  const rifleNameInput = byId(container, 'arsenalRifleName');
  rifleNameInput.value = 'Twisty Rifle';
  fireEvent(rifleNameInput, 'input');
  const twistInput = byId(container, 'riflingTwist');
  twistInput.value = '178';
  fireEvent(twistInput, 'input');

  const { saveButton } = formActions(rifleNameInput.parentNode.parentNode);
  fireEvent(saveButton, 'click');

  const saved = loadUserRifles()[0];
  assert.ok(Math.abs(saved.defaultRiflingTwistM - 0.178) < 1e-9);

  // A newly-added rifle is already the active one — Edit is reachable
  // immediately, no separate activation step.
  fireEvent(rifleEditButton(container, 'Twisty Rifle'), 'click');
  assert.equal(byId(container, 'riflingTwist').value, '178');
});

test('editing a rifle without touching its twist field never clobbers the stored value with null', () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100, defaultRiflingTwistM: 0.24,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });

  const container = makeElement('main');
  arsenalView.mount(container);
  activateRifleRow(container, 'My Rifle');
  fireEvent(rifleEditButton(container, 'My Rifle'), 'click');

  const sourceInput = byId(container, 'arsenalRifleSource');
  sourceInput.value = 'edited notes';
  fireEvent(sourceInput, 'input');
  const { saveButton } = formActions(sourceInput.parentNode.parentNode);
  fireEvent(saveButton, 'click');

  assert.ok(Math.abs(loadUserRifles()[0].defaultRiflingTwistM - 0.24) < 1e-9);
});

// ---- Twist direction (always saved explicitly — "right" by default) ----

test('a new rifle saves "right" as its twist direction without the field being touched', () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-rifle'), 'click');
  assert.equal(byId(container, 'twistDirection').value, 'right');
  const rifleNameInput = byId(container, 'arsenalRifleName');
  rifleNameInput.value = 'Righty Rifle';
  fireEvent(rifleNameInput, 'input');

  const { saveButton } = formActions(rifleNameInput.parentNode.parentNode);
  fireEvent(saveButton, 'click');

  assert.equal(loadUserRifles()[0].defaultTwistDirection, 'right');
});

test('picking "Left" saves and pre-fills correctly when editing again', () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-rifle'), 'click');
  const rifleNameInput = byId(container, 'arsenalRifleName');
  rifleNameInput.value = 'Lefty Rifle';
  fireEvent(rifleNameInput, 'input');
  const directionSelect = byId(container, 'twistDirection');
  directionSelect.value = 'left';
  fireEvent(directionSelect, 'change');

  const { saveButton } = formActions(rifleNameInput.parentNode.parentNode);
  fireEvent(saveButton, 'click');

  assert.equal(loadUserRifles()[0].defaultTwistDirection, 'left');

  // A newly-added rifle is already the active one.
  fireEvent(rifleEditButton(container, 'Lefty Rifle'), 'click');
  assert.equal(byId(container, 'twistDirection').value, 'left');
});

// Shared setup for the cartridge-bullet-copy tests below: a persisted
// empty rifle, its cartridge-management form already open.
async function openNewCartridgeForm(container) {
  fireEvent(findAnyById(container, 'arsenal-add-rifle'), 'click');
  const rifleNameInput = byId(container, 'arsenalRifleName');
  rifleNameInput.value = 'My Rifle';
  fireEvent(rifleNameInput, 'input');
  const { saveButton } = formActions(rifleNameInput.parentNode.parentNode);
  fireEvent(saveButton, 'click'); // a newly-added rifle becomes the active one automatically

  fireEvent(findAnyById(container, 'arsenal-add-cartridge'), 'click');
  await settle();
}

// ---- Cartridge form's caliber filter (src/ui/arsenal/cartridge-form.js) ----
// swiss-gp11 (0.00778m) matches the "7.5mm(CH)" designation; hornady-30-
// eldm-208 (0.00783m) matches "7.62 / .308 / .30" — two real built-in
// bullets in genuinely different calibers, used to exercise filtering.

test('the cartridge form\'s caliber filter defaults to "All" and offers every caliber for a rifle\'s first cartridge', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  const caliberSelect = byId(container, 'arsenalCartridgeCaliberFilter');
  assert.ok(caliberSelect, 'expected a caliber filter select');
  assert.equal(caliberSelect.disabled, false, 'nothing to lock to yet — this is the first cartridge');
  const selectedCaliberOption = [...caliberSelect.childNodes].find((o) => o.attributes.value === caliberSelect.value);
  assert.equal(selectedCaliberOption.textContent, t('fields.bulletFilterAllCalibers'), 'defaults to "All"');

  const bulletOptionTexts = findInputs(container).find((n) => n.id === 'arsenalCartridgeBullet').childNodes.map((o) => o.textContent);
  assert.ok(bulletOptionTexts.some((t2) => t2.includes('174gr GP11')), 'the 7.5mm(CH) bullet should be offered');
  assert.ok(bulletOptionTexts.some((t2) => t2.includes('208gr ELD-M')), 'the .308 bullet should be offered too — nothing filtered yet');
});

test('choosing a caliber in the cartridge form filters the bullet picker to that caliber', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  const caliberSelect = byId(container, 'arsenalCartridgeCaliberFilter');
  const caliberOptions = [...caliberSelect.childNodes];
  const swissOption = caliberOptions.find((o) => o.textContent === '7.5mm(CH)');
  assert.ok(swissOption, 'expected "7.5mm(CH)" to be one of the offered calibers');
  caliberSelect.value = swissOption.attributes.value;
  fireEvent(caliberSelect, 'change');

  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  const bulletOptionTexts = bulletSelect.childNodes.map((o) => o.textContent);
  assert.ok(bulletOptionTexts.some((t2) => t2.includes('174gr GP11')));
  assert.ok(!bulletOptionTexts.some((t2) => t2.includes('208gr ELD-M')), 'the .308 bullet should be filtered out');
});

test('once a rifle\'s cartridge has a resolvable bullet, adding another cartridge locks the caliber filter to it', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'First Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  byId(container, 'arsenalCartridgeBullet').value = 'swiss-gp11';
  fireEvent(byId(container, 'arsenalCartridgeBullet'), 'change');
  let { saveButton } = outerCartridgeFormActions(container);
  fireEvent(saveButton, 'click');

  fireEvent(findAnyById(container, 'arsenal-add-cartridge'), 'click');
  await settle();

  const caliberSelect = byId(container, 'arsenalCartridgeCaliberFilter');
  assert.equal(caliberSelect.disabled, true, 'a sibling cartridge already established this rifle\'s caliber');
  assert.equal(caliberSelect.value, '7.5mm(CH)');

  const bulletOptionTexts = byId(container, 'arsenalCartridgeBullet').childNodes.map((o) => o.textContent);
  assert.ok(bulletOptionTexts.some((t2) => t2.includes('174gr GP11')));
  assert.ok(!bulletOptionTexts.some((t2) => t2.includes('208gr ELD-M')), 'a mismatched-caliber bullet must not be offered');

  const hint = findByTag(container, 'P').find((p) => p.getAttribute && p.getAttribute('data-i18n') === 'arsenal.cartridgeCaliberLockedHint');
  assert.ok(hint && hint.style.display !== 'none', 'expected the locked-caliber hint to be visible');
});

test('naming a new cartridge the same as an existing sibling shows a live, non-blocking duplicate warning', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'First Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  byId(container, 'arsenalCartridgeBullet').value = 'swiss-gp11';
  fireEvent(byId(container, 'arsenalCartridgeBullet'), 'change');
  const { saveButton } = outerCartridgeFormActions(container);
  fireEvent(saveButton, 'click');

  fireEvent(findAnyById(container, 'arsenal-add-cartridge'), 'click');
  await settle();

  const nameInput = byId(container, 'arsenalCartridgeName');
  const warning = () => findByTag(container, 'P').find((p) => p.getAttribute && p.getAttribute('data-i18n') === 'arsenal.duplicateCartridgeNameWarning');
  assert.equal(warning().style.display, 'none', 'no warning on a freshly-opened blank form');

  nameInput.value = 'First Load';
  fireEvent(nameInput, 'input');
  assert.equal(warning().style.display, '', 'duplicating a sibling cartridge name should warn live');
  assert.equal(nameInput.classList.contains('field-invalid'), false, 'duplicate-name is a non-blocking warning, not a validation error');

  nameInput.value = 'Second Load';
  fireEvent(nameInput, 'input');
  assert.equal(warning().style.display, 'none');
});

test('editing a rifle\'s only cartridge leaves the caliber filter open, even though it already has a bullet', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'Only Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  byId(container, 'arsenalCartridgeBullet').value = 'swiss-gp11';
  fireEvent(byId(container, 'arsenalCartridgeBullet'), 'change');
  const { saveButton } = outerCartridgeFormActions(container);
  fireEvent(saveButton, 'click');

  const cartridgesList = findAnyById(container, 'arsenal-add-cartridge').parentNode;
  const editButton = findByTag(cartridgesList, 'BUTTON').find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.editButton');
  fireEvent(editButton, 'click');
  await settle();

  const caliberSelect = byId(container, 'arsenalCartridgeCaliberFilter');
  assert.equal(caliberSelect.disabled, false, 'nothing else on the rifle needs this caliber to stay consistent');
  const selectedOption = [...caliberSelect.childNodes].find((o) => o.attributes.value === caliberSelect.value);
  assert.equal(selectedOption.textContent, t('fields.bulletFilterAllCalibers'), 'left open on "All", not locked to its own bullet\'s caliber');
});

test('adding a second cartridge still locks the caliber filter to the first one\'s bullet', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'First Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  byId(container, 'arsenalCartridgeBullet').value = 'swiss-gp11';
  fireEvent(byId(container, 'arsenalCartridgeBullet'), 'change');
  const { saveButton } = outerCartridgeFormActions(container);
  fireEvent(saveButton, 'click');

  fireEvent(findAnyById(container, 'arsenal-add-cartridge'), 'click');
  await settle();

  const caliberSelect = byId(container, 'arsenalCartridgeCaliberFilter');
  assert.equal(caliberSelect.disabled, true, 'a sibling cartridge already established this rifle\'s caliber');
  assert.equal(caliberSelect.value, '7.5mm(CH)');
});

test('editing one of two cartridges keeps the caliber filter locked (a sibling still depends on it)', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'First Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  byId(container, 'arsenalCartridgeBullet').value = 'swiss-gp11';
  fireEvent(byId(container, 'arsenalCartridgeBullet'), 'change');
  let { saveButton } = outerCartridgeFormActions(container);
  fireEvent(saveButton, 'click');

  fireEvent(findAnyById(container, 'arsenal-add-cartridge'), 'click');
  await settle();
  byId(container, 'arsenalCartridgeName').value = 'Second Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  byId(container, 'arsenalCartridgeBullet').value = 'swiss-gp11';
  fireEvent(byId(container, 'arsenalCartridgeBullet'), 'change');
  ({ saveButton } = outerCartridgeFormActions(container));
  fireEvent(saveButton, 'click');

  const cartridgesList = findAnyById(container, 'arsenal-add-cartridge').parentNode;
  const editButtons = findByTag(cartridgesList, 'BUTTON').filter((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.editButton');
  assert.equal(editButtons.length, 2);
  fireEvent(editButtons[0], 'click');
  await settle();

  const caliberSelect = byId(container, 'arsenalCartridgeCaliberFilter');
  assert.equal(caliberSelect.disabled, true, 'the sibling cartridge still chambers this rifle\'s established caliber');
  assert.equal(caliberSelect.value, '7.5mm(CH)');
});

test('a bullet with a caliber that matches no known designation still gets its own filterable entry', async () => {
  saveUserBullet({
    id: 'weird-bullet', name: 'Oddball', manufacturer: 'Acme', caliberM: 0.00912, massKg: 0.01,
    profile: { type: 'bc', bc: 0.3, model: 'G1' }
  });

  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  const caliberSelect = byId(container, 'arsenalCartridgeCaliberFilter');
  const customLabel = [...caliberSelect.childNodes].find((o) => o.textContent === '9.12mm');
  assert.ok(customLabel, 'expected a raw-mm entry for the custom caliber, same as the arsenal-wide caliber filter');

  caliberSelect.value = customLabel.attributes.value;
  fireEvent(caliberSelect, 'change');
  const bulletOptionTexts = byId(container, 'arsenalCartridgeBullet').childNodes.map((o) => o.textContent);
  assert.ok(bulletOptionTexts.some((t2) => t2.includes('Oddball')));
  assert.equal(bulletOptionTexts.length, 2, 'the custom-caliber bullet, plus the always-present "Add new bullet" option');
});

test('picking a built-in bullet in the cartridge form shows a copy notice; picking a user bullet doesn\'t', async () => {
  saveUserBullet({ id: 'my-bullet', name: 'Test Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  const noticeFor = (id) => {
    bulletSelect.value = id;
    fireEvent(bulletSelect, 'change');
    return findByTag(container, 'P').find((p) => p.getAttribute && p.getAttribute('data-i18n') === 'arsenal.cartridgeBulletCopyNotice');
  };

  assert.equal(noticeFor('swiss-gp11').style.display, '', 'a built-in bullet should show the copy notice');
  assert.equal(noticeFor('my-bullet').style.display, 'none', 'an already-user bullet needs no copy');
});

test('saving a cartridge with a built-in bullet copies its full record (drag model + BC) into the user library and points the cartridge at the copy', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'Built-in Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = 'swiss-gp11';
  fireEvent(bulletSelect, 'change');

  const form = byId(container, 'arsenalCartridgeName').parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const rifles = loadUserRifles();
  const savedBulletId = rifles[0].cartridges[0].bulletId;
  assert.notEqual(savedBulletId, 'swiss-gp11', 'the cartridge must point at the copy, not the built-in id');

  const copy = loadUserBullets().find((b) => b.id === savedBulletId);
  assert.ok(copy, 'expected a copy of the built-in bullet to exist in the user library');
  assert.equal(copy.name, '174gr GP11');
  assert.equal(copy.manufacturer, 'Military');
  assert.deepEqual(copy.profile, { type: 'bc', bc: 0.274, model: 'G7' });
});

test('saving a cartridge with a built-in Cd-table bullet copies the table itself, not just BC', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'Custom Curve Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = 'hornady-30-eldm-208';
  fireEvent(bulletSelect, 'change');

  const form = byId(container, 'arsenalCartridgeName').parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const savedBulletId = loadUserRifles()[0].cartridges[0].bulletId;
  const copy = loadUserBullets().find((b) => b.id === savedBulletId);
  assert.ok(copy, 'expected a copy of the built-in bullet to exist in the user library');
  assert.equal(copy.profile.type, 'cdTable');
  assert.ok(Array.isArray(copy.profile.table) && copy.profile.table.length > 10, 'the bullet-specific Cd-Mach table must be copied, not dropped');
});

test('a same-named existing user bullet triggers a live overwrite warning, and saving overwrites it in place rather than duplicating', async () => {
  const existing = saveUserBullet({
    id: 'my-old-copy', name: '174gr GP11', manufacturer: 'Old Data', caliberM: 0.001, massKg: 0.001,
    profile: { type: 'bc', bc: 0.1, model: 'G1' }
  });

  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = 'swiss-gp11';
  fireEvent(bulletSelect, 'change');

  const overwriteWarning = findByTag(container, 'P').find((p) => p.textContent === t('arsenal.cartridgeBulletCopyOverwriteWarning', { name: '174gr GP11' }));
  assert.ok(overwriteWarning, 'expected a live overwrite warning naming the colliding bullet');
  assert.equal(overwriteWarning.style.display, '');

  byId(container, 'arsenalCartridgeName').value = 'Built-in Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  const form = byId(container, 'arsenalCartridgeName').parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1, 'must overwrite the existing entry, not create a second one');
  assert.equal(bullets[0].id, existing.id, 'the original id (and anything already pointing at it) is preserved');
  assert.deepEqual(bullets[0].profile, { type: 'bc', bc: 0.274, model: 'G7' }, 'the stale data is replaced with the built-in bullet\'s own');
  assert.equal(loadUserRifles()[0].cartridges[0].bulletId, existing.id);
});

test('re-saving a cartridge that already points at a previously-copied user bullet does not create another copy', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'Built-in Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  byId(container, 'arsenalCartridgeBullet').value = 'swiss-gp11';
  fireEvent(byId(container, 'arsenalCartridgeBullet'), 'change');
  let { saveButton } = outerCartridgeFormActions(container);
  fireEvent(saveButton, 'click');

  const copiedId = loadUserRifles()[0].cartridges[0].bulletId;
  assert.equal(loadUserBullets().length, 1);

  // Edit that same cartridge and save again without changing the bullet.
  // Scoped to the cartridges list specifically — a container-wide search
  // would also catch the rifle's own Edit button, and (now that saving a
  // cartridge refreshes the bullet list too, see refreshLibraryView())
  // the newly-copied bullet's own Edit button as well.
  const cartridgesList = findAnyById(container, 'arsenal-add-cartridge').parentNode;
  const cartridgeEditButton = findByTag(cartridgesList, 'BUTTON').find((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.editButton');
  fireEvent(cartridgeEditButton, 'click');
  await settle();
  ({ saveButton } = outerCartridgeFormActions(container));
  fireEvent(saveButton, 'click');

  assert.equal(loadUserBullets().length, 1, 'must not create a second copy');
  assert.equal(loadUserRifles()[0].cartridges[0].bulletId, copiedId, 'the cartridge should keep pointing at the same copy');
});

// ---- "Add new bullet", embedded in the cartridge form ----

test('the cartridge form hints that the bullet picker also offers "Add new bullet"', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  const hint = findByTag(container, 'P').find((p) => p.getAttribute && p.getAttribute('data-i18n') === 'arsenal.cartridgeBulletHint');
  assert.ok(hint, 'expected the "select existing or add new" hint');
  assert.ok(newBulletOption(container), 'expected an "Add new bullet" option in the bullet picker');
});

test('picking "Add new bullet" shows an embedded Add Bullet form; picking a real bullet again hides it', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = newBulletOption(container).value;
  fireEvent(bulletSelect, 'change');
  assert.ok(byId(container, 'arsenalBulletName'), 'expected the embedded Add Bullet form to appear');

  bulletSelect.value = 'swiss-gp11';
  fireEvent(bulletSelect, 'change');
  assert.ok(!byId(container, 'arsenalBulletName'), 'expected the embedded form to disappear once a real bullet is picked');
});

test('the embedded Add Bullet form\'s caliber pre-fills to the cartridge form\'s own caliber filter, and stays in sync as that filter changes', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  const caliberSelect = byId(container, 'arsenalCartridgeCaliberFilter');
  const swissOption = [...caliberSelect.childNodes].find((o) => o.textContent === '7.5mm(CH)');
  caliberSelect.value = swissOption.value;
  fireEvent(caliberSelect, 'change');

  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = newBulletOption(container).value;
  fireEvent(bulletSelect, 'change');

  assert.equal(byId(container, 'bulletCaliberMm').value, '7.78', 'pre-filled from the parent caliber filter');

  const dotThreeOhEight = [...caliberSelect.childNodes].find((o) => o.textContent === '7.62 / .308 / .30');
  caliberSelect.value = dotThreeOhEight.value;
  fireEvent(caliberSelect, 'change');

  assert.equal(byId(container, 'bulletCaliberMm').value, '7.83', 'stays in sync live once the parent filter changes');
});

test('the embedded Add Bullet form\'s caliber is locked (picker and manual entry both) when the parent caliber filter is locked', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'First Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');
  byId(container, 'arsenalCartridgeBullet').value = 'swiss-gp11';
  fireEvent(byId(container, 'arsenalCartridgeBullet'), 'change');
  const { saveButton } = outerCartridgeFormActions(container);
  fireEvent(saveButton, 'click');

  fireEvent(findAnyById(container, 'arsenal-add-cartridge'), 'click');
  await settle();

  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = newBulletOption(container).value;
  fireEvent(bulletSelect, 'change');

  assert.equal(byId(container, 'bulletCaliber').disabled, true, 'locked designation picker');
  assert.equal(byId(container, 'bulletCaliberMm').disabled, true, 'locked manual mm entry');
  assert.equal(byId(container, 'bulletCaliberMm').value, '7.78', 'pre-filled to the rifle\'s established caliber');
});

test('saving the embedded Add Bullet form\'s own Save button adds the bullet to the Arsenal, selects it, and hides the embedded form', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = newBulletOption(container).value;
  fireEvent(bulletSelect, 'change');
  await settle(); // the embedded form's own caliber-designations fetch

  byId(container, 'arsenalBulletName').value = 'Handloaded Match';
  fireEvent(byId(container, 'arsenalBulletName'), 'input');
  selectCaliber(container, '7.62 / .308 / .30');

  const { saveButton } = formActions(byId(container, 'arsenalBulletName').parentNode.parentNode);
  fireEvent(saveButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].name, 'Handloaded Match');
  assert.equal(bulletSelect.value, bullets[0].id, 'the new bullet should now be selected');
  assert.ok(!byId(container, 'arsenalBulletName'), 'the embedded form should be gone once its own Save succeeds');
});

test('submitting the cartridge form\'s own Save while a new bullet is still filled in (its own Save button never clicked) creates that bullet too, in one step', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'Fresh Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');

  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = newBulletOption(container).value;
  fireEvent(bulletSelect, 'change');
  await settle(); // the embedded form's own caliber-designations fetch

  byId(container, 'arsenalBulletName').value = 'Inline New Bullet';
  fireEvent(byId(container, 'arsenalBulletName'), 'input');
  selectCaliber(container, '7.62 / .308 / .30');

  const { saveButton } = outerCartridgeFormActions(container);
  fireEvent(saveButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].name, 'Inline New Bullet');

  const rifles = loadUserRifles();
  assert.equal(rifles[0].cartridges.length, 1);
  assert.equal(rifles[0].cartridges[0].name, 'Fresh Load');
  assert.equal(rifles[0].cartridges[0].bulletId, bullets[0].id, 'the cartridge should point at the just-created bullet');
});

test('submitting the cartridge form\'s own Save while "Add new bullet" is active but its own required fields are still blank blocks the save, scrolling to the offending field', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  byId(container, 'arsenalCartridgeName').value = 'Blocked Load';
  fireEvent(byId(container, 'arsenalCartridgeName'), 'input');

  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = newBulletOption(container).value;
  fireEvent(bulletSelect, 'change');
  // Deliberately leave the embedded bullet's own name/caliber blank.

  const { saveButton } = outerCartridgeFormActions(container);
  fireEvent(saveButton, 'click');

  assert.equal(loadUserBullets().length, 0, 'nothing should be saved yet');
  assert.equal(loadUserRifles()[0].cartridges.length, 0, 'the cartridge itself must not save either');
  assert.ok(byId(container, 'arsenalBulletName'), 'the embedded form should still be open, showing its own violation');
});

test('cancelling the embedded Add Bullet form discards it and reverts the bullet selector to what was chosen before', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  await openNewCartridgeForm(container);

  const bulletSelect = byId(container, 'arsenalCartridgeBullet');
  bulletSelect.value = 'swiss-gp11';
  fireEvent(bulletSelect, 'change');

  bulletSelect.value = newBulletOption(container).value;
  fireEvent(bulletSelect, 'change');
  assert.ok(byId(container, 'arsenalBulletName'));

  const { cancelButton } = formActions(byId(container, 'arsenalBulletName').parentNode.parentNode);
  fireEvent(cancelButton, 'click');

  assert.ok(!byId(container, 'arsenalBulletName'), 'the embedded form should be gone');
  assert.equal(bulletSelect.value, 'swiss-gp11', 'reverted to the bullet chosen before "Add new bullet"');
});

test('deleting a cartridge removes only that cartridge from its rifle', async () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [
      { id: 'c1', name: 'Load 1', muzzleVelocity: 800, bulletId: 'swiss-gp11' },
      { id: 'c2', name: 'Load 2', muzzleVelocity: 820, bulletId: 'swiss-gp11' }
    ]
  });

  const container = makeElement('main');
  arsenalView.mount(container);
  // Cartridge management only shows for the active rifle.
  activateRifleRow(container, 'My Rifle');

  // Scoped to the cartridges list specifically — the container also has
  // the rifle's own Delete button (in the Active-rifle pane's own row),
  // which a plain container-wide search would catch first.
  const cartridgesList = findAnyById(container, 'arsenal-add-cartridge').parentNode;
  const deleteButtons = findByTag(cartridgesList, 'BUTTON').filter((b) => b.getAttribute && b.getAttribute('data-i18n') === 'arsenal.deleteButton');
  assert.equal(deleteButtons.length, 2);
  global.confirm = () => true;
  fireEvent(deleteButtons[0], 'click'); // the first cartridge row's Delete

  const rifles = loadUserRifles();
  assert.equal(rifles[0].cartridges.length, 1);
  assert.equal(rifles[0].cartridges[0].id, 'c2');
});

test('activating a rifle+cartridge and pressing Done stores it as the shared session selection and navigates to Trajectory Table', () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [
      { id: 'c1', name: 'Load 1', muzzleVelocity: 800, bulletId: 'swiss-gp11' },
      { id: 'c2', name: 'Load 2', muzzleVelocity: 820, bulletId: 'swiss-gp11' }
    ]
  });

  const container = makeElement('main');
  arsenalView.mount(container);
  activateRifleRow(container, 'My Rifle');

  // The active rifle's own cartridge picker, now inside the "Active
  // rifle" pane rather than next to a "Set active" button.
  const select = findByTag(container, 'SELECT').find((s) => s.className === 'arsenal-active-cartridge');
  assert.ok(select, 'expected the active rifle\'s own cartridge picker');
  select.value = 'c2';
  fireEvent(select, 'change');

  location.hash = '';
  requestGunsDone('/trajectory'); // Done is what commits the staged activation now, not a per-row button

  assert.equal(location.hash, '#/trajectory');
  assert.deepEqual(loadRifleState().library, { rifleId: 'my-rifle', cartridgeId: 'c2' });
});

test('activating a rifle+cartridge fills Guns\' Custom tab rifle, cartridge, and bullet selectors from the chosen combination once Done commits it', async () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [
      { id: 'c1', name: 'Load 1', muzzleVelocity: 800, bulletId: 'swiss-gp11' },
      { id: 'c2', name: 'Load 2', muzzleVelocity: 820, bulletId: 'swiss-gp11' }
    ]
  });

  const arsenalContainer = makeElement('main');
  arsenalView.mount(arsenalContainer);
  activateRifleRow(arsenalContainer, 'My Rifle');
  const select = findByTag(arsenalContainer, 'SELECT').find((s) => s.className === 'arsenal-active-cartridge');
  select.value = 'c2';
  fireEvent(select, 'change');
  requestGunsDone('/trajectory');

  // The live picker now lives on Guns' Custom tab (see guns-view.js) —
  // Trajectory itself only shows a compact summary card.
  const gunsContainer = makeElement('main');
  gunsView.mount(gunsContainer, 'custom');
  await settle();

  assert.equal(byId(gunsContainer, 'rifleSelect').value, 'my-rifle');
  assert.equal(byId(gunsContainer, 'rifleCartridgeSelect').value, 'c2');
  assert.equal(byId(gunsContainer, 'zeroRange').value, '100');

  const bulletSelect = byId(gunsContainer, 'bulletSelect');
  assert.equal(bulletSelect.value, 'swiss-gp11');
  assert.equal(bulletSelect.disabled, true, 'the bullet picker should be locked by the active cartridge');
});

test('activating an Arsenal rifle and pressing Done updates Trajectory\'s active-configuration summary away from a previously active custom load', async () => {
  // A custom (hand-entered) configuration is already active — the bug
  // this guards against only showed up when replacing one, not when
  // there was nothing active yet (see trajectory-view.js's own comment
  // on why cartridge's onInput, not rifle's, is what re-triggers
  // guns-summary.js's refresh()).
  saveCartridgeState({ muzzleVelocity: 900, bullet: { selectedId: '__other__' } });
  saveRifleState({ library: null });

  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [{ id: 'c1', name: 'Load 1', muzzleVelocity: 820, bulletId: 'swiss-gp11' }]
  });

  const arsenalContainer = makeElement('main');
  arsenalView.mount(arsenalContainer);
  activateRifleRow(arsenalContainer, 'My Rifle');
  requestGunsDone('/trajectory');

  const trajectoryContainer = makeElement('main');
  trajectoryView.mount(trajectoryContainer);
  await settle();

  const rifleLine = findByTag(trajectoryContainer, 'DIV').find((d) => d.className === 'rifle-line');
  const bulletLine = findByTag(trajectoryContainer, 'DIV').find((d) => d.className === 'bullet-line');
  assert.ok(rifleLine.textContent.includes('My Rifle'), `expected the rifle line to show the newly active Arsenal rifle, got "${rifleLine.textContent}"`);
  assert.ok(!bulletLine.textContent.includes(t('guns.customBulletLabel')), `expected the bullet line to have moved off the stale custom load, got "${bulletLine.textContent}"`);
});

test('a rifle with no saved cartridges shows no cartridge picker/Compare control, and is marked "Unusable"', () => {
  saveUserRifle({
    id: 'bare-rifle', name: 'Bare Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });

  const container = makeElement('main');
  arsenalView.mount(container);

  const select = findByTag(container, 'SELECT').find((s) => s.className === 'arsenal-active-cartridge');
  assert.equal(select, undefined, 'nothing for a cartridge picker to act on');
  const compareButton = findByTag(container, 'BUTTON').find((b) => b.className && b.className.includes('arsenal-compare-toggle'));
  assert.equal(compareButton, undefined);

  const row = findByClass(container, 'arsenal-row').find((r) => r.textContent.includes('Bare Rifle'));
  const badge = findByClass(row, 'unusable-badge')[0];
  assert.ok(badge, 'expected the "Unusable" badge on a cartridge-less rifle');
  assert.equal(badge.textContent, t('arsenal.unusableBadge'));
});

test('activating a cartridge-less rifle brings it to the "Active rifle" pane, showing the no-cartridges warning and Add Cartridge', () => {
  saveUserRifle({
    id: 'bare-rifle', name: 'Bare Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });

  const container = makeElement('main');
  arsenalView.mount(container);
  activateRifleRow(container, 'Bare Rifle');

  assert.ok(findAnyById(container, 'arsenal-add-cartridge'), 'expected Add Cartridge to be reachable');
  const warning = findByTag(container, 'P').find((p) => p.getAttribute && p.getAttribute('data-i18n') === 'arsenal.noCartridgesWarning');
  assert.ok(warning, 'expected the prominent no-cartridges warning');
});

test('Done does not change the previously-active configuration when the currently active rifle has no cartridges', () => {
  saveUserRifle({
    id: 'usable-rifle', name: 'Usable Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [{ id: 'c1', name: 'Load 1', muzzleVelocity: 800, bulletId: 'swiss-gp11' }]
  });
  saveUserRifle({
    id: 'bare-rifle', name: 'Bare Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  saveRifleState({ library: { rifleId: 'usable-rifle', cartridgeId: 'c1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  activateRifleRow(container, 'Bare Rifle');
  requestGunsDone('/trajectory');

  assert.deepEqual(loadRifleState().library, { rifleId: 'usable-rifle', cartridgeId: 'c1' }, 'the previous running configuration must be left untouched');
});

test('a bullet prefill from another view opens the Add Bullet form pre-filled', async () => {
  setPendingBulletPrefill({ bc: 0.512, dragModel: 'G7' });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  const bcInput = byId(container, 'bc');
  assert.ok(bcInput, 'expected the Add Bullet form to already be open');
  assert.equal(bcInput.value, '0.512');
  const dragModelSelect = byId(container, 'arsenalBulletDragModel');
  assert.equal(dragModelSelect.value, 'G7');
});

test('a bullet prefill carrying a cdTable (from selecting a custom-curve library bullet elsewhere) opens the Add Bullet form with the table profile pre-selected and filled in', async () => {
  setPendingBulletPrefill({ name: 'Imported Curve', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.0113398, cdTable: [[0.85, 0.23], [0.95, 0.31]] });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  assert.equal(byId(container, 'arsenalBulletProfileType').value, 'cdTable');
  assert.equal(byId(container, 'arsenalBulletCdTable').value, '0.85 0.23\n0.95 0.31');
});

test('a rifle prefill from another view opens the Add Rifle form pre-filled', () => {
  setPendingRiflePrefill({ name: 'Prefilled Rifle', defaultSightHeightM: 0.05, defaultZeroRangeM: 200, defaultClickUnit: 'arcmin', defaultClickHorizontal: 0.25, defaultClickVertical: 0.25 });

  const container = makeElement('main');
  arsenalView.mount(container);

  const nameInput = byId(container, 'arsenalRifleName');
  assert.ok(nameInput, 'expected the Add Rifle form to already be open');
  assert.equal(nameInput.value, 'Prefilled Rifle');
  const zeroRangeInput = byId(container, 'zeroRange');
  assert.equal(zeroRangeInput.value, '200');
});

test('a bullet prefill matching an existing Arsenal bullet by name opens it in Edit mode, filled with the fresh values', async () => {
  const existingId = generateUserId('user-bullet');
  saveUserBullet({ id: existingId, name: 'My Bullet', manufacturer: 'Old Mfr', caliberM: 0.0078232, massKg: 0.009, profile: { type: 'bc', bc: 0.3, model: 'G1' } });

  setPendingBulletPrefill({ name: 'My Bullet', manufacturer: 'New Mfr', caliberM: 0.0078232, massKg: 0.0105, bc: 0.55, dragModel: 'G7' });

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  const heading = findByTag(container, 'H2').find((h) => h.getAttribute && h.getAttribute('data-i18n') === 'arsenal.editBulletHeading');
  assert.ok(heading, 'expected the "Edit Bullet" heading, not "Add Bullet" — a same-named entry already exists');

  const nameInput = byId(container, 'arsenalBulletName');
  assert.equal(nameInput.value, 'My Bullet');
  assert.equal(byId(container, 'arsenalBulletManufacturer').value, 'New Mfr', 'the form should show the fresh prefill values, not the stored ones');
  assert.equal(byId(container, 'bc').value, '0.55');

  const form = nameInput.parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1, 'must update the existing entry in place, not create a second one');
  assert.equal(bullets[0].id, existingId);
  assert.equal(bullets[0].manufacturer, 'New Mfr');
  assert.ok(Math.abs(bullets[0].massKg - 0.0105) < 1e-9);
});

test('a rifle prefill matching an existing Arsenal rifle by name opens it in Edit mode, filled with the fresh values', () => {
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [{ id: 'c1', name: 'Load 1', muzzleVelocity: 800, bulletId: 'swiss-gp11' }]
  });

  setPendingRiflePrefill({ name: 'My Rifle', defaultSightHeightM: 0.05, defaultZeroRangeM: 200, defaultClickUnit: 'arcmin', defaultClickHorizontal: 0.25, defaultClickVertical: 0.25 });

  const container = makeElement('main');
  arsenalView.mount(container);

  const heading = findByTag(container, 'H2').find((h) => h.getAttribute && h.getAttribute('data-i18n') === 'arsenal.editRifleHeading');
  assert.ok(heading, 'expected the "Edit Rifle" heading, not "Add Rifle" — a same-named entry already exists');

  const nameInput = byId(container, 'arsenalRifleName');
  assert.equal(nameInput.value, 'My Rifle');
  const zeroRangeInput = byId(container, 'zeroRange');
  assert.equal(zeroRangeInput.value, '200', 'the form should show the fresh prefill values, not the stored ones');

  // Cartridge management is already available too, since this is a real
  // persisted rifle (matched by name), not a brand-new unsaved one.
  assert.ok(findAnyById(container, 'arsenal-add-cartridge'));

  const form = nameInput.parentNode.parentNode;
  const { saveButton } = formActions(form);
  fireEvent(saveButton, 'click');

  const rifles = loadUserRifles();
  assert.equal(rifles.length, 1, 'must update the existing entry in place, not create a second one');
  assert.equal(rifles[0].id, 'my-rifle');
  assert.equal(rifles[0].defaultZeroRangeM, 200);
  assert.equal(rifles[0].cartridges.length, 1, 'its existing cartridges must be preserved');
});

test('a prefill is only applied once — remounting Arsenal without a new prefill starts fresh', () => {
  setPendingBulletPrefill({ bc: 0.6, dragModel: 'G1' });

  const first = makeElement('main');
  arsenalView.mount(first);
  assert.ok(byId(first, 'bc'));

  const second = makeElement('main');
  arsenalView.mount(second);
  assert.equal(byId(second, 'arsenalBulletName'), undefined, 'no form should auto-open the second time');
});

// --- Export/import (src/arsenal-export.js, ui/arsenal/{export,import}-dialog.js) ---

function unsavedBadgeIn(rowInfoOrRow) {
  return findByTag(rowInfoOrRow, 'SPAN').find((s) => s.className === 'unsaved-badge');
}

test('a freshly saved bullet/rifle shows the "Unsaved" badge; a per-row "Save to file" click clears it', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-add-bullet'), 'click');
  await settle();
  byId(container, 'arsenalBulletName').value = 'New Bullet';
  fireEvent(byId(container, 'arsenalBulletName'), 'input');
  selectCaliber(container, '7.62 / .308 / .30');
  let { saveButton } = formActions(byId(container, 'arsenalBulletName').parentNode.parentNode);
  fireEvent(saveButton, 'click');

  assert.equal(loadUserBullets()[0].unsaved, true);
  let row = findByClass(container, 'arsenal-row').find((r) => r.textContent.includes('New Bullet'));
  assert.ok(unsavedBadgeIn(row), 'expected the Unsaved badge on a just-created bullet');

  const saveToFileButton = findByTag(row, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.saveToFileButton');
  fireEvent(saveToFileButton, 'click');

  assert.equal(loadUserBullets()[0].unsaved, false, 'exporting must clear unsaved');
  row = findByClass(container, 'arsenal-row').find((r) => r.textContent.includes('New Bullet'));
  assert.equal(unsavedBadgeIn(row), undefined, 'the badge must disappear once exported');
});

test('saving a rifle to file also marks the bullets its cartridges reference as saved', async () => {
  saveUserBullet({ id: 'my-bullet', name: 'Test Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserRifle({
    id: 'my-rifle', name: 'My Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [{ id: 'c1', name: 'Load 1', muzzleVelocity: 800, bulletId: 'my-bullet' }]
  });
  assert.equal(loadUserBullets()[0].unsaved, true);
  assert.equal(loadUserRifles()[0].unsaved, true);

  const container = makeElement('main');
  arsenalView.mount(container);
  await settle();

  const rifleRow = findByClass(container, 'arsenal-row').find((r) => r.textContent.includes('My Rifle'));
  const saveToFileButton = findByTag(rifleRow, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.saveToFileButton');
  fireEvent(saveToFileButton, 'click');

  assert.equal(loadUserRifles()[0].unsaved, false);
  assert.equal(loadUserBullets()[0].unsaved, false, 'the rifle\'s own referenced bullet must be marked saved too');
});

test('"Save library" opens a selection dialog; excluding an item from the selection leaves it unsaved', async () => {
  saveUserBullet({ id: 'b1', name: 'Bullet One', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
  saveUserBullet({ id: 'b2', name: 'Bullet Two', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(findAnyById(container, 'arsenal-save-library'), 'click');

  const exportBulletCheckbox = byId(container, 'export-bullet-b2');
  assert.ok(exportBulletCheckbox, 'expected the selection dialog to list both bullets');
  exportBulletCheckbox.checked = false;
  fireEvent(exportBulletCheckbox, 'change');

  const exportButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.exportButton');
  fireEvent(exportButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.find((b) => b.id === 'b1').unsaved, false, 'the checked bullet should be marked saved');
  assert.equal(bullets.find((b) => b.id === 'b2').unsaved, true, 'the unchecked bullet should stay unsaved');
  // The dialog closes after exporting.
  assert.equal(byId(container, 'export-bullet-b1'), undefined);
});

test('"Save library" can be cancelled without marking anything saved', () => {
  saveUserBullet({ id: 'b1', name: 'Bullet One', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);
  fireEvent(findAnyById(container, 'arsenal-save-library'), 'click');

  const cancelButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.cancelButton');
  fireEvent(cancelButton, 'click');

  assert.equal(loadUserBullets()[0].unsaved, true);
  assert.equal(byId(container, 'export-bullet-b1'), undefined, 'the dialog should be closed');
});

function fakeExportFile({ bullets = [], rifles = [] }) {
  const payload = { format: 'ebalka2-arsenal', version: 1, exportedAt: new Date().toISOString(), bullets, rifles };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

test('picking a valid export file opens the import dialog listing its contents', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({ bullets: [{ id: 'file-b1', name: 'Imported Bullet' }], rifles: [] })];
  fireEvent(input, 'change');
  await settle();

  assert.ok(byId(container, 'import-bullet-file-b1'), 'expected the imported bullet to be listed');
});

test('picking an invalid (non-JSON) file shows a translated error instead of opening the dialog', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [new Blob(['not json {{{'], { type: 'application/json' })];
  fireEvent(input, 'change');
  await settle();

  const errorText = t('arsenal.importFileErrorInvalidJson');
  assert.ok(container.textContent.includes(errorText));
});

test('picking well-formed JSON that isn\'t an Arsenal export shows the "wrong format" error', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [new Blob([JSON.stringify({ hello: 'world' })], { type: 'application/json' })];
  fireEvent(input, 'change');
  await settle();

  assert.ok(container.textContent.includes(t('arsenal.importFileErrorInvalidFormat')));
});

test('importing a new bullet and rifle (no conflicts) adds them to the library, unsaved, with modifiedAt preserved from the file', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  const importedAt = '2020-05-01T00:00:00.000Z';
  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({
    bullets: [{ id: 'file-b1', name: 'Imported Bullet', manufacturer: 'Acme', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' }, modifiedAt: importedAt }],
    rifles: [{
      id: 'file-r1', name: 'Imported Rifle', defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
      defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
      cartridges: [{ id: 'c1', name: 'Load 1', muzzleVelocity: 800, bulletId: 'file-b1' }], modifiedAt: importedAt
    }]
  })];
  fireEvent(input, 'change');
  await settle();

  const importButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.importButton');
  fireEvent(importButton, 'click');

  const bullets = loadUserBullets();
  const rifles = loadUserRifles();
  assert.equal(bullets.length, 1);
  assert.equal(rifles.length, 1);
  assert.equal(bullets[0].name, 'Imported Bullet');
  assert.equal(bullets[0].modifiedAt, importedAt, 'import must preserve the file\'s own modifiedAt');
  assert.equal(bullets[0].unsaved, true, 'an import is a local modification with no export of its own yet');
  // The rifle's cartridge must point at the bullet's *new local* id, not the file's original one.
  assert.notEqual(rifles[0].cartridges[0].bulletId, 'file-b1');
  assert.equal(rifles[0].cartridges[0].bulletId, bullets[0].id);

  assert.ok(container.textContent.includes(t('arsenal.importSummary', { saved: 2, skipped: 0 })));
});

test('importing over a same-named existing bullet in "overwrite" mode replaces it in place', async () => {
  saveUserBullet({ id: 'local-b1', name: 'My Bullet', manufacturer: 'Old', caliberM: 0.001, massKg: 0.001, profile: { type: 'bc', bc: 0.1, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({
    bullets: [{ id: 'file-b1', name: 'My Bullet', manufacturer: 'New', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.5, model: 'G7' } }],
    rifles: []
  })];
  fireEvent(input, 'change');
  await settle();

  const modeSelect = byId(container, 'import-conflict-mode');
  modeSelect.value = 'overwrite';
  fireEvent(modeSelect, 'change');

  const importButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.importButton');
  fireEvent(importButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1, 'must overwrite, not duplicate');
  assert.equal(bullets[0].id, 'local-b1');
  assert.equal(bullets[0].manufacturer, 'New');
});

test('importing over a same-named existing bullet in "rename" mode keeps both, auto-naming the import', async () => {
  saveUserBullet({ id: 'local-b1', name: 'My Bullet', manufacturer: 'Old', caliberM: 0.001, massKg: 0.001, profile: { type: 'bc', bc: 0.1, model: 'G1' } });

  const container = makeElement('main');
  arsenalView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({
    bullets: [{ id: 'file-b1', name: 'My Bullet', manufacturer: 'New', caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.5, model: 'G7' } }],
    rifles: []
  })];
  fireEvent(input, 'change');
  await settle();

  const modeSelect = byId(container, 'import-conflict-mode');
  modeSelect.value = 'rename';
  fireEvent(modeSelect, 'change');

  const importButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.importButton');
  fireEvent(importButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 2, 'both the original and the renamed import should exist');
  assert.ok(bullets.some((b) => b.name === 'My Bullet' && b.manufacturer === 'Old'));
  assert.ok(bullets.some((b) => b.name === 'My Bullet - copy (1)' && b.manufacturer === 'New'));
});

test('importing in "overwrite if newer" mode skips an older conflicting item', async () => {
  saveUserBullet({ id: 'local-b1', name: 'My Bullet', manufacturer: 'Original', caliberM: 0.001, massKg: 0.001, profile: { type: 'bc', bc: 0.1, model: 'G1' } });
  const localModifiedAt = loadUserBullets()[0].modifiedAt;

  const container = makeElement('main');
  arsenalView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({
    bullets: [{
      id: 'file-b1', name: 'My Bullet', manufacturer: 'Stale', caliberM: 0.0078232, massKg: 0.01,
      profile: { type: 'bc', bc: 0.5, model: 'G7' }, modifiedAt: '2000-01-01T00:00:00.000Z' // long before localModifiedAt
    }],
    rifles: []
  })];
  fireEvent(input, 'change');
  await settle();

  const modeSelect = byId(container, 'import-conflict-mode');
  modeSelect.value = 'overwriteIfNewer';
  fireEvent(modeSelect, 'change');

  const importButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.importButton');
  fireEvent(importButton, 'click');

  const bullets = loadUserBullets();
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].manufacturer, 'Original', 'an older import must not overwrite a newer local entry');
  assert.equal(bullets[0].modifiedAt, localModifiedAt);
  assert.ok(container.textContent.includes(t('arsenal.importSummary', { saved: 0, skipped: 1 })));
});

test('"Load library" can be cancelled from the import dialog without importing anything', async () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  const input = findByTag(container, 'INPUT').find((n) => n.attributes.type === 'file');
  input.files = [fakeExportFile({ bullets: [{ id: 'file-b1', name: 'Imported Bullet' }], rifles: [] })];
  fireEvent(input, 'change');
  await settle();

  const cancelButton = findByTag(container, 'BUTTON').find((b) => b.getAttribute('data-i18n') === 'arsenal.cancelButton');
  fireEvent(cancelButton, 'click');

  assert.deepEqual(loadUserBullets(), []);
  assert.equal(byId(container, 'import-bullet-file-b1'), undefined, 'the dialog should be closed');
});

// === Comparison ===

function setupTwoRifles() {
  saveUserRifle({
    id: 'rifle-1', name: 'Rifle One',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [
      { id: 'c1', name: 'Load 1', muzzleVelocity: 800, bulletId: 'swiss-gp11' },
      { id: 'c2', name: 'Load 2', muzzleVelocity: 820, bulletId: 'swiss-gp11' }
    ]
  });
  saveUserRifle({
    id: 'rifle-2', name: 'Rifle Two',
    defaultSightHeightM: 0.05, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [
      { id: 'c3', name: 'Load 3', muzzleVelocity: 830, bulletId: 'swiss-gp11' }
    ]
  });
}

// One toggle per rifle row that has at least one cartridge — labeled "Add
// to comparison"/"Remove from comparison" depending on whether the row's
// currently-selected cartridge (its own <select class="arsenal-active-
// cartridge">) is marked. Re-queried fresh by every caller rather than
// cached, since clicking one re-renders the whole rifle list.
function compareToggleButtons(container) {
  return findByTag(container, 'BUTTON').filter((b) => b.className && b.className.includes('arsenal-compare-toggle'));
}

test('the "for comparison" summary is absent when nothing is selected', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  assert.equal(findAnyById(container, 'i18n-arsenal-forComparisonLabel'), null);
});

test('marking a rifle+cartridge for comparison shows it in the "for comparison" summary with a remove control', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  const toggle = compareToggleButtons(container)[0];
  assert.equal(toggle.textContent, t('arsenal.addToComparisonButton'));
  fireEvent(toggle, 'click');

  assert.ok(findAnyById(container, 'i18n-arsenal-forComparisonLabel'), 'expected the "For comparison" heading to appear');
  assert.deepEqual(getComparisonSelection(), [{ rifleId: 'rifle-1', cartridgeId: 'c1' }]);

  const removeButtons = findByTag(container, 'BUTTON').filter((b) => b.getAttribute('data-i18n') === 'arsenal.removeFromComparisonButton');
  assert.ok(removeButtons.length > 0, 'expected at least one "Remove from comparison" control');
});

test('the same rifle+cartridge cannot be added twice — the row\'s own toggle switches to "Remove from comparison" instead', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(compareToggleButtons(container)[0], 'click');

  const toggleAfter = compareToggleButtons(container)[0];
  assert.equal(toggleAfter.textContent, t('arsenal.removeFromComparisonButton'));
  assert.deepEqual(getComparisonSelection(), [{ rifleId: 'rifle-1', cartridgeId: 'c1' }]);
});

test('the same rifle with a different cartridge can also be marked for comparison', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  const rifle1Select = () => findByTag(container, 'SELECT').find((s) => s.className === 'arsenal-active-cartridge');
  const rifle1Toggle = () => compareToggleButtons(container)[0];

  fireEvent(rifle1Toggle(), 'click'); // select defaults to its first option (c1) — adds rifle-1/c1

  rifle1Select().value = 'c2';
  fireEvent(rifle1Select(), 'change');
  assert.equal(rifle1Toggle().textContent, t('arsenal.addToComparisonButton'), 'a different cartridge on the same rifle is a different pair, so still addable');
  fireEvent(rifle1Toggle(), 'click');

  assert.deepEqual(getComparisonSelection(), [
    { rifleId: 'rifle-1', cartridgeId: 'c1' },
    { rifleId: 'rifle-1', cartridgeId: 'c2' }
  ]);
});

test('a third "add to comparison" is disabled once two configs are already selected', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(compareToggleButtons(container)[0], 'click'); // rifle-1/c1
  fireEvent(compareToggleButtons(container)[1], 'click'); // rifle-2/c3

  // Switch rifle-1's own picker to its other cartridge (c2) — not yet
  // selected, so its toggle should read "Add" but be disabled, since both
  // comparison slots are already taken by c1 and rifle-2's c3.
  const rifle1Select = findByTag(container, 'SELECT').find((s) => s.className === 'arsenal-active-cartridge');
  rifle1Select.value = 'c2';
  fireEvent(rifle1Select, 'change');

  const rifle1Toggle = compareToggleButtons(container)[0];
  assert.equal(rifle1Toggle.textContent, t('arsenal.addToComparisonButton'));
  assert.equal(rifle1Toggle.disabled, true);
});

test('the Comparison section only appears once exactly two configs are selected', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  assert.equal(findAnyById(container, 'comparison-section').childNodes.length, 0);

  fireEvent(compareToggleButtons(container)[0], 'click');
  assert.equal(findAnyById(container, 'comparison-section').childNodes.length, 0, 'still only one selected — section stays empty');

  fireEvent(compareToggleButtons(container)[1], 'click');
  assert.ok(findAnyById(container, 'comparison-section').childNodes.length > 0, 'two selected — the Comparison section should now render automatically');
});

test('removing one of two selected configs makes the Comparison section disappear again', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(compareToggleButtons(container)[0], 'click');
  fireEvent(compareToggleButtons(container)[1], 'click');
  assert.ok(findAnyById(container, 'comparison-section').childNodes.length > 0);

  const removeButtons = findByTag(container, 'BUTTON').filter((b) => b.getAttribute('data-i18n') === 'arsenal.removeFromComparisonButton');
  fireEvent(removeButtons[0], 'click');

  assert.equal(findAnyById(container, 'comparison-section').childNodes.length, 0);
});

test('deleting a rifle that has a config marked for comparison removes it from the comparison selection', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(compareToggleButtons(container)[0], 'click'); // rifle-1/c1
  fireEvent(compareToggleButtons(container)[1], 'click'); // rifle-2/c3
  assert.equal(getComparisonSelection().length, 2);

  const deleteButtons = findByTag(container, 'BUTTON').filter((b) => b.getAttribute('data-i18n') === 'arsenal.deleteButton');
  fireEvent(deleteButtons[0], 'click'); // rifle-1's delete button (bullet rows come first but there are none here)

  assert.deepEqual(getComparisonSelection(), [{ rifleId: 'rifle-2', cartridgeId: 'c3' }]);
  assert.equal(findAnyById(container, 'comparison-section').childNodes.length, 0, 'back below two — the Comparison section should be gone');
});

test('deleting a cartridge that is marked for comparison removes it from the comparison selection', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(compareToggleButtons(container)[0], 'click'); // rifle-1/c1
  fireEvent(compareToggleButtons(container)[1], 'click'); // rifle-2/c3

  activateRifleRow(container, 'Rifle One'); // its Cartridges section is only shown while active

  // Scoped to the cartridges sub-section specifically — the top "for
  // comparison" summary also has a row whose text includes "Load 1", so a
  // container-wide search would find the wrong one.
  const cartridgesHeading = findAnyById(container, 'i18n-arsenal-cartridgesHeading');
  const cartridgesSection = cartridgesHeading.parentNode;
  const cartridgeRow = findByClass(cartridgesSection, 'arsenal-row').find((row) => row.textContent.includes('Load 1'));
  const [, cartridgeDeleteButton] = findByClass(cartridgeRow, 'arsenal-row-actions')[0].childNodes;
  fireEvent(cartridgeDeleteButton, 'click');

  assert.deepEqual(getComparisonSelection(), [{ rifleId: 'rifle-2', cartridgeId: 'c3' }]);
});

test('the Comparison chart offers the same column choices as the Trajectory chart, including energy with its unit suffix', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(compareToggleButtons(container)[0], 'click');
  fireEvent(compareToggleButtons(container)[1], 'click');

  const select = byId(container, 'comparisonChartColumn');
  assert.ok(select, 'expected a select with id="comparisonChartColumn"');
  const optionValues = select.childNodes.map((o) => o.attributes.value);
  assert.deepEqual(optionValues, [
    'dropCm', 'windageCm', 'elevClicks', 'windClicks', 'elevMrad', 'windMrad',
    'elevMOA', 'windMOA', 'velocity', 'tof', 'mach', 'energy'
  ]);
  assert.equal(select.value, 'dropCm');

  const energyOption = select.childNodes.find((o) => o.attributes.value === 'energy');
  assert.ok(energyOption.textContent.includes('(J)'), `expected the energy option to show its unit, got "${energyOption.textContent}"`);
});

test('the Comparison chart shows a legend naming both configurations', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(compareToggleButtons(container)[0], 'click');
  fireEvent(compareToggleButtons(container)[1], 'click');

  const legend = findByClass(container, 'chart-legend')[0];
  assert.ok(legend, 'expected a chart legend element');
  assert.ok(legend.textContent.includes('Rifle One') && legend.textContent.includes('Load 1'));
  assert.ok(legend.textContent.includes('Rifle Two') && legend.textContent.includes('Load 3'));
});

test('the Comparison chart\'s X axis is labeled "Distance" with the current distance unit', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(compareToggleButtons(container)[0], 'click');
  fireEvent(compareToggleButtons(container)[1], 'click');

  const axisLabel = findByClass(container, 'chart-axis-label')[0];
  assert.ok(axisLabel, 'expected a chart-axis-label element');
  assert.equal(axisLabel.textContent, `${t('arsenal.distanceAxisLabel')} (m)`);
});

test('the Comparison section has its own max-range input and zoom/pan sliders, like the Trajectory chart', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(compareToggleButtons(container)[0], 'click');
  fireEvent(compareToggleButtons(container)[1], 'click');

  const maxRangeInput = byId(container, 'maxRange');
  assert.ok(maxRangeInput, 'expected a max-range input');
  // Regression guard: this field previously used a bespoke id
  // ("comparisonMaxRange") with neither a FIELD_UNITS entry nor a locale
  // translation, so its label fell back to the raw, untranslated key in
  // every language — reusing the Trajectory page's own "maxRange" id
  // fixes both at once (see the comment where the field is built).
  const label = maxRangeInput.parentNode.childNodes.find((n) => n.tagName === 'LABEL');
  assert.ok(label.textContent.startsWith(t('fields.maxRange')), `expected a real "Max range" label, got "${label.textContent}"`);

  const rangeInputs = findByTag(container, 'INPUT').filter((i) => i.attributes.type === 'range');
  assert.ok(rangeInputs.length >= 2, 'expected the comparison chart\'s own view-start/view-end zoom sliders');
});

test('regression: editing max-range down to a transient blank value must not poison the zoom sliders with NaN', () => {
  setupTwoRifles();
  const container = makeElement('main');
  arsenalView.mount(container);

  fireEvent(compareToggleButtons(container)[0], 'click');
  fireEvent(compareToggleButtons(container)[1], 'click');

  const maxRangeInput = byId(container, 'maxRange');
  // <input type=number> reports '' for a transient invalid/mid-edit state
  // (e.g. selecting the field's text to retype it) — this used to fire
  // onInput with NaN and permanently corrupt the zoom sliders (see
  // src/ui/unit-field.js's isValidRaw guard and src/ui/zoom-range-slider.js's
  // setBounds finite guard).
  maxRangeInput.value = '';
  fireEvent(maxRangeInput, 'input');

  const rangeInputs = findByTag(container, 'INPUT').filter((i) => i.attributes.type === 'range');
  for (const input of rangeInputs) {
    assert.ok(!Number.isNaN(parseFloat(input.min)), `slider min was NaN: ${input.min}`);
    assert.ok(!Number.isNaN(parseFloat(input.max)), `slider max was NaN: ${input.max}`);
    assert.ok(!Number.isNaN(parseFloat(input.value)), `slider value was NaN: ${input.value}`);
  }

  // A subsequent real edit must also recover cleanly (proving the sliders'
  // internal state wasn't left permanently poisoned).
  maxRangeInput.value = '1500';
  fireEvent(maxRangeInput, 'input');
  for (const input of rangeInputs) {
    assert.ok(!Number.isNaN(parseFloat(input.value)), `slider value was NaN after recovery: ${input.value}`);
  }
});

// === Caliber/manufacturer filters ===
//
// bulletCaliberLabel() falls back to a raw "X.XXmm" string until
// loadCaliberDesignations() resolves (an async fetch — see warm-catalogs.js
// for why that's real, not-instant, disk I/O elsewhere in this suite), and
// none of these tests await it: mount() is synchronous, so every assertion
// below runs before that promise has a chance to settle, and consistently
// sees the raw-mm fallback. The filter logic itself doesn't care what the
// label text actually is, only that equal calibers produce equal labels —
// so this is deliberate, not an oversight.
const CALIBER_A_M = 0.00708; // -> "7.08mm"
const CALIBER_B_M = 0.00650; // -> "6.50mm"
const CALIBER_A_LABEL = '7.08mm';
const CALIBER_B_LABEL = '6.50mm';

function saveTestBullet({ id, manufacturer, caliberM }) {
  return saveUserBullet({ id, name: `${manufacturer} bullet`, manufacturer, caliberM, massKg: 0.01, profile: { type: 'bc', bc: 0.4, model: 'G1' } });
}

function saveTestRifle({ id, name, bulletId }) {
  return saveUserRifle({
    id, name,
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: bulletId ? [{ id: `${id}-c1`, name: 'Load 1', muzzleVelocity: 800, bulletId }] : []
  });
}

test('the filter card is hidden when the Arsenal is empty', () => {
  const container = makeElement('main');
  arsenalView.mount(container);
  assert.equal(findAnyById(container, 'arsenal-filter-card').style.display, 'none');
});

test('the filter card appears once anything is saved, offering only calibers/manufacturers actually present', () => {
  saveTestBullet({ id: 'b1', manufacturer: 'Lapua', caliberM: CALIBER_A_M });

  const container = makeElement('main');
  arsenalView.mount(container);

  assert.equal(findAnyById(container, 'arsenal-filter-card').style.display, '');
  const caliberOptions = byId(container, 'arsenal-caliber-filter').childNodes.map((o) => o.attributes.value);
  const manufacturerOptions = byId(container, 'arsenal-manufacturer-filter').childNodes.map((o) => o.attributes.value);
  assert.deepEqual(caliberOptions, ['__all__', CALIBER_A_LABEL]);
  assert.deepEqual(manufacturerOptions, ['__all__', 'Lapua']);
});

test('the caliber filter narrows both the rifle and the bullet list', () => {
  saveTestBullet({ id: 'b1', manufacturer: 'Lapua', caliberM: CALIBER_A_M });
  saveTestBullet({ id: 'b2', manufacturer: 'Sierra', caliberM: CALIBER_B_M });
  saveTestRifle({ id: 'r1', name: 'Rifle A', bulletId: 'b1' });
  saveTestRifle({ id: 'r2', name: 'Rifle B', bulletId: 'b2' });

  const container = makeElement('main');
  arsenalView.mount(container);

  byId(container, 'arsenal-caliber-filter').value = CALIBER_A_LABEL;
  fireEvent(byId(container, 'arsenal-caliber-filter'), 'change');

  const rifleNames = findByClass(container, 'arsenal-row-info').map((n) => n.textContent);
  assert.ok(rifleNames.some((t2) => t2.includes('Rifle A')));
  assert.ok(!rifleNames.some((t2) => t2.includes('Rifle B')));
  assert.ok(rifleNames.some((t2) => t2.includes('Lapua bullet')));
  assert.ok(!rifleNames.some((t2) => t2.includes('Sierra bullet')));
});

test('the manufacturer filter narrows the bullet list directly, and the rifle list to rifles with a matching bullet', () => {
  saveTestBullet({ id: 'b1', manufacturer: 'Lapua', caliberM: CALIBER_A_M });
  saveTestBullet({ id: 'b2', manufacturer: 'Sierra', caliberM: CALIBER_A_M });
  saveTestRifle({ id: 'r1', name: 'Rifle A', bulletId: 'b1' }); // carries a Lapua bullet
  saveTestRifle({ id: 'r2', name: 'Rifle B', bulletId: 'b2' }); // carries only a Sierra bullet

  const container = makeElement('main');
  arsenalView.mount(container);

  byId(container, 'arsenal-manufacturer-filter').value = 'Lapua';
  fireEvent(byId(container, 'arsenal-manufacturer-filter'), 'change');

  const rowTexts = findByClass(container, 'arsenal-row-info').map((n) => n.textContent);
  assert.ok(rowTexts.some((t2) => t2.includes('Lapua bullet')));
  assert.ok(!rowTexts.some((t2) => t2.includes('Sierra bullet')), 'the manufacturer filter should hide the non-matching bullet');
  // A rifle has no manufacturer of its own, but is hidden transitively:
  // Rifle A carries a Lapua bullet and stays; Rifle B, with no Lapua
  // bullet on any of its cartridges, is hidden.
  assert.ok(rowTexts.some((t2) => t2.includes('Rifle A')), 'Rifle A carries a Lapua bullet and should stay visible');
  assert.ok(!rowTexts.some((t2) => t2.includes('Rifle B')), 'Rifle B has no Lapua bullet and should be hidden');
});

test('selecting a caliber narrows the manufacturer options to those with bullets in that caliber', () => {
  saveTestBullet({ id: 'b1', manufacturer: 'Lapua', caliberM: CALIBER_A_M });
  saveTestBullet({ id: 'b2', manufacturer: 'Sierra', caliberM: CALIBER_B_M });

  const container = makeElement('main');
  arsenalView.mount(container);

  byId(container, 'arsenal-caliber-filter').value = CALIBER_A_LABEL;
  fireEvent(byId(container, 'arsenal-caliber-filter'), 'change');

  const manufacturerOptions = byId(container, 'arsenal-manufacturer-filter').childNodes.map((o) => o.attributes.value);
  assert.deepEqual(manufacturerOptions, ['__all__', 'Lapua']);
});

test('selecting a manufacturer narrows calibers to that manufacturer\'s own bullets and rifles', () => {
  saveTestBullet({ id: 'b1', manufacturer: 'Lapua', caliberM: CALIBER_A_M });
  saveTestBullet({ id: 'b2', manufacturer: 'Sierra', caliberM: CALIBER_B_M });
  // Rifle C carries only a Hornady bullet — no cartridge of it points at
  // a Lapua bullet, so filtering by Lapua hides Rifle C entirely, and its
  // caliber (9.10mm, not shared by any Lapua bullet either) must not be
  // offered — offering it would just filter down to nothing.
  saveTestBullet({ id: 'b3', manufacturer: 'Hornady', caliberM: 0.0091 }); // -> "9.10mm"
  saveTestRifle({ id: 'r1', name: 'Rifle C', bulletId: 'b3' });
  // Rifle D also carries a Lapua bullet, in a caliber no Lapua bullet
  // otherwise has on its own — that caliber must stay offered, since
  // Rifle D itself would still be shown.
  saveTestBullet({ id: 'b4', manufacturer: 'Lapua', caliberM: 0.00650 }); // -> "6.50mm", same as CALIBER_B
  saveTestRifle({ id: 'r2', name: 'Rifle D', bulletId: 'b4' });

  const container = makeElement('main');
  arsenalView.mount(container);

  byId(container, 'arsenal-manufacturer-filter').value = 'Lapua';
  fireEvent(byId(container, 'arsenal-manufacturer-filter'), 'change');

  const caliberOptions = byId(container, 'arsenal-caliber-filter').childNodes.map((o) => o.attributes.value);
  assert.ok(caliberOptions.includes(CALIBER_A_LABEL), 'Lapua\'s own bullet caliber must stay offered');
  assert.ok(caliberOptions.includes(CALIBER_B_LABEL), 'Rifle D (a Lapua rifle) has this caliber, so it must stay offered too');
  assert.ok(!caliberOptions.includes('9.10mm'), 'Rifle C has no Lapua bullet, so its caliber should be narrowed out');
});

test('a rifle with no cartridges has no manufacturer either, so it\'s hidden by any specific manufacturer filter', () => {
  saveTestBullet({ id: 'b1', manufacturer: 'Lapua', caliberM: CALIBER_A_M });
  saveTestRifle({ id: 'r1', name: 'Bare Rifle', bulletId: null });

  const container = makeElement('main');
  arsenalView.mount(container);

  const rowTexts = () => findByClass(container, 'arsenal-row-info').map((n) => n.textContent);
  assert.ok(rowTexts().some((t2) => t2.includes('Bare Rifle')), 'visible under "All manufacturers"');

  byId(container, 'arsenal-manufacturer-filter').value = 'Lapua';
  fireEvent(byId(container, 'arsenal-manufacturer-filter'), 'change');
  assert.ok(!rowTexts().some((t2) => t2.includes('Bare Rifle')), 'hidden once a specific manufacturer is selected');
});

test('Reset filters restores both filters to "All" and un-filters both lists', () => {
  saveTestBullet({ id: 'b1', manufacturer: 'Lapua', caliberM: CALIBER_A_M });
  saveTestBullet({ id: 'b2', manufacturer: 'Sierra', caliberM: CALIBER_B_M });
  saveTestRifle({ id: 'r1', name: 'Rifle A', bulletId: 'b1' });

  const container = makeElement('main');
  arsenalView.mount(container);

  byId(container, 'arsenal-caliber-filter').value = CALIBER_A_LABEL;
  fireEvent(byId(container, 'arsenal-caliber-filter'), 'change');
  byId(container, 'arsenal-manufacturer-filter').value = 'Lapua';
  fireEvent(byId(container, 'arsenal-manufacturer-filter'), 'change');

  let rowTexts = findByClass(container, 'arsenal-row-info').map((n) => n.textContent);
  assert.ok(!rowTexts.some((t2) => t2.includes('Sierra bullet')), 'sanity check: filters are actually narrowing the list');

  fireEvent(findAnyById(container, 'arsenal-reset-filters'), 'click');

  assert.equal(byId(container, 'arsenal-caliber-filter').value, '__all__');
  assert.equal(byId(container, 'arsenal-manufacturer-filter').value, '__all__');
  rowTexts = findByClass(container, 'arsenal-row-info').map((n) => n.textContent);
  assert.ok(rowTexts.some((t2) => t2.includes('Sierra bullet')), 'Sierra bullet should be back after resetting');
});

test('an empty Arsenal shows the plain "nothing saved" hints, not the "filtered" ones', () => {
  const container = makeElement('main');
  arsenalView.mount(container);

  assert.ok(container.textContent.includes(t('arsenal.noBullets')));
  assert.ok(container.textContent.includes(t('arsenal.noRifles')));
  assert.ok(!container.textContent.includes(t('arsenal.noBulletsFiltered')));
  assert.ok(!container.textContent.includes(t('arsenal.noRiflesFiltered')));
});

test('a caliber filter that matches bullets but no rifle shows the rifle list\'s "no match" hint, not "nothing saved"', () => {
  saveTestBullet({ id: 'b1', manufacturer: 'Lapua', caliberM: CALIBER_A_M });
  // A rifle does exist — it just has no cartridges, so no caliber, so it
  // can never match a *specific* caliber filter (only "All"). Without
  // this, the rifle list would be empty because nothing was saved at
  // all, which is a different case (and a different message) entirely.
  saveTestRifle({ id: 'r1', name: 'Bare Rifle', bulletId: null });

  const container = makeElement('main');
  arsenalView.mount(container);

  byId(container, 'arsenal-caliber-filter').value = CALIBER_A_LABEL;
  fireEvent(byId(container, 'arsenal-caliber-filter'), 'change');

  assert.ok(container.textContent.includes(t('arsenal.noRiflesFiltered')));
  assert.ok(!container.textContent.includes(t('arsenal.noRifles')));
});
