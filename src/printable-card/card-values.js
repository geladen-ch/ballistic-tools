// The values the printable card prints outside its table (the rifle and
// cartridge boxes, the reference conditions line), formatted for people
// in the user's units — the presentation edge for everything the card
// prints outside its table. Shared by the Printable card tab's summary and
// the PDF, so both always show the same.
import { formatQuantity, displayChoice, toFixedDisplay, toDisplayUnit } from '../display-units.js';
import { velocityPerTempToDisplay, clickValueInUnit, CLICK_UNITS } from '../units.js';
import { getUnit } from '../prefs.js';
import { kgToGrain, kgToG, fractionToPercent } from '../quantity.js';

const MINUS = '−';

const trimZeros = (value, places) => String(Number(value.toFixed(places)));

// The output unit's name, as the card's corrections heading says it: the Range Solver's choice (clicks, mrad, MOA).
export function outputUnitLabel(unit, t) {
  if (unit === 'mrad') return 'mrad';
  if (unit === 'moa') return 'MOA';
  return t('printableCard.pdf.clicks');
}

const PRESSURE_DECIMALS = { hPa: 0, inHg: 2, mmHg: 0, psi: 2 };
const SIGHT_HEIGHT_DECIMALS = { mm: 0, cm: 1, in: 2 };

// `names`: gun-names.js's resolveGunNames(). `cartridge`: the cartridge
// section's getValues(). `rifle`: the rifle section's getValues().
// `clicks`: its getClickSettings().
// `atmosphere`: the atmosphere section's getValues(). `outputUnit`: the
// Range Solver's. `crosswindMs`: the table's wind column. `t`.
export function cardValues({ names, cartridge, rifle, clicks, atmosphere, outputUnit, crosswindMs, t }) {
  const v = {};
  v.rifle = names.rifleName;
  v.cartridge = names.loadName;
  const grains = Math.round(kgToGrain(cartridge.massKg));
  const grams = toFixedDisplay(kgToG(cartridge.massKg), 1);
  const mass = Number.isFinite(cartridge.massKg) ? `${grains} gr (${grams} g)` : '';
  v.bullet = [names.bulletName, mass].filter(Boolean).join(' ');

  // Muzzle velocity, with its change per degree when the cartridge has
  // one: "800 m/s (0.7 m/s per °C)".
  const mv = formatQuantity('velocity', cartridge.muzzleVelocity, { decimals: 0 });
  const hasTemp = Number.isFinite(cartridge.referenceTempC) && Number.isFinite(cartridge.velocityTempSensitivity);
  if (hasTemp) {
    const perDegree = velocityPerTempToDisplay(cartridge.velocityTempSensitivity, getUnit('velocity'), getUnit('temperature'));
    const drift = t('printableCard.pdf.perDegree', {
      velocity: `${trimZeros(perDegree, 2).replace('-', MINUS)} ${displayChoice('velocity').label}`,
      temperature: displayChoice('temperature').label
    });
    v.muzzleVelocity = `${mv} (${drift})`;
  } else {
    v.muzzleVelocity = mv;
  }

  // The bullet's drag: its BC and model, or its own Cd curve.
  v.dragLabel = t(cartridge.cdTable ? 'printableCard.pdf.dragCurve' : 'printableCard.pdf.ballisticCoefficient');
  v.drag = cartridge.cdTable
    ? t('printableCard.pdf.customCurve')
    : `${cartridge.dragModel} ${Number(cartridge.bc).toFixed(3)}`;

  v.zero = formatQuantity('distance', rifle.zeroRange, { decimals: 0 });
  v.sightHeight = formatQuantity('smallLength', rifle.sightHeightM, { decimals: (c) => SIGHT_HEIGHT_DECIMALS[c.unit] ?? c.decimals });
  const clickLabel = (CLICK_UNITS.find((c) => c.unit === clicks.unit) || CLICK_UNITS[0]).label;
  v.clickVertical = `${trimZeros(clickValueInUnit(clicks.verticalRad, clicks.unit), 3)} ${clickLabel}`;
  v.clickHorizontal = `${trimZeros(clickValueInUnit(clicks.horizontalRad, clicks.unit), 3)} ${clickLabel}`;

  v.altitude = Number.isFinite(atmosphere.altitudeM) ? formatQuantity('altitude', atmosphere.altitudeM, { decimals: 0 }) : null;
  v.pressure = formatQuantity('pressure', atmosphere.pressurePa, { decimals: (c) => PRESSURE_DECIMALS[c.unit] ?? c.decimals });
  v.temperature = formatQuantity('temperature', atmosphere.tempC, { decimals: 0 });
  v.humidity = `${Math.round(fractionToPercent(atmosphere.humidity))} %`;
  // The reference conditions as the card's heading lists them, unlabelled
  // but for the altitude: "alt. 1400 m, 855 hPa, 15 °C, 50 %".
  v.conditions = [
    v.altitude && t('printableCard.pdf.altitudeShort', { value: v.altitude }),
    v.pressure, v.temperature, v.humidity
  ].filter(Boolean).join(', ');

  v.correctionUnit = outputUnitLabel(outputUnit, t);
  // A unit symbol (mrad, MOA) keeps its case in the corrections heading,
  // which is in capitals; the word "clicks" doesn't.
  v.correctionUnitIsSymbol = outputUnit === 'mrad' || outputUnit === 'moa';
  const wind = displayChoice('windSpeed');
  v.crosswindSpeed = `${trimZeros(toDisplayUnit('windSpeed', crosswindMs), wind.decimals)} ${wind.label}`;
  return v;
}

// The boxes as the tab's summary shows them: [{ headingKey, rows:
// [{ labelKey | label, value }] }], in the card's order; the reference
// conditions get labels here, which the card's one-line heading leaves out.
export function cardInfoBoxes(v) {
  const row = (labelKey, value) => ({ labelKey, value });
  return [
    { headingKey: 'printableCard.pdf.rifle', rows: [
      row('printableCard.pdf.rifle', v.rifle),
      row('printableCard.pdf.zeroRange', v.zero),
      row('printableCard.pdf.sightHeight', v.sightHeight),
      row('printableCard.pdf.scopeClick', `${v.clickVertical} · ${v.clickHorizontal}`)
    ] },
    { headingKey: 'printableCard.pdf.cartridge', rows: [
      row('printableCard.pdf.cartridge', v.cartridge),
      row('printableCard.pdf.bullet', v.bullet),
      row('printableCard.pdf.muzzleVelocity', v.muzzleVelocity),
      { label: v.dragLabel, value: v.drag }
    ] },
    { headingKey: 'printableCard.pdf.referenceConditions', rows: [
      row('printableCard.pdf.altitude', v.altitude ?? '—'),
      row('printableCard.pdf.pressure', v.pressure),
      row('printableCard.pdf.temperature', v.temperature),
      row('printableCard.pdf.humidity', v.humidity),
      row('printableCard.pdf.correctionUnit', v.correctionUnit)
    ] }
  ];
}
