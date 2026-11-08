// The values of the printable card's three info boxes (rifle and
// cartridge, reference conditions, units and wind), formatted for people
// in the user's units — the presentation edge for everything the card
// prints outside its table. Shared by the Printable card tab's summary and
// the PDF, so both always show the same.
import { formatQuantity, displayChoice, toFixedDisplay, toDisplayUnit } from '../display-units.js';
import { velocityPerTempToDisplay, clickValueInUnit, CLICK_UNITS } from '../units.js';
import { getUnit } from '../prefs.js';
import { kgToGrain, kgToG, fractionToPercent } from '../quantity.js';

const MINUS = '−';

const signed = (text) => (text.startsWith('-') ? `${MINUS}${text.slice(1)}` : `+${text}`);
const trimZeros = (value, places) => String(Number(value.toFixed(places)));

// The output unit's name, as the card's units box and table headings say
// it: the Range Solver's choice (clicks, mrad, MOA).
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
// Range Solver's. `crosswindMs`. `t`.
export function cardValues({ names, cartridge, rifle, clicks, atmosphere, outputUnit, crosswindMs, t }) {
  const v = {};
  v.rifle = names.rifleName;
  v.cartridge = names.loadName;
  const grains = Math.round(kgToGrain(cartridge.massKg));
  const grams = toFixedDisplay(kgToG(cartridge.massKg), 1);
  const mass = Number.isFinite(cartridge.massKg) ? `${grains} gr (${grams} g)` : '';
  v.bullet = [names.bulletName, mass].filter(Boolean).join(' ');

  const mv = formatQuantity('velocity', cartridge.muzzleVelocity, { decimals: 0 });
  const hasTemp = Number.isFinite(cartridge.referenceTempC) && Number.isFinite(cartridge.velocityTempSensitivity);
  v.muzzleVelocity = hasTemp
    ? t('printableCard.pdf.velocityAt', { velocity: mv, temperature: formatQuantity('temperature', cartridge.referenceTempC, { decimals: 0 }) })
    : mv;
  if (hasTemp) {
    const vUnit = getUnit('velocity');
    const tUnit = getUnit('temperature');
    const perDegree = velocityPerTempToDisplay(cartridge.velocityTempSensitivity, vUnit, tUnit);
    const velocityLabel = displayChoice('velocity').label;
    const tempLabel = displayChoice('temperature').label;
    v.velocityChange = t('printableCard.pdf.perDegree', { velocity: `${signed(trimZeros(perDegree, 2))} ${velocityLabel}`, temperature: tempLabel });
  } else {
    v.velocityChange = '—';
  }

  v.ballisticCoefficient = cartridge.cdTable
    ? t('printableCard.pdf.customCurve')
    : `${cartridge.dragModel} ${Number(cartridge.bc).toFixed(3)}`;

  v.zero = formatQuantity('distance', rifle.zeroRange, { decimals: 0 });
  v.sightHeight = formatQuantity('smallLength', rifle.sightHeightM, { decimals: (c) => SIGHT_HEIGHT_DECIMALS[c.unit] ?? c.decimals });
  const clickLabel = (CLICK_UNITS.find((c) => c.unit === clicks.unit) || CLICK_UNITS[0]).label;
  v.clickVertical = `${trimZeros(clickValueInUnit(clicks.verticalRad, clicks.unit), 3)} ${clickLabel}`;
  v.clickHorizontal = `${trimZeros(clickValueInUnit(clicks.horizontalRad, clicks.unit), 3)} ${clickLabel}`;

  v.altitude = Number.isFinite(atmosphere.altitudeM) ? formatQuantity('altitude', atmosphere.altitudeM, { decimals: 0 }) : '—';
  v.pressure = formatQuantity('pressure', atmosphere.pressurePa, { decimals: (c) => PRESSURE_DECIMALS[c.unit] ?? c.decimals });
  v.temperature = formatQuantity('temperature', atmosphere.tempC, { decimals: 0 });
  v.humidity = `${Math.round(fractionToPercent(atmosphere.humidity))} %`;
  v.shotAngle = '0°';

  v.distanceUnit = displayChoice('distance').label;
  v.correctionUnit = outputUnitLabel(outputUnit, t);
  const wind = displayChoice('windSpeed');
  v.crosswindSpeed = `${trimZeros(toDisplayUnit('windSpeed', crosswindMs), wind.decimals)} ${wind.label}`;
  return v;
}

// The two boxes as the tab's summary shows them: [{ headingKey, rows:
// [{ labelKey, value }] }], in the card's order.
export function cardInfoBoxes(v) {
  const row = (labelKey, value) => ({ labelKey, value });
  return [
    { headingKey: 'printableCard.pdf.rifleAndCartridge', rows: [
      row('printableCard.pdf.rifle', v.rifle),
      row('printableCard.pdf.cartridge', v.cartridge),
      row('printableCard.pdf.bullet', v.bullet),
      row('printableCard.pdf.muzzleVelocity', v.muzzleVelocity),
      row('printableCard.pdf.velocityChange', v.velocityChange),
      row('printableCard.pdf.ballisticCoefficient', v.ballisticCoefficient),
      row('printableCard.pdf.zeroSightHeight', `${v.zero} · ${v.sightHeight}`),
      row('printableCard.pdf.scopeClick', `${v.clickVertical} · ${v.clickHorizontal}`)
    ] },
    { headingKey: 'printableCard.pdf.referenceConditions', rows: [
      row('printableCard.pdf.altitude', v.altitude),
      row('printableCard.pdf.pressure', v.pressure),
      row('printableCard.pdf.temperature', v.temperature),
      row('printableCard.pdf.humidity', v.humidity),
      row('printableCard.pdf.shotAngle', v.shotAngle),
      row('printableCard.pdf.crosswindSpeed', v.crosswindSpeed),
      row('printableCard.pdf.distanceUnit', v.distanceUnit),
      row('printableCard.pdf.correctionUnit', v.correctionUnit)
    ] }
  ];
}
