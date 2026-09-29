// How a dope correction is written for the shooter: in the unit chosen in Range Solver's settings (clicks, mrad or MOA),
// with the same direction glyphs (arrows, signs or U/D/L/R). Shared by Range Solver and the Truing Session's next-shot
// readout, so the two always read alike.
import { convertAngularValue } from '../units.js';
import { getIndicatorStyle, getOutputUnit } from '../range-solver-prefs.js';

// Matches range-solver-prefs.js's own INDICATOR_STYLE_CHOICES values.
export const INDICATOR_GLYPHS = {
  arrows: { elevationPositive: '↑', elevationNegative: '↓', windagePositive: '→', windageNegative: '←' },
  signs: { elevationPositive: '+', elevationNegative: '−', windagePositive: '+', windageNegative: '−' },
  udlr: { elevationPositive: 'U', elevationNegative: 'D', windagePositive: 'R', windageNegative: 'L' }
};

const OUTPUT_LABEL = { clicks: null, mrad: 'mrad', moa: 'MOA' };

// One angular correction, in mrad with the engine's sign (elevation: positive is dial up; windage: the same raw sign Range
// Solver shows), as { glyph, number, unit, text }: whole clicks, or one decimal for mrad and MOA, as Range Solver rounds.
// `clickMrad` is the scope's click for that axis, in mrad. `unit` 'clicks' | 'mrad' | 'moa'; `clicksLabel` is the word for it.
export function formatDope({ mrad, axis, clickMrad, clicksLabel = 'clicks', unit = getOutputUnit(), style = getIndicatorStyle() }) {
  const glyphs = INDICATOR_GLYPHS[style] || INDICATOR_GLYPHS.signs;
  const value = unit === 'clicks' ? mrad / clickMrad : unit === 'moa' ? convertAngularValue(mrad, 'mrad', 'arcmin') : mrad;
  const decimals = unit === 'clicks' ? 0 : 1;
  const rounded = Number(value.toFixed(decimals));
  const glyph = rounded === 0 ? '' : rounded > 0 ? glyphs[`${axis}Positive`] : glyphs[`${axis}Negative`];
  const number = Math.abs(rounded).toFixed(decimals);
  const unitText = OUTPUT_LABEL[unit] ?? clicksLabel;
  return { glyph, number, unit: unitText, text: `${glyph ? `${glyph} ` : ''}${number} ${unitText}` };
}

// The same size with no sign, for an uncertainty ("± 0.4 clicks"): one decimal for clicks too, since it is small.
export function formatDopeSpread({ mrad, clickMrad, clicksLabel = 'clicks', unit = getOutputUnit() }) {
  const value = unit === 'clicks' ? mrad / clickMrad : unit === 'moa' ? convertAngularValue(mrad, 'mrad', 'arcmin') : mrad;
  return `${Math.abs(value).toFixed(unit === 'clicks' ? 1 : 2)} ${OUTPUT_LABEL[unit] ?? clicksLabel}`;
}
