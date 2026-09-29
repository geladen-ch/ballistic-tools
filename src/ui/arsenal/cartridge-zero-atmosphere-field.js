import { el } from '../../dom.js';
import { i18nSpan } from '../../i18n.js';
import { atmosphereSection } from '../sections/atmosphere-section.js';

// The ICAO standard atmosphere at sea level — what a freshly ticked box
// starts from, since a zero is most often quoted in "standard" air.
const STANDARD_SEA_LEVEL = { tempC: 15, pressureHpa: 1013.25, humidityPct: 0 };
const STORED_KEYS = ['altitudeM', 'tempC', 'pressureHpa', 'humidityPct'];

// Optional per-cartridge "specify zero atmosphere" input for the Arsenal
// cartridge form: the air this cartridge's zero was set in. A checkbox
// reveals the same atmosphere block the tools use, without wind (a zero is
// a calm-air, level setting) and without the named presets (the Labradar
// tool's own mode: plain temperature/pressure/humidity inputs). Stored on
// the cartridge as { altitudeM, tempC, pressureHpa, humidityPct }, or null
// while unchecked — the altitude is back-derived from the station pressure
// by the section itself, same as every other preset-free atmosphere.
//
// The embedded section gets its own no-op `save` on purpose: its default
// one writes the app's shared, session-wide atmosphere state, which this
// field must never touch.
export function cartridgeZeroAtmosphereField({ initialValue = null, onInput } = {}) {
  const enabled = !!initialValue;
  const checkbox = el('input', { type: 'checkbox', id: 'cartridgeZeroAtmosphereEnabled' });
  checkbox.checked = enabled;
  const checkboxRow = el('label', { class: 'checkbox-field' }, [checkbox, i18nSpan('arsenal.cartridgeZeroAtmosphereCheckboxLabel')]);

  const initial = enabled ? { ...STANDARD_SEA_LEVEL, ...initialValue } : STANDARD_SEA_LEVEL;
  const section = atmosphereSection({
    includeWind: false,
    presets: false,
    load: () => initial,
    save: () => {},
    onInput: () => { if (onInput) onInput(); }
  });

  const details = el('div', { class: 'cartridge-zero-atmosphere-details' }, [
    section.node,
    el('p', { class: 'hint', i18n: 'arsenal.cartridgeZeroAtmosphereHint' })
  ]);
  details.style.display = enabled ? '' : 'none';

  checkbox.addEventListener('change', () => {
    details.style.display = checkbox.checked ? '' : 'none';
    if (onInput) onInput();
  });

  const node = el('div', { class: 'field' }, [checkboxRow, details]);

  // The stored object while enabled, null otherwise. A still-being-typed or
  // out-of-range number reads as null for that one air value upstream, and
  // is caught by validate() before Save ever reads this.
  function getValue() {
    if (!checkbox.checked) return null;
    const values = section.getValues();
    const out = {};
    for (const key of STORED_KEYS) out[key] = values[key];
    return out;
  }

  // Called by cartridge-form.js's own Save handler — the inner fields are
  // irrelevant (and hidden) while the checkbox itself is unchecked, same
  // convention as cartridge-precision-field.js's own validate().
  function validate() {
    if (!checkbox.checked) return true;
    return section.validate();
  }

  return { node, getValue, validate };
}
