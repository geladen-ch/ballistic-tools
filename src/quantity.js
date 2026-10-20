// The app's one and only unit-conversion module. Everything inside the app
// (engine, view models, worker messages, stored records) works in each
// quantity kind's internal unit below — SI throughout, with two
// deliberate exceptions: temperature stays in °C (a reading people
// actually think in, and an SI-derived unit in its own right) and
// ballistic coefficient stays in lb/in² (how every box label, catalog and
// chronograph tool quotes it). Conversion to and from whatever unit the
// user sees happens only at the presentation edge, and always through a
// function exported from here — never as an inline `* 1000` or
// `* Math.PI / 180` at a call site.
//
// Backed by js-quantities, whose unit definitions are exact (inch =
// 0.0254 m, pound = 0.45359237 kg, ...). This module is the only one
// allowed to import it (tests/no-inline-conversions.test.js enforces
// that), for two reasons:
//  - Determinism. Qty(v, a).to(b) and Qty.swiftConverter(a, b)(v) round
//    differently in the last bit for about a third of inputs. Sync merging
//    compares records structurally, so two devices converting the same
//    value must get the same double — which only holds if every
//    conversion of a given unit pair takes the same code path. Here it is
//    always the cached swift converter.
//  - Speed. A swift converter is a plain multiply-and-divide; Qty(...)
//    parses unit strings and allocates on every call, which matters when a
//    trajectory table formats thousands of cells.
import Qty from './vendor/js-quantities/quantities.mjs';

// Quantity kind → the unit every value of that kind is held in inside the
// app. Unit strings are js-quantities' own spellings ('tempC' is a point
// on the Celsius scale, 'degC' a Celsius-sized interval; 'arcmin' is MOA).
export const QUANTITY_KINDS = {
  length: 'm',
  velocity: 'm/s',
  mass: 'kg',
  time: 's',
  pressure: 'Pa',
  angle: 'rad',
  energy: 'J',
  temperature: 'tempC',
  temperatureDelta: 'degC',
  ratio: '1',
  ballisticCoefficient: 'lb/in^2'
};

// Units with no js-quantities spelling of their own that this app still
// needs to name: a plain dimensionless ratio. '1' is its internal unit
// (a fraction, 0.25), '%' the display one (25).
const RATIO_UNITS = new Set(['1', '%']);

const converterCache = new Map();

// js-quantities defines the degree by a truncated factor (0.0174532925199433,
// 3e-16 short of pi/180), so 90 degrees would not come out as exactly pi/2
// and disagree in the last bit with angles written in radians. Degrees are
// therefore converted through the exact pi/180, by way of radians.
const DEGREE_RAD = Math.PI / 180;
const DEGREE_UNITS = new Set(['deg', 'degree', 'degrees']);

function buildConverter(from, to) {
  if (from === to) return (v) => v;
  if (DEGREE_UNITS.has(from) && DEGREE_UNITS.has(to)) return (v) => v;
  if (DEGREE_UNITS.has(from)) {
    const radTo = converter('rad', to);
    return (v) => radTo(v * DEGREE_RAD);
  }
  if (DEGREE_UNITS.has(to)) {
    const toRad = converter(from, 'rad');
    return (v) => toRad(v) / DEGREE_RAD;
  }
  if (RATIO_UNITS.has(from) || RATIO_UNITS.has(to)) {
    if (!RATIO_UNITS.has(from) || !RATIO_UNITS.has(to)) {
      throw new Error(`incompatible units: ${from} -> ${to}`);
    }
    const toPercent = Qty.swiftConverter('', '%');
    const fromPercent = Qty.swiftConverter('%', '');
    return from === '%' ? fromPercent : toPercent;
  }
  let src, dst;
  try {
    src = Qty(from);
    dst = Qty(to);
  } catch {
    throw new Error(`unknown unit: ${from} -> ${to}`);
  }
  // A point on a temperature scale and a temperature interval are
  // dimensionally compatible to js-quantities but mean different things
  // (15 °C is 59 °F; a 15 °C span is 27 °F), so mixing them is refused
  // rather than silently picking one interpretation.
  if (!src.isCompatible(dst) || Boolean(src.isTemperature()) !== Boolean(dst.isTemperature())) {
    throw new Error(`incompatible units: ${from} -> ${to}`);
  }
  return Qty.swiftConverter(from, to);
}

// The cached numeric converter function for one unit pair. Throws on an
// unknown unit or a mismatched kind — a typo must fail loudly, not
// convert by 1.
export function converter(from, to) {
  const key = `${from}\u0000${to}`;
  let fn = converterCache.get(key);
  if (!fn) {
    fn = buildConverter(from, to);
    converterCache.set(key, fn);
  }
  return fn;
}

export function convert(value, from, to) {
  return converter(from, to)(value);
}

// The kind a unit belongs to — the one whose internal unit it converts
// to. Throws for a unit outside every kind.
export function kindOfUnit(unit) {
  if (RATIO_UNITS.has(unit)) return 'ratio';
  for (const [kind, internal] of Object.entries(QUANTITY_KINDS)) {
    if (kind === 'ratio') continue;
    try {
      converter(unit, internal);
      return kind;
    } catch {
      // not this kind — keep looking
    }
  }
  throw new Error(`unit belongs to no known quantity kind: ${unit}`);
}

export function internalUnit(kind) {
  const unit = QUANTITY_KINDS[kind];
  if (!unit) throw new Error(`unknown quantity kind: ${kind}`);
  return unit;
}

// A value in `unit` → the same value in its kind's internal unit.
export function toInternal(value, unit, kind = kindOfUnit(unit)) {
  return converter(unit, internalUnit(kind))(value);
}

// A value in its kind's internal unit → the same value in `unit`.
export function fromInternal(value, unit, kind = kindOfUnit(unit)) {
  return converter(internalUnit(kind), unit)(value);
}

// ---- named routines for the conversions code needs by name ----
// Each is the same cached converter as convert() would use, bound once at
// module load, so a hot loop pays nothing beyond the arithmetic itself.

export const degToRad = converter('deg', 'rad');
export const radToDeg = converter('rad', 'deg');
export const mradToRad = converter('mrad', 'rad');
export const radToMrad = converter('rad', 'mrad');
export const moaToRad = converter('arcmin', 'rad');
export const radToMoa = converter('rad', 'arcmin');

export const percentToFraction = converter('%', '1');
export const fractionToPercent = converter('1', '%');

export const hpaToPa = converter('hPa', 'Pa');
export const paToHpa = converter('Pa', 'hPa');

export const mmToM = converter('mm', 'm');
export const mToMm = converter('m', 'mm');
export const cmToM = converter('cm', 'm');
export const mToCm = converter('m', 'cm');
export const inToM = converter('in', 'm');
export const mToIn = converter('m', 'in');

export const kgToGrain = converter('kg', 'grain');
export const grainToKg = converter('grain', 'kg');
export const kgToG = converter('kg', 'g');
export const gToKg = converter('g', 'kg');

// Absolute temperature, for physics that needs it (gas law, speed of
// sound). The offset itself is taken from js-quantities rather than typed
// here, so it can never disagree with the library's own tempC/tempK
// definitions; the function is a plain addition because it runs on every
// RK4 step of every trajectory, where the library's temperature path
// (which allocates) would be the bottleneck.
const CELSIUS_ZERO_K = Qty(0, 'tempC').to('tempK').scalar;
export function celsiusToKelvin(tempC) {
  return tempC + CELSIUS_ZERO_K;
}
export function kelvinToCelsius(tempK) {
  return tempK - CELSIUS_ZERO_K;
}

// Lateral displacement (m) an angle (rad) produces at a range (m), and
// the inverse — the small-angle form, which is what every angular unit in
// shooting (MOA, mrad, clicks) is defined by: 1 mrad is 1 mm per metre,
// not tan(1 mrad).
export function angleToLinearAtRange(angleRad, rangeM) {
  return angleRad * rangeM;
}
export function linearToAngleAtRange(lengthM, rangeM) {
  return rangeM ? lengthM / rangeM : 0;
}
