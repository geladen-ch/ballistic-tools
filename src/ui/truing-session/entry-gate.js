// The entry gate: the homework/equipment checklist and the location intake
// (re-checking every target's distance and angle, declaring the range
// flat, adding natural targets to fill a gap) -- everything that resolves
// the priors and the availableDistances every later screen depends on.
// The rifle header and the Arsenal/location preconditions live in
// truing-session-view.js, since they gate whether this is shown at all.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { FIELD_BOUNDS } from '../../units.js';
import { unitField } from '../unit-field.js';
import { presetUnitField, RIG_PRESET_KEY, MUZZLE_VELOCITY_SD_PRESETS, DEFAULT_MUZZLE_VELOCITY_SD_PRESET_KEY } from '../precision-preset-field.js';
import { riflePrecisionInputs } from '../rifle-precision-inputs.js';
import { precisionToR50 } from '../../engine/dispersion-sources.js';
import { radToMrad } from '../../quantity.js';
import { formatTargetSummary } from '../locations/target-summary.js';
import { locationPickerButton } from '../locations/location-picker-button.js';
import { DEFAULT_BACKDROP_MARGIN_M } from '../../engine/truing-session.js';
import { WIND_STRENGTHS, DEFAULT_WIND_STRENGTH, WIND_STRENGTH_LIMIT_MS } from './session-model.js';
import { dist, distLabel, toDisplayDistance, fromDisplayDistance, distanceFromField, windStrengthLimit, angle, angleRuleKey, arsenalMuzzleVelocity } from './units.js';

const MIN_RECOMMENDED_BACKDROP_M = 2;

// `warning`: the label in the warning colour, for a confirmation the shooter has to give before going on.
// `text`: the label as already worked out (with figures in it), in place of the translation key.
export function checkboxRow(id, labelKey, checked, onChange, { warning = false, text = null } = {}) {
  const checkbox = el('input', { type: 'checkbox', id });
  checkbox.checked = !!checked;
  checkbox.addEventListener('change', () => onChange(checkbox.checked));
  return { checkbox, row: el('label', { class: warning ? 'checkbox-field warning' : 'checkbox-field' }, [checkbox, el('span', text != null ? { text } : { i18n: labelKey })]) };
}

function smallNumberInput({ value, min, max, step = 1, onChange }) {
  const input = el('input', { type: 'number', min, max, step, value: value ?? '' });
  input.addEventListener('change', () => {
    const v = parseFloat(input.value);
    onChange(Number.isFinite(v) ? v : null);
  });
  return input;
}

// `persisted`: { getPersisted, setPersisted } over the homework slice of
// the session state -- one slice for reads and writes alike, including the
// keys presetUnitField() persists for itself.
export function homeworkAndEquipmentPanel({ cartridge, persisted, onInput }) {
  const { getPersisted, setPersisted } = persisted;
  const set = (patch) => { setPersisted(patch); onInput(); };

  // ---- Homework ----
  const sightHeight = checkboxRow('truingSightHeight', 'truingSession.homework.sightHeightMeasured', getPersisted('sightHeightMeasured', false), (v) => set({ sightHeightMeasured: v }));
  const zeroVerified = checkboxRow('truingZeroVerified', 'truingSession.homework.zeroVerified', getPersisted('zeroVerified', false), (v) => set({ zeroVerified: v }));
  const trackTested = checkboxRow('truingTrackTested', 'truingSession.homework.trackTested', getPersisted('trackTested', false), (v) => set({ trackTested: v }));

  // The muzzle velocity average: what the Arsenal entry holds is shown in the label, since that is the number being verified.
  const arsenalMv = arsenalMuzzleVelocity(cartridge);
  const mvAverageChecked = checkboxRow('truingMvAverageChecked', 'truingSession.homework.mvAverageChecked', getPersisted('mvAverageChecked', false), (v) => set({ mvAverageChecked: v }), {
    text: t('truingSession.homework.mvAverageChecked', {
      arsenal: arsenalMv.drift ? t('truingSession.homework.mvArsenalWithDrift', { velocity: arsenalMv.velocity, ...arsenalMv.drift }) : t('truingSession.homework.mvArsenal', { velocity: arsenalMv.velocity })
    })
  });
  // With a chronograph the session double-checks the velocity itself; without one this is the item that matters most
  const mvAverageHint = el('p', { class: 'hint' });
  const refreshMvAverageHint = () => {
    mvAverageHint.textContent = t(chrono.checkbox.checked ? 'truingSession.homework.mvAverageHintChrono' : 'truingSession.homework.mvAverageHintNoChrono');
  };

  // Rifle + shooter precision, as in Hit Probability: bench rifle R50, shooter skill and position, or one simplified combined
  // value. The session's per-shot noise takes the one R50 they resolve to (vertical, since come-up is what it reads).
  const r50Resolved = el('p', { class: 'hint' });
  const refreshR50Resolved = () => { r50Resolved.textContent = t('truingSession.homework.r50Resolved', { value: angle(radToMrad(precisionToR50(precision.getValues()))) }); };
  const precision = riflePrecisionInputs({ getPersisted, setPersisted, rigHints: false, onInput: () => { refreshR50Resolved(); onInput(); } });
  // The Arsenal value is auto-selected unless the user explicitly picked something else; a saved "This rig" pick is
  // restored here, since the rig option only exists once setRigValue() has added it.
  const rigWanted = (key) => { const saved = getPersisted(key); return !saved || saved === RIG_PRESET_KEY; };
  const hasRigR50 = cartridge.precision && cartridge.precision.r50Mrad != null;
  precision.setRigPrecision(hasRigR50 ? { mode: 'own', ...cartridge.precision } : null, { force: precision.rigStillWanted() });
  refreshR50Resolved();
  const r50Hint = hasRigR50
    ? el('p', { class: 'hint', text: t('truingSession.homework.r50FromArsenal', { value: angle(cartridge.precision.r50Mrad) }) })
    : el('p', { class: 'hint' }, [
      el('span', { i18n: 'truingSession.homework.r50Missing' }), ' ',
      el('a', { href: '#/rifle-precision', i18n: 'truingSession.homework.r50Link' })
    ]);

  const mvSDField = presetUnitField({
    id: 'muzzleVelocitySD', presetList: MUZZLE_VELOCITY_SD_PRESETS, defaultKey: DEFAULT_MUZZLE_VELOCITY_SD_PRESET_KEY,
    labelPrefix: 'hitProbability.presetLabels.', max: 20, step: 0.5,
    onInput: () => onInput(), getPersisted, setPersisted
  });
  if (cartridge.muzzleVelocitySD != null) {
    mvSDField.setRigValue(cartridge.muzzleVelocitySD, { autoSelect: rigWanted('muzzleVelocitySDPreset') });
  }
  const mvSdShotsInput = smallNumberInput({ value: getPersisted('mvSdShots', null), min: 2, max: 200, onChange: (v) => set({ mvSdShots: v }) });

  // Only the expected strength is asked here: the wind itself is read, and its confidence stated, for every group on the Shoot screen.
  // A choice saved by the earlier ±m/s dropdown (3 m/s and up) was a strong wind.
  const savedStrength = getPersisted('windStrength', null) ?? (getPersisted('windConfidenceMs', 0) >= 3 ? 'strong' : DEFAULT_WIND_STRENGTH);
  const windSelect = el('select', { id: 'truingWindStrength' }, Object.keys(WIND_STRENGTHS).map((key) => el('option', {
    value: key, text: t(`truingSession.homework.windStrength.${key}`, { limit: windStrengthLimit(WIND_STRENGTH_LIMIT_MS) })
  })));
  windSelect.value = WIND_STRENGTHS[savedStrength] ? savedStrength : DEFAULT_WIND_STRENGTH;
  windSelect.addEventListener('change', () => set({ windStrength: windSelect.value }));

  const homeworkSection = el('div', { class: 'input-section' }, [
    el('h3', { i18n: 'truingSession.homework.heading' }),
    el('p', { class: 'hint', i18n: 'truingSession.homework.intro' }),
    sightHeight.row,
    zeroVerified.row,
    el('p', { class: 'hint', i18n: 'truingSession.homework.zeroHint' }),
    trackTested.row,
    el('p', { class: 'hint', text: t('truingSession.homework.trackHint', { rule: t(angleRuleKey()) }) }),
    precision.node,
    r50Hint,
    r50Resolved,
    mvAverageChecked.row,
    mvAverageHint,
    mvSDField.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.homework.mvSdShotsLabel' }), mvSdShotsInput])
  ]);

  // Shown with the conditions (it is about the weather at the range), kept here with the rest of the homework slice's state.
  const windStrengthSection = el('div', {}, [
    el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.homework.windStrengthLabel' }), windSelect]),
    el('p', { class: 'hint', i18n: 'truingSession.homework.windStrengthHint' })
  ]);

  // ---- Equipment ----
  const chrono = checkboxRow('truingChronoAvailable', 'truingSession.equipment.chronographLabel', getPersisted('chronographAvailable', false), (v) => { refreshMvAverageHint(); set({ chronographAvailable: v }); });
  refreshMvAverageHint();

  // A single total height, point of aim assumed centred in it; the
  // engine's ladder takes the "each way" half (backdropMarginFrom()).
  const backdropField = unitField({
    id: 'truingBackdropHeight', ...FIELD_BOUNDS.truingBackdropHeight, step: 0.5, value: getPersisted('backdropHeightM', DEFAULT_BACKDROP_MARGIN_M * 2),
    onInput: () => { set({ backdropHeightM: backdropField.getEngineValue() }); refreshBackdropWarning(); }
  });
  // under 2 m (1 m each way) a session loses an impact off the backdrop about a third of the time, against a few in a hundred at 2 m
  const backdropSmall = el('p', { class: 'hint warning', text: t('truingSession.equipment.backdropSmall', { one: dist(1), two: dist(MIN_RECOMMENDED_BACKDROP_M) }) });
  function refreshBackdropWarning() {
    const v = backdropField.getEngineValue();
    backdropSmall.style.display = Number.isFinite(v) && v < MIN_RECOMMENDED_BACKDROP_M ? '' : 'none';
  }
  refreshBackdropWarning();

  const equipmentSection = el('div', { class: 'input-section' }, [
    el('h3', { i18n: 'truingSession.equipment.heading' }),
    el('p', { class: 'hint prominent', i18n: 'truingSession.equipment.rangefinderMandatory' }),
    el('p', { class: 'hint prominent', i18n: 'truingSession.equipment.angleMeterMandatory' }),
    el('p', { class: 'hint prominent', i18n: 'truingSession.equipment.weatherMeterMandatory' }),
    el('p', { class: 'hint prominent', i18n: 'truingSession.equipment.oneLotMandatory' }),
    el('p', { class: 'hint', i18n: 'truingSession.equipment.spotterRecommended' }),
    el('p', { class: 'hint', i18n: 'truingSession.equipment.rangeVisibleImpacts' }),
    chrono.row,
    el('p', { class: 'hint', i18n: 'truingSession.equipment.chronographHint' })
  ]);

  // Shown in the location pane (it is a property of the range), kept here with the rest of the homework slice's state.
  const backdropSection = el('div', {}, [
    backdropField.node,
    el('p', { class: 'hint', text: t('truingSession.equipment.backdropHint', { two: dist(MIN_RECOMMENDED_BACKDROP_M) }) }),
    backdropSmall
  ]);

  function getState() {
    return {
      zeroVerified: zeroVerified.checkbox.checked,
      sightHeightMeasured: sightHeight.checkbox.checked,
      trackTested: trackTested.checkbox.checked,
      mvAverageChecked: mvAverageChecked.checkbox.checked,
      r50Mrad: radToMrad(precisionToR50(precision.getValues())),
      mvSD: mvSDField.getEngineValue(),
      muzzleVelocitySDPreset: getPersisted('muzzleVelocitySDPreset', DEFAULT_MUZZLE_VELOCITY_SD_PRESET_KEY),
      mvSdShots: getPersisted('mvSdShots', null),
      windStrength: windSelect.value,
      chronographAvailable: chrono.checkbox.checked,
      backdropHeightM: backdropField.getEngineValue()
    };
  }

  return { equipmentNode: equipmentSection, homeworkNode: homeworkSection, backdropNode: backdropSection, windStrengthNode: windStrengthSection, getState };
}

// The location intake. `location` is the active location record, never written to: whatever is corrected here holds for this
// truing session only (`targetOverrides`). `persisted` is the top-level session
// slice. `backdropNode`: the backdrop height field, drawn under the location header. `gaps` (null until the planner has worked
// them out, then setGaps()): { nearGap, farGap, alreadyGradeA, zeroRangeM,
// farOptimumM, farBandLowM, farBandHighM } -- whether the near/far target
// bands the planner wants are covered by the saved targets already.
export function locationIntakePanel({ location, gaps, persisted, backdropNode, onCommit, onChangeLocation }) {
  const { getPersisted, setPersisted } = persisted;
  const node = el('div', { class: 'input-section' });
  // the natural-target questions, drawn on their own: the gaps they ask about come from the planner, later than the rest
  const naturalHost = el('div');
  let currentGaps = gaps;

  const targetOverrides = { ...(getPersisted('targetOverrides', {})) };
  const pendingEdits = { ...(getPersisted('pendingTargetEdits', {})) };
  const naturalTargets = [...(getPersisted('naturalTargets', []))];
  let rangeRecheckedThisSession = getPersisted('rangeRecheckedThisSession', false);
  let naturalTargetsAnswer = getPersisted('naturalTargetsAnswer', null);
  const naturalGapsClosed = { ...(getPersisted('naturalGapsClosed', {})) };
  let recheckBox = null; // the confirmation checkbox, while it is on screen

  // The flat-range checkbox: hidden and forced off when a recorded angle is steeper than 5 degrees,
  // otherwise offered UNTICKED. A Location card cannot tell "confirmed flat" from "never measured" (both
  // read as 0), so the tool never assumes flat on the user's behalf -- declaring it withdraws the
  // inclination checks, and an unrecorded slope then has nowhere to go but the distance and drag terms.
  const anySteep = location.targets.some((tg) => Math.abs(tg.losAngleDeg || 0) > 5);
  let rangeDeclaredFlat = anySteep ? false : getPersisted('rangeDeclaredFlat', false);

  function effectiveTarget(tg) {
    return { ...tg, ...(targetOverrides[tg.id] || {}), ...(pendingEdits[tg.id] || {}) };
  }

  function commit(edited = false) {
    setPersisted({ targetOverrides, pendingTargetEdits: pendingEdits, naturalTargets, rangeRecheckedThisSession, rangeDeclaredFlat, naturalTargetsAnswer, naturalGapsClosed });
    if (onCommit) onCommit(edited);
  }

  function pendingChanges() {
    const out = [];
    for (const tg of location.targets) {
      const edit = pendingEdits[tg.id];
      if (!edit) continue;
      const before = { ...tg, ...(targetOverrides[tg.id] || {}) };
      const name = tg.name || formatTargetSummary(tg.rangeM, tg.losAngleDeg);
      if (edit.rangeM != null && edit.rangeM !== before.rangeM) out.push({ name, field: 'range', from: before.rangeM, to: edit.rangeM });
      if (edit.losAngleDeg != null && edit.losAngleDeg !== (before.losAngleDeg || 0)) out.push({ name, field: 'angle', from: before.losAngleDeg || 0, to: edit.losAngleDeg });
    }
    return out;
  }

  function finishRecheck() {
    for (const k of Object.keys(pendingEdits)) delete pendingEdits[k];
    rangeRecheckedThisSession = true;
    commit();
    render();
  }

  function render() {
    clear(node);
    node.appendChild(el('h3', { i18n: 'truingSession.location.heading' }));
    node.appendChild(el('div', { class: 'truing-session-location-header' }, [
      el('span', { class: 'truing-session-location-name', text: location.name }),
      locationPickerButton({ label: t('truingSession.location.changeLocationButtonLabel'), onClick: () => { if (onChangeLocation) onChangeLocation(); } })
    ]));
    if (backdropNode) node.appendChild(backdropNode);

    // The flat-range declaration. A declaration, not a measurement: it
    // never writes an angle anywhere -- it only withdraws the inclination
    // term for this session.
    if (!anySteep) {
      const flat = checkboxRow('truingFlatRange', 'truingSession.location.flatRangeLabel', rangeDeclaredFlat, (v) => { rangeDeclaredFlat = v; commit(); render(); });
      node.appendChild(flat.row);
      node.appendChild(el('p', { class: 'hint', i18n: 'truingSession.location.flatRangeHint' }));
    }

    // Re-check every target's distance and angle before planning around them.
    node.appendChild(el('p', { i18n: 'truingSession.location.recheckInstructions' }));
    node.appendChild(el('p', { class: 'hint prominent', i18n: 'truingSession.location.sessionOnlyHint' }));
    node.appendChild(el('p', { class: 'hint prominent', i18n: 'truingSession.location.backdropDistanceInstructions' }));
    if (!rangeDeclaredFlat) node.appendChild(el('p', { class: 'hint', i18n: 'truingSession.location.recheckAngleInstructions' }));
    const table = el('table', { class: 'truing-session-table' });
    table.appendChild(el('tr', {}, [
      el('th', { i18n: 'truingSession.location.targetColumn' }),
      el('th', { text: t('truingSession.location.rangeColumn', { unit: distLabel() }) }),
      // a range declared flat takes no angles: the column is not there at all
      rangeDeclaredFlat ? null : el('th', { i18n: 'truingSession.location.angleColumn' })
    ]));
    for (const tg of location.targets) {
      const eff = effectiveTarget(tg);
      const rangeInput = el('input', { type: 'number', step: 1, value: toDisplayDistance(eff.rangeM) });
      const angleInput = el('input', { type: 'number', step: 0.1, value: eff.losAngleDeg || 0 });
      const applyEdit = () => {
        // the field shows whole units: an untouched distance keeps the metres it had
        const rangeM = distanceFromField(rangeInput.value, eff.rangeM);
        if (!Number.isFinite(rangeM) || rangeM <= 0) return;
        const edit = { rangeM };
        if (!rangeDeclaredFlat) {
          const losAngleDeg = parseFloat(angleInput.value);
          if (Number.isFinite(losAngleDeg)) edit.losAngleDeg = losAngleDeg;
        }
        pendingEdits[tg.id] = edit;
        if (pendingChanges().length === 0) delete pendingEdits[tg.id];
        else rangeRecheckedThisSession = false;
        if (recheckBox && !rangeRecheckedThisSession) recheckBox.checked = false; // the redraw waits for a pause
        commit(true);
      };
      rangeInput.addEventListener('change', applyEdit);
      angleInput.addEventListener('change', applyEdit);
      table.appendChild(el('tr', {}, [
        el('td', { text: tg.name || formatTargetSummary(tg.rangeM, tg.losAngleDeg) }),
        el('td', {}, [rangeInput]),
        rangeDeclaredFlat ? null : el('td', {}, [angleInput])
      ]));
    }
    node.appendChild(table);

    node.appendChild(el('p', {
      class: rangeRecheckedThisSession ? 'hint' : 'hint warning',
      text: t(rangeRecheckedThisSession ? 'truingSession.location.allCheckedConfirmedHint' : 'truingSession.location.allCheckedRequiredHint')
    }));
    const done = checkboxRow('truingRangeRechecked', 'truingSession.location.allCheckedButton', rangeRecheckedThisSession, (checked) => {
      if (!checked) { rangeRecheckedThisSession = false; commit(); render(); return; }
      // the corrections are kept for this session; the location itself is left as it is
      for (const [id, edit] of Object.entries(pendingEdits)) targetOverrides[id] = { ...(targetOverrides[id] || {}), ...edit };
      finishRecheck();
    }, { warning: true });
    recheckBox = done.checkbox;
    node.appendChild(done.row);

    node.appendChild(naturalHost);
    renderNaturalTargets();
  }

  // Natural-target gap fill: asked only when a gap exists and the saved
  // targets don't already grade A; one Yes/No, then one concrete prompt
  // per open gap, each answerable with a distance or "not available" --
  // never re-asked.
  function renderNaturalTargets() {
    clear(naturalHost);
    if (!currentGaps) return;
    const gaps = currentGaps;
    const node = naturalHost;
    const { nearGap, farGap, alreadyGradeA } = gaps;
    if (alreadyGradeA || (!nearGap && !farGap)) return;
    node.appendChild(el('h4', { i18n: 'truingSession.location.naturalTargetHeading' }));
    if (naturalTargetsAnswer == null) {
      node.appendChild(el('p', { i18n: 'truingSession.location.naturalTargetQuestion' }));
      const yes = el('button', { i18n: 'truingSession.location.naturalYes' });
      yes.addEventListener('click', () => { naturalTargetsAnswer = 'yes'; commit(); render(); });
      const no = el('button', { class: 'secondary', i18n: 'truingSession.location.naturalNo' });
      no.addEventListener('click', () => { naturalTargetsAnswer = 'no'; commit(); render(); });
      node.appendChild(el('div', { class: 'field-row' }, [yes, no]));
      return;
    }
    if (naturalTargetsAnswer === 'no') {
      node.appendChild(el('p', { class: 'hint', i18n: 'truingSession.location.naturalAnsweredNo' }));
      return;
    }
    const openGap = (gap, target, low, high) => {
      node.appendChild(el('p', { text: t('truingSession.location.naturalTargetPrompt', { target: dist(target), low: dist(low), high: dist(high) }) }));
      const input = el('input', { type: 'number', step: 1, placeholder: t('truingSession.location.naturalTargetPlaceholder', { unit: distLabel() }) });
      const add = el('button', { class: 'secondary', i18n: 'truingSession.location.naturalTargetAddButton' });
      add.addEventListener('click', () => {
        const shown = parseFloat(input.value);
        if (!Number.isFinite(shown) || shown <= 0) return;
        naturalTargets.push({ rangeM: fromDisplayDistance(shown) });
        commit();
      });
      const notAvailable = el('button', { class: 'secondary', i18n: 'truingSession.location.naturalNotAvailable' });
      notAvailable.addEventListener('click', () => { naturalGapsClosed[gap] = true; commit(); render(); });
      node.appendChild(el('div', { class: 'field-row' }, [input, add, notAvailable]));
    };
    if (nearGap && !naturalGapsClosed.near) openGap('near', gaps.zeroRangeM, gaps.zeroRangeM, 300);
    if (farGap && !naturalGapsClosed.far) openGap('far', gaps.farOptimumM, gaps.farBandLowM ?? gaps.farOptimumM * 0.9, gaps.farBandHighM);
    if (naturalTargets.length) {
      node.appendChild(el('p', { class: 'hint', i18n: 'truingSession.location.naturalSessionOnly' }));
      node.appendChild(el('ul', {}, naturalTargets.map((nt, i) => {
        const remove = el('button', { class: 'secondary', i18n: 'truingSession.location.removeButton' });
        remove.addEventListener('click', () => { naturalTargets.splice(i, 1); commit(); });
        return el('li', {}, [el('span', { text: `${dist(nt.rangeM)} ` }), remove]);
      })));
    }
  }

  render();
  return {
    node,
    getTargetOverrides: () => targetOverrides,
    getNaturalTargets: () => naturalTargets,
    getRangeRecheckedThisSession: () => rangeRecheckedThisSession,
    getRangeDeclaredFlat: () => rangeDeclaredFlat,
    // the planner's answer about the near and far gaps (null while it is still working)
    setGaps: (g) => {
      if (JSON.stringify(g) === JSON.stringify(currentGaps)) return;
      currentGaps = g;
      renderNaturalTargets();
    }
  };
}
