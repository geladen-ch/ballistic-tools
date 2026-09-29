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
import { presetUnitField, RIG_PRESET_KEY, BENCH_PRECISION_PRESETS, DEFAULT_BENCH_PRECISION_PRESET_KEY, MUZZLE_VELOCITY_SD_PRESETS, DEFAULT_MUZZLE_VELOCITY_SD_PRESET_KEY } from '../precision-preset-field.js';
import { formatTargetSummary } from '../locations/target-summary.js';
import { locationPickerButton } from '../locations/location-picker-button.js';
import { saveUserLocation } from '../../location-library.js';
import { DEFAULT_BACKDROP_MARGIN_M } from '../../engine/truing-session.js';
import { DEFAULT_MV_AVERAGE_SHOTS } from './session-model.js';
import { locationChoice } from './recheck-prompt.js';
import { dist, distLabel, toDisplayDistance, fromDisplayDistance, distanceFromField, windSpeedShort, angle, angleRuleKey } from './units.js';

const MIN_RECOMMENDED_BACKDROP_M = 2;
const WIND_CONFIDENCE_OPTIONS = [0.5, 1, 2, 3, 5];
const DEFAULT_WIND_CONFIDENCE = 2;

// `warning`: the label in the warning colour, for a confirmation the shooter has to give before going on.
export function checkboxRow(id, labelKey, checked, onChange, { warning = false } = {}) {
  const checkbox = el('input', { type: 'checkbox', id });
  checkbox.checked = !!checked;
  checkbox.addEventListener('change', () => onChange(checkbox.checked));
  return { checkbox, row: el('label', { class: warning ? 'checkbox-field warning' : 'checkbox-field' }, [checkbox, el('span', { i18n: labelKey })]) };
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

  const mvShotsInput = smallNumberInput({ value: getPersisted('mvAverageShots', DEFAULT_MV_AVERAGE_SHOTS), min: 2, max: 100, onChange: (v) => set({ mvAverageShots: v }) });
  const mvShotsField = el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.homework.mvAverageShotsLabel' }), mvShotsInput]);
  const mvAverageChecked = checkboxRow('truingMvAverageChecked', 'truingSession.homework.mvAverageChecked', getPersisted('mvAverageChecked', false), (v) => {
    mvShotsField.style.display = v ? '' : 'none';
    set({ mvAverageChecked: v });
  });
  mvShotsField.style.display = mvAverageChecked.checkbox.checked ? '' : 'none';

  const oneLot = checkboxRow('truingOneLot', 'truingSession.homework.oneLot', getPersisted('oneLot', true), (v) => set({ oneLot: v }));
  const coldBore = checkboxRow('truingColdBoreHandled', 'truingSession.homework.coldBoreHandled', getPersisted('coldBoreHandled', false), (v) => set({ coldBoreHandled: v }));

  const r50Field = presetUnitField({
    id: 'benchPrecision', presetList: BENCH_PRECISION_PRESETS, defaultKey: DEFAULT_BENCH_PRECISION_PRESET_KEY,
    labelPrefix: 'hitProbability.presetLabels.', max: 3, step: 0.01,
    onInput: () => onInput(), getPersisted, setPersisted
  });
  // The Arsenal value is auto-selected unless the user explicitly picked
  // something else; a saved "This rig" pick is restored here, since the
  // rig option only exists once setRigValue() has added it.
  const rigWanted = (key) => { const saved = getPersisted(key); return !saved || saved === RIG_PRESET_KEY; };
  const hasRigR50 = cartridge.precision && cartridge.precision.r50Mrad != null;
  if (hasRigR50) r50Field.setRigValue(cartridge.precision.r50Mrad, { autoSelect: rigWanted('benchPrecisionPreset') });
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

  const windSelect = el('select', { id: 'truingWindConfidence' }, WIND_CONFIDENCE_OPTIONS.map((v) => el('option', { value: String(v), text: `±${windSpeedShort(v)}` })));
  windSelect.value = String(getPersisted('windConfidenceMs', DEFAULT_WIND_CONFIDENCE));
  windSelect.addEventListener('change', () => set({ windConfidenceMs: Number(windSelect.value) }));

  const homeworkSection = el('div', { class: 'input-section' }, [
    el('h3', { i18n: 'truingSession.homework.heading' }),
    el('p', { class: 'hint', i18n: 'truingSession.homework.intro' }),
    sightHeight.row,
    zeroVerified.row,
    el('p', { class: 'hint', i18n: 'truingSession.homework.zeroHint' }),
    trackTested.row,
    el('p', { class: 'hint', text: t('truingSession.homework.trackHint', { rule: t(angleRuleKey()) }) }),
    r50Field.node,
    r50Hint,
    mvSDField.node,
    el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.homework.mvSdShotsLabel' }), mvSdShotsInput]),
    el('p', { class: 'hint', i18n: 'truingSession.homework.mvSdHint' }),
    mvAverageChecked.row,
    mvShotsField,
    el('p', { class: 'hint', i18n: 'truingSession.homework.mvAverageHint' }),
    oneLot.row,
    coldBore.row,
    el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.homework.windConfidenceLabel' }), windSelect])
  ]);

  // ---- Equipment ----
  const chrono = checkboxRow('truingChronoAvailable', 'truingSession.equipment.chronographLabel', getPersisted('chronographAvailable', false), (v) => set({ chronographAvailable: v }));

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
    chrono.row,
    el('p', { class: 'hint', i18n: 'truingSession.equipment.chronographHint' }),
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
      mvAverageShots: getPersisted('mvAverageShots', DEFAULT_MV_AVERAGE_SHOTS),
      oneLot: oneLot.checkbox.checked,
      coldBoreHandled: coldBore.checkbox.checked,
      r50Mrad: r50Field.getEngineValue(),
      mvSD: mvSDField.getEngineValue(),
      muzzleVelocitySDPreset: getPersisted('muzzleVelocitySDPreset', DEFAULT_MUZZLE_VELOCITY_SD_PRESET_KEY),
      mvSdShots: getPersisted('mvSdShots', null),
      windConfidenceMs: Number(windSelect.value),
      chronographAvailable: chrono.checkbox.checked,
      backdropHeightM: backdropField.getEngineValue()
    };
  }

  return { node: el('div', {}, [homeworkSection, equipmentSection]), getState };
}

// The location intake. `location` is the active location record (mutated
// in place when "update the main location card" is chosen, so the rest of
// this mount sees the saved values). `persisted` is the top-level session
// slice. `gaps`: { nearGap, farGap, alreadyGradeA, zeroRangeM,
// farOptimumM, farBandLowM, farBandHighM } -- whether the near/far target
// bands the planner wants are covered by the saved targets already.
export function locationIntakePanel({ location, gaps, persisted, onCommit, onChangeLocation }) {
  const { getPersisted, setPersisted } = persisted;
  const node = el('div', { class: 'input-section' });

  const targetOverrides = { ...(getPersisted('targetOverrides', {})) };
  const pendingEdits = { ...(getPersisted('pendingTargetEdits', {})) };
  const naturalTargets = [...(getPersisted('naturalTargets', []))];
  let rangeRecheckedThisSession = getPersisted('rangeRecheckedThisSession', false);
  let naturalTargetsAnswer = getPersisted('naturalTargetsAnswer', null);
  const naturalGapsClosed = { ...(getPersisted('naturalGapsClosed', {})) };
  let choosing = false;
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
    choosing = false;
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
    if (!rangeDeclaredFlat) node.appendChild(el('p', { class: 'hint', i18n: 'truingSession.location.recheckAngleInstructions' }));
    const table = el('table', { class: 'truing-session-table' });
    table.appendChild(el('tr', {}, [
      el('th', { i18n: 'truingSession.location.targetColumn' }),
      el('th', { text: t('truingSession.location.rangeColumn', { unit: distLabel() }) }),
      el('th', { i18n: 'truingSession.location.angleColumn' })
    ]));
    for (const tg of location.targets) {
      const eff = effectiveTarget(tg);
      const rangeInput = el('input', { type: 'number', step: 1, value: toDisplayDistance(eff.rangeM) });
      const angleInput = el('input', { type: 'number', step: 0.1, value: eff.losAngleDeg || 0 });
      angleInput.disabled = rangeDeclaredFlat;
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
        el('td', {}, [angleInput])
      ]));
    }
    node.appendChild(table);

    node.appendChild(el('p', {
      class: rangeRecheckedThisSession ? 'hint' : 'hint warning',
      text: t(rangeRecheckedThisSession ? 'truingSession.location.allCheckedConfirmedHint' : 'truingSession.location.allCheckedRequiredHint')
    }));
    if (choosing) {
      // One ask for the whole batch of changes, not one per field.
      node.appendChild(locationChoice({
        changes: pendingChanges(),
        onUpdateCard: () => {
          const updatedTargets = location.targets.map((tg) => {
            const edit = pendingEdits[tg.id];
            if (!edit) return tg;
            delete targetOverrides[tg.id];
            return { ...tg, ...edit };
          });
          location.targets = updatedTargets;
          saveUserLocation({ ...location, targets: updatedTargets });
          finishRecheck();
        },
        onSessionOnly: () => {
          for (const [id, edit] of Object.entries(pendingEdits)) targetOverrides[id] = { ...(targetOverrides[id] || {}), ...edit };
          finishRecheck();
        }
      }).node);
    } else {
      const done = checkboxRow('truingRangeRechecked', 'truingSession.location.allCheckedButton', rangeRecheckedThisSession, (checked) => {
        if (!checked) { rangeRecheckedThisSession = false; commit(); render(); return; }
        if (pendingChanges().length > 0) { choosing = true; render(); return; }
        finishRecheck();
      }, { warning: true });
      recheckBox = done.checkbox;
      node.appendChild(done.row);
    }

    renderNaturalTargets();
  }

  // Natural-target gap fill: asked only when a gap exists and the saved
  // targets don't already grade A; one Yes/No, then one concrete prompt
  // per open gap, each answerable with a distance or "not available" --
  // never re-asked.
  function renderNaturalTargets() {
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
    getRangeDeclaredFlat: () => rangeDeclaredFlat
  };
}
