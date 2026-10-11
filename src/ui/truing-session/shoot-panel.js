// The Shoot phase: sequences shots as a ladder, then rotates between the
// planned distances a string of at most three rounds at a time; records
// each string (its centre, or every round), a chronograph string, or a
// missed-impact report, and shows a live, clearly provisional readout
// after every recorded string -- visually distinct from, and never as
// confident as, the Conclude screen.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import {
  posterior, fitSession, nextLadderRange, registerMissedImpact, registerRecordedGroup, nextShotDope, ladderStartCheck,
  DEFAULT_LADDER_CONFIDENCE_Z, MAX_STRING_SHOTS
} from '../../engine/truing-session.js';
import { formatDope, formatDopeSpread } from '../dope-format.js';
import { getOutputUnit } from '../../range-solver-prefs.js';
import { dist, distLabel, toDisplayDistance, fromDisplayDistance, vel, velLabel, toDisplayVelocity, fromDisplayVelocity } from './units.js';
import { certaintyPicker } from './certainty-picker.js';
import { comeUpPlausibility, velocityPlausibility } from './plausibility.js';
import { getUnit } from '../../prefs.js';
import { showDialog } from '../app-dialog.js';
import { recheckPrompt } from './recheck-prompt.js';
import { groupWeatherControl } from './conditions.js';
import {
  targetForStep, naturalKey, backdropMarginFrom, nextShotFromAnalysis, ladderStallReason, WALK_OUT_SHOTS_PER_RUNG, RESOLUTION_FLOOR,
  REPEAT_GROUP_SHOTS, roundsLeft, nextStringShots, splitIntoStrings, rotationNext, shotNoise, stringSigma, readShots, windSigmaFor
} from './session-model.js';

// After a missed impact and a group nearer, the failed distance gets another try (and keeps getting one while there is untried
// ground below it to learn from, see registerMissedImpact) -- but only if the shooter dials the fit's own elevation for it
// (shown on this screen); with the app's own dope the same number misses again.
const RETRY_MISSED_DISTANCE = true;
const STRING_MODES = ['average', 'shots'];

// "812 815 - 809": a "-" or "x" is a round the chronograph (or the
// spotter) missed -- stored as null, never dropped silently from the shot
// count. Readings are separated by whitespace (or a semicolon); a comma is
// a decimal separator, like the dot ("812,5" is 812.5). The same format
// takes a string's come-ups round by round ("52 54 -").
export function parseReadings(text) {
  return text.split(/[;\s]+/).filter((s) => s !== '').map((s) => {
    if (s === '-' || s.toLowerCase() === 'x') return null;
    const v = parseFloat(s.replace(',', '.'));
    return Number.isFinite(v) ? v : null;
  });
}

// `ctx` (owned by truing-session-view.js): { state, params, getPriors(),
// session, targets, plan, ceiling, clickMrad, rangeDeclaredFlat,
// getHomework, setHomework, chronographAvailable, buildObservations(),
// analyse(observations), mvStatus(), onChange(), onRecheck(key, reading),
// onAddNaturalTarget(rangeM), r50Mrad }.
export function shootPanel(ctx) {
  const { state, params, getPriors, session, targets, plan, ceiling } = ctx;
  const ladderNode = el('div', { class: 'input-section' });
  const liveNode = el('div', { class: 'input-section truing-session-live-panel' });
  const node = el('div', {}, [ladderNode, liveNode]);
  let missMessage = null;
  let lastProposed = null;
  // The live analysis, made once after each recorded group and shared by the ladder's next-shot readout and the live panel. It runs
  // in the planning worker: until a newer one arrives the last one stays on screen, marked as being brought up to date, and the
  // ladder and the live panel are drawn again when it comes.
  let analysis = null;
  let analysisPending = false;
  let analysisTicket = 0;
  function refreshAnalysis() {
    const ticket = ++analysisTicket;
    if (!session.groups.length) { analysis = null; analysisPending = false; return; }
    analysisPending = true;
    ctx.analyse(ctx.buildObservations()).then((result) => {
      if (ticket !== analysisTicket) return;
      analysis = result;
      analysisPending = false;
      renderLadder();
      renderLive();
    }, () => {
      if (ticket !== analysisTicket) return;
      analysisPending = false;
      renderLive();
    });
  }

  // a planned target whose distance a re-check corrected stays at its planned distance here, so the ladder never offers it twice
  const plannedKeys = new Set((plan && plan.keys) || []);
  const candidates = [...new Set([...targets.filter((tg) => !plannedKeys.has(tg.key)).map((tg) => tg.rangeM), ...(plan ? plan.ranges : [])])]
    .filter((r) => r <= ceiling)
    .sort((a, b) => a - b);
  const planFar = plan && plan.ranges.length ? Math.max(...plan.ranges) : null;

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
    // The session follows its plan: first the nearest planned distance not yet shot, when the ladder says that step is safe; when
    // it is not, the farthest safe distance below it (planned or not) as an intermediate step first. Once every planned distance
    // has been shot once, the strings left go to the distance with the most rounds left (rotationNext). The plan already counts
    // the steps it expects to need, so there is nothing to shoot after it is done (see planWholeSession).
    if (plan && plan.ranges.length) {
      const missCeiling = (session.missedRanges || []).length ? Math.min(...session.missedRanges) : Infinity;
      const untried = untriedPlanned(missCeiling);
      if (!untried.length) return rotationNext(roundsLeft(plan, session), missCeiling);
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
    // A planned distance finds its target by key, so a target whose distance a re-check corrected is still the one shot at. The
    // string is recorded at the planned distance, like the strings shot there before the re-check, and the range-check row corrects
    // them all alike; the heading and the dial use the corrected distance.
    const target = targetForStep(targets, plan, next);
    const targetKey = target ? target.key : naturalKey(next);
    const shotRangeM = target ? target.rangeM : next;
    const left = isPlanned ? roundsLeft(plan, session).get(next) : 0;
    const stringShots = isRepeat ? REPEAT_GROUP_SHOTS : isPlanned ? Math.max(1, nextStringShots(left)) : WALK_OUT_SHOTS_PER_RUNG;

    firstRungPrompt(next);
    ladderNode.appendChild(el('h3', { text: t('truingSession.shoot.nextRange', { range: dist(shotRangeM) }) }));
    // Before the first string at the planned far target: one more reading of its distance (and its angle, unless the range is
    // declared flat), entered as a re-check. The result leans on that distance hardest, and a mis-ranged far target is what the
    // shots can least tell from a wrong drag scale; a second reading taken here settles most of it.
    if (isPlanned && next === planFar && !(session.rangeChecks || []).some((rc) => rc.targetKey === targetKey)) {
      ladderNode.appendChild(el('p', { class: 'hint warning', text: t('truingSession.shoot.farRecheck', { range: dist(shotRangeM) }) }));
      ladderNode.appendChild(recheckPrompt({
        target: { rangeM: shotRangeM }, rangeDeclaredFlat: ctx.rangeDeclaredFlat,
        angleMeasured: session.angleChecks && session.angleChecks[targetKey] != null,
        onSubmit: (reading) => { ctx.onRecheck(targetKey, shotRangeM, reading); refreshAnalysis(); renderLadder(); renderLive(); }
      }).node);
      ladderNode.appendChild(backdropControl());
      return;
    }
    let stepText;
    if (isRepeat) stepText = t('truingSession.shoot.repeatStep');
    else if (isPlanned) {
      const done = session.groups.filter((g) => g.rangeM === next && !g.extra).length;
      stepText = t('truingSession.shoot.plannedString', { k: done + 1, n: done + splitIntoStrings(left).length, shots: stringShots, after: Math.max(0, left - stringShots) });
    } else stepText = t('truingSession.shoot.rungStep', { shots: WALK_OUT_SHOTS_PER_RUNG });
    ladderNode.appendChild(el('p', { class: 'hint', text: stepText }));
    ladderNode.appendChild(el('p', { class: 'hint', text: t('truingSession.shoot.stringRule', { n: MAX_STRING_SHOTS }) }));
    ladderNode.appendChild(el('p', { class: 'hint', i18n: 'truingSession.shoot.flyerRule' }));

    // How the string is read: its centre (one come-up and how many rounds) or every round (a come-up each). The last choice stays.
    let mode = STRING_MODES.includes(session.lastStringMode) ? session.lastStringMode : 'average';
    const modeSelect = el('select', { id: 'truingStringMode' }, STRING_MODES.map((m) => el('option', { value: m, text: t(`truingSession.shoot.mode.${m}`) })));
    modeSelect.value = mode;
    const comeUpInput = el('input', { type: 'number', step: 0.1 }); // scope clicks, positive up
    const warningHost = () => { const p = el('p', { class: 'hint warning' }); p.style.display = 'none'; return p; };
    const comeUpWarn = warningHost();
    const averageFields = el('div', {}, [
      el('div', { class: 'field' }, [el('label', { text: t('truingSession.shoot.comeUpLabel', { unit: t('truingSession.shoot.nextShotClicks') }) }), comeUpInput, comeUpWarn])
    ]);
    // Read round by round: one row per round, a come-up (clicks, positive up) and, with a chronograph, that round's velocity
    const roundRows = Array.from({ length: stringShots }, (_, i) => ({
      comeUp: el('input', { type: 'number', step: 'any', id: `truingShotComeUp${i}` }),
      velocity: ctx.chronographAvailable ? el('input', { type: 'number', step: 'any', id: `truingShotVelocity${i}` }) : null,
      comeUpWarn: warningHost(),
      velocityWarn: warningHost()
    }));
    const shotsFields = el('div', {}, roundRows.map((row, i) => el('div', { class: 'field-row' }, [
      el('div', { class: 'field' }, [el('label', { text: t('truingSession.shoot.roundLabel', { n: i + 1, unit: t('truingSession.shoot.nextShotClicks') }) }), row.comeUp, row.comeUpWarn]),
      row.velocity ? el('div', { class: 'field' }, [el('label', { text: t('truingSession.shoot.roundVelocityLabel', { unit: velLabel() }) }), row.velocity, row.velocityWarn]) : null
    ])));
    const entryError = el('p', { class: 'hint warning' });
    entryError.style.display = 'none';
    const chronoField = el('div', { class: 'field' });
    const showMode = () => {
      averageFields.style.display = mode === 'average' ? '' : 'none';
      shotsFields.style.display = mode === 'shots' ? '' : 'none';
      chronoField.style.display = mode === 'average' ? '' : 'none'; // read round by round, each round has its own velocity field
    };
    modeSelect.addEventListener('change', () => { mode = modeSelect.value; showMode(); });
    showMode();

    // How well the spotter read the impacts: good unless said otherwise, on every string.
    const picker = certaintyPicker({ onInput: () => checkAll() });

    const chronoExample = [812, 815, 809].map((v) => Math.round(toDisplayVelocity(v))); // a typical string, in the shooter's unit
    const chronoInput = el('input', { type: 'text', id: 'truingChronoReadings', placeholder: t('truingSession.shoot.chronoPlaceholder', { example: `${chronoExample[0]} ${chronoExample[1]} - ${chronoExample[2]}` }) });
    chronoField.appendChild(el('label', { text: t('truingSession.shoot.chronoLabel', { unit: velLabel() }) }));
    chronoField.appendChild(chronoInput);
    const chronoWarn = warningHost();
    chronoField.appendChild(chronoWarn);
    showMode();
    // the air and wind of this group: the last group's, unless the pocket meter says it changed
    const lastGroupWithAir = [...session.groups].reverse().find((g) => g.conditions);
    const nextShotHost = el('div', { class: 'truing-session-next-shot' });
    const weather = groupWeatherControl({
      start: ctx.startConditions, last: lastGroupWithAir ? lastGroupWithAir.conditions : null,
      lastWindConfidenceKey: lastGroupWithAir ? lastGroupWithAir.windConfidenceKey ?? null : null, onChange: () => { renderNextShot(nextShotHost, shotRangeM, targetKey, target, weather); checkAll(); }
    });
    renderNextShot(nextShotHost, shotRangeM, targetKey, target, weather);

    // the noise of one round in this string, in its air, at the picked certainty
    const noise = () => shotNoise({
      state, rangeM: shotRangeM, knownLosDeg: targetAngle(targetKey, target), conditions: weather.getValue(),
      r50Mrad: ctx.r50Mrad, mvSD: ctx.mvStatus().mvSD, certaintyKey: picker.getLevelKey(), windConfidenceKey: weather.getWindConfidenceKey()
    });
    // each round's come-up in mrad (NaN where nothing valid was typed) and, with a chronograph, its velocity in m/s (null where none was typed)
    const shotEntries = () => roundRows.map((row) => (row.comeUp.value.trim() === '' ? NaN : parseFloat(row.comeUp.value) * ctx.clickMrad));
    const shotVelocities = () => roundRows.map((row) => {
      const v = row.velocity && row.velocity.value.trim() !== '' ? parseFloat(row.velocity.value) : NaN;
      return Number.isFinite(v) ? fromDisplayVelocity(v) : null;
    });

    // Advice about implausible entries (plausibility.js): a warning beside the field, never a block -- whatever was typed is recorded.
    const setWarning = (host, text) => { host.textContent = text || ''; host.style.display = text ? '' : 'none'; };
    const clicksText = (mrad) => { const c = mrad / ctx.clickMrad; return String(Math.abs(c) >= 100 ? Math.round(c) : Number(c.toFixed(1))); };
    const SPEED_UNITS = [{ unit: 'm/s', factor: 1 }, { unit: 'ft/s', factor: 0.3048 }, { unit: 'mph', factor: 0.44704 }, { unit: 'km/h', factor: 1 / 3.6 }];
    const comeUpWarning = (input, shots) => {
      const typed = input.value.trim();
      const x = parseFloat(typed);
      if (typed === '' || !Number.isFinite(x)) return '';
      const dope = currentDope(shotRangeM, targetKey, target, weather);
      const r = comeUpPlausibility({
        enteredClicks: x, clickMrad: ctx.clickMrad, recommendedMrad: dope ? dope.elevationMrad : null,
        state, conditions: weather.getValue(), rangeM: shotRangeM, knownLosDeg: targetAngle(targetKey, target),
        r50Mrad: ctx.r50Mrad, mvSD: ctx.mvStatus().mvSD, certaintyKey: picker.getLevelKey(), shots
      });
      if (r.ok) return '';
      const unit = t('truingSession.shoot.nextShotClicks');
      const hints = ['mrad', 'delta', 'moa', 'sign', 'tenth'].filter((h) => r.hints.includes(h)).slice(0, 2)
        .map((h) => t(`truingSession.shoot.plausibleHint.${h}`, { unit, rec: dope ? clicksText(dope.elevationMrad) : '' }));
      return [t('truingSession.shoot.plausibleComeUp', { value: typed, unit, range: dist(shotRangeM), low: clicksText(r.lowMrad), high: clicksText(r.highMrad) }), ...hints].join(' ');
    };
    // a typed velocity (in the shooter's unit) against the cartridge's velocity in this string's air; null when it is fine
    const velocityCheck = (typed) => {
      const raw = parseFloat(typed);
      if (!Number.isFinite(raw)) return null;
      const here = getUnit('velocity');
      const r = velocityPlausibility({
        enteredMs: fromDisplayVelocity(raw), state, conditions: weather.getValue(), mvSD: ctx.mvStatus().mvSD,
        readAs: SPEED_UNITS.filter((u) => u.unit !== here).map((u) => ({ label: u.unit, ms: raw * u.factor }))
      });
      if (r.ok) return null;
      const hints = r.hints.slice(0, 2).map((h) => (h.type === 'unit' ? t('truingSession.shoot.plausibleHint.unit', { other: h.label }) : t('truingSession.shoot.plausibleHint.digit')));
      return { low: Math.round(toDisplayVelocity(r.lowMs)), high: Math.round(toDisplayVelocity(r.highMs)), hints };
    };
    const velocityWarning = (typed) => {
      const c = velocityCheck(typed.trim());
      return c ? [t('truingSession.shoot.plausibleVelocity', { value: typed.trim(), unit: velLabel(), low: c.low, high: c.high }), ...c.hints].join(' ') : '';
    };
    // the velocities typed as a list: one line for the whole field, naming the values that look off
    const velocityListWarning = () => {
      const typed = chronoInput.value.trim().split(/[;\s]+/).filter((v) => v !== '' && v !== '-' && v.toLowerCase() !== 'x');
      const off = typed.map((v) => ({ v, c: velocityCheck(v) })).filter((x) => x.c);
      if (!off.length) return '';
      return [t('truingSession.shoot.plausibleVelocityList', { values: off.map((x) => x.v).join(', '), unit: velLabel(), low: off[0].c.low, high: off[0].c.high }), ...off[0].c.hints].join(' ');
    };
    function checkAll() {
      setWarning(comeUpWarn, comeUpWarning(comeUpInput, stringShots));
      for (const row of roundRows) {
        setWarning(row.comeUpWarn, comeUpWarning(row.comeUp, 1));
        if (row.velocity) setWarning(row.velocityWarn, velocityWarning(row.velocity.value));
      }
      setWarning(chronoWarn, velocityListWarning());
    }
    comeUpInput.addEventListener('input', () => setWarning(comeUpWarn, comeUpWarning(comeUpInput, stringShots)));
    for (const row of roundRows) {
      row.comeUp.addEventListener('input', () => setWarning(row.comeUpWarn, comeUpWarning(row.comeUp, 1)));
      if (row.velocity) row.velocity.addEventListener('input', () => setWarning(row.velocityWarn, velocityWarning(row.velocity.value)));
    }
    chronoInput.addEventListener('input', () => setWarning(chronoWarn, velocityListWarning()));

    const fail = (key) => { entryError.textContent = t(key, { n: stringShots }); entryError.style.display = ''; };

    const record = el('button', { i18n: 'truingSession.shoot.recordGroupButton' });
    record.addEventListener('click', () => {
      // a string is always the recommended number of rounds; read round by round, every round needs its come-up
      const shots = stringShots;
      let observedComeUp;
      const extraFields = {};
      if (mode === 'shots') {
        const entries = shotEntries();
        if (!entries.every(Number.isFinite)) return fail('truingSession.shoot.shotComeUpsCount');
        observedComeUp = readShots(entries).mean;
        extraFields.shotComeUps = entries;
      } else {
        const dialedClicks = parseFloat(comeUpInput.value);
        if (!Number.isFinite(dialedClicks)) return;
        observedComeUp = dialedClicks * ctx.clickMrad; // the engine works in mrad
      }
      entryError.style.display = 'none';
      let readings = [];
      if (ctx.chronographAvailable) {
        if (mode === 'shots') { const v = shotVelocities(); readings = v.some((x) => x != null) ? v : []; }
        else if (chronoInput.value.trim()) readings = parseReadings(chronoInput.value).map((v) => (v == null ? null : fromDisplayVelocity(v)));
      }
      const reported = readings.filter((v) => v != null).length;
      // fewer velocities than rounds: the chronograph may simply have missed some, or the entry is incomplete -- the shooter decides
      if (ctx.chronographAvailable && reported < shots) {
        showDialog({
          message: t('truingSession.shoot.chronoShort', { n: reported, shots }),
          buttons: [
            { label: t('truingSession.shoot.chronoShortComplete') },
            { label: t('truingSession.shoot.chronoShortContinue'), onClick: () => commit(shots, observedComeUp, extraFields, readings) }
          ]
        });
        return;
      }
      commit(shots, observedComeUp, extraFields, readings);
    });

    function commit(shots, observedComeUp, extraFields, readings) {
      const certaintyKey = picker.getLevelKey();
      const stringNoise = noise();
      const sigmaMrad = stringSigma(stringNoise, shots);
      // the parts of the noise that do not depend on the velocity spread, so a spread refined by later readings can re-weigh this string
      const { r50Mrad, v0SensMrad, sigmaObsMrad, windSdMrad } = stringNoise;
      const conditions = weather.getValue();
      session.groups.push({
        rangeM: next, targetKey, observedComeUp, shots, sigmaMrad, noise: { r50Mrad, v0SensMrad, sigmaObsMrad, windSdMrad }, mode, certaintyKey, windConfidenceKey: weather.getWindConfidenceKey(),
        ...extraFields,
        // an extra group shot only to unlock a retry does not count against the distance's planned rounds
        ...(isRepeat ? { extra: true } : {}),
        // each group keeps its own readings, its own wind (always) and its own air, so its velocities are compared with the cartridge's velocity in
        // that air (the pooled list stays for counting readings)
        conditions,
        ...(readings.length ? { chronoVelocities: readings } : {})
      });
      registerRecordedGroup(session, next, { retry: RETRY_MISSED_DISTANCE });
      session.repeatAt = null;
      session.lastStringMode = mode;
      session.chronoVelocities.push(...readings);
      missMessage = null;
      ctx.onChange();
      refreshAnalysis();
      renderLadder();
      renderLive();
    }

    // "I can't see where it hit": a real outcome, counted, never reshot at
    // the same range at once; the ladder retreats to real ground between the
    // last validated range and this one, tightens its margin, and proposes
    // nothing at or beyond this range again this session (unless
    // RETRY_MISSED_DISTANCE is on). See registerMissedImpact().
    function missedImpact() {
      session.repeatAt = null;
      const retreat = registerMissedImpact(session, next, candidates);
      missMessage = retreat != null
        ? t('truingSession.shoot.missRetreat', { range: dist(retreat) })
        : t('truingSession.shoot.missNoRetreat');
      ctx.onChange();
      renderLadder();
      renderLive();
    }
    const miss = el('button', { class: 'secondary', i18n: 'truingSession.shoot.cantSeeImpactButton' });
    miss.addEventListener('click', missedImpact);

    for (const child of [
      weather.node,
      nextShotHost,
      el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.shoot.modeLabel' }), modeSelect]),
      averageFields,
      shotsFields,
      picker.node,
      ctx.chronographAvailable ? chronoField : null,
      entryError,
      el('div', { class: 'field-row' }, [record, miss]),
      backdropControl()
    ]) {
      if (child) ladderNode.appendChild(child);
    }
  }

  // The angle a target's come-up is read at: none on a range declared flat, else the one measured this session, else the recorded one.
  function targetAngle(targetKey, target) {
    if (ctx.rangeDeclaredFlat) return 0;
    if (session.angleChecks && session.angleChecks[targetKey] != null) return session.angleChecks[targetKey];
    return (target && target.losAngleDeg) || 0;
  }

  // What to dial for the shot about to be fired: from the live fit (the app's own dope until a group is recorded), in the air
  // and wind that shot will be in, with the fit's uncertainty; windage only predicted, from the called wind and how well
  // the crosswind is known. It is the whole come-up, the number to dial and record, not a correction on top of another.
  // The dope shown for the next shot: the live fit's once there is a group, the app's own before that (null if it cannot be worked out).
  function currentDope(rangeM, targetKey, target, weather) {
    const args = { state, conditions: weather.getValue(), rangeM, knownLosDeg: targetAngle(targetKey, target), windSigma: windSigmaFor(weather.getWindConfidenceKey()) };
    try {
      return analysis
        ? nextShotFromAnalysis({ ...args, analysis })
        : nextShotDope({ ...args, theta: {}, cov: posterior({ state, groups: [], priors: getPriors(), params }).cov, params });
    } catch {
      return null;
    }
  }

  function renderNextShot(host, next, targetKey, target, weather) {
    clear(host);
    const dope = currentDope(next, targetKey, target, weather);
    if (!dope) return;
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
    if (analysisPending) host.appendChild(el('p', { class: 'hint', i18n: 'truingSession.shoot.nextShotUpdating' }));
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
    if (analysisPending) liveNode.appendChild(el('p', { class: 'hint', i18n: 'truingSession.prepare.calculating' }));
    if (!analysis) return;

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
    // governs the rest of the session on its own; writing it back to
    // Arsenal is offered on the Conclude screen.
    const mv = ctx.mvStatus();
    if (mv.override) {
      liveNode.appendChild(el('p', { class: 'hint warning', text: t('truingSession.shoot.sdOverride', { today: vel(mv.override.sd), n: mv.override.sampleSize, recorded: vel(mv.override.recordedSd), used: vel(mv.override.usedSd) }) }));
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
