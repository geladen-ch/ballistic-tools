import { el } from '../dom.js';
import { CLICK_UNITS, convertAngularValue } from '../units.js';
import { i18nSpan } from '../i18n.js';

const DEFAULT_UNIT = 'mrad';
const DEFAULT_VALUE = 0.1;
const DECIMALS = 3;

function round(value) {
  const factor = 10 ** DECIMALS;
  return Math.round(value * factor) / factor;
}

// Horizontal and vertical scope click values, in a unit chosen right on
// this field — deliberately separate from the app-wide unit preferences
// (see units.js). One shared unit selector governs both the horizontal
// and vertical values; switching it converts the two numbers so the
// physical click size is preserved rather than silently reinterpreted.
export function scopeClicksField({ onInput } = {}) {
  const unitSelect = el(
    'select',
    { id: 'scopeClickUnit' },
    CLICK_UNITS.map((u) => el('option', { value: u.unit, text: u.label }))
  );
  unitSelect.value = DEFAULT_UNIT;
  let currentUnit = DEFAULT_UNIT;

  const horizontalInput = el('input', { type: 'number', id: 'scopeClickHorizontal', step: 0.01, value: DEFAULT_VALUE });
  const verticalInput = el('input', { type: 'number', id: 'scopeClickVertical', step: 0.01, value: DEFAULT_VALUE });

  // getSettings() is read on every keystroke by callers that persist it
  // straight to a cookie (see rifle-section.js's saveManualRifle()) — a
  // blank/invalid intermediate state (<input type=number> reports '' e.g.
  // while text is selected mid-retype) must never leak a NaN into that
  // read, so the last value each box actually held is kept as a fallback.
  let lastValidHorizontal = DEFAULT_VALUE;
  let lastValidVertical = DEFAULT_VALUE;
  const isValidRaw = (raw) => raw !== '' && !Number.isNaN(parseFloat(raw));

  unitSelect.addEventListener('change', () => {
    const newUnit = unitSelect.value;
    for (const input of [horizontalInput, verticalInput]) {
      const raw = parseFloat(input.value);
      if (!Number.isNaN(raw)) input.value = round(convertAngularValue(raw, currentUnit, newUnit));
    }
    currentUnit = newUnit;
    lastValidHorizontal = parseFloat(horizontalInput.value);
    lastValidVertical = parseFloat(verticalInput.value);
    if (onInput) onInput();
  });

  horizontalInput.addEventListener('input', () => {
    if (!isValidRaw(horizontalInput.value)) return;
    lastValidHorizontal = parseFloat(horizontalInput.value);
    if (onInput) onInput();
  });
  verticalInput.addEventListener('input', () => {
    if (!isValidRaw(verticalInput.value)) return;
    lastValidVertical = parseFloat(verticalInput.value);
    if (onInput) onInput();
  });

  const node = el('div', {}, [
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickUnit' }), unitSelect]),
    el('div', { class: 'field' }, [el('label', { i18n: 'fields.scopeClickHorizontal' }), horizontalInput]),
    el('div', { class: 'field' }, [
      el('label', { i18n: 'fields.scopeClickVertical' }), verticalInput
    ]),
    el('p', { class: 'hint', i18n: 'fields.scopeClickHint' })
  ]);

  function getSettings() {
    return {
      unit: unitSelect.value,
      horizontal: isValidRaw(horizontalInput.value) ? parseFloat(horizontalInput.value) : lastValidHorizontal,
      vertical: isValidRaw(verticalInput.value) ? parseFloat(verticalInput.value) : lastValidVertical
    };
  }

  // Programmatic write path (e.g. a library rifle's default click values)
  // — doesn't fire onInput itself, same convention as unitField's
  // setEngineValue. Values are already in `unit`, exactly as entered here
  // normally (no app-wide unit preference involved — see the module
  // comment above).
  function setSettings({ unit, horizontal, vertical }) {
    unitSelect.value = unit;
    currentUnit = unit;
    horizontalInput.value = round(horizontal);
    verticalInput.value = round(vertical);
    lastValidHorizontal = round(horizontal);
    lastValidVertical = round(vertical);
  }

  return { node, getSettings, setSettings };
}
