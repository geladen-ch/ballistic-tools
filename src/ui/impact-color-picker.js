// Settings' impact-dot color selector (hit-probability-prefs.js's
// IMPACT_COLOR_CHOICES) — plain colored swatches, deliberately with no
// per-option text: the color itself is the whole choice, so a translated
// name for each of the five hues would be pure overhead (and every locale
// would have to agree on naming near-arbitrary colors). aria-label carries
// the hex value instead, which needs no translation and still gives a
// screen reader something to tell swatches apart by.
import { el } from '../dom.js';
import { IMPACT_COLOR_CHOICES, getImpactColor, setImpactColor, onImpactColorChange } from '../hit-probability-prefs.js';

export function impactColorPicker() {
  const buttons = IMPACT_COLOR_CHOICES.map((choice) => {
    const btn = el('button', {
      type: 'button',
      class: 'impact-color-option',
      'aria-label': choice.hex.toUpperCase()
    }, [
      el('span', { class: 'impact-color-swatch', style: `background:${choice.hex}` })
    ]);
    btn.addEventListener('click', () => setImpactColor(choice.value));
    return { value: choice.value, btn };
  });

  function applyActive(current) {
    for (const { value, btn } of buttons) {
      const active = value === current;
      btn.className = 'impact-color-option' + (active ? ' active' : '');
      btn.setAttribute('aria-pressed', String(active));
    }
  }
  applyActive(getImpactColor());
  onImpactColorChange(applyActive);

  return el('div', { class: 'impact-color-picker' }, buttons.map((b) => b.btn));
}
