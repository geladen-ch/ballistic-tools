import test from 'node:test';
import assert from 'node:assert/strict';

const { comeUpEnvelope, comeUpPlausibility, velocityEnvelope, velocityPlausibility, PLAUSIBILITY_Z, VELOCITY_FLOOR_MS, VELOCITY_CEILING_MS } = await import('../src/ui/truing-session/plausibility.js');
const { resolveMuzzleVelocity } = await import('../src/engine/trajectory.js');

const STATE = {
  dragModel: 'G7', bc: 0.2623, muzzleVelocity: 792.48, zeroRange: 100, sightHeight: 50,
  tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 50, windSpeed: 0, windAngle: 90, losAngleDeg: 0
};
const ARGS = { state: STATE, rangeM: 600, r50Mrad: 0.14, mvSD: 6, certaintyKey: 'good', shots: 3, clickMrad: 0.1 };

test('the come-up envelope is the app\'s own dope within z times the worst-case spread, and widens with the distance', () => {
  assert.equal(PLAUSIBILITY_Z, 4);
  const near = comeUpEnvelope({ ...ARGS, rangeM: 100 });
  assert.ok(Math.abs(near.centerMrad) < 0.01, 'the zero range needs no come-up');
  assert.ok(near.highMrad > 0.5 && near.highMrad < 2, `about the unchecked zero prior at the zero range (${near.highMrad})`);
  const mid = comeUpEnvelope(ARGS);
  assert.ok(mid.lowMrad < mid.centerMrad && mid.centerMrad < mid.highMrad);
  // about +-34% at 600 m for this load, with the widest priors
  assert.ok((mid.highMrad - mid.lowMrad) / 2 / mid.centerMrad > 0.25 && (mid.highMrad - mid.lowMrad) / 2 / mid.centerMrad < 0.45);
  const far = comeUpEnvelope({ ...ARGS, rangeM: 900 });
  assert.ok(far.highMrad - far.centerMrad > mid.highMrad - mid.centerMrad);
  // a longer string reads more precisely, so its envelope is a little narrower
  assert.ok(comeUpEnvelope({ ...ARGS, shots: 1 }).highMrad > comeUpEnvelope({ ...ARGS, shots: 3 }).highMrad);
});

test('honest come-ups pass: the dope, and a click value a few percent off, a velocity 20 m/s off and a zero 0.3 mrad off', () => {
  const env = comeUpEnvelope(ARGS);
  for (const mrad of [env.centerMrad, env.centerMrad * 1.05, env.centerMrad * 0.93, env.centerMrad + 0.3, env.centerMrad - 0.3, env.centerMrad + 0.9]) {
    assert.equal(comeUpPlausibility({ ...ARGS, enteredClicks: mrad / 0.1 }).ok, true, `${mrad}`);
  }
  const hot = comeUpPlausibility({ ...ARGS, conditions: { tempC: 35 }, enteredClicks: comeUpEnvelope({ ...ARGS, conditions: { tempC: 35 } }).centerMrad / 0.1 });
  assert.equal(hot.ok, true);
});

test('typical slips are flagged and named: mrad for clicks, a difference for the full come-up, MOA, the sign, a factor of ten', () => {
  const rec = comeUpEnvelope(ARGS).centerMrad; // about 5.3 mrad = 53 clicks
  const flagged = (clicks, extra = {}) => comeUpPlausibility({ ...ARGS, recommendedMrad: rec, enteredClicks: clicks, ...extra });
  const mrad = flagged(5.3);
  assert.equal(mrad.ok, false);
  assert.ok(mrad.hints.includes('mrad'), 'typed the mrad figure where clicks are wanted');
  const plus = flagged(3);
  assert.equal(plus.ok, false);
  assert.deepEqual(plus.hints, ['delta'], '"+3": the difference to the recommended come-up');
  assert.deepEqual(flagged(-4).hints, ['delta'], '"-4"');
  assert.deepEqual(flagged(-53).hints, ['sign']);
  assert.deepEqual(flagged(530).hints, ['tenth'], 'an extra digit');
  assert.ok(flagged(18).hints.includes('moa'), 'a come-up in MOA typed as clicks (18 MOA is about 5.2 mrad)');
  assert.deepEqual(flagged(100).hints, [], 'nothing explains it, but it is still flagged');
});

test('the spread of the load enters the envelope: a wider velocity spread widens it', () => {
  assert.ok(comeUpEnvelope({ ...ARGS, mvSD: 12 }).highMrad > comeUpEnvelope({ ...ARGS, mvSD: 3 }).highMrad);
});

test('the velocity envelope is the cartridge\'s velocity in that air within 4 sqrt(20^2 + SD^2), and honest readings pass', () => {
  const env = velocityEnvelope({ state: STATE, mvSD: 6 });
  assert.equal(env.centerMs, STATE.muzzleVelocity);
  const half = 4 * Math.hypot(20, 6);
  assert.ok(Math.abs(env.highMs - env.centerMs - half) < 1e-9 && Math.abs(env.centerMs - env.lowMs - half) < 1e-9);
  for (const ms of [792, 770, 815, 760, 830]) assert.equal(velocityPlausibility({ state: STATE, mvSD: 6, enteredMs: ms }).ok, true, `${ms}`);
  // the cartridge's own temperature sensitivity moves the expectation with the air
  const sensitive = { ...STATE, referenceTempC: 15, velocityTempSensitivity: 1 };
  const cold = velocityEnvelope({ state: sensitive, conditions: { tempC: -5 }, mvSD: 6 });
  assert.equal(cold.centerMs, resolveMuzzleVelocity({ ...sensitive, tempC: -5 }));
  assert.ok(cold.centerMs < env.centerMs - 15);
});

test('a velocity out of range is flagged, with the likely slip named: another unit, or a digit', () => {
  const ms = (raw) => ({ enteredMs: raw });
  const fps = velocityPlausibility({ state: STATE, mvSD: 6, enteredMs: 790 * 0.3048, readAs: [{ label: 'm/s', ms: 790 }] });
  assert.equal(fps.ok, false);
  assert.deepEqual(fps.hints, [{ type: 'unit', label: 'm/s' }], '790 typed where ft/s are wanted');
  const dropped = velocityPlausibility({ state: STATE, mvSD: 6, ...ms(79) });
  assert.deepEqual(dropped.hints, [{ type: 'digit' }]);
  assert.deepEqual(velocityPlausibility({ state: STATE, mvSD: 6, ...ms(7900) }).hints, [{ type: 'digit' }]);
  assert.deepEqual(velocityPlausibility({ state: STATE, mvSD: 6, ...ms(1200) }).hints, []);
  // physical bounds hold whatever the spread
  const wide = velocityEnvelope({ state: STATE, mvSD: 500 });
  assert.equal(wide.lowMs, VELOCITY_FLOOR_MS);
  assert.equal(wide.highMs, VELOCITY_CEILING_MS);
});

test('an unreadable entry is not judged', () => {
  assert.equal(comeUpPlausibility({ ...ARGS, enteredClicks: NaN }).ok, true);
  assert.equal(velocityPlausibility({ state: STATE, mvSD: 6, enteredMs: NaN }).ok, true);
});
