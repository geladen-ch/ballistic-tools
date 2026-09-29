import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  sessionPriors, planningPriors, sessionParams, mvSdSampleSizeFrom, effectiveMvSd, buildObservations,
  sessionTargets, groupTargetKey, analyseSession, bcCorrectionOffer, MIN_CHRONO_READINGS_FOR_BC,
  farTargetCheckPrompt, ZERO_FINDING_MIN_P, DIAL_TABLE_MIN_MRAD, DIAL_TABLE_MIN_SD_MULTIPLE, nextShotFromAnalysis,
  roundBudgetAdvice, wholePlan, stationPressureCheck, pickGroupConditions, conditionsChangedALot, ladderStallReason, recommendedMvShots, homeworkTicked, BUDGET_ADVICE_GRID, BUDGET_ADVICE_STEPS, livePriors, MIN_CHRONO_READINGS_TRUSTED
} = await import('../src/ui/truing-session/session-model.js');
const { v0MsCheckedSigma, comeUpMrad, sigmaForGroup, predictedComeUp, withConditions, BASE_PARAMS } = await import('../src/engine/truing-session.js');
const { resolveMuzzleVelocity } = await import('../src/engine/trajectory.js');
const { RIG_PRESET_KEY, CUSTOM_PRESET_KEY } = await import('../src/ui/precision-preset-field.js');

const REF_STATE = {
  dragModel: 'G7', bc: 0.2623, muzzleVelocity: 792.48, zeroRange: 100, sightHeight: 50,
  tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 50, windSpeed: 0, windAngle: 90, losAngleDeg: 0
};

test('the fit priors never switch v0Ms on the chronograph checkbox; a verified MV average uses the checked-sigma formula', () => {
  assert.equal(sessionPriors({ chronographAvailable: true, mvSD: 3 }).v0Ms, 20);
  const checked = sessionPriors({ mvAverageChecked: true, mvAverageShots: 10, mvSD: 3, muzzleVelocitySDPreset: RIG_PRESET_KEY });
  assert.equal(checked.v0Ms, v0MsCheckedSigma({ mvSD: 3, nToday: 10, mvSdSampleSize: 10 }));
});

test('planning priors fold the planned chronographed shots into v0Ms; without a chronograph they equal the fit priors', () => {
  const hw = { chronographAvailable: true, mvSD: 3 };
  assert.ok(planningPriors(hw, { nShots: 12 }).v0Ms < 1);
  assert.equal(planningPriors({ mvSD: 3 }, { nShots: 12 }).v0Ms, 20);
});

test('once the session has enough chronograph readings of its own, they replace the checked MV average as the muzzle-velocity prior', () => {
  const hw = { mvAverageChecked: true, mvAverageShots: 10, mvSD: 3, muzzleVelocitySDPreset: RIG_PRESET_KEY };
  const checked = sessionPriors(hw).v0Ms;
  assert.ok(checked < 2);
  // no readings: the checked average stands; from the threshold (one reading) the loose prior lets the readings' own row decide
  assert.equal(sessionPriors(hw, { chronoReadings: MIN_CHRONO_READINGS_TRUSTED - 1 }).v0Ms, checked);
  assert.equal(sessionPriors(hw, { chronoReadings: MIN_CHRONO_READINGS_TRUSTED }).v0Ms, 20);
  assert.equal(sessionPriors(hw, { chronoReadings: 4, minReadings: 5 }).v0Ms, checked);
  assert.equal(sessionPriors(hw, { chronoReadings: 5, minReadings: 5 }).v0Ms, 20);
  assert.equal(livePriors(hw, { chronoVelocities: [] }).v0Ms, checked);
  assert.equal(livePriors(hw, { chronoVelocities: [800, null] }).v0Ms, 20);
  // an unchecked average is untouched, and the planning priors follow the same rule: the chrono row alone, not the row and the average
  assert.equal(sessionPriors({ mvSD: 3 }, { chronoReadings: 10 }).v0Ms, 20);
  const row = v0MsCheckedSigma({ mvSD: 3, nToday: 12, mvSdSampleSize: 10 });
  const planned = planningPriors({ ...hw, chronographAvailable: true }, { nShots: 12 }).v0Ms;
  assert.ok(Math.abs(planned - row * 20 / Math.hypot(20, row)) < 1e-9);
});

test('a completed tall-target test drops trackPct from the parameter set', () => {
  assert.deepEqual(sessionParams({ trackTested: true }), BASE_PARAMS.filter((k) => k !== 'trackPct'));
  assert.deepEqual(sessionParams({}), BASE_PARAMS);
});

test('the SD sample size follows its provenance', () => {
  assert.equal(mvSdSampleSizeFrom({ muzzleVelocitySDPreset: RIG_PRESET_KEY }), 10);
  assert.equal(mvSdSampleSizeFrom({ muzzleVelocitySDPreset: CUSTOM_PRESET_KEY, mvSdShots: 25 }), 25);
  assert.equal(mvSdSampleSizeFrom({ muzzleVelocitySDPreset: CUSTOM_PRESET_KEY }), 10);
  assert.equal(mvSdSampleSizeFrom({ muzzleVelocitySDPreset: 'factoryMatch' }), null);
});

test('today\'s SD overrides the recorded one only past 10 readings and only when the F-test says so (acceptance 16)', () => {
  const homework = { mvSD: 3, muzzleVelocitySDPreset: RIG_PRESET_KEY };
  const wide = Array.from({ length: 20 }, (_, i) => 790 + (i % 2 ? 9 : -9));
  assert.equal(effectiveMvSd({ homework, velocities: wide.slice(0, 10) }).override, null, '10 readings: never tested');
  const over = effectiveMvSd({ homework, velocities: wide });
  assert.ok(over.override && over.mvSD > 8 && over.mvSdSampleSize === 20);
  const similar = Array.from({ length: 20 }, (_, i) => 790 + (i % 2 ? 3 : -3));
  assert.equal(effectiveMvSd({ homework, velocities: similar }).override, null);
});

const LOCATION = {
  targets: [
    { id: 'near', name: 'Near', rangeM: 100, losAngleDeg: 0 },
    { id: 'slope', name: 'Slope', rangeM: 600, losAngleDeg: 12 },
    { id: 'far', name: 'Far', rangeM: 860, losAngleDeg: 0 }
  ]
};

test('targets are keyed stably; session overrides and natural targets are folded in', () => {
  const targets = sessionTargets({ location: LOCATION, targetOverrides: { far: { rangeM: 850 } }, naturalTargets: [{ rangeM: 400 }] });
  assert.deepEqual(targets.map((tg) => [tg.key, tg.rangeM]), [['near', 100], ['slope', 600], ['far', 850], ['natural:400', 400]]);
  assert.equal(groupTargetKey({ rangeM: 400 }, targets), 'natural:400');
  assert.equal(groupTargetKey({ rangeM: 600, targetKey: 'slope' }, targets), 'slope');
});

test('observations carry the recorded angle, the flat declaration, measured angles, the chrono row and re-check rows', () => {
  const targets = sessionTargets({ location: LOCATION });
  const session = {
    groups: [
      { rangeM: 100, targetKey: 'near', observedComeUp: 0, shots: 4, sigmaMrad: 0.15 },
      { rangeM: 600, targetKey: 'slope', observedComeUp: 5.1, shots: 4, sigmaMrad: 0.08 },
      { rangeM: 860, targetKey: 'far', observedComeUp: 9.9, shots: 8, sigmaMrad: 0.06 }
    ],
    chronoVelocities: [792, null, 793],
    angleChecks: { far: 0 },
    rangeChecks: [{ targetKey: 'far', believedRangeM: 860, newReadingM: 851 }]
  };
  const obs = buildObservations({ state: REF_STATE, session, targets, rangeDeclaredFlat: false, mvSD: 3, mvSdSampleSize: null });
  const byKey = (k) => obs.find((o) => o.targetIndex === k && o.rangeM != null);
  assert.equal(byKey('slope').knownLosDeg, 12, 'a nonzero recorded angle is a measurement');
  assert.ok(!byKey('near').losMeasured, 'a stored 0 is not a measurement');
  assert.equal(byKey('far').losMeasured, true, 'a measured 0 is');
  const chrono = obs.find((o) => o.kind === 'chrono');
  assert.equal(chrono.n, 2, 'a missed reading is one fewer, nothing more');
  assert.equal(obs.find((o) => o.kind === 'rangeCheck').residualM, -9);

  const flat = buildObservations({ state: REF_STATE, session: { ...session, angleChecks: {} }, targets, rangeDeclaredFlat: true, mvSD: 3 });
  assert.ok(flat.filter((o) => o.rangeM != null).every((o) => o.losMeasured && o.knownLosDeg === 0), 'flat withdraws the term everywhere');
});

function referenceSession(dragPct, velocities) {
  const truth = { ...REF_STATE, bcGainFactor: 1 / (1 + dragPct / 100) };
  const groups = [
    { rangeM: 100, targetKey: 'near', observedComeUp: comeUpMrad(truth, 100), shots: 4, sigmaMrad: 0.15 },
    { rangeM: 860, targetKey: 'far', observedComeUp: comeUpMrad(truth, 860), shots: 8, sigmaMrad: sigmaForGroup({ shots: 8, r50Mrad: 0.14 }) }
  ];
  return { groups, chronoVelocities: velocities };
}

function analyse(session) {
  const targets = sessionTargets({ location: { targets: [LOCATION.targets[0], LOCATION.targets[2]] } });
  const homework = { zeroVerified: true, trackTested: true, windConfidenceMs: 0.5, mvSD: 3, chronographAvailable: true };
  const observations = buildObservations({ state: REF_STATE, session, targets, rangeDeclaredFlat: true, mvSD: 3 });
  return analyseSession({
    state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), rechecked: true,
    rMax: 860, chronoN: session.chronoVelocities.filter((v) => v != null).length, targets
  });
}

test('a resolved, chronographed drag error is offered as case 3; the same shots with too few readings never are', () => {
  const readings = Array(10).fill(792.48);
  const full = analyse(referenceSession(5, readings));
  const case3 = full.findings.find((f) => f.case === 3);
  assert.ok(case3, `expected case 3, got ${full.findings.map((f) => f.case)}`);
  assert.ok(case3.value > 3 && case3.value < 7);

  const sparse = analyse(referenceSession(5, readings.slice(0, MIN_CHRONO_READINGS_FOR_BC - 1)));
  assert.ok(!sparse.findings.some((f) => f.case === 3));
  assert.ok(sparse.findings.some((f) => f.case === 2), 'the come-up correction is still delivered');
});

test('without a chronograph, v0 and drag come back as one joint finding (case 6), never separately', () => {
  const result = analyse(referenceSession(5, []));
  const joint = result.findings.find((f) => f.case === 6);
  assert.ok(joint && joint.members.includes('v0Ms') && joint.members.includes('dragPct'));
  assert.ok(!result.findings.some((f) => f.param === 'dragPct' || f.param === 'v0Ms'));
});

test('a cause the session did not determine is listed as not determined, never as checking out', () => {
  // Click value not tested: the shots barely determine it, so its small fitted effect says nothing about the scope.
  const session = referenceSession(0, Array(10).fill(792.48));
  const targets = sessionTargets({ location: { targets: [LOCATION.targets[0], LOCATION.targets[2]] } });
  const homework = { zeroVerified: true, trackTested: false, windConfidenceMs: 0.5, mvSD: 3, chronographAvailable: true };
  const observations = buildObservations({ state: REF_STATE, session, targets, rangeDeclaredFlat: true, mvSD: 3 });
  const result = analyseSession({
    state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), rechecked: true,
    rMax: 860, chronoN: 10, targets
  });
  assert.ok(result.notDetermined.includes('trackPct'), `notDetermined: ${result.notDetermined}`);
  assert.ok(!result.notMaterial.includes('trackPct'));
  for (const k of result.notMaterial) assert.ok(!result.notDetermined.includes(k));
});

test('bcCorrectionOffer compounds and shows the effective BC, or the Cd-table scaling', () => {
  const bc = bcCorrectionOffer({ state: { ...REF_STATE, bcGainFactor: 1.02 }, dragPct: -4 });
  assert.ok(Math.abs(bc.newFactor - 1.02 / 0.96) < 1e-12);
  assert.ok(Math.abs(bc.newEffectiveBc - 0.2623 * 1.02 / 0.96) < 1e-12);
  const cd = bcCorrectionOffer({ state: { cdTable: [[1, 0.3]], bcGainFactor: 1 }, dragPct: 5 });
  assert.equal(cd.isCdTable, true);
  assert.ok(cd.dragChangePct > 4.9 && cd.dragChangePct < 5.1);
});

test('without chronograph readings a v0 shift is never reported as a measured muzzle velocity', () => {
  const truth = { ...REF_STATE, muzzleVelocity: 770 };
  const groups = [100, 200, 300].map((r) => ({ rangeM: r, targetKey: `t${r}`, observedComeUp: comeUpMrad(truth, r), shots: 4, sigmaMrad: 0.08 }));
  const targets = groups.map((g) => ({ key: g.targetKey, rangeM: g.rangeM, registered: true, losAngleDeg: 0 }));
  const homework = { zeroVerified: true, trackTested: true, windConfidenceMs: 0.5 };
  const observations = buildObservations({ state: REF_STATE, session: { groups, chronoVelocities: [] }, targets, rangeDeclaredFlat: true, mvSD: 3 });
  const result = analyseSession({ state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), rechecked: true, rMax: 300, chronoN: 0, targets });
  assert.ok(!result.findings.some((f) => f.case === 'measuredV0'));
});

test('far-target cross-check: the prompt names the plan\'s far target whatever else is on the range', () => {
  assert.deepEqual(farTargetCheckPrompt({ planRanges: [100, 870], rangeDeclaredFlat: true }), { farM: 870, needsAngle: false });
  assert.equal(farTargetCheckPrompt({ planRanges: [100, 800, 870], rangeDeclaredFlat: true }).farM, 870, 'a neighbouring target does not switch it off');
  assert.equal(farTargetCheckPrompt({ planRanges: [600], rangeDeclaredFlat: true }).farM, 600);
});

test('far-target cross-check: the angle is asked for exactly when the range is not declared flat', () => {
  assert.equal(farTargetCheckPrompt({ planRanges: [100, 870], rangeDeclaredFlat: false }).needsAngle, true);
  assert.equal(farTargetCheckPrompt({ planRanges: [100, 870], rangeDeclaredFlat: true }).needsAngle, false);
});

test('far-target cross-check: nothing to say without a plan', () => {
  assert.equal(farTargetCheckPrompt({ planRanges: [], rangeDeclaredFlat: true }), null);
  assert.equal(farTargetCheckPrompt({ planRanges: null, rangeDeclaredFlat: true }), null);
});

// One glance-read group at the zero range measures the zero and nothing else, so the fitted zero, its
// uncertainty and hence P(material) follow directly from the single reading (prior 0.25 mrad, reading 0.15 mrad).
function nearOnly(observedComeUp) {
  const targets = [{ key: 'near', rangeM: 100, registered: true, losAngleDeg: 0 }];
  const groups = [{ rangeM: 100, targetKey: 'near', observedComeUp, shots: 4, sigmaMrad: 0.15 }];
  const homework = { trackTested: true };
  const observations = buildObservations({ state: REF_STATE, session: { groups, chronoVelocities: [] }, targets, rangeDeclaredFlat: true, mvSD: null });
  return analyseSession({ state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), rechecked: true, rMax: 100, chronoN: 0, targets });
}

test('a zero finding is a correction only at P(material) of ZERO_FINDING_MIN_P or more; between 0.5 and that it is "possible"', () => {
  const clear = nearOnly(0.4);
  const zero = clear.findings.find((f) => f.case === 4);
  assert.ok(zero && zero.pMaterial >= ZERO_FINDING_MIN_P, `expected a zero correction, got ${JSON.stringify(clear.findings.map((f) => [f.case, f.reason, f.pMaterial]))}`);

  const unclear = nearOnly(0.25);
  assert.ok(!unclear.findings.some((f) => f.case === 4), 'a zero finding at P(material) below the threshold must not be offered as a correction');
  const possible = unclear.findings.find((f) => f.case === 8 && f.reason === 'possible' && f.param === 'zeroMrad');
  assert.ok(possible, `expected a "possible" zero item, got ${JSON.stringify(unclear.findings.map((f) => [f.case, f.reason, f.pMaterial]))}`);
  assert.ok(possible.pMaterial > 0.5 && possible.pMaterial < ZERO_FINDING_MIN_P);
});

test('a dial-table entry must reach both the mrad floor and DIAL_TABLE_MIN_SD_MULTIPLE times its own uncertainty', () => {
  assert.equal(DIAL_TABLE_MIN_MRAD, 0.05);
  assert.equal(DIAL_TABLE_MIN_SD_MULTIPLE, 1);
  // a reading of 0.12 mrad gives a fitted correction of about 0.09 mrad, above the floor but below its own SD (about 0.13)
  const small = nearOnly(0.12);
  assert.ok(!small.findings.some((f) => f.case === 2), 'a correction smaller than its own uncertainty must not be offered');
  // a reading of 0.4 gives a correction of about 0.29 mrad against an SD of about 0.13
  const large = nearOnly(0.4);
  const table = large.findings.find((f) => f.case === 2);
  assert.ok(table, 'a correction well above its own uncertainty is offered');
  assert.ok(table.corrections.every((c) => Number.isFinite(c.sdMrad) && c.sdMrad > 0));
});

test('a recorded or measured angle keeps its sign from the target record through the observations to the physics', () => {
  const location = { targets: [{ id: 'up', rangeM: 700, losAngleDeg: 30 }, { id: 'down', rangeM: 700, losAngleDeg: -30 }] };
  const targets = sessionTargets({ location });
  const groups = targets.map((tg) => ({ rangeM: 700, targetKey: tg.key, observedComeUp: 6, shots: 4, sigmaMrad: 0.1 }));
  const obs = buildObservations({ state: REF_STATE, session: { groups, chronoVelocities: [] }, targets, rangeDeclaredFlat: false, mvSD: null });
  const byKey = Object.fromEntries(obs.map((o) => [o.targetIndex, o]));
  assert.equal(byKey.up.knownLosDeg, 30);
  assert.equal(byKey.down.knownLosDeg, -30);
  // uphill and downhill are not the same shot: the air the bullet crosses differs, by about 0.06 mrad at 700 m and 30 degrees
  const up = predictedComeUp(REF_STATE, 700, {}, { knownLosDeg: 30 });
  const down = predictedComeUp(REF_STATE, 700, {}, { knownLosDeg: -30 });
  assert.ok(up - down > 0.03 && up - down < 0.12, `uphill minus downhill ${up - down}`);
});

test('groups carry their own air and wind into the observations, and their chronograph readings are compared in that air', () => {
  const state = { ...REF_STATE, referenceTempC: 15, velocityTempSensitivity: 0.8 };
  const targets = [{ key: 'a', rangeM: 300, registered: true, losAngleDeg: 0 }, { key: 'b', rangeM: 600, registered: true, losAngleDeg: 0 }];
  const cold = { tempC: 5, pressureHpa: 1012, windSpeed: 2, windAngle: 90 };
  const warm = { tempC: 25, pressureHpa: 1004 };
  // readings taken as the cartridge really behaves at each temperature (0.8 m/s per degree)
  const vAt = (c) => resolveMuzzleVelocity(withConditions(state, c));
  const groups = [
    { rangeM: 300, targetKey: 'a', observedComeUp: 1.6, shots: 4, sigmaMrad: 0.1, conditions: cold, chronoVelocities: [vAt(cold), vAt(cold), vAt(cold)] },
    { rangeM: 600, targetKey: 'b', observedComeUp: 5.3, shots: 4, sigmaMrad: 0.1, conditions: warm, chronoVelocities: [vAt(warm), vAt(warm), vAt(warm)] }
  ];
  const obs = buildObservations({ state, session: { groups, chronoVelocities: groups.flatMap((g) => g.chronoVelocities) }, targets, rangeDeclaredFlat: true, mvSD: 3 });
  assert.deepEqual(obs.filter((o) => o.rangeM != null).map((o) => o.conditions), [cold, warm]);
  const rows = obs.filter((o) => o.kind === 'chrono');
  assert.equal(rows.length, 2, 'one chronograph row per group that has readings');
  for (const row of rows) assert.ok(Math.abs(row.residualMs) < 1e-9, `a group's readings agree with the cartridge in that group's air (${row.residualMs})`);
  // one cold group only: compared at the base temperature its readings would look like an 8 m/s shift, the mistake being avoided
  const coldOnly = [groups[0]];
  const perGroup = buildObservations({ state, session: { groups: coldOnly, chronoVelocities: coldOnly[0].chronoVelocities }, targets, rangeDeclaredFlat: true, mvSD: 3 }).find((o) => o.kind === 'chrono');
  const pooled = buildObservations({ state, session: { groups: coldOnly.map(({ chronoVelocities, ...g }) => g), chronoVelocities: coldOnly[0].chronoVelocities }, targets, rangeDeclaredFlat: true, mvSD: 3 }).find((o) => o.kind === 'chrono');
  assert.ok(Math.abs(perGroup.residualMs) < 1e-9);
  assert.ok(Math.abs(pooled.residualMs + 8) < 1e-9, `without per-group readings the old pooled row is kept, at the base temperature (${pooled.residualMs})`);
});

test('analyseSession accepts groups with their own conditions, and nextShotFromAnalysis dials from the fit in the next shot\'s air', () => {
  const targets = [{ key: 'near', rangeM: 100, registered: true, losAngleDeg: 0 }, { key: 'far', rangeM: 700, registered: true, losAngleDeg: 0 }];
  const c1 = { tempC: 8, pressureHpa: 1010, windSpeed: 1, windAngle: 90 };
  const c2 = { tempC: 22, pressureHpa: 1002, windSpeed: 3, windAngle: 90 };
  const truth = { ...REF_STATE, muzzleVelocity: 780 };
  const groups = [
    { rangeM: 100, targetKey: 'near', observedComeUp: comeUpMrad(withConditions(truth, c1), 100), shots: 4, sigmaMrad: 0.05, conditions: c1 },
    { rangeM: 700, targetKey: 'far', observedComeUp: comeUpMrad(withConditions(truth, c2), 700), shots: 8, sigmaMrad: 0.05, conditions: c2 }
  ];
  const homework = { zeroVerified: true, trackTested: true, windConfidenceMs: 0.5, mvSD: 3, chronographAvailable: false };
  const observations = buildObservations({ state: REF_STATE, session: { groups, chronoVelocities: [] }, targets, rangeDeclaredFlat: true, mvSD: null });
  const analysis = analyseSession({ state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), rechecked: true, rMax: 700, chronoN: 0, targets });
  assert.ok(analysis.warm && analysis.cov);
  const next = nextShotFromAnalysis({ state: REF_STATE, analysis, rangeM: 500, conditions: { tempC: 24, pressureHpa: 1001, windSpeed: 4, windAngle: 90 }, crosswindSigmaMs: 1 });
  assert.ok(Number.isFinite(next.elevationMrad) && next.elevationMrad > 2 && next.elevationMrad < 4, `elevation at 500 m ${next.elevationMrad}`);
  assert.ok(Math.abs(next.windageMrad) > 0.1, `windage from a 4 m/s crosswind ${next.windageMrad}`);
  assert.ok(next.elevationSdMrad > 0 && next.windageSdMrad > 0);
});

// ---- The round budget advice ----
const ADVICE_DISTANCES = [100, 200, 300, 400, 500, 600, 700, 800];
const ADVICE_HW = { r50Mrad: 0.14, mvSD: 4, muzzleVelocitySDPreset: RIG_PRESET_KEY, windConfidenceMs: 2, backdropHeightM: 4 };
const adviceFor = (homework, currentBudget = 12) => roundBudgetAdvice({ state: REF_STATE, availableDistances: ADVICE_DISTANCES, homework: { ...ADVICE_HW, ...homework }, params: sessionParams({ ...ADVICE_HW, ...homework }), currentBudget });

test('roundBudgetAdvice: a knee on the budget grid, and what ten and twenty rounds more than it would buy', () => {
  const a = adviceFor({ chronographAvailable: true });
  assert.equal(a.flat, false);
  assert.ok(BUDGET_ADVICE_GRID.includes(a.knee.roundBudget), 'the knee is one of the budgets tried');
  assert.equal(a.options.length, 3);
  assert.deepEqual(a.options.map((o) => o.roundBudget), [a.knee.roundBudget, ...BUDGET_ADVICE_STEPS.map((n) => a.knee.roundBudget + n)]);
  assert.equal(a.options[0].dragSdChange, 0);
  assert.ok(a.options[1].dragSd < a.options[0].dragSd && a.options[2].dragSd < a.options[1].dragSd, 'more rounds, less drag spread');
  assert.ok(a.options[1].dragSdChange < 0 && a.options[2].dragSdChange < a.options[1].dragSdChange);
  assert.ok(Math.abs(a.options[1].dragSdChange) < 0.15 && Math.abs(a.options[2].dragSdChange) < 0.25, 'past the knee the gains are small');
  for (const o of a.options) {
    assert.equal(o.shots.reduce((x, y) => x + y, 0), o.roundBudget, 'the plan spends exactly the budget');
    assert.ok(['A', 'B', 'C', 'D'].includes(o.grade));
    assert.ok(o.farDialSdMrad > 0 && o.farM === o.ranges[o.ranges.length - 1]);
  }
  assert.ok(a.options[2].farDialSdMrad < a.options[0].farDialSdMrad, 'and the far-target dial is better known');
  // the knee is a real bend: the gain per round before it is bigger than after it
  const before = a.points.filter((p) => p.roundBudget <= a.knee.roundBudget), after = a.points.filter((p) => p.roundBudget >= a.knee.roundBudget);
  const slope = (pts) => (pts[0].dragSd - pts[pts.length - 1].dragSd) / (pts[pts.length - 1].roundBudget - pts[0].roundBudget);
  assert.ok(slope(before) > slope(after), 'steeper before the knee than after');
});

test('roundBudgetAdvice: the caller\'s own budget is planned too, and rounds do not limit a hopeless plan', () => {
  const a = adviceFor({ chronographAvailable: true }, 9);
  assert.equal(a.yours.roundBudget, 9);
  assert.ok(a.yours.dragSd > a.knee.dragSd, 'fewer rounds than the knee leave more spread');
  // no chronograph, nothing checked, a near-only range: more rounds barely help, and the advice says so instead of inventing a knee
  const hopeless = roundBudgetAdvice({ state: REF_STATE, availableDistances: [100, 200, 300], homework: { ...ADVICE_HW }, params: sessionParams(ADVICE_HW), currentBudget: 12 });
  assert.equal(hopeless.flat, true);
  assert.ok(hopeless.atMost.dragSd > 3.5, 'the drag scale stays poorly known at the most rounds tried');
  assert.equal(hopeless.knee, undefined);
});

test('roundBudgetAdvice follows the homework: a checked homework needs fewer rounds for the same grade', () => {
  const unchecked = adviceFor({ chronographAvailable: true });
  const checked = adviceFor({ chronographAvailable: true, zeroVerified: true, trackTested: true, mvAverageChecked: true });
  assert.ok(checked.knee.dragSd < unchecked.knee.dragSd);
  assert.equal(roundBudgetAdvice({ state: REF_STATE, availableDistances: [], homework: ADVICE_HW, params: sessionParams(ADVICE_HW) }), null, 'no distance, no advice');
});

test('a station pressure well above the standard atmosphere at the location\'s altitude looks like QNH; a real one does not', () => {
  assert.equal(stationPressureCheck({ pressureHpa: 1013, altitudeM: 1500 }).level, 'qnh');
  assert.equal(stationPressureCheck({ pressureHpa: 850, altitudeM: 1500 }).level, 'ok');
  assert.equal(stationPressureCheck({ pressureHpa: 880, altitudeM: 1500 }).level, 'ok', 'a high-pressure day is still real');
  assert.equal(stationPressureCheck({ pressureHpa: 1013, altitudeM: 0 }).level, 'ok');
  assert.equal(stationPressureCheck({ pressureHpa: 760, altitudeM: 1500 }).level, 'low');
  assert.equal(stationPressureCheck({ pressureHpa: 900, altitudeM: null }).level, 'unknown');
  assert.ok(Math.abs(stationPressureCheck({ pressureHpa: 1013, altitudeM: 1500 }).expectedHpa - 846) < 3);
});

test('a group carries only the weather the engine takes from it, and a large change since the start is noticed', () => {
  assert.deepEqual(pickGroupConditions({ tempC: 20, pressureHpa: 900, altitudeM: 1200, atmospherePreset: 'custom', windSpeed: 2, windAngle: 45 }), { tempC: 20, pressureHpa: 900, windSpeed: 2, windAngle: 45 });
  assert.equal(pickGroupConditions({}), null);
  const start = { tempC: 10, pressureHpa: 1000 };
  assert.equal(conditionsChangedALot(start, { tempC: 14, pressureHpa: 1005 }), false);
  assert.equal(conditionsChangedALot(start, { tempC: 19, pressureHpa: 1000 }), true);
  assert.equal(conditionsChangedALot(start, { tempC: 10, pressureHpa: 1020 }), true);
});

test('each group\'s chronograph readings are compared with the velocity in that group\'s own air', () => {
  const hot = { tempC: 35, pressureHpa: 1013.25, humidityPct: 50 };
  const state = { ...REF_STATE, muzzleVelocity: 792.48, velocityTempSensitivity: 0.8, referenceTempC: 15 };
  const session = {
    groups: [
      { rangeM: 100, observedComeUp: 0, shots: 3, sigmaMrad: 0.05, resolved: true, chronoVelocities: [792, 793, 792] },
      { rangeM: 300, observedComeUp: 1.6, shots: 3, sigmaMrad: 0.05, resolved: true, conditions: hot, chronoVelocities: [792, 793, 792] }
    ],
    chronoVelocities: [792, 793, 792, 792, 793, 792], rangeChecks: [], angleChecks: {}
  };
  const obs = buildObservations({ state, session, targets: [], rangeDeclaredFlat: true, mvSD: 2, mvSdSampleSize: 20 });
  const rows = obs.filter((o) => o.kind === 'chrono');
  assert.equal(rows.length, 2, 'one chronograph row per group');
  assert.ok(rows[1].assumedV0 > rows[0].assumedV0 + 5, `the hot group's readings are compared with a faster cartridge (${rows[0].assumedV0} vs ${rows[1].assumedV0})`);
});

test('a stalled ladder says whether the step cap or the backdrop is the reason', () => {
  assert.deepEqual(ladderStallReason({ nextM: 870, farthestValidatedM: 100 }), { reason: 'cap', lowM: 100, highM: 400 });
  assert.equal(ladderStallReason({ nextM: 350, farthestValidatedM: 100 }).reason, 'backdrop');
  assert.equal(ladderStallReason({ nextM: 350, farthestValidatedM: null }).reason, 'backdrop');
});

test('the recommended number of chronograph rounds grows with the spread, between 10 and 40', () => {
  assert.equal(recommendedMvShots(1), 10);
  assert.equal(recommendedMvShots(4), 16);
  assert.equal(recommendedMvShots(20), 40);
  assert.equal(recommendedMvShots(null), 10);
});

test('the homework ticks the stated uncertainty leans on are the four that feed the fit', () => {
  assert.deepEqual(homeworkTicked({ zeroVerified: true, mvAverageChecked: true, coldBoreHandled: true }), ['zeroVerified', 'mvAverageChecked']);
  assert.deepEqual(homeworkTicked({}), []);
});
