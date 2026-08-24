import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, fireEvent } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
// See warm-catalogs.js — every await settle() below assumes the built-in
// catalogs are already cache-warm, not racing a cold, contention-prone fetch.
await warmCatalogs();

const { bulletSection } = await import('../src/ui/sections/bullet-section.js');
const { resetShotStateForTests } = await import('../src/shot-state.js');
const { isBulletLibraryVisible, setBulletLibraryVisible, resetBulletLibraryPrefsForTests } = await import('../src/bullet-library-prefs.js');
const { saveUserBullet } = await import('../src/user-library.js');
const { setDragModelVisible, resetDragModelPrefsForTests } = await import('../src/drag-model-prefs.js');
const { removeCookie } = await import('../src/cookies.js');
const { setUnit, resetUnits } = await import('../src/prefs.js');

const DRAG_MODEL_COOKIE_NAME = 'ballistics_hidden_drag_models_v1';
const BULLET_LIBRARY_COOKIE_NAME = 'ballistics_hidden_bullet_libraries_v1';

// Shared shot state is a module-level singleton (by design — see
// shot-state.js), so each test needs a clean slate the same way
// cookie-backed state needs removeCookie(); the Arsenal (localStorage)
// and the bullet-library/drag-model cookies need the same treatment.
test.beforeEach(() => {
  resetShotStateForTests();
  localStorage.clear();
  resetBulletLibraryPrefsForTests();
  removeCookie(BULLET_LIBRARY_COOKIE_NAME);
  resetDragModelPrefsForTests();
  removeCookie(DRAG_MODEL_COOKIE_NAME);
  resetUnits();
});

function settle(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT' || node.tagName === 'SELECT') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

function byId(node, id) {
  return findInputs(node).find((n) => n.id === id);
}

// For non-input elements (hints, the info box) — applyI18nText() gives
// every translated element a stable, derived id from its key.
function findAnyById(node, id) {
  if (node.id === id) return node;
  for (const child of node.childNodes || []) {
    const found = findAnyById(child, id);
    if (found) return found;
  }
  return null;
}

function optionValues(select) {
  return select.childNodes.map((o) => o.attributes.value);
}

// Mirrors bulletSection's own catalog-resolution + designation lookup, so
// filter tests can assert against what the *data* actually contains
// instead of a hand-maintained literal list that goes stale (and silently
// stops testing anything real) every time a bullet is added or removed.
async function resolvedCatalog() {
  const { loadBulletCatalog, loadBullet, loadCaliberDesignations, designationFor } = await import('../src/bullets.js');
  const designations = await loadCaliberDesignations();
  const bullets = await Promise.all(loadBulletCatalog().map((id) => loadBullet(id)));
  return bullets.map((b) => ({ ...b, designation: designationFor(b.caliberM, designations) }));
}

test('defaults to "Other" with manual bc/dragModel fields, before the catalog even loads', () => {
  const bullet = bulletSection();
  const bulletSelect = byId(bullet.node, 'bulletSelect');
  assert.equal(bulletSelect.value, '__other__');
  const values = bullet.getValues();
  assert.equal(values.bc, 0.274);
  assert.equal(values.dragModel, 'G7');
  // massKg round-trips through the mass field's own kg<->g conversion, so
  // 0.0113 comes back as a binary-float-imprecise neighbor, not the exact
  // literal — same reasoning as every other float comparison in this file.
  assert.ok(Math.abs(values.massKg - 0.0113) < 1e-9);
});

test('the "Other" bullet has a manual mass field (grams/grains), feeding massKg into getValues()', () => {
  const bullet = bulletSection();
  const gramsInput = byId(bullet.node, 'massGrams');
  const grainsInput = byId(bullet.node, 'massGrains');
  assert.ok(gramsInput, 'expected a mass input in grams');
  assert.equal(gramsInput.value, '11.3'); // 0.0113kg default, matching manualMassKg
  assert.equal(grainsInput.value, '174.4');

  gramsInput.value = '5';
  fireEvent(gramsInput, 'input');
  assert.ok(Math.abs(bullet.getValues().massKg - 0.005) < 1e-9);
});

test('the manual mass field is hidden once a library bullet is selected, and reappears when switching back to "Other"', async () => {
  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'swiss-gp90';
  fireEvent(bulletSelect, 'change');

  // massGrams's own wrapper (mass-dual-inputs) -> the mass field's outer
  // ".field" div, the node whose visibility showLibraryInfo()/
  // showManualFields() actually toggle.
  const gramsInput = byId(bullet.node, 'massGrams');
  assert.equal(gramsInput.parentNode.parentNode.style.display, 'none');

  bulletSelect.value = '__other__';
  fireEvent(bulletSelect, 'change');
  assert.equal(gramsInput.parentNode.parentNode.style.display, '');
});

test('a manually-entered mass in one instance is the initial value of the next one', () => {
  const first = bulletSection();
  const gramsInput = byId(first.node, 'massGrams');
  gramsInput.value = '12.5';
  fireEvent(gramsInput, 'input');

  const second = bulletSection();
  assert.ok(Math.abs(second.getValues().massKg - 0.0125) < 1e-9);
});

// Deep coverage of the picker<->number-field matching/sync behavior itself
// lives in caliber-field.test.js — these just check bullet-section.js
// wires that shared component up correctly (values flow into
// getStabilityValues()/getArsenalPrefill(), visibility toggles with the
// rest of manual entry, persists across instances).
test('the "Other" bullet has manual caliber/length fields, defaulting to GP11\'s own values and feeding getStabilityValues()', async () => {
  const bullet = bulletSection();
  const caliberSelect = byId(bullet.node, 'bulletCaliber');
  const caliberNumber = byId(bullet.node, 'bulletCaliberMm');
  const lengthInput = byId(bullet.node, 'bulletLength');
  assert.ok(caliberSelect, 'expected a caliber picker');
  assert.ok(caliberNumber, 'expected a manual caliber number field');
  assert.ok(lengthInput, 'expected a manual length input');
  assert.equal(caliberNumber.value, '7.78');
  assert.equal(lengthInput.value, '35.00');

  await settle(); // caliber-field.js's own designation list resolves async
  assert.equal(caliberSelect.value, '7.5mm(CH)', 'GP11\'s own real caliber, matched exactly');

  const stability = bullet.getStabilityValues();
  assert.ok(Math.abs(stability.caliberM - 0.00778) < 1e-9);
  assert.ok(Math.abs(stability.lengthM - 0.035) < 1e-9);
});

// Regression test for a real bug: this manual length field used to be
// hardcoded to mm regardless of the user's own smallLength preference —
// the same bug caliber-field.test.js already covers for the sibling
// manual caliber field (which is a shared component with Arsenal's own
// bullet form), fixed here by switching to the equally-shared
// bullet-length-field.js.
test('with the smallLength preference set to inches, the manual length field renders and reads back in inches', async () => {
  setUnit('smallLength', 'in');
  const bullet = bulletSection();
  await settle();
  const lengthInput = byId(bullet.node, 'bulletLength');
  // GP11's own default length (0.035m = 35mm = 1.378in).
  assert.equal(lengthInput.value, '1.378');

  lengthInput.value = '1.000';
  fireEvent(lengthInput, 'input');
  const stability = bullet.getStabilityValues();
  assert.ok(Math.abs(stability.lengthM - 0.0254) < 1e-6, 'should still be stored in meters');
});

test('editing the manual caliber/length fields updates getStabilityValues() and getArsenalPrefill()', () => {
  const bullet = bulletSection();
  const caliberNumber = byId(bullet.node, 'bulletCaliberMm');
  const lengthInput = byId(bullet.node, 'bulletLength');

  caliberNumber.value = '6.5';
  fireEvent(caliberNumber, 'input');
  lengthInput.value = '32.4';
  fireEvent(lengthInput, 'input');

  const stability = bullet.getStabilityValues();
  assert.ok(Math.abs(stability.caliberM - 0.0065) < 1e-9);
  assert.ok(Math.abs(stability.lengthM - 0.0324) < 1e-9);

  const prefill = bullet.getArsenalPrefill();
  assert.ok(Math.abs(prefill.caliberM - 0.0065) < 1e-9);
  assert.ok(Math.abs(prefill.lengthM - 0.0324) < 1e-9);
});

test('blanking the manual caliber/length fields reports stability as unknown, not zero', () => {
  const bullet = bulletSection();
  const caliberNumber = byId(bullet.node, 'bulletCaliberMm');
  const lengthInput = byId(bullet.node, 'bulletLength');

  caliberNumber.value = '';
  fireEvent(caliberNumber, 'input');
  lengthInput.value = '';
  fireEvent(lengthInput, 'input');

  const stability = bullet.getStabilityValues();
  assert.equal(stability.caliberM, null);
  assert.equal(stability.lengthM, null);
  assert.equal(bullet.getArsenalPrefill().caliberM, null);
  assert.equal(bullet.getArsenalPrefill().lengthM, null);
});

test('the manual caliber/length fields are hidden once a library bullet is selected, and reappear when switching back to "Other"', async () => {
  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'swiss-gp90';
  fireEvent(bulletSelect, 'change');

  const lengthInput = byId(bullet.node, 'bulletLength');
  // lengthInput -> its own ".field" wrapper -> the shared caliber+length
  // container whose visibility showLibraryInfo()/showManualFields() toggle.
  assert.equal(lengthInput.parentNode.parentNode.style.display, 'none');
  // The library bullet's own caliber/length instead show up in the plain
  // summary text, same as mass — see showLibraryInfo().
  assert.ok(bullet.node.textContent.includes('mm'));

  bulletSelect.value = '__other__';
  fireEvent(bulletSelect, 'change');
  assert.equal(lengthInput.parentNode.parentNode.style.display, '');
});

test('a manually-entered caliber/length in one instance is the initial value of the next one', () => {
  const first = bulletSection();
  const caliberNumber = byId(first.node, 'bulletCaliberMm');
  const lengthInput = byId(first.node, 'bulletLength');
  caliberNumber.value = '5.56';
  fireEvent(caliberNumber, 'input');
  lengthInput.value = '23.0';
  fireEvent(lengthInput, 'input');

  const second = bulletSection();
  const stability = second.getStabilityValues();
  assert.ok(Math.abs(stability.caliberM - 0.00556) < 1e-9);
  assert.ok(Math.abs(stability.lengthM - 0.023) < 1e-9);
});

test('the picker is populated with every catalog entry once the catalog resolves', async () => {
  const { loadBulletCatalog } = await import('../src/bullets.js');
  const bullet = bulletSection();
  await settle();
  const bulletSelect = byId(bullet.node, 'bulletSelect');
  assert.equal(bulletSelect.childNodes.length, loadBulletCatalog().length + 1); // "Other" + every bullet
});

test('selecting a BC-profile library bullet replaces getValues() with its bc/model', async () => {
  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'swiss-gp90';
  fireEvent(bulletSelect, 'change');

  assert.deepEqual(bullet.getValues(), { bc: 0.166, dragModel: 'G7', massKg: 0.0041 });
});

test('selecting a cdTable-profile library bullet returns cdTable/massKg/caliberM instead of bc', async () => {
  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'hrr-30-eldm-208';
  fireEvent(bulletSelect, 'change');

  const values = bullet.getValues();
  assert.equal('bc' in values, false);
  assert.ok(Math.abs(values.massKg - 0.01348) < 1e-9);
  assert.ok(Math.abs(values.caliberM - 0.0078232) < 1e-9);
  assert.ok(Array.isArray(values.cdTable) && values.cdTable.length > 10);
});

test('switching back to "Other" restores manual entry', async () => {
  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'swiss-gp90';
  fireEvent(bulletSelect, 'change');
  assert.equal(bullet.getValues().bc, 0.166);

  bulletSelect.value = '__other__';
  fireEvent(bulletSelect, 'change');
  const values = bullet.getValues();
  assert.equal(values.bc, 0.274);
  assert.equal(values.dragModel, 'G7');
  assert.ok(Math.abs(values.massKg - 0.0113) < 1e-9);
});

test('selecting a library bullet fires onInput synchronously (the catalog is already fully resolved by selection time)', async () => {
  let calls = 0;
  const bullet = bulletSection({ onInput: () => calls++ });
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'swiss-gp11';
  fireEvent(bulletSelect, 'change');
  assert.equal(calls, 1);
});

test('the caliber filter narrows the picker to matching bullets (by looked-up designation), keeping "Other"', async () => {
  const bullet = bulletSection();
  const catalog = await resolvedCatalog();
  await settle();

  // Picked dynamically from whatever the catalog actually contains,
  // rather than a hardcoded designation string — that name goes stale
  // (and silently stops testing anything meaningful, or starts throwing
  // when it stops existing at all) the moment caliber-designations.json's
  // own labels change, same reasoning as resolvedCatalog() itself above.
  const countByDesignation = new Map();
  for (const b of catalog) countByDesignation.set(b.designation, (countByDesignation.get(b.designation) || 0) + 1);
  const targetDesignation = [...countByDesignation.entries()].find(([, count]) => count > 1)?.[0];
  assert.ok(targetDesignation, 'expected some designation with more than one bullet in the catalog to make this test meaningful');

  const caliberFilter = byId(bullet.node, 'bulletCaliberFilter');
  caliberFilter.value = targetDesignation;
  fireEvent(caliberFilter, 'change');

  const expectedIds = catalog.filter((b) => b.designation === targetDesignation).map((b) => b.id);
  const bulletSelect = byId(bullet.node, 'bulletSelect');
  assert.deepEqual(optionValues(bulletSelect), ['__other__', ...expectedIds]);
});

test('selecting a caliber hides manufacturers that don\'t make anything in it', async () => {
  const bullet = bulletSection();
  const catalog = await resolvedCatalog();
  await settle();

  // Same "derive from live data" reasoning as the test above.
  const manufacturersByDesignation = new Map();
  for (const b of catalog) {
    const set = manufacturersByDesignation.get(b.designation) || new Set();
    set.add(b.manufacturer);
    manufacturersByDesignation.set(b.designation, set);
  }
  const targetDesignation = [...manufacturersByDesignation.entries()].find(([, set]) => set.size > 1)?.[0];
  assert.ok(targetDesignation, 'expected some designation made by more than one manufacturer to make this test meaningful');

  const caliberFilter = byId(bullet.node, 'bulletCaliberFilter');
  const manufacturerFilter = byId(bullet.node, 'bulletManufacturerFilter');

  caliberFilter.value = targetDesignation;
  fireEvent(caliberFilter, 'change');

  const expectedManufacturers = [...manufacturersByDesignation.get(targetDesignation)].sort();
  assert.deepEqual(optionValues(manufacturerFilter), ['__all__', ...expectedManufacturers]);
});

test('selecting a manufacturer hides calibers it doesn\'t produce', async () => {
  const bullet = bulletSection();
  const catalog = await resolvedCatalog();
  await settle();

  const caliberFilter = byId(bullet.node, 'bulletCaliberFilter');
  const manufacturerFilter = byId(bullet.node, 'bulletManufacturerFilter');

  manufacturerFilter.value = 'Hornady';
  fireEvent(manufacturerFilter, 'change');

  // Ordered by bore diameter (caliberM), not alphabetically — matches
  // bullet-section.js's own uniqueCalibersSortedByDiameter().
  const hornadyBullets = catalog.filter((b) => b.manufacturer === 'Hornady');
  const caliberMByDesignation = new Map(hornadyBullets.map((b) => [b.designation, b.caliberM]));
  const expectedCalibers = [...new Set(hornadyBullets.map((b) => b.designation))]
    .sort((a, b) => caliberMByDesignation.get(a) - caliberMByDesignation.get(b));
  assert.ok(expectedCalibers.length > 1, 'expected Hornady to make more than one caliber to make this test meaningful');
  assert.deepEqual(optionValues(caliberFilter), ['__all__', ...expectedCalibers]);
});

test('lockToBullet() selects the bullet, resets filters, and disables every interactive control', async () => {
  const bullet = bulletSection();
  await settle();

  const caliberFilter = byId(bullet.node, 'bulletCaliberFilter');
  const manufacturerFilter = byId(bullet.node, 'bulletManufacturerFilter');
  caliberFilter.value = '6.5 / .264'; // narrow the filters first — locking must still find the target bullet
  fireEvent(caliberFilter, 'change');

  await bullet.lockToBullet('swiss-gp11');

  assert.deepEqual(bullet.getValues(), { bc: 0.274, dragModel: 'G7', massKg: 0.0113 });
  const bulletSelect = byId(bullet.node, 'bulletSelect');
  assert.equal(bulletSelect.value, 'swiss-gp11');
  assert.equal(bulletSelect.disabled, true);
  assert.equal(caliberFilter.disabled, true);
  assert.equal(manufacturerFilter.disabled, true);
  assert.equal(byId(bullet.node, 'bc').disabled, true);
  assert.equal(byId(bullet.node, 'dragModel').disabled, true);
  assert.equal(caliberFilter.parentNode.style.display, 'none');
  assert.equal(manufacturerFilter.parentNode.style.display, 'none');
});

test('lockToBullet() fires onInput', async () => {
  let calls = 0;
  const bullet = bulletSection({ onInput: () => calls++ });
  await settle();
  calls = 0; // ignore whatever catalog-load-triggered calls happened during settle()

  await bullet.lockToBullet('swiss-gp90');
  assert.ok(calls >= 1);
});

test('unlock() restores "Other" and re-enables every control', async () => {
  const bullet = bulletSection();
  await settle();
  await bullet.lockToBullet('swiss-gp90');

  bullet.unlock();

  const unlockedValues = bullet.getValues();
  assert.equal(unlockedValues.bc, 0.274);
  assert.equal(unlockedValues.dragModel, 'G7');
  assert.ok(Math.abs(unlockedValues.massKg - 0.0113) < 1e-9);
  const bulletSelect = byId(bullet.node, 'bulletSelect');
  assert.equal(bulletSelect.value, '__other__');
  assert.equal(bulletSelect.disabled, false);
  const caliberFilter = byId(bullet.node, 'bulletCaliberFilter');
  const manufacturerFilter = byId(bullet.node, 'bulletManufacturerFilter');
  assert.equal(caliberFilter.disabled, false);
  assert.equal(manufacturerFilter.disabled, false);
  assert.equal(byId(bullet.node, 'bc').disabled, false);
  assert.equal(byId(bullet.node, 'dragModel').disabled, false);
  assert.equal(caliberFilter.parentNode.style.display, '');
  assert.equal(manufacturerFilter.parentNode.style.display, '');
});

test('picking a manufacturer that makes a different caliber resets a stale caliber selection to "All calibers"', async () => {
  const bullet = bulletSection();
  await settle();

  const caliberFilter = byId(bullet.node, 'bulletCaliberFilter');
  const manufacturerFilter = byId(bullet.node, 'bulletManufacturerFilter');

  // Poke the caliber filter's value directly without going through its own
  // change handler — narrowing it for real would also narrow the
  // manufacturer options, and "RUAG" (selected next) only makes .338 in
  // this data, not 6.5mm, so it wouldn't be offered anymore. This isolates
  // the specific behavior under test: refreshFilterOptions() must reset a
  // filter's value to "All" when it recomputes and the current value
  // isn't in the new option set, regardless of how that value got there.
  caliberFilter.value = '6.5mm';

  manufacturerFilter.value = 'RUAG';
  fireEvent(manufacturerFilter, 'change');

  assert.equal(caliberFilter.value, '__all__');
});

test('a manually-entered bc/dragModel in one instance is the initial value of the next one', () => {
  const first = bulletSection();
  const bcInput = byId(first.node, 'bc');
  const dragModelSelect = byId(first.node, 'dragModel');
  bcInput.value = '0.55';
  fireEvent(bcInput, 'input');
  dragModelSelect.value = 'G7';
  fireEvent(dragModelSelect, 'change');

  const second = bulletSection();
  const secondValues = second.getValues();
  assert.equal(secondValues.bc, 0.55);
  assert.equal(secondValues.dragModel, 'G7');
  assert.ok(Math.abs(secondValues.massKg - 0.0113) < 1e-9);
});

test('a lockToBullet()/unlock() cycle (rifle-driven) does not overwrite the shared manual entry', async () => {
  const first = bulletSection();
  const bcInput = byId(first.node, 'bc');
  bcInput.value = '0.55';
  fireEvent(bcInput, 'input');

  await first.lockToBullet('swiss-gp90');
  first.unlock();

  const second = bulletSection();
  const secondValues = second.getValues();
  assert.equal(secondValues.bc, 0.55);
  // dragModel/massKg were never touched by this test, only bc — so they
  // still reflect the default, now GP11's G7/0.0113 rather than G1/0.01.
  assert.equal(secondValues.dragModel, 'G7');
  assert.ok(Math.abs(secondValues.massKg - 0.0113) < 1e-9);
});

test('selecting a BC-profile library bullet shows bc/dragModel read-only with its actual values', async () => {
  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'swiss-gp90'; // G7 BC 0.166
  fireEvent(bulletSelect, 'change');

  const bcInput = byId(bullet.node, 'bc');
  const dragModelSelect = byId(bullet.node, 'dragModel');
  assert.equal(bcInput.value, '0.166');
  assert.equal(bcInput.disabled, true);
  assert.equal(dragModelSelect.value, 'G7');
  assert.equal(dragModelSelect.disabled, true);

  const cdTableHint = findAnyById(bullet.node, 'i18n-fields-bulletCustomCdTable');
  assert.equal(cdTableHint.style.display, 'none');
});

test('a library bullet whose drag model is hidden in Settings still displays/selects it correctly', async () => {
  setDragModelVisible('G7', false); // GP90 (below) is a G7 BC bullet

  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'swiss-gp90'; // G7 BC 0.166
  fireEvent(bulletSelect, 'change');

  const dragModelSelect = byId(bullet.node, 'dragModel');
  assert.equal(dragModelSelect.value, 'G7', 'the read-only display must still show the bullet\'s real model, hidden or not');
  assert.equal(dragModelSelect.disabled, true);
  assert.deepEqual(bullet.getValues(), { bc: 0.166, dragModel: 'G7', massKg: 0.0041 });
});

test('selecting a cdTable-profile library bullet hides bc/dragModel and shows the Cd-table indicator instead', async () => {
  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'hrr-30-eldm-208';
  fireEvent(bulletSelect, 'change');

  const bcInput = byId(bullet.node, 'bc');
  const dragModelSelect = byId(bullet.node, 'dragModel');
  // Both fields' shared wrapper (manualFields) is two levels up: input ->
  // its own ".field" div -> manualFields.
  assert.equal(bcInput.parentNode.parentNode.style.display, 'none');
  assert.equal(dragModelSelect.parentNode.parentNode.style.display, 'none');

  const cdTableHint = findAnyById(bullet.node, 'i18n-fields-bulletCustomCdTable');
  assert.equal(cdTableHint.style.display, '');
  // The indicator only says a custom curve is in use — it must not leak
  // the raw Mach/Cd numbers into the DOM anywhere.
  assert.ok(!bullet.node.textContent.includes('0.09946453174643637'), 'a raw Cd-table value leaked into the rendered section');
});

test('switching from a BC-profile library bullet back to "Other" re-enables bc/dragModel', async () => {
  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'swiss-gp90';
  fireEvent(bulletSelect, 'change');
  bulletSelect.value = '__other__';
  fireEvent(bulletSelect, 'change');

  const bcInput = byId(bullet.node, 'bc');
  const dragModelSelect = byId(bullet.node, 'dragModel');
  assert.equal(bcInput.disabled, false);
  assert.equal(dragModelSelect.disabled, false);
});

test('lockToBullet() also shows a BC-profile bullet\'s values read-only (rifle-driven path)', async () => {
  const bullet = bulletSection();
  await bullet.lockToBullet('swiss-gp90');

  const bcInput = byId(bullet.node, 'bc');
  const dragModelSelect = byId(bullet.node, 'dragModel');
  assert.equal(bcInput.value, '0.166');
  assert.equal(bcInput.disabled, true);
  assert.equal(dragModelSelect.value, 'G7');
  assert.equal(dragModelSelect.disabled, true);
});

test('lockToBullet() shows the Cd-table indicator, not raw values, for a cdTable-profile bullet (rifle-driven path)', async () => {
  const bullet = bulletSection();
  await bullet.lockToBullet('hrr-30-eldm-208');

  const cdTableHint = findAnyById(bullet.node, 'i18n-fields-bulletCustomCdTable');
  assert.equal(cdTableHint.style.display, '');
  assert.ok(!bullet.node.textContent.includes('0.09946453174643637'));
});

test('a user Arsenal bullet appears in the picker, prefixed "* ", and is selectable', async () => {
  saveUserBullet({
    id: 'my-custom-bullet', name: 'Custom 168gr', manufacturer: 'Handload',
    caliberM: 0.0078232, massKg: 0.01088622, profile: { type: 'bc', bc: 0.5, model: 'G1' }
  });

  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  const option = bulletSelect.childNodes.find((o) => o.attributes.value === 'my-custom-bullet');
  assert.ok(option, 'expected the user bullet to be offered');
  assert.ok(option.textContent.startsWith('* '), `expected a "* " prefix, got "${option.textContent}"`);

  bulletSelect.value = 'my-custom-bullet';
  fireEvent(bulletSelect, 'change');
  assert.deepEqual(bullet.getValues(), { bc: 0.5, dragModel: 'G1', massKg: 0.01088622 });
});

test('a bullet-library checkbox is always present per library, even with nothing to offer', async () => {
  setBulletLibraryVisible('geladen', false);
  setBulletLibraryVisible('lapua-cd', false);
  const bullet = bulletSection();
  await settle();

  const checkbox = byId(bullet.node, 'bullet-library-geladen');
  assert.ok(checkbox, 'the checkbox itself must never disappear — it\'s the only way back in from this view');
  assert.equal(checkbox.checked, false);
});

test('the bullet picker (but not the checkboxes) is hidden when every built-in library is off and there are no Arsenal bullets', async () => {
  setBulletLibraryVisible('geladen', false);
  setBulletLibraryVisible('lapua-cd', false);
  setBulletLibraryVisible('hornady-reverse', false);
  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  assert.equal(bulletSelect.parentNode.style.display, 'none');
  const values = bullet.getValues();
  assert.equal(values.bc, 0.274);
  assert.equal(values.dragModel, 'G7');
  assert.ok(Math.abs(values.massKg - 0.0113) < 1e-9);
});

test('unchecking a library checkbox live-hides only that library\'s bullets, keeping the user\'s own', async () => {
  saveUserBullet({
    id: 'my-custom-bullet', name: 'Custom 168gr', manufacturer: 'Handload',
    caliberM: 0.0078232, massKg: 0.01088622, profile: { type: 'bc', bc: 0.5, model: 'G1' }
  });

  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  const beforeCount = bulletSelect.childNodes.length;
  assert.ok(beforeCount > 2, 'expected built-ins plus the user bullet before toggling');

  const geladenCheckbox = byId(bullet.node, 'bullet-library-geladen');
  const lapuaCheckbox = byId(bullet.node, 'bullet-library-lapua-cd');
  const hornadyReverseCheckbox = byId(bullet.node, 'bullet-library-hornady-reverse');
  assert.equal(geladenCheckbox.checked, true);
  assert.equal(lapuaCheckbox.checked, true);
  assert.equal(hornadyReverseCheckbox.checked, true);
  geladenCheckbox.checked = false;
  fireEvent(geladenCheckbox, 'change');
  lapuaCheckbox.checked = false;
  fireEvent(lapuaCheckbox, 'change');
  hornadyReverseCheckbox.checked = false;
  fireEvent(hornadyReverseCheckbox, 'change');

  assert.equal(isBulletLibraryVisible('geladen'), false);
  assert.equal(isBulletLibraryVisible('lapua-cd'), false);
  assert.equal(isBulletLibraryVisible('hornady-reverse'), false);
  const values = bulletSelect.childNodes.map((o) => o.attributes.value);
  assert.deepEqual(values, ['__other__', 'my-custom-bullet']);
});

test('a library checkbox persists to a cookie and is shared — a second instance reads the same value', async () => {
  const first = bulletSection();
  await settle();
  const firstCheckbox = byId(first.node, 'bullet-library-geladen');
  firstCheckbox.checked = false;
  fireEvent(firstCheckbox, 'change');

  const second = bulletSection();
  await settle();
  assert.equal(byId(second.node, 'bullet-library-geladen').checked, false);
});

test('lockToBullet() still resolves a built-in bullet even while its own library is off', async () => {
  setBulletLibraryVisible('geladen', false);
  const bullet = bulletSection();
  await bullet.lockToBullet('swiss-gp90');

  assert.deepEqual(bullet.getValues(), { bc: 0.166, dragModel: 'G7', massKg: 0.0041 });
  const bulletSelect = byId(bullet.node, 'bulletSelect');
  assert.equal(bulletSelect.value, 'swiss-gp90');
});

test('unlock() after a lock restores the toggle-respecting picker (built-ins hidden again if their libraries are off)', async () => {
  setBulletLibraryVisible('geladen', false);
  setBulletLibraryVisible('lapua-cd', false);
  setBulletLibraryVisible('hornady-reverse', false);
  const bullet = bulletSection();
  await bullet.lockToBullet('swiss-gp90');
  bullet.unlock();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  assert.deepEqual(optionValues(bulletSelect), ['__other__']);
  assert.equal(bulletSelect.parentNode.style.display, 'none');
});

test('hiding just one library removes only its options and prefix, leaving the other library intact', async () => {
  setBulletLibraryVisible('lapua-cd', false);
  const bullet = bulletSection();
  await settle();

  const bulletSelect = byId(bullet.node, 'bulletSelect');
  const texts = bulletSelect.childNodes.map((o) => o.textContent);
  assert.ok(texts.some((t) => t.includes('[Gldn]')), 'expected a Geladen-library option to remain, prefixed [Gldn]');
  assert.ok(!texts.some((t) => t.includes('[LCd]')), 'expected every Lapua Cd option to be hidden');
});

test('getArsenalPrefill() returns the manual bc/dragModel while "Other" is selected', () => {
  const bullet = bulletSection();
  const bcInput = byId(bullet.node, 'bc');
  bcInput.value = '0.55';
  fireEvent(bcInput, 'input');

  const prefill = bullet.getArsenalPrefill();
  assert.equal(prefill.bc, 0.55);
  assert.equal(prefill.dragModel, 'G7');
  assert.ok(Math.abs(prefill.massKg - 0.0113) < 1e-9);
});

test('getArsenalPrefill() returns the full record for a selected BC-profile library bullet', async () => {
  const bullet = bulletSection();
  await settle();
  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'swiss-gp90';
  fireEvent(bulletSelect, 'change');

  const prefill = bullet.getArsenalPrefill();
  assert.equal(prefill.name, '63gr GP90');
  assert.equal(prefill.manufacturer, 'Military');
  assert.ok(Math.abs(prefill.caliberM - 0.0057) < 1e-9);
  assert.equal(prefill.bc, 0.166);
  assert.equal(prefill.dragModel, 'G7');
});

test('getArsenalPrefill() carries the cdTable itself (not bc/dragModel) for a selected cdTable-profile library bullet', async () => {
  const bullet = bulletSection();
  await settle();
  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'hrr-30-eldm-208';
  fireEvent(bulletSelect, 'change');

  const prefill = bullet.getArsenalPrefill();
  assert.equal('bc' in prefill, false);
  assert.equal('dragModel' in prefill, false);
  assert.equal(prefill.name, '208gr ELD-M');
  assert.ok(Array.isArray(prefill.cdTable) && prefill.cdTable.length > 10, 'the Arsenal form supports cdTable directly now, so it should be carried over instead of dropped');
});

test('a user bullet with no lengthM never renders a literal "NaN" in the info box', async () => {
  saveUserBullet({
    id: 'no-length-bullet', name: 'No Length', manufacturer: 'Handload',
    caliberM: 0.0078232, massKg: 0.01, profile: { type: 'bc', bc: 0.45, model: 'G1' }
    // lengthM deliberately omitted — see bullet-form.js's optional length field
  });

  const bullet = bulletSection();
  await settle();
  const bulletSelect = byId(bullet.node, 'bulletSelect');
  bulletSelect.value = 'no-length-bullet';
  fireEvent(bulletSelect, 'change');

  assert.ok(!bullet.node.textContent.includes('NaN'), `info text should never show NaN: "${bullet.node.textContent}"`);
});
