// The presentation edge for values that aren't tied to one form field — a
// computed statistic, a table cell, a sentence in advice text: the user's
// current display unit for a display group (Settings' per-group choice,
// falling back to the group default for a stale or unknown preference),
// and conversion into and out of it. Keyed on the display group itself
// rather than on some form field's id that happens to share its unit.
//
// `from`/`to` name the unit the caller's value is held in; they default to
// the quantity kind's internal unit (src/quantity.js), which is what every
// value will be in once the SI refactor is through.
import { UNIT_GROUPS, GROUP_KINDS, SMALL_LENGTH_PRECISION_DECIMALS } from './units.js';
import { getUnit } from './prefs.js';
import { converter, internalUnit } from './quantity.js';

function groupMeta(group) {
  const meta = UNIT_GROUPS[group];
  if (!meta) throw new Error(`unknown display group: ${group}`);
  return meta;
}

// { unit, label, decimals } — the user's current choice for `group`.
export function displayChoice(group) {
  const { choices, defaultUnit } = groupMeta(group);
  const unit = getUnit(group);
  return choices.find((c) => c.unit === unit) || choices.find((c) => c.unit === defaultUnit);
}

export function quantityLabel(group) {
  return displayChoice(group).label;
}

const defaultUnitOf = (group) => internalUnit(GROUP_KINDS[group]);

// A value held in `from` → the same value in the user's display unit.
export function toDisplayUnit(group, value, from = defaultUnitOf(group)) {
  return converter(from, displayChoice(group).unit)(value);
}

// A value typed in the user's display unit → the same value in `to`.
export function fromDisplayUnit(group, value, to = defaultUnitOf(group)) {
  return converter(displayChoice(group).unit, to)(value);
}

// "12.3 cm" — `decimals` is a number, or a function of the display choice
// (for groups whose precision depends on the unit), defaulting to the
// choice's own display decimals.
export function formatQuantity(group, value, { from = defaultUnitOf(group), decimals } = {}) {
  const choice = displayChoice(group);
  const places = typeof decimals === 'function' ? decimals(choice) : (decimals ?? choice.decimals);
  return `${converter(from, choice.unit)(value).toFixed(places)} ${choice.label}`;
}

// The finer per-unit precision small lengths need where they are measured
// rather than estimated (a bullet's diameter or length, a group size, a
// calibration ruler) — a `decimals` function for formatQuantity().
export function fineLengthDecimals(choice) {
  return SMALL_LENGTH_PRECISION_DECIMALS[choice.unit] ?? choice.decimals;
}
