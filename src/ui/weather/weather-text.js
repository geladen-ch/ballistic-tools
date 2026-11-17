// Text for the weather lookup's machine-readable results: values in the user's display units, and the translated
// wording of note, flag, skip and reason codes. The engine reports codes with parameters in SI; every conversion to a
// display unit happens here, through the display layer of units.js.
import { t, tOptional } from '../../i18n.js';
import { getUnit } from '../../prefs.js';
import { UNIT_GROUPS, unitChoice, siToDisplay } from '../../units.js';
import { sources } from '../../weather/sources/index.js';

/** The user's unit for a group (a stale or unknown preference falls back to the group's default). */
export function unitOf(group) {
  const unit = getUnit(group);
  return UNIT_GROUPS[group].choices.some((c) => c.unit === unit) ? unit : UNIT_GROUPS[group].defaultUnit;
}

/** "12.3 °C": an SI value of a field's kind in the user's unit for it. `decimals` overrides the unit's own. */
export function valueText(fieldId, si, { decimals = null, sign = false, label = true } = {}) {
  if (!Number.isFinite(si)) return '–';
  const group = { tempC: 'temperature', tempMedianError: 'temperature', pressure: 'pressure', altitudeM: 'altitude', weatherSearchRadius: 'weatherRadius', humidity: 'ratio' }[fieldId];
  const unit = unitOf(group);
  const choice = unitChoice(fieldId, unit);
  const v = siToDisplay(fieldId, si, unit);
  const d = decimals ?? choice.decimals;
  const body = sign ? `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d)}` : v.toFixed(d);
  return label ? `${body} ${choice.label}` : body;
}

export const temperatureText = (c, o) => valueText('tempC', c, o);
export const temperatureSpanText = (c, o) => valueText('tempMedianError', c, o);
export const pressureText = (pa, o) => valueText('pressure', pa, o);
export const humidityText = (fraction, o) => valueText('humidity', fraction, { decimals: 0, ...o });
export const heightText = (m, o = {}) => valueText('altitudeM', m, { decimals: 0, ...o });
export const distanceText = (m, o = {}) => valueText('weatherSearchRadius', m, { decimals: 1, ...o });

/** The unit symbols of a column header. */
export const unitLabel = (fieldId) => {
  const group = { tempC: 'temperature', pressure: 'pressure', altitudeM: 'altitude', weatherSearchRadius: 'weatherRadius', humidity: 'ratio' }[fieldId];
  return unitChoice(fieldId, unitOf(group)).label;
};

export const timeText = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const dateTimeText = (ms) => new Date(ms).toLocaleString();

const KIND_LONG = { station: 'details.kindLong.station', qnh: 'details.kindLong.qnh', mslp: 'details.kindLong.mslp' };
const sourceName = (id) => sources.find((s) => s.id === id)?.name ?? id;

/** Parameters of a note, formatted for the text (the key names are the placeholders of the locale strings). */
function noteParams(n) {
  const p = {};
  if ('radiusM' in n) p.radius = distanceText(n.radiusM, { decimals: 0 });
  if ('pa' in n) p.pressure = pressureText(n.pa);
  if ('kind' in n) p.kind = t(`onlineWeather.${KIND_LONG[n.kind] ?? 'details.kindLong.qnh'}`);
  if ('impliedM' in n) p.implied = heightText(n.impliedM);
  if ('listedM' in n) p.listed = heightText(n.listedM);
  if ('tempC' in n) p.temperature = temperatureText(n.tempC);
  if ('dewpointC' in n) p.dewpoint = temperatureText(n.dewpointC);
  if ('humidity' in n) p.humidity = humidityText(n.humidity);
  if ('barometerM' in n) p.height = heightText(n.barometerM);
  if ('adjustPa' in n) p.adjust = pressureText(n.adjustPa, { sign: true });
  if ('sourceId' in n) p.source = sourceName(n.sourceId);
  if ('iemElevM' in n) p.iemHeight = Number.isFinite(n.iemElevM) ? heightText(n.iemElevM) : t('onlineWeather.details.unknown');
  if ('label' in n) p.station = n.label;
  return p;
}

/** A note or skip reason: the translated text, or the bare code for one this build has no text for. */
export function noteText(n) {
  const key = `onlineWeather.note.${n.code}`;
  return tOptional(key) ? t(key, noteParams(n)) : n.code;
}

/** A reduction flag (reduce.js), same lookup under `onlineWeather.flag`. */
export function flagText(flag) {
  const key = `onlineWeather.flag.${flag}`;
  return tOptional(key) ? t(key) : flag;
}

/** Why a source is inactive; `error` carries the status entry's error info. */
export function reasonText(reason, error = null) {
  if (reason === 'error' && error) {
    const kind = tOptional(`onlineWeather.details.errorKind.${error.kind}`);
    return `${t('onlineWeather.details.reason.error')}: ${kind ? t(`onlineWeather.details.errorKind.${error.kind}`, { status: error.status ?? '' }) : error.message}`;
  }
  const key = `onlineWeather.details.reason.${reason}`;
  return tOptional(key) ? t(key) : String(reason);
}
