import { el } from '../../dom.js';
import Qty from '../../vendor/js-quantities/quantities.mjs';

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// One category's worth of live-linked unit fields — N-unit generalization
// of mass-field.js's own gram/grain pair (src/ui/arsenal/mass-field.js):
// editing any one input converts its value (via the vendored js-quantities
// `Qty`, same library units.js's own engineToDisplay()/displayToEngine()
// use) and fills in every sibling input in the group. There's no
// "engine unit" here the way a form field has one — every unit in the
// group is an equal peer, and conversion always goes straight from
// whichever input the user is typing in to every other one.
//
// `units`: [{ unit, label, decimals }] — `unit` is the Qty unit string
// (e.g. 'mrad', 'arcmin', 'fps', 'grain', 'tempC'), `label` is the plain
// unit symbol shown above the input (untranslated — see units.js's own
// comment on UNIT_GROUPS choices for why: "MOA"/"°C" are internationally
// recognized abbreviations, not prose).
export function conversionGroup({ titleKey, units, initialValue, initialUnit, onChange }) {
  const inputs = units.map((u) => el('input', {
    type: 'number', class: 'conversion-input', step: String(10 ** -u.decimals)
  }));

  // A blank/non-numeric intermediate value (e.g. <input type=number>
  // reports '' while its text is selected mid-retype) is a no-op, same
  // convention as mass-field.js's own NaN guard — the other fields keep
  // showing their last real value rather than being cleared or flagged.
  function setFrom(sourceIndex, rawValue) {
    if (rawValue === '' || Number.isNaN(rawValue)) return;
    const sourceUnit = units[sourceIndex].unit;
    for (let i = 0; i < units.length; i++) {
      if (i === sourceIndex) continue;
      const converted = Qty(rawValue, sourceUnit).to(units[i].unit).scalar;
      inputs[i].value = round(converted, units[i].decimals);
    }
    if (onChange) onChange(sourceUnit, rawValue);
  }

  inputs.forEach((input, i) => {
    input.addEventListener('input', () => setFrom(i, parseFloat(input.value)));
  });

  if (initialValue != null) {
    const seedIndex = Math.max(0, units.findIndex((u) => u.unit === initialUnit));
    inputs[seedIndex].value = round(initialValue, units[seedIndex].decimals);
    setFrom(seedIndex, initialValue);
  }

  const fields = units.map((u, i) => el('div', { class: 'field conversion-field' }, [
    el('label', { text: u.label }),
    inputs[i]
  ]));

  return el('div', { class: 'card conversion-group' }, [
    el('h2', { i18n: titleKey }),
    el('div', { class: 'conversion-grid' }, fields)
  ]);
}
