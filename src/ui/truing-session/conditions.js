// The air and wind the session is shot in: the tool's own inputs, kept in the session state (not the app's shared,
// in-memory atmosphere), checked against the location's altitude, confirmed by the shooter and then frozen into the
// session at Start. Also the one-line "conditions used" summary the later screens show.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';
import { UNIT_GROUPS, unitChoice, engineToDisplay } from '../../units.js';
import { getUnit } from '../../prefs.js';
import { atmosphereSection } from '../sections/atmosphere-section.js';
import { altitude as altitudeText, dist } from './units.js';
import { stationPressureCheck, pickGroupConditions, conditionsChangedALot } from './session-model.js';

function formatWithUnit(fieldId, groupName, engineValue, decimals = null) {
  const group = UNIT_GROUPS[groupName];
  const choice = unitChoice(fieldId, getUnit(groupName)) || group.choices.find((c) => c.unit === group.defaultUnit);
  return `${engineToDisplay(fieldId, engineValue, choice.unit).toFixed(decimals ?? choice.decimals)} ${choice.label}`;
}

// "12 °C, 923 hPa, 40%, wind 3 m/s at 90°" in the user's own units.
export function conditionsSummary(values) {
  if (!values) return '';
  const parts = [];
  if (Number.isFinite(values.tempC)) parts.push(formatWithUnit('tempC', 'temperature', values.tempC, 0));
  if (Number.isFinite(values.pressureHpa)) parts.push(formatWithUnit('pressureHpa', 'pressure', values.pressureHpa, 0));
  if (Number.isFinite(values.humidityPct)) parts.push(`${Math.round(values.humidityPct)}%`);
  if (values.windSpeed > 0) {
    parts.push(t('truingSession.conditions.windSummary', { speed: formatWithUnit('windSpeed', 'windSpeed', values.windSpeed, 1), angle: Math.round(values.windAngle ?? 90) }));
  }
  return parts.join(', ');
}

// `load`/`save`: the persisted slice (same shape atmosphereSection takes). `getLocationAltitudeM()`: the active location's
// altitude or null. `getConfirmed()`/`setConfirmed(bool)`: the "these are today's conditions" tick. `onInput()`: any change.
export function conditionsCard({ load, save, getLocationAltitudeM, getConfirmed, setConfirmed, onInput }) {
  const section = atmosphereSection({ combinedWind: true, load, save, onInput: () => { refreshWarning(); onInput(); } });
  const warningHost = el('div');
  const confirm = el('input', { type: 'checkbox', id: 'truingConditionsConfirmed' });
  confirm.checked = !!getConfirmed();
  confirm.addEventListener('change', () => { setConfirmed(confirm.checked); onInput(); });

  // With the "Standard atmosphere" preset the pressure is derived from the altitude typed there, so there is nothing to
  // compare; otherwise the location's own altitude is the reference.
  function refreshWarning() {
    clear(warningHost);
    const values = section.getValues();
    const altitudeM = getLocationAltitudeM();
    if (values.atmospherePreset === 'standard' || altitudeM == null) return;
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
  function refreshZeroNote(zeroAtmosphere) {
    zeroNote.textContent = zeroAtmosphere
      ? t('truingSession.conditions.zeroFromArsenal', { summary: conditionsSummary(zeroAtmosphere) })
      : t('truingSession.conditions.zeroFromConditions', { long: dist(200) });
  }
  refreshZeroNote(null);

  const node = el('div', { class: 'input-section truing-session-conditions' }, [
    el('h3', { i18n: 'truingSession.conditions.heading' }),
    el('p', { class: 'hint', i18n: 'truingSession.conditions.intro' }),
    section.node,
    warningHost,
    el('label', { class: 'checkbox-field warning' }, [confirm, el('span', { i18n: 'truingSession.conditions.confirmLabel' })]),
    zeroNote
  ]);
  return { node, getValues: section.getValues, isConfirmed: () => confirm.checked, refreshZeroNote };
}

// The weather for one group, on the Shoot screen: the air and wind read on the pocket meter at this target. Unless it is
// changed, a group is shot in the air of the one before it (or of the start, when nothing has changed yet). `start` and
// `last` are condition values (`last` null until a group carries its own); getValue() is what to store on the group, or null.
export function groupWeatherControl({ start, last, onChange = null }) {
  let current = { ...(last || pickGroupConditions(start) || {}) };
  const changed = el('input', { type: 'checkbox', id: 'truingGroupWeatherChanged' });
  const host = el('div');
  const hintHost = el('div');
  const section = atmosphereSection({
    presets: false, combinedWind: true,
    load: () => current,
    save: (partial) => { current = { ...current, ...pickGroupConditions(partial) }; refreshHint(); if (onChange) onChange(); }
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
    if (onChange) onChange();
  });
  const node = el('div', {}, [
    el('label', { class: 'checkbox-field' }, [changed, el('span', { i18n: last ? 'truingSession.conditions.groupChangedAgain' : 'truingSession.conditions.groupChanged' })]),
    last ? el('p', { class: 'hint', text: t('truingSession.conditions.groupSameAsLast', { summary: conditionsSummary(last) }) }) : null,
    host, hintHost
  ].filter(Boolean));
  return { node, getValue: () => (changed.checked ? pickGroupConditions(section.getValues()) : last || null) };
}
