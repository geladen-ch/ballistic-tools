// The Truing Session tool: a three-phase wizard (Prepare/Shoot/Conclude)
// inside this one route, switched by persisted local state. Reads the
// active rifle/cartridge/location through the app's shared sections and
// state modules, exactly like Trajectory and Hit Probability -- never a
// second rifle or location picker.
import { el, clear } from '../dom.js';
import { t } from '../i18n.js';
import { rifleSection } from '../ui/sections/rifle-section.js';
import { cartridgeSection } from '../ui/sections/cartridge-section.js';
import { gunsSummary } from '../ui/sections/guns-summary.js';
import { loadRifleState, loadAtmosphereState } from '../shot-state.js';
import { loadUserRifles, saveUserRifle } from '../user-library.js';
import { goToGuns } from '../guns-nav.js';
import { goToLocations } from '../locations-nav.js';
import { loadUserLocations } from '../location-library.js';
import { loadRangeSolverLocationState } from '../range-solver-state.js';
import { locationPickerButton } from '../ui/locations/location-picker-button.js';
import { formatTargetSummary } from '../ui/locations/target-summary.js';
import { loadTruingSessionState, saveTruingSessionState, clearTruingSessionKeys } from '../truing-session-state.js';
import {
  rangeAtMach, SUPERSONIC_MACH, DEFAULT_LADDER_CONFIDENCE_Z
} from '../engine/truing-session.js';
import { homeworkAndEquipmentPanel, locationIntakePanel } from '../ui/truing-session/entry-gate.js';
import { optimalRangePanel, rangeGradingPanel, roundBudgetPanel, calculatingPanel } from '../ui/truing-session/range-grading.js';
import { requestPrepare, requestAnalysis } from '../ui/truing-session/prepare-planner.js';
import { shootPanel } from '../ui/truing-session/shoot-panel.js';
import { conclusionPanel } from '../ui/truing-session/conclusion.js';
import { verticalClickMradFrom, horizontalClickMradFrom } from '../ui/truing-session/certainty-picker.js';
import { sessionOnlyNotice } from '../ui/truing-session/recheck-prompt.js';
import { conditionsCard, conditionsSummary } from '../ui/truing-session/conditions.js';
import { dist, angle, missExample } from '../ui/truing-session/units.js';
import {
  sessionTargets, sessionParams, reportedCauses, livePriors, effectiveMvSd, buildObservations, wholePlan,
  homeworkCheckAxes, workingRangeMax, chronoCount, farTargetCheckPrompt, homeworkTicked, withPlanKeys, bcCorrectionOffer, measuredRangeM,
  DEFAULT_ROUND_BUDGET
} from '../ui/truing-session/session-model.js';

// Everything "start a new session" clears. Preferences -- the homework
// slice, which carries the precision/SD preset picks, wind confidence and
// backdrop height -- survive, except the day-specific checks below.
const SESSION_KEYS = [
  'phase', 'plan', 'shootSession', 'targetOverrides', 'pendingTargetEdits', 'naturalTargets',
  'rangeRecheckedThisSession', 'rangeDeclaredFlat', 'naturalTargetsAnswer', 'naturalGapsClosed', 'bcDecision',
  'conditionsConfirmed', 'sessionConditions'
];
const DAY_SPECIFIC_HOMEWORK = ['zeroVerified', 'mvAverageChecked'];

function findActiveArsenalConfig() {
  const rifleState = loadRifleState();
  if (!rifleState || !rifleState.library) return null;
  const { rifleId, cartridgeId } = rifleState.library;
  const rifleRecord = loadUserRifles().find((r) => r.id === rifleId);
  if (!rifleRecord) return null;
  const cartridge = (rifleRecord.cartridges || []).find((c) => c.id === cartridgeId);
  if (!cartridge) return null;
  return { rifleRecord, cartridge };
}

function emptyShootSession() {
  return {
    groups: [], missedImpactCount: 0, missedRanges: [], retryRanges: [], retriedMisses: [], triedRanges: [],
    farthestValidatedM: null, confidenceZ: DEFAULT_LADDER_CONFIDENCE_Z, retreatTo: null,
    rangeChecks: [], angleChecks: {}, measuredRanges: {}, mvDecision: null
  };
}

export function mount(container) {
  clear(container);
  let disposed = false;
  // The last live analysis's warm start (see engine warmContext): kept only in memory for this mount, handed to the next
  // analysis, which uses it only if made for the same state, priors and parameters and falls back to a cold start otherwise.
  let liveWarm = null;
  const sessionState = { ...(loadTruingSessionState() || {}) };

  const root = el('div', { class: 'truing-session-view' });
  container.appendChild(root);

  const arsenalConfig = findActiveArsenalConfig();
  if (!arsenalConfig) {
    root.appendChild(el('h1', { i18n: 'truingSession.title' }));
    root.appendChild(el('p', { i18n: 'truingSession.gate.needsArsenal' }));
    const goButton = el('button', { i18n: 'truingSession.gate.goToGunsButton' });
    goButton.addEventListener('click', goToGuns);
    root.appendChild(goButton);
    return () => { disposed = true; };
  }
  const { rifleRecord, cartridge } = arsenalConfig;

  const locationState = loadRangeSolverLocationState() || {};
  const activeLocation = locationState.locationId
    ? loadUserLocations().find((l) => l.id === locationState.locationId) || null
    : null;
  if (!activeLocation || activeLocation.targets.length === 0) {
    root.appendChild(el('h1', { i18n: 'truingSession.title' }));
    root.appendChild(el('p', { i18n: 'truingSession.gate.needsLocation' }));
    root.appendChild(locationPickerButton({ label: t('truingSession.gate.openLocationsButton'), onClick: goToLocations }));
    return () => { disposed = true; };
  }

  root.appendChild(el('h1', { text: t('truingSession.headingFor', { cartridge: cartridge.name, rifle: rifleRecord.name }) }));
  root.appendChild(gunsSummary({ bare: true }).node);

  // ---- persisted state ----
  function getPersisted(key, defaultValue) {
    return key in sessionState ? sessionState[key] : defaultValue;
  }
  function setPersisted(patch) {
    Object.assign(sessionState, patch);
    saveTruingSessionState(patch);
  }
  const homework = () => getPersisted('homeworkState', {});
  const setHomework = (patch) => setPersisted({ homeworkState: { ...homework(), ...patch } });

  // ---- the engine state ----
  // Rifle/cartridge/atmosphere sections are never rendered (no rifle picker
  // of this tool's own), only read -- wired exactly as
  // Trajectory wires them, so the Arsenal cartridge (bullet, MV, BC gain)
  // and its zero donor actually govern the values. Both resolve
  // asynchronously; a change re-renders the current phase.
  let lastStateKey = null;
  let rerenderPending = false;
  function onSectionsChanged() {
    if (disposed || rerenderPending) return;
    rerenderPending = true;
    setTimeout(() => {
      rerenderPending = false;
      if (disposed) return;
      if (JSON.stringify(baseState()) !== lastStateKey) renderPhase();
    }, 0);
  }
  const cartridgeUi = cartridgeSection({ onInput: onSectionsChanged });
  const rifle = rifleSection({ onInput: onSectionsChanged, onLibraryCartridgeChange: (c) => cartridgeUi.setLibraryCartridge(c) });

  // The air and wind are this tool's own inputs, kept in the session state: the app's shared atmosphere (lost on reload,
  // a default when never set) only seeds them the first time. At Start they are frozen into the session (`sessionConditions`),
  // so weather entered or changed elsewhere afterwards cannot alter the analysis of shots already fired.
  if (!getPersisted('conditions', null)) {
    const shared = loadAtmosphereState();
    if (shared) setPersisted({ conditions: { ...shared } });
  }
  let conditionsTimer = null;
  let refreshPrepareStart = null; // the Prepare screen's Start button, while that screen is showing
  // the planning worker's last answer for the Prepare screen ({ key, data }), and the number of the newest request sent to it
  let prepareResult = null;
  let prepareTicket = 0;
  // the newest Conclude analysis asked for (an answer to an older one is dropped)
  let concludeTicket = 0;
  function onConditionsInput() {
    // one re-render after the typing stops: the plan is recomputed for the new air, and typing must not lose its focus
    clearTimeout(conditionsTimer);
    conditionsTimer = setTimeout(onSectionsChanged, 400);
  }
  const conditions = conditionsCard({
    load: () => getPersisted('conditions', null),
    save: (partial) => setPersisted({ conditions: { ...(getPersisted('conditions', null) || {}), ...partial } }),
    getLocationAltitudeM: () => activeLocation.altitudeM ?? null,
    getConfirmed: () => getPersisted('conditionsConfirmed', false),
    setConfirmed: (v) => { setPersisted({ conditionsConfirmed: v }); if (refreshPrepareStart) refreshPrepareStart(); },
    onInput: onConditionsInput
  });
  const conditionsHost = el('div');
  root.appendChild(conditionsHost);
  // The values the analysis runs in: what is on the card while preparing, the frozen copy once the session has started.
  const sessionConditionValues = () => (phase !== 'prepare' && getPersisted('sessionConditions', null)) || conditions.getValues();

  // Spin drift is ignored for every zero consideration here: the tool is
  // vertical-only, so no spin-drift mode and no spin-drift zeroing.
  function baseState() {
    return {
      ...cartridgeUi.getValues(),
      ...rifle.getValues(),
      ...sessionConditionValues(),
      bcGainFactor: cartridge.bcGainFactor ?? 1,
      zeroDonorBallistics: rifle.getZeroDonorBallistics(),
      zeroForSpinDrift: false
    };
  }

  const phaseContainer = el('div', {});
  root.appendChild(phaseContainer);
  let phase = getPersisted('phase', 'prepare');
  function goToPhase(next) {
    phase = next;
    setPersisted({ phase });
    renderPhase();
  }

  const targets = () => sessionTargets({
    location: activeLocation, targetOverrides: getPersisted('targetOverrides', {}), naturalTargets: getPersisted('naturalTargets', [])
  });

  function shootSession() {
    return { ...emptyShootSession(), ...(getPersisted('shootSession', null) || {}) };
  }

  // A registered target's distance/angle corrected mid-session is kept for this session only; the notice saying so survives a
  // re-render until it is dismissed.
  let pendingLocationNotice = null;

  // A re-render replaces every control of the phase, and a control that is being typed in must not be one of them.
  // The conditions card is never rebuilt (it stays in its host from one render to the next); for anything else that had the
  // focus, put the focus back on the control in the same position once the phase has been drawn.
  const controlsOf = (node) => (typeof node.querySelectorAll === 'function' ? [...node.querySelectorAll('input, select, textarea, button')] : []);
  function captureFocus() {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (!active || !phaseContainer.contains || !phaseContainer.contains(active)) return null;
    return { index: controlsOf(phaseContainer).indexOf(active) };
  }
  function restoreFocus(focus) {
    if (!focus || focus.index < 0) return;
    const target = controlsOf(phaseContainer)[focus.index];
    if (target && typeof target.focus === 'function') target.focus();
  }
  // a re-render after typing or editing has stopped, not on every change
  let renderTimer = null;
  function scheduleRender(ms = 400) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => { if (!disposed) renderPhase(); }, ms);
  }

  function renderPhase() {
    if (disposed) return;
    clearTimeout(renderTimer);
    const focus = captureFocus();
    clear(phaseContainer);
    const state = baseState();
    lastStateKey = JSON.stringify(state);
    refreshPrepareStart = null;
    if (phase === 'prepare') {
      if (conditions.node.parentNode !== conditionsHost) conditionsHost.appendChild(conditions.node);
      // the cartridge's zero atmosphere (Arsenal) is where the zero was set; the engine reads it from the state
      conditions.refreshZeroNote(state.zeroAtmosphere ?? null, state.zeroRange);
    } else {
      clear(conditionsHost);
    }
    if (phase !== 'prepare') phaseContainer.appendChild(el('p', { class: 'hint', text: t('truingSession.conditions.used', { summary: conditionsSummary(sessionConditionValues()) }) }));
    if (pendingLocationNotice) phaseContainer.appendChild(pendingLocationNotice());
    if (phase === 'prepare') renderPrepare(state);
    else if (phase === 'shoot') renderShoot(state);
    else renderConclude(state);
    restoreFocus(focus);
  }

  // ---- Prepare ----
  function renderPrepare(state) {
    const homeworkPanel = homeworkAndEquipmentPanel({
      cartridge,
      persisted: { getPersisted: (k, d) => (k in homework() ? homework()[k] : d), setPersisted: setHomework },
      onInput: () => refreshReadouts()
    });
    setHomework(homeworkPanel.getState());

    const all = targets();
    const registered = all.filter((tg) => tg.registered).map((tg) => tg.rangeM);
    const allDistances = all.map((tg) => tg.rangeM);
    // Every number below comes from the planning worker (prepare-compute.js); until it answers, the panels say they are calculating.
    // A result for exactly the same inputs is drawn at once, so redrawing the screen does not start over.
    const requestFor = (h) => ({ state, homework: h, availableDistances: allDistances, registeredDistances: registered, roundBudget: h.roundBudget || null });
    const keyOf = (request) => JSON.stringify(request);
    const ready = prepareResult && prepareResult.key === keyOf(requestFor(homework())) ? prepareResult.data : null;

    // Top to bottom: what to bring, what to have done, the best distances, the distances to re-check, whether this range will do,
    // and how many rounds to bring.
    // the expected wind belongs with the weather above, in the conditions card
    clear(conditions.windHost);
    conditions.windHost.appendChild(homeworkPanel.windStrengthNode);
    phaseContainer.appendChild(homeworkPanel.equipmentNode);
    phaseContainer.appendChild(homeworkPanel.homeworkNode);
    const optimalHost = el('div');
    phaseContainer.appendChild(optimalHost);

    const intake = locationIntakePanel({
      location: activeLocation, gaps: ready ? ready.gaps : null,
      persisted: { getPersisted, setPersisted },
      backdropNode: homeworkPanel.backdropNode,
      onChangeLocation: goToLocations,
      // an edited distance or angle is applied when the field is left; drawing again at once would destroy the field the
      // shooter tabbed into, so those wait for a pause
      onCommit: (edited) => (edited ? scheduleRender() : renderPhase())
    });
    phaseContainer.appendChild(intake.node);

    const gradingHost = el('div');
    phaseContainer.appendChild(gradingHost);
    const farCheckHost = el('div');
    phaseContainer.appendChild(farCheckHost);
    const roundsPanel = roundBudgetPanel({ onChange: (n) => { setHomework({ roundBudget: n }); refreshReadouts(); } });
    phaseContainer.appendChild(roundsPanel.node);
    const startBlockedHint = el('p', { class: 'hint warning', i18n: 'truingSession.prepare.startBlockedHint' });
    const startBlockedConditions = el('p', { class: 'hint warning', i18n: 'truingSession.prepare.startBlockedConditions' });
    const startButton = el('button', { i18n: 'truingSession.prepare.startShootingButton' });
    let currentPlan = null;
    startButton.addEventListener('click', () => {
      if (!currentPlan) return;
      setPersisted({ plan: withPlanKeys(currentPlan, targets()), sessionConditions: conditions.getValues(), shootSession: getPersisted('shootSession', null) || emptyShootSession() });
      goToPhase('shoot');
    });

    function refreshStart() {
      const recheckedYet = intake.getRangeRecheckedThisSession();
      const conditionsConfirmed = conditions.isConfirmed();
      startButton.disabled = !recheckedYet || !conditionsConfirmed || !currentPlan;
      startBlockedHint.style.display = recheckedYet ? 'none' : '';
      startBlockedConditions.style.display = conditionsConfirmed ? 'none' : '';
    }
    function drawReadouts(data) {
      const h = homework();
      clear(optimalHost);
      optimalHost.appendChild(optimalRangePanel({ state, data }).node);
      clear(gradingHost);
      const grading = rangeGradingPanel({ homework: h, data });
      gradingHost.appendChild(grading.node);
      currentPlan = grading.plan;
      roundsPanel.update({ advice: data.advice, roundBudget: data.roundBudget, isDefault: data.isDefault });
      intake.setGaps(data.gaps);
      clear(farCheckHost);
      const farCheck = currentPlan && farTargetCheckPrompt({ planRanges: currentPlan.ranges, rangeDeclaredFlat: intake.getRangeDeclaredFlat() });
      if (farCheck) {
        farCheckHost.appendChild(el('p', {
          class: 'hint warning',
          text: t(farCheck.needsAngle ? 'truingSession.prepare.farCheckDistanceAngle' : 'truingSession.prepare.farCheckDistance', { far: dist(farCheck.farM), err: dist(20), cost: angle(0.3, 1), ...missExample() })
        }));
      }
      refreshStart();
    }
    function refreshReadouts() {
      setHomework(homeworkPanel.getState());
      const request = requestFor(homework());
      const key = keyOf(request);
      if (prepareResult && prepareResult.key === key) { drawReadouts(prepareResult.data); return; }
      // the newest request wins: an answer to an older one is dropped
      const ticket = ++prepareTicket;
      currentPlan = null;
      clear(optimalHost);
      optimalHost.appendChild(calculatingPanel('truingSession.prepare.optimalHeading'));
      clear(gradingHost);
      gradingHost.appendChild(calculatingPanel('truingSession.rangeGrading.heading'));
      clear(farCheckHost);
      roundsPanel.calculating();
      refreshStart();
      requestPrepare(request).then((data) => {
        if (disposed || ticket !== prepareTicket) return;
        prepareResult = { key, data };
        drawReadouts(data);
      }, () => {
        if (disposed || ticket !== prepareTicket) return;
        clear(gradingHost);
        gradingHost.appendChild(el('p', { class: 'hint warning', i18n: 'truingSession.prepare.calculationFailed' }));
      });
    }
    if (ready) drawReadouts(ready); else refreshReadouts();
    refreshPrepareStart = refreshStart;

    phaseContainer.appendChild(startBlockedHint);
    phaseContainer.appendChild(startBlockedConditions);
    phaseContainer.appendChild(startButton);
  }

  // ---- shared by Shoot and Conclude ----
  function sessionContext(state) {
    const hw = homework();
    const session = shootSession();
    const tgs = targets();
    const params = sessionParams(hw);
    const rangeDeclaredFlat = getPersisted('rangeDeclaredFlat', false);
    const clickMrad = verticalClickMradFrom(rifle);
    let plan = getPersisted('plan', null);
    if (!plan) {
      const p = wholePlan({ state, availableDistances: tgs.map((tg) => tg.rangeM), homework: hw, roundBudget: hw.roundBudget || DEFAULT_ROUND_BUDGET, params });
      plan = p ? withPlanKeys({ ranges: p.ranges, shots: p.shots, targets: p.targets }, tgs) : { ranges: [], shots: [] };
    }
    const mvStatus = () => effectiveMvSd({ homework: hw, state, groups: session.groups });
    const observations = () => {
      const mv = mvStatus();
      return buildObservations({ state, session, targets: tgs, rangeDeclaredFlat, mvSD: mv.mvSD, mvSdSampleSize: mv.mvSdSampleSize });
    };
    // The analysis runs in the planning worker (it enumerates many hypotheses, more with every ticked homework item it checks):
    // resolves with analyseSession's result. `widen`: the drag prior as a missed impact has widened it (Shoot: the ladder and the
    // dope), or as it was (Conclude); see livePriors.
    const analyse = (obs, { widen = true } = {}) => {
      const priors = livePriors(hw, session, { state, widen });
      return requestAnalysis({
        // the distances are taken as possibly mis-ranged (10 %) even once the shooter has confirmed them: simulated, the lower
        // 'rechecked' prior (2 %) was too confident even when true, and cost wrong BC corrections whenever mis-ranging was commoner
        state, observations: obs, priors, params, rechecked: false,
        rMax: workingRangeMax({ state, targets: tgs, session }), clickMrad, chronoN: chronoCount(session),
        targets: tgs, plan, triedRanges: session.triedRanges, missedRanges: session.missedRanges, warm: liveWarm,
        extraAxes: homeworkCheckAxes(hw, priors), causes: reportedCauses(hw)
      }).then((result) => { if (widen) liveWarm = result.warm; return result; });
    };
    const persistSession = () => setPersisted({ shootSession: session });
    return { hw, session, tgs, params, get priors() { return livePriors(hw, session, { state }); }, rangeDeclaredFlat, clickMrad, plan, mvStatus, observations, analyse, persistSession };
  }

  // Record the re-check: the new readings are what the target is shown at and its next shot worked out for from now on. A
  // registered target's location is never written to; the notice says the corrected values hold for this session only.
  // `believedRangeM` is the distance the target's strings are recorded at (see measuredRangeM).
  function handleRecheck(ctx, targetKey, believedRangeM, { newReadingM, angleDeg }) {
    const { session } = ctx;
    const tg = ctx.tgs.find((x) => x.key === targetKey);
    const fromRangeM = measuredRangeM(session, targetKey, believedRangeM);
    const fromAngleDeg = session.angleChecks && session.angleChecks[targetKey] != null ? session.angleChecks[targetKey] : (tg ? tg.losAngleDeg || 0 : 0);
    session.rangeChecks.push({ targetKey, believedRangeM, newReadingM });
    session.measuredRanges = { ...session.measuredRanges, [targetKey]: newReadingM };
    if (angleDeg != null) session.angleChecks = { ...session.angleChecks, [targetKey]: angleDeg };
    ctx.persistSession();
    const rangeChanged = dist(newReadingM) !== dist(fromRangeM);
    const angleChanged = angleDeg != null && !ctx.rangeDeclaredFlat && angleDeg.toFixed(1) !== fromAngleDeg.toFixed(1);
    if (tg && tg.registered && (rangeChanged || angleChanged)) {
      const name = tg.name || formatTargetSummary(tg.rangeM, tg.losAngleDeg);
      const changes = [];
      if (rangeChanged) changes.push({ name, field: 'range', from: fromRangeM, to: newReadingM });
      if (angleChanged) changes.push({ name, field: 'angle', from: fromAngleDeg, to: angleDeg });
      pendingLocationNotice = () => sessionOnlyNotice({ changes, onDismiss: () => { pendingLocationNotice = null; renderPhase(); } }).node;
    }
    renderPhase();
  }

  // ---- Shoot ----
  function renderShoot(state) {
    const ctx = sessionContext(state);
    const panel = shootPanel({
      state, params: ctx.params, getPriors: () => ctx.priors, session: ctx.session, targets: ctx.tgs, plan: ctx.plan,
      ceiling: rangeAtMach(state, SUPERSONIC_MACH), clickMrad: ctx.clickMrad, clickHorizontalMrad: horizontalClickMradFrom(rifle), rangeDeclaredFlat: ctx.rangeDeclaredFlat,
      r50Mrad: ctx.hw.r50Mrad, chronographAvailable: !!ctx.hw.chronographAvailable, startConditions: sessionConditionValues(),
      getHomework: homework, setHomework,
      buildObservations: ctx.observations, analyse: ctx.analyse, mvStatus: ctx.mvStatus,
      onChange: ctx.persistSession,
      onRecheck: (key, rangeM, reading) => handleRecheck(ctx, key, rangeM, reading),
      onAddNaturalTarget: (rangeM) => {
        const natural = getPersisted('naturalTargets', []);
        if (!natural.some((n) => n.rangeM === rangeM)) setPersisted({ naturalTargets: [...natural, { rangeM }] });
        renderPhase();
      }
    });
    phaseContainer.appendChild(panel.node);
    const concludeButton = el('button', { i18n: 'truingSession.shoot.goToConcludeButton' });
    concludeButton.addEventListener('click', () => goToPhase('conclude'));
    phaseContainer.appendChild(concludeButton);
  }

  function saveCartridgePatch(patch) {
    const fresh = loadUserRifles().find((r) => r.id === rifleRecord.id) || rifleRecord;
    saveUserRifle({ ...fresh, cartridges: fresh.cartridges.map((c) => (c.id === cartridge.id ? { ...c, ...patch } : c)) });
  }

  // ---- Conclude ----
  function renderConclude(state) {
    const ctx = sessionContext(state);
    if (!ctx.session.groups.length) { drawConclusion(state, ctx, null); return; }
    const ticket = ++concludeTicket;
    const waiting = el('p', { class: 'hint', i18n: 'truingSession.prepare.calculating' });
    phaseContainer.appendChild(waiting);
    const observations = ctx.observations();
    // Conclude fits on the usual drag prior. When that finds the drag scale implausible after a miss that widened the prior,
    // the information line under the warning comes from a second fit on the widened prior: the usual one holds a grossly wrong
    // BC back towards the published figure, and the number shown is there to help find the right one.
    const widenedDrag = (analysis) => {
      const f = analysis.findings.find((x) => x.case === 3);
      if (!f || !bcCorrectionOffer({ state, dragPct: f.value }).implausible) return Promise.resolve(null);
      if (!(livePriors(ctx.hw, ctx.session, { state }).dragPct > livePriors(ctx.hw, ctx.session, { state, widen: false }).dragPct)) return Promise.resolve(null);
      return ctx.analyse(observations, { widen: true }).then((wide) => wide.theta.dragPct, () => null);
    };
    ctx.analyse(observations, { widen: false }).then((analysis) => widenedDrag(analysis).then((infoDragPct) => ({ analysis, infoDragPct }))).then(({ analysis, infoDragPct }) => {
      if (disposed || ticket !== concludeTicket || phase !== 'conclude') return;
      if (waiting.parentNode) waiting.parentNode.removeChild(waiting);
      drawConclusion(state, ctx, analysis, infoDragPct);
    }, () => {
      if (disposed || ticket !== concludeTicket) return;
      waiting.textContent = t('truingSession.prepare.calculationFailed');
    });
  }
  function drawConclusion(state, ctx, analysis, infoDragPct = null) {
    const panel = conclusionPanel({
      analysis, state, infoDragPct, clickMrad: ctx.clickMrad, session: ctx.session, rangeDeclaredFlat: ctx.rangeDeclaredFlat,
      rMax: workingRangeMax({ state, targets: ctx.tgs, session: ctx.session }),
      conditionsText: conditionsSummary(sessionConditionValues()), homeworkTicked: homeworkTicked(ctx.hw), mvSD: ctx.mvStatus().mvSD,
      cartridgeName: cartridge.name, bcDecision: getPersisted('bcDecision', null),
      mvOverride: ctx.mvStatus().override, mvSdSaved: ctx.session.mvDecision === 'arsenal',
      onMvSdToArsenal: (sd) => {
        // Stored as measured; rounding is for display only, in whatever velocity unit is shown.
        saveCartridgePatch({ muzzleVelocitySD: sd });
        ctx.session.mvDecision = 'arsenal';
        ctx.persistSession();
        renderPhase();
      },
      onSaveBc: (newFactor) => {
        saveCartridgePatch({ bcGainFactor: newFactor });
        setPersisted({ bcDecision: { kind: 'saved', fromFactor: state.bcGainFactor ?? 1, toFactor: newFactor } });
        renderPhase();
      },
      onRecheck: (key, rangeM, reading) => handleRecheck(ctx, key, rangeM, reading),
      onNewSession: () => {
        clearTruingSessionKeys(SESSION_KEYS);
        for (const k of SESSION_KEYS) delete sessionState[k];
        const hw = { ...homework() };
        for (const k of DAY_SPECIFIC_HOMEWORK) delete hw[k];
        setPersisted({ homeworkState: hw });
        pendingLocationNotice = null;
        goToPhase('prepare');
      }
    });
    phaseContainer.appendChild(panel.node);
  }

  renderPhase();
  return () => { disposed = true; };
}
