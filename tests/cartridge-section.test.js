import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, installFakeIndexedDb } from './helpers/fake-dom.js';
import { warmCatalogs } from './helpers/warm-catalogs.js';

installFakeDom();
installFakeIndexedDb();

const { initI18n } = await import('../src/i18n.js');
await initI18n();
await warmCatalogs();

const { cartridgeSection } = await import('../src/ui/sections/cartridge-section.js');

test.beforeEach(() => {
  localStorage.clear();
});

test('a library cartridge\'s bcGainFactor reaches getValues(), so every tool shoots the trued cartridge', async () => {
  const section = cartridgeSection({});
  await section.setLibraryCartridge({ muzzleVelocity: 792.48, bulletId: 'geladen-308-178-eld-m', bcGainFactor: 1.05 });
  assert.equal(section.getValues().bcGainFactor, 1.05);
});

test('a library cartridge with no bcGainFactor reads as exactly 1, and releasing to manual entry resets it to 1', async () => {
  const section = cartridgeSection({});
  await section.setLibraryCartridge({ muzzleVelocity: 792.48, bulletId: 'geladen-308-178-eld-m' });
  assert.equal(section.getValues().bcGainFactor, 1);
  await section.setLibraryCartridge({ muzzleVelocity: 792.48, bulletId: 'geladen-308-178-eld-m', bcGainFactor: 0.95 });
  await section.setLibraryCartridge(null);
  assert.equal(section.getValues().bcGainFactor, 1);
});

test('a library cartridge\'s zero atmosphere reaches getValues(), and is null when none is set or once released to manual entry', async () => {
  const zeroAtmosphere = { tempC: 4, pressureHpa: 845, humidityPct: 30, altitudeM: 1505 };
  const section = cartridgeSection({});
  await section.setLibraryCartridge({ muzzleVelocity: 792.48, bulletId: 'geladen-308-178-eld-m', zeroAtmosphere });
  assert.deepEqual(section.getValues().zeroAtmosphere, zeroAtmosphere);
  await section.setLibraryCartridge({ muzzleVelocity: 792.48, bulletId: 'geladen-308-178-eld-m' });
  assert.equal(section.getValues().zeroAtmosphere, null);
  await section.setLibraryCartridge({ muzzleVelocity: 792.48, bulletId: 'geladen-308-178-eld-m', zeroAtmosphere });
  await section.setLibraryCartridge(null);
  assert.equal(section.getValues().zeroAtmosphere, null);
});
