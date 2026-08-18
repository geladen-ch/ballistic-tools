import { el } from '../../dom.js';

const KG_TO_GRAIN = 15432.358352941432; // matches bullet-section.js's own constant
const GRAMS_PER_KG = 1000;
const DECIMALS_G = 2;
const DECIMALS_GR = 1;

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Bullet mass, entered as a live-linked gram/grain pair rather than a
// single field behind the app's usual unit preference — mass is
// conventionally quoted in grains in load-development contexts and grams
// in metric ones, and a shooter filling in a bullet they're holding often
// only has one of the two handy, so both stay visible and in sync rather
// than picking one as "the" unit. `value` is the initial mass in kg
// (engine unit, matching massKg elsewhere in this app).
export function massDualField({ value = 0, onInput } = {}) {
  const gramsInput = el('input', { type: 'number', id: 'massGrams', step: 0.01, min: 0, value: round(value * GRAMS_PER_KG, DECIMALS_G) });
  const grainsInput = el('input', { type: 'number', id: 'massGrains', step: 0.1, min: 0, value: round(value * KG_TO_GRAIN, DECIMALS_GR) });

  // getMassKg() is read on every keystroke by callers that persist it
  // straight to a cookie (see bullet-section.js's saveManualBullet(),
  // cd-mach-curve-view.js's persistInputs()) — a blank/invalid
  // intermediate state (<input type=number> reports '' e.g. while text is
  // selected mid-retype) must not fire onInput, and getMassKg() itself
  // falls back to the last real mass rather than a physically-meaningless
  // 0 kg.
  let lastValidKg = value;

  gramsInput.addEventListener('input', () => {
    const grams = parseFloat(gramsInput.value);
    if (Number.isNaN(grams)) return;
    grainsInput.value = round((grams / GRAMS_PER_KG) * KG_TO_GRAIN, DECIMALS_GR);
    lastValidKg = grams / GRAMS_PER_KG;
    if (onInput) onInput();
  });
  grainsInput.addEventListener('input', () => {
    const grains = parseFloat(grainsInput.value);
    if (Number.isNaN(grains)) return;
    gramsInput.value = round((grains / KG_TO_GRAIN) * GRAMS_PER_KG, DECIMALS_G);
    lastValidKg = grains / KG_TO_GRAIN;
    if (onInput) onInput();
  });

  const node = el('div', { class: 'field' }, [
    el('label', { i18n: 'fields.mass' }),
    el('div', { class: 'mass-dual-inputs' }, [
      gramsInput, document.createTextNode(' g'),
      grainsInput, document.createTextNode(' gr')
    ])
  ]);

  function getMassKg() {
    const grams = parseFloat(gramsInput.value);
    return Number.isNaN(grams) ? lastValidKg : grams / GRAMS_PER_KG;
  }

  function setMassKg(kg) {
    gramsInput.value = round(kg * GRAMS_PER_KG, DECIMALS_G);
    grainsInput.value = round(kg * KG_TO_GRAIN, DECIMALS_GR);
    lastValidKg = kg;
  }

  return { node, getMassKg, setMassKg };
}
