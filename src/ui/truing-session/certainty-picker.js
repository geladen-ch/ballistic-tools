// How well the spotter read a string's impacts in the reticle, picked on every string: three fixed levels, each the half-width
// of a 95% interval in mrad (CERTAINTY_HALF_WIDTH_MRAD in the engine), shown in the angle unit chosen in Settings. "Good" is the
// default; the engine turns the level into the reading's sigma (half the half-width).
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { convertAngularValue } from '../../units.js';
import { CERTAINTY_HALF_WIDTH_MRAD, DEFAULT_CERTAINTY_KEY } from '../../engine/truing-session.js';
import { angle } from './units.js';

// Returns { node, getLevelKey, setLevel }.
export function certaintyPicker({ initialKey = DEFAULT_CERTAINTY_KEY, onInput } = {}) {
  const options = Object.entries(CERTAINTY_HALF_WIDTH_MRAD).map(([key, halfWidth]) => el('option', {
    value: key,
    text: `${t(`truingSession.certainty.${key}`)} (±${angle(halfWidth)})`
  }));
  const select = el('select', { id: 'truingCertainty' }, options);
  select.value = initialKey in CERTAINTY_HALF_WIDTH_MRAD ? initialKey : DEFAULT_CERTAINTY_KEY;
  select.addEventListener('change', () => { if (onInput) onInput(); });

  const node = el('div', { class: 'field' }, [
    el('label', { i18n: 'truingSession.certainty.label' }),
    select
  ]);

  return {
    node,
    getLevelKey: () => select.value,
    setLevel: (key) => { select.value = key; }
  };
}

export function verticalClickMradFrom(rifleSectionInstance) {
  const settings = rifleSectionInstance.getClickSettings();
  return convertAngularValue(settings.vertical, settings.unit, 'mrad');
}

export function horizontalClickMradFrom(rifleSectionInstance) {
  const settings = rifleSectionInstance.getClickSettings();
  return convertAngularValue(settings.horizontal, settings.unit, 'mrad');
}
