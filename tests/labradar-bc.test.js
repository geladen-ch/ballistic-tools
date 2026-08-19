import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStepper, landOnRange } from '../src/engine/trajectory.js';
import { estimateTrackBC, estimateTrackBCWholeWindow, aggregateTracks } from '../src/engine/labradar-bc.js';

const atmo = { tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 0 };
const rangeOfT = (p) => p.t;

// Forward-simulates a synthetic Labradar-shaped track from a known BC,
// using the app's own real stepper (same "ground truth" methodology as
// bc-estimate.test.js) — resampled via landOnRange() at a fixed ~1ms
// cadence (matching real device sampling — see labradar-clean.js's own
// notes on real track spacing) rather than at the engine's own raw
// adaptive RK4 step points, which are far coarser (~20ms away from
// transonic — nowhere near dense enough on their own to exercise
// cleanTrack's 10-point floor). `outlierIndices` injects a large
// velocity deviation at specific interior points, the same way a bad
// radar return would.
function makeSyntheticTrack(trueBC, dragModel, v1, durationS, outlierIndices = []) {
  const stepper = makeStepper({ bc: trueBC, dragModel, windSpeed: 0, windAngle: 90, ...atmo });
  let older = null, prev = null, cur = { x: 0, y: 0, z: 0, vx: v1, vy: 0, vz: 0, t: 0 };
  const dt = 0.001;
  const points = [];
  for (let idx = 0, t = 0; t < durationS; idx++, t += dt) {
    while (cur.t < t) {
      older = prev;
      prev = cur;
      cur = stepper.step(cur);
    }
    const landed = prev === null ? cur : landOnRange(older, prev, cur, () => stepper.step(cur), rangeOfT, t);
    const v = Math.hypot(landed.vx, landed.vy, landed.vz);
    const snr = idx === 0 ? 0 : 30; // point 0 has no real SNR, matching real tracks
    const a = snr ? Math.pow(10, snr / 10) : 0;
    const noisyV = outlierIndices.includes(idx) ? v + 40 : v;
    points.push({ t: landed.t, v: noisyV, dist: landed.x, snr, a });
  }
  return points;
}

test('estimateTrackBC recovers a known BC from a clean synthetic track', () => {
  const trueBC = 0.30;
  const points = makeSyntheticTrack(trueBC, 'G7', 800, 0.15);
  assert.ok(points.length > 20, `expected a reasonably dense synthetic track, got ${points.length} points`);

  const result = estimateTrackBC({ points, dragModel: 'G7', atmo, minLeft: 10, r2CleanThreshold: 0.97 });
  assert.ok(Math.abs(result.bc - trueBC) < 5e-3, `estimated ${result.bc}, expected ~${trueBC}`);
  assert.equal(result.discardedCount, 0, 'a clean track should not need any trimming');
  assert.ok(result.r2Linear > 0.99, `r2Linear=${result.r2Linear}`);
});

test('estimateTrackBC still recovers a close BC when a few interior points are noisy outliers', () => {
  const trueBC = 0.35;
  const points = makeSyntheticTrack(trueBC, 'G7', 850, 0.15, [10, 25, 40]);

  const result = estimateTrackBC({ points, dragModel: 'G7', atmo, minLeft: 10, r2CleanThreshold: 0.97 });
  assert.ok(Math.abs(result.bc - trueBC) < 1e-2, `estimated ${result.bc}, expected ~${trueBC}`);
  assert.ok(result.discardedCount > 0, 'the injected outliers should have been trimmed');
});

test('estimateTrackBC returns keptPoints/discardedPoints that partition the input', () => {
  const points = makeSyntheticTrack(0.30, 'G7', 800, 0.15, [15, 30]);
  const result = estimateTrackBC({ points, dragModel: 'G7', atmo, minLeft: 10, r2CleanThreshold: 0.97 });
  assert.equal(result.keptPoints.length, result.keptCount);
  assert.equal(result.discardedPoints.length, result.discardedCount);
  assert.equal(result.keptCount + result.discardedCount, points.length);
});

// estimateTrackBCWholeWindow — the whole-window physics fit
// src/workers/ballistics-worker.js actually dispatches to now (see
// src/engine/labradar-bc.js). Validated in
// docs/reports/labradar-bc-validation.md to recover BC 3-9x more
// accurately than estimateTrackBC's linear fit across every tested
// configuration; the tests below check both that it still works the
// same way estimateTrackBC's own tests do, and — the point of the
// switch — that it's measurably more accurate where linear is known to
// carry a real bias.

test('estimateTrackBCWholeWindow recovers a known BC from a clean synthetic track', () => {
  const trueBC = 0.30;
  const points = makeSyntheticTrack(trueBC, 'G7', 800, 0.15);
  const result = estimateTrackBCWholeWindow({ points, dragModel: 'G7', atmo, minLeft: 10, r2CleanThreshold: 0.97 });
  assert.ok(Math.abs(result.bc - trueBC) < 5e-3, `estimated ${result.bc}, expected ~${trueBC}`);
  assert.equal(result.discardedCount, 0, 'a clean track should not need any trimming');
  assert.ok(result.r2Linear > 0.99, `r2Linear=${result.r2Linear}`);
});

test('estimateTrackBCWholeWindow still recovers a close BC when a few interior points are noisy outliers', () => {
  const trueBC = 0.35;
  const points = makeSyntheticTrack(trueBC, 'G7', 850, 0.15, [10, 25, 40]);
  const result = estimateTrackBCWholeWindow({ points, dragModel: 'G7', atmo, minLeft: 10, r2CleanThreshold: 0.97 });
  assert.ok(Math.abs(result.bc - trueBC) < 1e-2, `estimated ${result.bc}, expected ~${trueBC}`);
  assert.ok(result.discardedCount > 0, 'the injected outliers should have been trimmed');
});

test('estimateTrackBCWholeWindow returns keptPoints/discardedPoints that partition the input, plus v1', () => {
  const points = makeSyntheticTrack(0.30, 'G7', 800, 0.15, [15, 30]);
  const result = estimateTrackBCWholeWindow({ points, dragModel: 'G7', atmo, minLeft: 10, r2CleanThreshold: 0.97 });
  assert.equal(result.keptPoints.length, result.keptCount);
  assert.equal(result.discardedPoints.length, result.discardedCount);
  assert.equal(result.keptCount + result.discardedCount, points.length);
  assert.ok(Number.isFinite(result.v1));
});

test('estimateTrackBCWholeWindow recovers BC far more accurately than estimateTrackBC on a noiseless track with real curvature', () => {
  // A fast, low-BC, long-window track — the shape estimateTrackBC's own
  // linear fit is known to be biased on (see the noiseless sanity check
  // in docs/reports/labradar-bc-validation.md). No injected noise at
  // all here: this isolates the curve-shape bias itself, not noise
  // robustness.
  const trueBC = 0.10;
  const points = makeSyntheticTrack(trueBC, 'G7', 900, 0.25);

  const linear = estimateTrackBC({ points, dragModel: 'G7', atmo, minLeft: 10, r2CleanThreshold: 0.97 });
  const whole = estimateTrackBCWholeWindow({ points, dragModel: 'G7', atmo, minLeft: 10, r2CleanThreshold: 0.97 });

  const linearErr = Math.abs(linear.bc - trueBC) / trueBC;
  const wholeErr = Math.abs(whole.bc - trueBC) / trueBC;

  assert.ok(linearErr > 1e-2, `expected estimateTrackBC to show its known curvature bias here, got ${(linearErr * 100).toFixed(2)}%`);
  assert.ok(wholeErr < 1e-3, `estimateTrackBCWholeWindow should recover BC almost exactly on a noiseless track, got ${(wholeErr * 100).toFixed(3)}%`);
});

// --- aggregateTracks ---------------------------------------------------

function fixture(id, bc, r2Linear) {
  return { id, bc, r2Linear };
}

test('aggregateTracks: with no gates at all, every track is valid and the mean is a plain average', () => {
  const results = [fixture('a', 0.30, 0.99), fixture('b', 0.32, 0.98), fixture('c', 0.28, 0.97)];
  const agg = aggregateTracks(results);
  assert.equal(agg.validCount, 3);
  assert.equal(agg.totalCount, 3);
  assert.ok(Math.abs(agg.meanBc - 0.3) < 1e-9);
  assert.deepEqual(agg.verdicts.map((v) => v.verdict), ['valid', 'valid', 'valid']);
});

test('aggregateTracks: the R^2 gate rejects tracks below threshold', () => {
  const results = [fixture('a', 0.30, 0.99), fixture('b', 0.32, 0.80), fixture('c', 0.28, 0.97)];
  const agg = aggregateTracks(results, { r2GateThreshold: 0.95 });
  assert.equal(agg.validCount, 2);
  assert.deepEqual(agg.verdicts.map((v) => v.verdict), ['valid', 'rejected-r2', 'valid']);
  assert.ok(Math.abs(agg.meanBc - 0.29) < 1e-9);
});

test('aggregateTracks: the sigma-clip gate rejects a BC outlier among otherwise-valid tracks', () => {
  const results = [
    fixture('a', 0.30, 0.99), fixture('b', 0.302, 0.99), fixture('c', 0.298, 0.99),
    fixture('d', 0.301, 0.99), fixture('e', 0.299, 0.99), fixture('f', 0.80, 0.99)
  ];
  const agg = aggregateTracks(results, { sigmaClip: 2.0 });
  const verdictById = Object.fromEntries(agg.verdicts.map((v) => [v.id, v.verdict]));
  assert.equal(verdictById.f, 'rejected-outlier');
  assert.equal(verdictById.a, 'valid');
  assert.equal(agg.validCount, 5);
});

test('aggregateTracks: both gates apply together, R^2 gate first', () => {
  const results = [
    fixture('a', 0.30, 0.99), fixture('b', 0.31, 0.20), // fails R^2, never reaches the sigma-clip pool
    fixture('c', 0.302, 0.99), fixture('d', 0.298, 0.99), fixture('e', 0.301, 0.99),
    fixture('g', 0.299, 0.99), fixture('h', 0.303, 0.99),
    fixture('f', 0.80, 0.99) // passes R^2 but is a BC outlier
  ];
  const agg = aggregateTracks(results, { r2GateThreshold: 0.95, sigmaClip: 2.0 });
  const verdictById = Object.fromEntries(agg.verdicts.map((v) => [v.id, v.verdict]));
  assert.equal(verdictById.b, 'rejected-r2');
  assert.equal(verdictById.f, 'rejected-outlier');
  assert.equal(agg.validCount, 6);
});

test('aggregateTracks: a manual override forces a track in, bypassing the R^2 gate', () => {
  const results = [fixture('a', 0.30, 0.99), fixture('b', 0.31, 0.20)];
  const agg = aggregateTracks(results, { r2GateThreshold: 0.95, overrides: { b: true } });
  const verdictById = Object.fromEntries(agg.verdicts.map((v) => [v.id, v.verdict]));
  assert.equal(verdictById.b, 'valid');
  assert.equal(agg.validCount, 2);
});

test('aggregateTracks: a manual override forces a track out, bypassing both gates', () => {
  const results = [fixture('a', 0.30, 0.99), fixture('b', 0.31, 0.99)];
  const agg = aggregateTracks(results, { overrides: { b: false } });
  const verdictById = Object.fromEntries(agg.verdicts.map((v) => [v.id, v.verdict]));
  assert.equal(verdictById.b, 'excluded');
  assert.equal(agg.validCount, 1);
  assert.equal(agg.meanBc, 0.30);
});

test('aggregateTracks: a forced-include track is exempt from the sigma-clip pass, even as a statistical outlier', () => {
  const results = [
    fixture('a', 0.30, 0.99), fixture('b', 0.302, 0.99), fixture('c', 0.298, 0.99),
    fixture('d', 0.301, 0.99), fixture('e', 0.299, 0.99), fixture('f', 0.80, 0.99)
  ];
  // Without the override, 'f' is exactly the case the previous test
  // confirms gets rejected by this same sigma-clip pass.
  const agg = aggregateTracks(results, { sigmaClip: 2.0, overrides: { f: true } });
  const verdictById = Object.fromEntries(agg.verdicts.map((v) => [v.id, v.verdict]));
  assert.equal(verdictById.f, 'valid', 'a manual override should stick even though it is the outlier the sigma-clip would otherwise reject');
  assert.equal(agg.validCount, 6);
});

test('aggregateTracks: an empty valid set reports a null mean/stdev rather than NaN', () => {
  const results = [fixture('a', 0.30, 0.20)];
  const agg = aggregateTracks(results, { r2GateThreshold: 0.95 });
  assert.equal(agg.validCount, 0);
  assert.equal(agg.meanBc, null);
  assert.equal(agg.stdevBc, null);
});
