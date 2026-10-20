import test from 'node:test';
import assert from 'node:assert/strict';
import Qty from '../src/vendor/js-quantities/quantities.mjs';
import {
  QUANTITY_KINDS, converter, convert, kindOfUnit, internalUnit, toInternal, fromInternal,
  degToRad, radToDeg, mradToRad, radToMrad, moaToRad, radToMoa, percentToFraction, fractionToPercent,
  hpaToPa, paToHpa, mmToM, mToMm, cmToM, mToCm, inToM, mToIn, kgToGrain, grainToKg, kgToG, gToKg,
  celsiusToKelvin, kelvinToCelsius, angleToLinearAtRange, linearToAngleAtRange
} from '../src/quantity.js';
import { UNIT_GROUPS } from '../src/units.js';
import { LBIN2_TO_KGM2 } from '../src/engine/constants.js';

const relClose = (a, b, tol = 1e-14) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-300);

// A deterministic spread of magnitudes and signs, so failures reproduce.
function sampleValues() {
  const out = [0, 1, -1, 0.1, 0.25, 7, 15, 100, 925.3, 1013.25];
  let seed = 12345;
  for (let i = 0; i < 300; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const u = seed / 2147483648;
    out.push((u - 0.3) * 10 ** (u * 8 - 4));
  }
  return out;
}

test('every display unit in UNIT_GROUPS belongs to exactly the kind its group implies', () => {
  const expectedKind = {
    velocity: 'velocity', windSpeed: 'velocity', distance: 'length', smallLength: 'length', riflingTwist: 'length',
    altitude: 'length', temperature: 'temperature', pressure: 'pressure', angleDispersion: 'angle', energy: 'energy'
  };
  for (const [group, { choices }] of Object.entries(UNIT_GROUPS)) {
    for (const { unit } of choices) {
      assert.equal(kindOfUnit(unit), expectedKind[group], `${group}: ${unit}`);
    }
  }
});

test('every kind\'s internal unit converts to itself as the identity', () => {
  for (const [kind, unit] of Object.entries(QUANTITY_KINDS)) {
    assert.equal(internalUnit(kind), unit);
    for (const v of sampleValues()) assert.equal(toInternal(v, unit, kind), v);
  }
});

test('converters agree with js-quantities\' own Qty(...).to(...) to within an ulp or so', () => {
  const pairs = [
    ['m/s', 'ft/s'], ['m/s', 'mph'], ['m/s', 'km/h'], ['m', 'yd'], ['m', 'ft'], ['mm', 'm'], ['cm', 'm'], ['in', 'm'],
    ['hPa', 'Pa'], ['inHg', 'Pa'], ['mmHg', 'Pa'], ['psi', 'Pa'], ['mrad', 'rad'], ['arcmin', 'rad'], ['deg', 'rad'],
    ['J', 'ft*lbf'], ['g', 'kg'], ['grain', 'kg'], ['tempC', 'tempF'], ['degC', 'degF']
  ];
  for (const [a, b] of pairs) {
    for (const v of sampleValues()) {
      assert.ok(relClose(convert(v, a, b), Qty(v, a).to(b).scalar, 1e-13) || Math.abs(convert(v, a, b) - Qty(v, a).to(b).scalar) < 1e-12, `${v} ${a}->${b}`);
      assert.ok(relClose(convert(v, b, a), Qty(v, b).to(a).scalar, 1e-13) || Math.abs(convert(v, b, a) - Qty(v, b).to(a).scalar) < 1e-12, `${v} ${b}->${a}`);
    }
  }
});

test('round trips through every display unit come back to within float noise', () => {
  for (const { choices } of Object.values(UNIT_GROUPS)) {
    for (const { unit } of choices) {
      const kind = kindOfUnit(unit);
      for (const v of sampleValues()) {
        const back = toInternal(fromInternal(v, unit, kind), unit, kind);
        assert.ok(relClose(back, v, 1e-13) || Math.abs(back - v) < 1e-12, `${v} via ${unit}: ${back}`);
      }
    }
  }
});

test('conversions are deterministic: the same call returns a bit-identical double, whichever entry point is used', () => {
  for (const v of sampleValues()) {
    assert.equal(convert(v, 'mm', 'm'), mmToM(v));
    assert.equal(converter('mm', 'm')(v), mmToM(v));
    assert.equal(toInternal(v, 'mm'), mmToM(v));
    assert.equal(fromInternal(v, 'mm'), mToMm(v));
    assert.equal(degToRad(v), convert(v, 'deg', 'rad'));
  }
  assert.equal(converter('m', 'yd'), converter('m', 'yd'), 'converters are cached per unit pair');
});

test('exact definitions: inch, pound-derived units, MOA and mrad', () => {
  assert.equal(inToM(1), 0.0254);
  assert.equal(mToMm(0.0254), 25.4);
  assert.equal(mradToRad(1), 0.001);
  assert.ok(relClose(moaToRad(1), Math.PI / 10800));
  assert.ok(relClose(kgToGrain(1), 1 / 64.79891e-6));
  assert.ok(relClose(convert(1, 'lb/in^2', 'kg/m^2'), LBIN2_TO_KGM2), 'the engine\'s own BC constant agrees with the library');
  assert.equal(hpaToPa(1013.25), 101325);
  assert.equal(paToHpa(101325), 1013.25);
});

test('named routines round-trip', () => {
  const pairs = [[degToRad, radToDeg], [mradToRad, radToMrad], [moaToRad, radToMoa], [percentToFraction, fractionToPercent],
    [hpaToPa, paToHpa], [mmToM, mToMm], [cmToM, mToCm], [inToM, mToIn], [kgToGrain, grainToKg], [kgToG, gToKg]];
  for (const [f, g] of pairs) {
    for (const v of sampleValues()) {
      const back = g(f(v));
      assert.ok(relClose(back, v, 1e-13) || Math.abs(back - v) < 1e-12);
    }
  }
});

test('ratio: percent is a display unit for a plain fraction', () => {
  assert.equal(percentToFraction(25), 0.25);
  assert.equal(fractionToPercent(0.25), 25);
  assert.equal(kindOfUnit('%'), 'ratio');
  assert.equal(toInternal(50, '%'), 0.5);
  assert.throws(() => convert(1, '%', 'm'), /incompatible/);
});

test('temperature: a point and an interval are different kinds and refuse to mix', () => {
  assert.equal(kindOfUnit('tempF'), 'temperature');
  assert.equal(kindOfUnit('degF'), 'temperatureDelta');
  assert.ok(relClose(toInternal(59, 'tempF'), 15, 1e-12));
  assert.ok(relClose(toInternal(9, 'degF'), 5, 1e-12));
  assert.throws(() => convert(1, 'tempC', 'degC'), /incompatible/);
});

test('celsiusToKelvin matches the library\'s own scale offset', () => {
  assert.equal(celsiusToKelvin(0), Qty(0, 'tempC').to('tempK').scalar);
  assert.equal(celsiusToKelvin(15), 288.15);
  for (const v of sampleValues()) assert.ok(Math.abs(kelvinToCelsius(celsiusToKelvin(v)) - v) < 1e-9);
});

test('unknown units and mismatched kinds throw instead of converting by 1', () => {
  assert.throws(() => convert(1, 'furlongz', 'm'), /unknown unit/);
  assert.throws(() => convert(1, 'm', 'kg'), /incompatible/);
  assert.throws(() => kindOfUnit('furlongz'), /no known quantity kind/);
  assert.throws(() => internalUnit('colour'), /unknown quantity kind/);
});

test('angle and linear offset at range: the small-angle definition shooting units use', () => {
  assert.ok(relClose(angleToLinearAtRange(mradToRad(1), 100), 0.1));
  assert.ok(relClose(linearToAngleAtRange(0.1, 100), mradToRad(1)));
  assert.equal(linearToAngleAtRange(0.1, 0), 0);
});
