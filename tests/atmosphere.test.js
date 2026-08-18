import test from 'node:test';
import assert from 'node:assert/strict';
import { airDensity, speedOfSound, icaoStandardPressureHpa, temperatureAtHeightDelta, pressureAtAltitude } from '../src/engine/atmosphere.js';

test('ISA sea-level density is ~1.225 kg/m^3', () => {
  const rho = airDensity({ tempC: 15, pressureHpa: 1013.25, humidityPct: 0 });
  assert.ok(Math.abs(rho - 1.225) < 0.005, `got ${rho}`);
});

test('density decreases with pressure — a lower local pressure at the same temperature is thinner air', () => {
  const sea = airDensity({ tempC: 15, pressureHpa: 1013.25, humidityPct: 0 });
  const thin = airDensity({ tempC: 15, pressureHpa: icaoStandardPressureHpa(2000), humidityPct: 0 });
  assert.ok(thin < sea);
});

test('humid air is less dense than dry air at the same temperature/pressure', () => {
  const dry = airDensity({ tempC: 25, pressureHpa: 1013.25, humidityPct: 0 });
  const humid = airDensity({ tempC: 25, pressureHpa: 1013.25, humidityPct: 100 });
  assert.ok(humid < dry);
});

test('speed of sound at 15C is ~340 m/s', () => {
  assert.ok(Math.abs(speedOfSound(15) - 340.3) < 1);
});

test('icaoStandardPressureHpa at sea level is the standard 1013.25 hPa', () => {
  assert.equal(icaoStandardPressureHpa(0), 1013.25);
});

test('icaoStandardPressureHpa decreases with elevation, matching a published ISA reference point', () => {
  // ISA reference: ~1013.25 hPa at sea level drops to ~898.7 hPa at 1000m.
  const p = icaoStandardPressureHpa(1000);
  assert.ok(Math.abs(p - 898.7) < 1, `got ${p}`);
});

test('temperatureAtHeightDelta applies the standard 6.5C/km lapse rate, up and down', () => {
  assert.ok(Math.abs(temperatureAtHeightDelta(15, 1000) - 8.5) < 1e-9);
  assert.ok(Math.abs(temperatureAtHeightDelta(15, -1000) - 21.5) < 1e-9);
  assert.equal(temperatureAtHeightDelta(15, 0), 15);
});

test('pressureAtAltitude at the site\'s own altitude is a no-op, regardless of what that altitude is', () => {
  assert.equal(pressureAtAltitude(950, 0, 0), 950);
  assert.equal(pressureAtAltitude(950, 2000, 2000), 950);
});

test('pressureAtAltitude scales the real station reading by the ICAO ratio between altitudes — decreases going up, increases going down', () => {
  const site = pressureAtAltitude(950, 500, 500);
  const higher = pressureAtAltitude(950, 500, 1000);
  const lower = pressureAtAltitude(950, 500, 0);
  assert.equal(site, 950);
  assert.ok(higher < 950);
  assert.ok(lower > 950);
});

test('pressureAtAltitude never assumes the site itself sits at ICAO standard conditions — an unusually high real station reading is preserved, not overridden', () => {
  // A shooter at 2000m who reports the *sea-level standard* pressure
  // (1013.25 hPa) has genuinely unusual local weather (real station
  // pressure at 2000m is normally far lower, ~795 hPa) — this function
  // must take that reading at face value rather than silently replacing
  // it with what the standard model "expects" at that elevation.
  assert.equal(pressureAtAltitude(1013.25, 2000, 2000), 1013.25);
});

test('pressureAtAltitude\'s ratio is exactly the inverse of icaoStandardPressureHpa\'s own altitude dependence', () => {
  // Two shooters at different elevations who both happen to report
  // exactly the ICAO standard pressure for their own site must see the
  // exact same standard-model pressure predicted for a shared target
  // altitude — the real-world "bias from standard" they each carry is
  // zero in this scenario, so the ratio scaling should reproduce the
  // standard curve exactly.
  const viaLowSite = pressureAtAltitude(icaoStandardPressureHpa(200), 200, 1500);
  const viaHighSite = pressureAtAltitude(icaoStandardPressureHpa(800), 800, 1500);
  const standard = icaoStandardPressureHpa(1500);
  assert.ok(Math.abs(viaLowSite - standard) < 1e-6, `${viaLowSite} vs ${standard}`);
  assert.ok(Math.abs(viaHighSite - standard) < 1e-6, `${viaHighSite} vs ${standard}`);
});
