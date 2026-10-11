// The optimal range readout (the near/far target band, the altitude example, the invalidity floor), the range-grading panel (can
// this range do the job?) with its comparative-distance and rounds-vs-chronograph tables and the advice list, and the rounds pane
// (how many rounds to bring). Every number is a live planner/posterior run against the current rifle, cartridge, rifle precision,
// muzzle-velocity spread and priors -- never a hardcoded figure -- made by prepare-compute.js (in the planning worker); the panels
// here only draw what it returned. Planning assumes every string is read at the certainty Shoot defaults to.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { grade, DEFAULT_LADDER_MAX_JUMP_FACTOR } from '../../engine/truing-session.js';
import { splitIntoStrings, BUDGET_ADVICE_STEPS, BUDGET_MINIMAL_WITHIN } from './session-model.js';
import { ALTITUDE_EXAMPLE, NEAR_BAND_HIGH_M } from './prepare-compute.js';
import { dist, distList, altitude, temperature, pressure, angle } from './units.js';

const pct = (sd) => `±${sd.toFixed(2)}%`;
const m = (x) => Math.round(x);

// While the planner works: the pane's heading and a "calculating" line, so the screen does not jump when the numbers arrive.
export function calculatingPanel(headingKey) {
  return el('div', { class: 'input-section' }, [el('h3', { i18n: headingKey }), el('p', { class: 'hint', i18n: 'truingSession.prepare.calculating' })]);
}

// The optimal-range readout. `data`: computePrepare()'s result.
export function optimalRangePanel({ state, data }) {
  const { ceiling } = data;
  const { optimum, bandLow, altCeiling, floor } = data.optimal;
  const node = el('div', { class: 'input-section' });
  node.appendChild(el('h3', { i18n: 'truingSession.prepare.optimalHeading' }));
  node.appendChild(el('p', { text: t('truingSession.prepare.nearLine', { zero: dist(state.zeroRange), limit: dist(NEAR_BAND_HIGH_M) }) }));
  node.appendChild(el('p', {
    text: bandLow != null && bandLow < optimum
      ? t('truingSession.prepare.farLine', { optimum: dist(optimum), low: dist(bandLow), high: dist(ceiling) })
      : t('truingSession.prepare.farLineNoBand', { optimum: dist(optimum), high: dist(ceiling) })
  }));
  if (altCeiling > ceiling * 1.02) {
    node.appendChild(el('p', { class: 'hint', text: t('truingSession.prepare.altitudeLine', {
      from: dist(ceiling), to: dist(altCeiling), pct: m((altCeiling / ceiling - 1) * 100),
      alt: altitude(ALTITUDE_EXAMPLE.altitudeM), air: `${pressure(ALTITUDE_EXAMPLE.pressureHpa)}, ${temperature(ALTITUDE_EXAMPLE.tempC)}`
    }) }));
  }
  node.appendChild(el('p', {
    class: 'hint',
    text: floor != null ? t('truingSession.prepare.invalidityLine', { floor: dist(floor) }) : t('truingSession.prepare.invalidityNone')
  }));
  return { node };
}

// The range-grading panel. `data`: computePrepare()'s result. Returns the plan to start from, or null.
export function rangeGradingPanel({ homework, data }) {
  const { ceiling } = data;
  const g0 = data.grading;
  const node = el('div', { class: 'input-section' });
  node.appendChild(el('h3', { i18n: 'truingSession.rangeGrading.heading' }));
  if (g0.excluded.length) {
    node.appendChild(el('p', { class: 'hint', text: t('truingSession.rangeGrading.excludedSubsonic', { ranges: distList(g0.excluded), ceiling: dist(ceiling) }) }));
  }
  if (g0.noUsable) {
    node.appendChild(el('p', { class: 'hint warning', text: t('truingSession.rangeGrading.noUsableDistance', { ceiling: dist(ceiling) }) }));
    return { node, plan: null };
  }
  if (g0.budgetTooSmall) {
    node.appendChild(el('p', { class: 'hint warning', text: t('truingSession.rangeGrading.budgetTooSmall', { n: g0.roundBudget }) }));
    return { node, plan: null };
  }
  const { current } = g0;
  const g = grade(current.dragSd);
  node.appendChild(el('p', {
    text: t('truingSession.rangeGrading.gradeLine', { letter: g.letter, ranges: distList(current.ranges, ' / '), shots: current.shots.join(' / '), sd: pct(current.dragSd) })
  }));
  node.appendChild(el('p', { class: 'hint', text: t(`truingSession.rangeGrading.grade${g.letter}`) }));
  // Every distance's rounds are shot as strings of at most three, rotated between the distances once each has been shot once.
  node.appendChild(el('p', { i18n: 'truingSession.rangeGrading.stringsHeading' }));
  node.appendChild(el('ul', {}, current.ranges.map((r, i) => el('li', {
    text: t('truingSession.rangeGrading.stringsLine', { range: dist(r), strings: splitIntoStrings(current.shots[i]).join(' + ') })
  }))));
  node.appendChild(el('p', { class: 'hint', text: t('truingSession.rangeGrading.zeroDragOverlap', { corr: current.zeroDragCorr.toFixed(2) }) }));
  if (!homework.chronographAvailable) node.appendChild(el('p', { class: 'hint warning', i18n: 'truingSession.rangeGrading.noChronoWarning' }));

  // The comparative-distance table: what the far target buys at a few Mach points, same near group.
  const table = el('table', { class: 'truing-session-table' });
  table.appendChild(el('tr', {}, [
    el('th', { i18n: 'truingSession.rangeGrading.machColumn' }),
    el('th', { i18n: 'truingSession.rangeGrading.distanceColumn' }),
    el('th', { i18n: 'truingSession.rangeGrading.dragSdColumn' })
  ]));
  for (const row of g0.machRows) table.appendChild(el('tr', {}, [el('td', { text: `Mach ${row.mach}` }), el('td', { text: dist(row.far) }), el('td', { text: pct(row.dragSd) })]));
  node.appendChild(table);

  // The rounds-vs-chronograph table, at the plan's own far target.
  const roundsTable = el('table', { class: 'truing-session-table' });
  roundsTable.appendChild(el('tr', {}, [
    el('th', { i18n: 'truingSession.rangeGrading.changeColumn' }),
    el('th', { i18n: 'truingSession.rangeGrading.dragSdColumn' })
  ]));
  for (const row of g0.roundsRows) {
    roundsTable.appendChild(el('tr', {}, [
      el('td', { text: t(row.withChrono ? 'truingSession.rangeGrading.roundsWithChrono' : 'truingSession.rangeGrading.roundsNoChrono', { n: row.rounds }) }),
      el('td', { text: pct(row.dragSd) })
    ]));
  }
  node.appendChild(roundsTable);
  node.appendChild(el('p', { class: 'hint', i18n: 'truingSession.rangeGrading.chronoLeverHint' }));

  // What would help, each with the spread it would give next to the current one.
  const advice = g0.advice.map((a) => (a.kind === 'plan'
    ? t(`truingSession.advice.${a.key}`, { ...a.vars, from: pct(current.dragSd), to: pct(a.to) })
    : t('truingSession.rangeGrading.targetAtXHelps', { x: dist(a.x), grade: a.grade })));
  if (advice.length) {
    node.appendChild(el('h4', { i18n: 'truingSession.advice.heading' }));
    node.appendChild(el('ul', {}, advice.map((a) => el('li', { text: a }))));
  }

  // The safety steps are inside the round budget; say so, or say that the ladder cannot reach the farther target the plan would like.
  if (g0.idealFar != null) {
    node.appendChild(el('p', { class: 'hint warning', text: t('truingSession.rangeGrading.walkOutGap', { far: dist(g0.idealFar), last: dist(g0.farM), max: dist(g0.farM * DEFAULT_LADDER_MAX_JUMP_FACTOR) }) }));
  } else {
    node.appendChild(el('p', {
      class: 'hint',
      text: g0.rungs.length
        ? t('truingSession.rangeGrading.walkOut', { steps: g0.rungs.length, ranges: distList(g0.rungs), planned: g0.roundBudget })
        : t('truingSession.rangeGrading.walkOutNone')
    }));
  }

  return { node, plan: { ranges: current.ranges, shots: current.shots, targets: current.targets } };
}

// The rounds pane: the number of rounds the shooter has, and a minimal / optimal / enhanced / deluxe recommendation for this range and homework.
// The input and its hints are drawn once and kept (typing in it must not lose its focus); `update()` redraws the recommendations
// after every change of the rest of the screen, from the `advice` it is handed (roundBudgetAdvice, or null). `isDefault`: the number
// shown is the optimum, not one the shooter chose. `onChange(n)` is told the number typed or picked, a whole number of at least
// MIN_ROUND_BUDGET.
export const MIN_ROUND_BUDGET = 6;
export function roundBudgetPanel({ onChange }) {
  const node = el('div', { class: 'input-section' });
  const input = el('input', { type: 'number', min: MIN_ROUND_BUDGET, max: 60, step: 1 });
  const commit = (n) => { input.value = String(n); onChange(n); };
  input.addEventListener('change', () => {
    const v = parseInt(input.value, 10);
    if (Number.isFinite(v) && v >= MIN_ROUND_BUDGET) onChange(v);
  });
  const prefilled = el('p', { class: 'hint', i18n: 'truingSession.prepare.roundBudgetPrefilled' });
  const adviceNode = el('div', { class: 'truing-session-budget-advice' });
  node.appendChild(el('h3', { i18n: 'truingSession.prepare.roundBudgetHeading' }));
  node.appendChild(el('p', { class: 'hint', i18n: 'truingSession.prepare.roundBudgetIntro' }));
  node.appendChild(el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.prepare.roundBudgetLabel' }), input]));
  node.appendChild(prefilled);
  node.appendChild(adviceNode);

  // while the planner works: the field keeps its value, the recommendations say they are coming
  function calculating() {
    clear(adviceNode);
    adviceNode.appendChild(el('p', { class: 'hint', i18n: 'truingSession.prepare.calculating' }));
  }
  function update({ advice, roundBudget, isDefault }) {
    input.value = String(roundBudget);
    prefilled.style.display = isDefault ? '' : 'none';
    clear(adviceNode);
    if (!advice) return;
    adviceNode.appendChild(el('h4', { i18n: 'truingSession.rangeGrading.budgetHeading' }));
    if (advice.flat) {
      adviceNode.appendChild(el('p', { class: 'hint', text: t('truingSession.rangeGrading.budgetFlat', { n: advice.atMost.roundBudget, sd: advice.atMost.dragSd.toFixed(2), letter: advice.atMost.grade }) }));
    } else {
      const { minimal, optimal, enhanced, deluxe } = advice.tiers;
      adviceNode.appendChild(el('p', { class: 'hint', text: t('truingSession.rangeGrading.budgetTiersHint', { m: BUDGET_ADVICE_STEPS[0], n: BUDGET_ADVICE_STEPS[BUDGET_ADVICE_STEPS.length - 1], pct: Math.round(100 * BUDGET_MINIMAL_WITHIN) }) }));
      const table = el('table', { class: 'truing-session-table' });
      table.appendChild(el('tr', {}, ['budgetRoundsColumn', 'budgetGradeColumn', 'dragSdColumn', 'budgetDialColumn', 'budgetChangeColumn', 'budgetUseColumn'].map((k) => el('th', { i18n: `truingSession.rangeGrading.${k}` }))));
      const row = (label, o) => {
        const use = el('button', { class: 'secondary', text: t('truingSession.rangeGrading.budgetUseButton', { n: o.roundBudget }) });
        use.addEventListener('click', () => commit(o.roundBudget));
        table.appendChild(el('tr', {}, [
          el('td', { text: `${o.roundBudget} — ${label}` }), el('td', { text: o.grade }), el('td', { text: pct(o.dragSd) }),
          el('td', { text: `±${angle(o.farDialSdMrad)}` }),
          el('td', { text: o.dragSdChange === 0 ? '—' : `${o.dragSdChange > 0 ? '+' : ''}${(100 * o.dragSdChange).toFixed(0)}%` }),
          el('td', {}, [use])
        ]));
      };
      const tiers = [[t('truingSession.rangeGrading.budgetRowMinimal'), minimal], [t('truingSession.rangeGrading.budgetRowOptimal'), optimal]];
      if (enhanced) tiers.push([t('truingSession.rangeGrading.budgetRowEnhanced'), enhanced]);
      if (deluxe) tiers.push([t('truingSession.rangeGrading.budgetRowDeluxe'), deluxe]);
      if (advice.yours && !tiers.some(([, o]) => o.roundBudget === advice.yours.roundBudget)) {
        tiers.unshift([t('truingSession.rangeGrading.budgetRowYours'), { ...advice.yours, dragSdChange: (advice.yours.dragSd - optimal.dragSd) / optimal.dragSd }]);
      }
      tiers.sort((a, b) => a[1].roundBudget - b[1].roundBudget);
      for (const [label, o] of tiers) row(label, o);
      adviceNode.appendChild(table);
    }
    adviceNode.appendChild(el('p', { class: 'hint', i18n: 'truingSession.rangeGrading.budgetMinimum' }));
  }
  return { node, update, calculating };
}
