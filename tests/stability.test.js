import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMillerSg, canComputeStability, stabilityStatus } from '../src/engine/stability.js';
import { airDensity } from '../src/engine/atmosphere.js';

// Independent imperial-unit reference implementation (the formula's usual
// published form) — cross-checks the metric-native version isn't just
// self-consistent but actually reproduces Miller's Twist Rule.
function millerImperial({ grains, dIn, twistIn, lengthIn, fps }) {
  const t = twistIn / dIn;
  const L = lengthIn / dIn;
  return (30 * grains) / (t * t * dIn ** 3 * L * (1 + L * L)) * (fps / 2800) ** (1 / 3);
}

test('computeMillerSg matches the imperial reference formula', () => {
  const dIn = 0.308, grains = 168, twistIn = 12, lengthIn = 1.20, fps = 2650;
  const expected = millerImperial({ grains, dIn, twistIn, lengthIn, fps });

  const massKg = grains / 15432.358352941432;
  const caliberM = dIn * 0.0254;
  const lengthM = lengthIn * 0.0254;
  const riflingTwistMm = twistIn * 25.4;
  const muzzleVelocity = fps * 0.3048;

  const sg = computeMillerSg({ massKg, caliberM, lengthM, muzzleVelocity, riflingTwistMm });
  assert.ok(Math.abs(sg - expected) < 1e-9, `got ${sg}, expected ~${expected}`);
});

test('stabilityStatus thresholds', () => {
  assert.equal(stabilityStatus(0.999), 'unstable');
  assert.equal(stabilityStatus(1.0), 'marginal');
  assert.equal(stabilityStatus(1.299), 'marginal');
  assert.equal(stabilityStatus(1.3), 'stable');
  assert.equal(stabilityStatus(2.0), 'stable');
});

test('computeMillerSg with explicit standard-atmosphere args matches the no-args default exactly', () => {
  const bullet = { massKg: 0.0109, caliberM: 0.00782, lengthM: 0.0305, muzzleVelocity: 807, riflingTwistMm: 304.8 };
  const withDefaults = computeMillerSg(bullet);
  const withExplicitStandard = computeMillerSg({ ...bullet, tempC: 15, pressureHpa: 1013.25, humidityPct: 0 });
  assert.equal(withExplicitStandard, withDefaults);
});

test('thinner air (high altitude / hot day) raises Sg above the standard-atmosphere value', () => {
  const bullet = { massKg: 0.0109, caliberM: 0.00782, lengthM: 0.0305, muzzleVelocity: 807, riflingTwistMm: 304.8 };
  const standard = computeMillerSg(bullet);
  const highAltitudeHot = computeMillerSg({ ...bullet, tempC: 35, pressureHpa: 850 }); // ~5000ft, hot day
  assert.ok(highAltitudeHot > standard, `expected thinner-air Sg (${highAltitudeHot}) > standard Sg (${standard})`);
});

test('denser air (cold day, sea level) lowers Sg below the standard-atmosphere value', () => {
  const bullet = { massKg: 0.0109, caliberM: 0.00782, lengthM: 0.0305, muzzleVelocity: 807, riflingTwistMm: 304.8 };
  const standard = computeMillerSg(bullet);
  const cold = computeMillerSg({ ...bullet, tempC: -20, pressureHpa: 1030 });
  assert.ok(cold < standard, `expected denser-air Sg (${cold}) < standard Sg (${standard})`);
});

test('Sg scales exactly as standard-density / actual-density, matching the exact stability relation\'s rho dependence', () => {
  const bullet = { massKg: 0.0109, caliberM: 0.00782, lengthM: 0.0305, muzzleVelocity: 807, riflingTwistMm: 304.8 };
  const standard = computeMillerSg(bullet);
  const conditions = { tempC: 35, pressureHpa: 850, humidityPct: 20 };
  const corrected = computeMillerSg({ ...bullet, ...conditions });

  const rhoStandard = airDensity({ tempC: 15, pressureHpa: 1013.25, humidityPct: 0 });
  const rhoActual = airDensity(conditions);
  const expectedRatio = rhoStandard / rhoActual;

  assert.ok(Math.abs(corrected / standard - expectedRatio) < 1e-9, `ratio ${corrected / standard} did not match expected ${expectedRatio}`);
});

test('canComputeStability requires every input as a positive number', () => {
  const full = { massKg: 0.0109, caliberM: 0.00782, lengthM: 0.0305, muzzleVelocity: 807, riflingTwistMm: 304.8 };
  assert.equal(canComputeStability(full), true);

  for (const key of Object.keys(full)) {
    assert.equal(canComputeStability({ ...full, [key]: null }), false, `${key}: null should be unknown`);
    assert.equal(canComputeStability({ ...full, [key]: undefined }), false, `${key}: undefined should be unknown`);
    assert.equal(canComputeStability({ ...full, [key]: 0 }), false, `${key}: 0 should be unknown`);
  }
});
