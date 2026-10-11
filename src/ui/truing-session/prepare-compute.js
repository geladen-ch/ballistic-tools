// Every number the Prepare screen shows, worked out in one go and returned as plain data: the best distances, the range grading
// with its tables and advice, the round-budget advice and the gaps the location intake asks about. No DOM, no i18n: it runs in
// the planning worker (src/workers/ballistics-worker.js), so the screen stays responsive while it plans, and the panels in
// range-grading.js draw from what it returns. Numbers only -- every text is put together where it is drawn.
import {
  rangeAtMach, grade, planPosterior, requiredFarDistance, invalidityFloor, SUPERSONIC_MACH, PLAN_NEAR_BAND_M
} from '../../engine/truing-session.js';
import {
  bcOfferable, planningPriors, planningNoise, sessionParams, wholePlan, roundBudgetAdvice, roundBudgetOrDefault, backdropMarginFrom,
  DEFAULT_NEAR_SHOTS, DEFAULT_FAR_SHOTS
} from './session-model.js';

export const ALTITUDE_EXAMPLE = { altitudeM: 1500, pressureHpa: 850, tempC: 15 };
// the near-target band the intake asks for natural targets in (the planner's own near band)
export const NEAR_BAND_HIGH_M = PLAN_NEAR_BAND_M;

// `availableDistances`: every effective distance this session could use (saved targets with this session's overrides, plus natural
// ones); `registeredDistances`: the saved targets' alone. `roundBudget`: the shooter's own number, or null for the optimum.
export function computePrepare({ state, homework, availableDistances, registeredDistances, roundBudget = null }) {
  const ceiling = rangeAtMach(state, SUPERSONIC_MACH);
  const noise = planningNoise(homework);
  const params = sessionParams(homework);

  // ---- the best distances, planned with the representative 4-and-8 split ----
  const repPriors = planningPriors(homework, { nShots: DEFAULT_NEAR_SHOTS + DEFAULT_FAR_SHOTS });
  const optimum = rangeAtMach(state, 1.15);
  const common = { state, priors: repPriors, nearM: state.zeroRange, nearShots: DEFAULT_NEAR_SHOTS, farShots: DEFAULT_FAR_SHOTS, ...noise };
  const bandLow = requiredFarDistance({ ...common, targetSdPct: 2 }) ?? requiredFarDistance({ ...common, targetSdPct: 3 });
  const altCeiling = rangeAtMach({ ...state, ...ALTITUDE_EXAMPLE }, SUPERSONIC_MACH);
  const floor = invalidityFloor({ state, priors: repPriors, nearM: state.zeroRange, nearShots: DEFAULT_NEAR_SHOTS, ...noise });

  // ---- how many rounds: the shooter's own number, else the optimum (a few dozen planner runs, memoised) ----
  const usable = availableDistances.filter((d) => d <= ceiling);
  let advice = null;
  if (usable.length) {
    try { advice = roundBudgetAdvice({ state, availableDistances: usable, homework, params, backdropMarginM: backdropMarginFrom(homework), currentBudget: roundBudget || null }); } catch (e) { advice = null; }
  }
  const budget = roundBudget || roundBudgetOrDefault(advice);

  // ---- the gaps the location intake asks natural targets for ----
  const savedPlan = wholePlan({ state, availableDistances: registeredDistances, homework, roundBudget: budget, params });
  const farLow = bandLow ?? optimum * 0.9;
  const gaps = {
    nearGap: !availableDistances.some((d) => d >= state.zeroRange && d <= NEAR_BAND_HIGH_M),
    farGap: !availableDistances.some((d) => d >= farLow && d <= ceiling),
    alreadyGradeA: !!savedPlan && grade(savedPlan.dragSd).letter === 'A',
    zeroRangeM: state.zeroRange, farOptimumM: optimum, farBandLowM: bandLow, farBandHighM: ceiling
  };

  return {
    ceiling,
    optimal: { optimum, bandLow, altCeiling, floor },
    advice, roundBudget: budget, isDefault: !roundBudget,
    gaps,
    grading: gradingData({ state, homework, availableDistances, usable, ceiling, roundBudget: budget, params, noise })
  };
}

// Can this range do the job: the plan, the comparative tables, the advice list and the safety steps, as numbers.
function gradingData({ state, homework, availableDistances, usable, ceiling, roundBudget, params, noise }) {
  const excluded = [...new Set(availableDistances.filter((d) => d > ceiling))].sort((a, b) => a - b);
  if (usable.length === 0) return { excluded, noUsable: true };
  const plan = (budget, overrides = {}, p = params) => wholePlan({ state, availableDistances: usable, homework, roundBudget: budget, params: p, overrides });
  const current = plan(roundBudget);
  if (!current) return { excluded, budgetTooSmall: true, roundBudget };

  const nearM = current.ranges[0];
  const nearShots = current.shots[0];
  const farM = current.ranges[current.ranges.length - 1];
  const farShots = current.shots[current.shots.length - 1];
  const priorsFor = (nShots) => planningPriors(homework, { nShots });

  // what the far target buys at a few Mach points, with the same near group
  const machPriors = priorsFor(nearShots + farShots);
  const machRows = [];
  for (const mach of [1.4, 1.3, 1.2, 1.1]) {
    const far = rangeAtMach(state, mach);
    if (far <= nearM) continue;
    machRows.push({ mach, far, dragSd: planPosterior({ state, ranges: [nearM, far], shots: [nearShots, farShots], priors: machPriors, ...noise, params }).dragSd });
  }
  // rounds against a chronograph, at the plan's own far target
  const roundsRows = [[12, false], [30, false], [12, true], [30, true]].map(([rounds, withChrono]) => {
    const far = Math.max(3, rounds - nearShots);
    return {
      rounds, withChrono,
      dragSd: planPosterior({ state, ranges: [nearM, farM], shots: [nearShots, far], params, ...noise, priors: planningPriors(homework, { nShots: nearShots + far, chronographed: withChrono }) }).dragSd
    };
  });

  // Every piece of advice is one re-run, both numbers kept. The spread quoted is the better of a plan made afresh and the plan as it
  // stands under the new circumstances (its extra rounds, if any, at the far target): better priors can never hurt the plan one
  // already has, and a fresh plan can come out worse on the drag scale alone, because the planner also weighs the other causes --
  // which would make "do this" advice read as "do this and get worse".
  const whatIf = (budget, overrides = {}, p = params) => {
    const fresh = plan(budget, overrides, p);
    if (!fresh) return null;
    const changed = { ...homework, ...overrides };
    const shots = current.shots.map((n, i) => (i === current.shots.length - 1 ? n + (budget - roundBudget) : n));
    const kept = planPosterior({ state, ranges: current.ranges, shots, priors: planningPriors(changed, { nShots: budget }), ...planningNoise(changed), params: p });
    return Math.min(fresh.dragSd, kept.dragSd);
  };
  const advice = [];
  const addPlanAdvice = (key, to, vars = {}) => { if (to != null) advice.push({ kind: 'plan', key, vars, to }); };
  if (!homework.chronographAvailable) addPlanAdvice('chronograph', whatIf(roundBudget, { chronographAvailable: true }));
  addPlanAdvice('moreRounds', whatIf(roundBudget + 6), { n: 6 });
  // (the plan takes the fewest rounds at the nearest distance; the zero and the drag scale are told apart by the distances beyond it)
  if (!homework.zeroVerified) addPlanAdvice('verifyZero', whatIf(roundBudget, { zeroVerified: true }));
  if (!homework.trackTested) addPlanAdvice('tallTarget', whatIf(roundBudget, { trackTested: true }));
  const farPriors = priorsFor(nearShots + farShots);
  const neededA = requiredFarDistance({ state, priors: farPriors, nearM, nearShots, farShots, targetSdPct: 2, ...noise });
  const neededB = requiredFarDistance({ state, priors: farPriors, nearM, nearShots, farShots, targetSdPct: 3, ...noise });
  if (neededA && neededA > farM) advice.push({ kind: 'targetAtX', x: neededA, grade: 'A' });
  else if (neededB && neededB > farM) advice.push({ kind: 'targetAtX', x: neededB, grade: 'B' });

  // The safety steps are inside the budget; when the plan without the ladder's safety limit would like a farther target than the
  // ladder can safely reach with the distances available, that is said.
  const rungs = current.ranges.filter((r) => !(current.targets || current.ranges).includes(r));
  const usableFar = Math.max(...usable);
  const ideal = usableFar > farM ? wholePlan({ state, availableDistances: usable, homework, roundBudget, params, backdropMarginM: Infinity }) : null;
  const idealFar = ideal ? Math.max(...ideal.ranges) : null;

  return {
    excluded, roundBudget,
    current: {
      ranges: current.ranges, shots: current.shots, targets: current.targets, dragSd: current.dragSd, zeroDragCorr: current.zeroDragCorr,
      // every planned round chronographed when there is a chronograph, as the plan's own priors assume
      bcOffered: bcOfferable(grade(current.dragSd).letter, homework.chronographAvailable ? current.shots.reduce((a, b) => a + b, 0) : 0)
    },
    machRows, roundsRows, advice, rungs, farM, idealFar: idealFar != null && idealFar > farM ? idealFar : null
  };
}
