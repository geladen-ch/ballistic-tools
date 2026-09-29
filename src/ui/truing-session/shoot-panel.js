// The Shoot phase: sequences shots as a ladder, records each group, a
// chronograph string, or a missed-impact report, and shows a live,
// clearly provisional readout after every recorded group -- visually
// distinct from, and never as confident as, the Conclude screen.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import {
  posterior, fitSession, sigmaForGroup, nextLadderRange, registerMissedImpact, registerRecordedGroup, nextShotDope, ladderStartCheck,
  DEFAULT_LADDER_CONFIDENCE_Z
} from '../../engine/truing-session.js';
import { formatDope, formatDopeSpread } from '../dope-format.js';
import { getOutputUnit } from '../../range-solver-prefs.js';
import { dist, distLabel, toDisplayDistance, fromDisplayDistance, vel, velLabel, toDisplayVelocity, fromDisplayVelocity } from './units.js';
import { certaintyPicker } from './certainty-picker.js';
import { recheckPrompt } from './recheck-prompt.js';
import { groupWeatherControl } from './conditions.js';
import { targetForRange, naturalKey, backdropMarginFrom, nextShotFromAnalysis, ladderStallReason, WALK_OUT_SHOTS_PER_RUNG, RESOLUTION_FLOOR } from './session-model.js';

// After a missed impact and a group nearer, the failed distance gets one more try -- but only if the shooter dials the
// fit's own elevation for it (shown on this screen); with the app's own dope the same number misses again.
const RETRY_MISSED_DISTANCE = true;
const REPEAT_GROUP_SHOTS = 3; // an extra group at a validated distance, shot only to unlock the retry: enough to move the fit

// "812, 815, -, 809": a "-" or "x" is a shot the chronograph missed --
// stored as null, never dropped silently from the shot count.
export function parseChronoReadings(text) {
  return text.split(/[,;\s]+/).filter((s) => s !== '').map((s) => {
    if (s === '-' || s.toLowerCase() === 'x') return null;
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : null;
  });
}

// `ctx` (owned by truing-session-view.js): { state, params, getPriors(),
// session, targets, plan, ceiling, clickMrad, rangeDeclaredFlat,
// getHomework, setHomework, chronographAvailable, buildObservations(),
// analyse(observations), mvStatus(), onChange(), onRecheck(key, reading),
// onMvToArsenal(sd), onAddNaturalTarget(rangeM), r50Mrad }.
export function shootPanel(ctx) {
  const { state, params, getPriors, session, targets, plan, ceiling } = ctx;
  const ladderNode = el('div', { class: 'input-section' });
  const liveNode = el('div', { class: 'input-section truing-session-live-panel' });
  const node = el('div', {}, [ladderNode, liveNode]);
  let missMessage = null;
  let lastProposed = null;
  // The live analysis, made once after each recorded group and shared by the ladder's next-shot readout and the live panel
  let analysis = null;
  function refreshAnalysis() {
    analysis = session.groups.length ? ctx.analyse(ctx.buildObservations()) : null;
  }

  const candidates = [...new Set([...targets.map((tg) => tg.rangeM), ...(plan ? plan.ranges : [])])]
    .filter((r) => r <= ceiling)
    .sort((a, b) => a - b);
  const planFar = plan && plan.ranges.length ? Math.max(...plan.ranges) : null;
  const planNear = plan && plan.ranges.length ? Math.min(...plan.ranges) : candidates[0];

  function currentFit() {
    if (session.groups.length === 0) return { theta: {}, cov: posterior({ state, groups: [], priors: getPriors(), params }).cov };
    return fitSession({ state, observations: ctx.buildObservations(), priors: getPriors(), params });
  }

  // the planned distances still to shoot: not yet tried, or released for the one retry after a miss
  function untriedPlanned(missCeiling = (session.missedRanges || []).length ? Math.min(...session.missedRanges) : Infinity) {
    const retry = session.retryRanges || [];
    return (plan ? plan.ranges : []).filter((r) => (!session.triedRanges.includes(r) || retry.includes(r)) && r < missCeiling).sort((a, b) => a - b);
  }

  function proposeNext() {
    if (session.retreatTo != null && !session.triedRanges.includes(session.retreatTo)) return session.retreatTo;
    // another group at a validated distance, asked for when the ladder was stuck after a miss (see stuckPrompt)
    if (session.repeatAt != null) return session.repeatAt;
    const { theta, cov } = currentFit();
    const ladder = {
      state, theta, cov, params,
      triedRanges: session.triedRanges, missedRanges: session.missedRanges || [], retryRanges: session.retryRanges || [],
      farthestValidatedM: session.farthestValidatedM,
      backdropMarginM: backdropMarginFrom(ctx.getHomework()),
      confidenceZ: session.confidenceZ ?? DEFAULT_LADDER_CONFIDENCE_Z
    };
    // The session follows its plan: the nearest planned distance not yet shot, when the ladder says that step is safe; when it is
    // not, the farthest safe distance below it (planned or not) as an intermediate step first. The plan already counts the steps
    // it expects to need, so there is nothing to shoot after it is done (see planWholeSession).
    if (plan && plan.ranges.length) {
      const missCeiling = (session.missedRanges || []).length ? Math.min(...session.missedRanges) : Infinity;
      const untried = untriedPlanned(missCeiling);
      if (!untried.length) return null;
      const step = nextLadderRange({ ...ladder, candidateRanges: [untried[0]] });
      if (step != null) return step;
      return nextLadderRange({ ...ladder, candidateRanges: candidates.filter((r) => r < untried[0]) });
    }
    return nextLadderRange({
      state, theta, cov, params, candidateRanges: candidates,
      triedRanges: session.triedRanges, missedRanges: session.missedRanges || [], retryRanges: session.retryRanges || [],
      farthestValidatedM: session.farthestValidatedM,
      backdropMarginM: backdropMarginFrom(ctx.getHomework()),
      confidenceZ: session.confidenceZ ?? DEFAULT_LADDER_CONFIDENCE_Z
    });
  }

  function backdropControl() {
    const input = el('input', { type: 'number', min: 1, step: 0.5, value: toDisplayDistance(ctx.getHomework().backdropHeightM ?? 4, 1) });
    input.addEventListener('change', () => {
      const shown = parseFloat(input.value);
      if (!Number.isFinite(shown) || shown <= 0) return;
      const v = fromDisplayDistance(shown);
      ctx.setHomework({ backdropHeightM: v });
      // the ladder is drawn again only if the new backdrop changes what it proposes: drawing it again empties the shots and
      // come-up fields the shooter may already have filled in
      if (proposeNext() !== lastProposed) renderLadder();
    });
    return el('div', { class: 'field' }, [el('label', { text: t('truingSession.shoot.backdropLabel', { unit: distLabel() }) }), input]);
  }

  // The ladder cannot go on: say why, and ask for an intermediate distance only now that it cannot go on without one. The
  // shooter may answer that there is none; a missed distance then still gets its one retry, after another group at a
  // distance that has landed.
  function stuckPrompt() {
    const untried = untriedPlanned();
    const nextM = untried.length ? untried[0] : planFar;
    const why = ladderStallReason({ nextM, farthestValidatedM: session.farthestValidatedM });
    const farthest = session.farthestValidatedM ?? '—';
    let text;
    if ((session.missedRanges || []).length && !untried.length) text = t('truingSession.shoot.ladderStuck', { far: dist(planFar), farthest: farthest === '—' ? farthest : dist(farthest) });
    else if (why.reason === 'cap') text = t('truingSession.shoot.ladderStuckCap', { far: dist(nextM), farthest: dist(session.farthestValidatedM), low: dist(why.lowM), high: dist(why.highM) });
    else text = t('truingSession.shoot.ladderStuckBackdrop', { far: dist(nextM) });
    ladderNode.appendChild(el('p', { class: 'hint warning', text }));
    // repeated misses are most often a wrong drag model or BC, before anything else
    if (session.missedImpactCount > 0) ladderNode.appendChild(el('p', { class: 'hint warning', i18n: 'truingSession.shoot.ladderStuckMisses' }));

    if (session.noIntermediate) {
      ladderNode.appendChild(el('p', { class: 'hint', i18n: 'truingSession.shoot.noIntermediateAnswer' }));
      if ((session.missedRanges || []).length && session.farthestValidatedM != null) {
        const again = el('button', { text: t('truingSession.shoot.repeatGroupButton', { range: dist(session.farthestValidatedM) }) });
        again.addEventListener('click', () => { session.repeatAt = session.farthestValidatedM; ctx.onChange(); renderLadder(); renderLive(); });
        ladderNode.appendChild(again);
      }
      return;
    }
    // A session-only natural target is the way past a gap the ladder will not jump.
    ladderNode.appendChild(el('p', { i18n: 'truingSession.shoot.intermediateQuestion' }));
    const input = el('input', { type: 'number', min: 1, step: 1, placeholder: t('truingSession.location.naturalTargetPlaceholder', { unit: distLabel() }) });
    const add = el('button', { class: 'secondary', i18n: 'truingSession.shoot.addDistanceButton' });
    add.addEventListener('click', () => {
      const shown = parseFloat(input.value);
      if (Number.isFinite(shown) && shown > 0) ctx.onAddNaturalTarget(fromDisplayDistance(shown));
    });
    const none = el('button', { class: 'secondary', i18n: 'truingSession.shoot.noIntermediateButton' });
    none.addEventListener('click', () => { session.noIntermediate = true; ctx.onChange(); renderLadder(); renderLive(); });
    ladderNode.appendChild(el('div', { class: 'field-row' }, [input, add, none]));
  }

  // Before the very first shot the nearest ground is shot whatever its distance, and nothing has been validated to retreat
  // to. When the prior spread says that shot may leave the backdrop, say so and offer the zero range (the natural nearer
  // distance), or let the shooter go on knowingly. Returns true while the question is open.
  function firstRungPrompt(next) {
    if (session.groups.length || session.missedImpactCount || session.firstRungAck || session.triedRanges.length) return false;
    const marginM = backdropMarginFrom(ctx.getHomework());
    const check = ladderStartCheck({ state, cov: posterior({ state, groups: [], priors: getPriors(), params }).cov, params, candidateRanges: [next], backdropMarginM: marginM });
    if (!check || check.safe) return false;
    ladderNode.appendChild(el('p', { class: 'hint warning', text: t('truingSession.shoot.firstRungWarning', { range: dist(next), backdrop: dist(marginM * 2, 1), miss: dist(check.predMissM, 1) }) }));
    const buttons = [];
    const zeroM = state.zeroRange;
    if (zeroM && zeroM < next) {
      const nearer = el('button', { text: t('truingSession.shoot.firstRungNearer', { range: dist(zeroM) }) });
      nearer.addEventListener('click', () => ctx.onAddNaturalTarget(zeroM));
      buttons.push(nearer);
    }
    const anyway = el('button', { class: 'secondary', i18n: 'truingSession.shoot.firstRungAnyway' });
    anyway.addEventListener('click', () => { session.firstRungAck = true; ctx.onChange(); renderLadder(); renderLive(); });
    buttons.push(anyway);
    ladderNode.appendChild(el('div', { class: 'field-row' }, buttons));
    return true;
  }

  function renderLadder() {
    clear(ladderNode);
    if (missMessage) ladderNode.appendChild(el('p', { class: 'hint warning', text: missMessage }));
    const next = proposeNext();
    lastProposed = next;

    if (next == null) {
      const reached = planFar == null || (session.triedRanges.includes(planFar) && !(session.missedRanges || []).includes(planFar) && !(session.retryRanges || []).includes(planFar));
      if (reached) ladderNode.appendChild(el('p', { class: 'hint', i18n: 'truingSession.shoot.ladderDone' }));
      else stuckPrompt();
      ladderNode.appendChild(backdropControl());
      return;
    }

    const plannedIndex = plan ? plan.ranges.indexOf(next) : -1;
    const isPlanned = plannedIndex >= 0;
    const isRepeat = session.repeatAt === next;
    const isNearTarget = next <= planNear;
    const target = targetForRange(targets, next);
    const targetKey = target ? target.key : naturalKey(next);

    firstRungPrompt(next);
    ladderNode.appendChild(el('h3', { text: t('truingSession.shoot.nextRange', { range: dist(next) }) }));
    ladderNode.appendChild(el('p', {
      class: 'hint',
      text: isRepeat
        ? t('truingSession.shoot.repeatStep')
        : isPlanned
          ? t('truingSession.shoot.plannedStep', { shots: plan.shots[plannedIndex] })
          : t('truingSession.shoot.rungStep', { shots: WALK_OUT_SHOTS_PER_RUNG })
    }));

    const shotsInput = el('input', { type: 'number', min: 1, step: 1, value: isRepeat ? REPEAT_GROUP_SHOTS : isPlanned ? plan.shots[plannedIndex] : WALK_OUT_SHOTS_PER_RUNG });
    const comeUpInput = el('input', { type: 'number', step: 0.1 }); // scope clicks, positive up

    // Only the near target asks whether its shots could be told apart;
    // defaulted to "just a general sense", with the certainty picker
    // underneath for that case.
    let resolved = !isNearTarget;
    const picker = certaintyPicker({ verticalClickMrad: ctx.clickMrad });
    const resolvedRow = el('div', {});
    if (isNearTarget) {
      const resolvedCheckbox = el('input', { type: 'checkbox' });
      resolvedCheckbox.addEventListener('change', () => {
        resolved = resolvedCheckbox.checked;
        picker.node.style.display = resolved ? 'none' : '';
      });
      resolvedRow.appendChild(el('label', { class: 'checkbox-field' }, [resolvedCheckbox, el('span', { i18n: 'truingSession.shoot.resolvedLabel' })]));
      resolvedRow.appendChild(picker.node);
    }

    const chronoExample = [812, 815, 809].map((v) => Math.round(toDisplayVelocity(v))); // a typical string, in the shooter's unit
    const chronoInput = el('input', { type: 'text', placeholder: t('truingSession.shoot.chronoPlaceholder', { example: `${chronoExample[0]}, ${chronoExample[1]}, -, ${chronoExample[2]}` }) });
    // the air and wind of this group: the last group's, unless the pocket meter says it changed
    const lastGroupWithAir = [...session.groups].reverse().find((g) => g.conditions);
    const nextShotHost = el('div', { class: 'truing-session-next-shot' });
    const weather = groupWeatherControl({
      start: ctx.startConditions, last: lastGroupWithAir ? lastGroupWithAir.conditions : null, onChange: () => renderNextShot(nextShotHost, next, targetKey, target, weather)
    });
    renderNextShot(nextShotHost, next, targetKey, target, weather);

    const record = el('button', { i18n: 'truingSession.shoot.recordGroupButton' });
    record.addEventListener('click', () => {
      const shots = parseInt(shotsInput.value, 10);
      const dialedClicks = parseFloat(comeUpInput.value);
      if (!Number.isFinite(shots) || shots < 1 || !Number.isFinite(dialedClicks)) return;
      const observedComeUp = dialedClicks * ctx.clickMrad; // the engine works in mrad
      const sigmaMrad = isNearTarget && !resolved ? picker.getSigmaMrad() : sigmaForGroup({ shots, r50Mrad: ctx.r50Mrad, resolved: true });
      const conditions = weather.getValue();
      const readings = ctx.chronographAvailable && chronoInput.value.trim() ? parseChronoReadings(chronoInput.value).map((v) => (v == null ? null : fromDisplayVelocity(v))) : [];
      session.groups.push({
        rangeM: next, targetKey, observedComeUp, shots, sigmaMrad, resolved,
        certaintyKey: isNearTarget && !resolved ? picker.getLevelKey() : null,
        // each group keeps its own readings and its own air, so its velocities are compared with the cartridge's velocity in
        // that air (the pooled list stays for counting readings)
        ...(conditions ? { conditions } : {}),
        ...(readings.length ? { chronoVelocities: readings } : {})
      });
      registerRecordedGroup(session, next, { retry: RETRY_MISSED_DISTANCE });
      session.repeatAt = null;
      session.chronoVelocities.push(...readings);
      missMessage = null;
      ctx.onChange();
      refreshAnalysis();
      renderLadder();
      renderLive();
    });

    // "I can't see where it hit": a real outcome, counted, never reshot at
    // the same range at once; the ladder retreats to real ground between the
    // last validated range and this one, tightens its margin, and proposes
    // nothing at or beyond this range again this session (unless
    // RETRY_MISSED_DISTANCE is on). See registerMissedImpact().
    const miss = el('button', { class: 'secondary', i18n: 'truingSession.shoot.cantSeeImpactButton' });
    miss.addEventListener('click', () => {
      session.repeatAt = null;
      const retreat = registerMissedImpact(session, next, candidates);
      missMessage = retreat != null
        ? t('truingSession.shoot.missRetreat', { range: dist(retreat) })
        : t('truingSession.shoot.missNoRetreat');
      ctx.onChange();
      renderLadder();
      renderLive();
    });

    for (const child of [
      weather.node,
      nextShotHost,
      el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.shoot.shotsLabel' }), shotsInput]),
      el('div', { class: 'field' }, [el('label', { text: t('truingSession.shoot.comeUpLabel', { unit: t('truingSession.shoot.nextShotClicks') }) }), comeUpInput]),
      resolvedRow,
      ctx.chronographAvailable ? el('div', { class: 'field' }, [el('label', { text: t('truingSession.shoot.chronoLabel', { unit: velLabel() }) }), chronoInput]) : null,
      el('div', { class: 'field-row' }, [record, miss]),
      backdropControl()
    ]) {
      if (child) ladderNode.appendChild(child);
    }
  }

  // What to dial for the shot about to be fired: from the live fit (the app's own dope until a group is recorded), in the air
  // and wind that shot will be in, with the fit's uncertainty; windage only predicted, from the called wind and how well
  // the crosswind is known. It is the whole come-up, the number to dial and record, not a correction on top of another.
  function renderNextShot(host, next, targetKey, target, weather) {
    clear(host);
    const angle = ctx.rangeDeclaredFlat ? 0 : (session.angleChecks && session.angleChecks[targetKey] != null ? session.angleChecks[targetKey] : (target && target.losAngleDeg) || 0);
    const args = { state, conditions: weather.getValue(), rangeM: next, knownLosDeg: angle, crosswindSigmaMs: ctx.crosswindSigmaMs ?? 0 };
    let dope;
    try {
      dope = analysis
        ? nextShotFromAnalysis({ ...args, analysis })
        : nextShotDope({ ...args, theta: {}, cov: posterior({ state, groups: [], priors: getPriors(), params }).cov, params });
    } catch {
      return;
    }
    if (![dope.elevationMrad, dope.windageMrad].every(Number.isFinite)) return;
    const clicksLabel = t('truingSession.shoot.nextShotClicks');
    // in Range Solver's own unit; when that is not clicks, the clicks as well, since a come-up is entered in clicks
    const dopeText = (mrad, axis, clickMrad) => {
      const main = formatDope({ mrad, axis, clickMrad, clicksLabel });
      return getOutputUnit() === 'clicks' ? main : { text: `${main.text} (${formatDope({ mrad, axis, clickMrad, clicksLabel, unit: 'clicks' }).text})` };
    };
    const elevation = dopeText(dope.elevationMrad, 'elevation', ctx.clickMrad);
    const windage = dopeText(dope.windageMrad, 'windage', ctx.clickHorizontalMrad ?? ctx.clickMrad);
    const spread = (sdMrad, clickMrad) => (Number.isFinite(sdMrad) && sdMrad > 0 ? ` (± ${formatDopeSpread({ mrad: 1.96 * sdMrad, clickMrad, clicksLabel })})` : '');
    host.appendChild(el('h4', { text: t('truingSession.shoot.nextShotHeading', { range: dist(next) }) }));
    host.appendChild(el('p', { class: 'truing-session-next-shot-dope', text: `${t('truingSession.shoot.nextShotElevation')}: ${elevation.text}${spread(dope.elevationSdMrad, ctx.clickMrad)}` }));
    host.appendChild(el('p', { class: 'truing-session-next-shot-dope', text: `${t('truingSession.shoot.nextShotWindage')}: ${windage.text}${spread(dope.windageSdMrad, ctx.clickHorizontalMrad ?? ctx.clickMrad)}` }));
    host.appendChild(el('p', { class: 'hint', i18n: analysis ? 'truingSession.shoot.nextShotFromFit' : 'truingSession.shoot.nextShotFromApp' }));
    host.appendChild(el('p', { class: 'hint', i18n: 'truingSession.shoot.nextShotDialFull' }));
  }

  function renderLive() {
    clear(liveNode);
    liveNode.appendChild(el('h3', { i18n: 'truingSession.shoot.liveHeading' }));
    liveNode.appendChild(el('p', { class: 'hint', i18n: 'truingSession.shoot.liveDisclaimer' }));
    liveNode.appendChild(el('p', { text: t('truingSession.shoot.missedImpactCount', { n: session.missedImpactCount }) }));
    if (session.groups.length === 0) {
      liveNode.appendChild(el('p', { class: 'hint', i18n: 'truingSession.shoot.liveNoDataYet' }));
      return;
    }

    const inGroup = new Set();
    for (const f of analysis.findings.filter((x) => x.case === 6)) {
      f.members.forEach((k) => inGroup.add(k));
      liveNode.appendChild(el('p', { text: t('truingSession.shoot.liveDegenerate', { causes: f.members.map((k) => t(`truingSession.params.${k}`)).join(' / ') }) }));
    }
    // A parameter the data hasn't moved off its prior is "not determined
    // yet", never a shrunk-to-prior number.
    const resolved = (k) => analysis.Rtilde[analysis.params.indexOf(k)][analysis.params.indexOf(k)] >= RESOLUTION_FLOOR;
    const notYet = (k) => el('p', { text: t('truingSession.shoot.liveNotYet', { param: t(`truingSession.params.${k}`) }) });
    if (!inGroup.has('dragPct')) {
      liveNode.appendChild(resolved('dragPct')
        ? el('p', { text: t('truingSession.shoot.liveDragSoFar', { value: analysis.theta.dragPct.toFixed(1), size: (1.96 * analysis.sd.dragPct).toFixed(1) }) })
        : notYet('dragPct'));
    }
    if (!inGroup.has('zeroMrad')) {
      liveNode.appendChild(resolved('zeroMrad')
        ? el('p', { text: t('truingSession.shoot.liveZeroSoFar', { clicks: (analysis.theta.zeroMrad / ctx.clickMrad).toFixed(1), size: (1.96 * analysis.sd.zeroMrad / ctx.clickMrad).toFixed(1) }) })
        : notYet('zeroMrad'));
    }

    // The one live case worth interrupting for: a target flagged as
    // probably wrong gets the re-check right now, while the rangefinder is
    // still in hand.
    for (const f of analysis.findings.filter((x) => x.case === 7)) {
      const box = el('div', { class: 'truing-session-flag' });
      box.appendChild(el('p', { text: flagText(f) }));
      box.appendChild(recheckPrompt({
        target: { rangeM: f.rangeM }, rangeDeclaredFlat: ctx.rangeDeclaredFlat,
        angleMeasured: session.angleChecks && session.angleChecks[f.targetKey] != null,
        onSubmit: (reading) => { ctx.onRecheck(f.targetKey, f.rangeM, reading); refreshAnalysis(); renderLadder(); renderLive(); }
      }).node);
      liveNode.appendChild(box);
    }

    // Past 10 captured readings, a significantly different spread
    // governs the rest of the session; the only question is whether it
    // also gets written back to Arsenal.
    const mv = ctx.mvStatus();
    if (mv.override) {
      liveNode.appendChild(el('p', { class: 'hint warning', text: t('truingSession.shoot.sdOverride', { today: vel(mv.override.sd), n: mv.override.sampleSize, recorded: vel(mv.override.recordedSd) }) }));
      if (!session.mvDecision) {
        const toArsenal = el('button', { i18n: 'truingSession.shoot.sdToArsenal' });
        toArsenal.addEventListener('click', () => { ctx.onMvToArsenal(mv.override.sd); session.mvDecision = 'arsenal'; ctx.onChange(); renderLive(); });
        const sessionOnly = el('button', { class: 'secondary', i18n: 'truingSession.choice.sessionOnly' });
        sessionOnly.addEventListener('click', () => { session.mvDecision = 'session'; ctx.onChange(); renderLive(); });
        liveNode.appendChild(el('div', { class: 'field-row' }, [toArsenal, sessionOnly]));
      } else {
        liveNode.appendChild(el('p', { class: 'hint', i18n: session.mvDecision === 'arsenal' ? 'truingSession.shoot.sdSavedToArsenal' : 'truingSession.shoot.sdSessionOnly' }));
      }
    }
  }

  refreshAnalysis();
  renderLadder();
  renderLive();
  return { node, refresh: () => { refreshAnalysis(); renderLadder(); renderLive(); } };
}

export function flagText(f) {
  const vars = { range: dist(f.rangeM), p: `${Math.round(f.pSomethingWrong * 100)}%` };
  const key = f.slopePossible && f.pInclined >= 0.05 ? 'truingSession.flag.distanceOrAngle' : 'truingSession.flag.distance';
  const text = t(key, vars);
  return f.exact ? text : `${text} ${t('truingSession.flag.screened')}`;
}
