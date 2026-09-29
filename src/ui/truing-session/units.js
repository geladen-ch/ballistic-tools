// How the Truing Session writes and reads its numbers: every distance, velocity, wind speed, altitude and angle on screen or in
// a field is in the unit the user picked in Settings (the same FIELD_UNITS / getUnit() convention every tool in the app
// follows), and everything stored or handed to the engine stays in metres, m/s and mrad. Dope for the next shot follows Range
// Solver's own output setting (dope-format.js); an elevation the shooter types in is in scope clicks.
import { UNIT_GROUPS, unitChoice, engineToDisplay, displayToEngine } from '../../units.js';
import { getUnit } from '../../prefs.js';

function choiceFor(fieldId, groupName) {
  const group = UNIT_GROUPS[groupName];
  return unitChoice(fieldId, getUnit(groupName)) || group.choices.find((c) => c.unit === group.defaultUnit);
}

function formatted(fieldId, groupName, engineValue, decimals) {
  const c = choiceFor(fieldId, groupName);
  return `${engineToDisplay(fieldId, engineValue, c.unit).toFixed(decimals ?? c.decimals)} ${c.label}`;
}

// ---- distances (m, yd, ft): whole numbers, as every range in this tool always was ----
export const dist = (m, decimals = 0) => formatted('range', 'distance', m, decimals);
export const distLabel = () => choiceFor('range', 'distance').label;
// "100, 400, 870 m": the numbers, then the unit once
export const distList = (list, separator = ', ') => `${list.map((m) => engineToDisplay('range', m, choiceFor('range', 'distance').unit).toFixed(0)).join(separator)} ${distLabel()}`;
export const toDisplayDistance = (m, decimals = 0) => Number(engineToDisplay('range', m, choiceFor('range', 'distance').unit).toFixed(decimals));
export const fromDisplayDistance = (x) => displayToEngine('range', x, choiceFor('range', 'distance').unit);
// A field shows a distance rounded to whole units; a distance the shooter did not touch must come back as the metres it was, not
// as the metres of its rounded display.
export function distanceFromField(text, originalM) {
  const typed = parseFloat(text);
  if (!Number.isFinite(typed)) return NaN;
  return originalM != null && typed === toDisplayDistance(originalM) ? originalM : fromDisplayDistance(typed);
}

// ---- velocities and wind speeds ----
export const vel = (ms, decimals = 1) => formatted('muzzleVelocity', 'velocity', ms, decimals);
export const velLabel = () => choiceFor('muzzleVelocity', 'velocity').label;
export const fromDisplayVelocity = (x) => displayToEngine('muzzleVelocity', x, choiceFor('muzzleVelocity', 'velocity').unit);
export const toDisplayVelocity = (ms) => engineToDisplay('muzzleVelocity', ms, choiceFor('muzzleVelocity', 'velocity').unit);
export const toDisplayVelocityText = (ms, decimals = 1) => toDisplayVelocity(ms).toFixed(decimals);
export const windLabel = () => choiceFor('windSpeed', 'windSpeed').label;
export const toDisplayWind = (ms, decimals = 1) => engineToDisplay('windSpeed', ms, choiceFor('windSpeed', 'windSpeed').unit).toFixed(decimals);
export const windSpeed = (ms, decimals = 1) => formatted('windSpeed', 'windSpeed', ms, decimals);
// no trailing zeros: "2 m/s", "0.5 m/s", "4.5 mph"
export function windSpeedShort(ms) {
  const c = choiceFor('windSpeed', 'windSpeed');
  return `${Number(engineToDisplay('windSpeed', ms, c.unit).toFixed(1))} ${c.label}`;
}

// ---- altitude ----
export const altitude = (m) => formatted('altitudeM', 'altitude', m, 0);

// ---- angles: the precision unit chosen in Settings (mrad or MOA); the engine's is mrad ----
export const angle = (mrad, decimals = 2) => formatted('benchPrecision', 'angleDispersion', mrad, decimals);
export const angleLabel = () => choiceFor('benchPrecision', 'angleDispersion').label;
// the number alone, to the unit's own usual decimals unless told otherwise
export const toDisplayAngle = (mrad, decimals = null) => {
  const c = choiceFor('benchPrecision', 'angleDispersion');
  return engineToDisplay('benchPrecision', mrad, c.unit).toFixed(decimals ?? c.decimals);
};

// ---- the air ----
export const temperature = (tempC, decimals = 0) => formatted('tempC', 'temperature', tempC, decimals);
export const pressure = (hpa, decimals = 0) => formatted('pressureHpa', 'pressure', hpa, decimals);

// How far an angular error of `mrad` moves an impact at 1,000 of the shooter's distance units: { length: "30 cm", at: "1000 m" }
export function missExample(mrad = 0.3, atDisplay = 1000) {
  const cm = (mrad * fromDisplayDistance(atDisplay)) / 10;
  return { length: formatted('dropCm', 'smallLength', cm, 0), at: `${atDisplay} ${distLabel()}` };
}

// The ruler-test rule of thumb (a shift per distance for one unit of angle), in the shooter's angle and distance units
export function angleRuleKey() {
  if (getUnit('angleDispersion') !== 'arcmin') return 'truingSession.homework.ruleMrad';
  return ['yd', 'ft'].includes(getUnit('distance')) ? 'truingSession.homework.ruleMoaImperial' : 'truingSession.homework.ruleMoaMetric';
}
