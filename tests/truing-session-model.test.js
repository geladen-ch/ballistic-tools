import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';

installFakeDom();

const {
  sessionPriors, planningPriors, sessionParams, reportedCauses, mvSdSampleSizeFrom, effectiveMvSd, buildObservations,
  sessionTargets, groupTargetKey, analyseSession, bcCorrectionOffer, MIN_CHRONO_READINGS_FOR_BC,
  farTargetCheckPrompt, ZERO_FINDING_MIN_P, DIAL_TABLE_MIN_MRAD, DIAL_TABLE_MIN_SD_MULTIPLE, nextShotFromAnalysis,
  roundBudgetAdvice, wholePlan, stationPressureCheck, pickGroupConditions, conditionsChangedALot, ladderStallReason, recommendedMvShots, homeworkTicked, BUDGET_ADVICE_GRID, BUDGET_ADVICE_STEPS, BUDGET_MINIMAL_WITHIN, windStrengthOf, roundBudgetOrDefault, DEFAULT_ROUND_BUDGET, livePriors, MIN_CHRONO_READINGS_TRUSTED, missWidenedDragSigma, TOTALLY_IMPLAUSIBLE_DRAG_PCT, IMPLAUSIBLE_DRAG_SIGMAS
} = await import('../src/ui/truing-session/session-model.js');
const { v0MsCheckedSigma, comeUpMrad, sigmaForGroup, predictedComeUp, withConditions, BASE_PARAMS, SIGMA_DRAG_PCT, planningColumns } = await import('../src/engine/truing-session.js');
const { resolveMuzzleVelocity } = await import('../src/engine/trajectory.js');
const { RIG_PRESET_KEY, CUSTOM_PRESET_KEY } = await import('../src/ui/precision-preset-field.js');

const REF_STATE = {
  dragModel: 'G7', bc: 0.2623, muzzleVelocity: 792.48, zeroRange: 100, sightHeight: 50,
  tempC: 15, pressureHpa: 1013.25, altitudeM: 0, humidityPct: 50, windSpeed: 0, windAngle: 90, losAngleDeg: 0
};

test('the fit priors never switch v0Ms on the chronograph checkbox; a verified MV average uses the checked-sigma formula', () => {
  assert.equal(sessionPriors({ chronographAvailable: true, mvSD: 3 }).v0Ms, 20);
  const checked = sessionPriors({ mvAverageChecked: true, mvSD: 3, muzzleVelocitySDPreset: RIG_PRESET_KEY });
  assert.equal(checked.v0Ms, v0MsCheckedSigma({ mvSD: 3, nToday: 10, mvSdSampleSize: 10 }));
});

test('planning priors fold the planned chronographed shots into v0Ms; without a chronograph they equal the fit priors', () => {
  const hw = { chronographAvailable: true, mvSD: 3 };
  assert.ok(planningPriors(hw, { nShots: 12 }).v0Ms < 1);
  assert.equal(planningPriors({ mvSD: 3 }, { nShots: 12 }).v0Ms, 20);
});

test('once the session has enough chronograph readings of its own, they replace the checked MV average as the muzzle-velocity prior', () => {
  const hw = { mvAverageChecked: true, mvSD: 3, muzzleVelocitySDPreset: RIG_PRESET_KEY };
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

test('a completed tall-target test keeps the click value in the fit at its tight prior, but out of the report', () => {
  assert.deepEqual(sessionParams({ trackTested: true }), BASE_PARAMS);
  assert.equal(sessionPriors({ trackTested: true }).trackPct, 0.15);
  assert.deepEqual(reportedCauses({ trackTested: true }), BASE_PARAMS.filter((k) => k !== 'trackPct'));
  assert.deepEqual(reportedCauses({}), BASE_PARAMS);
  const homework = { zeroVerified: true, trackTested: true, mvSD: 3, chronographAvailable: true };
  const targets = sessionTargets({ location: { targets: [LOCATION.targets[0], LOCATION.targets[2]] } });
  const session = referenceSession(5, Array(10).fill(792.48));
  const observations = buildObservations({ state: REF_STATE, session, targets, rangeDeclaredFlat: true, mvSD: 3 });
  const run = (extra) => analyseSession({ state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), rechecked: true, rMax: 860, chronoN: 10, targets, ...extra });
  const mentioned = (a) => [...a.notMaterial, ...a.notDetermined, ...a.findings.flatMap((f) => [f.param, ...(f.members || [])])];
  assert.ok(mentioned(run({})).includes('trackPct'), 'reported when every fitted cause is'); // the filter below is what keeps it out
  const analysis = run({ causes: reportedCauses(homework) });
  assert.ok(analysis.params.includes('trackPct'));
  assert.ok(!mentioned(analysis).includes('trackPct'), `trackPct reported: ${JSON.stringify(mentioned(analysis))}`);
});

test('the SD sample size follows its provenance', () => {
  assert.equal(mvSdSampleSizeFrom({ muzzleVelocitySDPreset: RIG_PRESET_KEY }), 10);
  assert.equal(mvSdSampleSizeFrom({ muzzleVelocitySDPreset: CUSTOM_PRESET_KEY, mvSdShots: 25 }), 25);
  assert.equal(mvSdSampleSizeFrom({ muzzleVelocitySDPreset: CUSTOM_PRESET_KEY }), 10);
  assert.equal(mvSdSampleSizeFrom({ muzzleVelocitySDPreset: 'factoryMatch' }), null);
});

test('the session\'s velocity spread is the recorded SD and today\'s readings pooled by degrees of freedom', () => {
  const homework = { mvSD: 6, muzzleVelocitySDPreset: CUSTOM_PRESET_KEY, mvSdShots: 10 }; // 6 m/s resting on 10 shots
  assert.deepEqual(effectiveMvSd({ homework, velocities: [] }), { mvSD: 6, mvSdSampleSize: 10, override: null }, 'no readings: the recorded SD');
  assert.equal(effectiveMvSd({ homework, velocities: [790] }).mvSD, 6, 'one reading says nothing about a spread');
  const readings = [0, 2, 4, 6, 8, 10].map((x) => 790 + x); // sample variance 14
  const pooled = effectiveMvSd({ homework, velocities: readings });
  assert.ok(Math.abs(pooled.mvSD - Math.sqrt((9 * 36 + 5 * 14) / 14)) < 1e-12);
  assert.equal(pooled.mvSdSampleSize, 15);
  assert.equal(pooled.override, null, 'six readings are never tested for a significant difference');
  // readings that agree with the recorded SD leave it where it is
  const alike = Array.from({ length: 20 }, (_, i) => 790 + (i % 2 ? 3 : -3)); // SD about 3.08, recorded 3
  const same = effectiveMvSd({ homework: { mvSD: 3, muzzleVelocitySDPreset: RIG_PRESET_KEY }, velocities: alike });
  assert.ok(Math.abs(same.mvSD - 3) < 0.1 && same.override === null);
});

test('an SD given without a shot count counts as 5 shots when pooled; one with its count counts as that many', () => {
  const readings = [0, 2, 4, 6, 8, 10].map((x) => 790 + x); // sample variance 14
  const at = (n0) => Math.sqrt(((n0 - 1) * 36 + 5 * 14) / (n0 + 4));
  for (const homework of [{ mvSD: 6, muzzleVelocitySDPreset: 'factoryMatch' }, { mvSD: 6, muzzleVelocitySDPreset: RIG_PRESET_KEY }, { mvSD: 6, muzzleVelocitySDPreset: CUSTOM_PRESET_KEY }, { mvSD: 6 }]) {
    const r = effectiveMvSd({ homework, velocities: readings });
    assert.ok(Math.abs(r.mvSD - at(5)) < 1e-12, `${homework.muzzleVelocitySDPreset}`);
    assert.equal(r.mvSdSampleSize, 10);
  }
  const typed = effectiveMvSd({ homework: { mvSD: 6, muzzleVelocitySDPreset: CUSTOM_PRESET_KEY, mvSdShots: 25 }, velocities: readings });
  assert.ok(Math.abs(typed.mvSD - at(25)) < 1e-12);
  assert.ok(at(5) < at(25), 'an SD without a count gives way to today\'s readings sooner');
});

test('past 10 readings a significantly different spread is announced, and the figure used is pooled, not replaced', () => {
  const homework = { mvSD: 3, muzzleVelocitySDPreset: RIG_PRESET_KEY };
  const wide = Array.from({ length: 20 }, (_, i) => 790 + (i % 2 ? 9 : -9));
  assert.equal(effectiveMvSd({ homework, velocities: wide.slice(0, 10) }).override, null, '10 readings: never tested');
  const over = effectiveMvSd({ homework, velocities: wide });
  assert.ok(over.override && over.override.sd > 9 && over.override.sampleSize === 20 && over.override.recordedSd === 3);
  assert.ok(over.mvSD > 3 && over.mvSD < over.override.sd, `pooled between the two (${over.mvSD})`);
  assert.equal(over.override.usedSd, over.mvSD);
  assert.equal(over.mvSdSampleSize, 24, "5 shots behind the rig SD (no count given) + 20 readings - 1");
});

test('the spread is measured around each group\'s expected velocity, with a common offset removed', () => {
  const state = { ...REF_STATE, referenceTempC: 15, velocityTempSensitivity: 0.8 };
  const cold = { tempC: 5 }; const warm = { tempC: 25 };
  const vAt = (c) => resolveMuzzleVelocity(withConditions(state, c));
  const homework = { mvSD: 3, muzzleVelocitySDPreset: RIG_PRESET_KEY };
  const jitter = [-2, 2, -1, 1, 0, 0];
  // identical jitter in a cold and a warm group: raw readings differ by 16 m/s between the groups, around their own expected velocity they do not
  const groups = [
    { conditions: cold, chronoVelocities: jitter.map((j) => vAt(cold) + j) },
    { conditions: warm, chronoVelocities: jitter.map((j) => vAt(warm) + j) }
  ];
  const flat = groups.flatMap((g) => g.chronoVelocities);
  const perGroup = effectiveMvSd({ homework, velocities: flat, state, groups });
  const raw = effectiveMvSd({ homework, velocities: flat });
  assert.ok(raw.mvSD > perGroup.mvSD + 1, `raw ${raw.mvSD} against ${perGroup.mvSD}`);
  // all readings 15 m/s above the specified velocity: the offset is the fit's business, not spread
  const biased = [{ chronoVelocities: jitter.map((j) => vAt({}) + 15 + j) }];
  const offset = effectiveMvSd({ homework, velocities: biased[0].chronoVelocities, state, groups: biased });
  const centred = effectiveMvSd({ homework, velocities: jitter.map((j) => vAt({}) + j), state, groups: [{ chronoVelocities: jitter.map((j) => vAt({}) + j) }] });
  assert.ok(Math.abs(offset.mvSD - centred.mvSD) < 1e-9);
});

test('a string that kept its noise parts is re-weighed with the current velocity spread; an older one keeps its recorded sigma', () => {
  const targets = [{ key: 'a', rangeM: 600, registered: true, losAngleDeg: 0 }];
  const noise = { r50Mrad: 0.14, v0SensMrad: -0.02, sigmaObsMrad: 0.05 };
  const withNoise = { rangeM: 600, targetKey: 'a', observedComeUp: 5.3, shots: 3, sigmaMrad: 0.2, noise };
  const without = { rangeM: 600, targetKey: 'a', observedComeUp: 5.3, shots: 3, sigmaMrad: 0.2 };
  const sigmaAt = (g, mvSD) => buildObservations({ state: REF_STATE, session: { groups: [g] }, targets, rangeDeclaredFlat: true, mvSD }).find((o) => o.rangeM != null).sigmaMrad;
  assert.ok(Math.abs(sigmaAt(withNoise, 6) - sigmaForGroup({ shots: 3, ...noise, mvSD: 6 })) < 1e-12);
  assert.ok(sigmaAt(withNoise, 12) > sigmaAt(withNoise, 6));
  assert.equal(sigmaAt(without, 12), 0.2);
  assert.equal(sigmaAt(withNoise, null), 0.2, 'no spread known: the recorded sigma');
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
  const homework = { zeroVerified: true, trackTested: true, mvSD: 3, chronographAvailable: true };
  const observations = buildObservations({ state: REF_STATE, session, targets, rangeDeclaredFlat: true, mvSD: 3 });
  return analyseSession({
    state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), causes: reportedCauses(homework), rechecked: true,
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
  const homework = { zeroVerified: true, trackTested: false, mvSD: 3, chronographAvailable: true };
  const observations = buildObservations({ state: REF_STATE, session, targets, rangeDeclaredFlat: true, mvSD: 3 });
  const result = analyseSession({
    state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), causes: reportedCauses(homework), rechecked: true,
    rMax: 860, chronoN: 10, targets
  });
  assert.ok(result.notDetermined.includes('trackPct'), `notDetermined: ${result.notDetermined}`);
  assert.ok(!result.notMaterial.includes('trackPct'));
  for (const k of result.notMaterial) assert.ok(!result.notDetermined.includes(k));
});

test('a missed impact widens the drag prior by what a drag error alone would need to leave the backdrop there', () => {
  const sigma = (session, backdropMarginM = 1) => missWidenedDragSigma({ state: REF_STATE, session, backdropMarginM });
  const perPct = (r) => Math.abs(planningColumns(REF_STATE, r).dragPct);
  assert.equal(sigma({ missesAt: { 300: 1 } }), SIGMA_DRAG_PCT, 'a near miss says nothing about the BC');
  const needed800 = (1 / 800 * 1000) / perPct(800);
  assert.ok(needed800 > 15 && needed800 < 30, `needed at 800 m on a 2 m backdrop: ${needed800}`);
  closeTo(sigma({ missesAt: { 800: 1 } }), needed800 / 2, 1e-9, 'two standard deviations from the needed error');
  assert.equal(sigma({ missesAt: { 600: 1 } }, 2), SIGMA_DRAG_PCT, 'beyond TOTALLY_IMPLAUSIBLE_DRAG_PCT: no widening');
  assert.ok((2 / 600 * 1000) / perPct(600) > TOTALLY_IMPLAUSIBLE_DRAG_PCT);
  closeTo(sigma({ missedRanges: [800] }), needed800 / 2, 1e-9, 'a session saved before missesAt: its missed distances');
  closeTo(sigma({ missesAt: { 300: 1, 800: 2 } }), needed800 / 2, 1e-9, 'the widest of the misses');
  // livePriors: the widened prior for Shoot, the usual one when asked (Conclude) or when no state is given
  const hw = { zeroVerified: true, backdropHeightM: 2 };
  const session = { chronoVelocities: [], missedImpactCount: 1, missesAt: { 800: 1 } };
  closeTo(livePriors(hw, session, { state: REF_STATE }).dragPct, needed800 / 2, 1e-9, 'widened');
  assert.equal(livePriors(hw, session, { state: REF_STATE, widen: false }).dragPct, SIGMA_DRAG_PCT);
  assert.equal(livePriors(hw, session).dragPct, SIGMA_DRAG_PCT);
  assert.equal(livePriors(hw, { ...session, missedImpactCount: 0, missesAt: {} }, { state: REF_STATE }).dragPct, SIGMA_DRAG_PCT);
});

test('a drag result beyond three prior SDs, or a factor outside 0.8-1.2, is implausible: never offered for saving', () => {
  const limit = IMPLAUSIBLE_DRAG_SIGMAS * SIGMA_DRAG_PCT;
  assert.ok(limit > 12 && limit < 12.5);
  assert.equal(bcCorrectionOffer({ state: REF_STATE, dragPct: 11 }).implausible, false);
  const far = bcCorrectionOffer({ state: REF_STATE, dragPct: 15 });
  assert.ok(far.inHardBounds && far.implausible, 'within the factor bounds, but far beyond what the prior allows');
  assert.equal(bcCorrectionOffer({ state: REF_STATE, dragPct: -15 }).implausible, true);
  assert.equal(bcCorrectionOffer({ state: REF_STATE, dragPct: 33 }).inHardBounds, false);
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
  const result = analyseSession({ state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), causes: reportedCauses(homework), rechecked: true, rMax: 300, chronoN: 0, targets });
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
  return analyseSession({ state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), causes: reportedCauses(homework), rechecked: true, rMax: 100, chronoN: 0, targets });
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
  const homework = { zeroVerified: true, trackTested: true, mvSD: 3, chronographAvailable: false };
  const observations = buildObservations({ state: REF_STATE, session: { groups, chronoVelocities: [] }, targets, rangeDeclaredFlat: true, mvSD: null });
  const analysis = analyseSession({ state: REF_STATE, observations, priors: sessionPriors(homework), params: sessionParams(homework), causes: reportedCauses(homework), rechecked: true, rMax: 700, chronoN: 0, targets });
  assert.ok(analysis.warm && analysis.cov);
  const next = nextShotFromAnalysis({ state: REF_STATE, analysis, rangeM: 500, conditions: { tempC: 24, pressureHpa: 1001, windSpeed: 4, windAngle: 90 }, windSigma: { speedMs: 1, dirDeg: 7.5 } });
  assert.ok(Number.isFinite(next.elevationMrad) && next.elevationMrad > 2 && next.elevationMrad < 4, `elevation at 500 m ${next.elevationMrad}`);
  assert.ok(Math.abs(next.windageMrad) > 0.1, `windage from a 4 m/s crosswind ${next.windageMrad}`);
  assert.ok(next.elevationSdMrad > 0 && next.windageSdMrad > 0);
});

// ---- The round budget advice ----
const ADVICE_DISTANCES = [100, 200, 300, 400, 500, 600, 700, 800];
const ADVICE_HW = { r50Mrad: 0.14, mvSD: 4, muzzleVelocitySDPreset: RIG_PRESET_KEY, windStrength: 'moderate', backdropHeightM: 4 };
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

test('roundBudgetAdvice: minimal, optimal, enhanced and deluxe tiers', () => {
  const a = adviceFor({ chronographAvailable: true });
  const { minimal, optimal, enhanced, deluxe } = a.tiers;
  assert.equal(optimal.roundBudget, a.knee.roundBudget, 'optimal is the knee');
  assert.ok(minimal.roundBudget <= optimal.roundBudget, 'minimal is no more than optimal');
  assert.equal(enhanced.roundBudget, optimal.roundBudget + 10, 'enhanced is the optimum plus ten rounds');
  assert.equal(deluxe.roundBudget, optimal.roundBudget + BUDGET_ADVICE_STEPS[BUDGET_ADVICE_STEPS.length - 1]);
  assert.ok(optimal.dragSd > enhanced.dragSd && enhanced.dragSd > deluxe.dragSd, 'more rounds, less spread, tier by tier');
  assert.ok(deluxe.dragSd < optimal.dragSd && optimal.dragSdChange === 0 && deluxe.dragSdChange < 0);
  // minimal is the fewest rounds on the grid whose drag spread is within 10% of the optimum's, and no smaller budget is
  assert.ok(minimal.dragSd <= optimal.dragSd * (1 + BUDGET_MINIMAL_WITHIN) + 1e-12);
  assert.ok(minimal.dragSdChange > 0 || minimal.roundBudget === optimal.roundBudget);
  assert.ok(a.points.filter((p) => p.roundBudget < minimal.roundBudget).every((p) => p.dragSd > optimal.dragSd * (1 + BUDGET_MINIMAL_WITHIN)));
  assert.ok(minimal.roundBudget > BUDGET_ADVICE_GRID[0], 'not the bottom of the grid: a handful of rounds is not within 10% of the knee');
});

test('roundBudgetOrDefault: the optimum, or the fixed default when there is none to report', () => {
  const a = adviceFor({ chronographAvailable: true });
  assert.equal(roundBudgetOrDefault(a), a.tiers.optimal.roundBudget);
  assert.equal(roundBudgetOrDefault(null), DEFAULT_ROUND_BUDGET);
  assert.equal(roundBudgetOrDefault({ flat: true }), DEFAULT_ROUND_BUDGET);
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
  assert.deepEqual(homeworkTicked({ zeroVerified: true, mvAverageChecked: true }), ['zeroVerified', 'mvAverageChecked']);
  assert.deepEqual(homeworkTicked({}), []);
});

test('the click value is listed first among the ticked homework items', () => {
  assert.deepEqual(homeworkTicked({ zeroVerified: true, sightHeightMeasured: true, mvAverageChecked: true, trackTested: true }), ['trackTested', 'zeroVerified', 'sightHeightMeasured', 'mvAverageChecked']);
});

// ---- strings of at most three rounds ----
const { splitIntoStrings, roundsLeft, nextStringShots, rotationNext, readShots, shotNoise, perShotSigma, stringSigma } = await import('../src/ui/truing-session/session-model.js');
const { sensitivityColumns, observationSigmaMrad, MAX_STRING_SHOTS } = await import('../src/engine/truing-session.js');
const closeTo = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= tol, `${msg}: expected ${expected}, got ${actual}`);

test('a distance\'s rounds split into strings of at most three, as evenly as possible, the longer ones first', () => {
  assert.equal(MAX_STRING_SHOTS, 3);
  assert.deepEqual(splitIntoStrings(1), [1]);
  assert.deepEqual(splitIntoStrings(3), [3]);
  assert.deepEqual(splitIntoStrings(4), [2, 2]);
  assert.deepEqual(splitIntoStrings(5), [3, 2]);
  assert.deepEqual(splitIntoStrings(7), [3, 2, 2]);
  assert.deepEqual(splitIntoStrings(12), [3, 3, 3, 3]);
  assert.deepEqual(splitIntoStrings(0), []);
  for (let n = 1; n <= 40; n++) {
    const split = splitIntoStrings(n);
    assert.equal(split.reduce((a, b) => a + b, 0), n, `${n} rounds are all shot`);
    assert.ok(split.every((k) => k >= 1 && k <= MAX_STRING_SHOTS), `${n}: no string longer than three`);
    assert.ok(Math.max(...split) - Math.min(...split) <= 1, `${n}: as even as possible`);
  }
  // the next string is the first of what is left: 7 rounds go 3, 2, 2
  assert.deepEqual([7, 4, 2].map(nextStringShots), [3, 2, 2]);
});

test('rounds left per planned distance count the rounds recorded there, but not an extra group shot to unlock a retry', () => {
  const plan = { ranges: [100, 300, 800], shots: [1, 5, 6] };
  const session = { groups: [{ rangeM: 100, shots: 1 }, { rangeM: 300, shots: 3 }, { rangeM: 300, shots: 3, extra: true }, { rangeM: 800, shots: 2 }] };
  assert.deepEqual([...roundsLeft(plan, session)], [[100, 0], [300, 2], [800, 4]]);
  assert.deepEqual([...roundsLeft(plan, { groups: [{ rangeM: 300, shots: 9 }] })], [[100, 1], [300, 0], [800, 6]], 'never below zero');
});

test('after the first pass the next string goes to the distance with the most rounds left, the farther one on a tie, never at or past a missed distance', () => {
  assert.equal(rotationNext(new Map([[100, 0], [300, 2], [800, 3]])), 800);
  assert.equal(rotationNext(new Map([[100, 0], [300, 3], [800, 3]])), 800, 'a tie goes to the farther distance');
  assert.equal(rotationNext(new Map([[100, 0], [300, 6], [800, 3]])), 300, 'several strings in a row at one distance are fine');
  assert.equal(rotationNext(new Map([[100, 0], [300, 2], [800, 3]]), 800), 300, 'a missed distance is out');
  assert.equal(rotationNext(new Map([[100, 0], [300, 0]])), null, 'nothing left: the plan is done');
});

test('a string read round by round: how many rounds were seen and their mean, with no flyer check', () => {
  const plain = readShots([5.2, 5.4, null]);
  assert.equal(plain.seen, 2);
  closeTo(plain.mean, 5.3, 1e-12, 'mean of the rounds seen');
  assert.deepEqual(readShots([5.2, 5.4, 9.9]), { seen: 3, mean: (5.2 + 5.4 + 9.9) / 3 }, 'a wild round counts like any other');
  assert.deepEqual(readShots([null, null]), { seen: 0, mean: null });
});

test('a string\'s noise: the rifle, the velocity spread at that distance in that air, the picked certainty, and the wind\'s error', () => {
  const noise = shotNoise({ state: REF_STATE, rangeM: 870, r50Mrad: 0.14, mvSD: 6, certaintyKey: 'fair', windConfidenceKey: 'good' });
  closeTo(noise.v0SensMrad, sensitivityColumns(REF_STATE, 870).v0Ms, 1e-12, 'the come-up\'s sensitivity to velocity at 870 m');
  assert.equal(noise.sigmaObsMrad, observationSigmaMrad('fair'));
  closeTo(perShotSigma(noise), Math.sqrt((0.14 / 1.1774) ** 2 + (6 * noise.v0SensMrad) ** 2 + 0.1 ** 2), 1e-12, 'one round');
  assert.ok(noise.windSdMrad > 0, 'the wind is never known exactly');
  closeTo(stringSigma(noise, 3), Math.sqrt(perShotSigma(noise) ** 2 / 3 + noise.windSdMrad ** 2), 1e-12, 'three rounds: the wind\'s error is the string\'s, undivided');
  const poor = shotNoise({ state: REF_STATE, rangeM: 870, r50Mrad: 0.14, mvSD: 6, certaintyKey: 'fair', windConfidenceKey: 'poor' });
  const excellent = shotNoise({ state: REF_STATE, rangeM: 870, r50Mrad: 0.14, mvSD: 6, certaintyKey: 'fair', windConfidenceKey: 'excellent' });
  assert.ok(excellent.windSdMrad < noise.windSdMrad && noise.windSdMrad < poor.windSdMrad, 'a less confident reading of the wind costs more');
  const cold = shotNoise({ state: REF_STATE, rangeM: 870, conditions: { tempC: -15 }, r50Mrad: 0.14, mvSD: 6, certaintyKey: 'good', windConfidenceKey: 'good' });
  assert.notEqual(cold.v0SensMrad, noise.v0SensMrad, 'the sensitivity is taken in the string\'s own air');
});

// ---- planned distances keep their targets through a re-check ----
const { withPlanKeys, targetForStep } = await import('../src/ui/truing-session/session-model.js');

test('a planned distance finds its target by key after a re-check has corrected the target\'s distance', () => {
  const before = [{ key: 'a', rangeM: 100, registered: true }, { key: 'b', rangeM: 300, registered: true }];
  const plan = withPlanKeys({ ranges: [100, 300], shots: [1, 6] }, before);
  assert.deepEqual(plan.keys, ['a', 'b']);
  const after = [{ key: 'a', rangeM: 100, registered: true }, { key: 'b', rangeM: 312, registered: true }];
  assert.equal(targetForStep(after, plan, 300).key, 'b', 'the planned 300 m is still target b, now at 312 m');
  assert.equal(targetForStep(after, { ranges: [100, 300], shots: [1, 6] }, 300), null, 'by distance alone it would find nothing');
  assert.equal(targetForStep(after, plan, 312).key, 'b', 'any other distance is still looked up by distance');
  assert.equal(withPlanKeys({ ranges: [100, 450], shots: [1, 6] }, before).keys[1], null, 'a planned distance with no target there');
});

test('the expected wind strength reaches the plan: a strong wind asks for more of the same rounds, never fewer', () => {
  const hw = (windStrength) => ({ ...ADVICE_HW, chronographAvailable: true, windStrength });
  const sd = (windStrength) => wholePlan({ state: REF_STATE, availableDistances: ADVICE_DISTANCES, homework: hw(windStrength), roundBudget: 20, params: sessionParams(hw(windStrength)) }).dragSd;
  assert.ok(sd('strong') > sd('moderate'), 'a strong wind leaves the drag scale less certain');
  assert.equal(windStrengthOf({}), 'moderate', 'moderate unless said otherwise');
  assert.equal(windStrengthOf({ windStrength: 'gale' }), 'moderate');
  const a = (windStrength) => roundBudgetAdvice({ state: REF_STATE, availableDistances: ADVICE_DISTANCES, homework: hw(windStrength), params: sessionParams(hw(windStrength)) });
  assert.ok(a('strong').tiers.optimal.roundBudget >= a('moderate').tiers.optimal.roundBudget);
});

// ---- whether the ticked homework held ----
const { homeworkCheckAxes, HOMEWORK_TRUST } = await import('../src/ui/truing-session/session-model.js');

test('homeworkCheckAxes: the zero and the velocity average, when ticked, each weighed as "held" or "not done"', () => {
  const hw = { zeroVerified: true, mvAverageChecked: true, trackTested: true, mvSD: 3, muzzleVelocitySDPreset: RIG_PRESET_KEY };
  const priors = sessionPriors(hw);
  const axes = homeworkCheckAxes(hw, priors);
  assert.deepEqual(axes.map((a) => a.key), ['zeroMrad', 'v0Ms'], 'not the click value: the shots say too little about it');
  assert.deepEqual(axes[0].sigmas, [0.08, 0.25]);
  assert.deepEqual(axes[0].weights, [HOMEWORK_TRUST, 1 - HOMEWORK_TRUST]);
  assert.equal(axes[1].sigmas[1], 20);
  assert.deepEqual(homeworkCheckAxes({}, sessionPriors({})), [], 'nothing ticked, nothing to check');
  // once the session's own chronograph decides the velocity, its tick is not weighed any more
  const trusted = livePriors(hw, { chronoVelocities: Array.from({ length: MIN_CHRONO_READINGS_TRUSTED }, () => 790) });
  assert.deepEqual(homeworkCheckAxes(hw, trusted).map((a) => a.key), ['zeroMrad']);
});

test('a ticked zero the shots contradict is doubted, and the result allows for it; one they bear out is not', () => {
  const targets = [{ key: 'near', rangeM: 100, registered: true, losAngleDeg: 0 }, { key: 'mid', rangeM: 300, registered: true, losAngleDeg: 0 }, { key: 'far', rangeM: 700, registered: true, losAngleDeg: 0 }];
  const hw = { zeroVerified: true, trackTested: true, mvSD: 3 };
  const run = (zeroOffMrad) => {
    const truth = { ...REF_STATE };
    const groups = [100, 100, 300, 700, 700].map((r, i) => ({ rangeM: r, targetKey: ['near', 'near', 'mid', 'far', 'far'][i], observedComeUp: comeUpMrad(truth, r) + zeroOffMrad, shots: 3, sigmaMrad: 0.05 }));
    const observations = buildObservations({ state: REF_STATE, session: { groups, chronoVelocities: [] }, targets, rangeDeclaredFlat: true, mvSD: null });
    const priors = sessionPriors(hw);
    return analyseSession({ state: REF_STATE, observations, priors, params: sessionParams(hw), causes: reportedCauses(hw), rechecked: true, rMax: 700, targets, extraAxes: homeworkCheckAxes(hw, priors) });
  };
  const held = run(0);
  const broken = run(0.5); // half a mrad off: six times the verified zero's sigma
  assert.ok(held.homeworkDoubt.zeroMrad < 0.2, `a zero that holds: ${held.homeworkDoubt.zeroMrad}`);
  assert.ok(broken.homeworkDoubt.zeroMrad > 0.9, `a zero half a mrad off: ${broken.homeworkDoubt.zeroMrad}`);
  assert.ok(Math.abs(broken.theta.zeroMrad - 0.5) < 0.1, `and the zero is found rather than forced into the other causes: ${broken.theta.zeroMrad}`);
});
