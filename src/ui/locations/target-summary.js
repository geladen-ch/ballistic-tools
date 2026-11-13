// The "range + optional LoS angle" one-line summary shared by
// locations-view.js's target rows, the Range Solver's target image picker,
// and location-placement-view.js — lifted out here rather than
// duplicated a third time. No unit-conversion knowledge of its own beyond
// the same FIELD_UNITS/getUnit() convention every other display value in
// this app uses.
import { UNIT_GROUPS, unitChoice, siToDisplay } from '../../units.js';
import { getUnit } from '../../prefs.js';
import { radToDeg } from '../../quantity.js';

// roundRange:true drops range to whole numbers instead of the field's own
// usual decimal precision — used by the full-screen photo picker's pin/
// chip legends, where a compact label matters more than the extra digit;
// locations-view.js's own target rows keep the normal precision.
// omitAngle:true leaves the angle out — the Range Solver's Fire! pane while
// it ignores line-of-sight angles, where every shot is solved as level.
export function formatTargetSummary(rangeM, losAngleRad, { roundRange = false, omitAngle = false } = {}) {
  const group = UNIT_GROUPS.distance;
  const displayUnit = getUnit('distance');
  const choice = unitChoice('targetRange', displayUnit) || group.choices.find((c) => c.unit === group.defaultUnit);
  const rangeDecimals = roundRange ? 0 : choice.decimals;
  const rangeText = `${siToDisplay('targetRange', rangeM, choice.unit).toFixed(rangeDecimals)} ${choice.label}`;
  return losAngleRad && !omitAngle ? `${rangeText}, ${radToDeg(losAngleRad).toFixed(0)}°` : rangeText;
}
