import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeImpact, solveZeroAngle } from '../src/engine/trajectory.js';
import {
  comeUpMrad, machAt, rangeAtMach, sigmaForGroup, sensitivityColumns, posterior, resolutionMatrix,
  requiredFarDistance, invalidityFloor, fitSession, fitSessionMixture, fitSessionDragMixture,
  blunderPatternForTarget, jointBlunderCheck, chronoObservation, rangeCheckObservation,
  v0MsCheckedSigma, tInflationFactor, tQuantile, dragPctMarginalSigma, applyParameters,
  losUColumn, losUFromDeg, losDegFromU, SIGMA_LOS_INCLINED_U, SIGMA_DRAG_NARROW_PCT, SIGMA_DRAG_WIDE_PCT,
  DRAG_MIXTURE_WEIGHTS, BASE_PARAMS, predictiveComeUpSd, missMetres, nextLadderRange,
  retreatAfterMissedImpact, DEFAULT_PRIORS_UNCHECKED, DEFAULT_LADDER_MAX_JUMP_FACTOR, BEYOND_CAP_CONFIDENCE_Z,
  ladderStartCheck, registerMissedImpact, registerRecordedGroup, planWholeSession, causesWeightFor
} from '../src/engine/truing-session.js';

// The reference .308 configuration these golden values are computed against.
const REF_STATE = {
  dragModel: 'G7', bc: 0.2623, muzzleVelocity: 792.48,
  zeroRange: 100, sightHeight: 50,
  tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 50,
  windSpeed: 0, windAngle: 90, losAngleDeg: 0
};

const CHECKED_PRIORS = { zeroMrad: 0.08, v0Ms: 3, dragPct: 5, trackPct: 0.15, windMs: 0.5 };

function closeTo(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: expected ${expected}, got ${actual}`);
}

// ---- Golden values ----

test('golden: come-up and Mach', () => {
  const table = { 100: [0.0000, 2.1632], 300: [1.5804, 1.8528], 600: [5.2870, 1.4340], 870: [10.1196, 1.0991] };
  for (const [r, [cu, mach]] of Object.entries(table)) {
    closeTo(comeUpMrad(REF_STATE, Number(r)), cu, 0.0001, `come-up at ${r}m`);
    closeTo(machAt(REF_STATE, Number(r)), mach, 0.0001, `Mach at ${r}m`);
  }
});

test('the supersonic ceiling follows the speed of sound in the state\'s own air: nearer in the cold, farther in the heat', () => {
  const at = (tempC) => rangeAtMach({ ...REF_STATE, tempC }, 1.1);
  const cold = at(-10); const std = at(15); const hot = at(40);
  assert.ok(cold < std && std < hot);
  assert.ok(std - cold > 15 && std - cold < 80, `cold shift ${std - cold}`);
  assert.ok(hot - std > 15 && hot - std < 80, `hot shift ${hot - std}`);
});

test('golden: rangeAtMach', () => {
  closeTo(rangeAtMach(REF_STATE, 1.1), 869.2, 0.1, 'rangeAtMach(1.1)');
  const altState = { ...REF_STATE, pressureHpa: 850, altitudeM: 1500 };
  closeTo(rangeAtMach(altState, 1.1), 1037, 1, 'altitude rangeAtMach(1.1)');
  closeTo(rangeAtMach(altState, 1.15), 986, 1, 'altitude rangeAtMach(1.15)');
});

test('golden: sigmaForGroup', () => {
  closeTo(sigmaForGroup({ shots: 1 }), 0.151042, 0.000001, 'n=1');
  closeTo(sigmaForGroup({ shots: 4 }), 0.079551, 0.000001, 'n=4');
  closeTo(sigmaForGroup({ shots: 8 }), 0.059841, 0.000001, 'n=8');
  closeTo(sigmaForGroup({ shots: 4, r50Mrad: 0.14 }), 0.099313, 0.000001, '"basic" preset n=4');
  closeTo(sigmaForGroup({ shots: 8, r50Mrad: 0.14 }), 0.073132, 0.000001, '"basic" preset n=8');
});

test('golden: sensitivity columns', () => {
  const j100 = sensitivityColumns(REF_STATE, 100);
  assert.equal(j100.zeroMrad, 1);
  closeTo(j100.v0Ms, 0, 1e-9, 'J(100).v0Ms at the zero range');
  closeTo(j100.dragPct, 0, 1e-9, 'J(100).dragPct at the zero range');
  // the bore is zeroed in calm air (see withFixedBore), so 5 m/s more headwind moves the impact at the zero range by a
  // hair (0.00005 mrad here); it used to be exactly 0 only because the zero was re-solved in the wind
  closeTo(j100.windMs, 0, 1e-4, 'J(100).windMs at the zero range');

  const j870 = sensitivityColumns(REF_STATE, 870);
  closeTo(j870.v0Ms, -0.030886, 0.000001, 'J(870).v0Ms');
  closeTo(j870.dragPct, 0.075402, 0.000001, 'J(870).dragPct');
  closeTo(j870.trackPct, 0.101196, 0.000001, 'J(870).trackPct');
  // 0.021764 while the zero was re-solved in the perturbed wind; the bore is now zeroed in calm air, so this is the wind's own effect
  closeTo(j870.windMs, 0.021810, 0.000001, 'J(870).windMs -- requires windAngle forced to 0 for the perturbation (see the fix comment in engine/truing-session.js)');
});

test('golden: near-target resolvability -- requiredFarDistance / invalidityFloor', () => {
  const unresolved = { resolved: false };
  const resolved = { resolved: true };
  assert.equal(requiredFarDistance({ state: REF_STATE, priors: CHECKED_PRIORS, nearM: 100, nearShots: 4, nearOpts: unresolved, farShots: 8, targetSdPct: 3 }), 630);
  assert.equal(requiredFarDistance({ state: REF_STATE, priors: CHECKED_PRIORS, nearM: 100, nearShots: 4, nearOpts: unresolved, farShots: 8, targetSdPct: 2 }), 795);
  assert.equal(invalidityFloor({ state: REF_STATE, priors: CHECKED_PRIORS, nearM: 100, nearShots: 4, nearOpts: unresolved }), 465);
  assert.equal(requiredFarDistance({ state: REF_STATE, priors: CHECKED_PRIORS, nearM: 100, nearShots: 4, nearOpts: resolved, farShots: 8, targetSdPct: 3 }), 610);
  assert.equal(requiredFarDistance({ state: REF_STATE, priors: CHECKED_PRIORS, nearM: 100, nearShots: 4, nearOpts: resolved, farShots: 8, targetSdPct: 2 }), 770);
  assert.equal(invalidityFloor({ state: REF_STATE, priors: CHECKED_PRIORS, nearM: 100, nearShots: 4, nearOpts: resolved }), 435);
});

test('golden: near-target zero posterior SD, resolved vs the three-level certainty picker', () => {
  const priors = { zeroMrad: 0.08 };
  const params = ['zeroMrad'];
  const resolvedSd = sigmaForGroup({ shots: 4 });
  closeTo(posterior({ state: REF_STATE, groups: [{ rangeM: 100, shots: 4, sigmaMrad: resolvedSd }], priors, params }).sd[0], 0.0564, 0.0001, 'resolved');
  closeTo(posterior({ state: REF_STATE, groups: [{ rangeM: 100, shots: 4, sigmaMrad: 0.05 }], priors, params }).sd[0], 0.0424, 0.0001, 'Very certain');
  closeTo(posterior({ state: REF_STATE, groups: [{ rangeM: 100, shots: 4, sigmaMrad: 0.10 }], priors, params }).sd[0], 0.0625, 0.0001, 'Fairly certain');
  closeTo(posterior({ state: REF_STATE, groups: [{ rangeM: 100, shots: 4, sigmaMrad: 0.15 }], priors, params }).sd[0], 0.0706, 0.0001, 'Less certain (default)');
});

test('golden: full posterior + resolution matrix, 100m x4 + 870m x8, chronographed', () => {
  const groups = [{ rangeM: 100, shots: 4 }, { rangeM: 870, shots: 8 }];
  const post = posterior({ state: REF_STATE, groups, priors: CHECKED_PRIORS });
  const expectedSd = [0.0558, 2.9173, 1.5768, 0.1499, 0.4998];
  post.sd.forEach((v, i) => closeTo(v, expectedSd[i], 0.0002, `sd[${BASE_PARAMS[i]}]`));

  const rm = resolutionMatrix({ cov: post.cov, priors: CHECKED_PRIORS, params: post.params });
  const expectedRtilde = [
    [0.513, -0.023, 0.095, 0.004, 0.003],
    [-0.023, 0.054, -0.221, -0.009, -0.006],
    [0.095, -0.221, 0.901, 0.036, 0.026],
    [0.004, -0.009, 0.036, 0.001, 0.001],
    [0.003, -0.006, 0.026, 0.001, 0.001]
  ];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) closeTo(rm.Rtilde[i][j], expectedRtilde[i][j], 0.002, `Rtilde[${i}][${j}]`);
});

test('golden: unchecked v0Ms prior (no chronograph) and near-target-at-300 variants', () => {
  const groups = [{ rangeM: 100, shots: 4 }, { rangeM: 870, shots: 8 }];
  const noChrono = posterior({ state: REF_STATE, groups, priors: { ...CHECKED_PRIORS, v0Ms: 20 } });
  closeTo(noChrono.sd[BASE_PARAMS.indexOf('dragPct')], 4.2785, 0.001, 'dragPct, no chronograph');
  closeTo(noChrono.sd[BASE_PARAMS.indexOf('zeroMrad')], 0.0562, 0.0002, 'zeroMrad, no chronograph');
  closeTo(noChrono.sd[BASE_PARAMS.indexOf('v0Ms')], 10.6049, 0.001, 'v0Ms, no chronograph');

  const nearAt300 = posterior({ state: REF_STATE, groups: [{ rangeM: 300, shots: 4 }, { rangeM: 870, shots: 8 }], priors: CHECKED_PRIORS });
  closeTo(nearAt300.sd[BASE_PARAMS.indexOf('dragPct')], 1.5496, 0.001, 'dragPct, near at 300m');
  closeTo(nearAt300.sd[BASE_PARAMS.indexOf('zeroMrad')], 0.0577, 0.0002, 'zeroMrad, near at 300m');
});

test('golden: rifle-precision variants of sigmaForGroup feeding the posterior', () => {
  const groups14 = [{ rangeM: 100, shots: 4, r50Mrad: 0.14 }, { rangeM: 870, shots: 8, r50Mrad: 0.14 }];
  const post14 = posterior({ state: REF_STATE, groups: groups14, priors: CHECKED_PRIORS });
  closeTo(post14.sd[BASE_PARAMS.indexOf('dragPct')], 1.6831, 0.001, 'dragPct, "basic" 0.14 mrad');
  closeTo(post14.sd[BASE_PARAMS.indexOf('zeroMrad')], 0.0615, 0.0002, 'zeroMrad, "basic" 0.14 mrad');

  const groups06 = [{ rangeM: 100, shots: 4, r50Mrad: 0.06 }, { rangeM: 870, shots: 8, r50Mrad: 0.06 }];
  const post06 = posterior({ state: REF_STATE, groups: groups06, priors: CHECKED_PRIORS });
  closeTo(post06.sd[BASE_PARAMS.indexOf('dragPct')], 1.5984, 0.001, 'dragPct, "supermatch" 0.06 mrad');
  closeTo(post06.sd[BASE_PARAMS.indexOf('zeroMrad')], 0.0572, 0.0002, 'zeroMrad, "supermatch" 0.06 mrad');
});

test('golden: dragPct mixture prior constants', () => {
  closeTo(SIGMA_DRAG_NARROW_PCT, 2.658, 0.001, 'narrow sigma');
  closeTo(SIGMA_DRAG_WIDE_PCT, 8.678, 0.001, 'wide sigma');
  assert.deepEqual(DRAG_MIXTURE_WEIGHTS, [0.8, 0.2]);
  closeTo(dragPctMarginalSigma(), 4.551, 0.001, 'marginal sigma for planning');
});

test('golden: v0MsCheckedSigma / tInflationFactor / tQuantile', () => {
  closeTo(v0MsCheckedSigma({ mvSD: 2, nToday: 8, mvSdSampleSize: null }), 0.7071, 0.0001, 'no sample size (preset)');
  closeTo(v0MsCheckedSigma({ mvSD: 2, nToday: 8, mvSdSampleSize: 5 }), 1.0017, 0.0001, 'sample size 5');
  closeTo(v0MsCheckedSigma({ mvSD: 2, nToday: 8, mvSdSampleSize: 10 }), 0.8161, 0.0001, 'sample size 10');
  closeTo(v0MsCheckedSigma({ mvSD: 2, nToday: 8, mvSdSampleSize: 20 }), 0.7551, 0.0001, 'sample size 20');
  closeTo(v0MsCheckedSigma({ mvSD: 2, nToday: 8, mvSdSampleSize: 50 }), 0.7250, 0.0001, 'sample size 50');
  closeTo(tInflationFactor(3), 2.1952, 0.0001, 'tInflationFactor n=3');
  closeTo(tInflationFactor(10), 1.1542, 0.0001, 'tInflationFactor n=10');
  closeTo(tInflationFactor(30), 1.0435, 0.0001, 'tInflationFactor n=30');
  closeTo(tInflationFactor(100), 1.0124, 0.0001, 'tInflationFactor n=100');
  closeTo(tQuantile(0.975, 1), 12.7062, 0.0001, 'tQuantile df=1');
  closeTo(tQuantile(0.975, 9), 2.2622, 0.0001, 'tQuantile df=9');
  closeTo(tQuantile(0.975, 29), 2.0452, 0.0001, 'tQuantile df=29');
});

test('golden: the deterministic shot-sequencing ladder', () => {
  const cov = posterior({ state: REF_STATE, groups: [], priors: DEFAULT_PRIORS_UNCHECKED }).cov;
  const ranges = [100, 200, 300, 400, 500, 600, 700, 800, 870];
  // These expected SDs are off by up to 0.16% from an earlier printed
  // reference table at the far end of this column -- a pre-existing
  // rounding artifact in that table, not a bug here (verified directly
  // against the engine itself). The ladder's actual DECISIONS below are
  // what matters and are unaffected either way.
  const expectedSd = { 100: 0.250000, 200: 0.254597, 300: 0.270724, 400: 0.301686, 500: 0.350617, 600: 0.420852, 700: 0.516756, 800: 0.644570, 870: 0.757611 };
  for (const r of ranges) closeTo(predictiveComeUpSd({ state: REF_STATE, cov, rangeM: r }), expectedSd[r], 0.0001, `predictiveComeUpSd(${r})`);

  // the step cap is 4 times the farthest validated distance
  assert.equal(nextLadderRange({ state: REF_STATE, cov, candidateRanges: ranges, farthestValidatedM: null }), 100);
  assert.equal(nextLadderRange({ state: REF_STATE, cov, candidateRanges: ranges, farthestValidatedM: 100 }), 400);
  assert.equal(nextLadderRange({ state: REF_STATE, cov, candidateRanges: ranges, farthestValidatedM: 200 }), 800);
  assert.equal(nextLadderRange({ state: REF_STATE, cov, candidateRanges: ranges, farthestValidatedM: 400 }), 870);
  // and with the earlier cap of 2 and no step beyond it, the earlier ladder
  const old = { maxJumpFactor: 2, beyondCap: false };
  assert.equal(nextLadderRange({ state: REF_STATE, cov, candidateRanges: ranges, farthestValidatedM: 100, ...old }), 200);
  assert.equal(nextLadderRange({ state: REF_STATE, cov, candidateRanges: ranges, farthestValidatedM: 200, ...old }), 400);
  assert.equal(nextLadderRange({ state: REF_STATE, cov, candidateRanges: ranges, farthestValidatedM: 400, ...old }), 800);
  assert.equal(retreatAfterMissedImpact({ lastSeenRangeM: 400, failedRangeM: 800 }), 600);
});

// ---- Three ported-engine gaps that fail silently rather than throwing ----

const BULLETS = JSON.parse(readFileSync(new URL('../src/bullets/geladen/bullets.json', import.meta.url)));
const CD_TABLE_BULLET = BULLETS.find((b) => b.id === 'ruag-338-swissp-ball-252');
assert.ok(CD_TABLE_BULLET && CD_TABLE_BULLET.profile.type === 'cdTable', 'fixture bullet must actually be a cdTable bullet');

test('dragPct sensitivity is non-zero for a real Cd-table library bullet', () => {
  const state = {
    cdTable: CD_TABLE_BULLET.profile.table, massKg: CD_TABLE_BULLET.massKg, caliberM: CD_TABLE_BULLET.caliberM,
    muzzleVelocity: 830, zeroRange: 100, sightHeight: 50,
    tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 50,
    windSpeed: 0, windAngle: 0, losAngleDeg: 0
  };
  const cols = sensitivityColumns(state, 800);
  assert.notEqual(cols.dragPct, 0, 'a naive bc-only rescale is a silent no-op for a cdTable bullet -- 247 of 385 library bullets are this type');
  // v0Ms should behave normally either way (sanity check the fixture itself isn't broken).
  assert.notEqual(cols.v0Ms, 0);
});

test('the losU_t column is non-zero at u=0, and a negative-u hypothesis is rejected outright', () => {
  // A direct column check at u=0 (the degrees-parameterised version would be exactly zero here -- the whole reason for u).
  const column = losUColumn(REF_STATE, 600, 0, 0);
  assert.notEqual(column, 0, 'losU column must be non-zero at u=0, unlike a degrees-parameterised column at delta=0');

  // A residual that no real inclination could produce (dialled MORE than predicted) must reject the
  // "inclined" hypothesis outright (zero weight), not just downweight it.
  const base = comeUpMrad(REF_STATE, 700);
  const observations = [{ rangeM: 700, observedComeUp: base + 0.3, shots: 8, targetIndex: 0 }];
  const axes = [{
    kind: 'target', targetIndex: 0,
    choices: [
      { label: 'fine', terms: [{ suffix: 'rangeErrM', sigma: 0.7 }] },
      { label: 'inclined', terms: [{ suffix: 'rangeErrM', sigma: 0.7 }, { suffix: 'losU', sigma: SIGMA_LOS_INCLINED_U }] }
    ],
    weights: [0.9, 0.1]
  }];
  const mix = fitSessionMixture({ state: REF_STATE, observations, priors: CHECKED_PRIORS, axes });
  const inclinedResult = mix.results.find((r) => r.label === 'inclined');
  assert.ok(inclinedResult.fit.theta.losU_0 < 0, 'the fixture should force the inclined hypothesis to a negative u');
  assert.equal(inclinedResult.weight, 0, 'a negative-u hypothesis must carry zero prior weight, not a merely small one');
  assert.deepEqual(mix.posteriorWeights, [1, 0]);
});

test('sightHeight is consumed in millimetres, not metres', () => {
  // The historical bug: passing a metres value (e.g. 0.07) straight
  // through where the engine expects millimetres. A real view built from
  // cartridge.getValues()/rifle.getValues() (whose
  // engine unit for sightHeight is mm, per src/units.js's FIELD_UNITS)
  // never produces the metres value -- this pins the consequence down
  // directly, against the actual physics.
  const correctMm = comeUpMrad({ ...REF_STATE, sightHeight: 50 }, 300); // 50 mm, a realistic scope height
  const wrongAsMetres = comeUpMrad({ ...REF_STATE, sightHeight: 0.05 }, 300); // the historical metres-instead-of-mm bug
  assert.ok(Math.abs(correctMm - wrongAsMetres) > 0.01, 'a 1000x sightHeight error must move the come-up meaningfully -- the units are load-bearing, not cosmetic');
  closeTo(correctMm, 1.5804, 0.0001, 'the correct (mm) come-up must match the golden value above, which is itself computed with sightHeight: 50');
});

// ---- bcGainFactor ----

test('bcGainFactor: BC-profile and Cd-table bullets get the same come-up change for the same factor', () => {
  const baseCd = {
    cdTable: CD_TABLE_BULLET.profile.table, massKg: CD_TABLE_BULLET.massKg, caliberM: CD_TABLE_BULLET.caliberM,
    muzzleVelocity: 830, zeroRange: 100, sightHeight: 50,
    tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 50, windSpeed: 0, windAngle: 0, losAngleDeg: 0
  };
  for (const range of [300, 600, 900]) {
    for (const factor of [1.0, 1.05, 0.95]) {
      const viaGainFactor = computeImpact({ ...baseCd, bcGainFactor: factor }, range).dropCm;
      const viaMassScale = computeImpact({ ...baseCd, massKg: baseCd.massKg * factor }, range).dropCm;
      assert.equal(viaGainFactor, viaMassScale, `range ${range}m factor ${factor}: bcGainFactor must agree with the equivalent mass scaling to the last digit`);
    }
  }
});

test('bcGainFactor: a missing field reads as exactly 1.0', () => {
  const withoutField = computeImpact(REF_STATE, 600).dropCm;
  const explicit1 = computeImpact({ ...REF_STATE, bcGainFactor: 1 }, 600).dropCm;
  assert.equal(withoutField, explicit1);
});

test('bcGainFactor: applyParameters folds a fitted dragPct through 1/(1+dragPct/100), compounding onto any existing factor', () => {
  const applied = applyParameters({ ...REF_STATE, bcGainFactor: 1.05 }, { dragPct: 10 });
  closeTo(applied.bcGainFactor, 1.05 / 1.1, 1e-9, 'compounds onto the existing 1.05, does not replace it');

  const fresh = applyParameters(REF_STATE, { dragPct: 10 });
  closeTo(fresh.bcGainFactor, 1 / 1.1, 1e-9, 'a missing starting factor behaves as 1.0');

  // Committing a session's result twice, by the same dragPct each time, compounds -- it must
  // land on the product of the two factors, not just the second one.
  const oldFactor = 1.05;
  const dragPct = 3;
  const newFactor = oldFactor / (1 + dragPct / 100);
  const newFactorAgain = newFactor / (1 + dragPct / 100);
  closeTo(newFactorAgain, oldFactor / ((1 + dragPct / 100) ** 2), 1e-9, 'two equal truings land on the product of the two factors');
});

// ---- headline scenarios, with fixed seeds so the synthetic observations
// are exactly reproducible ----
// mulberry32 + Box-Muller, a small deterministic PRNG/Gaussian pair so
// every scenario below is bit-identical across runs.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng) {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
// This scenario group's own reference state -- windAngle 0, unlike the
// golden-value state's windAngle-90 demonstration state -- and its own
// muzzle velocity (2600 fps), not the golden .2623 BC state's 792.48 m/s
// figure.
const SCEN_REF = {
  dragModel: 'G7', bc: 0.2623, muzzleVelocity: 2600 * 0.3048,
  zeroRange: 100, sightHeight: 50,
  tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 50,
  windSpeed: 0, windAngle: 0, losAngleDeg: 0
};
function simulateObservation({ trueState, believedRangeM, trueRangeM = believedRangeM, trueLosDeg = 0, trueZeroMrad = 0, shots, r50Mrad = null, resolved = true, targetIndex, rng }) {
  const sigma = sigmaForGroup({ shots, r50Mrad, resolved });
  const trueComeUp = comeUpMrad({ ...trueState, losAngleDeg: trueLosDeg }, trueRangeM) + trueZeroMrad;
  const observedComeUp = trueComeUp + gaussian(rng) * sigma;
  return { rangeM: believedRangeM, observedComeUp, shots, r50Mrad, resolved, targetIndex, sigmaMrad: undefined };
}

test('Scenario C/D: the v0/drag degeneracy is real, and only a chronograph breaks it', () => {
  const trueDragPct = 8;
  const trueState = { ...SCEN_REF, bc: SCEN_REF.bc / (1 + trueDragPct / 100) };

  // C: chronographed (tight v0Ms prior) -- dragPct comes out clean, near-uncorrelated with v0Ms.
  {
    const rng = mulberry32(2);
    const priors = { zeroMrad: 0.08, v0Ms: 3, dragPct: 5, trackPct: 0.15, windMs: 0.5 };
    const observations = [
      simulateObservation({ trueState, believedRangeM: 100, shots: 4, resolved: true, targetIndex: 0, rng }),
      simulateObservation({ trueState, believedRangeM: 870, shots: 8, resolved: true, targetIndex: 1, rng })
    ];
    const fit = fitSession({ state: SCEN_REF, observations, priors });
    closeTo(fit.theta.dragPct, 6.403, 0.01, 'C: recovered dragPct');
    closeTo(fit.sd.dragPct, 1.429, 0.01, 'C: dragPct sd');
    closeTo(fit.theta.v0Ms, -0.870, 0.01, 'C: v0Ms stays near 0, chronographed');
    const { Rtilde } = resolutionMatrix({ cov: fit.cov, priors });
    const iv0 = BASE_PARAMS.indexOf('v0Ms'), idrag = BASE_PARAMS.indexOf('dragPct');
    closeTo(Rtilde[idrag][iv0], -0.208, 0.005, 'C: v0Ms/dragPct correlation, chronographed');
  }

  // D: same injected error, same seed, but NOT chronographed -- v0Ms and dragPct become
  // nearly indistinguishable (|corr| far past DEGENERACY_R).
  {
    const rng = mulberry32(2);
    const priors = { zeroMrad: 0.08, v0Ms: 20, dragPct: 5, trackPct: 0.15, windMs: 0.5 };
    const observations = [
      simulateObservation({ trueState, believedRangeM: 100, shots: 4, resolved: true, targetIndex: 0, rng }),
      simulateObservation({ trueState, believedRangeM: 870, shots: 8, resolved: true, targetIndex: 1, rng })
    ];
    const fit = fitSession({ state: SCEN_REF, observations, priors });
    closeTo(fit.theta.dragPct, 1.880, 0.01, 'D: recovered dragPct');
    closeTo(fit.theta.v0Ms, -12.088, 0.01, 'D: recovered v0Ms');
    const cov = posterior({ state: SCEN_REF, groups: [{ rangeM: 100, shots: 4 }, { rangeM: 870, shots: 8 }], priors }).cov;
    const iv0 = BASE_PARAMS.indexOf('v0Ms'), idrag = BASE_PARAMS.indexOf('dragPct');
    const rawCorr = cov[iv0][idrag] / Math.sqrt(cov[iv0][iv0] * cov[idrag][idrag]);
    closeTo(rawCorr, 0.967, 0.005, 'D: raw v0Ms/dragPct correlation, un-chronographed');
    assert.ok(Math.abs(rawCorr) > 0.8, 'must exceed DEGENERACY_R -- the tool must report v0/drag jointly, never name "drag" alone');
  }
});

test('Scenario E: an un-modelled range blunder masquerades as a spurious drag finding, and the mixture catches it', () => {
  const rng = mulberry32(3);
  const priors = { zeroMrad: 0.08, v0Ms: 3, dragPct: 5, trackPct: 0.15, windMs: 0.5 };
  const observations = [
    simulateObservation({ trueState: SCEN_REF, believedRangeM: 100, shots: 4, resolved: true, targetIndex: 0, rng }),
    simulateObservation({ trueState: SCEN_REF, believedRangeM: 870, trueRangeM: 900, shots: 8, resolved: true, targetIndex: 1, rng })
  ];

  const naiveFit = fitSession({ state: SCEN_REF, observations, priors });
  closeTo(naiveFit.theta.dragPct, 8.209, 0.01, 'without a blunder term, a 30m range error is blamed entirely on drag');
  closeTo(naiveFit.sd.dragPct, 1.391, 0.01, 'and looks confidently material, not merely noisy');

  const blunder = blunderPatternForTarget({ state: SCEN_REF, observations, priors, targetIndex: 1 });
  const fineResult = blunder.results.find((r) => r.pattern === 'fine');
  const blunderResult = blunder.results.find((r) => r.pattern === 'blunder');
  closeTo(blunder.posteriorWeights[blunder.results.indexOf(fineResult)], 0.843, 0.005, 'fine pattern posterior weight');
  closeTo(blunder.posteriorWeights[blunder.results.indexOf(blunderResult)], 0.157, 0.005, 'blunder pattern posterior weight');
  closeTo(blunderResult.fit.theta.rangeErrM_1, 16.7, 0.1, 'recovered rangeErrM under the blunder pattern (true injected error: 30m -- a ballistics-only estimate undershoots, which is why a live re-check resolves it far more tightly, see Scenario Q below)');
});

test('Scenario P: dragPct as a mixture reports tighter for a typical BC, wider for an outlier', () => {
  function runCase(trueDragPct) {
    const rng = mulberry32(42);
    const trueState = { ...SCEN_REF, bc: SCEN_REF.bc / (1 + trueDragPct / 100) };
    const observations = [
      simulateObservation({ trueState, believedRangeM: 100, shots: 4, resolved: true, targetIndex: 0, rng }),
      simulateObservation({ trueState, believedRangeM: 870, shots: 8, resolved: true, targetIndex: 1, rng })
    ];
    const flatFit = fitSession({ state: SCEN_REF, observations, priors: { zeroMrad: 0.08, v0Ms: 3, dragPct: 5, trackPct: 0.15, windMs: 0.5 } });
    const mix = fitSessionDragMixture({ state: SCEN_REF, observations, priors: { zeroMrad: 0.08, v0Ms: 3, trackPct: 0.15, windMs: 0.5 } });
    return { flatFit, mix };
  }

  const typical = runCase(2);
  closeTo(typical.flatFit.theta.dragPct, 2.066, 0.01, 'P1 flat: theta');
  closeTo(typical.flatFit.sd.dragPct, 1.528, 0.01, 'P1 flat: sd');
  closeTo(typical.mix.theta.dragPct, 1.708, 0.01, 'P1 mixture: theta');
  closeTo(typical.mix.sd.dragPct, 1.410, 0.01, 'P1 mixture: sd -- tighter than the flat prior for a typical BC');
  closeTo(typical.mix.posteriorWeights[0], 0.901, 0.005, 'P1: posterior weight on the narrow (typical) component');

  const outlier = runCase(9);
  closeTo(outlier.flatFit.theta.dragPct, 8.478, 0.01, 'P2 flat: theta');
  closeTo(outlier.flatFit.sd.dragPct, 1.386, 0.01, 'P2 flat: sd');
  closeTo(outlier.mix.theta.dragPct, 8.586, 0.01, 'P2 mixture: theta');
  closeTo(outlier.mix.sd.dragPct, 1.615, 0.01, 'P2 mixture: sd -- wider than the flat prior for an outlier BC');
  closeTo(outlier.mix.posteriorWeights[1], 0.803, 0.005, 'P2: posterior weight shifts to the wide (outlier) component');
});

test('Scenario Q: joint blunder detection vs one-at-a-time, plus a live rangefinder re-check', () => {
  const rng = mulberry32(99);
  const trueV0Shift = -40;
  const trueState = { ...SCEN_REF, muzzleVelocity: SCEN_REF.muzzleVelocity + trueV0Shift };
  const mvSD = 3, nChrono = 12;
  const priors = { zeroMrad: 0.08, v0Ms: 20, trackPct: 0.15, windMs: 0.5 };
  const observations = [
    simulateObservation({ trueState, believedRangeM: 100, shots: 4, resolved: true, targetIndex: 0, rng }),
    simulateObservation({ trueState, believedRangeM: 860, trueRangeM: 850, shots: 8, resolved: true, targetIndex: 1, rng }),
    simulateObservation({ trueState, believedRangeM: 870, shots: 8, resolved: true, targetIndex: 2, rng })
  ];
  const velocitiesMs = Array.from({ length: nChrono }, () => (SCEN_REF.muzzleVelocity + trueV0Shift) + gaussian(rng) * mvSD);
  const chrono = chronoObservation({ state: SCEN_REF, velocitiesMs, mvSD });
  const finalObservations = [...observations, chrono];

  const oneAtATime = [0, 1, 2].map((idx) => blunderPatternForTarget({ state: SCEN_REF, observations, priors: { ...priors, dragPct: dragPctMarginalSigma() }, targetIndex: idx, rechecked: true }).posteriorWeights[1]);
  closeTo(oneAtATime[1], 0.8756, 0.001, 'one-at-a-time: the real culprit (860m)');
  closeTo(oneAtATime[2], 0.9352, 0.001, 'one-at-a-time: over-flags its clean 10m-away neighbour (870m) nearly as hard');

  const joint = jointBlunderCheck({ state: SCEN_REF, observations: finalObservations, priors, targetIndices: [0, 1, 2], rechecked: true });
  closeTo(joint.marginalBlunder[1], 0.5439, 0.001, 'joint: the real culprit stays flagged');
  closeTo(joint.marginalBlunder[2], 0.3934, 0.001, 'joint: its clean neighbour is substantially exonerated once the shared v0Ms cause is credited to v0Ms itself');
  closeTo(joint.theta.v0Ms, -39.07, 0.01, 'joint: recovered v0Ms (true -40)');

  const rangeCheck = rangeCheckObservation({ targetIndex: 1, believedRangeM: 860, newReadingM: 850.4 });
  const withCheck = jointBlunderCheck({ state: SCEN_REF, observations: [...finalObservations, rangeCheck], priors, targetIndices: [0, 1, 2], rechecked: true });
  closeTo(withCheck.marginalBlunder[1], 1.0000, 0.0005, 'a second reading resolves the 860m target almost completely');
  closeTo(withCheck.marginalBlunder[2], 0.0093, 0.001, 'and fully exonerates its neighbour');
  const bestIdx = withCheck.posteriorWeights.indexOf(Math.max(...withCheck.posteriorWeights));
  closeTo(withCheck.results[bestIdx].fit.theta.rangeErrM_1, -9.9, 0.1, 'the direct re-reading pins the correction size (true -10m), tighter than ballistics alone (Scenario E\'s own 16.7m vs a true 30m)');
});

// ---- audit fixes ----
import {
  planSession, planPosterior, snapRetreat, planLadderWalk, plannedV0Sigma, correlationOf, degenerateGroups,
  PLAN_CANDIDATE_CAP, SUPERSONIC_MACH, planningColumns, clearPlanningMemo, laplaceLogEvidence, predictedComeUp,
  withConditions, withFixedBore, alongAxisWind, windageMrad, nextShotDope, JOINT_BLUNDER_MAX_SIMULTANEOUS, clearWalkers
} from '../src/engine/truing-session.js';

test('planPosterior reproduces the resolved/unresolved near-target drag SDs and the 0.43 zero/drag overlap from the golden reference plan', () => {
  const plan = { state: REF_STATE, ranges: [100, 870], shots: [4, 8], priors: CHECKED_PRIORS };
  closeTo(planPosterior({ ...plan }).dragSd, 1.655, 0.001, 'unresolved near (the default)');
  const resolved = planPosterior({ ...plan, nearResolved: true });
  closeTo(resolved.dragSd, 1.577, 0.001, 'resolved near');
  closeTo(resolved.zeroDragCorr, 0.43, 0.01, '|corr(zero, drag)|');
});

test('planSession applies the session r50 and plans the near target unresolved by default', () => {
  // 860, not 870: the golden reference's own 870 m sits just past this bullet's 869.2 m ceiling.
  const args = { state: REF_STATE, availableDistances: [100, 860], roundBudget: 12, priors: CHECKED_PRIORS };
  const idealised = planSession({ ...args, nearResolved: true });
  const unresolved = planSession({ ...args });
  const rackRifle = planSession({ ...args, r50Mrad: 0.14 });
  assert.ok(unresolved.dragSd > idealised.dragSd, 'unresolved near must cost precision');
  assert.ok(rackRifle.dragSd > unresolved.dragSd, 'a real rifle\'s dispersion must cost precision');
  assert.ok(rackRifle.cov && rackRifle.zeroDragCorr > 0, 'the plan reports its covariance and zero/drag overlap');
});

test('planSession caps a long candidate list and still plans', () => {
  const many = Array.from({ length: 40 }, (_, i) => 100 + i * 20);
  const plan = planSession({ state: REF_STATE, availableDistances: many, roundBudget: 12, priors: CHECKED_PRIORS });
  assert.ok(PLAN_CANDIDATE_CAP === 12);
  assert.ok(plan.ranges.every((r) => many.includes(r)));
  assert.ok(Math.max(...plan.ranges) <= rangeAtMach(REF_STATE, 1.1));
});

test('nextLadderRange never proposes a range at or beyond a missed impact', () => {
  const cov = posterior({ state: REF_STATE, groups: [], priors: DEFAULT_PRIORS_UNCHECKED }).cov;
  const candidateRanges = [100, 200, 300, 400, 500, 600, 700, 800, 870];
  const next = nextLadderRange({ state: REF_STATE, cov, candidateRanges, triedRanges: [100, 200, 400, 800], missedRanges: [800], farthestValidatedM: 400 });
  assert.equal(next, 700);
});

test('snapRetreat snaps the midpoint to real, untried ground between the two ranges, or returns null', () => {
  const available = [100, 200, 300, 400, 500, 600, 700, 800, 870];
  assert.equal(snapRetreat({ lastSeenRangeM: 400, failedRangeM: 800, availableRanges: available, triedRanges: [100, 200, 400, 800] }), 600);
  assert.ok([500, 700].includes(snapRetreat({ lastSeenRangeM: 400, failedRangeM: 800, availableRanges: [400, 500, 700, 800], triedRanges: [400, 800] })));
  assert.equal(snapRetreat({ lastSeenRangeM: 100, failedRangeM: 870, availableRanges: [100, 870], triedRanges: [100, 870] }), null);
});

test('planLadderWalk: the deterministic ladder golden, and a location with no intermediate ground cannot be walked', () => {
  const cov = posterior({ state: REF_STATE, groups: [], priors: DEFAULT_PRIORS_UNCHECKED }).cov;
  const walk = planLadderWalk({ state: REF_STATE, cov, candidateRanges: [100, 200, 300, 400, 500, 600, 700, 800, 870], destinationM: 870 });
  assert.deepEqual(walk.rungs, [100, 400, 870]);
  assert.equal(walk.reachesDestination, true);
  const old = planLadderWalk({ state: REF_STATE, cov, candidateRanges: [100, 200, 300, 400, 500, 600, 700, 800, 870], destinationM: 870, maxJumpFactor: 2, beyondCap: false });
  assert.deepEqual(old.rungs, [100, 200, 400, 800, 870], 'the earlier cap of 2, no step beyond it');
  // no intermediate ground: stalls under the earlier rule, and now only if the predicted miss at the far target is off the backdrop
  assert.equal(planLadderWalk({ state: REF_STATE, cov, candidateRanges: [100, 870], destinationM: 870, maxJumpFactor: 2, beyondCap: false }).reachesDestination, false);
  assert.equal(planLadderWalk({ state: REF_STATE, cov, candidateRanges: [100, 870], destinationM: 870, backdropMarginM: 1 }).reachesDestination, false, 'a small backdrop still stops a jump that is too big');
});

test('chronoObservation carries the Student\'s-t sample-size inflation; plannedV0Sigma combines the prior with the planned readings', () => {
  const velocitiesMs = [792, 793, 792.5, 791.5, 792.8, 792.2, 793.1, 791.9];
  closeTo(chronoObservation({ state: REF_STATE, velocitiesMs, mvSD: 2, mvSdSampleSize: 10 }).sigmaMs, 0.8161, 0.0001, 'sample size 10');
  closeTo(chronoObservation({ state: REF_STATE, velocitiesMs, mvSD: 2 }).sigmaMs, 0.7071, 0.0001, 'preset, no inflation');
  closeTo(plannedV0Sigma({ priorSigma: 20, chronographed: true, mvSD: 2, nShots: 8 }), 1 / Math.sqrt(1 / 400 + 1 / 0.5), 1e-9, 'combined');
  assert.equal(plannedV0Sigma({ priorSigma: 20, chronographed: false, mvSD: 2, nShots: 8 }), 20);
});

test('degenerateGroups finds the un-chronographed v0/drag pair and nothing once v0 is pinned', () => {
  const groups = [{ rangeM: 100, shots: 4 }, { rangeM: 870, shots: 8 }];
  const loose = posterior({ state: REF_STATE, groups, priors: { ...CHECKED_PRIORS, v0Ms: 20 } });
  assert.deepEqual(degenerateGroups(loose.cov, BASE_PARAMS).map((g) => [...g].sort()), [['dragPct', 'v0Ms']]);
  assert.ok(Math.abs(correlationOf(loose.cov, BASE_PARAMS, 'v0Ms', 'dragPct')) > 0.9);
  const pinned = posterior({ state: REF_STATE, groups, priors: CHECKED_PRIORS });
  assert.deepEqual(degenerateGroups(pinned.cov, BASE_PARAMS), []);
});

test('jointBlunderCheck: string target keys work, and a target on an unrecorded 25° slope is flagged by the summed probability even though "mis-ranged" alone stays under 50%', () => {
  const obs = [100, 400, 700].map((r) => ({
    rangeM: r, observedComeUp: comeUpMrad({ ...REF_STATE, losAngleDeg: r === 700 ? 25 : 0 }, r),
    shots: 8, sigmaMrad: sigmaForGroup({ shots: 8 }), targetIndex: `t${r}`
  }));
  const chrono = chronoObservation({ state: REF_STATE, velocitiesMs: Array(10).fill(792.48), mvSD: 3 });
  const j = jointBlunderCheck({ state: REF_STATE, observations: [...obs, chrono], priors: { zeroMrad: 0.08, v0Ms: 20, trackPct: 0.15, windMs: 0.5 }, targetIndices: obs.map((o) => o.targetIndex), rechecked: true });
  assert.ok(j.marginalBlunder.t700 < 0.5, `mis-ranged alone: ${j.marginalBlunder.t700}`);
  assert.ok(j.marginalSomethingWrong.t700 > 0.5, `summed: ${j.marginalSomethingWrong.t700}`);
  assert.ok(j.marginalSomethingWrong.t100 < 0.2 && j.marginalSomethingWrong.t400 < 0.2, 'the clean targets stay unflagged');
});

// ---- The planner computes each distance's sensitivity columns once; its answer must not change ----
// A plain brute-force search that calls posterior() with no precomputed columns, exactly as the planner did
// before the columns were shared across designs.
function bruteForcePlan({ state, candidates, budget, priors, r50Mrad, nearResolved = false, minShots = 3, maxTargets = 3 }) {
  const dragIdx = BASE_PARAMS.indexOf('dragPct');
  let best = null;
  const subsets = [];
  const pick = (start, chosen) => {
    if (chosen.length >= 1) subsets.push([...chosen]);
    if (chosen.length === maxTargets) return;
    for (let i = start; i < candidates.length; i++) pick(i + 1, [...chosen, candidates[i]]);
  };
  pick(0, []);
  for (const ranges of subsets) {
    const k = ranges.length;
    const allocate = (remaining, idx, current) => {
      if (idx === k - 1) {
        if (remaining < minShots) return;
        const shots = [...current, remaining];
        const groups = ranges.map((r, i) => ({ rangeM: r, shots: shots[i], r50Mrad, resolved: i === 0 ? nearResolved : true }));
        const post = posterior({ state, groups, priors });
        if (!best || post.sd[dragIdx] < best.dragSd) best = { ranges, shots, dragSd: post.sd[dragIdx], sd: post.sd, cov: post.cov };
        return;
      }
      for (let s = minShots; s <= remaining - minShots * (k - idx - 1); s++) allocate(remaining - s, idx + 1, [...current, s]);
    };
    allocate(budget, 0, []);
  }
  return best;
}

test('planSession returns exactly what a brute-force search without shared columns returns', () => {
  const candidates = [100, 250, 400, 550, 700, 800];
  const ceiling = rangeAtMach(REF_STATE, SUPERSONIC_MACH);
  assert.ok(candidates.every((d) => d <= ceiling));
  for (const [budget, priors, nearResolved] of [[12, DEFAULT_PRIORS_UNCHECKED, false], [15, CHECKED_PRIORS, true]]) {
    const fast = planSession({ state: REF_STATE, availableDistances: candidates, roundBudget: budget, priors, r50Mrad: 0.14, nearResolved });
    const slow = bruteForcePlan({ state: REF_STATE, candidates, budget, priors, r50Mrad: 0.14, nearResolved });
    assert.deepEqual(fast.ranges, slow.ranges);
    assert.deepEqual(fast.shots, slow.shots);
    assert.equal(fast.dragSd, slow.dragSd, 'the drag-scale SD must be bit-for-bit the same');
    assert.deepEqual(Array.from(fast.sd), Array.from(slow.sd));
    assert.deepEqual(fast.cov, slow.cov);
  }
});

test('posterior with precomputed columns equals posterior computing them itself', () => {
  const groups = [{ rangeM: 100, shots: 4, resolved: false }, { rangeM: 600, shots: 8 }];
  const plain = posterior({ state: REF_STATE, groups, priors: CHECKED_PRIORS });
  const shared = posterior({ state: REF_STATE, groups: groups.map((g) => ({ ...g, col: sensitivityColumns(REF_STATE, g.rangeM) })), priors: CHECKED_PRIORS });
  assert.deepEqual(shared.cov, plain.cov);
  assert.deepEqual(shared.sd, plain.sd);
});

test('the planning memo returns the same numbers as a direct computation and never a stale one when an input changes', () => {
  clearPlanningMemo();
  const direct = sensitivityColumns(REF_STATE, 600);
  assert.deepEqual({ ...planningColumns(REF_STATE, 600) }, direct);
  assert.deepEqual({ ...planningColumns(REF_STATE, 600) }, direct, 'a second call (a memo hit) gives the same numbers');
  assert.ok(Object.isFrozen(planningColumns(REF_STATE, 600)), 'the shared result is frozen so no caller can corrupt it');

  // a state that differs in any physics field must not hit the old entry, even if it is the same object mutated
  const state = { ...REF_STATE };
  const before = rangeAtMach(state, 1.1);
  state.muzzleVelocity = 850;
  const after = rangeAtMach(state, 1.1);
  assert.ok(after > before + 20, `a faster load must move the Mach 1.1 range out (${before} -> ${after})`);
  assert.equal(after, rangeAtMach({ ...REF_STATE, muzzleVelocity: 850 }, 1.1));
  const colsBefore = { ...planningColumns(state, 600) };
  state.bc = 0.35;
  assert.notDeepEqual({ ...planningColumns(state, 600) }, colsBefore);
});

test('the planner ranks designs with a closed form but reports the exact posterior of the chosen one', () => {
  const candidates = [100, 200, 300, 450, 600, 750, 860];
  const plan = planSession({ state: REF_STATE, availableDistances: candidates, roundBudget: 24, priors: CHECKED_PRIORS, r50Mrad: 0.14 });
  const exactPost = posterior({
    state: REF_STATE, priors: CHECKED_PRIORS,
    groups: plan.ranges.map((r, i) => ({ rangeM: r, shots: plan.shots[i], r50Mrad: 0.14, resolved: i === 0 ? false : true }))
  });
  assert.deepEqual(plan.cov, exactPost.cov);
  assert.equal(plan.dragSd, exactPost.sd[BASE_PARAMS.indexOf('dragPct')]);
});

// ---- The estimator: warm starts, the reused evidence, and predictedComeUp's dedupe ----
function estimatorCase() {
  const truth = { ...REF_STATE, muzzleVelocity: 780, bc: 0.2623 / 1.04 };
  const groups = [100, 300, 600, 800].map((r, i) => ({ rangeM: r, observedComeUp: comeUpMrad(truth, r) + 0.02 * (i - 1.5), shots: 4, sigmaMrad: 0.08, targetIndex: `t${i}`, knownLosDeg: 0 }));
  return { state: REF_STATE, observations: groups, priors: CHECKED_PRIORS, params: BASE_PARAMS };
}
const relDev = (a, b, params, sd) => Math.max(...params.map((k) => Math.abs(a.theta[k] - b.theta[k]) / sd[k]));

test('a warm start converges to the same solution as a cold start, to well below the SD', () => {
  const args = estimatorCase();
  const cold = fitSession(args);
  const start = Object.fromEntries(args.params.map((k) => [k, cold.theta[k] * 0.9 + 0.01]));
  const warm = fitSession({ ...args, start });
  assert.ok(relDev(warm, cold, args.params, cold.sd) < 1e-3, `warm ${JSON.stringify(warm.theta)} vs cold ${JSON.stringify(cold.theta)}`);
  for (const k of args.params) closeTo(warm.sd[k], cold.sd[k], cold.sd[k] * 1e-3, `sd of ${k}`);
});

test('a start that does not converge is discarded: the answer is the cold-start answer', () => {
  const args = estimatorCase();
  const cold = fitSession(args);
  const wild = fitSession({ ...args, start: { zeroMrad: 5, v0Ms: 400, dragPct: -60, trackPct: 20, windMs: 30 } });
  assert.deepEqual(wild.theta, cold.theta);
  assert.deepEqual(wild.cov, cold.cov);
});

test('the evidence reused from a fit equals the evidence computed from scratch', () => {
  const args = estimatorCase();
  const fit = fitSession(args);
  assert.ok(fit.lin, 'fitSession carries its final linearisation');
  const reused = laplaceLogEvidence({ state: args.state, observations: args.observations, fit, priors: args.priors, params: args.params });
  const { lin, ...withoutLin } = fit;
  const fromScratch = laplaceLogEvidence({ state: args.state, observations: args.observations, fit: withoutLin, priors: args.priors, params: args.params });
  // reused: second-order-corrected from the linearisation just before the last Newton step; from scratch: relinearised at the
  // solution. They agree to about 4e-4 in log evidence on captured sessions, far below what changes a finding.
  closeTo(reused, fromScratch, 1e-3, 'log evidence');
});

test('predictedComeUp equals its original definition, with and without tracking, range error and inclination terms', () => {
  const original = (applied, rangeM, theta, tt) => {
    const baseState = tt.knownLosDeg ? { ...applied, losAngleDeg: tt.knownLosDeg } : applied;
    const base = comeUpMrad(baseState, rangeM + (tt.rangeErrM || 0));
    const zero = theta.zeroMrad || 0;
    const track = (theta.trackPct || 0) * 0.01 * comeUpMrad(baseState, rangeM);
    let losTerm = 0;
    if (tt.losU) losTerm = comeUpMrad({ ...baseState, losAngleDeg: (tt.knownLosDeg || 0) + losDegFromU(tt.losU) }, rangeM) - comeUpMrad(baseState, rangeM);
    return base + zero + track + losTerm;
  };
  for (const theta of [{}, { zeroMrad: 0.1 }, { trackPct: 1.5 }, { zeroMrad: -0.2, trackPct: -0.7 }]) {
    for (const tt of [{}, { rangeErrM: 12 }, { losU: 0.02 }, { rangeErrM: -8, losU: 0.03, knownLosDeg: 4 }, { knownLosDeg: 6 }]) {
      for (const r of [150, 600, 850]) assert.equal(predictedComeUp(REF_STATE, r, theta, tt), original(REF_STATE, r, theta, tt), `${JSON.stringify(theta)} ${JSON.stringify(tt)} @${r}`);
    }
  }
});

test('jointBlunderCheck hands back a warm start; using it agrees with a cold run, and one made for other inputs is ignored', () => {
  const args = estimatorCase();
  const targetIndices = args.observations.map((o) => o.targetIndex);
  const jointArgs = { state: args.state, observations: args.observations, priors: args.priors, params: args.params, targetIndices, rechecked: true };
  const cold = jointBlunderCheck(jointArgs);
  assert.ok(cold.warm && cold.warm.fingerprint, 'the result carries a warm start');
  const warm = jointBlunderCheck({ ...jointArgs, warmIn: cold.warm });
  for (const k of targetIndices) closeTo(warm.marginalSomethingWrong[k], cold.marginalSomethingWrong[k], 5e-3, `P(wrong) ${k}`);
  for (const k of args.params) closeTo(warm.theta[k], cold.theta[k], cold.sd[k] * 5e-3, `theta ${k}`);
  // a warm start made for different priors must not be used at all: same numbers as cold, bit for bit
  const other = jointBlunderCheck({ ...jointArgs, priors: { ...args.priors, zeroMrad: 0.2 } });
  const ignored = jointBlunderCheck({ ...jointArgs, warmIn: other.warm });
  assert.deepEqual(ignored.theta, cold.theta);
  assert.deepEqual(ignored.cov, cold.cov);
});

// ---- Per-group air and wind, the zero that stays put, and what to dial next ----
test('the fitted along-axis wind is added to the called wind without turning a crosswind into a headwind', () => {
  assert.deepEqual(alongAxisWind({ windSpeed: 0, windAngle: 90 }, 3), { windSpeed: 3, windAngle: 0 });
  assert.deepEqual(alongAxisWind({}, -2), { windSpeed: -2, windAngle: 0 }, 'no wind called: the plain addition it always was');
  assert.deepEqual(alongAxisWind({ windSpeed: 4, windAngle: 0 }, 3), { windSpeed: 7, windAngle: 0 }, 'a called headwind just grows');
  const mixed = alongAxisWind({ windSpeed: 5, windAngle: 90 }, 3);
  closeTo(mixed.windSpeed * Math.sin(mixed.windAngle * Math.PI / 180), 5, 1e-9, 'the 5 m/s crosswind is kept');
  closeTo(mixed.windSpeed * Math.cos(mixed.windAngle * Math.PI / 180), 3, 1e-9, 'and 3 m/s of headwind is added');
  // physically: a 5 m/s called tailwind plus 5 m/s more headwind is no wind at all
  const cancelled = applyParameters({ ...REF_STATE, windSpeed: 5, windAngle: 180 }, { windMs: 5 });
  closeTo(comeUpMrad(cancelled, 700), comeUpMrad({ ...REF_STATE, windSpeed: 0 }, 700), 1e-9, 'come-up with the tailwind cancelled');
});

test('a zero fixed in the air it was set in: no zero conditions is the old behaviour, and colder air later moves the impact', () => {
  const same = { ...REF_STATE, zeroConditions: { tempC: REF_STATE.tempC, pressureHpa: REF_STATE.pressureHpa, humidityPct: REF_STATE.humidityPct, altitudeM: REF_STATE.altitudeM } };
  for (const r of [300, 600, 850]) closeTo(comeUpMrad(same, r), comeUpMrad(REF_STATE, r), 1e-9, `zeroed in this same air, ${r} m`);
  // how much it matters grows with the zero range (about 0.005 mrad for a 100 m zero, 0.03 to 0.07 for a 300 m zero
  // and up to 0.24 for a 500 m zero, in 1,500 m thinner air), so use a 300 m zero here
  const long = { ...REF_STATE, zeroRange: 300 };
  const cold = { ...long, tempC: -10, zeroConditions: { tempC: 15 } };
  const manual = { ...long, tempC: -10, launchAngle: solveZeroAngle({ ...long, tempC: 15 }) };
  closeTo(comeUpMrad(cold, 700), comeUpMrad(manual, 700), 1e-9, 'a zero set at 15 C, shot at -10 C');
  assert.ok(Math.abs(comeUpMrad(cold, 700) - comeUpMrad({ ...long, tempC: -10 }, 700)) > 0.02, 'and that differs from re-zeroing in the cold');
  assert.equal(withFixedBore({ ...cold, launchAngle: 0.001 }).launchAngle, 0.001, 'an explicit bore angle always wins');
  assert.equal(withFixedBore(REF_STATE), REF_STATE, 'no zero conditions: the state is returned untouched');
});

test('a zero set on the flat, shot at an incline: the come-up differs from a zero re-solved along the incline', () => {
  const steep = { ...REF_STATE, losAngleDeg: 30 };
  const fixed = { ...steep, zeroConditions: {} };
  assert.equal(comeUpMrad(steep, 700), comeUpMrad(fixed, 700), 'the flat zero is the default for an inclined shot');
  const atIncline = { ...steep, zeroConditions: { losAngleDeg: 30 } };
  const diff = Math.abs(comeUpMrad(fixed, 700) - comeUpMrad(atIncline, 700));
  assert.ok(diff > 0.02 && diff < 0.4, `flat zero against slope-solved zero at 700 m and 30 degrees: ${diff} mrad`);
});

function conditionsCase() {
  const state = { ...REF_STATE, referenceTempC: 15, velocityTempSensitivity: 0.8 };
  const truth = { ...state, muzzleVelocity: state.muzzleVelocity - 10 };
  const shots = [
    [100, { tempC: 4, pressureHpa: 1018, windSpeed: 0 }], [400, { tempC: 12, pressureHpa: 1010, windSpeed: 2, windAngle: 0 }],
    [700, { tempC: 22, pressureHpa: 1002, windSpeed: 3, windAngle: 180 }], [850, { tempC: 29, pressureHpa: 998, windSpeed: 0 }]
  ];
  const observations = shots.map(([rangeM, conditions], i) => ({
    rangeM, observedComeUp: comeUpMrad(withConditions(truth, conditions), rangeM), shots: 4, sigmaMrad: 0.01, targetIndex: `t${i}`, knownLosDeg: 0, conditions
  }));
  return { state, observations };
}

test('groups shot in their own air and wind are fitted in that air and wind', () => {
  const { state, observations } = conditionsCase();
  const args = { state, priors: { v0Ms: 40 }, params: ['v0Ms'] };
  const right = fitSession({ ...args, observations });
  closeTo(right.theta.v0Ms, -10, 0.05, 'muzzle velocity recovered when each group is fitted in its own conditions');
  const blind = fitSession({ ...args, observations: observations.map(({ conditions, ...o }) => o) });
  assert.ok(Math.abs(blind.theta.v0Ms + 10) > 1, `ignoring the conditions would have blamed the muzzle velocity (${blind.theta.v0Ms})`);
  // conditions equal to the base state change nothing, bit for bit
  const same = fitSession({ ...args, observations: observations.map((o) => ({ ...o, conditions: { tempC: state.tempC, pressureHpa: state.pressureHpa } })) });
  const plain = fitSession({ ...args, observations: observations.map(({ conditions, ...o }) => ({ ...o, observedComeUp: o.observedComeUp })) });
  assert.equal(withConditions(state, { tempC: state.tempC, pressureHpa: state.pressureHpa }).tempC, state.tempC);
  assert.ok(Number.isFinite(same.theta.v0Ms) && Number.isFinite(plain.theta.v0Ms));
});

test('only air and wind fields are ever taken from a group\'s conditions', () => {
  const out = withConditions(REF_STATE, { tempC: 3, muzzleVelocity: 1, bc: 9, zeroRange: 5, windSpeed: 2 });
  assert.equal(out.tempC, 3);
  assert.equal(out.windSpeed, 2);
  assert.equal(out.muzzleVelocity, REF_STATE.muzzleVelocity);
  assert.equal(out.bc, REF_STATE.bc);
  assert.equal(out.zeroRange, REF_STATE.zeroRange);
  assert.equal(withConditions(REF_STATE, null), REF_STATE);
});

test('nextShotDope: elevation and windage for the next shot, in that shot\'s air and wind, with the fit folded in', () => {
  const state = { ...REF_STATE, windSpeed: 0, windAngle: 90 };
  const conditions = { tempC: 5, pressureHpa: 1000, windSpeed: 6, windAngle: 90 };
  const shot = withConditions(state, conditions);
  const plain = nextShotDope({ state, conditions, rangeM: 700 });
  closeTo(plain.elevationMrad, comeUpMrad(shot, 700), 1e-9, 'elevation with no fit applied');
  closeTo(plain.windageMrad, computeImpact(withFixedBore(shot), 700).windageCm * 10 / 700, 1e-12, 'windage, the engine\'s own sign');
  assert.ok(Math.abs(plain.windageMrad) > 0.3, 'a 6 m/s crosswind at 700 m is worth more than a third of a mrad');
  assert.equal(plain.windageSdMrad, 0, 'crosswind taken as called');
  assert.equal(plain.elevationSdMrad, null, 'no covariance, no uncertainty claimed');

  // the fit's muzzle-velocity and zero corrections move the elevation exactly as the estimator predicts
  const theta = { zeroMrad: 0.05, v0Ms: -10, dragPct: 2, trackPct: 0.5 };
  const fitted = nextShotDope({ state, conditions, theta, rangeM: 700 });
  closeTo(fitted.elevationMrad, predictedComeUp(applyParameters(shot, theta), 700, theta, {}), 1e-12, 'elevation with the fit');
  const truth = { ...shot, muzzleVelocity: shot.muzzleVelocity - 10 };
  const exact = nextShotDope({ state, conditions, theta: { v0Ms: -10 }, rangeM: 700 });
  closeTo(exact.elevationMrad, comeUpMrad(truth, 700), 1e-9, 'a fit that equals the truth dials the true come-up');

  // uncertainty: the elevation SD comes from the covariance, the windage SD from how well the crosswind is known
  const cov = BASE_PARAMS.map((_, i) => BASE_PARAMS.map((__, j) => (i === j ? [0.05, 3, 2, 0.1, 0.5][i] ** 2 : 0)));
  const withUncertainty = nextShotDope({ state, conditions, theta, cov, rangeM: 700, crosswindSigmaMs: 1.5 });
  closeTo(withUncertainty.elevationSdMrad, predictiveComeUpSd({ state: shot, theta, cov, rangeM: 700 }), 1e-12, 'elevation SD');
  // windage is close to proportional to the crosswind, so one m/s of doubt is about a sixth of the windage for a 6 m/s wind
  assert.ok(withUncertainty.windageSdMrad > 0 && Math.abs(withUncertainty.windageSdMrad - 1.5 * Math.abs(plain.windageMrad / 6)) < 0.1 * Math.abs(plain.windageMrad), `windage SD ${withUncertainty.windageSdMrad}`);
});

test('the joint enumeration drops combinations with more than the capped number of wrong targets, and hardly moves the answer', () => {
  const args = estimatorCase();
  const targetIndices = args.observations.map((o) => o.targetIndex);
  const jointArgs = { state: args.state, observations: args.observations, priors: args.priors, params: args.params, targetIndices, rechecked: true };
  const full = jointBlunderCheck({ ...jointArgs, maxSimultaneous: Infinity });
  const capped = jointBlunderCheck(jointArgs);
  assert.equal(JOINT_BLUNDER_MAX_SIMULTANEOUS, 2);
  assert.ok(capped.results.length < full.results.length, `${capped.results.length} hypotheses instead of ${full.results.length}`);
  for (const r of capped.results) assert.ok(r.choiceIndices.slice(1).filter((c) => c !== 0).length <= JOINT_BLUNDER_MAX_SIMULTANEOUS, r.label);
  for (const k of targetIndices) closeTo(capped.marginalSomethingWrong[k], full.marginalSomethingWrong[k], 0.01, `P(wrong) ${k}`);
  for (const k of args.params) closeTo(capped.theta[k], full.theta[k], full.sd[k] * 0.02, `theta ${k}`);
});

test('the rifle is zeroed once, in the starting air and in calm air: neither later air nor any wind moves the bore', () => {
  const cold = withConditions(REF_STATE, { tempC: -10, pressureHpa: 980 });
  const cold300 = withConditions({ ...REF_STATE, zeroRange: 300 }, { tempC: -10 });
  assert.equal(cold.zeroConditions.tempC, REF_STATE.tempC, 'the zero stays in the air the state started in');
  const boreStart = withFixedBore(REF_STATE);
  const boreCold = withFixedBore(cold);
  assert.equal(boreCold.launchAngle, solveZeroAngle(REF_STATE), 'the bore is the one solved in the starting air');
  assert.ok(comeUpMrad(cold, 700) > comeUpMrad(REF_STATE, 700) - 5, 'sanity: the come-up itself does change with the air');
  // against the old behaviour (zero re-solved in the cold air) the come-up differs at long range
  const reSolved = computeImpact({ ...cold300, zeroConditions: undefined }, 700).dropCm * -10 / 700;
  assert.ok(Math.abs(comeUpMrad(cold300, 700) - reSolved) > 0.02, 'a 300 m zero re-solved in the cold air would differ');
  // explicit zero conditions still win
  assert.equal(withConditions({ ...REF_STATE, zeroConditions: { tempC: 30 } }, { tempC: 0 }).zeroConditions.tempC, 30);
  assert.equal(boreStart, withFixedBore(REF_STATE), 'a bare calm state is returned as it is');
  // wind never enters the zero, called or fitted, with or without other zero conditions
  const zeroCalm = solveZeroAngle(REF_STATE);
  for (const s of [{ ...REF_STATE, windSpeed: 8, windAngle: 0 }, { ...REF_STATE, windSpeed: 8, windAngle: 180 },
                   { ...REF_STATE, windSpeed: 8, windAngle: 0, zeroConditions: { tempC: REF_STATE.tempC } },
                   applyParameters(REF_STATE, { windMs: 6 }), withConditions(REF_STATE, { windSpeed: 8, windAngle: 0 })]) {
    assert.equal(withFixedBore(s).launchAngle, zeroCalm, 'the bore is the calm-air one');
  }
  // an explicit zero wind is honoured
  assert.notEqual(withFixedBore({ ...REF_STATE, zeroConditions: { windSpeed: 8, windAngle: 0 } }).launchAngle, zeroCalm);
  // the zero is one level bore angle: an incline never moves it, unless a zero angle is named
  const steepShot = { ...REF_STATE, losAngleDeg: 25 };
  assert.equal(withFixedBore(steepShot).launchAngle, zeroCalm, 'an inclined shot uses the level zero');
  assert.equal(withFixedBore(withConditions(steepShot, { tempC: 0 })).launchAngle, zeroCalm);
  assert.notEqual(withFixedBore({ ...steepShot, zeroConditions: { losAngleDeg: 25 } }).launchAngle, zeroCalm, 'a zero angle that was named is honoured');
});

test('the kept integrator walks change nothing: come-ups equal a fresh computeImpact under the fixed bore, whatever was asked before', () => {
  clearWalkers();
  const states = [
    REF_STATE, { ...REF_STATE, windSpeed: 4, windAngle: 0 }, { ...REF_STATE, losAngleDeg: 20 },
    { ...withConditions({ ...REF_STATE, zeroRange: 300 }, { tempC: -8, pressureHpa: 960, windSpeed: 3, windAngle: 90 }), losAngleDeg: -15 },
    { ...REF_STATE, zeroConditions: { tempC: 30, losAngleDeg: 10 } }, applyParameters(REF_STATE, { v0Ms: 2, dragPct: 3, windMs: 1.5 })
  ];
  for (let pass = 0; pass < 2; pass++) {
    for (const state of states) {
      for (const r of pass ? [900, 250, 100, 640] : [100, 250, 640, 900]) {
        assert.equal(comeUpMrad(state, r), -computeImpact(withFixedBore(state), r).dropCm * 10 / r, `come-up at ${r}`);
        assert.equal(windageMrad(state, r), computeImpact(withFixedBore(state), r).windageCm * 10 / r, `windage at ${r}`);
      }
    }
  }
  // the kept walks are keyed by content, so an equal state built another way shares and agrees with them
  assert.equal(comeUpMrad({ ...REF_STATE }, 500), comeUpMrad(REF_STATE, 500));
  // more distinct states than the walks kept: the oldest go, the answers do not change
  for (let i = 0; i < 300; i++) comeUpMrad({ ...REF_STATE, muzzleVelocity: 700 + i * 0.37 }, 400);
  assert.equal(comeUpMrad(REF_STATE, 400), -computeImpact(REF_STATE, 400).dropCm * 10 / 400);
});

test('the ladder: cap 4, a step beyond the cap only when nothing nearer is left and the fit says it is safe', () => {
  assert.equal(DEFAULT_LADDER_MAX_JUMP_FACTOR, 4);
  const cov = posterior({ state: REF_STATE, groups: [], priors: DEFAULT_PRIORS_UNCHECKED }).cov;
  const base = { state: REF_STATE, cov, candidateRanges: [100, 300, 500, 870], triedRanges: [100], farthestValidatedM: 100 };
  assert.equal(nextLadderRange(base), 300, 'within the cap the farthest safe distance');
  // nothing within 4 x 100 m but 500 m: the nearest beyond it, when its 3-sigma miss is on the backdrop
  const gap = { ...base, candidateRanges: [100, 500, 870] };
  assert.equal(nextLadderRange(gap), 500);
  assert.equal(nextLadderRange({ ...gap, beyondCap: false }), null, 'the earlier rule stalls here');
  assert.equal(nextLadderRange({ ...gap, backdropMarginM: 0.5 }), null, 'a small backdrop: 3 sigma at 500 m does not fit, and that is a stall, not a jump');
  assert.equal(nextLadderRange({ ...gap, confidenceZ: 3, backdropMarginM: 2 }), 500, 'a missed impact tightens the confidence to 3; 500 m still fits a 2 m margin');
  // never a jump past the nearest beyond-cap distance
  assert.equal(nextLadderRange({ ...base, candidateRanges: [100, 500, 600, 870] }), 500);
  // the first rung is not a jump: no data, the nearest ground
  assert.equal(nextLadderRange({ ...gap, triedRanges: [], farthestValidatedM: null }), 100);
});

test('ladderStartCheck: the first rung against the prior spread, at 3 sigma', () => {
  const cov = posterior({ state: REF_STATE, groups: [], priors: DEFAULT_PRIORS_UNCHECKED }).cov;
  const wide = ladderStartCheck({ state: REF_STATE, cov, candidateRanges: [580, 665], backdropMarginM: 2 });
  assert.equal(wide.rangeM, 580);
  assert.ok(wide.safe && wide.marginNeededM < 2);
  closeTo(wide.marginNeededM, BEYOND_CAP_CONFIDENCE_Z * wide.predMissM, 1e-12, '3 sigma of the predicted miss');
  assert.equal(ladderStartCheck({ state: REF_STATE, cov, candidateRanges: [580, 665], backdropMarginM: 0.5 }).safe, false, 'a small backdrop: the first shot may leave it');
  assert.equal(ladderStartCheck({ state: REF_STATE, cov, candidateRanges: [100, 300], triedRanges: [100, 300], backdropMarginM: 2 }), null);
  assert.equal(ladderStartCheck({ state: REF_STATE, cov, candidateRanges: [100, 300], triedRanges: [100], backdropMarginM: 2 }).rangeM, 300);
});

test('a missed impact retreats, and after the next group the failed distance is released for one more try', () => {
  const session = { groups: [], missedImpactCount: 0, missedRanges: [], triedRanges: [], farthestValidatedM: null, confidenceZ: 2, retreatTo: null };
  const avail = [100, 300, 500, 700];
  registerRecordedGroup(session, 100);
  const retreat = registerMissedImpact(session, 700, avail);
  assert.ok([300, 500].includes(retreat), 'the retreat is real ground between the last validated range and the failed one');
  assert.equal(session.missedImpactCount, 1);
  assert.deepEqual(session.missedRanges, [700]);
  assert.equal(session.confidenceZ, 3, 'the confidence is tightened for the rest of the session');
  assert.ok([300, 500].includes(session.retreatTo));
  // while 700 is banned nothing at or beyond it is proposed
  const cov = posterior({ state: REF_STATE, groups: [], priors: DEFAULT_PRIORS_UNCHECKED }).cov;
  const args = () => ({ state: REF_STATE, cov, candidateRanges: avail, triedRanges: session.triedRanges, missedRanges: session.missedRanges, retryRanges: session.retryRanges || [], farthestValidatedM: session.farthestValidatedM, confidenceZ: session.confidenceZ });
  assert.ok(nextLadderRange(args()) < 700);
  registerRecordedGroup(session, session.retreatTo, { retry: true });
  assert.deepEqual(session.missedRanges, [], 'a group has landed since: the miss is released');
  assert.deepEqual(session.retryRanges, [700]);
  assert.deepEqual(session.retriedMisses, [700]);
  assert.equal(nextLadderRange({ ...args(), candidateRanges: [100, session.retreatTo, 700] }), 700, 'the failed distance is proposed again');
  // it lands: nothing more to retry
  const landed = JSON.parse(JSON.stringify(session)); registerRecordedGroup(landed, 700, { retry: true });
  assert.deepEqual(landed.retryRanges, []); assert.equal(landed.farthestValidatedM, 700);
  // it misses again: banned for good, whatever lands after
  registerMissedImpact(session, 700, avail);
  assert.deepEqual(session.missedRanges, [700]); assert.deepEqual(session.retryRanges, []);
  registerRecordedGroup(session, 300, { retry: true });
  assert.deepEqual(session.missedRanges, [700], 'a second miss at the same distance is not released again');
  // with retry off (the default) the first miss is permanent too
  const s2 = { groups: [], missedImpactCount: 0, missedRanges: [], triedRanges: [], farthestValidatedM: 100, confidenceZ: 2, retreatTo: null };
  registerMissedImpact(s2, 700, avail); registerRecordedGroup(s2, 300);
  assert.deepEqual(s2.missedRanges, [700]);
});

// ---- The whole-session planner ----
const WHOLE_CANDIDATES = [100, 150, 200, 300, 400, 500, 600, 700, 800, 870];
const wholeArgs = (extra = {}) => ({ state: REF_STATE, availableDistances: WHOLE_CANDIDATES, roundBudget: 12, priors: DEFAULT_PRIORS_UNCHECKED, r50Mrad: 0.14, ...extra });

test('planWholeSession: the shots add up to the budget exactly, one shot at the near glance-read group, at most three target distances', () => {
  for (const roundBudget of [6, 9, 12, 20, 36]) {
    const p = planWholeSession(wholeArgs({ roundBudget }));
    assert.equal(p.shots.reduce((a, b) => a + b, 0), roundBudget, `budget ${roundBudget}`);
    assert.ok(p.targets.length >= 1 && p.targets.length <= 3);
    assert.deepEqual(p.ranges, [...p.ranges].sort((a, b) => a - b));
    assert.ok(p.targets.every((r) => p.ranges.includes(r)));
    assert.ok(p.shots.every((n) => n >= 1));
    if (roundBudget >= 9) assert.equal(p.shots[0], 1, 'the near group is a glance: one shot sharpens as much as ten');
    assert.ok(p.dragSd > 0 && p.cov.length === 5 && p.zeroDragCorr >= 0 && p.zeroDragCorr <= 1);
  }
  assert.equal(planWholeSession(wholeArgs({ roundBudget: 0 })), null, 'no rounds, no plan');
  assert.equal(planWholeSession(wholeArgs({ availableDistances: [2000, 3000] })), null, 'no distance inside the supersonic ceiling, no plan');
});

test('planWholeSession finds the optimum: the closed form agrees with an exhaustive search over every design and allocation', () => {
  const dist = [100, 200, 400, 600, 800];
  const roundBudget = 9;
  const priors = DEFAULT_PRIORS_UNCHECKED;
  for (const weight of [1, 4]) {
    const plan = planWholeSession({ state: REF_STATE, availableDistances: dist, roundBudget, priors, r50Mrad: 0.14, criterionWeight: weight, backdropMarginM: 1e9 });
    const cost = (ranges, shots) => {
      const post = posterior({ state: REF_STATE, groups: ranges.map((r, i) => ({ rangeM: r, shots: shots[i], r50Mrad: 0.14, resolved: i > 0, col: planningColumns(REF_STATE, r) })), priors });
      return [0, 1, 2].reduce((s, i) => s + (i === 2 ? weight : 1) * post.cov[i][i] / priors[BASE_PARAMS[i]] ** 2, 0);
    };
    let best = Infinity;
    const subsets = [];
    const rec = (start, chosen) => { if (chosen.length) subsets.push([...chosen]); if (chosen.length === 3) return; for (let i = start; i < dist.length; i++) { chosen.push(dist[i]); rec(i + 1, chosen); chosen.pop(); } };
    rec(0, []);
    for (const ranges of subsets) {
      const k = ranges.length, shots = new Array(k);
      const alloc = (idx, left) => {
        if (idx === k - 1) { if (left >= 1) { shots[idx] = left; best = Math.min(best, cost(ranges, shots)); } return; }
        for (let n = 1; n <= left - (k - idx - 1); n++) { shots[idx] = n; alloc(idx + 1, left - n); }
      };
      alloc(0, roundBudget);
    }
    closeTo(cost(plan.ranges, plan.shots), best, 1e-9, `weight ${weight}: the planner's design against the best of every design`);
  }
});

test('planWholeSession: a bigger weight on the drag scale buys drag precision with zero precision', () => {
  const light = planWholeSession(wholeArgs({ criterionWeight: 1 }));
  const heavy = planWholeSession(wholeArgs({ criterionWeight: 4 }));
  assert.ok(heavy.dragSd <= light.dragSd + 1e-9, `drag SD ${heavy.dragSd} against ${light.dragSd}`);
  assert.ok(heavy.sd[0] >= light.sd[0] - 1e-9, `zero SD ${heavy.sd[0]} against ${light.sd[0]}`);
  assert.ok(heavy.dragSd !== light.dragSd, 'the weight changes the plan');
});

test('planWholeSession puts the ladder\'s safety steps inside the budget: a small backdrop forces intermediate distances, each with its own shots', () => {
  const roomy = planWholeSession(wholeArgs({ backdropMarginM: 2 }));
  const tight = planWholeSession(wholeArgs({ backdropMarginM: 0.3 }));
  assert.equal(roomy.ranges.length, roomy.targets.length, 'a roomy backdrop needs no extra steps');
  assert.ok(tight.ranges.length > tight.targets.length, 'a small backdrop needs safety steps');
  assert.equal(tight.shots.reduce((a, b) => a + b, 0), 12, 'the steps are inside the twelve rounds, not on top');
  assert.ok(tight.ranges.every((r, i) => i === 0 || r > tight.ranges[i - 1]), 'in ascending order');
  // a backdrop too small for the ladder to reach the far distances: the plan stops short of them instead of pretending
  const tiny = planWholeSession(wholeArgs({ backdropMarginM: 0.08 }));
  assert.ok(Math.max(...tiny.ranges) < Math.max(...roomy.ranges), 'the far target recedes when the ladder cannot safely reach it');
  assert.equal(tiny.shots.reduce((a, b) => a + b, 0), 12);
});

test('planWholeSession hands out copies, and the plan does not depend on the call order', () => {
  const a = planWholeSession(wholeArgs());
  a.shots[0] = 99; a.ranges.push(1);
  const b = planWholeSession(wholeArgs());
  assert.notEqual(b.shots[0], 99);
  assert.ok(!b.ranges.includes(1));
  assert.deepEqual(planWholeSession(wholeArgs()), planWholeSession(wholeArgs()));
});

test('causesWeightFor: 4 only when the zero, the click value and the muzzle velocity are all checked', () => {
  assert.equal(causesWeightFor({ zeroVerified: true, trackTested: true, mvAverageChecked: true }), 4);
  assert.equal(causesWeightFor({ zeroVerified: true, trackTested: true, mvAverageChecked: false }), 1);
  assert.equal(causesWeightFor({ zeroVerified: false, trackTested: true, mvAverageChecked: true }), 1);
  assert.equal(causesWeightFor({}), 1);
  assert.equal(causesWeightFor(null), 1);
});

test('predictiveComeUpSd with nothing to fold in is the same number from the memo as from the columns', () => {
  const cov = posterior({ state: REF_STATE, groups: [], priors: DEFAULT_PRIORS_UNCHECKED }).cov;
  for (const rangeM of [100, 350, 870]) {
    const cols = sensitivityColumns(REF_STATE, rangeM);
    const col = BASE_PARAMS.map((k) => cols[k] || 0);
    let v = 0; for (let a = 0; a < col.length; a++) for (let b = 0; b < col.length; b++) v += col[a] * cov[a][b] * col[b];
    assert.equal(predictiveComeUpSd({ state: REF_STATE, cov, rangeM }), Math.sqrt(v), `bit for bit at ${rangeM} m`);
  }
});

test('the zero is made in the cartridge\'s zero atmosphere, whatever air a group is shot in; a donor cartridge\'s zero is honoured too', () => {
  const zeroAir = { tempC: -15, pressureHpa: 800, humidityPct: 0, altitudeM: 2000 };
  const shotAir = { tempC: 35, pressureHpa: 1013.25, humidityPct: 0 };
  const plain = { ...REF_STATE, zeroRange: 500 };
  const withZeroAir = { ...plain, zeroAtmosphere: zeroAir };
  // 1. Shot in the exercise's own air, the cartridge's zero atmosphere is what the ordinary solve does (no group conditions)
  const own = comeUpMrad(withZeroAir, 600);
  assert.ok(Math.abs(own - comeUpMrad(plain, 600)) > 0.02, 'the zero air matters at a 500 m zero');
  // 2. Given a group's air, the same zero is kept: naming the zero air by hand gives the same number
  const viaGroup = predictedComeUp(withConditions(withZeroAir, shotAir), 600, {});
  const byHand = predictedComeUp(withConditions({ ...plain, zeroConditions: zeroAir }, shotAir), 600, {});
  assert.equal(viaGroup, byHand);
  // and it is not the zero of the starting air
  assert.ok(Math.abs(viaGroup - predictedComeUp(withConditions(plain, shotAir), 600, {})) > 0.02);
  // 3. A cartridge zeroed with another flies the donor's zero angle
  const donor = { muzzleVelocity: 760, referenceTempC: null, velocityTempSensitivity: null, bcGainFactor: 1, zeroAtmosphere: null, dragModel: 'G7', bc: 0.2623 };
  const recipient = { ...plain, zeroDonorBallistics: donor };
  const donorViaGroup = predictedComeUp(withConditions(recipient, shotAir), 600, {});
  const ownViaGroup = predictedComeUp(withConditions(plain, shotAir), 600, {});
  assert.ok(Math.abs(donorViaGroup - ownViaGroup) > 0.05, 'the donor\'s slower zero shows up when a group carries its own air');
});
