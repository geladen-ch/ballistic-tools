// Unit metadata for the presentation edge: which display units each
// quantity offers, which engine unit each field holds, and the field-level
// conversions views use to show an engine value in the user's preferred
// unit and to turn typed input straight back into the engine unit. The
// arithmetic itself is src/quantity.js's — this module never converts on
// its own.
import { converter, angleToLinearAtRange, degToRad, mradToRad } from './quantity.js';

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
      { unit: 'yd', label: 'yd', decimals: 1 }
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
  // Wind speed's own preference, independent of velocity (muzzle velocity,
  // v1/v2, ...) — a shooter who calls muzzle velocity in ft/s often still
  // wants wind in mph or km/h (how wind is quoted by weather services/range
  // flags), so tying them to the same choice would force a pick that fits
  // neither. Same choice set/decimals as velocity, and same engine unit
  // (m/s) — this only adds an independent display choice on top.
  windSpeed: {
    defaultUnit: 'm/s',
    choices: [
      { unit: 'm/s', label: 'm/s', decimals: 1 },
      { unit: 'ft/s', label: 'ft/s', decimals: 0 },
      { unit: 'mph', label: 'mph', decimals: 1 },
      { unit: 'km/h', label: 'km/h', decimals: 1 }
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
  // A plain fraction (relative humidity, an estimation error) is held as
  // 0..1 and always shown in percent — not a choice anyone needs, so the
  // group is `fixed`: Settings doesn't offer it, and fields don't append a
  // unit suffix to their label (their translated labels already say "%").
  // A direction or an incline (wind direction, line-of-sight angle) is
  // held in radians and always shown in degrees, the way it is read off a
  // compass or an inclinometer — `fixed` for the same reasons as `ratio`.
  angleDegrees: {
    defaultUnit: 'deg',
    fixed: true,
    choices: [
      { unit: 'deg', label: '°', decimals: 1 }
    ]
  },
  ratio: {
    defaultUnit: '%',
    fixed: true,
    choices: [
      // 2, so an estimation error like a laser rangefinder's 0.14 % shows
      // as such; a whole-number humidity still shows without decimals.
      { unit: '%', label: '%', decimals: 2 }
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

// The quantity kind (src/quantity.js's QUANTITY_KINDS) every unit in each
// display group belongs to — what lets a group be converted from any
// engine unit of the same kind.
export const GROUP_KINDS = {
  velocity: 'velocity', windSpeed: 'velocity', distance: 'length', smallLength: 'length', riflingTwist: 'length',
  altitude: 'length', temperature: 'temperature', pressure: 'pressure', angleDispersion: 'angle', energy: 'energy',
  ratio: 'ratio', angleDegrees: 'angle'
};

// Maps each engine parameter to the group it belongs to and the exact unit
// the engine functions expect for it. Anything not listed here (bc,
// shots, sighting shot count, ...) is a plain number with no unit and
// passes through unit fields unconverted.
export const FIELD_UNITS = {
  muzzleVelocity: { group: 'velocity', engineUnit: 'm/s' },
  windSpeed: { group: 'windSpeed', engineUnit: 'm/s' },
  v1: { group: 'velocity', engineUnit: 'm/s' },
  v2: { group: 'velocity', engineUnit: 'm/s' },
  muzzleVelocitySD: { group: 'velocity', engineUnit: 'm/s' },
  windMedianError: { group: 'windSpeed', engineUnit: 'm/s' },
  movingTargetSpeed: { group: 'velocity', engineUnit: 'm/s' },

  maxRange: { group: 'distance', engineUnit: 'm' },
  rangeStep: { group: 'distance', engineUnit: 'm' },
  // Not a form field — used to display a computed trajectory-table range
  // value (in meters from the engine) in the same distance unit the user
  // entered maxRange/rangeStep in, so the printed rows actually land on
  // the step the user specified.
  range: { group: 'distance', engineUnit: 'm' },
  zeroRange: { group: 'distance', engineUnit: 'm' },
  // Trajectory's own optional "for this tool only" stand-in for zeroRange
  // above — same quantity, same engine unit, its own field id only so it
  // can have its own (blank-by-default) value independent of the rifle's
  // actual configured zero range.
  zeroRangeOverride: { group: 'distance', engineUnit: 'm' },
  r1: { group: 'distance', engineUnit: 'm' },
  r2: { group: 'distance', engineUnit: 'm' },
  targetRange: { group: 'distance', engineUnit: 'm' },
  battleZeroRange: { group: 'distance', engineUnit: 'm' },
  truingBackdropHeight: { group: 'distance', engineUnit: 'm' },

  sightHeight: { group: 'smallLength', engineUnit: 'm' },
  riflingTwist: { group: 'riflingTwist', engineUnit: 'm' },
  aimOffsetX: { group: 'smallLength', engineUnit: 'm' },
  aimOffsetY: { group: 'smallLength', engineUnit: 'm' },
  // The two user-sizeable targets' own dimension fields (Circle gong,
  // Rectangle plate) — same group/engineUnit as the aim-offset fields
  // just above, since these are all "how big is this thing, in cm-ish
  // terms" inputs a shooter thinks about the same way.
  circleGongDiameter: { group: 'smallLength', engineUnit: 'm' },
  rectPlateWidth: { group: 'smallLength', engineUnit: 'm' },
  rectPlateHeight: { group: 'smallLength', engineUnit: 'm' },
  // Trajectory's own Target section (direct-hit distance) — same
  // "how big is this thing, in cm-ish terms" shape as the two above.
  targetHeight: { group: 'smallLength', engineUnit: 'm' },

  altitudeM: { group: 'altitude', engineUnit: 'm' },
  tempC: { group: 'temperature', engineUnit: 'tempC' },
  referenceTempC: { group: 'temperature', engineUnit: 'tempC' },
  // A span (an interval of uncertainty), not an absolute reading — see
  // unitField's isSpan option.
  tempMedianError: { group: 'temperature', engineUnit: 'tempC' },
  pressure: { group: 'pressure', engineUnit: 'Pa' },
  pressureMedianError: { group: 'pressure', engineUnit: 'Pa' },
  humidity: { group: 'ratio', engineUnit: '1' },
  losAngle: { group: 'angleDegrees', engineUnit: 'rad' },
  windAngle: { group: 'angleDegrees', engineUnit: 'rad' },
  benchPrecision: { group: 'angleDispersion', engineUnit: 'rad' },
  shooterSkill: { group: 'angleDispersion', engineUnit: 'rad' },
  combinedPrecision: { group: 'angleDispersion', engineUnit: 'rad' },
  // Hit Probability's own spotter-corrected-fire panel — was missing this
  // entry despite being built with the same presetUnitField()/unitField()
  // machinery as its three siblings just above, so it silently never
  // converted to the user's angleDispersion (MOA) preference. PRESETS.
  // spotterMeasure's own values (src/views/hit-probability-view.js) are
  // radians, matching this engineUnit.
  spotterMeasure: { group: 'angleDispersion', engineUnit: 'rad' },
  // estimation errors as a fraction of the estimate (0.05), shown in %
  distanceMedianError: { group: 'ratio', engineUnit: '1' },
  movingTargetSpeedError: { group: 'ratio', engineUnit: '1' },
  // Not a form field — the trajectory view's own kinetic-energy column/
  // chart series computes 0.5*massKg*velocity^2 itself (Joules, SI) and
  // converts it for display through this entry, the same way it already
  // does for `range`.
  energy: { group: 'energy', engineUnit: 'J' },
  // The trajectory table/chart's velocity-at-range column — same
  // engineUnit as muzzleVelocity, kept as its own entry since it isn't a
  // form field either (mirrors `energy` above).
  velocity: { group: 'velocity', engineUnit: 'm/s' },

  // Arsenal's bullet add/edit form (caliber-field.js's own number input,
  // bullet-form.js's length input). caliberM's engine unit is meters,
  // matching how it's stored everywhere else in the app; bulletLength's
  // is mm, matching how its own field has always worked (its record
  // field, lengthM, is meters — bullet-form.js bridges mm<->meters
  // itself, same as before this entry existed). Both fields use their
  // own tighter display precision (SMALL_LENGTH_PRECISION_DECIMALS
  // below) rather than this group's own coarser one — a bore diameter or
  // a bullet length needs finer resolution than sight height or drop.
  caliberM: { group: 'smallLength', engineUnit: 'm' },
  bulletLength: { group: 'smallLength', engineUnit: 'mm' }
};

// mm/cm/in decimal precision for the two Arsenal bullet-geometry fields
// above (caliber, length) — real diameters/lengths need finer resolution
// than UNIT_GROUPS.smallLength's own display `decimals` (tuned for
// coarser things like sight height or trajectory drop), so these two
// fields round/step to their own tighter precision instead.
export const SMALL_LENGTH_PRECISION_DECIMALS = { mm: 2, cm: 3, in: 3 };

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
  return converter(meta.engineUnit, displayUnit)(engineValue);
}

export function displayToEngine(fieldId, displayValue, displayUnit) {
  const meta = FIELD_UNITS[fieldId];
  if (!meta || meta.engineUnit === displayUnit) return displayValue;
  return converter(displayUnit, meta.engineUnit)(displayValue);
}

// For converting a step size or a min/max span rather than an absolute
// value — see deltaUnit() above for why this has to be a separate path.
export function engineSpanToDisplay(fieldId, span, displayUnit) {
  const meta = FIELD_UNITS[fieldId];
  if (!meta || meta.engineUnit === displayUnit) return span;
  return converter(deltaUnit(meta.engineUnit), deltaUnit(displayUnit))(span);
}

// The reverse of engineSpanToDisplay() — for a field whose *value itself*
// is a span/interval rather than an absolute reading (e.g. a temperature
// median-error field: "5 degrees" of uncertainty, not a point on the
// scale), so typed input needs to go back to engine units the same
// offset-free way.
export function displaySpanToEngine(fieldId, span, displayUnit) {
  const meta = FIELD_UNITS[fieldId];
  if (!meta || meta.engineUnit === displayUnit) return span;
  return converter(deltaUnit(displayUnit), deltaUnit(meta.engineUnit))(span);
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
// one-and-only raw unit for anything with no FIELD_UNITS entry (bc, mass
// — always g regardless of prefs, scope clicks, tof, sightingShotCount,
// convBc, cdTableCd). Centralized
// here — not scattered as a literal min/max at each call site —
// specifically so the same physical quantity can't quietly end up with
// two different bounds in two views the way windSpeed (20 vs 30 m/s) and
// targetRange (2000 vs 3000m) had before this was written; every caller
// now points at the one number.
export const FIELD_BOUNDS = {
  caliberM: { min: 0.004, max: 0.021 }, // m — matches FIELD_UNITS.caliberM's own meters engine unit
  bulletLength: { min: 5, max: 100 }, // mm — matches FIELD_UNITS.bulletLength's own mm engine unit; bullet-section.js's own separate hand-rolled length field still assumes mm too
  bulletMass: { min: 1, max: 121 }, // g, always — mass-field.js's own gram/grain pair
  bc: { min: 0.05, max: 1.5 },
  cdTableCd: { min: 0.05, max: 3.0 }, // a single Cd-vs-Mach table row's own Cd value
  sightHeight: { min: 0, max: 0.5 }, // m
  zeroRange: { min: 0, max: 5000 }, // m
  riflingTwist: { min: 0.001, max: 1 }, // m — optional (blank) is handled separately; 0 itself is a Miller's-formula divisor
  scopeClick: { min: 0.01, max: 5 }, // click value, unit-agnostic by design (see CLICK_UNITS above)
  muzzleVelocity: { min: 50, max: 1500 }, // m/s — also reused for BC Tools' v1/v2/conversion velocity
  referenceTempC: { min: -90, max: 60 }, // °C — also reused for tempC
  tempC: { min: -90, max: 60 }, // °C
  velocityTempSensitivity: { min: -5, max: 5 }, // m/s per °C, engine unit always — see velocityPerTempFactor() above
  altitudeM: { min: -500, max: 6000 }, // m
  targetRange: { min: 10, max: 5000 }, // m
  losAngle: { min: degToRad(-90), max: degToRad(90) }, // rad
  windSpeed: { min: 0, max: 35 }, // m/s
  pressure: { min: 45000, max: 110000 }, // Pa
  humidity: { min: 0, max: 1 }, // fraction
  battleZeroRange: { min: 0, max: 5000 }, // m — matches zeroRange, same physical quantity
  r1: { min: 0, max: 200 }, // m
  r2: { min: 10, max: 3000 }, // m
  tof: { min: 0.001, max: 30 }, // s, no FIELD_UNITS entry
  sightingShotCount: { min: 1, max: 5 }, // count, integer
  convBc: { min: 0.05, max: 1.5 }, // matches bc
  maxRange: { min: 100, max: 5000 }, // m — matches targetRange, same physical quantity
  rangeStep: { min: 1, max: 500 }, // m
  benchPrecision: { min: 0, max: mradToRad(3) }, // rad
  shooterSkill: { min: 0, max: mradToRad(3) }, // rad
  combinedPrecision: { min: 0, max: mradToRad(3) }, // rad
  distanceMedianError: { min: 0, max: 0.5 }, // fraction
  tempMedianError: { min: 0, max: 20 }, // °C span
  pressureMedianError: { min: 0, max: 3000 }, // Pa
  windMedianError: { min: 0, max: 10 }, // m/s
  movingTargetSpeed: { min: 0, max: 30 }, // m/s
  movingTargetSpeedError: { min: 0, max: 1 }, // fraction
  muzzleVelocitySD: { min: 0, max: 20 }, // m/s
  spotterMeasure: { min: 0, max: mradToRad(5) }, // rad
  aimOffsetX: { min: -1, max: 1 }, // m
  aimOffsetY: { min: -1, max: 1 }, // m
  circleGongDiameter: { min: 0.01, max: 2 }, // m
  targetHeight: { min: 0.01, max: 3 }, // m — matches rectPlateHeight, same kind of quantity
  rectPlateWidth: { min: 0.01, max: 3 }, // m
  rectPlateHeight: { min: 0.01, max: 3 }, // m
  bcGainFactor: { min: 0.8, max: 1.2 }, // unitless multiplier, no FIELD_UNITS entry — see makeStepper() in engine/trajectory.js
  truingBackdropHeight: { min: 1, max: 40 } // m, total height -- see engine/truing-session.js's own "each way" margin, which this is divided by 2 to produce
};

// The bounds message's own "allowed range" text, in whatever unit the
// field is currently displayed in — same engineToDisplay()/
// roundForDisplay() round-trip the field's own value already goes
// through, so e.g. a muzzle-velocity bound of 50–1500 m/s reads as
// "164 – 4921 ft/s" for a user who's switched to imperial, not a raw
// metric number in a field that no longer shows metric anywhere else.
// Falls back to the bare numbers, no unit suffix, for a field with no
// FIELD_UNITS entry (bc, clicks, ...) — exactly what
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
  const velocityFactor = converter(SENSITIVITY_ENGINE_VELOCITY_UNIT, velocityUnit)(1);
  // The temperature axis here is an interval (a slope's run), not a point
  // on the scale, so it goes through the same offset-free 'deg' unit as
  // engineSpanToDisplay() uses for slider steps — see deltaUnit() above.
  const tempIntervalFactor = converter(deltaUnit(SENSITIVITY_ENGINE_TEMP_UNIT), deltaUnit(tempUnit))(1);
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

// A click value is defined to this many decimals in its turret's own unit
// (0.1 mrad, 0.25 MOA, 0.125 MOA) — so a click size held in radians always
// comes back to its engraved figure exactly when rounded to it.
export const CLICK_VALUE_DECIMALS = 3;

// A click size in radians, back in its turret's unit, rounded to the
// precision click values are defined to.
export function clickValueInUnit(clickRad, unit) {
  const factor = 10 ** CLICK_VALUE_DECIMALS;
  return Math.round(converter('rad', unit)(clickRad) * factor) / factor;
}

export function convertAngularValue(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  return converter(fromUnit, toUnit)(value);
}

// Lateral displacement (m) produced by one unit of angle (1 MOA or 1
// mrad) at a given range (m) — the standard small-angle approximation.
export function angularUnitToLinearAtRange(unit, rangeM) {
  return angleToLinearAtRange(converter(unit, 'rad')(1), rangeM);
}

// How many scope clicks of `clickRad` (a click's size, in radians) are
// needed to correct a lateral offset of `offsetM` at `rangeM`. Guards
// against Infinity/NaN reaching the UI if the click value or range is zero.
export function clicksForOffset(offsetM, clickRad, rangeM) {
  if (!clickRad || rangeM <= 0) return 0;
  const metresPerClick = angleToLinearAtRange(clickRad, rangeM);
  return metresPerClick === 0 ? 0 : offsetM / metresPerClick;
}
