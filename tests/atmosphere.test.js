import test from 'node:test';
import assert from 'node:assert/strict';
import { airDensity, speedOfSound, icaoStandardPressurePa, temperatureAtHeightDelta, pressureAtAltitude } from '../src/engine/atmosphere.js';

test('ISA sea-level density is ~1.225 kg/m^3', () => {
  const rho = airDensity({ tempC: 15, pressurePa: 101325, humidity: 0 });
  assert.ok(Math.abs(rho - 1.225) < 0.005, `got ${rho}`);
});

test('density decreases with pressure — a lower local pressure at the same temperature is thinner air', () => {
  const sea = airDensity({ tempC: 15, pressurePa: 101325, humidity: 0 });
  const thin = airDensity({ tempC: 15, pressurePa: icaoStandardPressurePa(2000), humidity: 0 });
  assert.ok(thin < sea);
});

test('humid air is less dense than dry air at the same temperature/pressure', () => {
  const dry = airDensity({ tempC: 25, pressurePa: 101325, humidity: 0 });
  const humid = airDensity({ tempC: 25, pressurePa: 101325, humidity: 1 });
  assert.ok(humid < dry);
});

test('speed of sound at 15C is ~340 m/s', () => {
  assert.ok(Math.abs(speedOfSound(15) - 340.3) < 1);
});

test('icaoStandardPressurePa at sea level is the standard 101325 Pa', () => {
  assert.equal(icaoStandardPressurePa(0), 101325);
});

test('icaoStandardPressurePa decreases with elevation, matching a published ISA reference point', () => {
  // ISA reference: ~101325 Pa at sea level drops to ~89870 Pa at 1000m.
  const p = icaoStandardPressurePa(1000);
  assert.ok(Math.abs(p - 89870) < 100, `got ${p}`);
});

test('temperatureAtHeightDelta applies the standard 6.5C/km lapse rate, up and down', () => {
  assert.ok(Math.abs(temperatureAtHeightDelta(15, 1000) - 8.5) < 1e-9);
  assert.ok(Math.abs(temperatureAtHeightDelta(15, -1000) - 21.5) < 1e-9);
  assert.equal(temperatureAtHeightDelta(15, 0), 15);
});

test('pressureAtAltitude at the site\'s own altitude is a no-op, regardless of what that altitude is', () => {
  assert.equal(pressureAtAltitude(95000, 0, 0), 95000);
  assert.equal(pressureAtAltitude(95000, 2000, 2000), 95000);
});

test('pressureAtAltitude scales the real station reading by the ICAO ratio between altitudes — decreases going up, increases going down', () => {
  const site = pressureAtAltitude(95000, 500, 500);
  const higher = pressureAtAltitude(95000, 500, 1000);
  const lower = pressureAtAltitude(95000, 500, 0);
  assert.equal(site, 95000);
  assert.ok(higher < 95000);
  assert.ok(lower > 95000);
});

test('pressureAtAltitude never assumes the site itself sits at ICAO standard conditions — an unusually high real station reading is preserved, not overridden', () => {
  // A shooter at 2000m who reports the *sea-level standard* pressure
  // (1013.25 hPa) has genuinely unusual local weather (real station
  // pressure at 2000m is normally far lower, ~795 hPa) — this function
  // must take that reading at face value rather than silently replacing
  // it with what the standard model "expects" at that elevation.
  assert.equal(pressureAtAltitude(101325, 2000, 2000), 101325);
});

test('pressureAtAltitude\'s ratio is exactly the inverse of icaoStandardPressurePa\'s own altitude dependence', () => {
  // Two shooters at different elevations who both happen to report
  // exactly the ICAO standard pressure for their own site must see the
  // exact same standard-model pressure predicted for a shared target
  // altitude — the real-world "bias from standard" they each carry is
  // zero in this scenario, so the ratio scaling should reproduce the
  // standard curve exactly.
  const viaLowSite = pressureAtAltitude(icaoStandardPressurePa(200), 200, 1500);
  const viaHighSite = pressureAtAltitude(icaoStandardPressurePa(800), 800, 1500);
  const standard = icaoStandardPressurePa(1500);
  assert.ok(Math.abs(viaLowSite - standard) < 1e-6, `${viaLowSite} vs ${standard}`);
  assert.ok(Math.abs(viaHighSite - standard) < 1e-6, `${viaHighSite} vs ${standard}`);
});
