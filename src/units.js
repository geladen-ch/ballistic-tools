// Unit metadata and conversion for display purposes only. The engine
// (src/engine/*) always works in fixed metric units — nothing here ever
// crosses into that layer. Views convert an engine value to the user's
// preferred display unit for rendering, and convert typed input straight
// back to the engine unit before it's used in a calculation.
import Qty from './vendor/js-quantities/quantities.mjs';

// Each group is one independently-selectable "preferred unit" — grouped by
// how a shooter actually thinks about a measurement, not just by physical
// dimension. Range and sight height are both "length" dimensionally, but
// nobody wants sight height in yards or range in millimeters, and a user
// may reasonably want one in metric and the other in imperial at the same
// time (e.g. range in yards, sight height in mm).
//
// Group display names are translated (locales/*.json under
// settings.groups.<key>) rather than kept here — this file only owns the
// conversion math. Unit symbols in `choices[].label` (m/s, °C, MOA, ...)
// are NOT translated: they're internationally recognized abbreviations,
// not prose.
export const UNIT_GROUPS = {
  velocity: {
    defaultUnit: 'm/s',
    choices: [
      { unit: 'm/s', label: 'm/s', decimals: 1 },
      { unit: 'ft/s', label: 'ft/s', decimals: 0 },
      { unit: 'mph', label: 'mph', decimals: 1 },
      { unit: 'km/h', label: 'km/h', decimals: 1 }
    ]
  },
  distance: {
    defaultUnit: 'm',
    choices: [
      { unit: 'm', label: 'm', decimals: 1 },
      { unit: 'yd', label: 'yd', decimals: 1 },
      { unit: 'ft', label: 'ft', decimals: 0 }
    ]
  },
  smallLength: {
    defaultUnit: 'mm',
    choices: [
      { unit: 'mm', label: 'mm', decimals: 0 },
      { unit: 'cm', label: 'cm', decimals: 1 },
      { unit: 'in', label: 'in', decimals: 2 }
    ]
  },
  // Rifling twist rate's own preference, independent of smallLength (sight
  // height, aim offsets) — a shooter who thinks in mm for one often still
  // thinks in inches-per-turn for the other (twist rates are near-universally
  // quoted in inches, e.g. "1:10"), so tying them to the same choice would
  // force a pick that fits neither. Engine unit (mm) and default display
  // unit are unchanged either way — this only adds an independent display
  // choice on top.
  riflingTwist: {
    defaultUnit: 'mm',
    choices: [
      { unit: 'mm', label: 'mm', decimals: 0 },
      { unit: 'in', label: 'in', decimals: 2 }
    ]
  },
  altitude: {
    defaultUnit: 'm',
    choices: [
      { unit: 'm', label: 'm', decimals: 0 },
      { unit: 'ft', label: 'ft', decimals: 0 }
    ]
  },
  temperature: {
    defaultUnit: 'tempC',
    choices: [
      { unit: 'tempC', label: '°C', decimals: 1 },
      { unit: 'tempF', label: '°F', decimals: 1 }
    ]
  },
  pressure: {
    defaultUnit: 'hPa',
    choices: [
      // 2 decimals (not the usual 1) so the atmosphere presets' own
      // reference values — 925.3 hPa (Swiss), 1013.25 hPa (ICAO standard
      // sea-level) — round-trip through display without losing precision.
      { unit: 'hPa', label: 'hPa', decimals: 2 },
      { unit: 'inHg', label: 'inHg', decimals: 2 },
      { unit: 'mmHg', label: 'mmHg', decimals: 1 },
      { unit: 'psi', label: 'psi', decimals: 2 }
    ]
  },
  angleDispersion: {
    defaultUnit: 'mrad',
    choices: [
      { unit: 'arcmin', label: 'MOA', decimals: 2 },
      { unit: 'mrad', label: 'mrad', decimals: 3 }
    ]
  },
  energy: {
    defaultUnit: 'J',
    choices: [
      { unit: 'J', label: 'J', decimals: 0 },
      // js-quantities has no single named foot-pound unit, but resolves
      // this compound (force * length) form fine — same "ft*lbf" any
      // torque/energy unit converter uses for foot-pounds.
      { unit: 'ft*lbf', label: 'ft·lb', decimals: 0 }
    ]
  }
};

// Maps each engine parameter to the group it belongs to and the exact unit
// the engine functions expect for it. Anything not listed here (bc,
// humidityPct, windAngle, shots, bcSDFracPct, ...) is dimensionless or a
// fixed-unit value (a compass heading is always degrees) and passes
// through unit fields unconverted.
export const FIELD_UNITS = {
  muzzleVelocity: { group: 'velocity', engineUnit: 'm/s' },
  windSpeed: { group: 'velocity', engineUnit: 'm/s' },
  v1: { group: 'velocity', engineUnit: 'm/s' },
  v2: { group: 'velocity', engineUnit: 'm/s' },
  muzzleVelocitySD: { group: 'velocity', engineUnit: 'm/s' },
  windMedianError: { group: 'velocity', engineUnit: 'm/s' },
  movingTargetSpeed: { group: 'velocity', engineUnit: 'm/s' },

  maxRange: { group: 'distance', engineUnit: 'm' },
  rangeStep: { group: 'distance', engineUnit: 'm' },
  // Not a form field — used to display a computed trajectory-table range
  // value (in meters from the engine) in the same distance unit the user
  // entered maxRange/rangeStep in, so the printed rows actually land on
  // the step the user specified.
  range: { group: 'distance', engineUnit: 'm' },
  zeroRange: { group: 'distance', engineUnit: 'm' },
  r1: { group: 'distance', engineUnit: 'm' },
  r2: { group: 'distance', engineUnit: 'm' },
  targetRange: { group: 'distance', engineUnit: 'm' },
  battleZeroRange: { group: 'distance', engineUnit: 'm' },

  sightHeight: { group: 'smallLength', engineUnit: 'mm' },
  riflingTwist: { group: 'riflingTwist', engineUnit: 'mm' },
  aimOffsetX: { group: 'smallLength', engineUnit: 'cm' },
  aimOffsetY: { group: 'smallLength', engineUnit: 'cm' },

  altitudeM: { group: 'altitude', engineUnit: 'm' },
  tempC: { group: 'temperature', engineUnit: 'tempC' },
  referenceTempC: { group: 'temperature', engineUnit: 'tempC' },
  // A span (an interval of uncertainty), not an absolute reading — see
  // unitField's isSpan option.
  tempMedianError: { group: 'temperature', engineUnit: 'tempC' },
  pressureHpa: { group: 'pressure', engineUnit: 'hPa' },
  pressureMedianError: { group: 'pressure', engineUnit: 'hPa' },
  benchPrecision: { group: 'angleDispersion', engineUnit: 'mrad' },
  shooterSkill: { group: 'angleDispersion', engineUnit: 'mrad' },
  combinedPrecision: { group: 'angleDispersion', engineUnit: 'mrad' },
  // Not a form field — the trajectory view's own kinetic-energy column/
  // chart series computes 0.5*massKg*velocity^2 itself (Joules, SI) and
  // converts it for display through this entry, the same way it already
  // does for `range`.
  energy: { group: 'energy', engineUnit: 'J' }
};

// Temperature's absolute units (tempC/tempF) convert with a +32/*9/5
// offset baked in — correct for a point on the scale, wrong for a *span*
// (a step size, a min-max range width). js-quantities' 'deg' units are the
// offset-free interval form of the same scale, so spans must go through
// those instead. Every other group here is a true ratio scale (a genuine
// zero point), so the span and point conversions are identical and this
// is a no-op.
function deltaUnit(unit) {
  if (unit === 'tempC') return 'degC';
  if (unit === 'tempF') return 'degF';
  if (unit === 'tempK') return 'degK';
  return unit;
}

export function unitChoice(fieldId, unit) {
  const meta = FIELD_UNITS[fieldId];
  if (!meta) return null;
  const group = UNIT_GROUPS[meta.group];
  return group.choices.find((c) => c.unit === unit) || null;
}

export function engineToDisplay(fieldId, engineValue, displayUnit) {
  const meta = FIELD_UNITS[fieldId];
  if (!meta || meta.engineUnit === displayUnit) return engineValue;
  return Qty(engineValue, meta.engineUnit).to(displayUnit).scalar;
}

export function displayToEngine(fieldId, displayValue, displayUnit) {
  const meta = FIELD_UNITS[fieldId];
  if (!meta || meta.engineUnit === displayUnit) return displayValue;
  return Qty(displayValue, displayUnit).to(meta.engineUnit).scalar;
}

// For converting a step size or a min/max span rather than an absolute
// value — see deltaUnit() above for why this has to be a separate path.
export function engineSpanToDisplay(fieldId, span, displayUnit) {
  const meta = FIELD_UNITS[fieldId];
  if (!meta || meta.engineUnit === displayUnit) return span;
  return Qty(span, deltaUnit(meta.engineUnit)).to(deltaUnit(displayUnit)).scalar;
}

// The reverse of engineSpanToDisplay() — for a field whose *value itself*
// is a span/interval rather than an absolute reading (e.g. a temperature
// median-error field: "5 degrees" of uncertainty, not a point on the
// scale), so typed input needs to go back to engine units the same
// offset-free way.
export function displaySpanToEngine(fieldId, span, displayUnit) {
  const meta = FIELD_UNITS[fieldId];
  if (!meta || meta.engineUnit === displayUnit) return span;
  return Qty(span, deltaUnit(displayUnit)).to(deltaUnit(meta.engineUnit)).scalar;
}

export function roundForDisplay(fieldId, displayUnit, value) {
  const choice = unitChoice(fieldId, displayUnit);
  const decimals = choice ? choice.decimals : 2;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Sanity-check bounds — one number pair per field id, in the same unit
// FIELD_UNITS' own `engineUnit` uses for that id (so formatFieldRange()
// below can run them through the exact same engineToDisplay()/
// roundForDisplay() path as the field's own value), or in the field's
// one-and-only raw unit for anything with no FIELD_UNITS entry (bc,
// caliber/length/mass — always mm/mm/g regardless of prefs, scope
// clicks, losAngle, humidityPct, tof, sightingShotCount, spotterMeasure,
// convBc, cdTableCd). Centralized here — not scattered as a literal
// min/max at each call site — specifically so the same physical
// quantity can't quietly end up with two different bounds in two views
// the way windSpeed (20 vs 30 m/s) and targetRange (2000 vs 3000m) had
// before this was written; every caller now points at the one number.
export const FIELD_BOUNDS = {
  caliberM: { min: 0.004, max: 0.021 }, // m — hand-rolled mm field multiplies/divides by 1000 itself
  bulletLength: { min: 5, max: 100 }, // mm, always — bullet-form.js's own hand-rolled field
  bulletMass: { min: 1, max: 121 }, // g, always — mass-field.js's own gram/grain pair
  bc: { min: 0.05, max: 1.5 },
  cdTableCd: { min: 0.05, max: 3.0 }, // a single Cd-vs-Mach table row's own Cd value
  sightHeight: { min: 0, max: 500 }, // mm
  zeroRange: { min: 0, max: 5000 }, // m
  riflingTwist: { min: 1, max: 1000 }, // mm — optional (blank) is handled separately; 0 itself is a Miller's-formula divisor
  scopeClick: { min: 0.01, max: 5 }, // click value, unit-agnostic by design (see CLICK_UNITS above)
  muzzleVelocity: { min: 50, max: 1500 }, // m/s — also reused for BC Tools' v1/v2/conversion velocity
  referenceTempC: { min: -90, max: 60 }, // °C — also reused for tempC
  tempC: { min: -90, max: 60 }, // °C
  velocityTempSensitivity: { min: -5, max: 5 }, // m/s per °C, engine unit always — see velocityPerTempFactor() above
  altitudeM: { min: -500, max: 6000 }, // m
  targetRange: { min: 10, max: 5000 }, // m
  losAngle: { min: -90, max: 90 }, // degrees, no FIELD_UNITS entry
  windSpeed: { min: 0, max: 35 }, // m/s
  pressureHpa: { min: 450, max: 1100 }, // hPa
  humidityPct: { min: 0, max: 100 }, // %, no FIELD_UNITS entry
  battleZeroRange: { min: 0, max: 5000 }, // m — matches zeroRange, same physical quantity
  r1: { min: 0, max: 200 }, // m
  r2: { min: 10, max: 3000 }, // m
  tof: { min: 0.001, max: 30 }, // s, no FIELD_UNITS entry
  sightingShotCount: { min: 1, max: 5 }, // count, integer
  convBc: { min: 0.05, max: 1.5 }, // matches bc
  maxRange: { min: 100, max: 2000 }, // m
  rangeStep: { min: 1, max: 500 }, // m
  benchPrecision: { min: 0, max: 3 }, // mrad
  shooterSkill: { min: 0, max: 3 }, // mrad
  combinedPrecision: { min: 0, max: 3 }, // mrad
  distanceMedianError: { min: 0, max: 50 }, // %, no FIELD_UNITS entry
  tempMedianError: { min: 0, max: 20 }, // °C span
  pressureMedianError: { min: 0, max: 30 }, // hPa
  windMedianError: { min: 0, max: 10 }, // m/s
  movingTargetSpeed: { min: 0, max: 30 }, // m/s
  movingTargetSpeedError: { min: 0, max: 100 }, // %, no FIELD_UNITS entry
  muzzleVelocitySD: { min: 0, max: 20 }, // m/s
  spotterMeasure: { min: 0, max: 5 }, // mrad (no FIELD_UNITS entry — always raw, matching its existing unconverted display)
  aimOffsetX: { min: -100, max: 100 }, // cm
  aimOffsetY: { min: -100, max: 100 } // cm
};

// The bounds message's own "allowed range" text, in whatever unit the
// field is currently displayed in — same engineToDisplay()/
// roundForDisplay() round-trip the field's own value already goes
// through, so e.g. a muzzle-velocity bound of 50–1500 m/s reads as
// "164 – 4921 ft/s" for a user who's switched to imperial, not a raw
// metric number in a field that no longer shows metric anywhere else.
// Falls back to the bare numbers, no unit suffix, for a field with no
// FIELD_UNITS entry (bc, clicks, losAngle, ...) — exactly what
// unitChoice() already returns null for.
export function formatFieldRange(fieldId, min, max, displayUnit) {
  const choice = unitChoice(fieldId, displayUnit);
  if (!choice) return `${min} – ${max}`;
  const dMin = roundForDisplay(fieldId, displayUnit, engineToDisplay(fieldId, min, displayUnit));
  const dMax = roundForDisplay(fieldId, displayUnit, engineToDisplay(fieldId, max, displayUnit));
  return `${dMin} – ${dMax} ${choice.label}`;
}

// Single-value sibling of formatFieldRange() above — for a cross-field
// validation message that names another field's own current value (e.g.
// "cannot exceed Max range (1000 m)") rather than a fixed min/max pair.
export function formatFieldValue(fieldId, value, displayUnit) {
  const choice = unitChoice(fieldId, displayUnit);
  if (!choice) return `${value}`;
  return `${roundForDisplay(fieldId, displayUnit, engineToDisplay(fieldId, value, displayUnit))} ${choice.label}`;
}

// Muzzle-velocity-vs-temperature sensitivity (m/s of V0 change per °C) is
// a rate, not a plain quantity, so it doesn't get its own Settings entry
// or FIELD_UNITS mapping — its display unit is *derived* from whatever
// the user already has selected for the velocity and temperature groups
// (so a preference of ft/s + °F shows "ft/s/°F" automatically, staying
// consistent with muzzle velocity and temperature elsewhere on the page).
const SENSITIVITY_ENGINE_VELOCITY_UNIT = 'm/s';
const SENSITIVITY_ENGINE_TEMP_UNIT = 'tempC';

export function velocityPerTempSymbol(velocityUnit, tempUnit) {
  const velocityChoice = UNIT_GROUPS.velocity.choices.find((c) => c.unit === velocityUnit);
  const tempChoice = UNIT_GROUPS.temperature.choices.find((c) => c.unit === tempUnit);
  return `${velocityChoice.label}/${tempChoice.label}`;
}

function velocityPerTempFactor(velocityUnit, tempUnit) {
  const velocityFactor = Qty(1, SENSITIVITY_ENGINE_VELOCITY_UNIT).to(velocityUnit).scalar;
  // The temperature axis here is an interval (a slope's run), not a point
  // on the scale, so it goes through the same offset-free 'deg' unit as
  // engineSpanToDisplay() uses for slider steps — see deltaUnit() above.
  const tempIntervalFactor = Qty(1, deltaUnit(SENSITIVITY_ENGINE_TEMP_UNIT)).to(deltaUnit(tempUnit)).scalar;
  return velocityFactor / tempIntervalFactor;
}

export function velocityPerTempToDisplay(engineValue, velocityUnit, tempUnit) {
  return engineValue * velocityPerTempFactor(velocityUnit, tempUnit);
}

export function velocityPerTempToEngine(displayValue, velocityUnit, tempUnit) {
  return displayValue / velocityPerTempFactor(velocityUnit, tempUnit);
}

// Scope click values (MOA or mrad per click) are deliberately independent
// of the app-wide unit preferences — a scope's turret is engraved in one
// fixed unit and dialing in the "wrong" one because Settings happens to
// be set to imperial elsewhere would be a real, dangerous mistake. These
// helpers take an explicit unit on every call rather than reading from
// prefs.js, and the caller (scope-clicks-field.js) keeps its own local
// unit choice instead of using FIELD_UNITS/getUnit().
export const CLICK_UNITS = [
  { unit: 'mrad', label: 'mrad' },
  { unit: 'arcmin', label: 'MOA' }
];

export function convertAngularValue(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  return Qty(value, fromUnit).to(toUnit).scalar;
}

// Lateral displacement (cm) produced by one unit of angle (1 MOA or 1
// mrad) at a given range (m) — the standard small-angle approximation.
export function angularUnitToCmAtRange(unit, rangeM) {
  return Qty(1, unit).to('rad').scalar * rangeM * 100;
}

// How many scope clicks of `clickValue` (in `unit`) are needed to correct
// a lateral offset of `offsetCm` at `rangeM`. Guards against Infinity/NaN
// reaching the UI if the click value or range is zero.
export function clicksForOffset(offsetCm, clickValue, unit, rangeM) {
  if (!clickValue || rangeM <= 0) return 0;
  const cmPerClick = clickValue * angularUnitToCmAtRange(unit, rangeM);
  return cmPerClick === 0 ? 0 : offsetCm / cmPerClick;
}
