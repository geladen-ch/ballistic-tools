import { el } from '../../dom.js';
import { FIELD_BOUNDS } from '../../units.js';
import { i18nSpan, t } from '../../i18n.js';

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
// (engine unit, matching massKg elsewhere in this app), or null/omitted
// for "nothing entered yet" (both inputs start blank; blank has always
// been a validation violation here, see computeMessage() below, so this
// is new only in that the field can now start that way rather than
// starting pre-filled at some default).
// `highlightRequired: true` marks the label with a visual "required"
// asterisk proactively, mirroring caliber-field.js's own opt-in flag of
// the same name — not just on-violation the way the live-validation hint
// already is.
export function massDualField({ value = null, onInput, highlightRequired = false } = {}) {
  const gramsInput = el('input', {
    type: 'number', id: 'massGrams', step: 0.01, min: FIELD_BOUNDS.bulletMass.min, max: FIELD_BOUNDS.bulletMass.max,
    value: value != null ? round(value * GRAMS_PER_KG, DECIMALS_G) : ''
  });
  const grainsInput = el('input', {
    type: 'number', id: 'massGrains', step: 0.1,
    min: round(FIELD_BOUNDS.bulletMass.min * (KG_TO_GRAIN / GRAMS_PER_KG), DECIMALS_GR),
    max: round(FIELD_BOUNDS.bulletMass.max * (KG_TO_GRAIN / GRAMS_PER_KG), DECIMALS_GR),
    value: value != null ? round(value * KG_TO_GRAIN, DECIMALS_GR) : ''
  });

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

  // Live validation against the gram bound (FIELD_BOUNDS.bulletMass) —
  // grams is the authoritative reading here since the two inputs are
  // always kept in sync (see both 'input' listeners above), so checking
  // it alone covers a violation entered through either box. One shared
  // dirty flag/hint rather than field-validity.js's usual one-control
  // shape, since a violation flags both inputs' borders at once but only
  // needs a single message underneath.
  let dirty = false;
  const hint = el('p', { class: 'hint warning' });
  hint.style.display = 'none';
  function computeMessage() {
    const grams = parseFloat(gramsInput.value);
    // Unlike caliber-field.js's own optional `required`, mass has never
    // had a caller that tolerates it blank — every one of gramsInput's
    // callers needs a real mass to do anything useful, so a blank value
    // is unconditionally a violation here, same as before this field
    // supported starting blank at all.
    if (Number.isNaN(grams)) return t('fields.errorRequired');
    const { min, max } = FIELD_BOUNDS.bulletMass;
    if (grams < min || grams > max) return t('fields.errorRange', { range: `${min} – ${max} g` });
    return null;
  }
  function refreshValidity() {
    if (!dirty) return true;
    const message = computeMessage();
    gramsInput.classList.toggle('field-invalid', !!message);
    grainsInput.classList.toggle('field-invalid', !!message);
    hint.textContent = message || '';
    hint.style.display = message ? '' : 'none';
    return !message;
  }
  gramsInput.addEventListener('input', () => { dirty = true; refreshValidity(); });
  grainsInput.addEventListener('input', () => { dirty = true; refreshValidity(); });

  const requiredMark = highlightRequired
    ? el('span', { class: 'field-required-mark', title: t('fields.requiredMark') }, [' *'])
    : null;
  const node = el('div', { class: 'field' }, [
    // .field label is itself a space-between flex row (see caliber-
    // field.js's own identical comment) — label text and the required
    // mark are wrapped in one shared span so they stay adjacent.
    el('label', {}, [el('span', {}, [i18nSpan('fields.mass'), requiredMark].filter(Boolean))]),
    el('div', { class: 'mass-dual-inputs' }, [
      gramsInput, document.createTextNode(' g'),
      grainsInput, document.createTextNode(' gr')
    ]),
    hint
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

  return {
    node, getMassKg, setMassKg,
    // Called by a form's own Save handler — forces this shared validity
    // dirty and reports whether it currently passes.
    validate() { dirty = true; return refreshValidity(); }
  };
}
