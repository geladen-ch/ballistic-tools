// The air and wind the session is shot in: the tool's own inputs, kept in the session state (not the app's shared,
// in-memory atmosphere), checked against the location's altitude, confirmed by the shooter and then frozen into the
// session at Start. Also the one-line "conditions used" summary the later screens show.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { UNIT_GROUPS, FIELD_BOUNDS, unitChoice, engineToDisplay } from '../../units.js';
import { getUnit } from '../../prefs.js';
import { atmosphereSection } from '../sections/atmosphere-section.js';
import { windControl } from '../wind-control.js';
import { WIND_CONFIDENCE_SIGMA_MS, DEFAULT_WIND_CONFIDENCE_KEY } from '../../engine/truing-session.js';
import { altitude as altitudeText, nominalDist, nominalDistM, windSpeedShort } from './units.js';
import { stationPressureCheck, pickGroupConditions, conditionsChangedALot } from './session-model.js';

function formatWithUnit(fieldId, groupName, engineValue, decimals = null) {
  const group = UNIT_GROUPS[groupName];
  const choice = unitChoice(fieldId, getUnit(groupName)) || group.choices.find((c) => c.unit === group.defaultUnit);
  return `${engineToDisplay(fieldId, engineValue, choice.unit).toFixed(decimals ?? choice.decimals)} ${choice.label}`;
}

// "12 °C, 923 hPa, 40%" in the user's own units (the wind is each group's own).
export function conditionsSummary(values) {
  if (!values) return '';
  const parts = [];
  if (Number.isFinite(values.tempC)) parts.push(formatWithUnit('tempC', 'temperature', values.tempC, 0));
  if (Number.isFinite(values.pressureHpa)) parts.push(formatWithUnit('pressureHpa', 'pressure', values.pressureHpa, 0));
  if (Number.isFinite(values.humidityPct)) parts.push(`${Math.round(values.humidityPct)}%`);
  return parts.join(', ');
}

// `load`/`save`: the persisted slice (same shape atmosphereSection takes). `getLocationAltitudeM()`: the active location's
// altitude or null. `getConfirmed()`/`setConfirmed(bool)`: the "these are today's expected conditions" tick. `onInput()`: any change.
export function conditionsCard({ load, save, getLocationAltitudeM, getConfirmed, setConfirmed, onInput }) {
  // The air only, and always the real air read at the range (no named presets): the wind is read and dialled for every group on the
  // Shoot screen, where it is known.
  const section = atmosphereSection({ includeWind: false, presets: false, load, save, onInput: () => { refreshWarning(); onInput(); } });
  const warningHost = el('div');
  const confirm = el('input', { type: 'checkbox', id: 'truingConditionsConfirmed' });
  confirm.checked = !!getConfirmed();
  confirm.addEventListener('change', () => { setConfirmed(confirm.checked); onInput(); });

  // The pressure is a station pressure read on a barometer: compared with what the location's own altitude gives.
  function refreshWarning() {
    clear(warningHost);
    const values = section.getValues();
    const altitudeM = getLocationAltitudeM();
    if (altitudeM == null) return;
    const check = stationPressureCheck({ pressureHpa: values.pressureHpa, altitudeM });
    if (check.level === 'qnh' || check.level === 'low') {
      warningHost.appendChild(el('p', {
        class: 'hint warning',
        text: t(check.level === 'qnh' ? 'truingSession.conditions.pressureQnh' : 'truingSession.conditions.pressureLow', {
          entered: formatWithUnit('pressureHpa', 'pressure', values.pressureHpa, 0),
          expected: formatWithUnit('pressureHpa', 'pressure', check.expectedHpa, 0),
          altitude: altitudeText(altitudeM)
        })
      }));
    }
  }
  refreshWarning();

  // The zero is one setting, made once, in the air of the cartridge's zero atmosphere (Arsenal) when it names one, else in the
  // air above. Say which, so the shooter knows where to change it.
  const zeroNote = el('p', { class: 'hint' });
  // With no zero atmosphere on the cartridge the note tells how to set one; at a zero of 100 m / yd or less the air hardly matters
  // and that note is left out.
  const SHORT_ZERO = 100;
  function refreshZeroNote(zeroAtmosphere, zeroRangeM = null) {
    const shortZero = !zeroAtmosphere && zeroRangeM != null && zeroRangeM <= nominalDistM(SHORT_ZERO) + 0.01;
    zeroNote.style.display = shortZero ? 'none' : '';
    zeroNote.textContent = zeroAtmosphere
      ? t('truingSession.conditions.zeroFromArsenal', { summary: conditionsSummary(zeroAtmosphere) })
      : t('truingSession.conditions.zeroFromConditions', { long: nominalDist(200), short: nominalDist(SHORT_ZERO) });
  }
  refreshZeroNote(null);

  // the expected wind strength, put here by the Prepare screen (it is the homework slice's field)
  const windHost = el('div');
  const node = el('div', { class: 'input-section truing-session-conditions' }, [
    el('h3', { i18n: 'truingSession.conditions.heading' }),
    el('p', { class: 'hint', i18n: 'truingSession.conditions.intro' }),
    section.node,
    warningHost,
    windHost,
    el('label', { class: 'checkbox-field warning' }, [confirm, el('span', { i18n: 'truingSession.conditions.confirmLabel' })]),
    zeroNote
  ]);
  return { node, getValues: section.getValues, isConfirmed: () => confirm.checked, refreshZeroNote, windHost };
}

// The wind of one group, and how well it is read, on the Shoot screen, with the air behind a tick. Each group is shot in the wind on its
// dial: the previous group's (calm, for the first), changed on the dial until it fits what was seen. The air is the
// previous group's unless the pocket meter says it changed. `start` and `last` are condition values (`last` null until a group
// carries its own); `lastWindConfidenceKey` is the confidence of the previous group's wind. getValue() is what to store on the group
// (always with a wind); getWindConfidenceKey() the confidence picked for it.
export const WIND_CONFIDENCE_KEYS = ['excellent', 'good', 'fair', 'poor'];
const WIND_KEYS = ['windSpeed', 'windAngle'];
const airOf = (c) => (c ? pickGroupConditions(Object.fromEntries(Object.entries(c).filter(([k]) => !WIND_KEYS.includes(k)))) : null);
export function groupWeatherControl({ start, last, lastWindConfidenceKey = null, onChange = null }) {
  const notify = () => { if (onChange) onChange(); };
  // the first group starts calm (a crosswind direction); every later one from the previous group's wind
  const calledWind = { windSpeed: 0, windAngle: 90, ...(last ? pickGroupConditions(last) : {}) };

  // ---- wind ----
  const wind = windControl({ angle: calledWind.windAngle ?? 90, speed: calledWind.windSpeed ?? 0, ...FIELD_BOUNDS.windSpeed, label: true, hint: true, onInput: notify });
  const confidence = el('select', { id: 'truingGroupWindConfidence' }, WIND_CONFIDENCE_KEYS.map((key) => el('option', {
    value: key, text: t('truingSession.windConfidence.option', { name: t(`truingSession.windConfidence.${key}`), sigma: windSpeedShort(WIND_CONFIDENCE_SIGMA_MS[key]) })
  })));
  confidence.value = WIND_CONFIDENCE_SIGMA_MS[lastWindConfidenceKey] != null ? lastWindConfidenceKey : DEFAULT_WIND_CONFIDENCE_KEY;
  confidence.addEventListener('change', notify);
  const windNode = el('div', {}, [
    wind.node,
    el('p', { class: 'hint prominent', i18n: 'truingSession.windConfidence.directionHint' }),
    el('div', { class: 'field' }, [el('label', { i18n: 'truingSession.windConfidence.label' }), confidence])
  ]);

  // ---- air ----
  let current = { ...(airOf(last) || airOf(start) || {}) };
  const changed = el('input', { type: 'checkbox', id: 'truingGroupWeatherChanged' });
  const host = el('div');
  const hintHost = el('div');
  const section = atmosphereSection({
    presets: false, includeWind: false,
    load: () => current,
    save: (partial) => { current = { ...current, ...pickGroupConditions(partial) }; refreshHint(); notify(); }
  });
  function refreshHint() {
    clear(hintHost);
    if (changed.checked && conditionsChangedALot(start, current)) {
      hintHost.appendChild(el('p', { class: 'hint warning', i18n: 'truingSession.conditions.changedALot' }));
    }
  }
  changed.addEventListener('change', () => {
    clear(host);
    if (changed.checked) host.appendChild(section.node);
    refreshHint();
    notify();
  });
  const airNode = el('div', {}, [
    el('label', { class: 'checkbox-field' }, [changed, el('span', { i18n: last ? 'truingSession.conditions.groupChangedAgain' : 'truingSession.conditions.groupChanged' })]),
    last ? el('p', { class: 'hint', text: t('truingSession.conditions.groupSameAsLast', { summary: conditionsSummary(airOf(last)) }) }) : null,
    host, hintHost
  ].filter(Boolean));

  const getValue = () => pickGroupConditions({
    ...(changed.checked ? airOf(section.getValues()) : airOf(last)),
    windSpeed: wind.getEngineSpeed(), windAngle: wind.getAngle()
  });
  return { node: el('div', {}, [windNode, airNode]), getValue, getWindConfidenceKey: () => confidence.value };
}
