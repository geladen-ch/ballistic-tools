// The optimal range readout (the near/far target band, the altitude
// example, the invalidity floor), the range-grading panel (can this range
// do the job?), the comparative-distance and rounds-vs-chronograph tables,
// and the advice list underneath them. Every number is a live
// planner/posterior re-run against the current rifle, cartridge, rifle
// precision and priors -- never a hardcoded figure. Planning always
// assumes the near target is read unresolved, the same conservative
// default Shoot itself uses.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import {
  rangeAtMach, grade, planPosterior, requiredFarDistance, invalidityFloor,
  DEFAULT_LADDER_MAX_JUMP_FACTOR, SUPERSONIC_MACH
} from '../../engine/truing-session.js';
import {
  planningPriors, sessionParams, wholePlan, roundBudgetAdvice, backdropMarginFrom,
  DEFAULT_NEAR_SHOTS, DEFAULT_FAR_SHOTS
} from './session-model.js';
import { dist, distList, altitude, temperature, pressure, windSpeedShort, angle } from './units.js';

const UNRESOLVED = { resolved: false };
const WIND_STEPS = [0.5, 1, 2, 3, 5];
const ALTITUDE_EXAMPLE = { altitudeM: 1500, pressureHpa: 850, tempC: 15 };

const pct = (sd) => `±${sd.toFixed(2)}%`;
const m = (x) => Math.round(x);

// The optimal-range readout, planned with the representative 4-and-8 split.
export function optimalRangePanel({ state, homework }) {
  const node = el('div', { class: 'input-section' });
  const r50Mrad = homework.r50Mrad;
  const priors = planningPriors(homework, { nShots: DEFAULT_NEAR_SHOTS + DEFAULT_FAR_SHOTS });
  const ceiling = rangeAtMach(state, SUPERSONIC_MACH);
  const optimum = rangeAtMach(state, 1.15);
  const common = { state, priors, nearM: state.zeroRange, nearShots: DEFAULT_NEAR_SHOTS, nearOpts: UNRESOLVED, farShots: DEFAULT_FAR_SHOTS, r50Mrad };
  const bandLow = requiredFarDistance({ ...common, targetSdPct: 2 }) ?? requiredFarDistance({ ...common, targetSdPct: 3 });

  node.appendChild(el('h3', { i18n: 'truingSession.prepare.optimalHeading' }));
  node.appendChild(el('p', { text: t('truingSession.prepare.nearLine', { zero: dist(state.zeroRange), limit: dist(300) }) }));
  node.appendChild(el('p', {
    text: bandLow != null && bandLow < optimum
      ? t('truingSession.prepare.farLine', { optimum: dist(optimum), low: dist(bandLow), high: dist(ceiling) })
      : t('truingSession.prepare.farLineNoBand', { optimum: dist(optimum), high: dist(ceiling) })
  }));

  const altState = { ...state, ...ALTITUDE_EXAMPLE };
  const altCeiling = rangeAtMach(altState, SUPERSONIC_MACH);
  if (altCeiling > ceiling * 1.02) {
    node.appendChild(el('p', { class: 'hint', text: t('truingSession.prepare.altitudeLine', {
      from: dist(ceiling), to: dist(altCeiling), pct: m((altCeiling / ceiling - 1) * 100),
      alt: altitude(ALTITUDE_EXAMPLE.altitudeM), air: `${pressure(ALTITUDE_EXAMPLE.pressureHpa)}, ${temperature(ALTITUDE_EXAMPLE.tempC)}`
    }) }));
  }

  const floor = invalidityFloor({ state, priors, nearM: state.zeroRange, nearShots: DEFAULT_NEAR_SHOTS, nearOpts: UNRESOLVED, r50Mrad });
  node.appendChild(el('p', {
    class: 'hint',
    text: floor != null ? t('truingSession.prepare.invalidityLine', { floor: dist(floor) }) : t('truingSession.prepare.invalidityNone')
  }));
  return { node };
}

// `availableDistances`: every effective distance this session could use --
// saved targets with this session's overrides, plus natural ones.
export function rangeGradingPanel({ state, homework, availableDistances, roundBudget }) {
  const node = el('div', { class: 'input-section' });
  const r50Mrad = homework.r50Mrad;
  const params = sessionParams(homework);
  const priorsFor = (nShots, overrides = {}) => planningPriors({ ...homework, ...overrides }, { nShots });
  const plan = (budget, overrides = {}, p = params) => wholePlan({ state, availableDistances: usable, homework, roundBudget: budget, params: p, overrides });
  const ceiling = rangeAtMach(state, SUPERSONIC_MACH);
  const usable = availableDistances.filter((d) => d <= ceiling);
  const excluded = [...new Set(availableDistances.filter((d) => d > ceiling))].sort((a, b) => a - b);

  node.appendChild(el('h3', { i18n: 'truingSession.rangeGrading.heading' }));
  if (excluded.length) {
    node.appendChild(el('p', { class: 'hint', text: t('truingSession.rangeGrading.excludedSubsonic', { ranges: distList(excluded), ceiling: dist(ceiling) }) }));
  }
  if (usable.length === 0) {
    node.appendChild(el('p', { class: 'hint warning', text: t('truingSession.rangeGrading.noUsableDistance', { ceiling: dist(ceiling) }) }));
    return { node, plan: null };
  }

  const current = plan(roundBudget);
  if (!current) {
    node.appendChild(el('p', { class: 'hint warning', text: t('truingSession.rangeGrading.budgetTooSmall', { n: roundBudget }) }));
    return { node, plan: null };
  }
  const g = grade(current.dragSd);
  node.appendChild(el('p', {
    text: t('truingSession.rangeGrading.gradeLine', { letter: g.letter, ranges: distList(current.ranges, ' / '), shots: current.shots.join(' / '), sd: pct(current.dragSd) })
  }));
  node.appendChild(el('p', { class: 'hint', text: t(`truingSession.rangeGrading.grade${g.letter}`) }));
  node.appendChild(el('p', { class: 'hint', text: t('truingSession.rangeGrading.zeroDragOverlap', { corr: current.zeroDragCorr.toFixed(2) }) }));
  if (!homework.chronographAvailable) node.appendChild(el('p', { class: 'hint warning', i18n: 'truingSession.rangeGrading.noChronoWarning' }));

  const nearM = current.ranges[0];
  const nearShots = current.shots[0];
  const farM = current.ranges[current.ranges.length - 1];
  const farShots = current.shots[current.shots.length - 1];

  // The comparative-distance table: what the far target buys at a few Mach points, same near group.
  const table = el('table', { class: 'truing-session-table' });
  table.appendChild(el('tr', {}, [
    el('th', { i18n: 'truingSession.rangeGrading.machColumn' }),
    el('th', { i18n: 'truingSession.rangeGrading.distanceColumn' }),
    el('th', { i18n: 'truingSession.rangeGrading.dragSdColumn' })
  ]));
  const machPriors = priorsFor(nearShots + farShots);
  for (const mach of [1.4, 1.3, 1.2, 1.1]) {
    const far = rangeAtMach(state, mach);
    if (far <= nearM) continue;
    const sd = planPosterior({ state, ranges: [nearM, far], shots: [nearShots, farShots], priors: machPriors, r50Mrad, params }).dragSd;
    table.appendChild(el('tr', {}, [el('td', { text: `Mach ${mach}` }), el('td', { text: dist(far) }), el('td', { text: pct(sd) })]));
  }
  node.appendChild(table);

  // The rounds-vs-chronograph table, at the plan's own far target.
  const roundsTable = el('table', { class: 'truing-session-table' });
  roundsTable.appendChild(el('tr', {}, [
    el('th', { i18n: 'truingSession.rangeGrading.changeColumn' }),
    el('th', { i18n: 'truingSession.rangeGrading.dragSdColumn' })
  ]));
  for (const [rounds, withChrono] of [[12, false], [30, false], [12, true], [30, true]]) {
    const far = Math.max(3, rounds - nearShots);
    const sd = planPosterior({
      state, ranges: [nearM, farM], shots: [nearShots, far], params, r50Mrad,
      priors: planningPriors(homework, { nShots: nearShots + far, chronographed: withChrono })
    }).dragSd;
    roundsTable.appendChild(el('tr', {}, [
      el('td', { text: t(withChrono ? 'truingSession.rangeGrading.roundsWithChrono' : 'truingSession.rangeGrading.roundsNoChrono', { n: rounds }) }),
      el('td', { text: pct(sd) })
    ]));
  }
  node.appendChild(roundsTable);
  node.appendChild(el('p', { class: 'hint', i18n: 'truingSession.rangeGrading.chronoLeverHint' }));

  // Every piece of advice below is one re-run, both numbers shown.
  const advice = [];
  const addPlanAdvice = (key, alt, vars = {}) => {
    if (!alt) return;
    advice.push(t(`truingSession.advice.${key}`, { ...vars, from: pct(current.dragSd), to: pct(alt.dragSd) }));
  };
  if (!homework.chronographAvailable) addPlanAdvice('chronograph', plan(roundBudget, { chronographAvailable: true }));
  addPlanAdvice('moreRounds', plan(roundBudget + 6), { n: 6 });
  // (The plan takes one shot at the near group: its reading is a glance, so more shots there sharpen nothing; the zero and the
  // drag scale are told apart by the middle distance the plan chooses.)
  if (!homework.zeroVerified) addPlanAdvice('verifyZero', plan(roundBudget, { zeroVerified: true }));
  if (!homework.trackTested) addPlanAdvice('tallTarget', plan(roundBudget, { trackTested: true }, sessionParams({ ...homework, trackTested: true })));
  const windNow = homework.windConfidenceMs ?? 2;
  const windBetter = WIND_STEPS.filter((w) => w < windNow).pop();
  if (windBetter != null) addPlanAdvice('wind', plan(roundBudget, { windConfidenceMs: windBetter }), { wind: windSpeedShort(windBetter) });
  const neededA = requiredFarDistance({ state, priors: priorsFor(nearShots + farShots), nearM, nearShots, nearOpts: UNRESOLVED, farShots, targetSdPct: 2, r50Mrad });
  const neededB = requiredFarDistance({ state, priors: priorsFor(nearShots + farShots), nearM, nearShots, nearOpts: UNRESOLVED, farShots, targetSdPct: 3, r50Mrad });
  if (neededA && neededA > farM) advice.push(t('truingSession.rangeGrading.targetAtXHelps', { x: dist(neededA), grade: 'A' }));
  else if (neededB && neededB > farM) advice.push(t('truingSession.rangeGrading.targetAtXHelps', { x: dist(neededB), grade: 'B' }));
  if (advice.length) {
    node.appendChild(el('h4', { i18n: 'truingSession.advice.heading' }));
    node.appendChild(el('ul', {}, advice.map((a) => el('li', { text: a }))));
  }

  // The safety steps: the plan already includes the intermediate distances the shot ladder needs on the way to the far target, inside
  // the round budget. When the plan without the ladder's safety limit would like a farther target than the ladder can safely reach with
  // the distances available, say so.
  const rungs = current.ranges.filter((r) => !(current.targets || current.ranges).includes(r));
  const usableFar = Math.max(...usable);
  const ideal = usableFar > farM ? wholePlan({ state, availableDistances: usable, homework, roundBudget, params, backdropMarginM: Infinity }) : null;
  const idealFar = ideal ? Math.max(...ideal.ranges) : null;
  if (idealFar != null && idealFar > farM) {
    node.appendChild(el('p', { class: 'hint warning', text: t('truingSession.rangeGrading.walkOutGap', { far: dist(idealFar), last: dist(farM), max: dist(farM * DEFAULT_LADDER_MAX_JUMP_FACTOR) }) }));
  } else {
    node.appendChild(el('p', {
      class: 'hint',
      text: rungs.length
        ? t('truingSession.rangeGrading.walkOut', { steps: rungs.length, ranges: distList(rungs), planned: roundBudget })
        : t('truingSession.rangeGrading.walkOutNone')
    }));
  }

  // How many rounds: where extra rounds start to pay much less, and what ten and twenty more would buy. Drawn after the rest (it
  // runs the planner over a grid of budgets, all memoised); minimum numbers, they do not count rounds the spotter cannot see.
  const budgetNode = el('div', { class: 'truing-session-budget-advice' });
  node.appendChild(budgetNode);
  setTimeout(() => {
    let advice = null;
    try { advice = roundBudgetAdvice({ state, availableDistances: usable, homework, params, backdropMarginM: backdropMarginFrom(homework), currentBudget: roundBudget }); } catch (e) { advice = null; }
    if (!advice) return;
    budgetNode.appendChild(el('h4', { i18n: 'truingSession.rangeGrading.budgetHeading' }));
    if (advice.flat) {
      budgetNode.appendChild(el('p', { class: 'hint', text: t('truingSession.rangeGrading.budgetFlat', { n: advice.atMost.roundBudget, sd: advice.atMost.dragSd.toFixed(2), letter: advice.atMost.grade }) }));
    } else {
      budgetNode.appendChild(el('p', { class: 'hint', text: t('truingSession.rangeGrading.budgetKnee', { n: advice.knee.roundBudget }) }));
      const table = el('table', { class: 'truing-session-table' });
      table.appendChild(el('tr', {}, ['budgetRoundsColumn', 'budgetGradeColumn', 'dragSdColumn', 'budgetDialColumn', 'budgetChangeColumn'].map((k) => el('th', { i18n: `truingSession.rangeGrading.${k}` }))));
      const row = (label, o, change) => table.appendChild(el('tr', {}, [
        el('td', { text: `${o.roundBudget} — ${label}` }), el('td', { text: o.grade }), el('td', { text: pct(o.dragSd) }),
        el('td', { text: `±${angle(o.farDialSdMrad)}` }), el('td', { text: change == null ? '—' : `${change > 0 ? '+' : ''}${(100 * change).toFixed(0)}%` })
      ]));
      if (advice.yours && !advice.options.some((o) => o.roundBudget === advice.yours.roundBudget)) row(t('truingSession.rangeGrading.budgetRowYours'), advice.yours, (advice.yours.dragSd - advice.knee.dragSd) / advice.knee.dragSd);
      for (const o of advice.options) row(o.extra === 0 ? t('truingSession.rangeGrading.budgetRowKnee') : t('truingSession.rangeGrading.budgetRowPlus', { n: o.extra }), o, o.extra === 0 ? null : o.dragSdChange);
      budgetNode.appendChild(table);
    }
    budgetNode.appendChild(el('p', { class: 'hint', i18n: 'truingSession.rangeGrading.budgetMinimum' }));
  }, 0);

  return { node, plan: { ranges: current.ranges, shots: current.shots, targets: current.targets } };
}
