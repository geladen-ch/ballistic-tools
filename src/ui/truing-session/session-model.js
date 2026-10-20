// The Truing Session's glue between persisted session state and the pure
// engine (engine/truing-session.js): which targets exist and how groups
// tie to them, how observations are assembled, which priors apply, and the
// Conclude-phase analysis. No DOM and no i18n here, so every rule the UI
// relies on is directly testable.
import {
  BASE_PARAMS, DEGENERACY_R, MATERIALITY_MRAD, SUPERSONIC_MACH, DEFAULT_BACKDROP_MARGIN_M,
  SIGMA_DRAG_PCT, v0MsCheckedSigma, plannedV0Sigma, rangeAtMach,
  chronoObservation, rangeCheckObservation, applyAngleCheck, applyFlatRangeDeclaration,
  jointBlunderCheck, resolutionMatrix, sensitivityColumns, applyParameters, predictedComeUp,
  comeUpMrad, correlationOf, degenerateGroups, grade, sampleSD, sdDeviatesSignificantly, withConditions, nextShotDope,
  planWholeSession, predictiveComeUpSd, planningColumns, DEFAULT_LADDER_MAX_JUMP_FACTOR, MAX_STRING_SHOTS,
  sigmaForGroup, perShotSigmaMrad, observationSigmaMrad, windErrorMrad, windSigmaMsFor, WIND_DIRECTION_SIGMA_DEG
} from '../../engine/truing-session.js';
import { erf } from '../../engine/target-shapes.js';
import { standardAtmosphereAt } from '../../engine/atmosphere.js';
import { resolveMuzzleVelocity } from '../../engine/trajectory.js';
import { RIG_PRESET_KEY, CUSTOM_PRESET_KEY } from '../preset-keys.js';
import { radToMrad, linearToAngleAtRange, percentToFraction, fractionToPercent } from '../../quantity.js';

// A BC correction is only ever offered for saving with at least this many
// chronograph velocities actually captured this session (on top of grade
// A/B and a resolved drag scale) -- a ticked "chronograph available" box
// with no readings behind it proves nothing.
export const MIN_CHRONO_READINGS_FOR_BC = 5;
// The one rule for whether a BC correction is offered, shared by Conclude (the readings captured) and Prepare (the readings planned), so
// the plan never promises a BC the conclusion will not offer: a grade-A drag SD resting on a velocity average from another day is not one.
export function bcOfferable(letter, chronoReadings) {
  return chronoReadings >= MIN_CHRONO_READINGS_FOR_BC && (letter === 'A' || letter === 'B');
}
// From this many chronograph readings taken during the session (the velocity measured in the very air and cartridge temperature of the dope
// being fitted), the session's own measurement replaces the homework's checked average as the muzzle velocity's prior: the average was measured
// on another occasion and, if the cartridge is temperature-sensitive or the lot differs, may simply be wrong, while the readings carry their own
// uncertainty (the shot-to-shot SD over the square root of their count, wide for one or two readings). One reading is enough: with the chronograph missing most
// shots, thresholds of 1 to 5 readings were compared and the lowest left the least error whenever the checked average was wrong, and cost at most a
// thousandth of a mrad when it was right (a few thousandths with ten readings and a right average).
export const MIN_CHRONO_READINGS_TRUSTED = 1;
export const RESOLUTION_FLOOR = 0.2;          // below this, the session did not determine the parameter -- report it as unresolved, not as a shrunk-to-prior finding
export const PARTIAL_OVERLAP_R = 0.5;
// Two rules for when Conclude offers a correction, both chosen by sweeping candidate rules over thousands of
// simulated sessions (see the study's write-up): a correction shown too readily fits the noise of a few groups
// and can leave the come-up worse than doing nothing.
// A zero finding is reported as a correction only when the tool is at least this sure it matters; between
// 0.5 and this it is shown as "possible, not yet clear".
export const ZERO_FINDING_MIN_P = 0.8;
// A per-range dial-table entry counts only if it reaches this many mrad AND this many times its own standard
// deviation; the table is shown when at least one entry counts. One group's reading is only good to about
// 0.07 to 0.15 mrad, so the old 0.05 mrad floor alone let noise through.
export const DIAL_TABLE_MIN_MRAD = 0.05;
export const DIAL_TABLE_MIN_SD_MULTIPLE = 1;         // a real but sub-DEGENERACY_R overlap worth noting, short of fully degenerate
export const WALK_OUT_SHOTS_PER_RUNG = 1;     // an intermediate ladder rung is a safety check, not a measurement: one round does it (three bought nothing in the ladder campaigns)
export const REPEAT_GROUP_SHOTS = 3;         // an extra group at a validated distance, shot only to unlock the retry after a miss: enough to move the fit
export const DEFAULT_ROUND_BUDGET = 20;         // the fallback when the knee of the drag-scale spread against rounds cannot be worked out (it falls between 16 and 32 rounds, 18 to 24 with a chronograph on a dense range); the Prepare screen starts from the knee for this range and homework
export const DEFAULT_NEAR_SHOTS = 4;          // the representative 4-and-8 split shown on the optimal-range readout
export const DEFAULT_FAR_SHOTS = 8;
export const DEFAULT_MV_AVERAGE_SHOTS = 10;  // the shots behind a checked velocity average: a short check, not a field to fill in
export const ASSUMED_MV_SD_SAMPLE_SIZE = 10;  // the conservative default sample size for an SD of unknown provenance
export const UNSTATED_MV_SD_WEIGHT = 5;       // an SD given without the number of shots behind it counts as this many when it is pooled with the session's readings


// ---- the far-target cross-check prompt ----
// The far target carries nearly all of the drag-scale information in a
// session, and a wrong distance (or an unrecorded slope) on it is very hard
// to catch from the shots: with nothing else nearby it is indistinguishable
// from a wrong drag scale, and even with a neighbouring target it goes
// undetected for most errors of a few metres to a few tens of metres. So the
// Prepare screen always asks for that one distance -- and, unless the range
// is declared flat, its angle -- to be measured again before shooting.
// Returns null only when there is no plan yet.
export function farTargetCheckPrompt({ planRanges, rangeDeclaredFlat }) {
  if (!planRanges || planRanges.length === 0) return null;
  return { farM: Math.max(...planRanges), needsAngle: !rangeDeclaredFlat };
}

// ---- the air the session is shot in ----
// A station pressure read off a phone or a weather app is usually the sea-level-reduced one (QNH), which at altitude is far
// higher than the air the bullet flies through: the tool would absorb the difference into the drag scale and offer a BC
// correction for it (at 1,500 m it costs 0.39 mrad uncorrected). Real station pressure at a given altitude moves about
// 35 hPa either side of the standard atmosphere's value with the weather, so a reading well above it looks like QNH.
export const PRESSURE_QNH_MARGIN_HPA = 40;
export const PRESSURE_LOW_MARGIN_HPA = 60;
export function stationPressureCheck({ pressureHpa, altitudeM }) {
  if (!Number.isFinite(pressureHpa) || !Number.isFinite(altitudeM)) return { level: 'unknown', expectedHpa: null };
  const expectedHpa = standardAtmosphereAt(altitudeM).pressureHpa;
  const excess = pressureHpa - expectedHpa;
  if (excess > PRESSURE_QNH_MARGIN_HPA) return { level: 'qnh', expectedHpa };
  if (excess < -PRESSURE_LOW_MARGIN_HPA) return { level: 'low', expectedHpa };
  return { level: 'ok', expectedHpa };
}

// The keys a group's own weather carries into the engine (see withConditions); the altitude stays the session's own.
export const GROUP_CONDITION_KEYS = ['tempC', 'pressureHpa', 'humidityPct', 'windSpeed', 'windAngle'];
export function pickGroupConditions(values) {
  if (!values) return null;
  const out = {};
  for (const k of GROUP_CONDITION_KEYS) if (Number.isFinite(values[k])) out[k] = values[k];
  return Object.keys(out).length ? out : null;
}
// The plan is made in the starting air and is not recomputed after Start. A change this large moves the come-ups and the
// muzzle velocity enough (0.8 m/s per degree on a temperature-sensitive load) that the shooter should know the plan is
// getting old; the fit itself follows each group's own air either way.
export const CONDITIONS_CHANGED_TEMP_C = 8;
export const CONDITIONS_CHANGED_PRESSURE_HPA = 15;
export function conditionsChangedALot(start, now) {
  if (!start || !now) return false;
  return Math.abs((now.tempC ?? start.tempC) - start.tempC) >= CONDITIONS_CHANGED_TEMP_C
    || Math.abs((now.pressureHpa ?? start.pressureHpa) - start.pressureHpa) >= CONDITIONS_CHANGED_PRESSURE_HPA;
}

// Why the ladder cannot take the next planned distance: it is more than the step cap times the farthest distance that has
// landed (a distance in between fixes it), or the backdrop is too small for the predicted miss there (a nearer distance or a
// taller backdrop does).
export function ladderStallReason({ nextM, farthestValidatedM, maxJumpFactor = DEFAULT_LADDER_MAX_JUMP_FACTOR }) {
  if (farthestValidatedM != null && nextM > farthestValidatedM * maxJumpFactor) {
    return { reason: 'cap', lowM: farthestValidatedM, highM: Math.min(nextM, farthestValidatedM * maxJumpFactor) };
  }
  return { reason: 'backdrop', lowM: farthestValidatedM ?? null, highM: nextM };
}

// How many rounds to chronograph to know the average muzzle velocity to about 2 m/s (95%) at the given shot-to-shot spread,
// never fewer than 10 nor more than 40.
export const MV_AVERAGE_TOLERANCE_MS = 2;
export function recommendedMvShots(mvSD) {
  if (!Number.isFinite(mvSD) || mvSD <= 0) return 10;
  return Math.min(40, Math.max(10, Math.ceil((1.96 * mvSD / MV_AVERAGE_TOLERANCE_MS) ** 2)));
}

// The homework items ticked as done: the stated uncertainty assumes each one really was. The click value comes first: it is the one
// whose false tick most often leaves the real error outside the stated band.
export const HOMEWORK_TICKS = ['trackTested', 'zeroVerified', 'sightHeightMeasured', 'mvAverageChecked'];
export function homeworkTicked(homework) {
  return HOMEWORK_TICKS.filter((k) => homework && homework[k]);
}

// ---- targets ----
// Every target a session can shoot, keyed stably: a registered target by
// its Location id, a natural one (session-only) by its distance.
// `losAngleDeg` is the effective recorded angle -- the session override
// where "this session only" was chosen for a corrected value, the saved
// value otherwise.
export function sessionTargets({ location, targetOverrides = {}, naturalTargets = [] }) {
  const registered = location.targets.map((tg) => {
    const ov = targetOverrides[tg.id] || {};
    return {
      key: tg.id, name: tg.name || null, registered: true,
      rangeM: ov.rangeM ?? tg.rangeM,
      losAngleDeg: ov.losAngleDeg ?? tg.losAngleDeg ?? 0
    };
  });
  const natural = naturalTargets.map((nt) => ({ key: naturalKey(nt.rangeM), name: null, registered: false, rangeM: nt.rangeM, losAngleDeg: 0 }));
  return [...registered, ...natural];
}

export const naturalKey = (rangeM) => `natural:${rangeM}`;

export function targetForRange(targets, rangeM) {
  return targets.find((tg) => tg.rangeM === rangeM) || null;
}

// Each planned distance tied to its target by key, when the session starts, so a natural target at the same distance as a
// registered one is never mistaken for it.
export function withPlanKeys(plan, targets) {
  if (!plan) return plan;
  return { ...plan, keys: plan.ranges.map((r) => { const tg = targetForRange(targets, r); return tg ? tg.key : null; }) };
}

// The target a proposed distance stands for: a planned distance by its key (when the plan has keys), any other by its distance.
export function targetForStep(targets, plan, rangeM) {
  const i = plan && plan.keys ? plan.ranges.indexOf(rangeM) : -1;
  const keyed = i >= 0 && plan.keys[i] != null ? targets.find((tg) => tg.key === plan.keys[i]) : null;
  return keyed || targetForRange(targets, rangeM);
}

// The distance a target is shown at, and its next shot worked out for: the last reading a re-check took this session, else its
// own. Its strings stay recorded at the distance the session started with, and every re-check is held against that distance, so
// the fit keeps one anchor per target however often the target is re-measured.
export function measuredRangeM(session, targetKey, rangeM) {
  const m = session.measuredRanges && session.measuredRanges[targetKey];
  return m != null ? m : rangeM;
}

// ---- muzzle-velocity SD provenance ----
// null = a generic preset (no small-sample inflation); the Arsenal value
// and an unknown hand-typed one get the documented conservative 10; a
// hand-typed value with its shot count stated uses that count.
export function mvSdSampleSizeFrom(homework) {
  const key = homework.muzzleVelocitySDPreset;
  if (key === RIG_PRESET_KEY) return ASSUMED_MV_SD_SAMPLE_SIZE;
  if (key === CUSTOM_PRESET_KEY) return homework.mvSdShots > 1 ? homework.mvSdShots : ASSUMED_MV_SD_SAMPLE_SIZE;
  return null;
}

// The number of shots the recorded SD is stated to rest on: only a hand-typed SD with its shot count. A preset, the rig's value and a typed
// SD without a count are given without one.
export const statedMvSdShots = (homework) => (homework.muzzleVelocitySDPreset === CUSTOM_PRESET_KEY && homework.mvSdShots > 1 ? homework.mvSdShots : null);

// The muzzle-velocity spread this session works with. The recorded SD (Arsenal, a preset or a typed value, resting on `mvSdSampleSize`
// shots; an SD given without a shot count, a preset or a rig value included, counts as UNSTATED_MV_SD_WEIGHT shots) and the spread of today's readings are pooled by their degrees of freedom:
// sigma^2 = ((N0 - 1) sigma0^2 + (n - 1) s^2) / (N0 + n - 2), and the pooled figure counts as N0 + n - 1 shots, so the readings move the figure
// smoothly from the first two on, in proportion to how much they know, and nothing happens when the recorded SD is right. The readings are
// measured against the velocity the cartridge has in each group's own air, with their common offset removed, so a change of weather or a
// wrong average velocity does not inflate the spread. `override` is
// kept for the notice and the Arsenal offer: past 10 readings, when an F-test says today's SD really differs from the recorded one.
export function effectiveMvSd({ homework, state, groups }) {
  const recorded = { mvSD: homework.mvSD, mvSdSampleSize: mvSdSampleSizeFrom(homework), override: null };
  if (!homework.mvSD) return recorded;
  const values = [];
  for (const g of groups) {
    if (!g.chronoVelocities) continue;
    const expected = resolveMuzzleVelocity(withConditions(state, g.conditions));
    for (const v of g.chronoVelocities) if (v != null && Number.isFinite(v)) values.push(v - expected);
  }
  const n = values.length;
  if (n < 2) return recorded;
  const sessionSD = sampleSD(values);
  const n0 = statedMvSdShots(homework) ?? UNSTATED_MV_SD_WEIGHT;
  const mvSD = Math.sqrt(((n0 - 1) * homework.mvSD ** 2 + (n - 1) * sessionSD ** 2) / (n0 + n - 2));
  const test = sdDeviatesSignificantly({ sessionSD, nToday: n, assumedSD: homework.mvSD, assumedSampleSize: n0 });
  return {
    mvSD, mvSdSampleSize: n0 + n - 1,
    override: test.significant ? { sd: sessionSD, sampleSize: n, recordedSd: homework.mvSD, usedSd: mvSD } : null
  };
}

// ---- parameters and priors ----
// Every cause is fitted, a tested click value included: a tall-target/ruler test leaves it good to its prior (0.15 %), not
// exact, and a residual left out of the fit lands on the drag scale -- in a whole-session Monte Carlo it made the drag scale's
// 95 % band miss about a third of a point more often with a tested turret; fitted at its prior, the band misses 5.0 %.
export function sessionParams() {
  return [...BASE_PARAMS];
}
// The causes the conclusion reports on: a tested click value is fitted but not reported -- the session cannot add to what the
// test settled, and "click value not determined" would read as if the test had not been done.
export function reportedCauses(homework) {
  return homework.trackTested ? BASE_PARAMS.filter((k) => k !== 'trackPct') : [...BASE_PARAMS];
}

// The priors the actual fit uses (Shoot, Conclude). v0Ms is 20 m/s unless
// today's MV average was verified beforehand (the checked sigma below,
// over the shots of that check) -- and not even then once the session has
// captured `minReadings` chronograph readings of its own: those readings
// enter as their own observation row, with their own uncertainty, and the
// homework average, measured at another time, no longer competes with
// them. (A live chronograph never tightens the prior: the same evidence
// is never counted both as a tighter prior and as a live observation.)
export function sessionPriors(homework, { chronoReadings = 0, minReadings = MIN_CHRONO_READINGS_TRUSTED } = {}) {
  const trustSession = chronoReadings >= minReadings;
  const priors = {
    zeroMrad: homework.zeroVerified ? 0.08 : 0.25,
    v0Ms: homework.mvAverageChecked && homework.mvSD && !trustSession
      ? v0MsCheckedSigma({ mvSD: homework.mvSD, nToday: DEFAULT_MV_AVERAGE_SHOTS, mvSdSampleSize: mvSdSampleSizeFrom(homework) })
      : 20,
    dragPct: SIGMA_DRAG_PCT,
    trackPct: homework.trackTested ? 0.15 : 1
  };
  return priors;
}

// The priors for the fit of a running session: the checked-average prior gives way once the session's own chronograph readings suffice.
// A missed impact can widen the drag scale's prior, sized by what the miss says. The round left the backdrop, so the dope was
// off by more than half its height there; a drag error alone does that only if it is at least the half-height over the
// distance, divided by the come-up change of a 1 % drag change at that distance (on a 2 m backdrop, for a .308 at 792 m/s:
// 22 % at 800 m, 38 % at 700 m, 68 % at 600 m, 815 % at 300 m). The prior is widened until that error is two standard
// deviations away, and not at all when it would take more than TOTALLY_IMPLAUSIBLE_DRAG_PCT: no BC is that wrong, so such a
// miss was something else (a gust, a dial, an impact simply not seen), and widening would only cost precision. (The linear
// estimate is enough: solving the trajectory for the exact value changed no simulated outcome.) Kept at its usual width, the
// prior holds a fit with a grossly wrong BC back towards the published figure, and the retry misses again by nearly as much.
// The widened prior drives the ladder and the dope; Conclude fits on the usual one (see `widen`), since a miss that was only
// an impact not seen would otherwise cost the result a grade in sessions without a chronograph, and the 3-sigma rule
// (bcCorrectionOffer) already catches a grossly wrong BC there.
export const TOTALLY_IMPLAUSIBLE_DRAG_PCT = 50;
export function missWidenedDragSigma({ state, session, backdropMarginM, baseSigma = SIGMA_DRAG_PCT }) {
  const missed = new Set([...Object.keys((session && session.missesAt) || {}).map(Number), ...((session && session.missedRanges) || [])]);
  let sigma = baseSigma;
  for (const rangeM of missed) {
    const perPct = Math.abs(planningColumns(state, rangeM).dragPct);
    if (!(perPct > 0)) continue;
    const neededPct = radToMrad(linearToAngleAtRange(backdropMarginM, rangeM)) / perPct;
    if (neededPct <= TOTALLY_IMPLAUSIBLE_DRAG_PCT) sigma = Math.max(sigma, neededPct / 2);
  }
  return sigma;
}
export function livePriors(homework, session, { state = null, widen = true, minReadings = MIN_CHRONO_READINGS_TRUSTED } = {}) {
  const priors = sessionPriors(homework, { chronoReadings: chronoCount(session), minReadings });
  if (!widen || !state || !session || !(session.missedImpactCount > 0)) return priors;
  return { ...priors, dragPct: missWidenedDragSigma({ state, session, backdropMarginM: backdropMarginFrom(homework), baseSigma: priors.dragPct }) };
}

// Planning priors (Prepare, before any shot exists): the fit priors with
// the planned chronographed shots folded into v0Ms the same way the real
// chrono row will be (plannedV0Sigma), so a forecast and the eventual fit
// agree on what a chronograph is worth.
export function planningPriors(homework, { nShots, chronographed = !!homework.chronographAvailable } = {}) {
  const base = sessionPriors(homework, { chronoReadings: chronographed ? nShots : 0 });
  return {
    ...base,
    v0Ms: plannedV0Sigma({ priorSigma: base.v0Ms, chronographed, mvSD: homework.mvSD, nShots, mvSdSampleSize: mvSdSampleSizeFrom(homework) })
  };
}

// ---- the wind the plan is made for ----
// Before the shooting the wind is not known, only how windy it is expected to be at the location. Each expected strength stands for a
// typical speed and how well that is called (1-sigma of the speed's absolute value; the direction is unknown, so every direction alike).
// The boundary between the two is the speed the shooter is asked about, in the unit they read wind in.
export const WIND_STRENGTH_LIMIT_MS = 5;
export const WIND_STRENGTHS = { moderate: { expectedMs: 3, speedSigmaMs: 1 }, strong: { expectedMs: 7, speedSigmaMs: 2 } };
export const DEFAULT_WIND_STRENGTH = 'moderate';
export const windStrengthOf = (homework) => (homework && WIND_STRENGTHS[homework.windStrength] ? homework.windStrength : DEFAULT_WIND_STRENGTH);
export const planningWind = (homework) => ({ ...WIND_STRENGTHS[windStrengthOf(homework)], dirSigmaDeg: WIND_DIRECTION_SIGMA_DEG });
// the rifle's and the wind's share of every planning call
export const planningNoise = (homework) => ({ r50Mrad: homework.r50Mrad, mvSD: homework.mvSD, wind: planningWind(homework) });

export function backdropMarginFrom(homework) {
  return (homework.backdropHeightM ?? DEFAULT_BACKDROP_MARGIN_M * 2) / 2;
}

// The session plan: the distances the session visits, rungs included, and the shots at each, for a TOTAL of `roundBudget` rounds
// (planWholeSession in the engine). `overrides` are homework what-ifs for the advice list (a chronograph, a zero check): the
// priors follow the homework as it would then stand. `backdropMarginM` is the ladder's margin (Infinity: the plan
// without the safety constraint, to tell the user when the ladder cannot reach the distance the plan would like).
export function wholePlan({ state, availableDistances, homework, roundBudget, params, overrides = {}, backdropMarginM }) {
  const hw = { ...homework, ...overrides };
  return planWholeSession({
    state, availableDistances, roundBudget, priors: planningPriors(hw, { nShots: roundBudget }), r50Mrad: hw.r50Mrad, mvSD: hw.mvSD, wind: planningWind(hw), params,
    backdropMarginM: backdropMarginM ?? backdropMarginFrom(hw)
  });
}

// How many rounds? The plan's drag scale spread against the total number of rounds, read off the planner over a grid of budgets,
// and the "knee" of that curve: the budget where extra rounds start to pay much less (the point of the curve farthest below the
// straight line from the smallest budget's result to the largest's, over the normalised curve). Then what ten and twenty rounds more
// than the knee would buy. When the largest budget improves on the smallest by less than a tenth, rounds are not what limits the
// grade (the homework and the distances are) and there is no knee to report. These are minimum numbers: rounds are counted as
// shot and seen, and a round the spotter cannot see does not count. Costs a few dozen planner runs, all memoised: the panel asks
// for it after it has drawn.
// Steps of two where the knee usually falls, coarser beyond.
export const BUDGET_ADVICE_GRID = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 48, 60];
export const BUDGET_ADVICE_FLAT_BELOW = 0.1;
export const BUDGET_ADVICE_STEPS = [10, 20];
export function roundBudgetAdvice({ state, availableDistances, homework, params, backdropMarginM, currentBudget = null }) {
  const planAt = (roundBudget) => wholePlan({ state, availableDistances, homework, roundBudget, params, backdropMarginM });
  const describe = (roundBudget) => {
    const plan = planAt(roundBudget);
    if (!plan) return null;
    const far = plan.ranges[plan.ranges.length - 1];
    return {
      roundBudget, ranges: plan.ranges, shots: plan.shots, dragSd: plan.dragSd, grade: grade(plan.dragSd).letter,
      farDialSdMrad: predictiveComeUpSd({ state, cov: plan.cov, params: plan.params, rangeM: far }), farM: far
    };
  };
  const points = BUDGET_ADVICE_GRID.map((b) => planAt(b) && describe(b)).filter(Boolean);
  if (points.length < 4) return null;
  // The knee is looked for on the curve made non-increasing (each budget no worse than a smaller one): more rounds can always be
  // spent like the smaller plan's and more, so a budget whose own plan happens to come out a little worse is a planner artifact,
  // and a step like that must not drag the knee along.
  let best = Infinity;
  const smooth = points.map((pt) => { best = Math.min(best, pt.dragSd); return best; });
  const first = points[0], last = points[points.length - 1];
  const firstSd = smooth[0], lastSd = smooth[smooth.length - 1];
  const improvement = (firstSd - lastSd) / firstSd;
  const yours = currentBudget != null ? describe(currentBudget) : null;
  if (improvement < BUDGET_ADVICE_FLAT_BELOW) return { flat: true, atMost: last, yours, points };
  let knee = null;
  points.forEach((pt, i) => {
    const x = (pt.roundBudget - first.roundBudget) / (last.roundBudget - first.roundBudget);
    const y = (smooth[i] - lastSd) / (firstSd - lastSd);
    const depth = (1 - x) - y;
    if (!knee || depth > knee.depth) knee = { ...pt, depth };
  });
  const options = [knee.roundBudget, ...BUDGET_ADVICE_STEPS.map((n) => knee.roundBudget + n)].map((b, i) => {
    const d = i === 0 ? knee : describe(b);
    return d && { ...d, extra: i === 0 ? 0 : BUDGET_ADVICE_STEPS[i - 1], dragSdChange: (d.dragSd - knee.dragSd) / knee.dragSd };
  }).filter(Boolean);
  return { flat: false, knee: options[0], options, yours, points, tiers: budgetTiers({ points, knee, describe }) };
}

// The three numbers to offer: the fewest rounds whose drag scale spread is within BUDGET_MINIMAL_WITHIN of the optimum's, the knee
// (the optimum), the knee plus the smaller step (enhanced), and the knee plus the larger step (deluxe).
export const BUDGET_MINIMAL_WITHIN = 0.1;
function budgetTiers({ points, knee, describe }) {
  const minimal = points.find((pt) => pt.dragSd <= knee.dragSd * (1 + BUDGET_MINIMAL_WITHIN));
  const enhanced = describe(knee.roundBudget + BUDGET_ADVICE_STEPS[0]);
  const deluxe = describe(knee.roundBudget + BUDGET_ADVICE_STEPS[BUDGET_ADVICE_STEPS.length - 1]);
  const change = (d) => (d.dragSd - knee.dragSd) / knee.dragSd;
  return {
    minimal: { ...minimal, dragSdChange: change(minimal) },
    optimal: { ...knee, dragSdChange: 0 },
    enhanced: enhanced && { ...enhanced, dragSdChange: change(enhanced) },
    deluxe: deluxe && { ...deluxe, dragSdChange: change(deluxe) }
  };
}

// The rounds to start from when the shooter has not chosen a number: the optimum for this range and homework, or the fixed default
// where there is none to report (no usable distance, or rounds do not limit the result).
export const roundBudgetOrDefault = (advice) => (advice && !advice.flat ? advice.tiers.optimal.roundBudget : DEFAULT_ROUND_BUDGET);

// ---- strings: a distance's rounds, shot a few at a time ----
// A distance's planned rounds split into strings of at most MAX_STRING_SHOTS, as evenly as possible, the longer strings first:
// 12 -> 3 3 3 3, 7 -> 3 2 2, 4 -> 2 2.
export function splitIntoStrings(rounds) {
  if (!(rounds > 0)) return [];
  const count = Math.ceil(rounds / MAX_STRING_SHOTS);
  const base = Math.floor(rounds / count);
  return Array.from({ length: count }, (_, i) => base + (i < rounds % count ? 1 : 0));
}

// The rounds still to shoot at each planned distance: the plan's rounds there less the rounds recorded there (a round the spotter
// did not see does not count, and neither does an extra group shot only to unlock a retry).
export function roundsLeft(plan, session) {
  const left = new Map();
  (plan ? plan.ranges : []).forEach((r, i) => {
    const shot = session.groups.filter((g) => g.rangeM === r && !g.extra).reduce((sum, g) => sum + (g.shots || 0), 0);
    left.set(r, Math.max(0, (plan.shots[i] || 0) - shot));
  });
  return left;
}

// The rounds in the next string at a planned distance.
export const nextStringShots = (left) => splitIntoStrings(left)[0] ?? 0;

// Once every planned distance has been shot once, the next string goes to the distance with the most rounds left, the farther
// one on a tie; several strings in a row at one distance are fine. Distances at or beyond `ceilingM` (a missed distance) are out.
export function rotationNext(left, ceilingM = Infinity) {
  let best = null;
  for (const [r, n] of left) {
    if (n <= 0 || r >= ceilingM) continue;
    if (!best || n > best.left || (n === best.left && r > best.rangeM)) best = { rangeM: r, left: n };
  }
  return best ? best.rangeM : null;
}

// One round's sigma, and a string's, at `rangeM` in the given air: the rifle's r50, the muzzle-velocity spread through the
// come-up's sensitivity to velocity there, and the spotter's reading at `certaintyKey`.
export function shotNoise({ state, rangeM, knownLosDeg = 0, conditions = null, r50Mrad, mvSD, certaintyKey, windConfidenceKey }) {
  const shot = withConditions(state, conditions);
  return {
    r50Mrad, mvSD, v0SensMrad: sensitivityColumns(shot, rangeM, knownLosDeg).v0Ms, sigmaObsMrad: observationSigmaMrad(certaintyKey),
    // the come-up's error from this string's wind reading: the string is read in one wind, so it does not average down within it
    windSdMrad: windErrorMrad({ state: shot, rangeM, knownLosDeg, speedSigmaMs: windSigmaMsFor(windConfidenceKey) }).verticalMrad
  };
}
// the 1-sigma error of a wind reading at a confidence, as nextShotDope takes it
export const windSigmaFor = (windConfidenceKey) => ({ speedMs: windSigmaMsFor(windConfidenceKey), dirDeg: WIND_DIRECTION_SIGMA_DEG });
export const perShotSigma = (noise) => perShotSigmaMrad(noise);
export const stringSigma = (noise, shots) => sigmaForGroup({ shots, ...noise });

// A string read shot by shot: `comeUps` in the order fired, null for a round the spotter did not see. Returns how many rounds were seen and
// their mean. The tool does not look for flyers among them: an obvious one is shot again, not recorded.
export function readShots(comeUps) {
  const seen = comeUps.filter((x) => Number.isFinite(x));
  return { seen: seen.length, mean: seen.length ? seen.reduce((sum, x) => sum + x, 0) / seen.length : null };
}

// ---- observations ----
// Every group, tied to its target by a stable key, carries the target's
// recorded angle (a nonzero one is a measurement), then the flat
// declaration and any angle measured this session are applied on top
// (applyFlatRangeDeclaration/applyAngleCheck), then the chronograph row
// and every live range re-check row.
export function buildObservations({ state, session, targets, rangeDeclaredFlat, mvSD, mvSdSampleSize }) {
  let observations = session.groups.map((g) => {
    const key = g.targetKey;
    const tg = targets.find((t) => t.key === key);
    const recorded = tg && tg.losAngleDeg ? tg.losAngleDeg : 0;
    return {
      rangeM: g.rangeM, observedComeUp: g.observedComeUp, shots: g.shots,
      // a string that kept its SD-free noise parts is weighed with the session's current velocity spread (so a spread refined by later
      // readings also settles the strings shot before them); otherwise with the sigma it was recorded with
      sigmaMrad: g.noise && mvSD ? stringSigma({ ...g.noise, mvSD }, g.shots) : g.sigmaMrad,
      targetIndex: key, knownLosDeg: recorded,
      // the air and wind this group was shot in, when the group carries its own (see withConditions in the engine)
      ...(g.conditions ? { conditions: g.conditions } : {})
    };
  });
  if (rangeDeclaredFlat) observations = applyFlatRangeDeclaration(observations);
  for (const [key, deg] of Object.entries(session.angleChecks || {})) {
    if (deg != null) observations = applyAngleCheck(observations, key, deg);
  }
  // Chronograph readings observe the muzzle velocity directly, and the velocity depends on the powder temperature: each
  // group's readings are compared with the velocity the cartridge gives in THAT group's air.
  if (mvSD) {
    for (const g of session.groups) {
      if (!g.chronoVelocities || !g.chronoVelocities.length) continue;
      const row = chronoObservation({ state: withConditions(state, g.conditions), velocitiesMs: g.chronoVelocities, mvSD, mvSdSampleSize });
      if (row) observations.push(row);
    }
  }
  for (const rc of session.rangeChecks || []) {
    observations.push(rangeCheckObservation({ targetIndex: rc.targetKey, believedRangeM: rc.believedRangeM, newReadingM: rc.newReadingM }));
  }
  return observations;
}

// The chronograph readings actually captured this session, over every group.
export function chronoCount(session) {
  return session.groups.reduce((n, g) => n + (g.chronoVelocities || []).filter((v) => v != null && Number.isFinite(v)).length, 0);
}

// ---- the analysis Conclude (and, provisionally, the live panel) reports ----
function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// P(|contribution at R_max| > MATERIALITY_MRAD) for a Gaussian
// contribution with mean m and SD s.
export function pMaterial(m, s, threshold = MATERIALITY_MRAD) {
  if (!(s > 0)) return Math.abs(m) > threshold ? 1 : 0;
  return normalCdf((-threshold - m) / s) + 1 - normalCdf((threshold - m) / s);
}

// R_max: the user's own maximum working range, taken as the farthest
// supersonic distance at the active location, or the farthest range
// actually shot if that is farther.
export function workingRangeMax({ state, targets, session }) {
  const ceiling = rangeAtMach(state, SUPERSONIC_MACH);
  const usable = targets.map((t) => t.rangeM).filter((r) => r <= ceiling);
  const shot = session.groups.map((g) => g.rangeM);
  return Math.max(state.zeroRange || 0, ...usable, ...shot, 0) || ceiling;
}

// Runs the joint blunder check and reports from its blunder-aware
// combined fit -- flagging a
// target as a likely blunder does not, by itself, fix the reported
// numbers, so every value here comes from the blunder-aware fit, never
// from a plain fit that ignores per-target blunders.
// ---- whether the ticked homework held ----
// A tick is taken at its word, mostly: the verified prior is the likelier explanation (HOMEWORK_TRUST), but the analysis also weighs
// "it was not really done" (the unverified prior), so shots that contradict a tick widen the result instead of being forced into
// the other causes. Only for the zero and the velocity average: the session's shots say too little about the click value to be worth
// the cost (every axis doubles the analysis). The velocity average only while the session's own chronograph does not yet decide it.
export const HOMEWORK_TRUST = 0.9;
// A target is flagged, and its re-check asked for, once its distance or angle is this likely to be wrong: a re-range is cheap, and a
// mis-ranged target is what the shots can least tell from a wrong drag scale (simulated: asking at 50 % almost never fired; at 20 %
// it costs about one request in ten sessions and improves the dope and the drag estimate).
export const RECHECK_PROMPT_DOUBT = 0.2;
// The doubt above which the Conclude screen says the shots do not bear the tick out.
export const HOMEWORK_DOUBT_SHOWN = 0.5;
export function homeworkCheckAxes(homework, priors) {
  const unverified = sessionPriors({ r50Mrad: homework.r50Mrad, mvSD: homework.mvSD });
  const weights = [HOMEWORK_TRUST, 1 - HOMEWORK_TRUST];
  const axes = [];
  if (homework.zeroVerified && priors.zeroMrad < unverified.zeroMrad) axes.push({ kind: 'param', key: 'zeroMrad', sigmas: [priors.zeroMrad, unverified.zeroMrad], weights });
  if (homework.mvAverageChecked && priors.v0Ms < unverified.v0Ms) axes.push({ kind: 'param', key: 'v0Ms', sigmas: [priors.v0Ms, unverified.v0Ms], weights });
  return axes;
}

export function analyseSession({ state, observations, priors, params, rechecked = false, rMax, clickMrad = 0.1, chronoN = 0, targets = [], plan = null, triedRanges = [], missedRanges = [], warm = null, extraAxes = [], causes = params }) {
  const targetKeys = [...new Set(observations.filter((o) => o.rangeM != null && o.targetIndex != null).map((o) => o.targetIndex))];
  const joint = jointBlunderCheck({ state, observations, priors, params, targetIndices: targetKeys, rechecked, warmIn: warm, extraAxes });
  const { theta, cov, sd } = joint;
  const { Rtilde } = resolutionMatrix({ cov, priors, params });
  // "Now" is the latest group's air and wind, when groups carry their own.
  const latest = [...observations].reverse().find((o) => o.conditions);
  const nowState = latest ? withConditions(state, latest.conditions) : state;
  const applied = applyParameters(nowState, theta);
  const J = sensitivityColumns(applied, rMax);
  const idx = (k) => params.indexOf(k);
  // (`causes`: the parameters reported on, a subset of the fitted `params`)
  const groups = degenerateGroups(cov, params, DEGENERACY_R, causes);
  const inGroup = new Set(groups.flat());
  const findings = [];
  const notMaterial = [];
  // Causes the session did not determine and whose fitted effect is small: not "nothing material", just not measured.
  const notDetermined = [];

  for (const members of groups) {
    const m = members.reduce((s, k) => s + J[k] * theta[k], 0);
    let variance = 0;
    for (const a of members) for (const b of members) variance += J[a] * J[b] * cov[idx(a)][idx(b)];
    const s = Math.sqrt(Math.max(variance, 0));
    const corr = members.length === 2 ? correlationOf(cov, params, members[0], members[1]) : null;
    findings.push({
      case: 6, members, pMaterial: pMaterial(m, s), valueMrad: m, sizeMrad: 1.96 * s, corr,
      action: members.includes('v0Ms') && members.includes('dragPct') ? 'chronograph' : 'separate'
    });
  }

  const g = grade(sd.dragPct);
  let bcWritable = false;
  for (const k of causes) {
    if (inGroup.has(k)) continue;
    const i = idx(k);
    const pm = pMaterial(J[k] * theta[k], Math.abs(J[k]) * sd[k]);
    const resolution = Rtilde[i][i];
    const base = { param: k, pMaterial: pm, value: theta[k], size: 1.96 * sd[k], resolution };
    if (resolution < RESOLUTION_FLOOR) {
      if (pm > 0.5) findings.push({ case: 8, reason: 'underdetermined', ...base });
      else notDetermined.push(k);
      continue;
    }
    if (pm <= 0.5) { notMaterial.push(k); continue; }
    if (k === 'zeroMrad' && pm < ZERO_FINDING_MIN_P) {
      findings.push({ case: 8, reason: 'possible', ...base });
      continue;
    }
    if (k === 'dragPct') {
      if (bcOfferable(g.letter, chronoN)) {
        bcWritable = true;
        findings.push({ case: 3, grade: g.letter, ...base });
      } else {
        findings.push({ case: 8, reason: chronoN >= MIN_CHRONO_READINGS_FOR_BC ? 'grade' : 'noChrono', grade: g.letter, ...base });
      }
    } else if (k === 'zeroMrad') {
      findings.push({ case: 4, clicks: theta.zeroMrad / clickMrad, ...base });
    } else if (k === 'trackPct') {
      findings.push({ case: 5, ...base });
    } else if (k === 'v0Ms') {
      // Only chronograph readings make a v0 finding a measurement -- a
      // measured input correction, reported as its own item rather than
      // folded into any of the other named cases. Without readings,
      // whatever the come-ups say about v0 is fitted, not measured (truing
      // v0 without a chronograph invents a number and moves the error
      // somewhere else), and is reported as not determined instead.
      findings.push(chronoN > 0 ? { case: 'measuredV0', ...base } : { case: 8, reason: 'underdetermined', ...base });
    }
  }

  // Real but sub-DEGENERACY_R overlap between two reported causes, worth
  // a note even though it stops short of the fully-degenerate joint case.
  const reported = causes.filter((k) => !inGroup.has(k));
  for (let a = 0; a < reported.length; a++) {
    for (let b = a + 1; b < reported.length; b++) {
      const r = correlationOf(cov, params, reported[a], reported[b]);
      if (Math.abs(r) > PARTIAL_OVERLAP_R && Math.abs(r) <= DEGENERACY_R) {
        findings.push({ case: 8, reason: 'overlap', members: [reported[a], reported[b]], corr: r, pMaterial: 0 });
      }
    }
  }

  // Case 2: whenever no BC correction is offered, the session still hands
  // over a come-up correction for exactly the ranges shot -- the fitted
  // shared parameters' prediction minus the app's current one.
  if (!bcWritable) {
    const ranges = [...new Set(observations.filter((o) => o.rangeM != null).map((o) => o.rangeM))].sort((a, b) => a - b);
    const corrections = ranges.map((r) => {
      // The correction's own uncertainty: the fit's covariance propagated through the sensitivity columns at this range.
      const Jr = sensitivityColumns(applied, r);
      let variance = 0;
      for (let i = 0; i < params.length; i++) for (let j = 0; j < params.length; j++) variance += Jr[params[i]] * Jr[params[j]] * cov[i][j];
      return { rangeM: r, deltaMrad: predictedComeUp(applied, r, theta, {}) - comeUpMrad(nowState, r), sdMrad: Math.sqrt(Math.max(variance, 0)) };
    });
    if (corrections.some((c) => Math.abs(c.deltaMrad) >= DIAL_TABLE_MIN_MRAD && Math.abs(c.deltaMrad) >= DIAL_TABLE_MIN_SD_MULTIPLE * c.sdMrad)) {
      findings.push({ case: 2, grade: g.letter, corrections, pMaterial: 0 });
    }
  }

  // Case 7: flagged on the summed "something went wrong here" weight --
  // range error and inclination are exactly degenerate for one group.
  for (const key of targetKeys) {
    const p = joint.marginalSomethingWrong[key] ?? 0;
    if (p <= RECHECK_PROMPT_DOUBT) continue;
    const o = observations.find((ob) => ob.targetIndex === key && ob.rangeM != null);
    const tg = targets.find((t) => t.key === key);
    const slopePossible = joint.losTargets.includes(key);
    findings.push({
      case: 7, targetKey: key, rangeM: tg ? tg.rangeM : o.rangeM, name: tg ? tg.name : null, pMaterial: p, pSomethingWrong: p,
      pInclined: slopePossible ? (joint.marginalInclined[key] ?? 0) : 0,
      inclinationDeg: slopePossible ? (joint.inclinationDeg[key] ?? 0) : null,
      slopePossible, exact: joint.exactlyResolved.includes(key)
    });
  }

  findings.sort((a, b) => (b.pMaterial ?? 0) - (a.pMaterial ?? 0));
  // Case 2's dial list is the fallback deliverable, not a ranked cause.
  const ranked = [...findings.filter((f) => f.case !== 2), ...findings.filter((f) => f.case === 2)];

  const planFar = plan && plan.ranges && plan.ranges.length ? Math.max(...plan.ranges) : null;
  const farthestShot = observations.filter((o) => o.rangeM != null).reduce((m, o) => Math.max(m, o.rangeM), 0);
  const plannedFarReached = planFar == null || (farthestShot >= planFar && !missedRanges.includes(planFar));

  return {
    joint, warm: joint.warm, theta, cov, sd, params, Rtilde, grade: g, findings: ranked, notMaterial, notDetermined, homeworkDoubt: joint.extraDoubt,
    nothingMaterial: ranked.length === 0,
    plannedFarReached, planFar, farthestShot, triedRanges
  };
}

// The resolved-drag-correction numbers: the compounded gain factor, and
// what it means for this bullet -- an effective BC for a BC-profile
// bullet, a percentage of Cd-table drag otherwise.
// A drag scale this many prior SDs from the BC in use is taken as an input error (a wrong BC or drag model), not a correction:
// the prior holds a fit that far out back towards the published BC, so the number is too small and its band too narrow (with
// a BC 25 % off it was offered for saving at two-thirds of the truth). It is shown for information, never offered for saving.
export const IMPLAUSIBLE_DRAG_SIGMAS = 3;
export function bcCorrectionOffer({ state, dragPct }) {
  const oldFactor = state.bcGainFactor ?? 1;
  const newFactor = oldFactor / (1 + percentToFraction(dragPct));
  const inHardBounds = newFactor >= 0.8 && newFactor <= 1.2;
  const implausible = !inHardBounds || Math.abs(dragPct) > IMPLAUSIBLE_DRAG_SIGMAS * SIGMA_DRAG_PCT;
  const inTypicalBand = newFactor >= 0.9 && newFactor <= 1.1;
  const isCdTable = !!state.cdTable;
  return {
    oldFactor, newFactor, inHardBounds, implausible, inTypicalBand, isCdTable,
    dragModel: state.dragModel,
    oldEffectiveBc: isCdTable ? null : state.bc * oldFactor,
    newEffectiveBc: isCdTable ? null : state.bc * newFactor,
    dragChangePct: fractionToPercent(1 / newFactor - 1)
  };
}


// What to dial for the next shot, from a finished analysis: the engine's nextShotDope with the analysis's own fit
// (parameters, covariance) and the air and wind of that shot. `windSigma` is how well the wind is known ({ speedMs, dirDeg }, see nextShotDope).
export function nextShotFromAnalysis({ state, analysis, rangeM, conditions = null, knownLosDeg = 0, windSigma = null }) {
  return nextShotDope({ state, conditions, theta: analysis.theta, cov: analysis.cov, params: analysis.params, rangeM, knownLosDeg, windSigma });
}
