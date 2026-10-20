// How the Truing Session writes and reads its numbers: every distance, velocity, wind speed, altitude and angle on screen or in
// a field is in the unit the user picked in Settings (display-units.js), and everything stored or handed to the engine stays in
// metres, m/s and mrad. Dope for the next shot follows Range Solver's own output setting (dope-format.js); an elevation the
// shooter types in is in scope clicks.
import { velocityPerTempToDisplay, velocityPerTempSymbol } from '../../units.js';
import { getUnit } from '../../prefs.js';
import { displayChoice, quantityLabel, toDisplayUnit, fromDisplayUnit, formatQuantity } from '../../display-units.js';
import { mradToRad, angleToLinearAtRange } from '../../quantity.js';

// ---- distances (m, yd): whole numbers, as every range in this tool always was ----
export const dist = (m, decimals = 0) => formatQuantity('distance', m, { decimals });
export const distLabel = () => quantityLabel('distance');
// A round distance quoted in advice ("a zero of 200 m or more"): the same number in metres and in yards, so the text reads as it
// would be written in either.
export const nominalDist = (m) => `${m} ${distLabel()}`;
// The metres a nominal distance stands for: 100 is 100 m, or 100 yd (91.44 m).
export const nominalDistM = (n) => fromDisplayDistance(n);
// "100, 400, 870 m": the numbers, then the unit once
export const distList = (list, separator = ', ') => `${list.map((m) => toDisplayUnit('distance', m).toFixed(0)).join(separator)} ${distLabel()}`;
export const toDisplayDistance = (m, decimals = 0) => Number(toDisplayUnit('distance', m).toFixed(decimals));
export const fromDisplayDistance = (x) => fromDisplayUnit('distance', x);
// A field shows a distance rounded to whole units; a distance the shooter did not touch must come back as the metres it was, not
// as the metres of its rounded display.
export function distanceFromField(text, originalM) {
  const typed = parseFloat(text);
  if (!Number.isFinite(typed)) return NaN;
  return originalM != null && typed === toDisplayDistance(originalM) ? originalM : fromDisplayDistance(typed);
}

// ---- velocities and wind speeds ----
export const vel = (ms, decimals = 1) => formatQuantity('velocity', ms, { decimals });
// A cartridge's muzzle velocity as the Arsenal records it, in the shooter's units, with its temperature drift when it has one:
// { velocity: "792.5 m/s", drift: { temp: "15 °C", rate: "+0.8 m/s/°C" } | null }
export function arsenalMuzzleVelocity(cartridge) {
  const hasDrift = cartridge.referenceTempC != null && cartridge.velocityTempSensitivity != null;
  const rate = hasDrift ? velocityPerTempToDisplay(cartridge.velocityTempSensitivity, getUnit('velocity'), getUnit('temperature')) : null;
  return {
    velocity: vel(cartridge.muzzleVelocity),
    drift: hasDrift ? { temp: temperature(cartridge.referenceTempC), rate: `${rate > 0 ? '+' : ''}${Number(rate.toFixed(2))} ${velocityPerTempSymbol(getUnit('velocity'), getUnit('temperature'))}` } : null
  };
}
export const velLabel = () => quantityLabel('velocity');
export const fromDisplayVelocity = (x) => fromDisplayUnit('velocity', x);
export const toDisplayVelocity = (ms) => toDisplayUnit('velocity', ms);
export const toDisplayVelocityText = (ms, decimals = 1) => toDisplayVelocity(ms).toFixed(decimals);
export const windLabel = () => quantityLabel('windSpeed');
export const toDisplayWind = (ms, decimals = 1) => toDisplayUnit('windSpeed', ms).toFixed(decimals);
export const windSpeed = (ms, decimals = 1) => formatQuantity('windSpeed', ms, { decimals });
// The boundary between a low-to-moderate and a strong wind (5 m/s), as a whole number in the shooter's own wind unit, rounded the way
// people say it: 5 m/s, 16 ft/s, 11 mph, 18 km/h.
const WIND_STRENGTH_LIMIT_BY_UNIT = { 'm/s': 5, 'ft/s': 16, mph: 11, 'km/h': 18 };
export function windStrengthLimit(limitMs = 5) {
  const c = displayChoice('windSpeed');
  const shown = limitMs === 5 && WIND_STRENGTH_LIMIT_BY_UNIT[c.unit] != null ? WIND_STRENGTH_LIMIT_BY_UNIT[c.unit] : Math.round(toDisplayUnit('windSpeed', limitMs));
  return `${shown} ${c.label}`;
}
// no trailing zeros: "2 m/s", "0.5 m/s", "4.5 mph"
export function windSpeedShort(ms) {
  return `${Number(toDisplayUnit('windSpeed', ms).toFixed(1))} ${quantityLabel('windSpeed')}`;
}

// ---- altitude ----
export const altitude = (m) => formatQuantity('altitude', m, { decimals: 0 });

// ---- angles: the precision unit chosen in Settings (mrad or MOA); the engine's is mrad ----
export const angle = (mrad, decimals = 2) => formatQuantity('angleDispersion', mrad, { from: 'mrad', decimals });
export const angleLabel = () => quantityLabel('angleDispersion');
// the number alone, to the unit's own usual decimals unless told otherwise
export const toDisplayAngle = (mrad, decimals = null) => toDisplayUnit('angleDispersion', mrad, 'mrad').toFixed(decimals ?? displayChoice('angleDispersion').decimals);

// ---- the air ----
export const temperature = (tempC, decimals = 0) => formatQuantity('temperature', tempC, { decimals });
export const pressure = (hpa, decimals = 0) => formatQuantity('pressure', hpa, { from: 'hPa', decimals });

// How far an angular error of `mrad` moves an impact at 1,000 of the shooter's distance units: { length: "30 cm", at: "1000 m" }
export function missExample(mrad = 0.3, atDisplay = 1000) {
  const lengthM = angleToLinearAtRange(mradToRad(mrad), fromDisplayDistance(atDisplay));
  return { length: formatQuantity('smallLength', lengthM, { decimals: 0 }), at: `${atDisplay} ${distLabel()}` };
}

// The ruler-test rule of thumb (a shift per distance for one unit of angle), in the shooter's angle and distance units
export function angleRuleKey() {
  if (getUnit('angleDispersion') !== 'arcmin') return 'truingSession.homework.ruleMrad';
  return getUnit('distance') === 'yd' ? 'truingSession.homework.ruleMoaImperial' : 'truingSession.homework.ruleMoaMetric';
}
