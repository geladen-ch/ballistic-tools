import { el, clear } from '../dom.js';
import { conversionGroup } from '../ui/unit-conversion/conversion-group.js';

// Session-only (in-memory, not persisted across a reload) — same
// convention as bc-tools-view.js's own panelState — so navigating away to
// another tool and back doesn't reset every category to its seed value.
// Keyed by category id, each entry is whichever {unit, value} the user
// last typed into that category (any unit works as the seed for the next
// mount, conversionGroup() converts it to every other unit itself).
let panelState = {};

// Seven independent categories, each rendered as one live-linked
// conversionGroup() (src/ui/unit-conversion/conversion-group.js) — every
// unit here resolves directly through the vendored js-quantities `Qty`
// (src/vendor/js-quantities/quantities.mjs), so no bespoke conversion
// math is needed. Seed values are round, easy-to-recognize ballistics
// numbers (100 m, 800 m/s, ...); temperature/pressure reuse the app's own
// standard-atmosphere defaults (15 °C, 1013.25 hPa — see e.g.
// bc-tools-view.js's LABRADAR_DEFAULT_ATMOSPHERE and atmosphere-
// section.js) so they read as familiar reference points, not arbitrary
// numbers.
const CATEGORIES = [
  {
    id: 'angle', titleKey: 'unitConversion.angle', seedUnit: 'mrad', seedValue: 1,
    units: [
      { unit: 'mrad', label: 'mrad', decimals: 3 },
      { unit: 'arcmin', label: 'MOA', decimals: 2 },
      { unit: 'deg', label: '°', decimals: 3 }
    ]
  },
  {
    id: 'range', titleKey: 'unitConversion.range', seedUnit: 'm', seedValue: 100,
    units: [
      { unit: 'm', label: 'm', decimals: 1 },
      { unit: 'yd', label: 'yd', decimals: 1 },
      { unit: 'ft', label: 'ft', decimals: 0 }
    ]
  },
  {
    id: 'length', titleKey: 'unitConversion.length', seedUnit: 'mm', seedValue: 10,
    units: [
      { unit: 'mm', label: 'mm', decimals: 2 },
      { unit: 'cm', label: 'cm', decimals: 3 },
      { unit: 'in', label: 'in', decimals: 3 }
    ]
  },
  {
    id: 'speed', titleKey: 'unitConversion.speed', seedUnit: 'm/s', seedValue: 800,
    units: [
      { unit: 'm/s', label: 'm/s', decimals: 1 },
      { unit: 'fps', label: 'fps', decimals: 0 },
      { unit: 'mph', label: 'mph', decimals: 1 },
      { unit: 'km/h', label: 'km/h', decimals: 1 }
    ]
  },
  {
    id: 'mass', titleKey: 'unitConversion.mass', seedUnit: 'g', seedValue: 10,
    units: [
      { unit: 'g', label: 'g', decimals: 2 },
      { unit: 'grain', label: 'gr', decimals: 1 }
    ]
  },
  {
    id: 'temperature', titleKey: 'unitConversion.temperature', seedUnit: 'tempC', seedValue: 15,
    units: [
      { unit: 'tempC', label: '°C', decimals: 1 },
      { unit: 'tempF', label: '°F', decimals: 1 }
    ]
  },
  {
    id: 'pressure', titleKey: 'unitConversion.pressure', seedUnit: 'hPa', seedValue: 1013.25,
    units: [
      { unit: 'hPa', label: 'hPa', decimals: 2 },
      { unit: 'mmHg', label: 'mmHg', decimals: 1 },
      { unit: 'inHg', label: 'inHg', decimals: 2 }
    ]
  }
];

export function resetUnitConversionStateForTests() {
  panelState = {};
}

export function mount(container) {
  clear(container);

  const groups = CATEGORIES.map((category) => {
    const saved = panelState[category.id];
    return conversionGroup({
      titleKey: category.titleKey,
      units: category.units,
      initialUnit: saved ? saved.unit : category.seedUnit,
      initialValue: saved ? saved.value : category.seedValue,
      onChange: (unit, value) => { panelState[category.id] = { unit, value }; }
    });
  });

  container.appendChild(el('div', {}, [
    el('h1', { i18n: 'unitConversion.title' }),
    el('p', { i18n: 'unitConversion.intro' }),
    el('div', { class: 'conversion-groups' }, groups)
  ]));
}
