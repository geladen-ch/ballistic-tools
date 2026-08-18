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

const { rifleSection } = await import('../src/ui/sections/rifle-section.js');
const { isRifleLibraryEnabled, setRifleLibraryEnabled } = await import('../src/library-prefs.js');
const { resetShotStateForTests } = await import('../src/shot-state.js');
const { saveUserRifle } = await import('../src/user-library.js');

// Shared shot state is a module-level singleton (by design — see
// shot-state.js), so each test needs a clean slate the same way
// cookie-backed state needs removeCookie(); the Arsenal (localStorage)
// and the rifle-library cookie need the same treatment.
test.beforeEach(() => {
  resetShotStateForTests();
  localStorage.clear();
  setRifleLibraryEnabled(true);
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

function optionValuesOf(select) {
  return select.childNodes.map((o) => o.attributes.value);
}

// A stand-in for what used to be the built-in "example" rifle (removed
// from the actual library — see rifle-catalog.js) — an Arsenal (user)
// rifle exercises the exact same resolveRifle()/applySelectedRifle() code
// path as a built-in one, so it works identically here as a fixture.
// Deliberately has no defaultRiflingTwistM/defaultTwistDirection (see the
// twist-related tests below, which need a rifle lacking them) and two
// cartridges, one with a temperature dependency and one without (see the
// cartridge-switching tests below).
const TEST_RIFLE_ID = 'test-two-cartridge-rifle';
function saveTestRifle() {
  saveUserRifle({
    id: TEST_RIFLE_ID, name: 'Test Rifle',
    defaultSightHeightM: 0.045, defaultZeroRangeM: 100,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: [
      { id: 'cartridge-a', name: 'Cartridge A', muzzleVelocity: 807.72, bulletId: 'swiss-gp11' },
      {
        id: 'handload-175smk-example', name: 'Hand load, 175gr (example, temp-sensitive)',
        muzzleVelocity: 792.0, referenceTempC: 15, velocityTempSensitivity: 1.2,
        bulletId: 'hornady-30-eldm-208'
      }
    ]
  });
}

test('the rifle picker is populated with "Other" plus every catalog rifle once the catalog resolves', async () => {
  const { loadRifleCatalog } = await import('../src/rifles.js');
  const rifle = rifleSection();
  await settle();

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  assert.ok(rifleSelect, 'expected a rifle picker (library enabled by default)');
  assert.equal(rifleSelect.childNodes.length, loadRifleCatalog().length + 1); // "Other" + every rifle
  assert.equal(rifleSelect.value, '__other__');
});

test('the cartridge picker is hidden until a library rifle is selected', async () => {
  const rifle = rifleSection();
  await settle();

  const cartridgeSelect = byId(rifle.node, 'rifleCartridgeSelect');
  assert.equal(cartridgeSelect.parentNode.style.display, 'none');
});

test('selecting a library rifle pre-fills zeroRange/sightHeight/click settings and reveals its cartridges', async () => {
  saveTestRifle();
  const rifle = rifleSection();
  await settle();

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  rifleSelect.value = TEST_RIFLE_ID;
  fireEvent(rifleSelect, 'change');
  await settle();

  assert.deepEqual(rifle.getValues(), { zeroRange: 100, sightHeight: 45 }); // 0.045m -> 45mm
  assert.deepEqual(rifle.getClickSettings(), { unit: 'mrad', horizontal: 0.1, vertical: 0.1 });

  const cartridgeSelect = byId(rifle.node, 'rifleCartridgeSelect');
  assert.equal(cartridgeSelect.parentNode.style.display, '');
  assert.equal(cartridgeSelect.childNodes.length, 2); // TEST_RIFLE has 2 cartridges
});

test('those pre-filled rifle fields remain freely editable afterward', async () => {
  saveTestRifle();
  const rifle = rifleSection();
  await settle();

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  rifleSelect.value = TEST_RIFLE_ID;
  fireEvent(rifleSelect, 'change');
  await settle();

  const zeroRangeInput = byId(rifle.node, 'zeroRange');
  zeroRangeInput.value = '200';
  fireEvent(zeroRangeInput, 'input');
  assert.equal(rifle.getValues().zeroRange, 200);
});

test('selecting a library rifle auto-applies its first cartridge via onLibraryCartridgeChange', async () => {
  saveTestRifle();
  let lastCartridge = 'not called';
  const rifle = rifleSection({ onLibraryCartridgeChange: (c) => { lastCartridge = c; } });
  await settle();

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  rifleSelect.value = TEST_RIFLE_ID;
  fireEvent(rifleSelect, 'change');
  await settle();

  assert.deepEqual(lastCartridge, {
    muzzleVelocity: 807.72,
    referenceTempC: undefined,
    velocityTempSensitivity: undefined,
    bulletId: 'swiss-gp11'
  });
});

test('switching the cartridge picker reports the newly selected cartridge', async () => {
  saveTestRifle();
  let lastCartridge = null;
  const rifle = rifleSection({ onLibraryCartridgeChange: (c) => { lastCartridge = c; } });
  await settle();

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  rifleSelect.value = TEST_RIFLE_ID;
  fireEvent(rifleSelect, 'change');
  await settle();

  const cartridgeSelect = byId(rifle.node, 'rifleCartridgeSelect');
  cartridgeSelect.value = 'handload-175smk-example';
  fireEvent(cartridgeSelect, 'change');

  assert.equal(lastCartridge.bulletId, 'hornady-30-eldm-208');
  assert.equal(lastCartridge.referenceTempC, 15);
  assert.ok(Math.abs(lastCartridge.velocityTempSensitivity - 1.2) < 1e-9);
});

test('switching back to "Other" hides the cartridge picker and reports null', async () => {
  saveTestRifle();
  let lastCartridge = 'not called';
  const rifle = rifleSection({ onLibraryCartridgeChange: (c) => { lastCartridge = c; } });
  await settle();

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  rifleSelect.value = TEST_RIFLE_ID;
  fireEvent(rifleSelect, 'change');
  await settle();

  rifleSelect.value = '__other__';
  fireEvent(rifleSelect, 'change');

  assert.equal(lastCartridge, null);
  const cartridgeSelect = byId(rifle.node, 'rifleCartridgeSelect');
  assert.equal(cartridgeSelect.parentNode.style.display, 'none');
});

test('a rifle+cartridge selected in one rifleSection instance is restored (and re-reported) in the next one', async () => {
  saveTestRifle();
  const first = rifleSection();
  await settle();
  const firstRifleSelect = byId(first.node, 'rifleSelect');
  firstRifleSelect.value = TEST_RIFLE_ID;
  fireEvent(firstRifleSelect, 'change');
  await settle();
  const firstCartridgeSelect = byId(first.node, 'rifleCartridgeSelect');
  firstCartridgeSelect.value = 'handload-175smk-example';
  fireEvent(firstCartridgeSelect, 'change');

  let reportedCartridge = 'not called';
  const second = rifleSection({ onLibraryCartridgeChange: (c) => { reportedCartridge = c; } });
  await settle();

  const secondRifleSelect = byId(second.node, 'rifleSelect');
  const secondCartridgeSelect = byId(second.node, 'rifleCartridgeSelect');
  assert.equal(secondRifleSelect.value, TEST_RIFLE_ID);
  assert.equal(secondCartridgeSelect.value, 'handload-175smk-example');
  assert.equal(reportedCartridge.bulletId, 'hornady-30-eldm-208');
  assert.deepEqual(second.getValues(), { zeroRange: 100, sightHeight: 45 });
});

test('the "Show built-in rifles library" checkbox is always present, even with nothing to offer', async () => {
  setRifleLibraryEnabled(false);
  const rifle = rifleSection();
  await settle();

  const checkbox = byId(rifle.node, 'rifleLibraryEnabled');
  assert.ok(checkbox, 'the checkbox itself must never disappear — it\'s the only way back in from this view');
  assert.equal(checkbox.checked, false);
});

test('the rifle picker (but not the checkbox) is hidden when the built-in library is off and there are no Arsenal rifles', async () => {
  setRifleLibraryEnabled(false);
  const rifle = rifleSection();
  await settle();

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  assert.equal(rifleSelect.parentNode.style.display, 'none');
  assert.deepEqual(rifle.getValues(), { zeroRange: 100, sightHeight: 70 });
});

test('a user Arsenal rifle appears in the picker, prefixed "* ", and pre-fills fields when selected', async () => {
  saveUserRifle({
    id: 'my-custom-rifle', name: 'My Custom Rifle',
    defaultSightHeightM: 0.06, defaultZeroRangeM: 150,
    defaultClickUnit: 'arcmin', defaultClickHorizontal: 0.25, defaultClickVertical: 0.25,
    cartridges: []
  });

  const rifle = rifleSection();
  await settle();

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  const option = rifleSelect.childNodes.find((o) => o.attributes.value === 'my-custom-rifle');
  assert.ok(option, 'expected the user rifle to be offered');
  assert.ok(option.textContent.startsWith('* '), `expected a "* " prefix, got "${option.textContent}"`);

  rifleSelect.value = 'my-custom-rifle';
  fireEvent(rifleSelect, 'change');
  await settle();

  assert.deepEqual(rifle.getValues(), { zeroRange: 150, sightHeight: 60 });
  assert.deepEqual(rifle.getClickSettings(), { unit: 'arcmin', horizontal: 0.25, vertical: 0.25 });
});

test('the picker is visible for a user rifle even when the built-in library is switched off', async () => {
  saveUserRifle({
    id: 'my-custom-rifle', name: 'My Custom Rifle',
    defaultSightHeightM: 0.06, defaultZeroRangeM: 150,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });
  setRifleLibraryEnabled(false);

  const rifle = rifleSection();
  await settle();
  const rifleSelect = byId(rifle.node, 'rifleSelect');
  assert.equal(rifleSelect.parentNode.style.display, '');
  assert.deepEqual(optionValuesOf(rifleSelect), ['__other__', 'my-custom-rifle']);
});

test('unchecking "Show built-in rifles library" live-hides built-ins but keeps the user\'s own', async () => {
  saveUserRifle({
    id: 'my-custom-rifle', name: 'My Custom Rifle',
    defaultSightHeightM: 0.06, defaultZeroRangeM: 150,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });

  const rifle = rifleSection();
  await settle();

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  assert.ok(rifleSelect.childNodes.length > 2, 'expected built-ins plus the user rifle before toggling');

  const checkbox = byId(rifle.node, 'rifleLibraryEnabled');
  assert.equal(checkbox.checked, true);
  checkbox.checked = false;
  fireEvent(checkbox, 'change');

  assert.equal(isRifleLibraryEnabled(), false);
  assert.deepEqual(optionValuesOf(rifleSelect), ['__other__', 'my-custom-rifle']);
});

test('the checkbox persists to a cookie and is shared — a second instance reads the same value', async () => {
  const first = rifleSection();
  await settle();
  const firstCheckbox = byId(first.node, 'rifleLibraryEnabled');
  firstCheckbox.checked = false;
  fireEvent(firstCheckbox, 'change');

  const second = rifleSection();
  await settle();
  assert.equal(byId(second.node, 'rifleLibraryEnabled').checked, false);
});

test('getArsenalPrefill() returns the manual fields (and no name) while "Other" is selected', () => {
  const rifle = rifleSection();
  const zeroRangeInput = byId(rifle.node, 'zeroRange');
  zeroRangeInput.value = '250';
  fireEvent(zeroRangeInput, 'input');

  const prefill = rifle.getArsenalPrefill();
  assert.equal(prefill.name, '');
  assert.equal(prefill.defaultZeroRangeM, 250);
  assert.equal(prefill.defaultClickUnit, 'mrad');
});

// ---- Rifling twist (optional; see units.js's smallLength group and
// unit-field.js's optional mode) ----

test('rifling twist starts pre-filled with the K31-derived default (250mm), excluded from getValues() (not engine-consumed), but included in getArsenalPrefill()', () => {
  const rifle = rifleSection();
  const twistInput = byId(rifle.node, 'riflingTwist');
  assert.equal(twistInput.value, '250');
  assert.deepEqual(rifle.getValues(), { zeroRange: 100, sightHeight: 70 });
  assert.ok(Math.abs(rifle.getArsenalPrefill().defaultRiflingTwistM - 0.25) < 1e-9);
});

test('typing a twist value flows through getArsenalPrefill() in meters, and persists to the next instance', () => {
  const first = rifleSection();
  const twistInput = byId(first.node, 'riflingTwist');
  twistInput.value = '178'; // mm — a common 1:7in-equivalent twist
  fireEvent(twistInput, 'input');
  assert.ok(Math.abs(first.getArsenalPrefill().defaultRiflingTwistM - 0.178) < 1e-9);

  const second = rifleSection();
  assert.equal(byId(second.node, 'riflingTwist').value, '178');
});

test('selecting a library rifle without a stored twist clears the field back to blank', async () => {
  saveTestRifle();
  const rifle = rifleSection();
  await settle(); // let the built-in catalog resolve before picking from it below
  const twistInput = byId(rifle.node, 'riflingTwist');
  twistInput.value = '250';
  fireEvent(twistInput, 'input');
  assert.equal(twistInput.value, '250');

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  rifleSelect.value = TEST_RIFLE_ID; // TEST_RIFLE has no defaultRiflingTwistM
  fireEvent(rifleSelect, 'change');
  await settle();

  assert.equal(twistInput.value, '');
  assert.equal(rifle.getArsenalPrefill().defaultRiflingTwistM, null);
});

test('selecting a library rifle with a stored twist pre-fills it, still freely editable afterward', async () => {
  saveUserRifle({
    id: 'twisty-rifle', name: 'Twisty Rifle',
    defaultSightHeightM: 0.05, defaultZeroRangeM: 100, defaultRiflingTwistM: 0.240,
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });

  const rifle = rifleSection();
  await settle();
  const rifleSelect = byId(rifle.node, 'rifleSelect');
  rifleSelect.value = 'twisty-rifle';
  fireEvent(rifleSelect, 'change');
  await settle();

  const twistInput = byId(rifle.node, 'riflingTwist');
  assert.equal(twistInput.value, '240');
  assert.ok(Math.abs(rifle.getArsenalPrefill().defaultRiflingTwistM - 0.240) < 1e-9);

  twistInput.value = '200';
  fireEvent(twistInput, 'input');
  assert.ok(Math.abs(rifle.getArsenalPrefill().defaultRiflingTwistM - 0.200) < 1e-9);
});

// ---- Twist direction (always has a value — no blank state, "right" by
// default) ----

test('twist direction defaults to "right", excluded from getValues(), included in getArsenalPrefill()', () => {
  const rifle = rifleSection();
  const directionSelect = byId(rifle.node, 'twistDirection');
  assert.equal(directionSelect.value, 'right');
  assert.deepEqual(rifle.getValues(), { zeroRange: 100, sightHeight: 70 });
  assert.equal(rifle.getArsenalPrefill().defaultTwistDirection, 'right');
});

test('picking "left" flows through getArsenalPrefill() and persists to the next instance', () => {
  const first = rifleSection();
  const directionSelect = byId(first.node, 'twistDirection');
  directionSelect.value = 'left';
  fireEvent(directionSelect, 'change');
  assert.equal(first.getArsenalPrefill().defaultTwistDirection, 'left');

  const second = rifleSection();
  assert.equal(byId(second.node, 'twistDirection').value, 'left');
});

test('selecting a library rifle with no stored twist direction defaults back to "right"', async () => {
  saveTestRifle();
  const rifle = rifleSection();
  await settle();
  const directionSelect = byId(rifle.node, 'twistDirection');
  directionSelect.value = 'left';
  fireEvent(directionSelect, 'change');

  const rifleSelect = byId(rifle.node, 'rifleSelect');
  rifleSelect.value = TEST_RIFLE_ID; // TEST_RIFLE has no defaultTwistDirection
  fireEvent(rifleSelect, 'change');
  await settle();

  assert.equal(directionSelect.value, 'right');
});

test('selecting a library rifle with a stored "left" twist direction pre-fills it', async () => {
  saveUserRifle({
    id: 'lefty-rifle', name: 'Lefty Rifle',
    defaultSightHeightM: 0.05, defaultZeroRangeM: 100, defaultTwistDirection: 'left',
    defaultClickUnit: 'mrad', defaultClickHorizontal: 0.1, defaultClickVertical: 0.1,
    cartridges: []
  });

  const rifle = rifleSection();
  await settle();
  const rifleSelect = byId(rifle.node, 'rifleSelect');
  rifleSelect.value = 'lefty-rifle';
  fireEvent(rifleSelect, 'change');
  await settle();

  assert.equal(byId(rifle.node, 'twistDirection').value, 'left');
});

test('getArsenalPrefill() carries the selected library rifle\'s name', async () => {
  saveTestRifle();
  const rifle = rifleSection();
  await settle();
  const rifleSelect = byId(rifle.node, 'rifleSelect');
  rifleSelect.value = TEST_RIFLE_ID;
  fireEvent(rifleSelect, 'change');
  await settle();

  const prefill = rifle.getArsenalPrefill();
  assert.equal(prefill.name, 'Test Rifle');
  assert.equal(prefill.defaultZeroRangeM, 100);
});
