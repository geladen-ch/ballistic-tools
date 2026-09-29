// The three-level certainty control used for the Shoot phase's near-target
// reading — the near target defaults to unresolved, since a busy or shared
// range usually can't resolve individual shots there. Self-calibrating off
// the user's own scope click value — the three labels never change, only
// the sigma each implies does.
import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { convertAngularValue } from '../../units.js';

// label -> half-width in clicks; sigma = half-width/2 (a 95% interval).
// "Less certain" (3 clicks) is the near-target default — its sigma is
// exactly UNRESOLVED_SIGMA_MRAD (0.15) at the app's own default 0.1 mrad
// click value, which is what makes the three-level scale self-calibrating
// rather than an arbitrary ladder.
const LEVELS = [
  { key: 'veryCertain', halfWidthClicks: 1 },
  { key: 'fairlyCertain', halfWidthClicks: 2 },
  { key: 'lessCertain', halfWidthClicks: 3 }
];
const DEFAULT_LEVEL_KEY = 'lessCertain';

// `verticalClickMrad`: the user's own scope vertical click value, already
// resolved to mrad (rifle.getClickSettings() + convertAngularValue(...,
// 'mrad') — see the caller). Returns { node, getSigmaMrad, setLevel,
// getLevelKey }.
export function certaintyPicker({ verticalClickMrad, initialKey = DEFAULT_LEVEL_KEY, onInput } = {}) {
  const options = LEVELS.map((lvl) => el('option', {
    value: lvl.key,
    text: `${t(`truingSession.certainty.${lvl.key}`)} (±${lvl.halfWidthClicks} ${t('truingSession.certainty.clicksUnit')})`
  }));
  const select = el('select', {}, options);
  select.value = LEVELS.some((l) => l.key === initialKey) ? initialKey : DEFAULT_LEVEL_KEY;
  select.addEventListener('change', () => { if (onInput) onInput(); });

  function sigmaForLevel(key) {
    const lvl = LEVELS.find((l) => l.key === key) || LEVELS[LEVELS.length - 1];
    return (lvl.halfWidthClicks * verticalClickMrad) / 2;
  }

  const node = el('div', { class: 'field' }, [
    el('label', { i18n: 'truingSession.certainty.label' }),
    select
  ]);

  return {
    node,
    getSigmaMrad: () => sigmaForLevel(select.value),
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
