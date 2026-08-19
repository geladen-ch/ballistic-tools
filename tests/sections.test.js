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

const { sectionGroup } = await import('../src/ui/section.js');
const { rifleSection } = await import('../src/ui/sections/rifle-section.js');
const { bulletSection } = await import('../src/ui/sections/bullet-section.js');
const { cartridgeSection } = await import('../src/ui/sections/cartridge-section.js');
const { atmosphereSection } = await import('../src/ui/sections/atmosphere-section.js');
const { makeElement } = await import('./helpers/fake-dom.js');
const { resetShotStateForTests, loadAtmosphereState } = await import('../src/shot-state.js');

// Shared shot state is a module-level singleton (by design — see
// shot-state.js), so each test needs a clean slate the same way
// cookie-backed state needs removeCookie().
test.beforeEach(() => resetShotStateForTests());

function findInputs(node, out = []) {
  if (node.tagName === 'INPUT' || node.tagName === 'SELECT') out.push(node);
  for (const child of node.childNodes || []) findInputs(child, out);
  return out;
}

test('sectionGroup renders a translated heading and marks nested sections', () => {
  const top = sectionGroup('sections.rifleHeading', [makeElement('div')]);
  assert.equal(top.className, 'input-section');
  assert.equal(top.childNodes[0].tagName, 'H3');
  assert.equal(top.childNodes[0].textContent, t('sections.rifleHeading'));

  const nested = sectionGroup('sections.bulletHeading', [makeElement('div')], { nested: true });
  assert.equal(nested.className, 'input-section nested');
  assert.equal(nested.childNodes[0].tagName, 'H4');
});

test('rifleSection exposes zeroRange and sightHeight in engine units', () => {
  const rifle = rifleSection();
  assert.deepEqual(rifle.getValues(), { zeroRange: 100, sightHeight: 70 });
});

test('rifleSection also exposes scope click settings, independent of getValues()', () => {
  const rifle = rifleSection();
  const clickSettings = rifle.getClickSettings();
  assert.deepEqual(clickSettings, { unit: 'mrad', horizontal: 0.1, vertical: 0.1 });
  // click settings must never leak into the engine-facing payload
  assert.equal('unit' in rifle.getValues(), false);
});

test('bulletSection exposes bc and dragModel, defaulting to G7', () => {
  const bullet = bulletSection();
  const values = bullet.getValues();
  assert.equal(values.bc, 0.274);
  assert.equal(values.dragModel, 'G7');
});

test('bulletSection dragModel reflects the select once changed', () => {
  const bullet = bulletSection();
  const [dragModelSelect] = findInputs(bullet.node).filter((n) => n.id === 'dragModel');
  dragModelSelect.value = 'G7';
  assert.equal(bullet.getValues().dragModel, 'G7');
});

test('cartridgeSection nests bulletSection and merges its values', () => {
  const cartridge = cartridgeSection();
  const values = cartridge.getValues();
  assert.equal(values.muzzleVelocity, 786.4);
  assert.equal(values.bc, 0.274);
  assert.equal(values.dragModel, 'G7');
  // a fresh install seeds the temperature-dependence checkbox pre-checked
  // with GP11's own reference temp/sensitivity (see cartridge-section.js)
  assert.equal(values.referenceTempC, 15);
  assert.ok(Math.abs(values.velocityTempSensitivity - 0.8) < 1e-9);

  // bullet section should be present as a nested .input-section
  const nestedSections = cartridge.node.childNodes.filter((n) => n.className === 'input-section nested');
  assert.equal(nestedSections.length, 1);
});

test('cartridgeSection surfaces the muzzle-velocity-temperature values once its checkbox is enabled', () => {
  const cartridge = cartridgeSection();
  const [checkbox] = findInputs(cartridge.node).filter((n) => n.attributes.type === 'checkbox');
  checkbox.checked = true;
  fireEvent(checkbox, 'change');

  const values = cartridge.getValues();
  assert.equal(values.referenceTempC, 15);
  assert.ok(Math.abs(values.velocityTempSensitivity - 0.8) < 1e-9);
});

function settle(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('setLibraryCartridge() locks muzzle velocity and the bullet, and getValues() reflects it with no special-casing', async () => {
  const cartridge = cartridgeSection();
  await settle();

  await cartridge.setLibraryCartridge({ muzzleVelocity: 800, bulletId: 'swiss-gp90' });

  const values = cartridge.getValues();
  assert.equal(values.muzzleVelocity, 800);
  assert.equal(values.bc, 0.166);
  assert.equal(values.dragModel, 'G7');
  assert.equal('referenceTempC' in values, false);

  const [muzzleVelocityInput] = findInputs(cartridge.node).filter((n) => n.id === 'muzzleVelocity');
  assert.equal(muzzleVelocityInput.disabled, true);
});

test('setLibraryCartridge() with temperature data locks the temperature-dependence fields on', async () => {
  const cartridge = cartridgeSection();
  await settle();

  await cartridge.setLibraryCartridge({
    muzzleVelocity: 792, referenceTempC: 10, velocityTempSensitivity: 1.5,
    bulletId: 'swiss-gp11'
  });

  const values = cartridge.getValues();
  assert.equal(values.referenceTempC, 10);
  assert.ok(Math.abs(values.velocityTempSensitivity - 1.5) < 1e-9);
});

test('setLibraryCartridge(null) releases the lock back to manual entry', async () => {
  const cartridge = cartridgeSection();
  await settle();

  await cartridge.setLibraryCartridge({ muzzleVelocity: 800, bulletId: 'swiss-gp90' });
  await cartridge.setLibraryCartridge(null);

  // Unlocking re-enables editing but doesn't discard the last value —
  // same principle as bulletSection's own manual fields, which are never
  // overwritten by a lock in the first place (getValues() reads the
  // locked bullet directly while locked, not through the field).
  assert.equal(cartridge.getValues().muzzleVelocity, 800);
  assert.deepEqual(
    { bc: cartridge.getValues().bc, dragModel: cartridge.getValues().dragModel },
    { bc: 0.274, dragModel: 'G7' }
  );
  const [muzzleVelocityInput] = findInputs(cartridge.node).filter((n) => n.id === 'muzzleVelocity');
  assert.equal(muzzleVelocityInput.disabled, false);
});

test('atmosphereSection includes wind fields by default', () => {
  const atmo = atmosphereSection();
  const values = atmo.getValues();
  assert.deepEqual(Object.keys(values).sort(), ['altitudeM', 'atmospherePreset', 'humidityPct', 'pressureHpa', 'tempC', 'windAngle', 'windSpeed']);
});

test('atmosphereSection omits wind fields when includeWind is false (matches BC Estimator\'s engine, which ignores wind)', () => {
  const atmo = atmosphereSection({ includeWind: false });
  const values = atmo.getValues();
  assert.deepEqual(Object.keys(values).sort(), ['altitudeM', 'atmospherePreset', 'humidityPct', 'pressureHpa', 'tempC']);
  const windInputs = findInputs(atmo.node).filter((n) => n.id === 'windSpeed' || n.id === 'windAngle');
  assert.equal(windInputs.length, 0);
});

test('atmosphereSection omits the preset select and altitude field entirely when presets is false (the Labradar tool\'s own mode)', () => {
  const atmo = atmosphereSection({ includeWind: false, presets: false });
  const values = atmo.getValues();
  assert.deepEqual(Object.keys(values).sort(), ['altitudeM', 'humidityPct', 'pressureHpa', 'tempC']);

  const inputs = findInputs(atmo.node);
  assert.equal(inputs.some((n) => n.id === 'atmospherePreset'), false, 'no preset select should exist at all');
  assert.equal(inputs.some((n) => n.id === 'altitudeM'), false, 'no altitude field should exist at all');
});

test('presets:false still back-derives a real altitude from station pressure, same as every other "custom" atmosphere', () => {
  const atmo = atmosphereSection({ presets: false, load: () => ({ pressureHpa: 925.3 }) });
  const values = atmo.getValues();
  assert.ok(Math.abs(values.altitudeM - 759.29) < 0.01);
});

test('presets:false: hand-editing temperature/pressure/humidity works exactly like "Real conditions" always being active', () => {
  const atmo = atmosphereSection({ presets: false });
  const [tempInput] = findInputs(atmo.node).filter((n) => n.id === 'tempC');
  tempInput.value = '20';
  fireEvent(tempInput, 'input');
  assert.equal(atmo.getValues().tempC, 20);
});

// ---- Atmosphere presets ----

test('defaults to "Real conditions" (custom), with today\'s existing default values and no altitude field shown', () => {
  const atmo = atmosphereSection();
  const values = atmo.getValues();
  assert.equal(values.atmospherePreset, 'custom');
  assert.equal(values.tempC, 15);
  assert.equal(values.pressureHpa, 1013.25);
  assert.equal(values.humidityPct, 50);

  const [altitudeInput] = findInputs(atmo.node).filter((n) => n.id === 'altitudeM');
  assert.equal(altitudeInput.parentNode.style.display, 'none');
});

test('picking "Standard atmosphere" computes temperature/pressure/humidity from the (now visible) altitude field', () => {
  const atmo = atmosphereSection();
  const [presetSelect] = findInputs(atmo.node).filter((n) => n.id === 'atmospherePreset');
  presetSelect.value = 'standard';
  fireEvent(presetSelect, 'change');

  const [altitudeInput] = findInputs(atmo.node).filter((n) => n.id === 'altitudeM');
  assert.notEqual(altitudeInput.parentNode.style.display, 'none');

  const values = atmo.getValues();
  assert.equal(values.atmospherePreset, 'standard');
  assert.equal(values.altitudeM, 0);
  assert.equal(values.tempC, 15);
  assert.equal(values.pressureHpa, 1013.25);
  assert.equal(values.humidityPct, 0);

  altitudeInput.value = '2000';
  fireEvent(altitudeInput, 'input');
  const afterValues = atmo.getValues();
  assert.equal(afterValues.atmospherePreset, 'standard'); // editing altitude never kicks it out of the preset
  assert.equal(afterValues.tempC, 2); // 15 - 0.0065*2000
  assert.ok(Math.abs(afterValues.pressureHpa - 794.96) < 0.01);
});

test('picking "Swiss army standard" / "Soviet army standard" fills the fixed reference values and hides altitude', () => {
  const atmo = atmosphereSection();
  const [presetSelect] = findInputs(atmo.node).filter((n) => n.id === 'atmospherePreset');

  presetSelect.value = 'swiss';
  fireEvent(presetSelect, 'change');
  let values = atmo.getValues();
  assert.equal(values.tempC, 7);
  assert.equal(values.pressureHpa, 925.3);
  assert.equal(values.humidityPct, 0);
  const [altitudeInput] = findInputs(atmo.node).filter((n) => n.id === 'altitudeM');
  assert.equal(altitudeInput.parentNode.style.display, 'none');
  // no altitude field shown, but the engine still gets a real, physically
  // reasonable one, back-derived from the preset's own station pressure
  assert.ok(Math.abs(values.altitudeM - 759.29) < 0.01);

  presetSelect.value = 'soviet';
  fireEvent(presetSelect, 'change');
  values = atmo.getValues();
  assert.equal(values.tempC, 15);
  assert.equal(values.pressureHpa, 1000);
  assert.equal(values.humidityPct, 50);
  assert.ok(Math.abs(values.altitudeM - 110.89) < 0.01);
});

test('hand-editing temperature/pressure/humidity under any preset flips to "Real conditions"', () => {
  const atmo = atmosphereSection();
  const [presetSelect] = findInputs(atmo.node).filter((n) => n.id === 'atmospherePreset');
  presetSelect.value = 'soviet';
  fireEvent(presetSelect, 'change');
  assert.equal(atmo.getValues().atmospherePreset, 'soviet');

  const [tempInput] = findInputs(atmo.node).filter((n) => n.id === 'tempC');
  tempInput.value = '20';
  fireEvent(tempInput, 'input');

  assert.equal(presetSelect.value, 'custom');
  const values = atmo.getValues();
  assert.equal(values.atmospherePreset, 'custom');
  assert.equal(values.tempC, 20);
  // pressure/humidity are untouched, just no longer governed by "soviet"
  assert.equal(values.pressureHpa, 1000);
  assert.equal(values.humidityPct, 50);
});

test('"Real conditions" altitude is back-derived from station pressure, not left at sea level', () => {
  const atmo = atmosphereSection();
  const [pressureInput] = findInputs(atmo.node).filter((n) => n.id === 'pressureHpa');
  pressureInput.value = '925.3';
  fireEvent(pressureInput, 'input');

  const values = atmo.getValues();
  assert.equal(values.atmospherePreset, 'custom');
  assert.ok(Math.abs(values.altitudeM - 759.29) < 0.01);
});

test('"Real conditions" is a freely selectable option, not a disabled/synthetic one', () => {
  const atmo = atmosphereSection();
  const [presetSelect] = findInputs(atmo.node).filter((n) => n.id === 'atmospherePreset');
  const customOption = Array.from(presetSelect.childNodes).find((o) => o.attributes.value === 'custom');
  assert.equal(customOption.disabled, false);
});

test('explicitly picking "Real conditions" from a named preset keeps its current values instead of resetting them', () => {
  const atmo = atmosphereSection();
  const [presetSelect] = findInputs(atmo.node).filter((n) => n.id === 'atmospherePreset');
  presetSelect.value = 'swiss';
  fireEvent(presetSelect, 'change');
  assert.equal(atmo.getValues().tempC, 7);

  presetSelect.value = 'custom';
  fireEvent(presetSelect, 'change');

  const values = atmo.getValues();
  assert.equal(values.atmospherePreset, 'custom');
  assert.equal(values.tempC, 7);
  assert.equal(values.pressureHpa, 925.3);
  assert.equal(values.humidityPct, 0);

  // now freely editable, same as any other "Real conditions" state
  const [tempInput] = findInputs(atmo.node).filter((n) => n.id === 'tempC');
  tempInput.value = '12';
  fireEvent(tempInput, 'input');
  assert.equal(atmo.getValues().tempC, 12);
  assert.equal(presetSelect.value, 'custom');
});

test('the chosen preset persists to the next atmosphereSection instance, same as any other value', () => {
  const first = atmosphereSection();
  const [presetSelect] = findInputs(first.node).filter((n) => n.id === 'atmospherePreset');
  presetSelect.value = 'swiss';
  fireEvent(presetSelect, 'change');

  const second = atmosphereSection();
  const values = second.getValues();
  assert.equal(values.atmospherePreset, 'swiss');
  assert.equal(values.tempC, 7);
  assert.equal(values.pressureHpa, 925.3);
  const [altitudeInput] = findInputs(second.node).filter((n) => n.id === 'altitudeM');
  assert.equal(altitudeInput.parentNode.style.display, 'none');
});

// Direct coverage for the actual feature requested: a value entered into
// one view's section instance shows up as the *initial* value of a
// freshly-constructed instance elsewhere — the mechanism the whole app
// relies on to keep Trajectory Table and Hit Probability in sync, since
// each view mounts its own section instances from scratch.

test('a value changed in one atmosphereSection instance is the initial value of the next one', () => {
  const first = atmosphereSection();
  const [windSpeedInput] = findInputs(first.node).filter((n) => n.id === 'windSpeed');
  windSpeedInput.value = '5';
  fireEvent(windSpeedInput, 'input');

  const second = atmosphereSection();
  assert.equal(second.getValues().windSpeed, 5);
});

// windAngle now renders as the wind-direction dial (src/ui/wind-direction-
// dial.js) rather than a plain unitField — its own number-input path
// (typing, not dragging) is exercised here since that's what fake-dom can
// drive; the dial's own drag/keyboard/skin behavior is covered by
// wind-direction-dial.test.js.
test('windAngle, typed through the dial\'s own number input, flows through getValues() and persists to the next instance', () => {
  const first = atmosphereSection();
  const [windAngleInput] = findInputs(first.node).filter((n) => n.id === 'windAngle');
  windAngleInput.value = '270';
  fireEvent(windAngleInput, 'input');
  assert.equal(first.getValues().windAngle, 270);

  const second = atmosphereSection();
  assert.equal(second.getValues().windAngle, 270);
});

test('an atmosphereSection with includeWind:false never clobbers wind fields saved elsewhere', () => {
  const withWind = atmosphereSection();
  const [windSpeedInput] = findInputs(withWind.node).filter((n) => n.id === 'windSpeed');
  windSpeedInput.value = '7';
  fireEvent(windSpeedInput, 'input');

  const windless = atmosphereSection({ includeWind: false }); // e.g. BC Estimator
  const [tempInput] = findInputs(windless.node).filter((n) => n.id === 'tempC');
  tempInput.value = '20';
  fireEvent(tempInput, 'input');

  const backWithWind = atmosphereSection();
  assert.equal(backWithWind.getValues().windSpeed, 7);
  assert.equal(backWithWind.getValues().tempC, 20);
});

// ---- Injectable load/save (Range Solver's own cookie-backed state — see
// range-solver-state.js — instead of shot-state.js's shared, session-only
// one) ----

test('a custom load/save pair is used instead of shot-state.js\'s shared atmosphereState, and defaults are unaffected by it', () => {
  let saved = null;
  const load = () => saved;
  const save = (values) => { saved = { ...saved, ...values }; };

  const atmo = atmosphereSection({ load, save });
  const [tempInput] = findInputs(atmo.node).filter((n) => n.id === 'tempC');
  tempInput.value = '3';
  fireEvent(tempInput, 'input');

  assert.equal(saved.tempC, 3);
  // The shared shot-state.js atmosphereState must be untouched by this.
  assert.equal(loadAtmosphereState(), null);
});

test('a custom load reseeds the next atmosphereSection instance from the same store, independent of the shared one', () => {
  let saved = { tempC: 12, pressureHpa: 950, altitudeM: 0, humidityPct: 40, atmospherePreset: 'custom' };
  const load = () => saved;
  const save = (values) => { saved = { ...saved, ...values }; };

  const first = atmosphereSection({ load, save });
  assert.equal(first.getValues().tempC, 12);

  const second = atmosphereSection({ load, save });
  assert.equal(second.getValues().tempC, 12);
  // The shared, session-only atmosphereSection() (no override) is a
  // completely separate instance, unaffected by the custom store above.
  const shared = atmosphereSection();
  assert.notEqual(shared.getValues().tempC, 12);
});

test('muzzle velocity changed in one cartridgeSection instance is the initial value of the next one', () => {
  const first = cartridgeSection();
  const [muzzleVelocityInput] = findInputs(first.node).filter((n) => n.id === 'muzzleVelocity');
  muzzleVelocityInput.value = '900';
  fireEvent(muzzleVelocityInput, 'input');

  const second = cartridgeSection();
  assert.equal(second.getValues().muzzleVelocity, 900);
});

test('a manually-selected library bullet in one cartridgeSection instance is selected in the next one', async () => {
  const first = cartridgeSection();
  await new Promise((resolve) => setTimeout(resolve, 30)); // let the bullet catalog resolve

  const [bulletSelect] = findInputs(first.node).filter((n) => n.id === 'bulletSelect');
  bulletSelect.value = 'swiss-gp90';
  fireEvent(bulletSelect, 'change');

  const second = cartridgeSection();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(second.getValues().bc, 0.166);
  assert.equal(second.getValues().dragModel, 'G7');
  const [secondBulletSelect] = findInputs(second.node).filter((n) => n.id === 'bulletSelect');
  assert.equal(secondBulletSelect.value, 'swiss-gp90');
});

test('zeroRange/sightHeight/clicks changed in one rifleSection instance are the initial values of the next one', () => {
  const first = rifleSection();
  const [zeroRangeInput] = findInputs(first.node).filter((n) => n.id === 'zeroRange');
  zeroRangeInput.value = '250';
  fireEvent(zeroRangeInput, 'input');

  const second = rifleSection();
  assert.equal(second.getValues().zeroRange, 250);
});
